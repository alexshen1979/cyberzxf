import { PrismaClient } from '@prisma/client';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();

const STATIC_BASE = 'https://static-data.gaokao.cn/www/2.0/schoolprovinceindex';
const YEARS = parseIdList(process.env.YEARS || process.env.YEAR || '2023');
const CONCURRENCY = Number(process.env.CONCURRENCY || 16);
const REQUEST_TIMEOUT = Number(process.env.REQUEST_TIMEOUT || 10000);
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || 0);
const ONLY_PROVINCE_IDS = parseIdSet(process.env.ONLY_PROVINCE_IDS);
const ONLY_TYPE_IDS = parseIdSet(process.env.ONLY_TYPE_IDS);
const ONLY_SCHOOL_IDS = parseIdSet(process.env.ONLY_SCHOOL_IDS);
const START_SCHOOL = Number(process.env.START_SCHOOL || 0);
const LIMIT_SCHOOLS = Number(process.env.LIMIT_SCHOOLS || 0);
const RESUME = process.env.RESUME !== 'false';
const REPLACE_SOURCE = process.env.REPLACE_SOURCE !== 'false';

const PROVINCES: Record<number, string> = {
  11: '北京', 12: '天津', 13: '河北', 14: '山西', 15: '内蒙古',
  21: '辽宁', 22: '吉林', 23: '黑龙江',
  31: '上海', 32: '江苏', 33: '浙江', 34: '安徽', 35: '福建', 36: '江西', 37: '山东',
  41: '河南', 42: '湖北', 43: '湖南', 44: '广东', 45: '广西', 46: '海南',
  50: '重庆', 51: '四川', 52: '贵州', 53: '云南', 54: '西藏',
  61: '陕西', 62: '甘肃', 63: '青海', 64: '宁夏', 65: '新疆',
};

const TYPE_NAME: Record<number, string> = {
  1: '文科',
  2: '理科',
  3: '综合',
  2073: '物理类',
  2074: '历史类',
};

const COMPREHENSIVE_PROVINCES = [11, 12, 31, 33, 37, 46];
const EARLY_NEW_GAOKAO_PROVINCES = [13, 21, 32, 35, 42, 43, 44, 50];
const NEW_GAOKAO_2024_PROVINCES = [22, 23, 34, 36, 45, 52, 62];
const NEW_GAOKAO_2025_PROVINCES = [14, 15, 41, 51, 53, 61, 63, 64];
const LEGACY_2025_PROVINCES = [54, 65];

interface StaticItem {
  school_id?: string;
  province_id?: string;
  type?: string;
  local_batch_name?: string;
  zslx_name?: string;
  xclevel_name?: string;
  max?: string | number;
  min?: string | number;
  min_section?: string | number;
  average?: string | number;
  num?: string | number;
  sg_name?: string;
  sg_info?: string;
  proscore?: string | number;
  year?: string | number;
}

interface UniversityRef {
  id: string;
  code: string | null;
  name: string;
  level: string | null;
}

interface Task {
  year: number;
  university: UniversityRef;
  schoolId: number;
  provinceId: number;
  typeId: number;
}

const progressPath = path.join(process.cwd(), '.cache', 'gaokao-static-progress.json');

function parseIdList(value: string) {
  return value.split(/[,，\s]+/).map(item => Number(item)).filter(Number.isFinite);
}

