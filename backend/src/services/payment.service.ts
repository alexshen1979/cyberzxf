import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { chargePoints } from './points.service';
import { createLogger } from '../utils/logger';
import {
  getRechargeProductById,
  listRechargeProducts,
} from './point-config.service';
import { settleDistributionCommissionForOrder } from './distribution.service';
import {
  paymentDeviceFromVirtualOrderType,
  summarizePaymentDevices,
} from './payment-device';

const logger = createLogger('payment');
const RECHARGE_EVENT_TYPES = ['page_view', 'pay_click', 'order_created', 'payment_success'];
const VIRTUAL_PAY_MODE = 'short_series_goods' as const;
let miniProgramAccessTokenCache: { token: string; expiresAt: number } | null = null;

interface WechatPayParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
}

interface WechatVirtualPayParams {
  provider: 'wechat_virtual';
  mode: typeof VIRTUAL_PAY_MODE;
  signData: string;
  paySig: string;
  signature: string;
}

interface ResolvedWechatPayConfig {
  miniAppId: string;
  miniSecret: string;
  mchId: string;
  apiV3Key: string;
  serialNo: string;
  privateKeyPath: string;
  platformPublicKeyPath: string;
  notifyUrl: string;
  transferNotifyUrl: string;
}

interface ResolvedWechatVirtualPayConfig {
  mode: 'wechat_pay' | 'wechat_virtual' | 'auto';
  offerId: string;
  appKey: string;
  sandboxAppKey: string;
  env: 0 | 1;
  productMap: Record<string, string>;
}

interface VirtualSettlementSyncSettings {
  enabled: boolean;
  intervalHours: number;
  days: number;
  limit: number;
  lastSyncedAt: Date | null;
  lastResult: any;
}

interface WechatPushVerifyInput {
  signature?: string;
  timestamp?: string;
  nonce?: string;
}

export async function getProductList() {
  const products = await listRechargeProducts();
  return products.map(({ id, name, description, price, originalPrice, points, bonus, isDefault, badgeType }) => ({
    id,
    name,
    description,
    price: price / 100,   // 转换为元
    originalPrice: originalPrice ? originalPrice / 100 : null,
    points,
    bonus,
    isDefault,
    badgeType,
  }));
}

export async function getWechatPayConfigStatus() {
  const cfg = await resolveWechatPayConfig();
  const virtualCfg = await resolveWechatVirtualPayConfig();
  const mode = virtualCfg.mode;
  const requireWechatPay = mode === 'wechat_pay' || mode === 'auto';
  const requireVirtualPay = mode === 'wechat_virtual' || mode === 'auto';
  const checks = [
    { key: 'WECHAT_MINI_APPID', ok: !isPlaceholder(cfg.miniAppId), required: true },
    { key: 'WECHAT_MINI_SECRET', ok: !isPlaceholder(cfg.miniSecret), required: true },
    { key: 'WECHAT_PAY_MCHID', ok: !isPlaceholder(cfg.mchId), required: requireWechatPay },
    { key: 'WECHAT_PAY_SERIAL_NO', ok: !isPlaceholder(cfg.serialNo), required: requireWechatPay },
    { key: 'WECHAT_PAY_PRIVATE_KEY_PATH', ok: !isPlaceholder(cfg.privateKeyPath) && fs.existsSync(cfg.privateKeyPath), required: requireWechatPay },
    { key: 'WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH', ok: !isPlaceholder(cfg.platformPublicKeyPath) && fs.existsSync(cfg.platformPublicKeyPath), required: false },
    { key: 'WECHAT_PAY_APIV3_KEY', ok: !isPlaceholder(cfg.apiV3Key) && cfg.apiV3Key.length >= 32, required: requireWechatPay },
    { key: 'WECHAT_PAY_NOTIFY_URL', ok: !isPlaceholder(cfg.notifyUrl), required: requireWechatPay },
    { key: 'WECHAT_VIRTUAL_PAY_OFFER_ID', ok: !isPlaceholder(virtualCfg.offerId), required: requireVirtualPay },
    { key: virtualCfg.env === 1 ? 'WECHAT_VIRTUAL_PAY_SANDBOX_APP_KEY' : 'WECHAT_VIRTUAL_PAY_APP_KEY', ok: !isPlaceholder(getWechatVirtualPayAppKey(virtualCfg)), required: requireVirtualPay },
  ];
  const missing = checks.filter(item => item.required && !item.ok).map(item => item.key);
  return {
    ready: missing.length === 0,
    missing,
    checks,
    rechargePayMode: mode,
  };
}

export async function getWechatPayConfigForAdmin() {
  const dbConfig = await prisma.wechatPayConfig.findFirst();
  const cfg = await resolveWechatPayConfig();
  const status = await getWechatPayConfigStatus();
  const settlementSync = buildVirtualSettlementSyncSettings(dbConfig);
  return {
    miniAppId: dbConfig?.miniAppId || cfg.miniAppId,
    miniSecret: maskSecret(dbConfig?.miniSecret || cfg.miniSecret),
    mchId: dbConfig?.mchId || cfg.mchId,
    apiV3Key: maskSecret(dbConfig?.apiV3Key || cfg.apiV3Key),
    serialNo: dbConfig?.serialNo || cfg.serialNo,
    privateKeyPath: dbConfig?.privateKeyPath || cfg.privateKeyPath,
    platformPublicKeyPath: dbConfig?.platformPublicKeyPath || cfg.platformPublicKeyPath,
    notifyUrl: dbConfig?.notifyUrl || cfg.notifyUrl,
    transferNotifyUrl: dbConfig?.transferNotifyUrl || cfg.transferNotifyUrl,
    rechargePayMode: normalizeRechargePayMode(dbConfig?.rechargePayMode || process.env.RECHARGE_PAY_MODE || 'wechat_pay'),
    virtualOfferId: dbConfig?.virtualOfferId || config.wechat.virtualPay.offerId,
    virtualAppKey: maskSecret(dbConfig?.virtualAppKey || config.wechat.virtualPay.appKey),
    virtualSandboxAppKey: maskSecret(dbConfig?.virtualSandboxAppKey || config.wechat.virtualPay.sandboxAppKey),
    virtualEnv: dbConfig?.virtualEnv ?? Number(config.wechat.virtualPay.env || 0),
    virtualProductMap: dbConfig?.virtualProductMap || config.wechat.virtualPay.productMap,
    virtualCallbackUrl: buildVirtualPaymentCallbackUrl(dbConfig?.notifyUrl || cfg.notifyUrl),
    virtualSettlementSync: settlementSync,
    source: dbConfig ? 'database' : 'env',
    status,
  };
}

export async function getWechatVirtualSettlementSyncSettings(): Promise<VirtualSettlementSyncSettings> {
  const dbConfig = await prisma.wechatPayConfig.findFirst();
  return buildVirtualSettlementSyncSettings(dbConfig);
}

