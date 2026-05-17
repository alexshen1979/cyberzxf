import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const year = Number(process.env.YEAR || process.argv[2] || 2025);
const output = process.env.OUTPUT || process.argv[3] || `score-ranks-${year}.json`;

async function main() {
  const rows = await prisma.scoreRank.findMany({
    where: { year },
    orderBy: [
      { province: 'asc' },
      { subjectType: 'asc' },
      { score: 'desc' },
    ],
  });

  writeFileSync(output, JSON.stringify({
    exportedAt: new Date().toISOString(),
    year,
    count: rows.length,
    rows,
  }));
  console.log(`导出完成: ${rows.length} 条 -> ${output}`);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
