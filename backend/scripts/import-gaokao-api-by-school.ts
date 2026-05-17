import { PrismaClient } from '@prisma/client';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const prisma = new PrismaClient();
const execFileAsync = promisify(execFile);

const API_URL = 'https://api.zjzw.cn/web/api/';
const YEARS = parseIdList(process.env.YEARS || process.env.YEAR || '2023');
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const PAGE_SIZE = Math.min(Number(process.env.PAGE_SIZE || 20), 20);
const REQUEST_TIMEOUT = Number(process.env.REQUEST_TIMEOUT || 15000);
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || 300);
const RETRIES = Number(process.env.RETRIES || 4);
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS || 2500);
const RATE_LIMIT_COOLDOWN_MS = Number(process.env.RATE_LIMIT_COOLDOWN_MS || 180000);
const USE_JINA_PROXY = process.env.USE_JINA_PROXY === 'true';
const USE_CURL = process.env.USE_CURL === 'true' || USE_JINA_PROXY;
const LOG_EACH_TASK = process.env.LOG_EACH_TASK === 'true';
const LOG_PROGRESS_EVERY = Number(process.env.LOG_PROGRESS_EVERY || 200);
const MARK_ERRORS_DONE = process.env.MARK_ERRORS_DONE === 'true';
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

const COMPREHENSIVE_PROVINCES = [11, 12, 31, 33, 37, 46];
const EARLY_NEW_GAOKAO_PROVINCES = [13, 21, 32, 35, 42, 43, 44, 50];
const NEW_GAOKAO_2024_PROVINCES = [22, 23, 34, 36, 45, 52, 62];
const NEW_GAOKAO_2025_PROVINCES = [14, 15, 41, 51, 53, 61, 63, 64];
const LEGACY_2025_PROVINCES = [54, 65];

interface ScoreItem {
  average?: string | number;
  local_batch_name?: string;
  local_province_name?: string;
  local_type_name?: string;
  min?: string | number;
  min_section?: string | number;
  name?: string;
  num?: string | number;
  school_id?: string | number;
  sg_info?: string;
  sg_name?: string;
  year?: string | number;
  zslx_name?: string;
}

interface UniversityRef {
  id: string;
  code: string | null;
  name: string;
}

interface Task {
  year: number;
  university: UniversityRef;
  schoolId: number;
  provinceId: number;
  typeId: number;
}

const progressPath = path.join(process.cwd(), '.cache', 'gaokao-api-by-school-progress.json');

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

function schoolIdFromCode(code: string | null) {
  const n = Number(code);
  return Number.isFinite(n) && n > 0 ? n : null;
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
  for (const provinceId of finalLegacyProvinces) combos.push([provinceId, 1], [provinceId, 2]);

  return combos.filter(([provinceId, typeId]) => {
    if (ONLY_PROVINCE_IDS.size && !ONLY_PROVINCE_IDS.has(provinceId)) return false;
    if (ONLY_TYPE_IDS.size && !ONLY_TYPE_IDS.has(typeId)) return false;
    return true;
  });
}

function taskKey(task: Task) {
  return `${task.year}:${task.schoolId}:${task.provinceId}:${task.typeId}`;
}

function lineType(item: ScoreItem) {
  return cleanText(item.sg_name) || cleanText(item.sg_info) ? 'major_group' : 'university';
}

function groupName(item: ScoreItem) {
  const code = cleanText(item.sg_name);
  const info = cleanText(item.sg_info);
  if (!code && !info) return null;
  return `专业组${code || ''}${info ? ` ${info}` : ''}`.trim();
}

function batchName(item: ScoreItem) {
  const batch = cleanText(item.local_batch_name);
  const enrollmentType = cleanText(item.zslx_name);
  if (!batch) return enrollmentType;
  if (!enrollmentType || enrollmentType === '普通类') return batch;
  return `${batch}/${enrollmentType}`;
}

function urlFor(task: Task, page: number) {
  const params = new URLSearchParams({
    local_province_id: String(task.provinceId),
    local_type_id: String(task.typeId),
    page: String(page),
    school_id: String(task.schoolId),
    size: String(PAGE_SIZE),
    uri: 'apidata/api/gk/score/province',
    year: String(task.year),
  });
  return `${API_URL}?${params.toString()}`;
}

