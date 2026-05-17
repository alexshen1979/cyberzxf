import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function cleanBatch(batch: string | null) {
  return batch?.replace(/（高考100摘录）/g, '').trim() || null;
}

function hasGroupHint(value: string | null) {
  if (!value) return false;
  return /专业组|组|\(\d+\)|（\d+）|不限|物理|历史|化学|生物|政治|地理/.test(value);
}

function isNatureHint(value: string | null) {
  return !!value && /^(公办|民办|中外合作办学|内地与港澳台地区合作办学)$/.test(value.trim());
}

function inferSource(row: any) {
  if (row.batch?.includes('高考100摘录')) {
    return {
      sourceName: '高考100',
      sourceType: 'gk100_snippet',
      isPartial: true,
      dataQuality: 'third_party_snippet',
    };
  }

  if (row.sourceType) {
    return {
      sourceName: row.sourceName,
      sourceType: row.sourceType,
      isPartial: row.isPartial,
      dataQuality: row.dataQuality,
    };
  }

  return {
    sourceName: 'legacy-import',
    sourceType: 'legacy_static',
    isPartial: true,
    dataQuality: 'legacy_partial',
  };
}

function inferLine(row: any) {
  const majorName = row.majorName?.trim() || null;
  const result = {
    lineType: row.lineType && row.lineType !== 'unknown' ? row.lineType : 'university',
    majorName,
    groupCode: row.groupCode || null,
    groupName: row.groupName || null,
    subjectRequirement: row.subjectRequirement || null,
  };

  if (!majorName) return result;

  const schoolLinePrefix = majorName.match(/^院校最低投档线(?:\s*·\s*(.+))?$/);
  if (schoolLinePrefix) {
    const scope = schoolLinePrefix[1]?.trim() || null;
    if (scope && hasGroupHint(scope) && !isNatureHint(scope)) {
      result.lineType = 'major_group';
      result.groupName = scope;
    } else {
      result.lineType = 'university';
    }
    result.majorName = null;
    return result;
  }

  if (hasGroupHint(majorName) && !isNatureHint(majorName)) {
    result.lineType = 'major_group';
    result.groupName = result.groupName || majorName;
    result.majorName = null;
    return result;
  }

  result.lineType = 'major';
  return result;
}

async function main() {
  const rows = await prisma.admissionScore.findMany({
    select: {
      id: true,
      batch: true,
      majorName: true,
      lineType: true,
      groupCode: true,
      groupName: true,
      subjectRequirement: true,
      sourceName: true,
      sourceType: true,
      isPartial: true,
      dataQuality: true,
    },
  });

  let changed = 0;

  for (const row of rows) {
    const source = inferSource(row);
    const line = inferLine(row);
    const data = {
      batch: cleanBatch(row.batch),
      ...source,
      ...line,
    };

    await prisma.admissionScore.update({ where: { id: row.id }, data });
    changed++;

    if (changed % 500 === 0) {
      console.log(`已重标 ${changed}/${rows.length} 条`);
    }
  }

  const grouped = await prisma.admissionScore.groupBy({
    by: ['lineType', 'sourceType'],
    _count: { _all: true },
  });

  console.log('重标完成');
  console.table(grouped.map(item => ({
    lineType: item.lineType,
    sourceType: item.sourceType,
    count: item._count._all,
  })));
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
