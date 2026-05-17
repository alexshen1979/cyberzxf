import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { sanitizeAiOutput } from './ai.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('volunteer-export');
const REPORT_OUTPUT_DIR = path.resolve(process.cwd(), 'uploads', 'reports');
const SCREENSHOT_WIDTH = 1125;
const SCREENSHOT_HEIGHT = 1600;

export type VolunteerReportExportType = 'pdf' | 'image';

interface ExportedReportFile {
  filePath: string;
  filename: string;
  contentType: string;
}

export async function exportVolunteerReport(
  userId: string,
  reportId: string,
  type: VolunteerReportExportType,
): Promise<ExportedReportFile> {
  const report = await prisma.volunteerReport.findFirst({ where: { id: reportId, userId } });
  if (!report) {
    throw new AppError(404, '志愿分析报告不存在', 'VOLUNTEER_REPORT_NOT_FOUND');
  }

  const extension = type === 'pdf' ? 'pdf' : 'png';
  const filename = `涨识志愿分析报告-${safeFilename(report.province)}-${report.score}分.${extension}`;
  const filePath = path.join(REPORT_OUTPUT_DIR, safeFilename(userId), `${safeFilename(report.id)}.${extension}`);

  if (!fs.existsSync(filePath)) {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await renderVolunteerReport(report, type, filePath);
  }

  return {
    filePath,
    filename,
    contentType: type === 'pdf' ? 'application/pdf' : 'image/png',
  };
}

