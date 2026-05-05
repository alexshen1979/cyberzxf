/**
 * 2026 大学招生简章爬虫
 *
 * 用法：cd backend && npx tsx scripts/scrape-admission-guides.ts
 *
 * 从各大学招生网站抓取2026年招生简章，转换为Markdown格式存入知识库。
 * 支持增量更新（按 sourceUrl 去重 upsert）。
 */

import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const prisma = new PrismaClient();

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// ─── 目标大学配置 ───────────────────────────────────

interface TargetUniversity {
  /** 大学名称（用于来源标注） */
  name: string;
  /** 分类 */
  category: string;
  /** 招生简章页面 URL */
  url: string;
  /** 正文内容所在的 CSS 选择器 */
  contentSelector: string;
  /** 标题 CSS 选择器（可选，默认取 <title>） */
  titleSelector?: string;
  /** 发布日期 CSS 选择器（可选） */
  dateSelector?: string;
}

const TARGETS: TargetUniversity[] = [
  // ═══ 北京 ═══
  { name: '北京大学', category: '招生简章', url: 'https://www.gotopku.cn/programa/admit/guide/2026.html', contentSelector: '.article-content', titleSelector: 'h1' },
  { name: '清华大学', category: '招生简章', url: 'https://join-tsinghua.edu.cn/info/1003/2026.html', contentSelector: '.content-con', titleSelector: 'h2' },
  { name: '中国人民大学', category: '招生简章', url: 'https://rdzs.ruc.edu.cn/cms/2026/', contentSelector: '.content' },
  { name: '北京航空航天大学', category: '招生简章', url: 'https://zs.buaa.edu.cn/info/1003/2026.htm', contentSelector: '.v_news_content' },
  { name: '北京理工大学', category: '招生简章', url: 'https://admission.bit.edu.cn/html/2026/', contentSelector: '.article' },
  { name: '中国农业大学', category: '招生简章', url: 'https://zs.cau.edu.cn/2026/', contentSelector: '.con' },
  { name: '北京师范大学', category: '招生简章', url: 'https://admission.bnu.edu.cn/zsjz/2026/', contentSelector: '.content' },

  // ═══ 上海 ═══
  { name: '复旦大学', category: '招生简章', url: 'https://www.ao.fudan.edu.cn/index!list.html?sideNav=2026', contentSelector: '.con' },
  { name: '上海交通大学', category: '招生简章', url: 'https://admissions.sjtu.edu.cn/web/jdzsb/2026/', contentSelector: '.content' },
  { name: '同济大学', category: '招生简章', url: 'https://bkzs.tongji.edu.cn/index.portal?.m=2026', contentSelector: '.con' },
  { name: '华东师范大学', category: '招生简章', url: 'https://zsb.ecnu.edu.cn/2026/', contentSelector: '.content' },

  // ═══ 江苏 ═══
  { name: '南京大学', category: '招生简章', url: 'https://bkzs.nju.edu.cn/2026/', contentSelector: '.con' },
  { name: '东南大学', category: '招生简章', url: 'https://zsb.seu.edu.cn/2026/', contentSelector: '.content' },

  // ═══ 浙江 ═══
  { name: '浙江大学', category: '招生简章', url: 'https://zdzsc.zju.edu.cn/2026/', contentSelector: '.con' },

  // ═══ 安徽 ═══
  { name: '中国科学技术大学', category: '招生简章', url: 'https://zsb.ustc.edu.cn/2026/', contentSelector: '.content' },

  // ═══ 湖北 ═══
  { name: '武汉大学', category: '招生简章', url: 'https://aoff.whu.edu.cn/2026/', contentSelector: '.con' },
  { name: '华中科技大学', category: '招生简章', url: 'https://zsb.hust.edu.cn/2026/', contentSelector: '.content' },

  // ═══ 湖南 ═══
  { name: '国防科技大学', category: '招生简章', url: 'https://www.nudt.edu.cn/zsxx/2026/', contentSelector: '.con' },
  { name: '中南大学', category: '招生简章', url: 'https://zhaosheng.csu.edu.cn/2026/', contentSelector: '.content' },

  // ═══ 四川 ═══
  { name: '四川大学', category: '招生简章', url: 'https://zs.scu.edu.cn/2026/', contentSelector: '.content' },
  { name: '电子科技大学', category: '招生简章', url: 'https://zs.uestc.edu.cn/2026/', contentSelector: '.con' },

  // ═══ 陕西 ═══
  { name: '西安交通大学', category: '招生简章', url: 'https://zs.xjtu.edu.cn/2026/', contentSelector: '.content' },
  { name: '西北工业大学', category: '招生简章', url: 'https://zsb.nwpu.edu.cn/2026/', contentSelector: '.con' },

  // ═══ 广东 ═══
  { name: '中山大学', category: '招生简章', url: 'https://admission.sysu.edu.cn/2026/', contentSelector: '.content' },
  { name: '华南理工大学', category: '招生简章', url: 'https://admission.scut.edu.cn/2026/', contentSelector: '.con' },
  { name: '哈尔滨工业大学(深圳)', category: '招生简章', url: 'https://zsb.hitsz.edu.cn/2026/', contentSelector: '.content' },

  // ═══ 天津 ═══
  { name: '南开大学', category: '招生简章', url: 'https://zsb.nankai.edu.cn/2026/', contentSelector: '.content' },
  { name: '天津大学', category: '招生简章', url: 'https://zs.tju.edu.cn/2026/', contentSelector: '.con' },

  // ═══ 辽宁 ═══
  { name: '大连理工大学', category: '招生简章', url: 'https://zs.dlut.edu.cn/2026/', contentSelector: '.content' },
  { name: '东北大学', category: '招生简章', url: 'https://zs.neu.edu.cn/2026/', contentSelector: '.con' },

  // ═══ 吉林 ═══
  { name: '吉林大学', category: '招生简章', url: 'https://zsb.jlu.edu.cn/2026/', contentSelector: '.content' },

  // ═══ 黑龙江 ═══
  { name: '哈尔滨工业大学', category: '招生简章', url: 'https://zsb.hit.edu.cn/2026/', contentSelector: '.content' },

  // ═══ 福建 ═══
  { name: '厦门大学', category: '招生简章', url: 'https://zs.xmu.edu.cn/2026/', contentSelector: '.con' },

  // ═══ 山东 ═══
  { name: '山东大学', category: '招生简章', url: 'https://www.bkzs.sdu.edu.cn/2026/', contentSelector: '.content' },
  { name: '中国海洋大学', category: '招生简章', url: 'https://bkzs.ouc.edu.cn/2026/', contentSelector: '.con' },

  // ═══ 甘肃 ═══
  { name: '兰州大学', category: '招生简章', url: 'https://zsb.lzu.edu.cn/2026/', contentSelector: '.content' },

  // ═══ 重庆 ═══
  { name: '重庆大学', category: '招生简章', url: 'https://zhaosheng.cqu.edu.cn/2026/', contentSelector: '.content' },
  { name: '西南大学', category: '招生简章', url: 'https://bkzsw.swu.edu.cn/2026/', contentSelector: '.con' },

  // ═══ 河南 ═══
  { name: '郑州大学', category: '招生简章', url: 'https://ao.zzu.edu.cn/2026/', contentSelector: '.content' },

  // ═══ 云南 ═══
  { name: '云南大学', category: '招生简章', url: 'https://zsb.ynu.edu.cn/2026/', contentSelector: '.con' },
];

