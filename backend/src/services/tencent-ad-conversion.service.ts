import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';

const DEFAULT_API_URL = 'https://api.e.qq.com/v3.0/user_actions/add';
const DEFAULT_CONVERSION_ID = '82945824';
const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 30;
const ACTION_TYPE_REGISTER = 'REGISTER';

type TencentAdAttributionInput = {
  clickId?: string | null;
  clickIdSource?: string | null;
  gdtVid?: string | null;
  qzGdt?: string | null;
  cb?: string | null;
  callbackUrl?: string | null;
  rawQuery?: Record<string, any> | null;
  capturedAt?: string | number | Date | null;
};

type RegisterConversionInput = {
  userId: string;
  openId?: string | null;
  unionId?: string | null;
  registeredAt?: Date;
  attribution?: TencentAdAttributionInput | null;
};

type ResolvedTencentAdConfig = {
  enabled: boolean;
  reportMode: string;
  accountId: string;
  userActionSetId: string;
  accessToken: string;
  miniAppId: string;
  conversionId: string;
  apiUrl: string;
  attributionWindowDays: number;
  reportWithoutClickId: boolean;
};

export async function getTencentAdConversionConfigForAdmin() {
  const cfg = await resolveTencentAdConfig({ includeSecrets: false });
  return {
    enabled: cfg.enabled,
    reportMode: cfg.reportMode,
    accountId: cfg.accountId,
    userActionSetId: cfg.userActionSetId,
    accessToken: maskSecret(cfg.accessToken),
    miniAppId: cfg.miniAppId,
    conversionId: cfg.conversionId,
    apiUrl: cfg.apiUrl,
    attributionWindowDays: cfg.attributionWindowDays,
    reportWithoutClickId: cfg.reportWithoutClickId,
    ready: getTencentAdConfigMissing(cfg).length === 0,
    missing: getTencentAdConfigMissing(cfg),
  };
}

export async function updateTencentAdConversionConfig(input: Record<string, any>) {
  const current = await prisma.tencentAdConversionConfig.findUnique({ where: { id: 'default' } });
  const data = normalizeTencentAdConfigInput(input, current);
  await prisma.tencentAdConversionConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data },
    update: data,
  });
  return getTencentAdConversionConfigForAdmin();
}

export async function listTencentAdConversionEvents(params: Record<string, any> = {}) {
  const page = clampInteger(params.page, 1, 100000, 1);
  const pageSize = clampInteger(params.pageSize, 1, 100, 20);
  const status = normalizeStatusFilter(params.status);
  const keyword = String(params.keyword || '').trim();
  const where: any = {};

  if (status) where.status = status;
  if (keyword) {
    where.OR = [
      { outerActionId: { contains: keyword } },
      { clickId: { contains: keyword } },
      { wechatOpenId: { contains: keyword } },
      { wechatUnionId: { contains: keyword } },
      { user: { nickname: { contains: keyword } } },
      { user: { phone: { contains: keyword } } },
    ];
  }

  const [total, items, stats] = await Promise.all([
    prisma.tencentAdConversionEvent.count({ where }),
    prisma.tencentAdConversionEvent.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            phone: true,
            province: true,
            city: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    getTencentAdConversionStats(),
  ]);

  return {
    items: items.map(formatTencentAdConversionEvent),
    total,
    page,
    pageSize,
    stats,
  };
}

export async function retryTencentAdConversionEvent(id: string) {
  const event = await prisma.tencentAdConversionEvent.findUnique({ where: { id } });
  if (!event) throw new AppError(404, '转化回传记录不存在', 'TENCENT_AD_EVENT_NOT_FOUND');
  return reportTencentAdConversionEvent(id, { force: true });
}