export async function updateWechatVirtualSettlementSyncSettings(input: Record<string, any>) {
  const current = await prisma.wechatPayConfig.findFirst();
  const data = {
    virtualSettlementSyncEnabled: input.enabled !== false,
    virtualSettlementSyncIntervalHours: clampInteger(input.intervalHours, 1, 168, 6),
    virtualSettlementSyncDays: clampInteger(input.days, 1, 180, 120),
    virtualSettlementSyncLimit: clampInteger(input.limit, 1, 200, 30),
  };

  if (current) {
    await prisma.wechatPayConfig.update({ where: { id: current.id }, data });
  } else {
    await prisma.wechatPayConfig.create({
      data: {
        rechargePayMode: 'wechat_pay',
        virtualEnv: 0,
        ...data,
      },
    });
  }

  return getWechatVirtualSettlementSyncSettings();
}

export async function getWechatMiniProgramCredentials() {
  const cfg = await resolveWechatPayConfig();
  return {
    appId: cfg.miniAppId,
    secret: cfg.miniSecret,
  };
}

export async function updateWechatPayConfig(input: Record<string, any>) {
  const current = await prisma.wechatPayConfig.findFirst();
  const data = {
    miniAppId: normalizeConfigValue(input.miniAppId),
    miniSecret: normalizeSecretInput(input.miniSecret, current?.miniSecret),
    mchId: normalizeConfigValue(input.mchId),
    apiV3Key: normalizeSecretInput(input.apiV3Key, current?.apiV3Key),
    serialNo: normalizeConfigValue(input.serialNo),
    privateKeyPath: normalizeConfigValue(input.privateKeyPath),
    platformPublicKeyPath: normalizeConfigValue(input.platformPublicKeyPath),
    notifyUrl: normalizeConfigValue(input.notifyUrl),
    transferNotifyUrl: normalizeConfigValue(input.transferNotifyUrl),
    rechargePayMode: normalizeRechargePayMode(input.rechargePayMode),
    virtualOfferId: normalizeConfigValue(input.virtualOfferId),
    virtualAppKey: normalizeSecretInput(input.virtualAppKey, current?.virtualAppKey),
    virtualSandboxAppKey: normalizeSecretInput(input.virtualSandboxAppKey, current?.virtualSandboxAppKey),
    virtualEnv: Number(input.virtualEnv) === 1 ? 1 : 0,
    virtualProductMap: normalizeConfigValue(input.virtualProductMap),
    virtualSettlementSyncEnabled: input.virtualSettlementSyncEnabled !== undefined ? input.virtualSettlementSyncEnabled === true : (current?.virtualSettlementSyncEnabled ?? true),
    virtualSettlementSyncIntervalHours: input.virtualSettlementSyncIntervalHours !== undefined ? clampInteger(input.virtualSettlementSyncIntervalHours, 1, 168, 6) : (current?.virtualSettlementSyncIntervalHours ?? 6),
    virtualSettlementSyncDays: input.virtualSettlementSyncDays !== undefined ? clampInteger(input.virtualSettlementSyncDays, 1, 180, 120) : (current?.virtualSettlementSyncDays ?? 120),
    virtualSettlementSyncLimit: input.virtualSettlementSyncLimit !== undefined ? clampInteger(input.virtualSettlementSyncLimit, 1, 200, 30) : (current?.virtualSettlementSyncLimit ?? 30),
  };

  if (current) {
    await prisma.wechatPayConfig.update({ where: { id: current.id }, data });
  } else {
    await prisma.wechatPayConfig.create({ data });
  }

  return getWechatPayConfigForAdmin();
}

// 创建预支付订单
export async function createOrder(userId: string, productId: string, input: Record<string, any> = {}) {
  const product = await getRechargeProductById(productId);
  if (!product) {
    throw new AppError(404, '充值套餐不存在', 'PRODUCT_NOT_FOUND');
  }

  const payMode = await resolveRechargePayMode(input);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { miniOpenId: true, miniSessionKey: true },
  });
  if (!user?.miniOpenId) {
    throw new AppError(422, '请先完成微信小程序登录后再支付', 'WECHAT_OPENID_REQUIRED');
  }
  if (payMode === 'wechat_virtual' && !user.miniSessionKey) {
    throw new AppError(422, '微信登录态已过期，请重新登录后再支付', 'WECHAT_SESSION_KEY_REQUIRED');
  }

  const orderNo = generateOrderNo();
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNo,
        userId,
        productId: product.id,
        productName: product.name,
        amount: product.price,
        points: product.points,
        bonusPoints: product.bonus,
        status: 'pending',
        payChannel: payMode,
        paymentDevice: resolveInitialPaymentDevice(payMode, input),
      },
    });
    await safeCreateRechargeAnalyticsEvent(tx, 'order_created', userId, {
      productId: product.id,
      orderId: created.id,
      amount: product.price,
      sessionId: input.sessionId,
      channel: input.channel,
      source: input.source,
    });
    return created;
  });

  const payParams = payMode === 'wechat_virtual'
    ? buildWechatVirtualPayParams(await ensureWechatVirtualPayConfigured(), {
      sessionKey: user.miniSessionKey || '',
      orderNo: order.orderNo,
      productId: product.id,
      goodsPrice: product.price,
    })
    : await createWechatJsapiPrepay(await ensureWechatPayConfigured(), {
      openId: user.miniOpenId,
      orderNo: order.orderNo,
      amount: product.price,
      description: product.name,
    });

  return {
    orderNo: order.orderNo,
    amount: product.price,
    productName: product.name,
    payChannel: payMode,
    payParams,
  };
}

// 支付成功回调处理
export async function handlePaymentCallback(orderNo: string, transactionId: string, options: {
  payChannel?: string;
  virtualWxOrderId?: string;
  virtualOrder?: any;
} = {}) {
  const order = await prisma.order.findUnique({ where: { orderNo } });
  if (!order) {
    throw new AppError(404, `订单不存在: ${orderNo}`, 'ORDER_NOT_FOUND');
  }

  if (order.status === 'paid') {
    logger.warn('重复支付回调: %s', orderNo);
    const data: Record<string, any> = {};
    if (options.payChannel && order.payChannel !== options.payChannel) data.payChannel = options.payChannel;
    if (options.virtualWxOrderId && !order.virtualWxOrderId) data.virtualWxOrderId = options.virtualWxOrderId;
    Object.assign(data, buildVirtualOrderUpdateData(options.virtualOrder, order));
    if (Object.keys(data).length > 0) {
      await prisma.order.update({ where: { orderNo }, data });
    }
    await settleDistributionCommissionForOrder(order.id);
    return; // 幂等处理
  }

  if (order.status !== 'pending') {
    throw new AppError(409, `订单状态异常: ${order.status}`, 'ORDER_STATUS_ERROR');
  }

  // 更新订单状态
  await prisma.order.update({
    where: { orderNo },
    data: {
      status: 'paid',
      transactionId,
      paidAt: new Date(),
      ...(options.payChannel ? { payChannel: options.payChannel } : {}),
      ...(options.virtualWxOrderId ? { virtualWxOrderId: options.virtualWxOrderId } : {}),
      ...buildVirtualOrderUpdateData(options.virtualOrder, order),
    },
  });
  await safeCreateRechargeAnalyticsEvent(prisma, 'payment_success', order.userId, {
    productId: order.productId,
    orderId: order.id,
    amount: order.amount,
  });

  // 充值到账
  await chargePoints(order.userId, order.points, order.bonusPoints, order.id);

  // 分销佣金结算。首充和复充按后台规则生效，服务内做幂等保护。
  await settleDistributionCommissionForOrder(order.id);

  logger.info('支付成功: orderNo=%s, userId=%s, points=%d(+%d)',
    orderNo, order.userId, order.points, order.bonusPoints);
}