// ─── 工具函数 ────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── 抓取函数 ────────────────────────────────────────

async function scrapeGuide(target: TargetUniversity): Promise<{
  title: string;
  content: string;
  sourceDate: string;
} | null> {
  try {
    console.log(`[SCRAPE] ${target.name} — ${target.url}`);
    const response = await fetch(target.url, {
      signal: AbortSignal.timeout(30000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CyberZhangBot/1.0; +https://cyberzhang.ai)',
      },
    });

    if (!response.ok) {
      console.error(`  -> HTTP ${response.status} for ${target.name}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 提取标题
    let title = '';
    if (target.titleSelector) {
      title = $(target.titleSelector).first().text().trim();
    }
    if (!title) {
      title = $('title').text().trim();
    }
    if (!title) {
      title = `${target.name} 2026年招生简章`;
    }

    // 提取正文
    const contentEl = $(target.contentSelector);
    if (!contentEl.length) {
      console.error(`  -> 未找到内容选择器 "${target.contentSelector}" for ${target.name}`);
      return null;
    }

    // 清理无关元素
    contentEl.find('script, style, nav, .nav, .header, .footer, .sidebar, .comment').remove();

    const markdownContent = turndown.turndown(contentEl.html() || '');

    // 提取来源日期
    let sourceDate = '';
    if (target.dateSelector) {
      sourceDate = $(target.dateSelector).first().text().trim();
    }
    if (!sourceDate) {
      sourceDate = '2026';
    }

    console.log(`  -> OK: "${title}" (${markdownContent.length} 字符)`);
    return { title, content: markdownContent, sourceDate };
  } catch (err: any) {
    console.error(`  -> 抓取失败 ${target.name}: ${err.message}`);
    return null;
  }
}

// ─── 写入数据库 ──────────────────────────────────────

async function upsertEntry(target: TargetUniversity, result: { title: string; content: string; sourceDate: string }) {
  const tags = JSON.stringify([target.name, '2026', '招生简章']);

  const existing = await prisma.knowledgeEntry.findFirst({
    where: { sourceUrl: target.url },
  });

  if (existing) {
    await prisma.knowledgeEntry.update({
      where: { id: existing.id },
      data: {
        title: result.title,
        content: result.content,
        sourceDate: result.sourceDate,
        tags,
      },
    });
    console.log(`  [UPSERT] 已更新: ${result.title}`);
  } else {
    await prisma.knowledgeEntry.create({
      data: {
        title: result.title,
        content: result.content,
        category: target.category,
        tags,
        sourceName: target.name,
        sourceUrl: target.url,
        sourceDate: result.sourceDate,
      },
    });
    console.log(`  [UPSERT] 新建: ${result.title}`);
  }
}

// ─── 主函数 ──────────────────────────────────────────

async function main() {
  const total = TARGETS.length;
  let success = 0;
  let failed = 0;

  console.log(`开始抓取 ${total} 所大学的招生简章...\n`);

  for (let i = 0; i < TARGETS.length; i++) {
    const target = TARGETS[i];
    console.log(`[${i + 1}/${total}]`);
    const result = await scrapeGuide(target);
    if (result) {
      await upsertEntry(target, result);
      success++;
    } else {
      failed++;
    }
    // 速率限制: 2-3秒间隔
    await sleep(2000 + Math.random() * 1000);
  }

  console.log(`\n抓取完成: 成功 ${success}, 失败 ${failed}, 总计 ${total}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('致命错误:', err);
  await prisma.$disconnect();
  process.exit(1);
});
