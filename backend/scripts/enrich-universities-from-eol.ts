/**
 * 从中国教育在线/高考静态详情数据补充院校官网、地址、简介和特色标签。
 *
 * 用法：
 *   npx tsx scripts/enrich-universities-from-eol.ts --dry-run --limit 20
 *   npx tsx scripts/enrich-universities-from-eol.ts --concurrency 8
 */
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LIST_URL = 'https://static-data.eol.cn/www/2.0/school/list.json';
const DETAIL_URL = 'https://static-data.eol.cn/www/2.0/school/{id}/info.json';
const CACHE_DIR = path.resolve(__dirname, '../.cache');

const MANUAL_WEBSITE_OVERRIDES: Record<string, string> = {
  // 部分军校/新设院校在 EOL 详情中未给出官网，以下为人工核验过的公开官网或招生官网。
  '海军军医大学': 'https://www.smmu.edu.cn/',
  '武警工程大学': 'http://www.wjxy.edu.cn/',
  '宁夏工业职业学院': 'http://www.ngzy.edu.cn',
  '海南洛桑旅游大学': 'https://www.hi-hltu.edu.cn/',
};

type Args = {
  dryRun: boolean;
  onlyMissing: boolean;
  limit: number;
  offset: number;
  concurrency: number;
  delayMs: number;
};

type EolSchoolListItem = {
  school_id?: string;
  id?: string;
  name?: string;
  pro?: string;
  city?: string;
  town?: string;
  nature?: string;
  type?: string;
  level?: string;
  f985?: string;
  f211?: string;
  dual_class?: string;
  department?: string;
  admissions?: string;
  dh?: string;
};

type EolSchoolDetail = {
  name?: string;
  school_id?: string | number;
  school_site?: string;
  site?: string;
  address?: string;
  content?: string;
  province_name?: string;
  city_name?: string;
  town_name?: string;
  nature_name?: string;
  type_name?: string;
  level_name?: string;
  school_type_name?: string;
  f985?: string | number;
  f211?: string | number;
  dual_class?: string | number;
  dual_class_name?: string;
  belong?: string;
  create_date?: string | number;
  doctor_arr?: Array<{ name?: string; num?: string | number }>;
  master_arr?: Array<{ name?: string; num?: string | number }>;
  subject_arr?: Array<{ name?: string; num?: string | number }>;
  department?: string | number;
  admissions?: string | number;
  doublehigh?: string | number;
  attr_list?: string[];
  label_list?: Array<{ name?: string; key?: string; value?: string }>;
};

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv: string[]): Args {
  const result: Args = {
    dryRun: false,
    onlyMissing: false,
    limit: 0,
    offset: 0,
    concurrency: 6,
    delayMs: 80,
  };
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    const [key, inlineValue] = item.split('=');
    const nextValue = inlineValue ?? argv[i + 1];
    if (item === '--dry-run') result.dryRun = true;
    else if (item === '--only-missing') result.onlyMissing = true;
    else if (key === '--limit') result.limit = Number(nextValue || 0);
    else if (key === '--offset') result.offset = Number(nextValue || 0);
    else if (key === '--concurrency') result.concurrency = Math.max(1, Number(nextValue || 6));
    else if (key === '--delay') result.delayMs = Math.max(0, Number(nextValue || 0));
    if (inlineValue === undefined && ['--limit', '--offset', '--concurrency', '--delay'].includes(key)) i++;
  }
  return result;
}

function schoolIdToCode(schoolId: string | number | undefined) {
  const value = String(schoolId || '').trim();
  return value ? value.padStart(5, '0') : '';
}