export async function handleWechatPayNotify(body: Record<string, any>, headers?: Record<string, any>, rawBody?: string) {
  const payConfig = await resolveWechatPayConfig();
  verifyWechatPayNotifySignature(payConfig, headers, rawBody);

  const resource = body?.resource;
  if (!resource?.ciphertext || !resource?.nonce) {
    throw new AppError(422, '微信支付回调参数不完整', 'WECHAT_PAY_NOTIFY_INVALID');
  }

  const payload = decryptWechatPayResource(payConfig, resource);
  if (!payload.out_trade_no) {
    throw new AppError(422, '微信支付回调缺少商户订单号', 'WECHAT_PAY_NOTIFY_INVALID');
  }

  if (payload.trade_state !== 'SUCCESS') {
    logger.warn('微信支付非成功回调: orderNo=%s, state=%s', payload.out_trade_no, payload.trade_state);
    return payload;
  }

  await handlePaymentCallback(payload.out_trade_no, payload.transaction_id || '');
  return payload;
}

export async function handleWechatVirtualPayNotify(body: Record<string, any>) {
  const event = getVirtualNotifyString(body, 'Event');
  if (event !== 'xpay_goods_deliver_notify' && event !== 'xpay_coin_pay_notify') {
    logger.info('忽略虚拟支付非发货/支付推送: event=%s', event || '-');
    return body;
  }

  const orderNo = getVirtualNotifyString(body, 'OutTradeNo');
  if (!orderNo) {
    throw new AppError(422, '虚拟支付推送缺少业务订单号', 'WECHAT_VIRTUAL_NOTIFY_INVALID');
  }

  const payInfo = getVirtualNotifyObject(body, 'WeChatPayInfo');
  const wxOrderId = getVirtualNotifyString(body, 'WxOrderId')
    || getVirtualNotifyString(body, 'wx_order_id');
  const transactionId = getVirtualNotifyString(payInfo, 'TransactionId')
    || getVirtualNotifyString(payInfo, 'MchOrderNo')
    || wxOrderId
    || orderNo;

  await handlePaymentCallback(orderNo, transactionId, {
    payChannel: 'wechat_virtual',
    virtualWxOrderId: wxOrderId,
  });

  await notifyWechatVirtualGoodsProvided(orderNo, wxOrderId).catch((err: any) => {
    logger.warn('虚拟支付通知已发货失败: orderNo=%s message=%s', orderNo, err?.message || err);
  });

  return body;
}

export function verifyWechatVirtualPayPushSignature(input: WechatPushVerifyInput) {
  const token = config.wechat.virtualPay.pushToken || config.wechat.officialAccount.token || '';
  if (!token || !input.signature || !input.timestamp || !input.nonce) return false;

  const text = [token, input.timestamp, input.nonce].sort().join('');
  const sha1 = crypto.createHash('sha1').update(text).digest('hex');
  return sha1 === input.signature;
}

// 查询用户订单
export async function getUserOrders(userId: string, page = 1, pageSize = 20) {
  const [list, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where: { userId } }),
  ]);
  return { list, total, page, pageSize };
}

export async function getUserOrderDetail(userId: string, orderNo: string) {
  let order = await prisma.order.findFirst({
    where: { userId, orderNo },
  });
  if (!order) {
    throw new AppError(404, '订单不存在', 'ORDER_NOT_FOUND');
  }

  if (order.status === 'pending') {
    if (order.payChannel === 'wechat_virtual') {
      await syncWechatVirtualOrderStatus(order.orderNo);
    } else {
      await syncWechatOrderStatus(order.orderNo);
    }
    order = await prisma.order.findFirst({
      where: { userId, orderNo },
    });
  }

  return order;
}

export async function syncPaymentOrderStatusForAdmin(orderNo: string) {
  const normalizedOrderNo = String(orderNo || '').trim();
  if (!normalizedOrderNo) {
    throw new AppError(422, '订单号不能为空', 'ORDER_NO_REQUIRED');
  }

  let order = await prisma.order.findUnique({ where: { orderNo: normalizedOrderNo } });
  if (!order) {
    throw new AppError(404, '订单不存在', 'ORDER_NOT_FOUND');
  }

  if (order.payChannel === 'wechat_virtual') {
    await syncWechatVirtualOrderStatus(order.orderNo);
  } else {
    await syncWechatOrderStatus(order.orderNo);
  }

  order = await prisma.order.findUnique({ where: { orderNo: normalizedOrderNo } });
  return order;
}

// 按时间统计充值（管理后台用）
export async function getRevenueStats(startDate: Date, endDate: Date) {
  const orders = await prisma.order.findMany({
    where: {
      status: 'paid',
      paidAt: { gte: startDate, lte: endDate },
    },
  });

  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const paymentDeviceBreakdown = summarizePaymentDevices(orders);

  return { totalRevenue, totalOrders, avgOrderValue, paymentDeviceBreakdown };
}

export async function recordRechargeEvent(userId: string | null, eventType: string, input: Record<string, any> = {}) {
  const type = normalizeRechargeEventType(eventType);
  return createRechargeAnalyticsEvent(prisma, type, userId, input);
}

