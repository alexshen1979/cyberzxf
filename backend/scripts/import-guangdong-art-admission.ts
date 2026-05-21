import { PrismaClient } from '@prisma/client';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

const prisma = new PrismaClient();

const YEAR = Number(process.env.YEAR || 2025);
const FILE_DIR = process.env.FILE_DIR || path.join(process.cwd(), '.cache', 'art-admission');
const SOURCE = process.env.SOURCE || 'all';

type Source = {
  key: string;
  artCategory: string;
  file: string;
  url: string;
  cultureWeight: number;
  professionalWeight: number;
};

const SOURCES: Source[] = [
  {
    key: 'music',
    artCategory: '音乐类',
    file: 'gd-art-music-2025.pdf',
    url: 'https://eea.gd.gov.cn/attachment/0/585/585887/4746775.pdf',
    cultureWeight: 0.5,
    professionalWeight: 0.5,
  },
  {
    key: 'dance',
    artCategory: '舞蹈类',
    file: 'gd-art-dance-2025.pdf',
    url: 'https://eea.gd.gov.cn/attachment/0/585/585888/4746777.pdf',
    cultureWeight: 0.5,
    professionalWeight: 0.5,
  },
  {
    key: 'art-design',
    artCategory: '美术与设计类',
    file: 'gd-art-design-2025.pdf',
    url: 'https://eea.gd.gov.cn/attachment/0/585/585890/4746781.pdf',
    cultureWeight: 0.5,
    professionalWeight: 0.5,
  },
  {
    key: 'broadcast',
    artCategory: '播音与主持类',
    file: 'gd-art-broadcast-2025.pdf',
    url: 'https://eea.gd.gov.cn/attachment/0/585/585892/4746785.pdf',
    cultureWeight: 0.6,
    professionalWeight: 0.4,
  },
  {
    key: 'performance-directing',
    artCategory: '表（导）演类',
    file: 'gd-art-performance-2025.pdf',
    url: 'https://eea.gd.gov.cn/attachment/0/585/585893/4746791.pdf',
    cultureWeight: 0.5,
    professionalWeight: 0.5,
  },
];

async function download(url: string, filePath: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载失败 ${response.status}: ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, buffer);
}

async function parsePdf(filePath: string) {
  const parser = new PDFParse({ data: await readFile(filePath) });
  const data = await parser.getText();
  return data.text;
}

function normalizeName(value: string) {
  return value
    .replace(/\s+/g, '')
    .replace(/[（(](?:中外合作办学|中外合办)[）)]/g, '')
    .trim();
}

async function universityMap() {
  const rows = await prisma.university.findMany({ select: { id: true, name: true } });
  return new Map(rows.map(row => [normalizeName(row.name), row.id]));
}

function parseRows(text: string, source: Source, byName: Map<string, string>) {
  const rows: any[] = [];
  const linePattern = /^(\d{5})\s+(.+?)\s+(\d{3})\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+)$/;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    const [, schoolCode, universityName, groupCode, planCount, admittedCount, minCompositeScore, minRank] = match;
    const baseName = normalizeName(universityName.replace(/[（(].*?[）)]/g, ''));
    rows.push({
      universityId: byName.get(normalizeName(universityName)) || byName.get(baseName) || null,
      universityName: universityName.trim(),
      province: '广东',
      year: YEAR,
      batch: '本科',
      artCategory: source.artCategory,
      subjectType: '不限',
      groupCode,
      groupName: `专业组${groupCode}`,
      minCompositeScore: Number(minCompositeScore),
      minRank: Number(minRank),
      planCount: Number(planCount),
      admissionMethod: '省统考平行志愿',
      sourceName: '广东省教育考试院',
      sourceUrl: source.url,
      sourceType: `official_guangdong_art_${source.key}_pdf`,
      dataQuality: 'official_pdf',
      rawData: JSON.stringify({ schoolCode, universityName, groupCode, planCount: Number(planCount), admittedCount: Number(admittedCount), minCompositeScore: Number(minCompositeScore), minRank: Number(minRank) }),
    });
  }
  return rows;
}

async function upsertRule(source: Source) {
  await prisma.artAdmissionRule.upsert({
    where: {
      province_year_artCategory_batch_subjectType: {
        province: '广东',
        year: YEAR,
        artCategory: source.artCategory,
        batch: '本科',
        subjectType: '不限',
      },
    },
    update: {
      cultureWeight: source.cultureWeight,
      professionalWeight: source.professionalWeight,
      sourceUrl: 'https://eea.gd.gov.cn/ptgk/content/post_4514884.html',
      notes: '投档总分=文化课成绩×文化权重+省统考成绩×2.5×专业权重。',
    },
    create: {
      province: '广东',
      year: YEAR,
      artCategory: source.artCategory,
      batch: '本科',
      subjectType: '不限',
      formulaType: 'guangdong_2025',
      cultureFullScore: 750,
      professionalFullScore: 300,
      cultureWeight: source.cultureWeight,
      professionalWeight: source.professionalWeight,
      scaleTo: 750,
      sourceName: '广东省教育考试院',
      sourceUrl: 'https://eea.gd.gov.cn/ptgk/content/post_4514884.html',
      sourceType: 'official_guangdong_art_rule',
      notes: '投档总分=文化课成绩×文化权重+省统考成绩×2.5×专业权重。',
    },
  });
}

async function importSource(source: Source, byName: Map<string, string>) {
  await mkdir(FILE_DIR, { recursive: true });
  const filePath = path.join(FILE_DIR, source.file);
  try {
    await readFile(filePath);
  } catch {
    await download(source.url, filePath);
  }
  const text = await parsePdf(filePath);
  const rows = parseRows(text, source, byName);
  await upsertRule(source);
  await prisma.artAdmissionScore.deleteMany({
    where: { province: '广东', year: YEAR, artCategory: source.artCategory, sourceType: `official_guangdong_art_${source.key}_pdf` },
  });
  if (rows.length) {
    for (let i = 0; i < rows.length; i += 500) {
      await prisma.artAdmissionScore.createMany({ data: rows.slice(i, i + 500) });
    }
  }
  console.log(`${source.artCategory}: ${rows.length} 条`);
  return rows.length;
}

async function main() {
  const byName = await universityMap();
  const sources = SOURCES.filter(source => SOURCE === 'all' || source.key === SOURCE);
  let total = 0;
  for (const source of sources) {
    total += await importSource(source, byName);
  }
  console.log(`完成：${total} 条广东艺术类投档线`);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