async function renderVolunteerReport(report: any, type: VolunteerReportExportType, filePath: string) {
  const html = buildReportHtml(report);
  let browser: any;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: resolveBrowserExecutablePath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: SCREENSHOT_WIDTH,
      height: SCREENSHOT_HEIGHT,
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 45000 });

    if (type === 'pdf') {
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      });
      return;
    }

    const pageHeight = await page.evaluate(() => {
      const doc = (globalThis as any).document;
      const body = doc.body;
      const htmlEl = doc.documentElement;
      return Math.max(
        body.scrollHeight,
        body.offsetHeight,
        htmlEl.clientHeight,
        htmlEl.scrollHeight,
        htmlEl.offsetHeight,
      );
    });
    await page.setViewport({
      width: SCREENSHOT_WIDTH,
      height: Math.min(Math.max(pageHeight, SCREENSHOT_HEIGHT), 24000),
      deviceScaleFactor: 1,
    });
    await page.screenshot({ path: filePath, type: 'png', fullPage: true });
  } catch (err) {
    logger.error({ err, reportId: report.id, type }, 'volunteer report export failed');
    await fs.promises.rm(filePath, { force: true }).catch(() => undefined);
    throw new AppError(503, '报告生成服务暂不可用，请稍后再试', 'VOLUNTEER_REPORT_EXPORT_UNAVAILABLE');
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

function buildReportHtml(report: any) {
  const input = safeJson(report.input, {});
  const result = safeJson(report.result, {});
  const markdown = sanitizeAiOutput(report.markdownReport || '');
  const generatedAt = formatDate(report.createdAt);
  const metrics = [
    ['考生省份', input.province || report.province],
    ['科类/选科', input.subjectType || report.subjectType],
    ['高考分数', `${input.score || report.score} 分`],
    ['参考位次', input.rank || report.rank ? `${input.rank || report.rank}` : '未填写'],
    ['分析年份', `${input.year || report.year} 年`],
    ['风险偏好', riskPreferenceLabel(input.riskPreference)],
  ];
  const recommendationCards = buildRecommendationCards(result.recommendations || {});
  const preferenceItems = [
    ['目标城市/省份', joinList(input.preferredCities)],
    ['偏好专业', joinList(input.preferredMajors)],
    ['规避专业', joinList(input.avoidMajors)],
    ['家庭期待', input.familyExpectation || '未填写'],
  ];

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>涨识志愿分析报告</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #192126;
      background: #f5f7f4;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
      letter-spacing: 0;
    }
    .page {
      width: 1125px;
      min-height: 100vh;
      padding: 56px 64px 72px;
      background:
        linear-gradient(180deg, rgba(241, 247, 238, 0.92) 0%, rgba(250, 250, 246, 0.98) 48%, #f6f8f4 100%),
        radial-gradient(circle at 92% 5%, rgba(225, 129, 78, 0.14), transparent 32%),
        radial-gradient(circle at 10% 0%, rgba(64, 137, 119, 0.18), transparent 30%);
    }
    .cover {
      position: relative;
      overflow: hidden;
      min-height: 440px;
      padding: 54px 58px 46px;
      border-radius: 34px;
      color: #fff;
      background: linear-gradient(132deg, #435238 0%, #476f63 55%, #ba6f48 100%);
      box-shadow: 0 26px 70px rgba(50, 71, 54, 0.22);
    }
    .cover::after {
      content: "";
      position: absolute;
      right: -90px;
      bottom: -160px;
      width: 440px;
      height: 440px;
      border: 2px solid rgba(255,255,255,0.18);
      border-radius: 50%;
    }
    .brand { position: relative; z-index: 1; font-size: 26px; font-weight: 800; opacity: 0.92; }
    .title { position: relative; z-index: 1; max-width: 760px; margin: 54px 0 18px; font-size: 64px; line-height: 1.08; font-weight: 900; }
    .subtitle { position: relative; z-index: 1; max-width: 840px; font-size: 28px; line-height: 1.55; opacity: 0.9; }
    .cover-meta { position: relative; z-index: 1; display: flex; gap: 18px; flex-wrap: wrap; margin-top: 46px; }
    .cover-pill { padding: 13px 22px; border-radius: 999px; background: rgba(255,255,255,0.16); font-size: 22px; font-weight: 750; }
    .section { margin-top: 34px; padding: 34px; border: 1px solid rgba(39, 55, 46, 0.08); border-radius: 26px; background: rgba(255,255,255,0.9); box-shadow: 0 16px 44px rgba(40, 55, 46, 0.06); break-inside: avoid; }
    .section-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
    .section-title { margin: 0; font-size: 34px; line-height: 1.25; font-weight: 900; color: #1f2a24; }
    .section-kicker { color: #698052; font-size: 20px; font-weight: 900; }
    .summary { color: #415047; font-size: 27px; line-height: 1.72; font-weight: 650; }
    .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .metric { min-height: 112px; padding: 22px 24px; border-radius: 20px; background: #f7f9f5; border: 1px solid rgba(39, 55, 46, 0.06); }
    .metric-label { display: block; color: #778277; font-size: 19px; margin-bottom: 12px; }
    .metric-value { display: block; color: #1f2a24; font-size: 28px; line-height: 1.22; font-weight: 900; word-break: break-word; }
    .band-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    .band { padding: 24px; min-height: 230px; border-radius: 24px; border: 1px solid transparent; }
    .band.rush { background: #fff7f5; border-color: rgba(197, 90, 62, 0.18); }
    .band.stable { background: #fffaf0; border-color: rgba(198, 144, 52, 0.18); }
    .band.safe { background: #f3fbf6; border-color: rgba(73, 132, 84, 0.18); }
    .band-name { display: flex; justify-content: space-between; align-items: center; color: #1f2a24; font-size: 30px; font-weight: 900; margin-bottom: 16px; }
    .band-count { color: #74806f; font-size: 18px; font-weight: 800; }
    .school-list { display: grid; gap: 10px; }
    .school-item { padding: 12px 14px; border-radius: 16px; background: rgba(255,255,255,0.72); color: #334138; font-size: 22px; line-height: 1.35; font-weight: 750; }
    .school-meta { display: block; margin-top: 4px; color: #7a857a; font-size: 17px; font-weight: 650; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .info-row { padding: 18px 0; border-bottom: 1px solid rgba(39, 55, 46, 0.08); }
    .info-row:last-child { border-bottom: 0; }
    .info-label { display: block; margin-bottom: 8px; color: #72806f; font-size: 19px; font-weight: 800; }
    .info-value { color: #29352e; font-size: 24px; line-height: 1.55; font-weight: 700; white-space: pre-wrap; }
    .advice-list { display: grid; gap: 14px; }
    .advice { position: relative; padding-left: 28px; color: #34433a; font-size: 24px; line-height: 1.65; }
    .advice::before { content: ""; position: absolute; left: 0; top: 17px; width: 10px; height: 10px; border-radius: 50%; background: #b9784d; }
    .markdown { color: #34433a; font-size: 24px; line-height: 1.78; }
    .markdown h2 { margin: 30px 0 12px; color: #1f2a24; font-size: 30px; line-height: 1.35; }
    .markdown h2:first-child { margin-top: 0; }
    .markdown h3 { margin: 24px 0 10px; color: #31423a; font-size: 26px; }
    .markdown p { margin: 0 0 14px; }
    .markdown ul { margin: 8px 0 18px; padding-left: 28px; }
    .markdown li { margin: 8px 0; }
    .footer { margin-top: 34px; padding: 28px 10px 0; color: #738173; font-size: 20px; line-height: 1.6; text-align: center; }
    @page { size: A4; margin: 0; }
    @media print {
      .page { width: 210mm; padding: 12mm; }
      .cover { min-height: 86mm; padding: 12mm; border-radius: 8mm; }
      .title { font-size: 13mm; }
      .subtitle { font-size: 5.2mm; }
      .section { margin-top: 8mm; padding: 8mm; border-radius: 6mm; box-shadow: none; }
      .metric-grid, .band-grid, .two-col { gap: 4mm; }
      .section-title { font-size: 7mm; }
      .summary, .metric-value { font-size: 5.4mm; }
      .school-item, .info-value, .advice, .markdown { font-size: 4.7mm; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="cover">
      <div class="brand">涨识 · 赛博张老师</div>
      <h1 class="title">${escapeHtml(report.province)} ${escapeHtml(report.subjectType)} ${escapeHtml(String(report.score))}分志愿分析报告</h1>
      <div class="subtitle">${escapeHtml(result.summary || '基于你的分数、位次、偏好与风险设定，整理出一份可执行的志愿填报参考。')}</div>
      <div class="cover-meta">
        <span class="cover-pill">生成时间 ${escapeHtml(generatedAt)}</span>
        <span class="cover-pill">定位原则 位次优先</span>
        <span class="cover-pill">建议结构 冲稳保</span>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">考生画像</h2>
        <div class="section-kicker">PROFILE</div>
      </div>
      <div class="metric-grid">${metrics.map(([label, value]) => metricHtml(label, value)).join('')}</div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">核心结论</h2>
        <div class="section-kicker">SUMMARY</div>
      </div>
      <div class="summary">${escapeHtml(result.summary || '暂无核心结论。')}</div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">冲稳保方案</h2>
        <div class="section-kicker">PLAN</div>
      </div>
      <div class="band-grid">${recommendationCards.join('')}</div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">偏好与风险设定</h2>
        <div class="section-kicker">PREFERENCE</div>
      </div>
      <div class="two-col">${preferenceItems.map(([label, value]) => infoRowHtml(label, value)).join('')}</div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">专业与城市建议</h2>
        <div class="section-kicker">ADVICE</div>
      </div>
      <div class="two-col">
        <div class="advice-list">${listHtml(result.majorAdvice, '暂无专业建议。')}</div>
        <div class="advice-list">${listHtml(result.cityAdvice, '暂无城市建议。')}</div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">风险提示</h2>
        <div class="section-kicker">RISK</div>
      </div>
      <div class="advice-list">${listHtml(result.risks, '暂无额外风险提示。')}</div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">完整分析</h2>
        <div class="section-kicker">DETAIL</div>
      </div>
      <div class="markdown">${markdownToHtml(markdown || buildFallbackMarkdown(result))}</div>
    </section>

    <div class="footer">本报告由涨识生成。建议结合招生章程、官方招生计划和家庭实际情况继续核验。</div>
  </main>
</body>
</html>`;
}

function buildRecommendationCards(recommendations: Record<string, any[]>) {
  const configs = [
    ['rush', '冲刺', '适合冲击更高层次院校'],
    ['stable', '稳妥', '录取概率和专业选择更均衡'],
    ['safe', '保底', '用于守住可接受底线'],
  ];
  return configs.map(([key, label, desc]) => {
    const schools = uniqueSchools(recommendations[key] || []).slice(0, 5);
    return `<div class="band ${key}">
      <div class="band-name"><span>${label}</span><span class="band-count">${schools.length || 0} 所重点展示</span></div>
      <div class="school-list">
        ${schools.length ? schools.map(item => `<div class="school-item">${escapeHtml(item.name)}<span class="school-meta">${escapeHtml(item.meta || desc)}</span></div>`).join('') : `<div class="school-item">${escapeHtml(desc)}</div>`}
      </div>
    </div>`;
  });
}

function uniqueSchools(items: any[]) {
  const seen = new Set<string>();
  const result: Array<{ name: string; meta: string }> = [];
  for (const item of items) {
    const name = String(item?.universityName || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push({
      name,
      meta: [item.city || item.province, item.type, item.level, item.minScore ? `最低${item.minScore}分` : '', item.minRank ? `位次${item.minRank}` : '']
        .filter(Boolean)
        .join(' · '),
    });
  }
  return result;
}

function metricHtml(label: string, value: unknown) {
  return `<div class="metric"><span class="metric-label">${escapeHtml(label)}</span><span class="metric-value">${escapeHtml(String(value || '未填写'))}</span></div>`;
}

function infoRowHtml(label: string, value: unknown) {
  return `<div class="info-row"><span class="info-label">${escapeHtml(label)}</span><div class="info-value">${escapeHtml(String(value || '未填写'))}</div></div>`;
}

function listHtml(items: string[] | undefined, fallback: string) {
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!values.length) return `<div class="advice">${escapeHtml(fallback)}</div>`;
  return values.map(item => `<div class="advice">${escapeHtml(item)}</div>`).join('');
}

function markdownToHtml(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length <= 2 ? 'h2' : 'h3';
      html.push(`<${level}>${escapeHtml(heading[2])}</${level}>`);
      continue;
    }
    const listItem = line.match(/^[-*]\s+(.+)$/);
    if (listItem) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${escapeHtml(listItem[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${escapeHtml(line)}</p>`);
  }
  closeList();
  return html.join('');
}

function buildFallbackMarkdown(result: any) {
  return [
    `## 先看结论\n${result.summary || '暂无核心结论。'}`,
    `## 定位策略\n${result.strategy || result.scorePosition || '以位次为主，结合目标城市、专业偏好和风险偏好做交叉筛选。'}`,
  ].join('\n\n');
}

function safeJson(value: string | null | undefined, fallback: any) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function joinList(value: unknown) {
  if (!Array.isArray(value) || !value.length) return '未填写';
  return value.filter(Boolean).join('、') || '未填写';
}

function riskPreferenceLabel(value: string) {
  if (value === 'conservative') return '稳健保守';
  if (value === 'aggressive') return '积极冲刺';
  return '均衡配置';
}

function formatDate(value: Date | string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeFilename(value: string) {
  return String(value || 'report').replace(/[^\w\u4e00-\u9fa5.-]+/g, '_').slice(0, 80);
}

function resolveBrowserExecutablePath() {
  const candidates = [
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  ].filter(Boolean) as string[];

  return candidates.find(candidate => fs.existsSync(candidate));
}