export async function getRechargeAnalyticsForAdmin(params: Record<string, any> = {}) {
  const range = resolveAnalyticsDateRange(params);
  const where = { createdAt: { gte: range.startDate, lte: range.endDate } };
  const orderWhere = { createdAt: { gte: range.startDate, lte: range.endDate } };
  const paidOrderWhere = { status: 'paid', paidAt: { gte: range.startDate, lte: range.endDate } };
  const [
    views,
    payClicks,
    orderCreatedEvents,
    paymentSuccessEvents,
    createdOrders,
    paidOrders,
    revenue,
    paidOrderList,
    uniqueViewUsers,
    uniquePaidUsers,
    recentEvents,
  ] = await Promise.all([
    prisma.rechargeAnalyticsEvent.count({ where: { ...where, eventType: 'page_view' } }),
    prisma.rechargeAnalyticsEvent.count({ where: { ...where, eventType: 'pay_click' } }),
    prisma.rechargeAnalyticsEvent.count({ where: { ...where, eventType: 'order_created' } }),
    prisma.rechargeAnalyticsEvent.count({ where: { ...where, eventType: 'payment_success' } }),
    prisma.order.count({ where: orderWhere }),
    prisma.order.count({ where: paidOrderWhere }),
    prisma.order.aggregate({ where: paidOrderWhere, _sum: { amount: true } }),
    prisma.order.findMany({ where: paidOrderWhere }),
    prisma.rechargeAnalyticsEvent.findMany({
      where: { ...where, eventType: 'page_view', userId: { not: null } },
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.order.findMany({
      where: paidOrderWhere,
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.rechargeAnalyticsEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        user: { select: { id: true, nickname: true, phone: true, shareCode: true } },
        order: { select: { id: true, orderNo: true, status: true, productName: true, amount: true } },
      },
    }),
  ]);

  const paidOrderCount = Math.max(paidOrders, paymentSuccessEvents);
  const createdOrderCount = Math.max(createdOrders, orderCreatedEvents);
  return {
    startDate: range.startDate,
    endDate: range.endDate,
    views,
    payClicks,
    createdOrders: createdOrderCount,
    paidOrders: paidOrderCount,
    revenue: revenue._sum.amount || 0,
    paymentDeviceBreakdown: summarizePaymentDevices(paidOrderList),
    uniqueViewUsers: uniqueViewUsers.length,
    uniquePaidUsers: uniquePaidUsers.length,
    clickRate: ratio(payClicks, views),
    orderRate: ratio(createdOrderCount, views),
    payConversionRate: ratio(paidOrderCount, views),
    clickPayRate: ratio(paidOrderCount, payClicks),
    avgOrderValue: paidOrderCount > 0 ? Math.round((revenue._sum.amount || 0) / paidOrderCount) : 0,
    recentEvents,
  };
}

async function createRechargeAnalyticsEvent(db: any, eventType: string, userId: string | null, input: Record<string, any> = {}) {
  return db.rechargeAnalyticsEvent.create({
    data: {
      eventType: normalizeRechargeEventType(eventType),
      userId: userId || null,
      sessionId: normalizeShortText(input.sessionId, 64),
      productId: normalizeShortText(input.productId, 80),
      orderId: normalizeShortText(input.orderId, 80),
      amount: input.amount === undefined || input.amount === null ? null : Math.max(0, Math.round(Number(input.amount) || 0)),
      channel: normalizeShortText(input.channel, 40),
      source: normalizeShortText(input.source, 80),
    },
  });
}

async function safeCreateRechargeAnalyticsEvent(db: any, eventType: string, userId: string | null, input: Record<string, any> = {}) {
  try {
    return await createRechargeAnalyticsEvent(db, eventType, userId, input);
  } catch (err: any) {
    logger.warn('充值统计写入失败: eventType=%s userId=%s message=%s', eventType, userId || '-', err?.message || err);
    return null;
  }
}

function normalizeRechargeEventType(value: any) {
  const type = String(value || '').trim();
  if (RECHARGE_EVENT_TYPES.includes(type)) return type;
  throw new AppError(422, '充值统计事件类型不正确', 'RECHARGE_EVENT_TYPE_INVALID');
}

function normalizeRechargePayMode(value: any): 'wechat_pay' | 'wechat_virtual' | 'auto' {
  const mode = String(value || '').trim();
  if (mode === 'wechat_virtual' || mode === 'auto') return mode;
  return 'wechat_pay';
}

function normalizeShortText(value: any, max: number) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : null;
}

function resolveAnalyticsDateRange(params: Record<string, any>) {
  const endDate = parseDateParam(params.endDate, endOfDay(new Date()));
  const defaultStart = new Date(endDate);
  defaultStart.setDate(defaultStart.getDate() - 6);
  const startDate = parseDateParam(params.startDate, startOfDay(defaultStart));
  return { startDate: startOfDay(startDate), endDate: endOfDay(endDate) };
}

function parseDateParam(value: any, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;
}

