import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

const execFileAsync = promisify(execFile);
const prisma = new PrismaClient();

const INDEX_URL = process.env.INDEX_URL || 'https://gaokao.eol.cn/e_html/gk/gkfsd/index.shtml';
const YEAR = Number(process.env.YEAR || 2025);
const LIMIT = Number(process.env.LIMIT || 0);
const ONLY = process.env.ONLY || '';
const TIMEOUT_SECONDS = Number(process.env.TIMEOUT_SECONDS || 12);

const PROVINCE_BY_PATH: Record<string, string> = {
  bei_jing: '北京',
  tian_jin: '天津',
  shang_hai: '上海',
  chong_qing: '重庆',
  he_bei: '河北',
  shan_dong: '山东',
  si_chuan: '四川',
  jiang_su: '江苏',
  an_hui: '安徽',
  zhe_jiang: '浙江',
  jiang_xi: '江西',
  fu_jian: '福建',
  he_nan: '河南',
  hu_bei: '湖北',
  hu_nan: '湖南',
  guang_dong: '广东',
  guang_xi: '广西',
  shan_xi_sheng: '陕西',
  shan_xi: '山西',
  nei_meng: '内蒙古',
  hei_long_jiang: '黑龙江',
  ji_lin: '吉林',
  liao_ning: '辽宁',
  ning_xia: '宁夏',
  gan_su: '甘肃',
  qing_hai: '青海',
  hai_nan: '海南',
  yun_nan: '云南',
  gui_zhou: '贵州',
  xi_zang: '西藏',
  xin_jiang: '新疆',
};

const COMPREHENSIVE_PROVINCES = new Set(['北京', '天津', '上海', '浙江', '山东', '海南']);
const SKIP_KEYWORDS = ['艺术', '体育', '技能', '音乐', '舞蹈', '书法', '播音', '表(导)演', '表（导）演', '美术'];

interface LinkItem {
  text: string;
  url: string;
}

interface TableBlock {
  rows: string[][];
  before: string;
}

interface ParsedRow {
  score: number;
  rank: number;
  sameScoreCount: number | null;
  rawScore: string;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function curl(url: string) {
  const { stdout } = await execFileAsync('curl', [
    '-L',
    '--connect-timeout',
    '5',
    '--max-time',
    String(TIMEOUT_SECONDS),
    '-A',
    'Mozilla/5.0',
    '-s',
    url,
  ], { maxBuffer: 20 * 1024 * 1024 });
  return stdout;
}

function decodeHtml(text: string) {
  return text
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#10;|&#xA;/gi, ' ');
}

function stripTags(html: string) {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function absolutize(url: string, base: string) {
  return new URL(url.trim(), base).toString();
}

function extractTitle(html: string) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]).replace(/—.*$/, '').trim() : '';
}

function extractLinks(html: string) {
  const links: LinkItem[] = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const url = absolutize(match[1], INDEX_URL);
    const text = stripTags(match[2]);
    if (!text.includes(String(YEAR))) continue;
    if (!/(一分一段|一分段|分段表|分数段|成绩分布)/.test(text)) continue;
    if (SKIP_KEYWORDS.some(keyword => text.includes(keyword))) continue;
    links.push({ text, url });
  }
  return [...new Map(links.map(item => [item.url, item])).values()];
}

function provinceFrom(url: string, title: string) {
  for (const [path, province] of Object.entries(PROVINCE_BY_PATH)) {
    if (url.includes(`/${path}/`)) return province;
  }
  for (const province of Object.values(PROVINCE_BY_PATH)) {
    if (title.includes(province)) return province;
  }
  return '';
}

function lastIndexOfAny(text: string, patterns: RegExp[]) {
  let index = -1;
  for (const pattern of patterns) {
    const source = pattern.source;
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const re = new RegExp(source, flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      index = Math.max(index, match.index);
    }
  }
  return index;
}

function explicitSubjectFrom(text: string, province: string) {
  if (/[（(]\s*物理类\s*[）)]|物理类一分一段|物理科目组合|首选物理/.test(text)) return '物理类';
  if (/[（(]\s*历史类\s*[）)]|历史类一分一段|历史科目组合|首选历史/.test(text)) return '历史类';
  if (/[（(]\s*理科\s*[）)]|理科一分一段/.test(text)) return '理科';
  if (/[（(]\s*文科\s*[）)]|文科一分一段/.test(text)) return '文科';
  if (COMPREHENSIVE_PROVINCES.has(province)) return '综合改革';
  return '';
}

function contextualSubjectFrom(text: string, province: string) {
  const candidates = [
    {
      subjectType: '物理类',
      index: lastIndexOfAny(text, [/物理类/g, /物理科目组合/g, /首选物理/g]),
    },
    {
      subjectType: '历史类',
      index: lastIndexOfAny(text, [/历史类/g, /历史科目组合/g, /首选历史/g]),
    },
    {
      subjectType: '理科',
      index: lastIndexOfAny(text, [/理科/g]),
    },
    {
      subjectType: '文科',
      index: lastIndexOfAny(text, [/文科/g]),
    },
  ]
    .filter(item => item.index >= 0)
    .sort((a, b) => b.index - a.index);

  if (candidates.length) return candidates[0].subjectType;
  if (COMPREHENSIVE_PROVINCES.has(province)) return '综合改革';
  return '';
}

