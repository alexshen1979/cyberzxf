import { backfillMissingDistributionCommissions } from '../src/services/distribution.service';
import { prisma } from '../src/utils/prisma';

async function main() {
  const distributorId = process.argv[2];
  const result = await backfillMissingDistributionCommissions(distributorId);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