async function requestJson(url: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const requestUrl = USE_JINA_PROXY ? `http://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}` : url;
      const text = USE_CURL ? await requestTextWithCurl(requestUrl) : await requestTextWithFetch(requestUrl);
      const json = parseJsonText(text);
      if (json?.code && json.code !== '0000') {
        const message = json?.message || `API code ${json.code}`;
        if (json.code === '1069' || String(message).includes('频繁')) {
          throw new Error(`RATE_LIMIT:${message}`);
        }
        throw new Error(message);
      }
      return json;
    } catch (err) {
      lastError = err;
      if (attempt < RETRIES) {
        const message = err instanceof Error ? err.message : String(err);
        const delay = message.startsWith('RATE_LIMIT:')
          ? RATE_LIMIT_COOLDOWN_MS * attempt
          : RETRY_DELAY_MS * attempt;
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

async function requestTextWithFetch(requestUrl: string) {
  const res = await fetch(requestUrl, {
    headers: requestHeaders(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  const text = await res.text();
  if (!res.ok || text.trim().startsWith('<')) throw new Error(`HTTP ${res.status}`);
  return text;
}

async function requestTextWithCurl(requestUrl: string) {
  const { stdout } = await execFileAsync('curl', [
    '-sS',
    '-L',
    '--max-time',
    String(Math.ceil(REQUEST_TIMEOUT / 1000)),
    '--compressed',
    '-H',
    `Accept: ${requestHeaders().Accept}`,
    '-H',
    `Origin: ${requestHeaders().Origin}`,
    '-H',
    `Referer: ${requestHeaders().Referer}`,
    '-H',
    `User-Agent: ${requestHeaders()['User-Agent']}`,
    requestUrl,
  ], {
    maxBuffer: 20 * 1024 * 1024,
  });
  if (stdout.trim().startsWith('<')) throw new Error('HTTP HTML response');
  return stdout;
}

const USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function requestHeaders() {
  return {
    Accept: 'application/json,text/plain,*/*',
    Origin: 'https://www.gaokao.cn',
    Referer: 'https://www.gaokao.cn/',
    'User-Agent': USER_AGENT,
  };
}

function parseJsonText(text: string) {
  const trimmed = text.trim();
  if (/rate limit|too many requests|频繁/i.test(trimmed)) {
    throw new Error(`RATE_LIMIT:${trimmed.slice(0, 160)}`);
  }
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);

  const markdownMatch = trimmed.match(/Markdown Content:\s*([\s\S]+)$/);
  const candidate = markdownMatch ? markdownMatch[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(candidate.slice(start, end + 1));
  }

  throw new Error('响应中没有 JSON 内容');
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
  if (progressDirty < 100) return;
  progressDirty = 0;
  await mkdir(path.dirname(progressPath), { recursive: true });
  await writeFile(progressPath, JSON.stringify({ done: [...done] }));
}

async function importTask(task: Task, done: Set<string>, stats: Record<string, number>) {
  const key = taskKey(task);
  if (done.has(key)) {
    stats.skippedDone++;
    return;
  }

  const first = await requestJson(urlFor(task, 1));
  const firstItems = Array.isArray(first?.data?.item) ? first.data.item as ScoreItem[] : [];
  const numFound = Number(first?.data?.numFound || firstItems.length || 0);
  const pageCount = Math.max(1, Math.ceil(numFound / PAGE_SIZE));
  const items = [...firstItems];
  for (let page = 2; page <= pageCount; page++) {
    const json = await requestJson(urlFor(task, page));
    if (Array.isArray(json?.data?.item)) items.push(...json.data.item);
    if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
  }

  const province = cleanText(firstItems[0]?.local_province_name) || PROVINCES[task.provinceId];
  const subjectType = cleanText(firstItems[0]?.local_type_name);

  if (REPLACE_SOURCE && subjectType) {
    await prisma.admissionScore.deleteMany({
      where: {
        year: task.year,
        universityId: task.university.id,
        province,
        subjectType,
        sourceType: 'gaokao_cn_api_by_school',
      },
    });
  }

  const rows = items
    .map(item => {
      const minScore = parseNullableInt(item.min);
      const itemProvince = cleanText(item.local_province_name) || PROVINCES[task.provinceId];
      const itemSubjectType = cleanText(item.local_type_name);
      if (minScore === null || !itemSubjectType) return null;
      return {
        universityId: task.university.id,
        universityName: task.university.name,
        province: itemProvince,
        year: Number(item.year || task.year),
        batch: batchName(item),
        subjectType: itemSubjectType,
        majorName: null,
        lineType: lineType(item),
        groupCode: cleanText(item.sg_name),
        groupName: groupName(item),
        subjectRequirement: cleanText(item.sg_info),
        minScore,
        minRank: parseNullableInt(item.min_section),
        avgScore: parseNullableInt(item.average),
        planCount: parseNullableInt(item.num),
        sourceName: 'gaokao.cn',
        sourceUrl: urlFor(task, 1),
        sourceType: 'gaokao_cn_api_by_school',
        isPartial: false,
        dataQuality: 'structured_api_by_school',
        rawData: JSON.stringify(item),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (rows.length) {
    await prisma.admissionScore.createMany({ data: rows });
    stats.hit++;
    stats.saved += rows.length;
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
      if (LOG_EACH_TASK) {
        console.log(`worker${index} 开始 ${taskKey(task)} ${task.university.name}`);
      }
      await importTask(task, done, stats);
      if (LOG_EACH_TASK) {
        console.log(`worker${index} 完成 ${taskKey(task)} ${task.university.name}`);
      }
    } catch (err: any) {
      stats.errors++;
      console.warn(`worker${index} 失败 ${taskKey(task)} ${task.university.name}: ${err?.message || String(err)}`);
      if (MARK_ERRORS_DONE) {
        done.add(taskKey(task));
        await saveProgress(done);
      }
    }

    const finished = stats.hit + stats.empty + stats.skippedDone + stats.errors;
    if (LOG_PROGRESS_EVERY > 0 && finished % LOG_PROGRESS_EVERY === 0) {
      console.log(`进度 ${finished}，命中 ${stats.hit}，保存 ${stats.saved}，空 ${stats.empty}，跳过 ${stats.skippedDone}，错误 ${stats.errors}`);
    }
  }
}

async function main() {
  const universities = await prisma.university.findMany({
    where: { code: { not: null } },
    select: { id: true, code: true, name: true },
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
  console.log(`准备按学校导入 gaokao.cn API：${tasks.length} 个任务，院校 ${selectedUniversities.length} 所，年份 ${YEARS.join(',')}，并发 ${CONCURRENCY}`);

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, (_, index) =>
      worker(index + 1, tasks, done, stats)
    )
  );
  await mkdir(path.dirname(progressPath), { recursive: true });
  await writeFile(progressPath, JSON.stringify({ done: [...done] }));

  console.log('导入完成');
  console.log(stats);
  if (stats.errors > 0 && stats.hit + stats.empty + stats.skippedDone === 0) {
    process.exitCode = 2;
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