export async function reportTencentRegisterConversion(input: RegisterConversionInput) {
  const normalized = normalizeAttribution(input.attribution);
  const cfg = await resolveTencentAdConfig({ includeSecrets: true });

  const now = input.registeredAt || new Date();
  const outerActionId = buildOuterActionId(input.userId, ACTION_TYPE_REGISTER);

  const event = await prisma.tencentAdConversionEvent.upsert({
    where: { outerActionId },
    create: {
      userId: input.userId,
      eventType: ACTION_TYPE_REGISTER,
      outerActionId,
      status: 'pending',
      reportMode: cfg.reportMode,
      accountId: cfg.accountId || null,
      userActionSetId: cfg.userActionSetId || null,
      conversionId: cfg.conversionId || null,
      miniAppId: cfg.miniAppId || null,
      wechatOpenId: input.openId || null,
      wechatUnionId: input.unionId || null,
      clickId: normalized.clickId || null,
      clickIdSource: normalized.clickIdSource || null,
      cb: normalized.cb || null,
      callbackUrl: normalized.callbackUrl || null,
      rawAttribution: safeJsonStringify(input.attribution),
      requestPayload: null,
      responsePayload: null,
      lastError: null,
    },
    update: {
      reportMode: cfg.reportMode,
      accountId: cfg.accountId || null,
      userActionSetId: cfg.userActionSetId || null,
      conversionId: cfg.conversionId || null,
      miniAppId: cfg.miniAppId || null,
      wechatOpenId: input.openId || null,
      wechatUnionId: input.unionId || null,
      clickId: normalized.clickId || null,
      clickIdSource: normalized.clickIdSource || null,
      cb: normalized.cb || null,
      callbackUrl: normalized.callbackUrl || null,
      rawAttribution: safeJsonStringify(input.attribution),
    },
  });

  if (!normalized.hasAttribution && !cfg.reportWithoutClickId) {
    await markEventSkipped(event.id, '缺少 click_id/gdt_vid/qz_gdt/cb，未上报腾讯广告');
    return event;
  }

  if (!cfg.enabled) {
    await markEventSkipped(event.id, '腾讯广告回传未启用');
    return event;
  }

  if (!isWithinAttributionWindow(normalized.capturedAt, cfg.attributionWindowDays, now)) {
    await markEventSkipped(event.id, '广告点击参数已超过归因窗口');
    return event;
  }

  setImmediate(() => {
    reportTencentAdConversionEvent(event.id).catch((err) => {
      console.error('[tencent-ad] 注册转化回传失败', err);
    });
  });

  return event;
}

async function reportTencentAdConversionEvent(id: string, options: { force?: boolean } = {}) {
  const event = await prisma.tencentAdConversionEvent.findUnique({ where: { id } });
  if (!event) throw new AppError(404, '转化回传记录不存在', 'TENCENT_AD_EVENT_NOT_FOUND');
  if (event.status === 'sent' && !options.force) return formatTencentAdConversionEvent(event as any);

  const cfg = await resolveTencentAdConfig({ includeSecrets: true });
  const missing = getTencentAdConfigMissing(cfg);
  if (missing.length) {
    const updated = await prisma.tencentAdConversionEvent.update({
      where: { id },
      data: {
        status: 'pending_config',
        lastError: `腾讯广告回传配置未完整：${missing.join(', ')}`,
        accountId: cfg.accountId || null,
        userActionSetId: cfg.userActionSetId || null,
        conversionId: cfg.conversionId || null,
        miniAppId: cfg.miniAppId || event.miniAppId || null,
      },
    });
    return formatTencentAdConversionEvent(updated as any);
  }

  if (!event.clickId && !event.cb && !cfg.reportWithoutClickId) {
    const updated = await prisma.tencentAdConversionEvent.update({
      where: { id },
      data: {
        status: 'skipped',
        lastError: '缺少 click_id/cb，未上报腾讯广告',
      },
    });
    return formatTencentAdConversionEvent(updated as any);
  }

  const request = buildTencentAdRequest(event, cfg);
  await prisma.tencentAdConversionEvent.update({
    where: { id },
    data: {
      status: 'sending',
      reportMode: request.reportMode,
      accountId: cfg.accountId,
      userActionSetId: cfg.userActionSetId,
      conversionId: cfg.conversionId,
      miniAppId: cfg.miniAppId,
      requestPayload: safeJsonStringify(request.payload),
      lastAttemptAt: new Date(),
      retryCount: { increment: 1 },
      lastError: null,
    },
  });

  try {
    const response = await axios.post(request.url, request.payload, {
      headers: request.headers,
      timeout: 10000,
    });
    const responsePayload = response.data;
    const ok = Number(responsePayload?.code || 0) === 0;
    const updated = await prisma.tencentAdConversionEvent.update({
      where: { id },
      data: {
        status: ok ? 'sent' : 'failed',
        responsePayload: safeJsonStringify(responsePayload),
        lastError: ok ? null : buildTencentResponseError(responsePayload),
        reportedAt: ok ? new Date() : null,
      },
    });
    return formatTencentAdConversionEvent(updated as any);
  } catch (err: any) {
    const updated = await prisma.tencentAdConversionEvent.update({
      where: { id },
      data: {
        status: 'failed',
        responsePayload: safeJsonStringify(err?.response?.data || null),
        lastError: buildHttpError(err),
      },
    });
    return formatTencentAdConversionEvent(updated as any);
  }
}