function generateOrderNo(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CZ${dateStr}${rand}`;
}

async function resolveWechatPayConfig(): Promise<ResolvedWechatPayConfig> {
  const dbConfig = await prisma.wechatPayConfig.findFirst();
  return {
    miniAppId: dbConfig?.miniAppId || config.wechat.miniProgram.appId || '',
    miniSecret: dbConfig?.miniSecret || config.wechat.miniProgram.secret || '',
    mchId: dbConfig?.mchId || config.wechat.pay.mchId || '',
    apiV3Key: dbConfig?.apiV3Key || config.wechat.pay.apiV3Key || '',
    serialNo: dbConfig?.serialNo || config.wechat.pay.serialNo || '',
    privateKeyPath: dbConfig?.privateKeyPath || config.wechat.pay.privateKeyPath || '',
    platformPublicKeyPath: dbConfig?.platformPublicKeyPath || config.wechat.pay.platformPublicKeyPath || '',
    notifyUrl: dbConfig?.notifyUrl || config.wechat.pay.notifyUrl || '',
    transferNotifyUrl: dbConfig?.transferNotifyUrl || config.wechat.pay.transferNotifyUrl || '',
  };
}

async function ensureWechatPayConfigured() {
  const pay = await resolveWechatPayConfig();
  const missing: string[] = [];
  if (isPlaceholder(pay.miniAppId)) missing.push('WECHAT_MINI_APPID');
  if (isPlaceholder(pay.mchId)) missing.push('WECHAT_PAY_MCHID');
  if (isPlaceholder(pay.serialNo)) missing.push('WECHAT_PAY_SERIAL_NO');
  if (isPlaceholder(pay.privateKeyPath) || !fs.existsSync(pay.privateKeyPath)) missing.push('WECHAT_PAY_PRIVATE_KEY_PATH');
  if (isPlaceholder(pay.apiV3Key) || pay.apiV3Key.length < 32) missing.push('WECHAT_PAY_APIV3_KEY');
  if (isPlaceholder(pay.notifyUrl)) missing.push('WECHAT_PAY_NOTIFY_URL');

  if (missing.length > 0) {
    throw new AppError(503, `微信支付未配置完整：${missing.join('、')}`, 'WECHAT_PAY_NOT_CONFIGURED');
  }
  return pay;
}

async function resolveWechatVirtualPayConfig(): Promise<ResolvedWechatVirtualPayConfig> {
  const dbConfig = await prisma.wechatPayConfig.findFirst();
  return {
    mode: normalizeRechargePayMode(dbConfig?.rechargePayMode || process.env.RECHARGE_PAY_MODE || 'wechat_pay'),
    offerId: dbConfig?.virtualOfferId || config.wechat.virtualPay.offerId || '',
    appKey: dbConfig?.virtualAppKey || config.wechat.virtualPay.appKey || '',
    sandboxAppKey: dbConfig?.virtualSandboxAppKey || config.wechat.virtualPay.sandboxAppKey || '',
    env: (dbConfig?.virtualEnv ?? Number(config.wechat.virtualPay.env || 0)) === 1 ? 1 : 0,
    productMap: parseVirtualProductMap(dbConfig?.virtualProductMap || config.wechat.virtualPay.productMap),
  };
}

async function ensureWechatVirtualPayConfigured() {
  const virtualPay = await resolveWechatVirtualPayConfig();
  const missing: string[] = [];
  if (isPlaceholder(virtualPay.offerId)) missing.push('WECHAT_VIRTUAL_PAY_OFFER_ID');
  if (isPlaceholder(getWechatVirtualPayAppKey(virtualPay))) {
    missing.push(virtualPay.env === 1 ? 'WECHAT_VIRTUAL_PAY_SANDBOX_APP_KEY' : 'WECHAT_VIRTUAL_PAY_APP_KEY');
  }

  if (missing.length > 0) {
    throw new AppError(503, `微信小程序虚拟支付未配置完整：${missing.join('、')}`, 'WECHAT_VIRTUAL_PAY_NOT_CONFIGURED');
  }
  return virtualPay;
}

async function resolveRechargePayMode(input: Record<string, any>) {
  const virtualPay = await resolveWechatVirtualPayConfig();
  if (virtualPay.mode === 'wechat_virtual') return 'wechat_virtual';
  if (virtualPay.mode === 'auto') {
    return isClientVirtualPayCapable(input) ? 'wechat_virtual' : 'wechat_pay';
  }
  return 'wechat_pay';
}

function getWechatVirtualPayAppKey(virtualPay: ResolvedWechatVirtualPayConfig) {
  return virtualPay.env === 1 ? virtualPay.sandboxAppKey : virtualPay.appKey;
}

function buildWechatVirtualPayParams(virtualPay: ResolvedWechatVirtualPayConfig, input: {
  sessionKey: string;
  orderNo: string;
  productId: string;
  goodsPrice: number;
}): WechatVirtualPayParams {
  const signData = JSON.stringify({
    offerId: virtualPay.offerId,
    buyQuantity: 1,
    env: virtualPay.env,
    currencyType: 'CNY',
    productId: resolveWechatVirtualProductId(virtualPay, input.productId),
    goodsPrice: input.goodsPrice,
    outTradeNo: input.orderNo,
    attach: JSON.stringify({ orderNo: input.orderNo, productId: input.productId }),
  });

  return {
    provider: 'wechat_virtual',
    mode: VIRTUAL_PAY_MODE,
    signData,
    paySig: calcWechatVirtualPaySig('requestVirtualPayment', signData, getWechatVirtualPayAppKey(virtualPay)),
    signature: calcWechatVirtualSignature(signData, input.sessionKey),
  };
}

async function syncWechatVirtualOrderStatus(orderNo: string) {
  const virtualPay = await resolveWechatVirtualPayConfig();
  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: { user: { select: { miniOpenId: true } } },
  });
  if (!order?.user?.miniOpenId) return;

  const response = await requestWechatVirtualPayApi('/xpay/query_order', {
    openid: order.user.miniOpenId,
    env: virtualPay.env,
    order_id: order.orderNo,
  }, {}, virtualPay).catch((err: any) => {
    logger.warn('虚拟支付查单失败: orderNo=%s message=%s', orderNo, err?.message || err);
    return null;
  });

  const virtualOrder = response?.order;
  if (!virtualOrder) return;

  if (isWechatVirtualOrderPaid(virtualOrder)) {
    await handlePaymentCallback(orderNo, getWechatVirtualTransactionId(virtualOrder, orderNo), {
      payChannel: 'wechat_virtual',
      virtualWxOrderId: virtualOrder.wx_order_id,
      virtualOrder,
    });
    await notifyWechatVirtualGoodsProvided(orderNo, virtualOrder.wx_order_id).catch((err: any) => {
      logger.warn('虚拟支付查单后通知已发货失败: orderNo=%s message=%s', orderNo, err?.message || err);
    });
    return;
  }

  if (Number(virtualOrder.status) === 5 || Number(virtualOrder.status) === 6 || Number(virtualOrder.status) === 8) {
    await prisma.order.updateMany({
      where: { orderNo, status: 'pending' },
      data: {
        status: 'failed',
        virtualWxOrderId: virtualOrder.wx_order_id || undefined,
        ...buildVirtualOrderUpdateData(virtualOrder, order),
      },
    });
    logger.warn('虚拟支付订单未成功: orderNo=%s status=%s', orderNo, virtualOrder.status);
  }
}

export async function syncWechatVirtualPaymentSettlements(options: Record<string, any> = {}) {
  const limit = Math.min(200, Math.max(1, parseInt(options.limit || '50', 10)));
  const days = Math.min(180, Math.max(1, parseInt(options.days || '90', 10)));
  const since = new Date();
  since.setDate(since.getDate() - days);

  const where: any = {
    payChannel: 'wechat_virtual',
    status: 'paid',
    createdAt: { gte: since },
    OR: [
      { virtualSettState: { not: 2 } },
      { virtualSettState: null },
      { virtualOrderType: null },
      { paymentDevice: 'unknown' },
    ],
  };

  if (options.orderNo) {
    where.orderNo = String(options.orderNo).trim();
    delete where.status;
    delete where.createdAt;
    delete where.OR;
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: { user: { select: { miniOpenId: true } } },
  });

  const result = {
    scanned: orders.length,
    synced: 0,
    settled: 0,
    ios: 0,
    android: 0,
    failed: 0,
    errors: [] as Array<{ orderNo: string; message: string }>,
    balance: null as any,
  };

  for (const order of orders) {
    try {
      const synced = await queryAndUpdateWechatVirtualOrder(order);
      if (!synced) continue;
      result.synced += 1;
      if (Number(synced.virtualSettState) === 2) result.settled += 1;
      if (synced.paymentDevice === 'ios') result.ios += 1;
      if (synced.paymentDevice === 'android') result.android += 1;
    } catch (err: any) {
      result.failed += 1;
      result.errors.push({ orderNo: order.orderNo, message: err?.message || String(err) });
      logger.warn('虚拟支付结算同步失败: orderNo=%s message=%s', order.orderNo, err?.message || err);
    }
  }

  result.balance = await syncWechatVirtualBizBalance().catch((err: any) => {
    result.errors.push({ orderNo: 'balance', message: err?.message || String(err) });
    logger.warn('虚拟支付余额同步失败: %s', err?.message || err);
    return null;
  });

  if (options.recordLastResult !== false) {
    await recordVirtualSettlementSyncResult(result).catch((err: any) => {
      logger.warn('虚拟支付自动同步结果记录失败: %s', err?.message || err);
    });
  }

  return result;
}

export async function getWechatVirtualSettlementOverview() {
  const [orders, latestBalance] = await Promise.all([
    prisma.order.findMany({
      where: { payChannel: 'wechat_virtual', status: 'paid' },
      orderBy: { paidAt: 'desc' },
      take: 5000,
    }),
    prisma.virtualPaymentBalanceSnapshot.findFirst({ orderBy: { createdAt: 'desc' } }),
  ]);
  const paidAmount = orders.reduce((sum, order) => sum + order.amount, 0);
  const settledOrders = orders.filter(order => Number(order.virtualSettState) === 2);
  const pendingOrders = orders.filter(order => Number(order.virtualSettState) !== 2);
  const platformFee = orders.reduce((sum, order) => sum + Number(order.virtualPlatformFee || 0), 0);
  const netAmount = orders.reduce((sum, order) => sum + Number(order.virtualNetAmount || 0), 0);
  return {
    totalOrders: orders.length,
    totalAmount: paidAmount,
    settledOrders: settledOrders.length,
    settledAmount: settledOrders.reduce((sum, order) => sum + order.amount, 0),
    pendingOrders: pendingOrders.length,
    pendingAmount: pendingOrders.reduce((sum, order) => sum + order.amount, 0),
    platformFee,
    netAmount,
    paymentDeviceBreakdown: summarizePaymentDevices(orders),
    settledDeviceBreakdown: summarizePaymentDevices(settledOrders),
    pendingDeviceBreakdown: summarizePaymentDevices(pendingOrders),
    latestBalance,
  };
}

async function queryAndUpdateWechatVirtualOrder(order: any) {
  const virtualPay = await resolveWechatVirtualPayConfig();
  if (!order?.user?.miniOpenId) return null;
  const response = await requestWechatVirtualPayApi('/xpay/query_order', {
    openid: order.user.miniOpenId,
    env: virtualPay.env,
    order_id: order.orderNo,
  }, {}, virtualPay);

  const virtualOrder = response?.order;
  if (!virtualOrder) return null;
  const data = buildVirtualOrderUpdateData(virtualOrder, order);
  const status = Number(virtualOrder.status);
  if (isWechatVirtualOrderPaid(virtualOrder) && order.status !== 'paid') {
    await handlePaymentCallback(order.orderNo, getWechatVirtualTransactionId(virtualOrder, order.orderNo), {
      payChannel: 'wechat_virtual',
      virtualWxOrderId: virtualOrder.wx_order_id,
      virtualOrder,
    });
    await notifyWechatVirtualGoodsProvided(order.orderNo, virtualOrder.wx_order_id).catch((err: any) => {
      logger.warn('虚拟支付结算同步后通知已发货失败: orderNo=%s message=%s', order.orderNo, err?.message || err);
    });
    return prisma.order.findUnique({ where: { id: order.id } });
  }
  if (status === 5 || status === 6 || status === 8) {
    data.status = order.status === 'paid' ? order.status : 'failed';
  }
  return prisma.order.update({
    where: { id: order.id },
    data,
  });
}

function isWechatVirtualOrderPaid(virtualOrder: any) {
  const status = Number(virtualOrder?.status);
  return status === 2 || status === 3 || status === 4;
}

function getWechatVirtualTransactionId(virtualOrder: any, fallback: string) {
  return virtualOrder?.wxpay_order_id
    || virtualOrder?.channel_order_id
    || virtualOrder?.wx_order_id
    || fallback;
}

async function syncWechatVirtualBizBalance() {
  const virtualPay = await resolveWechatVirtualPayConfig();
  const response = await requestWechatVirtualPayApi('/xpay/query_biz_balance', {
    env: virtualPay.env,
  }, {}, virtualPay);
  const balance = response?.balance_available || {};
  const amountFen = Math.round(Number(balance.amount || 0) * 100);
  return prisma.virtualPaymentBalanceSnapshot.create({
    data: {
      availableAmountFen: Number.isFinite(amountFen) ? amountFen : 0,
      currencyCode: String(balance.currency_code || 'CNY'),
      raw: JSON.stringify(response || {}),
    },
  });
}

function buildVirtualOrderUpdateData(virtualOrder: any, currentOrder?: any) {
  if (!virtualOrder) return {};
  const orderType = toOptionalNumber(virtualOrder.order_type);
  const settState = toOptionalNumber(virtualOrder.sett_state);
  const platformFee = toOptionalNumber(virtualOrder.platform_fee_fen);
  const cpsFee = toOptionalNumber(virtualOrder.cps_fee_fen);
  const paidFee = toOptionalNumber(virtualOrder.paid_fee);
  const orderFee = toOptionalNumber(virtualOrder.order_fee);
  const baseAmount = paidFee ?? orderFee ?? Number(currentOrder?.amount || 0);
  const totalFee = Number(platformFee || 0) + Number(cpsFee || 0);
  const data: Record<string, any> = {
    payChannel: 'wechat_virtual',
    virtualSyncedAt: new Date(),
  };
  const wxOrderId = virtualOrder.wx_order_id || virtualOrder.wxOrderId;
  if (wxOrderId) data.virtualWxOrderId = String(wxOrderId);
  if (orderType !== undefined) {
    data.virtualOrderType = orderType;
    const device = paymentDeviceFromVirtualOrderType(orderType);
    if (device !== 'unknown') data.paymentDevice = device;
  } else if (!currentOrder?.paymentDevice || currentOrder.paymentDevice === 'unknown') {
    data.paymentDevice = currentOrder?.payChannel === 'wechat_virtual' ? 'android' : 'unknown';
  }
  if (settState !== undefined) data.virtualSettState = settState;
  const settTime = toOptionalNumber(virtualOrder.sett_time);
  if (settTime && settTime > 0) data.virtualSettTime = new Date(settTime * 1000);
  if (platformFee !== undefined) data.virtualPlatformFee = platformFee;
  if (cpsFee !== undefined) data.virtualCpsFee = cpsFee;
  if (settState === 2 || platformFee !== undefined || cpsFee !== undefined) {
    data.virtualNetAmount = Math.max(0, Number(baseAmount || 0) - totalFee);
  }
  return data;
}

function toOptionalNumber(value: any) {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

async function recordVirtualSettlementSyncResult(result: any) {
  const current = await prisma.wechatPayConfig.findFirst();
  const payload = JSON.stringify({
    scanned: result.scanned || 0,
    synced: result.synced || 0,
    settled: result.settled || 0,
    ios: result.ios || 0,
    android: result.android || 0,
    failed: result.failed || 0,
    errors: Array.isArray(result.errors) ? result.errors.slice(0, 10) : [],
    balanceId: result.balance?.id || null,
  });
  const data = {
    virtualSettlementLastSyncedAt: new Date(),
    virtualSettlementLastResult: payload,
  };
  if (current) {
    await prisma.wechatPayConfig.update({ where: { id: current.id }, data });
  } else {
    await prisma.wechatPayConfig.create({
      data: {
        rechargePayMode: 'wechat_pay',
        virtualEnv: 0,
        ...data,
      },
    });
  }
}

async function notifyWechatVirtualGoodsProvided(orderNo: string, wxOrderId?: string) {
  const virtualPay = await resolveWechatVirtualPayConfig();
  const env = virtualPay.env;
  const body: Record<string, any> = { order_id: orderNo, env };
  if (wxOrderId) body.wx_order_id = wxOrderId;
  await requestWechatVirtualPayApi('/xpay/notify_provide_goods', body, {}, virtualPay);
}

async function requestWechatVirtualPayApi(pathname: string, body: Record<string, any>, options: { needPaySig?: boolean } = {}, virtualPay?: ResolvedWechatVirtualPayConfig) {
  const cfg = virtualPay || await ensureWechatVirtualPayConfigured();
  const bodyText = JSON.stringify(body);
  const paySig = options.needPaySig === false
    ? ''
    : calcWechatVirtualPaySig(pathname, bodyText, getWechatVirtualPayAppKey(cfg));
  let data = await postWechatVirtualPayApi(pathname, bodyText, paySig, await getMiniProgramAccessTokenForPayment());
  if (isWechatAccessTokenInvalid(data)) {
    miniProgramAccessTokenCache = null;
    data = await postWechatVirtualPayApi(pathname, bodyText, paySig, await getMiniProgramAccessTokenForPayment(true));
  }
  if (data?.errcode) {
    throw new AppError(502, `微信虚拟支付接口失败：${data.errmsg || data.errcode}`, 'WECHAT_VIRTUAL_PAY_API_FAILED', data);
  }
  return data;
}

async function postWechatVirtualPayApi(pathname: string, bodyText: string, paySig: string, accessToken: string) {
  const url = `https://api.weixin.qq.com${pathname}`;
  const params: Record<string, string> = { access_token: accessToken };
  if (paySig) params.pay_sig = paySig;

  const { data } = await axios.post(url, bodyText, {
    params,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
  });
  return data;
}

