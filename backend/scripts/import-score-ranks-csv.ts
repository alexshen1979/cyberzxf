import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const file = process.env.FILE || process.argv[2];
const province = process.env.PROVINCE || process.argv[3];
const year = Number(process.env.YEAR || process.argv[4]);
const subjectType = process.env.SUBJECT_TYPE || process.argv[5];
const sourceName = process.env.SOURCE_NAME || null;
const sourceUrl = process.env.SOURCE_URL || null;

if (!file || !province || !Number.isInteger(year) || !subjectType) {
  console.error('用法: FILE=score-rank.csv PROVINCE=江苏 YEAR=2025 SUBJECT_TYPE=物理类 npx tsx scripts/import-score-ranks-csv.ts');
  console.error('CSV 表头支持: score,rank,sameScoreCount 或 分数,位次,本段人数');
  process.exit(1);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let cell = '';
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter(item => item.some(Boolean));
}

function normalizeHeader(header: string) {
  const key = header.replace(/^\uFEFF/, '').trim().toLowerCase();
  if (['score', '分数', '分'].includes(key)) return 'score';
  if (['rank', '位次', '累计人数', '累计'].includes(key)) return 'rank';
  if (['samescorecount', 'same_score_count', 'samecount', 'count', '本段人数', '同分人数', '人数'].includes(key)) return 'sameScoreCount';
  return key;
}

function toInt(value: string | undefined) {
  if (!value) return null;
  const n = Number(value.replace(/[,\s]/g, ''));
  return Number.isInteger(n) ? n : null;
}

async function main() {
  const text = readFileSync(file!, 'utf8');
  const [headers, ...lines] = parseCsv(text);
  const headerIndex = new Map(headers.map((header, index) => [normalizeHeader(header), index]));
  const rows = lines
    .map(line => {
      const score = toInt(line[headerIndex.get('score') ?? -1]);
      const rank = toInt(line[headerIndex.get('rank') ?? -1]);
      const sameScoreCount = toInt(line[headerIndex.get('sameScoreCount') ?? -1]);
      if (score === null || rank === null) return null;
      return {
        province,
        year,
        subjectType,
        score,
        rank,
        sameScoreCount,
        sourceName,
        sourceUrl,
        sourceType: 'score_rank_csv',
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  let count = 0;
  for (const row of rows) {
    await prisma.scoreRank.upsert({
      where: {
        province_year_subjectType_score: {
          province: row.province,
          year: row.year,
          subjectType: row.subjectType,
          score: row.score,
        },
      },
      update: row,
      create: row,
    });
    count++;
  }
  console.log(`导入完成: ${province} ${year} ${subjectType} ${count} 条`);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