function cleanText(value: unknown) {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&ldquo;|&#8220;/gi, '“')
    .replace(/&rdquo;|&#8221;/gi, '”')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function ensureSentenceEnd(value: string) {
  if (!value) return value;
  return /[。！？!?；;]$/.test(value) ? value : `${value}。`;
}

function firstCompleteSentences(value: unknown, maxLength = 220) {
  const cleaned = cleanText(value).replace(/\s*\n\s*/g, '');
  if (!cleaned) return '';
  const sentences = cleaned.match(/[^。！？!?]+[。！？!?]/g) || [];
  let result = '';
  for (const sentence of sentences) {
    const normalized = sentence.trim();
    if (!normalized || (result + normalized).length > maxLength) break;
    result += normalized;
  }
  return result;
}

function compactList(values: string[], maxLength = 140) {
  const result: string[] = [];
  let total = 0;
  for (const value of values) {
    const next = value.trim();
    if (!next) continue;
    if (total + next.length > maxLength) break;
    result.push(next);
    total += next.length + 1;
  }
  return result;
}

function formatAcademicItems(items?: Array<{ name?: string; num?: string | number }>) {
  return (items || [])
    .filter(item => Number(item.num || 0) > 0 && item.name)
    .map(item => `${item.name}${item.num}个`);
}

function trimToLimit(value: string, limit = 500) {
  const cleaned = ensureSentenceEnd(cleanText(value).replace(/\s*\n\s*/g, ''));
  if (cleaned.length <= limit) return cleaned;

  const sentences = cleaned.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [];
  let summary = '';
  for (const sentence of sentences) {
    const normalized = ensureSentenceEnd(sentence.trim());
    if (!normalized) continue;
    if ((summary + normalized).length > 500) break;
    summary += normalized;
  }
  if (summary.length >= 80) return ensureSentenceEnd(summary);
  return ensureSentenceEnd(cleaned.slice(0, limit - 3));
}

function normalizeCity(city?: string | null) {
  const value = String(city || '').trim();
  return value.replace(/(市|地区|盟|自治州|特别行政区)$/, '') || value || null;
}

function normalizeCategory(value?: string | null) {
  return String(value || '').trim().replace(/类$/, '') || null;
}

function buildLocation(province?: string | null, city?: string | null) {
  const p = String(province || '').trim();
  const c = normalizeCity(city) || '';
  if (!p) return c;
  if (!c || p === c || p.startsWith(c) || c.startsWith(p)) return p;
  return `${p}${c}`;
}

function normalizeUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^(https?:)?\/\//i.test(raw)) return raw.startsWith('//') ? `https:${raw}` : raw;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(raw)) return `https://${raw}`;
  return null;
}

function isTrueFlag(value: unknown) {
  return String(value || '').trim() === '1';
}

function buildStructuredIntro(item: EolSchoolListItem, detail: EolSchoolDetail, featureTags: string[]) {
  const name = detail.name || item.name || '该校';
  const loc = buildLocation(detail.province_name || item.pro, detail.city_name || item.city);
  const nature = detail.nature_name || item.nature || '';
  const type = normalizeCategory(detail.type_name || item.type) || '';
  const level = item.level || detail.level_name || detail.school_type_name || '';
  const parts = [nature, type ? `${type}类` : '', level].filter(Boolean).join('');
  const sentences: string[] = [`${name}位于${loc || '中国'}，是一所${parts || '高等院校'}。`];

  const projectTags = [
    isTrueFlag(detail.f985 ?? item.f985) ? '985工程' : '',
    isTrueFlag(detail.f211 ?? item.f211) ? '211工程' : '',
    (isTrueFlag(detail.dual_class ?? item.dual_class) || detail.dual_class_name === '双一流') ? '双一流建设高校' : '',
  ].filter(Boolean);
  if (projectTags.length) {
    sentences.push(`学校是${projectTags.join('、')}。`);
  }

  const highlights = compactList(featureTags.filter(tag => !['教育部直属'].includes(tag)), 70);
  if (highlights.length) {
    sentences.push(`特色标签包括${highlights.join('、')}。`);
  }

  const belong = cleanText(detail.belong);
  if (belong && !['-', '无'].includes(belong)) {
    sentences.push(`学校主管或归属单位为${belong}。`);
  }

  const createYear = Number(detail.create_date || 0);
  if (createYear >= 1800 && createYear <= new Date().getFullYear()) {
    sentences.push(`办学时间可追溯至${createYear}年。`);
  }

  const academicItems = compactList([
    ...formatAcademicItems(detail.doctor_arr),
    ...formatAcademicItems(detail.master_arr),
    ...formatAcademicItems(detail.subject_arr),
  ], 110);
  if (academicItems.length) {
    sentences.push(`学科建设方面，拥有${academicItems.join('、')}。`);
  }

  return trimToLimit(sentences.join(''));
}

function buildAddress(item: EolSchoolListItem, detail: EolSchoolDetail) {
  const detailed = cleanText(detail.address).replace(/,/g, '，');
  if (detailed) return detailed;
  return [detail.province_name || item.pro, normalizeCity(detail.city_name || item.city), detail.town_name || item.town]
    .filter(Boolean)
    .join('');
}

function normalizeFeatureTag(tag: string) {
  const value = tag.trim();
  if (!value || ['985', '211', '双一流'].includes(value)) return '';
  if (value === '强基') return '强基计划';
  if (value === '双高') return '双高计划';
  return value;
}

function buildFeatureTags(item: EolSchoolListItem, detail: EolSchoolDetail) {
  const tags = new Set<string>();
  for (const label of detail.label_list || []) {
    const normalized = normalizeFeatureTag(String(label.name || ''));
    if (normalized) tags.add(normalized);
  }
  for (const attr of detail.attr_list || []) {
    if (attr === '教育部直属') tags.add('教育部直属');
  }
  if (isTrueFlag(detail.department ?? item.department)) tags.add('教育部直属');
  if (isTrueFlag(detail.admissions ?? item.admissions)) tags.add('强基计划');
  if (Number(detail.doublehigh || 0) > 0) tags.add('双高计划');
  return Array.from(tags).slice(0, 12);
}

