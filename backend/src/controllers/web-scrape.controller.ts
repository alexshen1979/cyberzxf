import { Context } from 'koa';
import * as cheerio from 'cheerio';
import { createLogger } from '../utils/logger';
import { config } from '../config';
import { prisma } from '../utils/prisma';

const logger = createLogger('web-scrape');

const FETCH_TIMEOUT = 20000;
const MAX_CONTENT_LENGTH = 80000;
const SEARCH_RESULT_LIMIT = 20;

// 真实浏览器请求头
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

// ─── 全网搜索（关键词 → 搜索结果列表） ──────────────────

export async function webSearch(ctx: Context) {
  const { keyword } = ctx.request.body as { keyword: string };

  if (!keyword || !keyword.trim()) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请输入搜索关键词' };
    return;
  }

  const query = keyword.trim();

  try {
    // 同时搜索 DuckDuckGo 和 Bing，合并去重结果
    const [ddgResults, bingResults] = await Promise.allSettled([
      searchDuckDuckGo(query),
      searchBing(query),
    ]);

    const results: Array<{ title: string; snippet: string; url: string; displayUrl: string }> = [];
    const seenUrls = new Set<string>();

    const addResults = (list: typeof results) => {
      for (const r of list) {
        if (results.length >= SEARCH_RESULT_LIMIT) break;
        const normalized = r.url.replace(/\/$/, '').toLowerCase();
        if (!seenUrls.has(normalized)) {
          seenUrls.add(normalized);
          results.push(r);
        }
      }
    };

    if (ddgResults.status === 'fulfilled') addResults(ddgResults.value);
    if (bingResults.status === 'fulfilled') addResults(bingResults.value);

    logger.info('全网搜索完成: "%s" → %d 条结果 (DDG:%s Bing:%s)',
      keyword, results.length,
      ddgResults.status === 'fulfilled' ? ddgResults.value.length : 'fail',
      bingResults.status === 'fulfilled' ? bingResults.value.length : 'fail',
    );

    ctx.body = { success: true, data: { keyword, results, total: results.length } };
  } catch (err: any) {
    logger.error('全网搜索失败: %s', err.message || String(err));
    ctx.status = 500;
    ctx.body = { success: false, message: `搜索失败: ${err.message || '未知错误'}` };
  }
}

// ─── URL 抓取（URL → 结构化内容） ─────────────────────

export async function webScrape(ctx: Context) {
  const { url } = ctx.request.body as { url: string };

  if (!url || !/^https?:\/\/.+/.test(url)) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请输入有效的网页链接' };
    return;
  }

  try {
    const html = await fetchHtml(url);

    if (!html) {
      ctx.status = 422;
      ctx.body = { success: false, message: '无法获取网页内容，该网站可能禁止访问或链接已失效' };
      return;
    }

    const $ = cheerio.load(html);

    // 提取标题
    const title = $('meta[property="og:title"]').attr('content')
      || $('h1').first().text().trim()
      || $('title').text().trim()
      || '未知标题';

    // 移除无用元素
    ['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript', 'svg',
     '.sidebar', '.comment', '.advertisement', '.nav', '.menu', '.footer', '.header',
     '.related', '.recommend', '[role="navigation"]', '[role="banner"]'].forEach(sel => {
      $(sel).remove();
    });

    // 提取主要内容
    let content = '';
    const selectors = ['article', 'main', '.article-content', '.post-content', '.entry-content', '#content', '.content', 'body'];
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length > 0) {
        const text = el.text().trim();
        if (text.length > content.length) content = text;
      }
    }

    // 清理文本
    content = content
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/ {2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // 截断过长内容
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.slice(0, MAX_CONTENT_LENGTH) + '\n\n...（内容已截断）';
    }

    if (!content || content.length < 30) {
      ctx.status = 422;
      ctx.body = { success: false, message: '未能提取到有效内容，请确认链接为文章页面' };
      return;
    }

    // 元信息
    const description = $('meta[name="description"]').attr('content')
      || $('meta[property="og:description"]').attr('content')
      || '';
    const keywords = $('meta[name="keywords"]').attr('content')?.trim() || '';
    const ogDate = $('meta[property="article:published_time"]').attr('content')
                || $('meta[name="pubdate"]').attr('content')
                || '';
    const sourceName = new URL(url).hostname.replace(/^www\./, '');

    const fullText = `${title} ${description} ${content.slice(0, 2000)}`;
    const suggestedCategory = guessCategory(fullText);
    const suggestedTags = extractTags(fullText, keywords);
    // 添加来源域名作为标签
    if (!suggestedTags.includes(sourceName)) {
      suggestedTags.unshift(sourceName);
    }

    logger.info('网页抓取成功: %s → %d 字符, category=%s', url, content.length, suggestedCategory);

    ctx.body = {
      success: true,
      data: {
        title: title.slice(0, 200),
        content,
        sourceName,
        sourceUrl: url,
        sourceDate: ogDate || new Date().toISOString().slice(0, 7),
        suggestedCategory,
        suggestedTags: suggestedTags.slice(0, 10),
        description: description.slice(0, 500),
        contentLength: content.length,
      },
    };
  } catch (err: any) {
    if (err.name === 'AbortError' || err.message?.includes('timeout')) {
      ctx.status = 504;
      ctx.body = { success: false, message: '网页请求超时，请检查链接是否可访问' };
      return;
    }
    logger.error('网页抓取失败: %s → %s', url, err.message || String(err));
    ctx.status = 422;
    ctx.body = { success: false, message: `抓取失败: ${err.message || '未知错误'}` };
  }
}

