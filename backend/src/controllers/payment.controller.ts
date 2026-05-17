import { Context } from 'koa';
import {
  getProductList,
  getWechatPayConfigStatus,
  getWechatPayConfigForAdmin,
  updateWechatPayConfig,
  createOrder as svcCreateOrder,
  handlePaymentCallback,
  handleWechatPayNotify,
  getUserOrders,
  getUserOrderDetail,
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
  const { productId } = ctx.request.body as Record<string, any>;

  if (!productId) {
    ctx.status = 422;
    ctx.body = { success: false, message: '请选择充值套餐' };
    return;
  }

  const order = await svcCreateOrder(userId, productId);
  ctx.body = { success: true, data: order };
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
