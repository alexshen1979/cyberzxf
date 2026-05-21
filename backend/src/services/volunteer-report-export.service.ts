import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { sanitizeAiOutput } from './ai.service';
import { createLogger } from '../utils/logger';
import { getPointSettings } from './point-config.service';
import { deductPoints } from './points.service';
import { previewVolunteer, VolunteerAnalyzeInput } from './volunteer-analysis.service';

const logger = createLogger('volunteer-export');
const REPORT_OUTPUT_DIR = path.resolve(process.cwd(), 'uploads', 'reports');
const BRAND_LOGO_PATHS = [
  path.resolve(process.cwd(), 'src', 'assets', 'brand-logo.png'),
  path.resolve(process.cwd(), '..', 'miniprogram', 'src', 'static', 'images', 'brand-logo.png'),
  path.resolve(__dirname, '..', 'assets', 'brand-logo.png'),
  path.resolve(__dirname, '..', '..', 'miniprogram', 'src', 'static', 'images', 'brand-logo.png'),
];
const SCREENSHOT_WIDTH = 1125;
const SCREENSHOT_HEIGHT = 1600;
const EXPORT_TEMPLATE_VERSION = 'v5';
const EXPORT_PREVIEW_RECOMMENDATION_LIMIT = 120;
const EXPORT_RECOMMENDATION_LIMITS = {
  rush: 15,
  stable: 25,
  safe: 20,
} as const;
const EXPORT_RECOMMENDATION_TOTAL = Object.values(EXPORT_RECOMMENDATION_LIMITS).reduce((sum, count) => sum + count, 0);

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
  const report = await prisma.volunteerReport.findFirst({
    where: { id: reportId, userId },
    include: { user: { select: { nickname: true, phone: true } } },
  });
  if (!report) {
    throw new AppError(404, '志愿分析报告不存在', 'VOLUNTEER_REPORT_NOT_FOUND');
  }

  const extension = type === 'pdf' ? 'pdf' : 'png';
  const filename = buildExportFilename(report, userId, extension);
  const filePath = path.join(REPORT_OUTPUT_DIR, safeFilename(userId), `${safeFilename(report.id)}-${EXPORT_TEMPLATE_VERSION}.${extension}`);
  const pointsCost = await getExportPointsCost(type);
  const sourceId = `${report.id}:${type}`;
  const alreadyPaid = await hasPaidExport(userId, sourceId);

  if (pointsCost > 0 && !alreadyPaid) {
    await deductPoints(userId, pointsCost, {
      source: 'volunteer_report_export',
      sourceId,
      remark: `${type === 'pdf' ? 'PDF报告导出' : '长图报告导出'} - ${report.province}${report.score}分`,
    });
  }

  if (!fs.existsSync(filePath)) {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    try {
      await renderVolunteerReport(report, type, filePath);
    } catch (err) {
      if (pointsCost > 0 && !alreadyPaid) {
        await refundExportPoints(userId, pointsCost, sourceId, type).catch(refundErr => {
          logger.error({ refundErr, userId, reportId, type }, 'volunteer report export refund failed');
        });
      }
      throw err;
    }
  }

  return {
    filePath,
    filename,
    contentType: type === 'pdf' ? 'application/pdf' : 'image/png',
  };
}

export async function getVolunteerReportExportCosts() {
  const settings = await getPointSettings();
  return {
    pdf: settings.volunteerReportPdfCost,
    image: settings.volunteerReportImageCost,
  };
}

async function getExportPointsCost(type: VolunteerReportExportType) {
  const costs = await getVolunteerReportExportCosts();
  return type === 'pdf' ? costs.pdf : costs.image;
}

async function hasPaidExport(userId: string, sourceId: string) {
  const aggregate = await prisma.pointsTransaction.aggregate({
    where: {
      userId,
      source: 'volunteer_report_export',
      sourceId,
    },
    _sum: { amount: true },
  });
  return (aggregate._sum.amount || 0) < 0;
}

async function refundExportPoints(userId: string, amount: number, sourceId: string, type: VolunteerReportExportType) {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.pointsAccount.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });
    await tx.pointsTransaction.create({
      data: {
        userId,
        type: 'refund',
        amount,
        balanceAfter: updated.balance,
        source: 'volunteer_report_export',
        sourceId,
        remark: `${type === 'pdf' ? 'PDF报告导出' : '长图报告导出'}失败，退还点数`,
      },
    });
  });
}

