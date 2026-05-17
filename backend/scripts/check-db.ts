import { PrismaClient } from '@prisma/client';

async function main() {
  const p = new PrismaClient();
  const [majors, unis, scores, uniMajors] = await Promise.all([
    p.major.count(),
    p.university.count(),
    p.admissionScore.count(),
    p.universityMajor.count(),
  ]);
  console.log({ majors, universities: unis, admissionScores: scores, universityMajors: uniMajors });

  const sample = await p.university.findMany({ take: 3, select: { name: true, code: true, province: true, is985: true, is211: true } });
  console.log('Sample universities:', JSON.stringify(sample));

  await p.$disconnect();
}
main();
