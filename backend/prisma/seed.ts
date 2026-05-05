import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { transformSkillContent } from '../src/utils/skillTransform';

const prisma = new PrismaClient();

const GITHUB_SKILL_URL = 'https://raw.githubusercontent.com/alchaincyf/zhangxuefeng-skill/main/SKILL.md';

function loadLocalDefaultSkill(): string {
  const filePath = resolve(__dirname, 'default-skill.md');
  return readFileSync(filePath, 'utf8');
}

async function fetchSkillFromGitHub(): Promise<string | null> {
  try {
    const res = await fetch(GITHUB_SKILL_URL, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`⚠️  获取 GitHub SKILL.md 失败: HTTP ${res.status}`);
      return null;
    }
    const content = await res.text();
    if (!content || content.length < 500) {
      console.warn('⚠️  获取的 SKILL.md 内容过短，使用本地版本');
      return null;
    }
    const transformed = transformSkillContent(content);
    console.log(`✅ 从 GitHub 获取 SKILL.md 成功 (${content.length} → ${transformed.length} 字符)`);
    return transformed;
  } catch (err: any) {
    console.warn(`⚠️  获取 GitHub SKILL.md 失败: ${err?.message || String(err)}`);
    return null;
  }
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

  // 默认 Skill：张雪峰升学咨询
  const existingSkill = await prisma.skill.findFirst({ where: { isDefault: true } });
  if (!existingSkill) {
    // 优先从 GitHub 获取最新版（自动转换），失败则用本地预转换版本
    const githubContent = await fetchSkillFromGitHub();
    const systemPrompt = githubContent || loadLocalDefaultSkill();

    await prisma.skill.create({
      data: {
        name: '张雪峰升学咨询',
        description: '赛博张老师 AI 升学咨询框架。基于张雪峰老师公开言论研究，融合5个核心心智模型、8条决策启发式、完整表达DNA。',
        systemPrompt,
        model: 'deepseek-chat',
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
    console.log(`✅ 默认 Skill "张雪峰升学咨询" 已创建 (${githubContent ? 'GitHub 最新版' : '本地预置版'}, ${systemPrompt.length} 字符)`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