function parseTables(html: string): TableBlock[] {
  const tables: TableBlock[] = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(html))) {
    const tableHtml = tableMatch[0];
    const rows: string[][] = [];
    const rowRe = /<tr[\s\S]*?<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(tableHtml))) {
      const cells: string[] = [];
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(rowMatch[0]))) {
        cells.push(stripTags(cellMatch[1]));
      }
      if (cells.some(Boolean)) rows.push(cells);
    }
    tables.push({
      rows,
      before: stripTags(html.slice(Math.max(0, tableMatch.index - 1400), tableMatch.index)),
    });
  }
  return tables;
}

function parseIntText(value: string | undefined) {
  if (!value) return null;
  const n = Number(value.replace(/[,\s，]/g, ''));
  return Number.isInteger(n) ? n : null;
}

function scoreValues(raw: string) {
  const text = raw.replace(/[，,\s]/g, '').replace(/[－—–~～至]/g, '-');
  const range = text.match(/^(\d{2,3})-(\d{2,3})$/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    const values: number[] = [];
    for (let score = min; score <= max; score++) values.push(score);
    return values;
  }
  const exact = text.match(/^(\d{2,3})$/);
  return exact ? [Number(exact[1])] : [];
}

function rowsFromTable(rows: string[][]) {
  const parsed: ParsedRow[] = [];
  for (const cells of rows) {
    for (let i = 0; i + 2 < cells.length; i += 3) {
      const scores = scoreValues(cells[i]);
      const sameScoreCount = parseIntText(cells[i + 1]);
      const rank = parseIntText(cells[i + 2]);
      if (!scores.length || rank === null) continue;
      for (const score of scores) {
        if (score < 0 || score > 750) continue;
        parsed.push({
          score,
          rank,
          sameScoreCount: scores.length === 1 ? sameScoreCount : null,
          rawScore: cells[i],
        });
      }
    }
  }
  return parsed;
}

async function importRows(params: {
  province: string;
  subjectType: string;
  url: string;
  title: string;
  rows: ParsedRow[];
}) {
  const unique = new Map<number, ParsedRow>();
  for (const row of params.rows) unique.set(row.score, row);

  let count = 0;
  for (const row of unique.values()) {
    await prisma.scoreRank.upsert({
      where: {
        province_year_subjectType_score: {
          province: params.province,
          year: YEAR,
          subjectType: params.subjectType,
          score: row.score,
        },
      },
      update: {
        rank: row.rank,
        sameScoreCount: row.sameScoreCount,
        sourceName: '中国教育在线/掌上高考',
        sourceUrl: params.url,
        sourceType: 'eol_score_rank_html',
        rawData: JSON.stringify({ title: params.title, rawScore: row.rawScore }),
      },
      create: {
        province: params.province,
        year: YEAR,
        subjectType: params.subjectType,
        score: row.score,
        rank: row.rank,
        sameScoreCount: row.sameScoreCount,
        sourceName: '中国教育在线/掌上高考',
        sourceUrl: params.url,
        sourceType: 'eol_score_rank_html',
        rawData: JSON.stringify({ title: params.title, rawScore: row.rawScore }),
      },
    });
    count++;
  }
  return count;
}

async function main() {
  const indexHtml = await curl(INDEX_URL);
  let links = extractLinks(indexHtml);
  if (ONLY) {
    links = links.filter(item => item.text.includes(ONLY) || item.url.includes(ONLY));
  }
  if (LIMIT > 0) links = links.slice(0, LIMIT);

  console.log(`发现 ${links.length} 个 ${YEAR} 一分一段候选页面`);
  let imported = 0;
  const skipped: Array<{ text: string; reason: string }> = [];

  for (const [index, link] of links.entries()) {
    try {
      const html = await curl(link.url);
      const title = extractTitle(html) || link.text;
      const province = provinceFrom(link.url, title);
      const tables = parseTables(html);
      let pageImported = 0;
      const explicitSubjectType = explicitSubjectFrom(`${title} ${link.text}`, province);

      for (const table of tables) {
        const subjectType = explicitSubjectType || contextualSubjectFrom(table.before, province);
        if (!province || !subjectType) continue;
        const rows = rowsFromTable(table.rows);
        if (rows.length < 20) continue;
        pageImported += await importRows({ province, subjectType, url: link.url, title, rows });
      }

      imported += pageImported;
      if (pageImported === 0) {
        skipped.push({ text: link.text, reason: `未解析到有效表格，tables=${tables.length}` });
      }
      console.log(`[${index + 1}/${links.length}] ${pageImported ? '导入' : '跳过'} ${pageImported} ${link.text}`);
    } catch (err) {
      skipped.push({ text: link.text, reason: err instanceof Error ? err.message : String(err) });
      console.log(`[${index + 1}/${links.length}] 失败 ${link.text}`);
    }
    await sleep(180);
  }

  console.log(`导入完成，共 upsert ${imported} 条`);
  if (skipped.length) {
    console.log('跳过/失败页面:');
    for (const item of skipped) console.log(`- ${item.text}: ${item.reason}`);
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