// ─── AI 润色（DeepSeek 重写标题和内容） ─────────────────

export async function webPolish(ctx: Context) {
  const { title, content, type } = ctx.request.body as { title: string; content: string; type: 'article' | 'knowledge' };

  if (!content || content.trim().length < 20) {
    ctx.status = 400;
    ctx.body = { success: false, message: '内容太短，无法润色' };
    return;
  }

  try {
    // 解析 API 凭证：优先从 DB 读取，留空则回退环境变量
    let apiKey = config.deepseek.apiKey;
    let baseUrl = config.deepseek.baseUrl;

    try {
      const aiConfig = await prisma.aiConfig.findFirst();
      if (aiConfig) {
        if (aiConfig.apiKey && aiConfig.apiKey.trim()) apiKey = aiConfig.apiKey;
        if (aiConfig.apiBaseUrl && aiConfig.apiBaseUrl.trim()) baseUrl = aiConfig.apiBaseUrl;
      }
    } catch {
      // fallback to env config
    }

    if (!apiKey) {
      ctx.status = 500;
      ctx.body = { success: false, message: 'DeepSeek API Key 未配置，请在管理后台 AI 配置中设置' };
      return;
    }

    const isKnowledge = type === 'knowledge';
    const typeLabel = isKnowledge ? '知识库条目' : '文章';

    const knowledgePrompt = `你是一个专业的知识库编辑。请将以下网页抓取内容整理为结构化知识条目。

## 原始标题
${title || '（无标题）'}

## 原始内容
${content.slice(0, 8000)}

## 整理要求
1. **标题**：提炼精准的知识条目标题，格式"[主体][关键信息]"。例如"北京大学2026年本科招生章程"、"计算机专业全国学科评估排名"
2. **内容**：
   - 提取关键事实和精确数据（分数线、时间、名额、比例等），保留原始数字不做修改
   - 按"## 概述"、"## 核心数据"、"## 详细说明"三级结构组织
   - 使用表格呈现对比数据和列表信息
   - 删除广告、推广链接、评论等非信息内容
   - 保持客观中性，不添加主观评价
   - 末尾使用 > 格式标注原始来源
3. 直接输出整理后的 Markdown，第一行是以 # 开头的标题
4. 控制在一屏内可读完（500-1500字）

请开始整理：`;

    const articlePrompt = `你是一个专业的内容主编。请对以下文章进行深度润色优化。

## 原始标题
${title || '（无标题）'}

## 原始内容
${content.slice(0, 8000)}

## 润色要求
1. **标题**：提炼一个吸引人但不标题党的标题（20字以内），可加入数字或对比增强吸引力
2. **内容**：
   - 保留所有关键信息、数据和观点
   - 改善段落结构和阅读节奏，长短句交替
   - 修正错别字和语法问题
   - 使用 ##、### 标题层级组织，插入恰当的过渡句
   - 增强可读性，让家长和学生都能轻松理解
   - 末尾添加总结或行动建议
   - 使用 > 格式引用关键数据来源
3. 直接输出润色后的 Markdown，第一行是以 # 开头的标题
4. 篇幅不限，以讲清楚为准

请开始润色：`;

    const prompt = isKnowledge ? knowledgePrompt : articlePrompt;

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个专业的内容编辑，擅长润色和整理文章内容。你的输出干净、结构清晰、没有废话。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      logger.error('DeepSeek 润色请求失败: %s %s', response.status, errText);
      ctx.status = 502;
      ctx.body = { success: false, message: `AI 润色服务暂时不可用 (${response.status})` };
      return;
    }

    const data = await response.json() as any;
    const polished = data.choices?.[0]?.message?.content || '';

    if (!polished.trim()) {
      ctx.status = 500;
      ctx.body = { success: false, message: 'AI 润色返回为空，请重试' };
      return;
    }

    // 解析润色结果：第一行 # 开头的是标题，其余是内容
    const lines = polished.trim().split('\n');
    let polishedTitle = title;
    let polishedContent = polished;

    const titleMatch = polished.match(/^#\s+(.+)/);
    if (titleMatch) {
      polishedTitle = titleMatch[1].trim();
      polishedContent = polished.replace(/^#\s+.+\n?/, '').trim();
    }

    logger.info('AI 润色完成: "%s" → "%s" (%d 字符 → %d 字符)',
      title.slice(0, 30), polishedTitle.slice(0, 30), content.length, polishedContent.length);

    ctx.body = {
      success: true,
      data: {
        title: polishedTitle,
        content: polishedContent,
        originalLength: content.length,
        polishedLength: polishedContent.length,
      },
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      ctx.status = 504;
      ctx.body = { success: false, message: 'AI 润色超时，请重试' };
      return;
    }
    logger.error('AI 润色失败: %s', err.message || String(err));
    ctx.status = 500;
    ctx.body = { success: false, message: `AI 润色失败: ${err.message || '未知错误'}` };
  }
}

// ─── 辅助函数 ──────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: BROWSER_HEADERS,
      redirect: 'follow',
    });

    if (!response.ok) {
      logger.warn('网页请求失败: %s → %d', url, response.status);
      return null;
    }

    return await response.text();
  } catch (err: any) {
    logger.warn('网页请求异常: %s → %s', url, err.message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchDuckDuckGo(keyword: string): Promise<Array<{ title: string; snippet: string; url: string; displayUrl: string }>> {
  const query = encodeURIComponent(keyword);
  const searchUrl = `https://html.duckduckgo.com/html/?q=${query}&kl=cn-zh`;

  const html = await fetchHtml(searchUrl);
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: Array<{ title: string; snippet: string; url: string; displayUrl: string }> = [];

  $('.result').each((_, el) => {
    if (results.length >= SEARCH_RESULT_LIMIT) return false;

    const $el = $(el);
    const $title = $el.find('.result__title a, .result__a');
    const $snippet = $el.find('.result__snippet');
    const $url = $el.find('.result__url');

    const title = $title.text().trim();
    const snippet = $snippet.text().trim();
    const rawHref = $title.attr('href') || '';

    // DuckDuckGo 重定向链接 → 真实 URL
    let url: string | null = null;
    const uddgMatch = rawHref.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      try { url = decodeURIComponent(uddgMatch[1]); } catch { /* ignore */ }
    }
    if (!url && rawHref.startsWith('http')) url = rawHref;
    if (!url || !url.startsWith('http')) return;

    const displayUrl = $url.text().trim() || new URL(url).hostname;

    results.push({ title, snippet, url, displayUrl });
  });

  return results;
}

async function searchBing(keyword: string): Promise<Array<{ title: string; snippet: string; url: string; displayUrl: string }>> {
  const query = encodeURIComponent(keyword);
  const searchUrl = `https://www.bing.com/search?q=${query}&setlang=zh-cn&count=20`;

  const html = await fetchHtml(searchUrl);
  if (!html) return [];

  const $ = cheerio.load(html);
  const results: Array<{ title: string; snippet: string; url: string; displayUrl: string }> = [];

  $('.b_algo').each((_, el) => {
    if (results.length >= 15) return false;
    const $el = $(el);
    const $a = $el.find('h2 a');
    const title = $a.text().trim();
    const snippet = $el.find('.b_caption p').text().trim()
                || $el.find('.b_lineclamp2').text().trim()
                || $el.find('.b_caption').text().trim().slice(0, 200);
    const url = $a.attr('href') || '';
    if (title && url && url.startsWith('http')) {
      results.push({ title, snippet, url, displayUrl: new URL(url).hostname });
    }
  });

  return results;
}

function guessCategory(text: string): string {
  const patterns: [string, string[]][] = [
    ['gaokao', ['高考', '志愿', '分数线', '录取', '批次', '985', '211', '双一流', '提前批', '平行志愿', '本科', '招生简章']],
    ['kaoyan', ['考研', '硕士', '博士', '研究生', '复试', '调剂', '学硕', '专硕', '导师', '推免']],
    ['zhiye', ['职业', '就业', '工作', '薪资', '行业', '职场', '公务员', '考公', '考编', '面试']],
    ['bimian', ['避坑', '天坑', '劝退', '坑', '不推荐', '建议别', '千万别', '后悔']],
  ];

  const lower = text.toLowerCase();
  for (const [cat, keywords] of patterns) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'gaokao';
}

function extractTags(text: string, metaKeywords?: string): string[] {
  const tags = new Set<string>();

  if (metaKeywords) {
    metaKeywords.split(/[,，;；]/).forEach(t => {
      const trimmed = t.trim();
      if (trimmed && trimmed.length <= 20) tags.add(trimmed);
    });
  }

  const keywordList = [
    '北京大学', '清华大学', '复旦大学', '浙江大学', '上海交大', '南京大学',
    '高考志愿', '考研', '分数线', '招生', '985', '211', '双一流',
    '计算机', '金融', '医学', '法学', '人工智能', '大数据',
  ];

  for (const kw of keywordList) {
    if (text.includes(kw)) tags.add(kw);
  }

  return Array.from(tags).slice(0, 10);
}