function parseIdSet(value: string | undefined) {
  return new Set(value ? parseIdList(value) : []);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(value: unknown) {
  if (value === null || value === undefined || value === '' || value === '-') return null;
  return String(value).trim();
}

function parseNullableInt(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function buildCombos(year: number) {
  const combos: Array<[number, number]> = [];

  for (const provinceId of COMPREHENSIVE_PROVINCES) combos.push([provinceId, 3]);

  const newGaokaoProvinces = [
    ...EARLY_NEW_GAOKAO_PROVINCES,
    ...(year >= 2024 ? NEW_GAOKAO_2024_PROVINCES : []),
    ...(year >= 2025 ? NEW_GAOKAO_2025_PROVINCES : []),
  ];
  for (const provinceId of newGaokaoProvinces) {
    combos.push([provinceId, 2073], [provinceId, 2074]);
  }

  const legacyProvinces = Object.keys(PROVINCES)
    .map(Number)
    .filter(provinceId =>
      !COMPREHENSIVE_PROVINCES.includes(provinceId) &&
      !newGaokaoProvinces.includes(provinceId)
    );
  const finalLegacyProvinces = year >= 2025 ? LEGACY_2025_PROVINCES : legacyProvinces;
  for (const provinceId of finalLegacyProvinces) {
    combos.push([provinceId, 1], [provinceId, 2]);
  }

  return combos.filter(([provinceId, typeId]) => {
    if (ONLY_PROVINCE_IDS.size && !ONLY_PROVINCE_IDS.has(provinceId)) return false;
    if (ONLY_TYPE_IDS.size && !ONLY_TYPE_IDS.has(typeId)) return false;
    return true;
  });
}

function schoolIdFromCode(code: string | null) {
  const n = Number(code);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function urlFor(task: Task) {
  return `${STATIC_BASE}/${task.year}/${task.schoolId}/${task.provinceId}/${task.typeId}/1.json`;
}

function lineType(item: StaticItem) {
  return cleanText(item.sg_name) || cleanText(item.sg_info) ? 'major_group' : 'university';
}

function groupName(item: StaticItem) {
  const code = cleanText(item.sg_name);
  const info = cleanText(item.sg_info);
  if (!code && !info) return null;
  return `专业组${code || ''}${info ? ` ${info}` : ''}`.trim();
}

function batchName(item: StaticItem) {
  const batch = cleanText(item.local_batch_name);
  const enrollment = cleanText(item.zslx_name);
  if (!batch) return enrollment;
  if (!enrollment || enrollment === '普通类') return batch;
  return `${batch}/${enrollment}`;
}

async function requestJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  const text = await res.text();
  if (!res.ok || text.trim().startsWith('<')) return null;

  try {
    const json = JSON.parse(text);
    if (json?.code !== '0000') return null;
    return json;
  } catch {
    return null;
  }
}

async function loadProgress() {
  if (!RESUME) return new Set<string>();
  try {
    const text = await readFile(progressPath, 'utf8');
    const data = JSON.parse(text);
    return new Set<string>(Array.isArray(data.done) ? data.done : []);
  } catch {
    return new Set<string>();
  }
}

let progressDirty = 0;
async function saveProgress(done: Set<string>) {
  progressDirty++;
  if (progressDirty < 200) return;
  progressDirty = 0;
  await mkdir(path.dirname(progressPath), { recursive: true });
  await writeFile(progressPath, JSON.stringify({ done: [...done] }));
}

function taskKey(task: Task) {
  return `${task.year}:${task.schoolId}:${task.provinceId}:${task.typeId}`;
}

async function importTask(task: Task, done: Set<string>, stats: Record<string, number>) {
  const key = taskKey(task);
  if (done.has(key)) {
    stats.skippedDone++;
    return;
  }

  const url = urlFor(task);
  const json = await requestJson(url);
  const items = Array.isArray(json?.data?.item) ? json.data.item as StaticItem[] : [];

  if (REPLACE_SOURCE) {
    await prisma.admissionScore.deleteMany({
      where: {
        year: task.year,
        universityId: task.university.id,
        province: PROVINCES[task.provinceId],
        subjectType: TYPE_NAME[task.typeId],
        sourceType: 'gaokao_static_schoolprovince',
      },
    });
  }

  const rows = items
    .map(item => {
      const minScore = parseNullableInt(item.min);
      if (minScore === null) return null;
      return {
        universityId: task.university.id,
        universityName: task.university.name,
        province: PROVINCES[task.provinceId],
        year: Number(item.year || task.year),
        batch: batchName(item),
        subjectType: TYPE_NAME[task.typeId],
        majorName: null,
        lineType: lineType(item),
        groupCode: cleanText(item.sg_name),
        groupName: groupName(item),
        subjectRequirement: cleanText(item.sg_info),
        minScore,
        minRank: parseNullableInt(item.min_section),
        avgScore: parseNullableInt(item.average),
        planCount: parseNullableInt(item.num),
        sourceName: 'gaokao.cn static-data',
        sourceUrl: url,
        sourceType: 'gaokao_static_schoolprovince',
        isPartial: false,
        dataQuality: 'structured_static',
        rawData: JSON.stringify(item),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (rows.length) {
    await prisma.admissionScore.createMany({ data: rows });
    stats.saved += rows.length;
    stats.hit++;
  } else {
    stats.empty++;
  }

  done.add(key);
  await saveProgress(done);
  if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
}

async function worker(index: number, tasks: Task[], done: Set<string>, stats: Record<string, number>) {
  while (tasks.length) {
    const task = tasks.shift();
    if (!task) return;
    try {
      await importTask(task, done, stats);
    } catch (err: any) {
      stats.errors++;
      console.warn(`worker${index} 失败 ${taskKey(task)} ${task.university.name}: ${err?.message || String(err)}`);
    }

    const finished = stats.hit + stats.empty + stats.skippedDone + stats.errors;
    if (finished % 1000 === 0) {
      console.log(`进度 ${finished}，命中 ${stats.hit}，保存 ${stats.saved}，空 ${stats.empty}，跳过 ${stats.skippedDone}，错误 ${stats.errors}`);
    }
  }
}

async function main() {
  const universities = await prisma.university.findMany({
    where: { code: { not: null } },
    select: { id: true, code: true, name: true, level: true },
    orderBy: { code: 'asc' },
  });

  const selectedUniversities = universities
    .filter(university => {
      const schoolId = schoolIdFromCode(university.code);
      if (!schoolId) return false;
      if (ONLY_SCHOOL_IDS.size && !ONLY_SCHOOL_IDS.has(schoolId)) return false;
      return true;
    })
    .slice(START_SCHOOL, LIMIT_SCHOOLS ? START_SCHOOL + LIMIT_SCHOOLS : undefined);

  const tasks: Task[] = [];
  for (const year of YEARS) {
    const combos = buildCombos(year);
    for (const university of selectedUniversities) {
      const schoolId = schoolIdFromCode(university.code);
      if (!schoolId) continue;
      for (const [provinceId, typeId] of combos) {
        tasks.push({ year, university, schoolId, provinceId, typeId });
      }
    }
  }

  const done = await loadProgress();
  const stats = { hit: 0, empty: 0, saved: 0, skippedDone: 0, errors: 0 };

  console.log(`准备导入 gaokao.cn 静态录取线：${tasks.length} 个任务，院校 ${selectedUniversities.length} 所，年份 ${YEARS.join(',')}，并发 ${CONCURRENCY}`);

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, (_, index) =>
      worker(index + 1, tasks, done, stats)
    )
  );
  await mkdir(path.dirname(progressPath), { recursive: true });
  await writeFile(progressPath, JSON.stringify({ done: [...done] }));

  console.log('导入完成');
  console.log(stats);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
