import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { prisma } from '../src/utils/prisma';

const YEAR = 2026;
const CACHE_DIR = path.join(process.cwd(), '.cache', 'art-2026');

type RuleSeed = {
  province: string;
  year: number;
  artCategory: string;
  direction?: string;
  batch: '本科' | '专科';
  subjectType?: string;
  formulaType: string;
  cultureFullScore?: number;
  professionalFullScore?: number;
  cultureWeight: number;
  professionalWeight: number;
  scaleTo?: number;
  minCultureScore?: number | null;
  minProfessionalScore?: number | null;
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  notes: string;
};

type ArtScoreRankRow = {
  province: string;
  year: number;
  artCategory: string;
  direction?: string;
  batch?: string | null;
  subjectType: string;
  score: number;
  sameScoreCount?: number | null;
  cumulativeCount: number;
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  rawData: string;
};

const jiangsuRuleUrl = 'https://jyt.jiangsu.gov.cn/art/2023/1/6/art_57827_10737259.html';
const jiangsuQualifiedLineUrl = 'https://www.jseea.cn/webfile/index/index_zkxx/2026-01-22/7419928385750568960.html';
const shandongQualifiedLineUrl = 'https://www.sdzk.cn/NewsInfo.aspx?NewsID=7132';
const shandongRankPageUrl = 'https://www.sdzk.cn/NewsInfo.aspx?NewsID=7133';

const ruleSeeds: RuleSeed[] = [
  ...[
    ['音乐类', '音乐表演-声乐', 170, 0.5, 0.5],
    ['音乐类', '音乐表演-器乐', 170, 0.5, 0.5],
    ['音乐类', '音乐教育-声乐', 170, 0.5, 0.5],
    ['音乐类', '音乐教育-器乐', 170, 0.5, 0.5],
    ['舞蹈类', null, 175, 0.5, 0.5],
    ['表（导）演类', '戏剧影视表演', 180, 0.5, 0.5],
    ['表（导）演类', '戏剧影视导演', 180, 0.5, 0.5],
    ['表（导）演类', '服装表演', 180, 0.5, 0.5],
    ['播音与主持类', null, 180, 0.7, 0.3],
    ['美术与设计类', null, 170, 0.6, 0.4],
    ['书法类', null, 200, 0.6, 0.4],
  ].map(([artCategory, direction, minProfessionalScore, cultureWeight, professionalWeight]) => ({
    province: '江苏',
    year: YEAR,
    artCategory: String(artCategory),
    direction: direction ? String(direction) : '',
    batch: '本科' as const,
    subjectType: '不限',
    formulaType: 'weighted',
    cultureFullScore: 750,
    professionalFullScore: 300,
    cultureWeight: Number(cultureWeight),
    professionalWeight: Number(professionalWeight),
    scaleTo: 750,
    minProfessionalScore: Number(minProfessionalScore),
    sourceName: '江苏省教育考试院',
    sourceUrl: jiangsuQualifiedLineUrl,
    sourceType: 'official_jiangsu_art_qualified_line_2026',
      notes: direction
        ? `2026年江苏省艺术类专业省统考合格线。综合分折算规则沿用江苏省艺术类专业考试招生改革实施方案。方向：${direction}。`
        : '2026年江苏省艺术类专业省统考合格线。综合分折算规则沿用江苏省艺术类专业考试招生改革实施方案。',
  })),
  ...[
    ['美术与设计类', null, 190, 180],
    ['书法类', null, 194, 184],
    ['舞蹈类', null, 173, 163],
    ['音乐类', '音乐教育', 188, 178],
    ['音乐类', '音乐表演', 188, 178],
    ['播音与主持类', null, 208, 198],
    ['表（导）演类', '戏剧影视表演', 193, 183],
    ['表（导）演类', '戏剧影视导演', 193, 183],
    ['表（导）演类', '服装表演', 202, 192],
  ].flatMap(([artCategory, direction, undergraduateLine, juniorCollegeLine]) => ([
    {
      province: '山东',
      year: YEAR,
      artCategory: String(artCategory),
      direction: direction ? String(direction) : '',
      batch: '本科' as const,
      subjectType: '综合改革',
      formulaType: 'weighted',
      cultureFullScore: 750,
      professionalFullScore: 300,
      cultureWeight: artCategory === '播音与主持类' ? 0.7 : 0.5,
      professionalWeight: artCategory === '播音与主持类' ? 0.3 : 0.5,
      scaleTo: 750,
      minProfessionalScore: Number(undergraduateLine),
      sourceName: '山东省教育招生考试院',
      sourceUrl: shandongQualifiedLineUrl,
      sourceType: 'official_shandong_art_qualified_line_2026',
      notes: '2026年山东省艺术类专业统考本科合格分数线。综合分按山东省艺术类招生实施办法执行。',
    },
    {
      province: '山东',
      year: YEAR,
      artCategory: String(artCategory),
      direction: direction ? String(direction) : null,
      batch: '专科' as const,
      subjectType: '综合改革',
      formulaType: 'weighted',
      cultureFullScore: 750,
      professionalFullScore: 300,
      cultureWeight: artCategory === '播音与主持类' ? 0.7 : 0.5,
      professionalWeight: artCategory === '播音与主持类' ? 0.3 : 0.5,
      scaleTo: 750,
      minProfessionalScore: Number(juniorCollegeLine),
      sourceName: '山东省教育招生考试院',
      sourceUrl: shandongQualifiedLineUrl,
      sourceType: 'official_shandong_art_qualified_line_2026',
      notes: '2026年山东省艺术类专业统考专科合格分数线。综合分按山东省艺术类招生实施办法执行。',
    },
  ])),
];