async function resolveTencentAdConfig(options: { includeSecrets: boolean }): Promise<ResolvedTencentAdConfig> {
  const db = await prisma.tencentAdConversionConfig.findUnique({ where: { id: 'default' } });
  const accessToken = options.includeSecrets
    ? (db?.accessToken || config.tencentAd?.accessToken || '')
    : (db?.accessToken || config.tencentAd?.accessToken || '');
  return {
    enabled: db?.enabled ?? (process.env.TENCENT_AD_CONVERSION_ENABLED !== 'false'),
    reportMode: normalizeReportMode(db?.reportMode || process.env.TENCENT_AD_CONVERSION_REPORT_MODE || 'click_id'),
    accountId: db?.accountId || config.tencentAd?.accountId || '',
    userActionSetId: db?.userActionSetId || config.tencentAd?.userActionSetId || '',
    accessToken,
    miniAppId: db?.miniAppId || config.tencentAd?.miniAppId || config.wechat.miniProgram.appId || '',
    conversionId: db?.conversionId || config.tencentAd?.conversionId || DEFAULT_CONVERSION_ID,
    apiUrl: db?.apiUrl || process.env.TENCENT_AD_CONVERSION_API_URL || DEFAULT_API_URL,
    attributionWindowDays: clampInteger(db?.attributionWindowDays ?? process.env.TENCENT_AD_ATTRIBUTION_WINDOW_DAYS, 1, 90, DEFAULT_ATTRIBUTION_WINDOW_DAYS),
    reportWithoutClickId: db?.reportWithoutClickId ?? process.env.TENCENT_AD_REPORT_WITHOUT_CLICK_ID === 'true',
  };
}

function buildTencentAdRequest(event: any, cfg: ResolvedTencentAdConfig) {
  if (event.cb || cfg.reportMode === 'callback') {
    const url = buildCallbackUrl(event, cfg);
    return {
      url,
      reportMode: 'callback',
      headers: {
        'Content-Type': 'application/json',
        'cache-control': 'no-cache',
        'access-token': cfg.accessToken,
        timestamp: String(Math.floor(Date.now() / 1000)),
        nonce: crypto.randomBytes(8).toString('hex'),
      },
      payload: {
        actions: [buildActionPayload(event, cfg, false)],
      },
    };
  }

  const url = appendAccessToken(cfg.apiUrl, cfg.accessToken);
  return {
    url,
    reportMode: 'click_id',
    headers: {
      'Content-Type': 'application/json',
      'cache-control': 'no-cache',
    },
    payload: {
      account_id: numericOrString(cfg.accountId),
      user_action_set_id: numericOrString(cfg.userActionSetId),
      actions: [buildActionPayload(event, cfg, true)],
    },
  };
}

function buildActionPayload(event: any, cfg: ResolvedTencentAdConfig, includeClickId: boolean) {
  const action: Record<string, any> = {
    outer_action_id: event.outerActionId,
    action_time: Math.floor(new Date(event.createdAt || Date.now()).getTime() / 1000),
    user_id: {
      wechat_openid: event.wechatOpenId || '',
      wechat_unionid: event.wechatUnionId || '',
      wechat_app_id: cfg.miniAppId,
    },
    action_type: event.eventType || ACTION_TYPE_REGISTER,
    channel: 'TENCENT',
  };

  if (includeClickId && event.clickId) {
    action.trace = { click_id: event.clickId };
  }

  return action;
}

function buildCallbackUrl(event: any, cfg: ResolvedTencentAdConfig) {
  if (event.callbackUrl) return event.callbackUrl;
  if (!event.cb) return cfg.apiUrl;
  const base = cfg.apiUrl || DEFAULT_API_URL;
  const url = new URL(base);
  url.searchParams.set('cb', event.cb);
  if (cfg.conversionId) url.searchParams.set('conv_id', cfg.conversionId);
  return url.toString();
}

function appendAccessToken(apiUrl: string, accessToken: string) {
  const url = new URL(apiUrl || DEFAULT_API_URL);
  if (accessToken) url.searchParams.set('access_token', accessToken);
  url.searchParams.set('timestamp', String(Math.floor(Date.now() / 1000)));
  url.searchParams.set('nonce', crypto.randomBytes(8).toString('hex'));
  return url.toString();
}

function normalizeAttribution(input?: TencentAdAttributionInput | null) {
  const clickIdFromDirect = clean(input?.clickId);
  const gdtVid = clean(input?.gdtVid);
  const qzGdt = clean(input?.qzGdt);
  const clickId = clickIdFromDirect || gdtVid || qzGdt;
  const clickIdSource = clean(input?.clickIdSource) || (clickIdFromDirect ? 'click_id' : gdtVid ? 'gdt_vid' : qzGdt ? 'qz_gdt' : '');
  const cb = clean(input?.cb);
  const callbackUrl = clean(input?.callbackUrl);
  const capturedAt = parseDate(input?.capturedAt);
  return {
    clickId,
    clickIdSource,
    cb,
    callbackUrl,
    capturedAt,
    hasAttribution: Boolean(clickId || cb || callbackUrl),
  };
}