function changedFields(current: any, next: Record<string, any>) {
  const changes: Record<string, { before: any; after: any }> = {};
  for (const [key, value] of Object.entries(next)) {
    const before = current[key] ?? null;
    if (key === 'featureTags') {
      if (String(before || '[]') !== value) changes[key] = { before, after: value };
    } else if ((before || null) !== (value || null)) {
      changes[key] = { before, after: value };
    }
  }
  return changes;
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { 'user-agent': 'CyberZhang university enrichment/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<any>;
}

async function loadSchoolList() {
  const json = await fetchJson(LIST_URL);
  return Object.values(json.data || {}) as EolSchoolListItem[];
}

async function runWorker<T>(items: T[], worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(args.concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
      if (args.delayMs) await new Promise(resolve => setTimeout(resolve, args.delayMs));
    }
  });
  await Promise.all(workers);
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  const auditFile = path.join(CACHE_DIR, `university-enrichment-${new Date().toISOString().slice(0, 10)}.jsonl`);
  const schools = await loadSchoolList();
  const selected = schools
    .filter(item => schoolIdToCode(item.school_id || item.id))
    .slice(args.offset, args.limit ? args.offset + args.limit : undefined);
  const codes = selected.map(item => schoolIdToCode(item.school_id || item.id));
  const universities = await prisma.university.findMany({ where: { code: { in: codes } } });
  const byCode = new Map(universities.map(item => [item.code, item]));

  const stats = {
    selected: selected.length,
    matched: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    website: 0,
    address: 0,
    introduction: 0,
    featureTags: 0,
  };

  console.log(`准备富化院校 ${selected.length} 所，并发 ${args.concurrency}${args.dryRun ? '（dry-run）' : ''}`);

  await runWorker(selected, async (item, index) => {
    const code = schoolIdToCode(item.school_id || item.id);
    const current = byCode.get(code);
    if (!current) {
      stats.skipped++;
      return;
    }
    stats.matched++;
    try {
      const schoolId = item.school_id || item.id;
      const detailJson = await fetchJson(DETAIL_URL.replace('{id}', String(schoolId)));
      const detail = (detailJson.data || {}) as EolSchoolDetail;
      const tags = buildFeatureTags(item, detail);
      const intro = buildStructuredIntro(item, detail, tags);
      const next = {
        name: detail.name || item.name || current.name,
        type: normalizeCategory(detail.type_name || item.type),
        level: item.level || detail.level_name || detail.school_type_name || null,
        province: detail.province_name || item.pro || null,
        city: normalizeCity(detail.city_name || item.city),
        is985: isTrueFlag(detail.f985 ?? item.f985),
        is211: isTrueFlag(detail.f211 ?? item.f211),
        isDoubleFirst: isTrueFlag(detail.dual_class ?? item.dual_class) || detail.dual_class_name === '双一流',
        properties: detail.nature_name || item.nature || null,
        address: buildAddress(item, detail) || current.address || null,
        website: normalizeUrl(MANUAL_WEBSITE_OVERRIDES[current.name]) || normalizeUrl(detail.school_site) || normalizeUrl(current.website) || null,
        introduction: intro || current.introduction || null,
        featureTags: JSON.stringify(tags),
      };

      if (args.onlyMissing) {
        if (current.website) delete (next as any).website;
        if (current.address) delete (next as any).address;
        if (current.introduction) delete (next as any).introduction;
        if (current.featureTags && current.featureTags !== '[]') delete (next as any).featureTags;
      }

      const changes = changedFields(current, next);
      if (!Object.keys(changes).length) return;

      if (!args.dryRun) {
        await prisma.university.update({ where: { id: current.id }, data: next });
      }
      stats.updated++;
      for (const field of Object.keys(changes)) {
        if (field in stats) (stats as any)[field]++;
      }
      await appendFile(auditFile, JSON.stringify({
        code,
        schoolId,
        name: current.name,
        source: DETAIL_URL.replace('{id}', String(schoolId)),
        dryRun: args.dryRun,
        changes,
      }) + '\n');

      if ((index + 1) % 100 === 0) {
        console.log(`  已处理 ${index + 1}/${selected.length}，更新 ${stats.updated}，失败 ${stats.failed}`);
      }
    } catch (error: any) {
      stats.failed++;
      await appendFile(auditFile, JSON.stringify({ code, name: current.name, error: error.message, dryRun: args.dryRun }) + '\n');
      if (stats.failed <= 10) console.warn(`  ${current.name} 失败：${error.message}`);
    }
  });

  console.log('\n完成：');
  console.log(JSON.stringify(stats, null, 2));
  console.log(`审计日志：${auditFile}`);
}

main()
  .catch(error => {
    console.error('富化失败：', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
