import { PrismaClient } from '@prisma/client';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const prisma = new PrismaClient();
const execFileAsync = promisify(execFile);

const API_URL = 'https://api.zjzw.cn/web/api/';
const YEAR = Number(process.env.YEAR || 2025);
const CONCURRENCY = Number(process.env.CONCURRENCY || 2);
const PAGE_SIZE = Math.min(Number(process.env.PAGE_SIZE || 20), 20);
const CLEAR_YEAR = process.env.CLEAR_YEAR === 'true';
const LEVEL_FILTER = process.env.LEVEL_FILTER || '本科';
const REQUEST_TIMEOUT = Number(process.env.REQUEST_TIMEOUT || (process.env.USE_JINA_PROXY === 'true' ? 60000 : 12000));
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 8);
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || 200);
const RATE_LIMIT_DELAY_MS = Number(process.env.RATE_LIMIT_DELAY_MS || 2500);
const RATE_LIMIT_COOLDOWN_MS = Number(process.env.RATE_LIMIT_COOLDOWN_MS || 60000);
const MAX_RATE_LIMIT_ROUNDS = Number(process.env.MAX_RATE_LIMIT_ROUNDS || 12);
const NETWORK_COOLDOWN_MS = Number(process.env.NETWORK_COOLDOWN_MS || 30000);
const MAX_NETWORK_ROUNDS = Number(process.env.MAX_NETWORK_ROUNDS || 8);
const USE_JINA_PROXY = process.env.USE_JINA_PROXY === 'true';
const USE_CURL = process.env.USE_CURL === 'true' || USE_JINA_PROXY;
const START_COMBO = Number(process.env.START_COMBO || 0);
const LIMIT_COMBOS = Number(process.env.LIMIT_COMBOS || 0);
const REPLACE_COMBO = process.env.REPLACE_COMBO === 'true';
const ONLY_PROVINCE_IDS = parseIdList(process.env.ONLY_PROVINCE_IDS);
const ONLY_TYPE_IDS = parseIdList(process.env.ONLY_TYPE_IDS);
const MAX_PAGES_PER_COMBO = Number(process.env.MAX_PAGES_PER_COMBO || 0);

const USER_AGENT =
  process.env.USER_AGENT ||
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function parseIdList(value: string | undefined) {
  if (!value) return new Set<number>();
  return new Set(value.split(/[,，\s]+/).map(item => Number(item)).filter(Number.isFinite));
}

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

const LEGACY_ARTS_SCIENCE = [1, 2];
const NEW_GAOKAO = [2073, 2074];
const COMPREHENSIVE = [3];

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
  sg_type?: string | number;
  year?: string | number;
  zslx_name?: string;
  level_name?: string;
}

interface ApiPage {
  items: ScoreItem[];
  numFound: number;
}