async function getMiniProgramAccessTokenForPayment(forceRefresh = false) {
  const payConfig = await resolveWechatPayConfig();
  const appId = payConfig.miniAppId;
  const secret = payConfig.miniSecret;
  if (isPlaceholder(appId) || isPlaceholder(secret)) {
    throw new AppError(503, '微信小程序登录未配置：WECHAT_MINI_APPID、WECHAT_MINI_SECRET', 'WECHAT_MINI_NOT_CONFIGURED');
  }

  const now = Date.now();
  if (!forceRefresh && miniProgramAccessTokenCache && miniProgramAccessTokenCache.expiresAt > now + 60_000) {
    return miniProgramAccessTokenCache.token;
  }

  const { data } = await axios.post(
    'https://api.weixin.qq.com/cgi-bin/stable_token',
    { grant_type: 'client_credential', appid: appId, secret, force_refresh: forceRefresh },
    { timeout: 10000 },
  );
  if (data.errcode) {
    throw new AppError(400, `微信 access_token 获取失败: ${data.errmsg}`, 'WECHAT_ACCESS_TOKEN_FAIL');
  }

  miniProgramAccessTokenCache = {
    token: data.access_token,
    expiresAt: now + Math.max(0, Number(data.expires_in || 7200) - 300) * 1000,
  };
  return miniProgramAccessTokenCache.token;
}

