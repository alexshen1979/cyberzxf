import { Context } from 'koa';
import {
  getProductList,
  createOrder,
  handlePaymentCallback,
  getUserOrders,
} from '../services/payment.service';

export async function getProducts(ctx: Context) {
  const products = getProductList();
  ctx.body = { success: true, data: products };
}

export async function createOrder(ctx: Context) {
  const userId = ctx.state.user.userId;
  const { productId } = ctx.request.body as any;

  if (!productId) {
    ctx.status = 422;
    ctx.body = { success: false, message: '请选择充值套餐' };
    return;
  }

  const order = await createOrder(userId, productId);
  ctx.body = { success: true, data: order };
}

export async function paymentCallback(ctx: Context) {
  // TODO: 验签 + 解密微信支付回调数据
  const { orderNo, transactionId } = ctx.request.body as any;

  await handlePaymentCallback(orderNo, transactionId);
  ctx.body = { code: 'SUCCESS', message: 'OK' };
}

export async function getOrders(ctx: Context) {
  const userId = ctx.state.user.userId;
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);

  const result = await getUserOrders(userId, page, pageSize);
  ctx.body = { success: true, data: result };
}