async function renderVolunteerReport(report: any, type: VolunteerReportExportType, filePath: string) {
  const html = await buildReportHtml(report, type);
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
        '--lang=zh-CN',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: SCREENSHOT_WIDTH,
      height: SCREENSHOT_HEIGHT,
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 45000 });

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
    await page.evaluate((height: number) => {
      const doc = (globalThis as any).document;
      const layer = doc.querySelector('.watermark-layer') as any;
      if (layer) layer.style.height = `${height}px`;
      const printLayer = doc.querySelector('.watermark-print') as any;
      if (printLayer) printLayer.style.height = `${height}px`;
    }, pageHeight);

    if (type === 'pdf') {
      await page.pdf({
        path: filePath,
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      });
      return;
    }

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

async function buildReportHtml(report: any, type: VolunteerReportExportType) {
  const input = safeJson(report.input, {});
  const result = await buildExportResult(input, safeJson(report.result, {}), type);
  const markdown = sanitizeAiOutput(report.markdownReport || '');
  const generatedAt = formatDate(report.createdAt);
  const watermarkLogo = getWatermarkLogoDataUrl();
  const watermarkLogoCss = watermarkLogo ? `background-image: url("${watermarkLogo}");` : '';
  const metrics = [
    ['考生省份', input.province || report.province],
    ['科类/选科', input.subjectType || report.subjectType],
    ['高考分数', `${input.score || report.score} 分`],
    ['参考位次', input.rank || report.rank ? `${input.rank || report.rank}` : '未填写'],
    ['风险偏好', riskPreferenceLabel(input.riskPreference)],
  ];
  const summaryPoints = buildSummaryPoints(input, result);
  const recommendationSections = buildRecommendationSections(result.recommendations || {}, result.recommendationStats || {});
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
      font-family: "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", "WenQuanYi Zen Hei", "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
      letter-spacing: 0;
    }
    .page {
      position: relative;
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
      min-height: 390px;
      padding: 48px 56px 42px;
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
    .title { position: relative; z-index: 1; max-width: 760px; margin: 42px 0 18px; font-size: 62px; line-height: 1.08; font-weight: 900; }
    .subtitle { position: relative; z-index: 1; max-width: 840px; font-size: 28px; line-height: 1.55; opacity: 0.9; }
    .cover-meta { position: relative; z-index: 1; display: flex; gap: 18px; flex-wrap: wrap; margin-top: 34px; }
    .cover-pill { padding: 13px 22px; border-radius: 999px; background: rgba(255,255,255,0.16); font-size: 22px; font-weight: 750; }
    .section { margin-top: 34px; padding: 34px; border: 1px solid rgba(39, 55, 46, 0.08); border-radius: 26px; background: rgba(255,255,255,0.9); box-shadow: 0 16px 44px rgba(40, 55, 46, 0.06); break-inside: avoid; }
    .profile-section { margin-top: 26px; }
    .summary-section { break-before: page; page-break-before: always; }
    .plan-section { break-before: page; page-break-before: always; break-inside: auto; page-break-inside: auto; }
    .plan-section .section-header { break-after: avoid; page-break-after: avoid; }
    .plan-section .plan-stack { break-before: avoid; page-break-before: avoid; }
    .section-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
    .section-title { margin: 0; font-size: 34px; line-height: 1.25; font-weight: 900; color: #1f2a24; }
    .section-kicker { color: #698052; font-size: 20px; font-weight: 900; }
    .summary-list { display: grid; gap: 16px; }
    .summary-point { position: relative; padding: 20px 22px 20px 56px; border-radius: 18px; background: #f7f9f5; border: 1px solid rgba(39, 55, 46, 0.07); color: #31423a; font-size: 25px; line-height: 1.58; font-weight: 720; }
    .summary-point::before { content: ""; position: absolute; left: 24px; top: 31px; width: 13px; height: 13px; border-radius: 50%; background: #ba6f48; box-shadow: 0 0 0 7px rgba(186, 111, 72, 0.12); }
    .metric-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; }
    .metric { min-height: 112px; padding: 22px 24px; border-radius: 20px; background: #f7f9f5; border: 1px solid rgba(39, 55, 46, 0.06); }
    .metric-label { display: block; color: #778277; font-size: 19px; margin-bottom: 12px; }
    .metric-value { display: block; color: #1f2a24; font-size: 28px; line-height: 1.22; font-weight: 900; word-break: break-word; }
    .plan-stack { display: grid; gap: 22px; }
    .band { padding: 24px; border-radius: 24px; border: 1px solid transparent; break-inside: auto; }
    .band.rush { background: #fff7f5; border-color: rgba(197, 90, 62, 0.20); }
    .band.stable { background: #fffaf0; border-color: rgba(198, 144, 52, 0.22); }
    .band.safe { background: #f3fbf6; border-color: rgba(73, 132, 84, 0.20); }
    .band-name { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px 18px; color: #1f2a24; font-size: 31px; font-weight: 900; margin-bottom: 18px; }
    .band-count { color: #74806f; font-size: 18px; font-weight: 800; }
    .school-list { display: grid; gap: 14px; }
    .school-item { padding: 18px 20px; border-radius: 18px; background: rgba(255,255,255,0.78); border: 1px solid rgba(39,55,46,0.06); break-inside: avoid; }
    .school-top { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 8px 22px; margin-bottom: 8px; }
    .school-name { flex: 1 1 420px; min-width: 0; color: #1f2a24; font-size: 26px; line-height: 1.3; font-weight: 900; overflow-wrap: anywhere; word-break: break-word; }
    .school-meta { flex: 1 1 260px; min-width: 0; color: #7a857a; font-size: 18px; line-height: 1.35; font-weight: 700; text-align: right; overflow-wrap: anywhere; word-break: break-word; }
    .tag-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
    .tag { padding: 5px 10px; border-radius: 999px; background: #eef4ed; color: #58705f; font-size: 16px; font-weight: 800; white-space: nowrap; }
    .tag.risk { background: #fff1f2; color: #b4535f; }
    .option-list { display: grid; gap: 8px; margin-top: 10px; }
    .option-line { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 5px 14px; padding: 11px 14px; border-radius: 12px; background: rgba(247,249,245,0.9); color: #34433a; font-size: 18px; line-height: 1.4; }
    .option-title { flex: 1 1 430px; min-width: 0; font-weight: 850; overflow-wrap: anywhere; word-break: break-word; }
    .option-meta { flex: 1 1 260px; min-width: 0; color: #687667; font-weight: 760; text-align: right; overflow-wrap: anywhere; word-break: break-word; }
    .reason { margin-top: 10px; color: #59675f; font-size: 18px; line-height: 1.55; }
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
    .watermark-layer { position: absolute; left: 0; top: 0; width: 100%; z-index: 10; pointer-events: none; display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: 260px; align-content: start; overflow: hidden; opacity: 0.085; }
    .watermark-print { display: none; }
    .watermark-item { display: flex; align-items: center; justify-content: center; transform: rotate(-24deg); }
    .watermark-stamp { display: flex; flex-direction: column; align-items: center; gap: 10px; color: #435238; font-weight: 900; }
    .watermark-logo { width: 132px; height: 132px; background-position: center; background-repeat: no-repeat; background-size: contain; ${watermarkLogoCss} }
    .watermark-text { font-size: 28px; line-height: 1; letter-spacing: 0; }
    .page > *:not(.watermark-layer) { position: relative; z-index: 1; }
    @page { size: A4; margin: 0; }
    @media print {
      .page { width: 210mm; padding: 12mm; }
      .cover { min-height: 72mm; padding: 10mm; border-radius: 8mm; }
      .title { font-size: 13mm; }
      .subtitle { font-size: 5.2mm; }
      .section { margin-top: 8mm; padding: 8mm; border-radius: 6mm; box-shadow: none; }
      .profile-section { margin-top: 6mm; padding: 6mm; }
      .summary-section { break-before: page; page-break-before: always; }
      .plan-section { break-before: page; page-break-before: always; break-inside: auto; page-break-inside: auto; }
      .metric-grid { grid-template-columns: repeat(3, 1fr); }
      .metric-grid, .plan-stack, .two-col { gap: 4mm; }
      .section-title { font-size: 7mm; }
      .summary-point, .metric-value { font-size: 5.1mm; }
      .school-item, .info-value, .advice, .markdown { font-size: 4.7mm; }
      .school-name { font-size: 5.2mm; }
      .school-meta, .option-meta { text-align: left; }
      .option-line, .reason { font-size: 3.9mm; }
      .watermark-layer { display: none; }
      .watermark-print { position: fixed; inset: 0; z-index: 10; pointer-events: none; display: grid; grid-template-columns: repeat(2, 1fr); grid-auto-rows: 58mm; align-content: start; overflow: hidden; opacity: 0.078; }
      .watermark-logo { width: 30mm; height: 30mm; }
      .watermark-text { font-size: 6mm; }
    }
  </style>
</head>
<body>
  <main class="page">
    ${watermarkHtml()}
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

    <section class="section profile-section">
      <div class="section-header">
        <h2 class="section-title">考生画像</h2>
        <div class="section-kicker">PROFILE</div>
      </div>
      <div class="metric-grid">${metrics.map(([label, value]) => metricHtml(label, value)).join('')}</div>
    </section>

    <section class="section summary-section">
      <div class="section-header">
        <h2 class="section-title">核心结论</h2>
        <div class="section-kicker">SUMMARY</div>
      </div>
      <div class="summary-list">${summaryPoints.map(point => `<div class="summary-point">${escapeHtml(point)}</div>`).join('')}</div>
    </section>

    <section class="section plan-section">
      <div class="section-header">
        <h2 class="section-title">冲稳保方案</h2>
        <div class="section-kicker">PLAN</div>
      </div>
      <div class="plan-stack">${recommendationSections.join('')}</div>
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

async function buildExportResult(input: any, storedResult: any, type: VolunteerReportExportType) {
  const normalizedInput = buildExportInput(input);
  if (!normalizedInput) return storedResult || {};

  try {
    return await previewVolunteer(Object.assign({}, normalizedInput, {
      recommendationLimit: EXPORT_PREVIEW_RECOMMENDATION_LIMIT,
    }));
  } catch (err) {
    logger.warn({ err, province: input?.province, score: input?.score }, 'volunteer export preview refresh failed');
    return storedResult || {};
  }
}

function buildExportInput(input: any): VolunteerAnalyzeInput | null {
  const province = String(input?.province || '').trim();
  const subjectType = String(input?.subjectType || '').trim();
  const score = Number(input?.score);
  if (!province || !subjectType || !Number.isFinite(score)) return null;

  return {
    province,
    subjectType,
    score,
    year: Number(input?.year) || undefined,
    rank: input?.rank ? Number(input.rank) : undefined,
    targetBatch: input?.targetBatch,
    preferredCities: Array.isArray(input?.preferredCities) ? input.preferredCities : [],
    preferredMajors: Array.isArray(input?.preferredMajors) ? input.preferredMajors : [],
    avoidMajors: Array.isArray(input?.avoidMajors) ? input.avoidMajors : [],
    familyExpectation: input?.familyExpectation,
    riskPreference: input?.riskPreference,
  };
}

function buildSummaryPoints(input: any, result: any) {
  const stats = result.recommendationStats || {};
  const totalShown = ['rush', 'stable', 'safe']
    .reduce((sum, key) => sum + ((result.recommendations?.[key] || []) as any[]).length, 0);
  const totalCandidates = ['rush', 'stable', 'safe']
    .reduce((sum, key) => sum + Number(stats[key] || 0), 0);
  const preferenceParts = [
    joinList(input.preferredCities) !== '未填写' ? `目标城市/省份：${joinList(input.preferredCities)}` : '',
    joinList(input.preferredMajors) !== '未填写' ? `偏好专业：${joinList(input.preferredMajors)}` : '',
    joinList(input.avoidMajors) !== '未填写' ? `规避专业：${joinList(input.avoidMajors)}` : '',
  ].filter(Boolean);

  return [
    result.summary || `${input.province || ''}${input.subjectType || ''}${input.score || ''}分，建议按位次优先做冲稳保配置。`,
    result.scorePosition || (input.rank ? `以 ${input.rank} 位次作为核心参照，不直接用分数跨年份硬比。` : '未填写位次，建议先补齐一分一段位次再做最终排序。'),
    `候选池共识别 ${totalCandidates || totalShown} 所院校，本报告提炼 ${EXPORT_RECOMMENDATION_TOTAL} 个重点推荐：冲刺${EXPORT_RECOMMENDATION_LIMITS.rush}个、稳妥${EXPORT_RECOMMENDATION_LIMITS.stable}个、保底${EXPORT_RECOMMENDATION_LIMITS.safe}个。如果想要查看更多，请到涨识小程序上查看。`,
    preferenceParts.length ? `已按${preferenceParts.join('；')}重排候选；明确命中规避方向的专业线会优先剔除，专业组线仍需核对组内专业。` : '当前没有填写城市或专业偏好，排序主要依据位次/分差和风险偏好。',
    `建议执行顺序：先锁定稳妥档主体，再用冲刺档拉上限，用保底档守住可接受底线。`,
  ].filter(Boolean);
}

function buildRecommendationSections(recommendations: Record<string, any[]>, stats: Record<string, any>) {
  const configs = [
    { key: 'rush', label: '冲刺', desc: '适合冲击更高层次院校，注意专业组和调剂风险。' },
    { key: 'stable', label: '稳妥', desc: '录取概率和专业选择更均衡，是方案主体。' },
    { key: 'safe', label: '保底', desc: '用于守住可接受底线，优先确认专业接受度。' },
  ];
  return configs.map(({ key, label, desc }) => {
    const limit = EXPORT_RECOMMENDATION_LIMITS[key as keyof typeof EXPORT_RECOMMENDATION_LIMITS];
    const allSchools = groupRecommendationsBySchool(recommendations[key] || []);
    const schools = allSchools.slice(0, limit);
    const total = Math.max(Number(stats?.[key] || 0), allSchools.length);
    return `<div class="band ${key}">
      <div class="band-name"><span>${label}</span><span class="band-count">重点推荐 ${schools.length}/${limit} · 候选 ${total} 所</span></div>
      <div class="school-list">
        ${schools.length ? schools.map(item => schoolItemHtml(item, key)).join('') : `<div class="school-item">${escapeHtml(desc)}</div>`}
      </div>
    </div>`;
  });
}

function groupRecommendationsBySchool(items: any[]) {
  const map = new Map<string, any>();
  for (const item of items || []) {
    const name = String(item?.universityName || '').trim();
    if (!name) continue;
    const key = item.universityId || name;
    const lines = optionLines(item);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, Object.assign({}, item, {
        optionLines: lines,
        preferenceTags: uniqueStrings(item.preferenceTags || []),
        warningTags: uniqueStrings(item.warningTags || []),
      }));
      continue;
    }
    existing.preferenceTags = uniqueStrings([...(existing.preferenceTags || []), ...(item.preferenceTags || [])]);
    existing.warningTags = uniqueStrings([...(existing.warningTags || []), ...(item.warningTags || [])]);
    existing.optionLines = mergeOptionLines(existing.optionLines || [], lines);
  }
  return [...map.values()];
}

function schoolItemHtml(item: any, bucket: string) {
  const tags = [
    ...(item.tags || []).filter(Boolean),
    item.batch || '',
    ...visiblePreferenceTags(item),
  ].filter(Boolean) as string[];
  const warnings = (item.warningTags || []) as string[];
  const lines = optionLines(item).slice(0, 8);
  const reason = displayReason(item);
  return `<div class="school-item">
    <div class="school-top">
      <div class="school-name">${escapeHtml(item.universityName)}</div>
      <div class="school-meta">${escapeHtml([item.city, item.province, item.type, item.level].filter(Boolean).join(' · ') || bucketLabel(bucket))}</div>
    </div>
    ${tags.length || warnings.length ? `<div class="tag-row">${tags.map((tag: string) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}${warnings.map((tag: string) => `<span class="tag risk">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
    <div class="option-list">${lines.map((line: any, index: number) => optionLineHtml(line, index)).join('')}</div>
    ${reason ? `<div class="reason">${escapeHtml(reason)}</div>` : ''}
  </div>`;
}

function optionLineHtml(line: any, index: number) {
  const title = optionLineTitle(line, index);
  const meta = [
    line.groupCode ? `专业组${line.groupCode}` : optionLineType(line),
    line.subjectRequirement && line.subjectRequirement !== '不限' ? line.subjectRequirement : '',
    line.artCategory ? `${line.artCategory}` : '',
    line.compositeScore ? `综合分${formatExportScore(line.compositeScore)}` : line.minScore ? `${line.minScore}分` : '',
    line.minRank ? `位次${line.minRank}` : '',
  ].filter(Boolean).join(' · ');
  return `<div class="option-line">
    <div class="option-title">${escapeHtml(title)}</div>
    <div class="option-meta">${escapeHtml(meta || bucketLabel(line.bucket || 'stable'))}</div>
  </div>`;
}

function optionLines(item: any) {
  const lines = Array.isArray(item.optionLines) && item.optionLines.length
    ? item.optionLines
    : [{
        title: item.majorName || '院校录取线',
        bucket: item.bucket,
        lineType: item.lineType || null,
        groupCode: item.groupCode || null,
        groupName: item.groupName || null,
        subjectRequirement: item.subjectRequirement || null,
        year: item.year,
        batch: item.batch,
        subjectType: item.subjectType,
        majorName: item.majorName,
        minScore: item.minScore,
        minRank: item.minRank,
        avgScore: item.avgScore,
        planCount: item.planCount,
        compositeScore: item.compositeScore,
        cultureScore: item.cultureScore,
        professionalScore: item.professionalScore,
        artCategory: item.artCategory,
        admissionMethod: item.admissionMethod,
        preferenceTags: item.preferenceTags || [],
        warningTags: item.warningTags || [],
        reason: item.reason || '',
      }];
  return lines.filter((line: any) => line?.title || line?.minScore || line?.minRank);
}

function mergeOptionLines(current: any[], incoming: any[]) {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const line of [...current, ...incoming]) {
    const key = [line.title, line.year, line.batch, line.minScore, line.minRank, line.subjectRequirement].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

function optionLineTitle(line: any, index: number) {
  const title = line.title || line.majorName || line.groupName || (line.groupCode ? `专业组${line.groupCode}` : '');
  return title || `录取线 ${index + 1}`;
}

function optionLineType(line: any) {
  if (line.groupCode) return `专业组${line.groupCode}`;
  if (line.groupName && line.groupName !== line.title) return line.groupName;
  if (line.majorName) return '专业线';
  return '院校线';
}

function visiblePreferenceTags(item: any) {
  return (item.preferenceTags || []).filter((tag: string) => !/^目标(?:省份|城市)：/.test(String(tag)));
}

function displayReason(item: any) {
  return String(item?.reason || '')
    .replace(/匹配目标城市或省份：[^。]*。?/g, '')
    .trim();
}

function uniqueStrings(items: any[]) {
  return [...new Set((items || []).map(item => String(item || '').trim()).filter(Boolean))];
}

function bucketLabel(bucket: string) {
  if (bucket === 'rush') return '冲刺';
  if (bucket === 'safe') return '保底';
  return '稳妥';
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

function formatExportScore(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function buildExportFilename(report: any, userId: string, extension: string) {
  const input = safeJson(report.input, {});
  const userName = report.user?.nickname || report.user?.phone || `用户${String(userId).slice(0, 6)}`;
  const score = formatExportScore(input.score || report.score);
  const parts = [
    '涨识',
    '志愿分析报告',
    userName,
    input.province || report.province,
    input.subjectType || report.subjectType,
    score ? `${score}分` : '',
    formatDateForFilename(report.createdAt),
  ].filter(Boolean);
  return `${parts.map(part => safeFilename(String(part))).join('_')}.${extension}`;
}

function formatDateForFilename(value: Date | string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function getWatermarkLogoDataUrl() {
  const logoPath = BRAND_LOGO_PATHS.find(candidate => fs.existsSync(candidate));
  if (!logoPath) return '';
  try {
    return `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
  } catch (err) {
    logger.warn({ err, logoPath }, 'read watermark logo failed');
    return '';
  }
}

function watermarkHtml() {
  const items = Array.from({ length: 360 }, () => {
    return `<div class="watermark-item" aria-hidden="true"><div class="watermark-stamp"><div class="watermark-logo"></div><div class="watermark-text">涨识</div></div></div>`;
  });
  return `<div class="watermark-layer">${items.join('')}</div><div class="watermark-print">${items.join('')}</div>`;
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
