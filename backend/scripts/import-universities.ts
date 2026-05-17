/**
 * 从中国教育在线 (eol.cn) 静态数据接口导入全国高校列表
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DATA_URL = 'https://static-data.eol.cn/www/2.0/school/list.json';

interface EolSchool {
  school_id: string;
  name: string;
  pro: string;
  city: string;
  nature: string;
  type: string;
  level: string;
  f985: string;
  f211: string;
  dual_class: string;
}

async function importAll() {
  console.log('从 eol.cn 获取高校数据...');
  const res = await fetch(DATA_URL);
  const json: any = await res.json();
  const data: Record<string, EolSchool> = json.data;

  const schools = Object.values(data);
  console.log(`共 ${schools.length} 所院校，开始导入...`);

  let imported = 0;
  let skipped = 0;

  for (const s of schools) {
    try {
      const code = (s.school_id || '').padStart(5, '0');
      // Remove trailing "市"/"区" from city if present
      const city = (s.city || '').replace(/市$|区$/, '') || null;

      await prisma.university.upsert({
        where: { code },
        update: {
          name: s.name,
          type: (s.type || '').replace('类', '') || null,
          level: s.level || null,
          province: s.pro || null,
          city,
          is985: s.f985 === '1',
          is211: s.f211 === '1',
          isDoubleFirst: s.dual_class === '1',
          properties: s.nature || null,
        },
        create: {
          name: s.name,
          code,
          type: (s.type || '').replace('类', '') || null,
          level: s.level || null,
          province: s.pro || null,
          city,
          is985: s.f985 === '1',
          is211: s.f211 === '1',
          isDoubleFirst: s.dual_class === '1',
          properties: s.nature || null,
        },
      });
      imported++;

      if (imported % 200 === 0) {
        console.log(`  已导入 ${imported} 所...`);
      }
    } catch (e: any) {
      skipped++;
      if (skipped <= 5) {
        console.warn(`  跳过 ${s.name}: ${e.message}`);
      }
    }
  }

  console.log(`\n✅ 完成！导入 ${imported} 所，跳过 ${skipped} 所`);
  await prisma.$disconnect();
}

importAll().catch(e => {
  console.error('导入失败:', e);
  process.exit(1);
});
