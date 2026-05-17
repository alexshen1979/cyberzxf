import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE_URL = 'https://static-data.eol.cn/www/2.0';
const REQUEST_TIMEOUT = 10000;
const SLEEP_MS = Number(process.env.SLEEP_MS || 80);
const LIMIT = Number(process.env.LIMIT || 0);
const START = Number(process.env.START || 0);

interface EolSpecial {
  special_id?: string;
  special_name?: string;
  code?: string;
  type_name?: string;
  limit_year?: string;
  level2_name?: string;
  level2_code?: string;
  level3_name?: string;
  level3_code?: string;
  nation_feature?: string;
  province_feature?: string;
  is_important?: string;
  nation_first_class?: string;
  xueke_rank_score?: string;
  ruanke_level?: string;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.startsWith('<?xml')) throw new Error('NoSuchKey');
  return JSON.parse(text);
}

function parseSpecials(json: any): EolSpecial[] {
  const data = json?.data || {};
  return Object.values(data)
    .flatMap((value: any) => Array.isArray(value) ? value : [])
    .filter((item: any) => item?.special_name);
}

function featureTags(item: EolSpecial) {
  const tags = new Set<string>();
  if (item.level2_name) tags.add(item.level2_name);
  if (item.level3_name) tags.add(item.level3_name);
  if (item.type_name) tags.add(item.type_name);
  if (item.nation_feature === '1') tags.add('国家特色专业');
  if (item.province_feature === '1') tags.add('省级特色专业');
  if (item.is_important === '1') tags.add('重点专业');
  if (item.nation_first_class === '1') tags.add('国家一流本科专业');
  if (item.xueke_rank_score) tags.add(`学科评估${item.xueke_rank_score}`);
  if (item.ruanke_level) tags.add(`软科${item.ruanke_level}`);
  return [...tags];
}

function strengthLevel(item: EolSpecial) {
  if (item.xueke_rank_score && ['A+', 'A', 'A-'].includes(item.xueke_rank_score)) {
    return `学科评估${item.xueke_rank_score}`;
  }
  if (item.ruanke_level && ['A+', 'A'].includes(item.ruanke_level)) {
    return `软科${item.ruanke_level}`;
  }
  if (item.nation_first_class === '1') return '国家一流本科专业';
  if (item.nation_feature === '1') return '国家特色专业';
  return null;
}

function majorTags(item: EolSpecial) {
  return [
    item.level2_name,
    item.level3_name,
    item.type_name,
  ].filter(Boolean) as string[];
}

function asString(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

async function main() {
  const universities = await prisma.university.findMany({
    where: { code: { not: null } },
    orderBy: { name: 'asc' },
    select: { id: true, code: true, name: true },
    skip: START,
    take: LIMIT || undefined,
  });

  console.log(`准备导入 ${universities.length} 所院校的专业数据...`);

  const majorCache = new Map<string, string>();
  let fetchedSchools = 0;
  let skippedSchools = 0;
  let majorUpserts = 0;
  let universityMajorUpserts = 0;

  for (let i = 0; i < universities.length; i++) {
    const uni = universities[i];
    const schoolId = String(Number(uni.code));
    if (!schoolId || schoolId === 'NaN') {
      skippedSchools++;
      continue;
    }

    try {
      const json = await fetchJson(`${BASE_URL}/school/${schoolId}/pc_special.json`);
      const specials = parseSpecials(json);
      fetchedSchools++;

      for (const item of specials) {
        const majorName = String(item.special_name || '').trim();
        if (!majorName) continue;

        let majorId = majorCache.get(majorName);
        if (!majorId) {
          const major = await prisma.major.upsert({
            where: { name: majorName },
            update: {
              category: item.level2_name || item.level3_name || null,
              degreeType: item.type_name || null,
              tags: JSON.stringify(majorTags(item)),
            },
            create: {
              name: majorName,
              category: item.level2_name || item.level3_name || null,
              degreeType: item.type_name || null,
              tags: JSON.stringify(majorTags(item)),
            },
            select: { id: true },
          });
          majorId = major.id;
          majorCache.set(majorName, majorId);
          majorUpserts++;
        }

        await prisma.universityMajor.upsert({
          where: {
            universityId_majorName: {
              universityId: uni.id,
              majorName,
            },
          },
          update: {
            majorId,
            majorCode: asString(item.code || item.special_id),
            degreeType: item.type_name || null,
            duration: item.limit_year || null,
            featureTags: JSON.stringify(featureTags(item)),
            strengthLevel: strengthLevel(item),
            status: 'enabled',
          },
          create: {
            universityId: uni.id,
            majorId,
            majorName,
            majorCode: asString(item.code || item.special_id),
            degreeType: item.type_name || null,
            duration: item.limit_year || null,
            featureTags: JSON.stringify(featureTags(item)),
            strengthLevel: strengthLevel(item),
            status: 'enabled',
          },
        });
        universityMajorUpserts++;
      }

      if ((i + 1) % 50 === 0) {
        console.log(`进度 ${i + 1}/${universities.length}，成功院校 ${fetchedSchools}，专业关系 ${universityMajorUpserts}`);
      }
    } catch (err: any) {
      skippedSchools++;
      if (skippedSchools <= 20) {
        console.warn(`跳过 ${uni.name}(${schoolId}): ${err?.message || String(err)}`);
      }
    }

    if (SLEEP_MS > 0) await sleep(SLEEP_MS);
  }

  const [majorCount, universityMajorCount] = await Promise.all([
    prisma.major.count(),
    prisma.universityMajor.count(),
  ]);

  console.log('\n导入完成');
  console.log({
    fetchedSchools,
    skippedSchools,
    majorUpserts,
    universityMajorUpserts,
    majorCount,
    universityMajorCount,
  });
}

main()
  .catch((err) => {
    console.error('导入失败:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