function normalizeTencentAdConfigInput(input: Record<string, any>, current: any) {
  return {
    enabled: input.enabled !== false,
    reportMode: normalizeReportMode(input.reportMode),
    accountId: clean(input.accountId) || null,
    userActionSetId: clean(input.userActionSetId) || null,
    accessToken: normalizeSecretInput(input.accessToken, current?.accessToken),
    miniAppId: clean(input.miniAppId) || config.wechat.miniProgram.appId || null,
    conversionId: clean(input.conversionId) || DEFAULT_CONVERSION_ID,
    apiUrl: clean(input.apiUrl) || DEFAULT_API_URL,
    attributionWindowDays: clampInteger(input.attributionWindowDays, 1, 90, DEFAULT_ATTRIBUTION_WINDOW_DAYS),
    reportWithoutClickId: input.reportWithoutClickId === true,
  };
}

function getTencentAdConfigMissing(cfg: ResolvedTencentAdConfig) {
  const missing: string[] = [];
  if (!cfg.accountId) missing.push('account_id');
  if (!cfg.userActionSetId) missing.push('user_action_set_id');
  if (!cfg.accessToken) missing.push('access_token');
  if (!cfg.miniAppId) missing.push('mini_app_id');
  if (!cfg.apiUrl) missing.push('api_url');
  return missing;
}

async function markEventSkipped(id: string, reason: string) {
  return prisma.tencentAdConversionEvent.update({
    where: { id },
    data: {
      status: 'skipped',
      lastError: reason,
    },
  });
}

async function getTencentAdConversionStats() {
  const groups = await prisma.tencentAdConversionEvent.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const stats: Record<string, number> = {
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    pending_config: 0,
    skipped: 0,
    sending: 0,
  };
  groups.forEach((item) => {
    stats[item.status] = item._count._all;
    stats.total += item._count._all;
  });
  return stats;
}

function formatTencentAdConversionEvent(event: any) {
  return {
    id: event.id,
    userId: event.userId,
    user: event.user,
    eventType: event.eventType,
    outerActionId: event.outerActionId,
    status: event.status,
    reportMode: event.reportMode,
    accountId: event.accountId,
    userActionSetId: event.userActionSetId,
    conversionId: event.conversionId,
    miniAppId: event.miniAppId,
    wechatOpenId: event.wechatOpenId ? maskMiddle(event.wechatOpenId, 6, 4) : '',
    wechatUnionId: event.wechatUnionId ? maskMiddle(event.wechatUnionId, 6, 4) : '',
    clickId: event.clickId,
    clickIdSource: event.clickIdSource,
    cb: event.cb ? maskMiddle(event.cb, 8, 4) : '',
    callbackUrl: event.callbackUrl,
    rawAttribution: parseJson(event.rawAttribution),
    requestPayload: parseJson(event.requestPayload),
    responsePayload: parseJson(event.responsePayload),
    lastError: event.lastError,
    retryCount: event.retryCount,
    lastAttemptAt: event.lastAttemptAt,
    reportedAt: event.reportedAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

function buildOuterActionId(userId: string, eventType: string) {
  return `${eventType.toLowerCase()}_${userId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 255);
}

function buildTencentResponseError(data: any) {
  if (!data) return '腾讯广告接口返回异常';
  const message = data.message_cn || data.message || data.error_description || data.error || '';
  return typeof message === 'string' ? message || `腾讯广告接口返回 code=${data.code}` : safeJsonStringify(message);
}

function buildHttpError(err: any) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const message = err?.message || '请求腾讯广告接口失败';
  return status ? `${message} HTTP ${status}: ${safeJsonStringify(data)}` : message;
}

function normalizeStatusFilter(value: any) {
  const status = String(value || '').trim();
  if (!status) return '';
  return ['pending', 'pending_config', 'sending', 'sent', 'failed', 'skipped'].includes(status) ? status : '';
}

function normalizeReportMode(value: any) {
  const mode = String(value || '').trim();
  return mode === 'callback' ? 'callback' : 'click_id';
}

function normalizeSecretInput(value: any, current?: string | null) {
  const text = clean(value);
  if (!text) return null;
  if (text.includes('***')) return current || null;
  return text;
}

function isWithinAttributionWindow(capturedAt: Date | null, days: number, now: Date) {
  if (!capturedAt) return true;
  const diffMs = now.getTime() - capturedAt.getTime();
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function numericOrString(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value;
}

function clean(value: any) {
  return String(value || '').trim();
}

function clampInteger(value: any, min: number, max: number, fallback: number) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeJsonStringify(value: any) {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseJson(value: any) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function maskSecret(value?: string | null) {
  if (!value) return '';
  return maskMiddle(value, 4, 4);
}

function maskMiddle(value: string, start: number, end: number) {
  if (value.length <= start + end) return '*'.repeat(value.length);
  return `${value.slice(0, start)}${'*'.repeat(6)}${value.slice(-end)}`;
}