const shandongRankFiles = [
  ['6390433160100103207425720.xls', '美术与设计类', null],
  ['6390433161867215024724348.xls', '书法类', null],
  ['6390433162657803432073543.xls', '舞蹈类', null],
  ['6390433164376493167056840.xls', '音乐类', '音乐表演-器乐'],
  ['6390433165270351177821544.xls', '音乐类', '音乐表演-声乐'],
  ['6390433166139150089341377.xls', '音乐类', '音乐教育'],
  ['6390433167053893279635032.xls', '播音与主持类', null],
  ['6390433168750044689318623.xls', '表（导）演类', '戏剧影视表演'],
  ['6390433169501586134380670.xls', '表（导）演类', '戏剧影视导演'],
  ['6390433170175213454272079.xls', '表（导）演类', '服装表演'],
] as const;

async function ensureCacheDir() {
  await mkdir(CACHE_DIR, { recursive: true });
}

function readSheetRows(filePath: string) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' }) as any[][];
}

function toInt(value: unknown) {
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function normalizeShandongDirection(direction: string | null) {
  if (!direction) return '';
  return direction;
}

async function loadShandongArtScoreRanks(): Promise<ArtScoreRankRow[]> {
  const rows: ArtScoreRankRow[] = [];

  for (const [fileName, artCategory, direction] of shandongRankFiles) {
    const filePath = path.join(CACHE_DIR, fileName);
    const sheetRows = readSheetRows(filePath).slice(2);
    for (const row of sheetRows) {
      const score = toInt(row[0]);
      const sameScoreCount = toInt(row[1]);
      const cumulativeCount = toInt(row[2]);
      if (score === null || cumulativeCount === null) continue;

      rows.push({
        province: '山东',
        year: YEAR,
        artCategory,
        direction: normalizeShandongDirection(direction),
        batch: '统考',
        subjectType: '综合改革',
        score,
        sameScoreCount,
        cumulativeCount,
        sourceName: '山东省教育招生考试院',
        sourceUrl: shandongRankPageUrl,
        sourceType: 'official_shandong_art_score_rank_2026',
        rawData: JSON.stringify({
          fileName,
          artCategory,
          direction,
          score,
          sameScoreCount,
          cumulativeCount,
        }),
      });
    }
  }

  return rows;
}

async function upsertRules() {
  let count = 0;
  for (const item of ruleSeeds) {
    await prisma.artAdmissionRule.upsert({
      where: {
        province_year_artCategory_batch_subjectType_direction: {
          province: item.province,
          year: item.year,
          artCategory: item.artCategory,
          batch: item.batch,
          subjectType: item.subjectType || '不限',
          direction: item.direction ?? '',
        },
      },
      update: {
        direction: item.direction ?? '',
        formulaType: item.formulaType,
        cultureFullScore: item.cultureFullScore || 750,
        professionalFullScore: item.professionalFullScore || 300,
        cultureWeight: item.cultureWeight,
        professionalWeight: item.professionalWeight,
        scaleTo: item.scaleTo || 750,
        minCultureScore: item.minCultureScore ?? null,
        minProfessionalScore: item.minProfessionalScore ?? null,
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        sourceType: item.sourceType,
        notes: item.notes,
      },
      create: {
        province: item.province,
        year: item.year,
        artCategory: item.artCategory,
        direction: item.direction ?? '',
        batch: item.batch,
        subjectType: item.subjectType || '不限',
        formulaType: item.formulaType,
        cultureFullScore: item.cultureFullScore || 750,
        professionalFullScore: item.professionalFullScore || 300,
        cultureWeight: item.cultureWeight,
        professionalWeight: item.professionalWeight,
        scaleTo: item.scaleTo || 750,
        minCultureScore: item.minCultureScore ?? null,
        minProfessionalScore: item.minProfessionalScore ?? null,
        sourceName: item.sourceName,
        sourceUrl: item.sourceUrl,
        sourceType: item.sourceType,
        notes: item.notes,
      },
    });
    count += 1;
  }

  console.log(`2026 艺术类规则/合格线导入完成：${count} 条`);
}

async function importArtScoreRanks() {
  const rows = await loadShandongArtScoreRanks();
  await prisma.artScoreRank.deleteMany({
    where: {
      province: '山东',
      year: YEAR,
      sourceType: 'official_shandong_art_score_rank_2026',
    },
  });

  for (let i = 0; i < rows.length; i += 500) {
    await prisma.artScoreRank.createMany({ data: rows.slice(i, i + 500) });
  }

  console.log(`2026 艺术类专业一分一段导入完成：${rows.length} 条`);
}

async function main() {
  await ensureCacheDir();
  for (const [fileName] of shandongRankFiles) {
    await readFile(path.join(CACHE_DIR, fileName));
  }
  await upsertRules();
  await importArtScoreRanks();
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