function calcWechatVirtualPaySig(uri: string, bodyText: string, appKey: string) {
  return crypto.createHmac('sha256', appKey).update(`${uri}&${bodyText}`).digest('hex');
}

function calcWechatVirtualSignature(bodyText: string, sessionKey: string) {
  return crypto.createHmac('sha256', sessionKey).update(bodyText).digest('hex');
}

function parseVirtualProductMap(value?: string) {
  const text = String(value || '').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).map(([key, val]) => [key, String(val)]));
    }
  } catch (_err) {
    // Fall through to comma syntax below.
  }
  return Object.fromEntries(text.split(',').map(pair => {
    const [key, val] = pair.split(':').map(part => part?.trim());
    return key && val ? [key, val] : null;
  }).filter(Boolean) as Array<[string, string]>);
}

function resolveWechatVirtualProductId(virtualPay: ResolvedWechatVirtualPayConfig, productId: string) {
  return virtualPay.productMap[productId] || productId;
}

function resolveInitialPaymentDevice(payMode: string, input: Record<string, any>) {
  if (payMode === 'wechat_pay') return 'wechat_pay';
  const platform = String(input.clientPlatform || input.platform || input.system || '').toLowerCase();
  if (platform.includes('ios') || platform.includes('iphone') || platform.includes('ipad')) return 'ios';
  if (payMode === 'wechat_virtual') return 'android';
  return 'unknown';
}

function isClientVirtualPayCapable(input: Record<string, any>) {
  return input.supportsVirtualPay === true || input.supportsVirtualPay === 'true';
}

function buildVirtualPaymentCallbackUrl(notifyUrl?: string | null) {
  const text = String(notifyUrl || '').trim();
  if (!text) return '';
  return text.includes('/payments/callback')
    ? text.replace('/payments/callback', '/payments/virtual-callback')
    : text.replace(/\/$/, '') + '/virtual-callback';
}

async function createWechatJsapiPrepay(payConfig: ResolvedWechatPayConfig, input: {
  openId: string;
  orderNo: string;
  amount: number;
  description: string;
}): Promise<WechatPayParams> {
  const requestPath = '/v3/pay/transactions/jsapi';
  const url = `https://api.mch.weixin.qq.com${requestPath}`;
  const body = {
    appid: payConfig.miniAppId,
    mchid: payConfig.mchId,
    description: input.description.slice(0, 127),
    out_trade_no: input.orderNo,
    notify_url: payConfig.notifyUrl,
    amount: { total: input.amount, currency: 'CNY' },
    payer: { openid: input.openId },
  };
  const bodyText = JSON.stringify(body);
  const authorization = buildWechatPayAuthorization(payConfig, 'POST', requestPath, bodyText);

  let data: any;
  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    data = response.data;
  } catch (err: any) {
    const detail = err?.response?.data;
    const message = detail?.message || detail?.code || err?.message || '微信支付下单失败';
    logger.error('微信支付下单失败: %s %j', message, detail || {});
    throw new AppError(502, `微信支付下单失败：${message}`, 'WECHAT_PAY_PREPAY_FAILED', detail);
  }

  if (!data?.prepay_id) {
    throw new AppError(502, '微信支付下单失败：未返回 prepay_id', 'WECHAT_PAY_PREPAY_FAILED', data);
  }

  return buildMiniProgramPayParams(payConfig, data.prepay_id);
}

