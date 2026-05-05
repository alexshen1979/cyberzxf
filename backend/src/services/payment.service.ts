import { prisma } from '../utils/prisma';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { chargePoints } from './points.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('payment');

// 充值套餐定义
const PRODUCTS = [
  { id: 'pkg_50',  name: '50 咨询点数',  price: 9.9  * 100, points: 50,  bonus: 0  },
  { id: 'pkg_120', name: '110 咨询点数 + 赠10点', price: 19.9 * 100, points: 110, bonus: 10 },
  { id: 'pkg_200', name: '180 咨询点数 + 赠20点', price: 29.9 * 100, points: 180, bonus: 20 },
  { id: 'pkg_360', name: '320 咨询点数 + 赠40点', price: 49.9 * 100, points: 320, bonus: 40 },
];

export function getProductList() {
  return PRODUCTS.map(({ id, name, price, points, bonus }) => ({
    id,
    name,
    price: price / 100,   // 转换为元
    points,
    bonus,
  }));
}

export function getProductById(id: string) {
  return PRODUCTS.find(p => p.id === id) || null;
}

// 创建预支付订单
export async function createOrder(userId: string, productId: string) {
  const product = getProductById(productId);
  if (!product) {
    throw new AppError(404, '充值套餐不存在', 'PRODUCT_NOT_FOUND');
  }

  const orderNo = generateOrderNo();
  const order = await prisma.order.create({
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

  return { orderNo: order.orderNo, amount: product.price, productName: product.name };
}

// 支付成功回调处理
export async function handlePaymentCallback(orderNo: string, transactionId: string) {
  const order = await prisma.order.findUnique({ where: { orderNo } });
  if (!order) {
    throw new AppError(404, `订单不存在: ${orderNo}`, 'ORDER_NOT_FOUND');
  }

  if (order.status === 'paid') {
    logger.warn('重复支付回调: %s', orderNo);
    return; // 幂等处理
  }

  if (order.status !== 'pending') {
    throw new AppError(409, `订单状态异常: ${order.status}`, 'ORDER_STATUS_ERROR');
  }

  // 更新订单状态
  await prisma.order.update({
    where: { orderNo },
    data: { status: 'paid', paidAt: new Date() },
  });

  // 充值到账
  await chargePoints(order.userId, order.points, order.bonusPoints, order.id);

  logger.info('支付成功: orderNo=%s, userId=%s, points=%d(+%d)',
    orderNo, order.userId, order.points, order.bonusPoints);
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

function generateOrderNo(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CZ${dateStr}${rand}`;
}
