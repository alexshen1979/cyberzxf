import { Context } from 'koa';
import { parseStringPromise } from 'xml2js';
import {
  getProductList,
  getWechatPayConfigStatus,
  getWechatPayConfigForAdmin,
  updateWechatPayConfig,
  createOrder as svcCreateOrder,
  getRechargeAnalyticsForAdmin,
  getWechatVirtualSettlementOverview,
  getWechatVirtualSettlementSyncSettings,
  handlePaymentCallback,
  handleWechatPayNotify,
  handleWechatVirtualPayNotify,
  getUserOrders,
  getUserOrderDetail,
  recordRechargeEvent,
  syncPaymentOrderStatusForAdmin,
  syncWechatVirtualPaymentSettlements,
  updateWechatVirtualSettlementSyncSettings,
  verifyWechatVirtualPayPushSignature,
} from '../services/payment.service';
import { config } from '../config';

export async function getProducts(ctx: Context) {
  const products = await getProductList();
  ctx.body = { success: true, data: products };
}

export async function getConfigStatus(ctx: Context) {
  ctx.body = { success: true, data: await getWechatPayConfigStatus() };
}

export async function getAdminPaymentConfig(ctx: Context) {
  ctx.body = { success: true, data: await getWechatPayConfigForAdmin() };
}

export async function updateAdminPaymentConfig(ctx: Context) {
  const result = await updateWechatPayConfig(ctx.request.body as Record<string, any>);
  ctx.body = { success: true, data: result };
}

export async function createOrder(ctx: Context) {
  const userId = ctx.state.user.userId;
  const { productId, sessionId, channel, source, supportsVirtualPay, clientVersion, clientPlatform, system } = ctx.request.body as Record<string, any>;

  if (!productId) {
    ctx.status = 422;
    ctx.body = { success: false, message: '请选择充值套餐' };
    return;
  }

  const order = await svcCreateOrder(userId, productId, { sessionId, channel, source, supportsVirtualPay, clientVersion, clientPlatform, system });
  ctx.body = { success: true, data: order };
}

export async function recordRechargeAnalytics(ctx: Context) {
  const userId = ctx.state.user?.userId || null;
  const { eventType, productId, orderId, amount, sessionId, channel, source } = ctx.request.body as Record<string, any>;
  await recordRechargeEvent(userId, eventType, { productId, orderId, amount, sessionId, channel, source });
  ctx.body = { success: true, data: { recorded: true } };
}

export async function adminRechargeAnalytics(ctx: Context) {
  ctx.body = { success: true, data: await getRechargeAnalyticsForAdmin(ctx.query as Record<string, any>) };
}

export async function adminVirtualSettlementOverview(ctx: Context) {
  ctx.body = { success: true, data: await getWechatVirtualSettlementOverview() };
}

export async function adminSyncVirtualSettlements(ctx: Context) {
  const input = Object.assign({}, ctx.query || {}, ctx.request.body || {});
  ctx.body = { success: true, data: await syncWechatVirtualPaymentSettlements(input as Record<string, any>) };
}

export async function adminSyncPaymentOrder(ctx: Context) {
  const input = Object.assign({}, ctx.params || {}, ctx.request.body || {});
  ctx.body = { success: true, data: await syncPaymentOrderStatusForAdmin(String(input.orderNo || '')) };
}

export async function adminVirtualSettlementSyncSettings(ctx: Context) {
  ctx.body = { success: true, data: await getWechatVirtualSettlementSyncSettings() };
}

export async function adminUpdateVirtualSettlementSyncSettings(ctx: Context) {
  ctx.body = { success: true, data: await updateWechatVirtualSettlementSyncSettings(ctx.request.body as Record<string, any>) };
}

export async function paymentCallback(ctx: Context) {
  const body = ctx.request.body as Record<string, any>;

  // 仅开发环境保留本地调试入口，生产环境只接受微信支付 V3 通知结构。
  if (config.server.isDev && body?.orderNo) {
    await handlePaymentCallback(body.orderNo, body.transactionId || `dev-${Date.now()}`);
    ctx.body = { code: 'SUCCESS', message: 'OK' };
    return;
  }

  await handleWechatPayNotify(body, ctx.headers, (ctx.request as any).rawBody);
  ctx.body = { code: 'SUCCESS', message: 'OK' };
}

export async function verifyVirtualPaymentCallback(ctx: Context) {
  const { signature, timestamp, nonce, echostr } = ctx.query;

  if (verifyWechatVirtualPayPushSignature({
    signature: signature as string,
    timestamp: timestamp as string,
    nonce: nonce as string,
  })) {
    ctx.body = echostr || '';
    return;
  }

  ctx.status = 403;
  ctx.body = '签名验证失败';
}

export async function virtualPaymentCallback(ctx: Context) {
  const body = await normalizeWechatCallbackBody((ctx.request as any).rawBody || ctx.request.body);

  if (config.server.isDev && body?.orderNo) {
    await handlePaymentCallback(body.orderNo, body.transactionId || `virtual-dev-${Date.now()}`, {
      payChannel: 'wechat_virtual',
      virtualWxOrderId: body.virtualWxOrderId,
    });
    ctx.body = 'success';
    return;
  }

  await handleWechatVirtualPayNotify(body);
  ctx.body = 'success';
}

export async function getOrders(ctx: Context) {
  const userId = ctx.state.user.userId;
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);

  const result = await getUserOrders(userId, page, pageSize);
  ctx.body = { success: true, data: result };
}

export async function getOrderDetail(ctx: Context) {
  const userId = ctx.state.user.userId;
  const orderNo = ctx.params.orderNo;
  const result = await getUserOrderDetail(userId, orderNo);
  ctx.body = { success: true, data: result };
}

async function normalizeWechatCallbackBody(body: any) {
  if (typeof body === 'string' && body.trim().startsWith('<')) {
    const parsed = await parseStringPromise(body);
    return flattenXmlObject(parsed.xml || parsed);
  }
  if (typeof body === 'string') {
    const text = body.trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      return flattenXmlObject(JSON.parse(text));
    }
  }
  if (body?.xml) return flattenXmlObject(body.xml);
  return flattenXmlObject(body || {});
}

function flattenXmlObject(input: any): any {
  if (Array.isArray(input)) return flattenXmlObject(input[0]);
  if (!input || typeof input !== 'object') return input;
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, flattenXmlObject(value)]));
}