async function syncWechatOrderStatus(orderNo: string) {
  const payConfig = await resolveWechatPayConfig();
  if (isPlaceholder(payConfig.mchId) || isPlaceholder(payConfig.privateKeyPath) || isPlaceholder(payConfig.serialNo)) {
    return;
  }

  const requestPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}?mchid=${encodeURIComponent(payConfig.mchId)}`;
  const url = `https://api.mch.weixin.qq.com${requestPath}`;
  const authorization = buildWechatPayAuthorization(payConfig, 'GET', requestPath, '');

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
      },
      timeout: 8000,
    });
    const data = response.data;

    if (data?.trade_state === 'SUCCESS') {
      await handlePaymentCallback(orderNo, data.transaction_id || '');
      return;
    }

    if (data?.trade_state === 'CLOSED' || data?.trade_state === 'REVOKED' || data?.trade_state === 'PAYERROR') {
      await prisma.order.updateMany({
        where: { orderNo, status: 'pending' },
        data: { status: 'failed' },
      });
      logger.warn('微信支付订单未成功: orderNo=%s, state=%s, desc=%s', orderNo, data.trade_state, data.trade_state_desc || '');
    }
  } catch (err: any) {
    const detail = err?.response?.data;
    if (detail?.code === 'RESOURCE_NOT_EXISTS') {
      logger.warn('微信支付查单未找到: orderNo=%s', orderNo);
      return;
    }
    logger.warn('微信支付查单失败: orderNo=%s, message=%s, detail=%j',
      orderNo,
      detail?.message || err?.message || 'unknown',
      detail || {});
  }
}

function buildWechatPayAuthorization(payConfig: ResolvedWechatPayConfig, method: string, requestPath: string, bodyText: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const message = `${method}\n${requestPath}\n${timestamp}\n${nonceStr}\n${bodyText}\n`;
  const signature = signWithMerchantKey(payConfig, message);

  return `WECHATPAY2-SHA256-RSA2048 ${[
    `mchid="${payConfig.mchId}"`,
    `nonce_str="${nonceStr}"`,
    `signature="${signature}"`,
    `timestamp="${timestamp}"`,
    `serial_no="${payConfig.serialNo}"`,
  ].join(',')}`;
}


function buildMiniProgramPayParams(payConfig: ResolvedWechatPayConfig, prepayId: string): WechatPayParams {
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const packageValue = `prepay_id=${prepayId}`;
  const paySign = signWithMerchantKey(payConfig, `${payConfig.miniAppId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`);

  return {
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: 'RSA',
    paySign,
  };
}

function signWithMerchantKey(payConfig: ResolvedWechatPayConfig, message: string) {
  try {
    const privateKey = fs.readFileSync(payConfig.privateKeyPath, 'utf8');
    return crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64');
  } catch (err: any) {
    throw new AppError(503, `微信支付商户私钥不可用：${err.message}`, 'WECHAT_PAY_PRIVATE_KEY_INVALID');
  }
}

function decryptWechatPayResource(payConfig: ResolvedWechatPayConfig, resource: Record<string, string>) {
  const apiV3Key = Buffer.from(payConfig.apiV3Key, 'utf8');
  const encrypted = Buffer.from(resource.ciphertext, 'base64');
  const authTag = encrypted.subarray(encrypted.length - 16);
  const data = encrypted.subarray(0, encrypted.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', apiV3Key, Buffer.from(resource.nonce, 'utf8'));

  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
  }
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted);
}

function verifyWechatPayNotifySignature(payConfig: ResolvedWechatPayConfig, headers?: Record<string, any>, rawBody?: string) {
  if (config.server.isDev && !rawBody) return;

  const signature = getHeader(headers, 'wechatpay-signature');
  const timestamp = getHeader(headers, 'wechatpay-timestamp');
  const nonce = getHeader(headers, 'wechatpay-nonce');
  const serial = getHeader(headers, 'wechatpay-serial');

  if (!signature || !timestamp || !nonce || !serial || !rawBody) {
    throw new AppError(401, '微信支付回调签名头不完整', 'WECHAT_PAY_SIGNATURE_MISSING');
  }

  const publicKeyPath = payConfig.platformPublicKeyPath;
  if (isPlaceholder(publicKeyPath) || !fs.existsSync(publicKeyPath)) {
    throw new AppError(503, '微信支付平台公钥未配置，无法校验回调签名', 'WECHAT_PAY_PLATFORM_KEY_NOT_CONFIGURED');
  }

  const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
  const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(message), publicKey, Buffer.from(signature, 'base64'));
  if (!ok) {
    throw new AppError(401, '微信支付回调签名校验失败', 'WECHAT_PAY_SIGNATURE_INVALID');
  }

  logger.info('微信支付回调签名校验通过: serial=%s, timestamp=%s', serial, timestamp);
}

function getHeader(headers: Record<string, any> | undefined, name: string) {
  if (!headers) return '';
  const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key]) : '';
}

function normalizeVirtualNotifyValue(value: any): string {
  if (Array.isArray(value)) return normalizeVirtualNotifyValue(value[0]);
  if (value && typeof value === 'object' && '_' in value) return normalizeVirtualNotifyValue(value._);
  return value === undefined || value === null ? '' : String(value);
}

function normalizeVirtualNotifyObject(value: any): Record<string, any> {
  if (Array.isArray(value)) return normalizeVirtualNotifyObject(value[0]);
  return value && typeof value === 'object' ? value : {};
}

function getVirtualNotifyString(source: Record<string, any> | undefined, key: string) {
  return normalizeVirtualNotifyValue(getVirtualNotifyValue(source, key));
}

function getVirtualNotifyObject(source: Record<string, any> | undefined, key: string) {
  return normalizeVirtualNotifyObject(getVirtualNotifyValue(source, key));
}

function getVirtualNotifyValue(source: Record<string, any> | undefined, key: string) {
  if (!source || typeof source !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];

  const normalizedKey = normalizeVirtualNotifyKey(key);
  const matchedKey = Object.keys(source).find(candidate => normalizeVirtualNotifyKey(candidate) === normalizedKey);
  return matchedKey ? source[matchedKey] : undefined;
}

function normalizeVirtualNotifyKey(key: string) {
  return key.replace(/_/g, '').toLowerCase();
}

function isWechatAccessTokenInvalid(data: any) {
  return [40001, 40014, 42001].includes(Number(data?.errcode));
}

function isPlaceholder(value?: string) {
  if (!value) return true;
  return /^(wx_.*|your_.*|\/path\/to\/.*)$/i.test(value);
}

function normalizeConfigValue(value: any) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function clampInteger(value: any, min: number, max: number, fallback: number) {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function buildVirtualSettlementSyncSettings(dbConfig?: any): VirtualSettlementSyncSettings {
  return {
    enabled: dbConfig?.virtualSettlementSyncEnabled !== false,
    intervalHours: clampInteger(dbConfig?.virtualSettlementSyncIntervalHours, 1, 168, 6),
    days: clampInteger(dbConfig?.virtualSettlementSyncDays, 1, 180, 120),
    limit: clampInteger(dbConfig?.virtualSettlementSyncLimit, 1, 200, 30),
    lastSyncedAt: dbConfig?.virtualSettlementLastSyncedAt || null,
    lastResult: parseJsonObject(dbConfig?.virtualSettlementLastResult),
  };
}

function parseJsonObject(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_err) {
    return null;
  }
}

function normalizeSecretInput(value: any, current?: string | null) {
  if (typeof value !== 'string' || !value.trim() || value.includes('***')) {
    return current || null;
  }
  return value.trim();
}

function maskSecret(value?: string | null) {
  if (!value) return '';
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}********${value.slice(-4)}`;
}
