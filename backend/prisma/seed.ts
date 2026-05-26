import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();

function defaultSkillPrompt() {
  return readFileSync(resolve(__dirname, 'default-skill.md'), 'utf8');
}

async function main() {
  // 默认管理员
  const existing = await prisma.admin.findUnique({ where: { username: 'admin' } });
  if (!existing) {
    await prisma.admin.create({
      data: {
        username: 'admin',
        password: await bcrypt.hash('admin123', 10),
        role: 'super_admin',
      },
    });
    console.log('✅ 默认管理员已创建 (admin / admin123)');
  }

  // 默认 Skill：赛博张老师
  const existingSkill = await prisma.skill.findFirst({ where: { isDefault: true } });
  if (!existingSkill) {
    const systemPrompt = defaultSkillPrompt();

    await prisma.skill.create({
      data: {
        name: '赛博张老师',
        description: '涨识小程序里的默认回答 Skill，聚焦高考志愿、考研规划和职业选择。',
        systemPrompt,
        model: 'global',
        temperature: 0.7,
        maxTokens: 2000,
        topP: 0.9,
        keywords: JSON.stringify([
          '高考', '志愿', '分数线', '大学', '专业', '211', '985', '双一流',
          '考研', '复试', '调剂', '学硕', '专硕', '院校', '导师',
          '计算机', '金融', '医学', '法学', '土木', '机械', '电气',
          '文科', '理科', '工科', '就业', '考公', '考编', '避坑',
        ]),
        isDefault: true,
        sortOrder: 0,
      },
    });
    console.log(`✅ 默认 Skill "赛博张老师" 已创建 (${systemPrompt.length} 字符)`);
  }

  // 默认分类
  const defaultCategories = [
    { key: 'gaokao', label: '智能选校', icon: 'School', sortOrder: 1, isDefault: true },
    { key: 'kaoyan', label: '考研规划', icon: 'Reading', sortOrder: 2 },
    { key: 'zhiye', label: '职业方向', icon: 'Briefcase', sortOrder: 3 },
    { key: 'bimian', label: '专业避坑', icon: 'View', sortOrder: 4 },
  ];
  for (const cat of defaultCategories) {
    const existingCat = await prisma.category.findUnique({ where: { key: cat.key } });
    if (!existingCat) {
      await prisma.category.create({ data: cat });
      console.log(`✅ 分类 "${cat.label}" (${cat.key}) 已创建`);
    }
  }

  await prisma.pointSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      freeGift: 100,
      defaultCost: 5,
      deepAnalysisCost: 18,
      volunteerAnalysisCost: 38,
      expireDays: 365,
    },
  });

  const defaultProducts = [
    { id: 'pkg_120', name: '120 咨询点数', description: '首充体验，适合生成报告后继续追问', price: 2990, originalPrice: 3990, points: 120, bonus: 0, sortOrder: 10, enabled: true },
    { id: 'pkg_280', name: '240 咨询点数 + 赠40点', description: '推荐套餐，适合志愿季集中使用', price: 5990, originalPrice: 7990, points: 240, bonus: 40, sortOrder: 20, enabled: true },
    { id: 'pkg_560', name: '480 咨询点数 + 赠80点', description: '适合多省市、多院校反复对比', price: 9990, originalPrice: 13990, points: 480, bonus: 80, sortOrder: 30, enabled: true },
    { id: 'pkg_1000', name: '800 咨询点数 + 赠200点', description: '家庭规划包，适合长期升学咨询', price: 16990, originalPrice: 22990, points: 800, bonus: 200, sortOrder: 40, enabled: true },
  ];
  for (const product of defaultProducts) {
    await prisma.rechargeProduct.upsert({
      where: { id: product.id },
      update: {},
      create: product,
    });
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