interface UniversityRef {
  id: string;
  code: string | null;
  name: string;
  level: string | null;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildCombos(year: number) {
  const combos: Array<[number, number]> = [];

  for (const provinceId of COMPREHENSIVE_PROVINCES) {
    for (const typeId of COMPREHENSIVE) combos.push([provinceId, typeId]);
  }

  const newGaokaoProvinces = [
    ...EARLY_NEW_GAOKAO_PROVINCES,
    ...(year >= 2024 ? NEW_GAOKAO_2024_PROVINCES : []),
    ...(year >= 2025 ? NEW_GAOKAO_2025_PROVINCES : []),
  ];
  for (const provinceId of newGaokaoProvinces) {
    for (const typeId of NEW_GAOKAO) combos.push([provinceId, typeId]);
  }

  const legacyProvinces = Object.keys(PROVINCES)
    .map(Number)
    .filter(provinceId =>
      !COMPREHENSIVE_PROVINCES.includes(provinceId) &&
      !newGaokaoProvinces.includes(provinceId)
    );

  for (const provinceId of year >= 2025 ? LEGACY_2025_PROVINCES : legacyProvinces) {
    for (const typeId of LEGACY_ARTS_SCIENCE) combos.push([provinceId, typeId]);
  }

  return combos;
}

function parseNullableInt(value: unknown) {
  if (value === null || value === undefined || value === '' || value === '-') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function cleanText(value: unknown) {
  if (value === null || value === undefined || value === '' || value === '-') return null;
  return String(value).trim();
}

function groupName(item: ScoreItem) {
  const name = cleanText(item.sg_name);
  const info = cleanText(item.sg_info);
  if (!name && !info) return null;
  return `专业组${name || ''}${info ? ` ${info}` : ''}`.trim();
}

function lineType(item: ScoreItem) {
  return cleanText(item.sg_name) || cleanText(item.sg_info) ? 'major_group' : 'university';
}

function sourceUrl(provinceId: number, typeId: number) {
  const params = new URLSearchParams({
    local_province_id: String(provinceId),
    local_type_id: String(typeId),
    page: '1',
    school_id: '',
    size: String(PAGE_SIZE),
    uri: 'apidata/api/gk/score/province',
    year: String(YEAR),
  });
  return `${API_URL}?${params.toString()}`;
}

function batchName(item: ScoreItem) {
  const batch = cleanText(item.local_batch_name);
  const enrollmentType = cleanText(item.zslx_name);
  if (!batch) return enrollmentType;
  if (!enrollmentType || enrollmentType === '普通类') return batch;
  return `${batch}/${enrollmentType}`;
}

function normalizeSchoolId(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : null;
}

function isRateLimitError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('429') || message.includes('太过频繁');
}

function proxiedUrl(url: string) {
  if (!USE_JINA_PROXY) return url;
  const target = url.replace(/^https:\/\//, 'http://');
  return `https://r.jina.ai/http://r.jina.ai/http://${target}`;
}

function parseJsonResponse(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error('响应中没有 JSON 内容');
}

async function requestText(url: string) {
  if (!USE_CURL) {
    const res = await fetch(url, {
      headers: {
        Referer: 'https://www.gaokao.cn/',
        'User-Agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--max-time',
    String(Math.ceil(REQUEST_TIMEOUT / 1000)),
    '-s',
    '-H',
    `User-Agent: ${USER_AGENT}`,
    '-H',
    'Referer: https://www.gaokao.cn/',
    url,
  ], {
    maxBuffer: 20 * 1024 * 1024,
  });

  return stdout;
}

function resolveUniversity(
  item: ScoreItem,
  bySchoolId: Map<string, UniversityRef>,
  byName: Map<string, UniversityRef>,
) {
  const schoolId = normalizeSchoolId(item.school_id);
  if (schoolId && bySchoolId.has(schoolId)) return bySchoolId.get(schoolId)!;

  const name = cleanText(item.name);
  if (name && byName.has(name)) return byName.get(name)!;

  return null;
}

function toAdmissionScore(
  item: ScoreItem,
  provinceId: number,
  typeId: number,
  bySchoolId: Map<string, UniversityRef>,
  byName: Map<string, UniversityRef>,
) {
  const university = resolveUniversity(item, bySchoolId, byName);
  if (!university) return null;
  if (LEVEL_FILTER && !String(item.level_name || university.level || '').includes(LEVEL_FILTER)) return null;

  const minScore = parseNullableInt(item.min);
  if (minScore === null) return null;

  return {
    universityId: university.id,
    universityName: university.name,
    province: cleanText(item.local_province_name) || PROVINCES[provinceId],
    year: Number(item.year || YEAR),
    batch: batchName(item),
    subjectType: cleanText(item.local_type_name) || TYPE_NAME[typeId],
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
    sourceUrl: sourceUrl(provinceId, typeId),
    sourceType: 'gaokao_cn_api',
    isPartial: MAX_PAGES_PER_COMBO > 0,
    dataQuality: MAX_PAGES_PER_COMBO > 0 ? 'structured_api_partial' : 'structured_api',
    rawData: JSON.stringify(item),
  };
}

async function fetchScorePage(provinceId: number, typeId: number, page: number): Promise<ApiPage> {
  const params = new URLSearchParams({
    local_province_id: String(provinceId),
    local_type_id: String(typeId),
    page: String(page),
    school_id: '',
    size: String(PAGE_SIZE),
    uri: 'apidata/api/gk/score/province',
    year: String(YEAR),
  });

  const url = proxiedUrl(`${API_URL}?${params.toString()}`);
  let rateLimitRound = 0;
  let networkRound = 0;

  while (true) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const json = parseJsonResponse(await requestText(url)) as any;
        if (json?.code && json.code !== '0000') {
          throw new Error(json?.message || `API code ${json.code}`);
        }

        return {
          items: Array.isArray(json?.data?.item) ? json.data.item : [],
          numFound: Number(json?.data?.numFound || 0),
        };
      } catch (err) {
        lastError = err;
        const delay = isRateLimitError(err)
          ? RATE_LIMIT_DELAY_MS * attempt
          : 500 * attempt;
        if (attempt < MAX_RETRIES) await sleep(delay);
      }
    }

    if (isRateLimitError(lastError) && rateLimitRound < MAX_RATE_LIMIT_ROUNDS) {
      rateLimitRound++;
      const cooldown = RATE_LIMIT_COOLDOWN_MS * rateLimitRound;
      console.warn(
        `${PROVINCES[provinceId]}/${TYPE_NAME[typeId]} 第 ${page} 页触发限流，冷却 ${Math.round(cooldown / 1000)} 秒后继续`
      );
      await sleep(cooldown);
      continue;
    }

    if (networkRound < MAX_NETWORK_ROUNDS) {
      networkRound++;
      const cooldown = NETWORK_COOLDOWN_MS * networkRound;
      const message = lastError instanceof Error ? lastError.message : String(lastError);
      console.warn(
        `${PROVINCES[provinceId]}/${TYPE_NAME[typeId]} 第 ${page} 页请求失败(${message})，冷却 ${Math.round(cooldown / 1000)} 秒后继续`
      );
      await sleep(cooldown);
      continue;
    }

    throw lastError;
  }
}

async function importCombo(
  combo: [number, number],
  bySchoolId: Map<string, UniversityRef>,
  byName: Map<string, UniversityRef>,
  state: { saved: number; skipped: number; pages: number; errors: number },
) {
  const [provinceId, typeId] = combo;
  const firstPage = await fetchScorePage(provinceId, typeId, 1);
  const pageCount = Math.ceil(firstPage.numFound / PAGE_SIZE);
  const effectivePageCount = MAX_PAGES_PER_COMBO ? Math.min(pageCount, MAX_PAGES_PER_COMBO) : pageCount;
  const comboRows: ReturnType<typeof toAdmissionScore>[] = [];

  for (let page = 1; page <= Math.max(effectivePageCount, firstPage.items.length ? 1 : 0); page++) {
    const pageData = page === 1 ? firstPage : await fetchScorePage(provinceId, typeId, page);
    const rows = pageData.items
      .map(item => toAdmissionScore(item, provinceId, typeId, bySchoolId, byName))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    state.skipped += pageData.items.length - rows.length;
    if (rows.length) {
      if (REPLACE_COMBO) {
        comboRows.push(...rows);
      } else {
        await prisma.admissionScore.createMany({ data: rows });
        state.saved += rows.length;
      }
    }

    state.pages++;
    if (REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
    if (state.pages % 100 === 0) {
      console.log(`分页进度 ${state.pages} 页，已保存 ${state.saved} 条，跳过 ${state.skipped} 条`);
    }
  }

  if (REPLACE_COMBO) {
    const result = await prisma.admissionScore.deleteMany({
      where: {
        year: YEAR,
        province: PROVINCES[provinceId],
        subjectType: TYPE_NAME[typeId],
        sourceType: 'gaokao_cn_api',
      },
    });
    if (comboRows.length) {
      await prisma.admissionScore.createMany({ data: comboRows.filter((row): row is NonNullable<typeof row> => Boolean(row)) });
    }
    state.saved += comboRows.length;
    if (result.count) {
      console.log(`${PROVINCES[provinceId]}/${TYPE_NAME[typeId]} 已替换旧数据 ${result.count} 条`);
    }
  }

  console.log(`${PROVINCES[provinceId]}/${TYPE_NAME[typeId]} 完成：抓取 ${effectivePageCount}/${pageCount} 页，源数据 ${firstPage.numFound} 条`);
}

async function worker(
  tasks: Array<[number, number]>,
  index: number,
  bySchoolId: Map<string, UniversityRef>,
  byName: Map<string, UniversityRef>,
  state: { saved: number; skipped: number; pages: number; errors: number },
) {
  while (tasks.length) {
    const combo = tasks.shift();
    if (!combo) return;

    try {
      await importCombo(combo, bySchoolId, byName, state);
    } catch (err: any) {
      state.errors++;
      console.warn(`worker${index} 跳过 ${PROVINCES[combo[0]]}/${TYPE_NAME[combo[1]]}: ${err?.message || String(err)}`);
    }
  }
}

async function main() {
  if (CLEAR_YEAR) {
    const result = await prisma.admissionScore.deleteMany({ where: { year: YEAR } });
    console.log(`已清理 ${YEAR} 年录取数据 ${result.count} 条`);
  }

  const universities = await prisma.university.findMany({
    where: { code: { not: null } },
    select: { id: true, code: true, name: true, level: true },
  });

  const bySchoolId = new Map<string, UniversityRef>();
  const byName = new Map<string, UniversityRef>();
  for (const university of universities) {
    const schoolId = normalizeSchoolId(university.code);
    if (schoolId) bySchoolId.set(schoolId, university);
    if (!byName.has(university.name)) byName.set(university.name, university);
  }

  const allCombos = buildCombos(YEAR);
  const filteredCombos = allCombos.filter(([provinceId, typeId]) => {
    if (ONLY_PROVINCE_IDS.size && !ONLY_PROVINCE_IDS.has(provinceId)) return false;
    if (ONLY_TYPE_IDS.size && !ONLY_TYPE_IDS.has(typeId)) return false;
    return true;
  });
  const tasks = filteredCombos.slice(START_COMBO, LIMIT_COMBOS ? START_COMBO + LIMIT_COMBOS : undefined);
  const state = { saved: 0, skipped: 0, pages: 0, errors: 0 };

  console.log(`准备导入 ${YEAR} 年录取数据：${tasks.length}/${filteredCombos.length} 个省份科类，分页大小 ${PAGE_SIZE}`);

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, (_, index) =>
      worker(tasks, index + 1, bySchoolId, byName, state)
    )
  );

  const total = await prisma.admissionScore.count({ where: { year: YEAR } });
  console.log('\n导入完成');
  console.log({
    year: YEAR,
    savedThisRun: state.saved,
    totalForYear: total,
    skippedRows: state.skipped,
    fetchedPages: state.pages,
    errors: state.errors,
  });
}

main()
  .catch((err) => {
    console.error('导入失败:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
