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

const logger = createLogger('payment');
const RECHARGE_EVENT_TYPES = ['page_view', 'pay_click', 'order_created', 'payment_success'];

interface WechatPayParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
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
  const checks = [
    { key: 'WECHAT_MINI_APPID', ok: !isPlaceholder(cfg.miniAppId), required: true },
    { key: 'WECHAT_MINI_SECRET', ok: !isPlaceholder(cfg.miniSecret), required: true },
    { key: 'WECHAT_PAY_MCHID', ok: !isPlaceholder(cfg.mchId), required: true },
    { key: 'WECHAT_PAY_SERIAL_NO', ok: !isPlaceholder(cfg.serialNo), required: true },
    { key: 'WECHAT_PAY_PRIVATE_KEY_PATH', ok: !isPlaceholder(cfg.privateKeyPath) && fs.existsSync(cfg.privateKeyPath), required: true },
    { key: 'WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH', ok: !isPlaceholder(cfg.platformPublicKeyPath) && fs.existsSync(cfg.platformPublicKeyPath), required: true },
    { key: 'WECHAT_PAY_APIV3_KEY', ok: !isPlaceholder(cfg.apiV3Key) && cfg.apiV3Key.length >= 32, required: true },
    { key: 'WECHAT_PAY_NOTIFY_URL', ok: !isPlaceholder(cfg.notifyUrl), required: true },
  ];
  const missing = checks.filter(item => item.required && !item.ok).map(item => item.key);
  return {
    ready: missing.length === 0,
    missing,
    checks,
  };
}

export async function getWechatPayConfigForAdmin() {
  const dbConfig = await prisma.wechatPayConfig.findFirst();
  const cfg = await resolveWechatPayConfig();
  const status = await getWechatPayConfigStatus();
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
    source: dbConfig ? 'database' : 'env',
    status,
  };
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

  const payConfig = await ensureWechatPayConfigured();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { miniOpenId: true },
  });
  if (!user?.miniOpenId) {
    throw new AppError(422, '请先完成微信小程序登录后再支付', 'WECHAT_OPENID_REQUIRED');
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

  const payParams = await createWechatJsapiPrepay(payConfig, {
    openId: user.miniOpenId,
    orderNo: order.orderNo,
    amount: product.price,
    description: product.name,
  });

  return {
    orderNo: order.orderNo,
    amount: product.price,
    productName: product.name,
    payParams,
  };
}

// 支付成功回调处理
export async function handlePaymentCallback(orderNo: string, transactionId: string) {
  const order = await prisma.order.findUnique({ where: { orderNo } });
  if (!order) {
    throw new AppError(404, `订单不存在: ${orderNo}`, 'ORDER_NOT_FOUND');
  }

  if (order.status === 'paid') {
    logger.warn('重复支付回调: %s', orderNo);
    await settleDistributionCommissionForOrder(order.id);
    return; // 幂等处理
  }

  if (order.status !== 'pending') {
    throw new AppError(409, `订单状态异常: ${order.status}`, 'ORDER_STATUS_ERROR');
  }

  // 更新订单状态
  await prisma.order.update({
    where: { orderNo },
    data: { status: 'paid', transactionId, paidAt: new Date() },
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
    await syncWechatOrderStatus(order.orderNo);
    order = await prisma.order.findFirst({
      where: { userId, orderNo },
    });
  }

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

  return { totalRevenue, totalOrders, avgOrderValue };
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

function isPlaceholder(value?: string) {
  if (!value) return true;
  return /^(wx_.*|your_.*|\/path\/to\/.*)$/i.test(value);
}

function normalizeConfigValue(value: any) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
