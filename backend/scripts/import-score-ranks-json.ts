import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const file = process.env.FILE || process.argv[2];
const year = Number(process.env.YEAR || process.argv[3] || 2025);

if (!file || !Number.isInteger(year)) {
  console.error('用法: FILE=score-ranks-2025.json YEAR=2025 npx tsx scripts/import-score-ranks-json.ts');
  process.exit(1);
}

type ScoreRankPayload = {
  rows?: Array<{
    province: string;
    year: number;
    subjectType?: string;
    subject_type?: string;
    score: number;
    rank: number;
    sameScoreCount?: number | null;
    same_score_count?: number | null;
    sourceName?: string | null;
    source_name?: string | null;
    sourceUrl?: string | null;
    source_url?: string | null;
    sourceType?: string | null;
    source_type?: string | null;
    rawData?: string | null;
    raw_data?: string | null;
  }>;
};

function normalize(row: NonNullable<ScoreRankPayload['rows']>[number]) {
  const subjectType = String(row.subjectType ?? row.subject_type ?? '').trim();
  if (!row.province || !subjectType || !Number.isInteger(row.score) || !Number.isInteger(row.rank)) {
    throw new Error(`无效一分一段数据: ${JSON.stringify(row)}`);
  }

  return {
    province: String(row.province).trim(),
    year,
    subjectType,
    score: row.score,
    rank: row.rank,
    sameScoreCount: row.sameScoreCount ?? row.same_score_count ?? null,
    sourceName: row.sourceName ?? row.source_name ?? null,
    sourceUrl: row.sourceUrl ?? row.source_url ?? null,
    sourceType: row.sourceType ?? row.source_type ?? null,
    rawData: row.rawData ?? row.raw_data ?? null,
  };
}

async function main() {
  const payload = JSON.parse(readFileSync(file!, 'utf8')) as ScoreRankPayload;
  const rows = payload.rows || [];
  if (!rows.length) throw new Error('JSON 中没有 rows 数据');

  await prisma.$transaction(async tx => {
    await tx.scoreRank.deleteMany({ where: { year } });
    for (const row of rows) {
      const data = normalize(row);
      await tx.scoreRank.create({ data });
    }
  }, { timeout: 120_000 });

  console.log(`导入完成: ${year} 年 ${rows.length} 条`);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
