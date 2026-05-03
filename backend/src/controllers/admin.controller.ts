import { Context } from 'koa';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { signToken } from '../middleware/auth';
import { syncMenu as syncWechatMenuService } from '../services/wechat.service';
import { getBalance } from '../services/points.service';
import { getRevenueStats } from '../services/payment.service';

// ─── 管理员登录 ─────────────────────────────────────

export async function adminLogin(ctx: Context) {
  const { username, password } = ctx.request.body as any;

  const admin = await prisma.admin.findUnique({ where: { username } });
  if (!admin || admin.status === 0) {
    ctx.status = 401;
    ctx.body = { success: false, message: '账号不存在或已禁用' };
    return;
  }

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    ctx.status = 401;
    ctx.body = { success: false, message: '密码错误' };
    return;
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLogin: new Date() },
  });

  const token = signToken({ userId: admin.id, role: admin.role });
  ctx.body = { success: true, data: { token, username: admin.username, role: admin.role } };
}

export async function createAdmin(ctx: Context) {
  const { username, password, role } = ctx.request.body as any;
  const hashed = await bcrypt.hash(password, 10);
  const admin = await prisma.admin.create({
    data: { username, password: hashed, role },
  });
  ctx.body = { success: true, data: { id: admin.id, username: admin.username, role: admin.role } };
}

// ─── 用户管理 ───────────────────────────────────────

export async function getUsers(ctx: Context) {
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);
  const keyword = ctx.query.keyword as string;

  const where: any = {};
  if (keyword) {
    where.OR = [
      { nickname: { contains: keyword } },
      { mpOpenId: { contains: keyword } },
      { miniOpenId: { contains: keyword } },
    ];
  }

  const [list, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { pointsAccount: { select: { balance: true, frozen: true, expiredAt: true } } },
    }),
    prisma.user.count({ where }),
  ]);

  ctx.body = { success: true, data: { list, total, page, pageSize } };
}

export async function getUserDetail(ctx: Context) {
  const user = await prisma.user.findUnique({
    where: { id: ctx.params.id },
    include: {
      pointsAccount: true,
      orders: { orderBy: { createdAt: 'desc' }, take: 10 },
      consultationRecords: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });

  if (!user) {
    ctx.status = 404;
    ctx.body = { success: false, message: '用户不存在' };
    return;
  }

  ctx.body = { success: true, data: user };
}

export async function updateUser(ctx: Context) {
  const { nickname, phone, status } = ctx.request.body as any;
  const user = await prisma.user.update({
    where: { id: ctx.params.id },
    data: { nickname, phone, status },
  });
  ctx.body = { success: true, data: user };
}

// ─── 点数管理 ───────────────────────────────────────

export async function getUserPoints(ctx: Context) {
  const balance = await getBalance(ctx.params.userId);
  ctx.body = { success: true, data: balance };
}

export async function adjustPoints(ctx: Context) {
  const { userId, amount, remark } = ctx.request.body as any;

  await prisma.$transaction(async (tx) => {
    const account = await tx.pointsAccount.findUnique({ where: { userId } });
    if (!account) throw new Error('用户点数账户不存在');

    const updated = await tx.pointsAccount.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });

    await tx.pointsTransaction.create({
      data: {
        userId,
        type: amount > 0 ? 'gift' : 'consume',
        amount,
        balanceAfter: updated.balance,
        source: 'admin',
        remark: remark || `管理员手动${amount > 0 ? '增加' : '扣减'}`,
      },
    });
  });

  ctx.body = { success: true, message: '调整成功' };
}

// ─── 订单管理 ───────────────────────────────────────

export async function getAllOrders(ctx: Context) {
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);
  const status = ctx.query.status as string;

  const where: any = {};
  if (status) where.status = status;

  const [list, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  ctx.body = { success: true, data: { list, total, page, pageSize } };
}

export async function getOrderDetail(ctx: Context) {
  const order = await prisma.order.findUnique({ where: { id: ctx.params.id } });
  ctx.body = { success: true, data: order };
}

// ─── 公告管理 ───────────────────────────────────────

export async function getNotices(ctx: Context) {
  const notices = await prisma.systemNotice.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, title: true, content: true, type: true, publishedAt: true },
  });
  ctx.body = { success: true, data: notices };
}

export async function adminGetNotices(ctx: Context) {
  const notices = await prisma.systemNotice.findMany({
    orderBy: { createdAt: 'desc' },
  });
  ctx.body = { success: true, data: notices };
}

export async function createNotice(ctx: Context) {
  const { title, content, type } = ctx.request.body as any;
  const notice = await prisma.systemNotice.create({
    data: { title, content, type: type || 'notice', status: 'published', publishedAt: new Date() },
  });
  ctx.body = { success: true, data: notice };
}

export async function updateNotice(ctx: Context) {
  const { title, content, type, status } = ctx.request.body as any;
  const data: any = { title, content, type, status };
  if (status === 'published') data.publishedAt = new Date();
  const notice = await prisma.systemNotice.update({
    where: { id: ctx.params.id },
    data,
  });
  ctx.body = { success: true, data: notice };
}

export async function deleteNotice(ctx: Context) {
  await prisma.systemNotice.delete({ where: { id: ctx.params.id } });
  ctx.body = { success: true, message: '删除成功' };
}

// ─── 快捷提问管理 ──────────────────────────────────

export async function getQuickQuestions(ctx: Context) {
  const questions = await prisma.quickQuestion.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  ctx.body = { success: true, data: questions };
}

export async function createQuickQuestion(ctx: Context) {
  const { question, category, sortOrder } = ctx.request.body as any;
  const q = await prisma.quickQuestion.create({
    data: { question, category: category || 'general', sortOrder: sortOrder || 0 },
  });
  ctx.body = { success: true, data: q };
}

export async function updateQuickQuestion(ctx: Context) {
  const { question, category, sortOrder } = ctx.request.body as any;
  const q = await prisma.quickQuestion.update({
    where: { id: ctx.params.id },
    data: { question, category, sortOrder },
  });
  ctx.body = { success: true, data: q };
}

export async function deleteQuickQuestion(ctx: Context) {
  await prisma.quickQuestion.delete({ where: { id: ctx.params.id } });
  ctx.body = { success: true, message: '删除成功' };
}

// ─── 自动回复规则 ──────────────────────────────────

export async function getAutoReplyRules(ctx: Context) {
  const rules = await prisma.autoReplyRule.findMany({ orderBy: { sortOrder: 'asc' } });
  ctx.body = { success: true, data: rules };
}

export async function createAutoReplyRule(ctx: Context) {
  const { keyword, matchMode, replyType, replyContent, sortOrder } = ctx.request.body as any;
  const rule = await prisma.autoReplyRule.create({
    data: { keyword, matchMode: matchMode || 'exact', replyType: replyType || 'text', replyContent, sortOrder: sortOrder || 0 },
  });
  ctx.body = { success: true, data: rule };
}

export async function updateAutoReplyRule(ctx: Context) {
  const { keyword, matchMode, replyType, replyContent, sortOrder, status } = ctx.request.body as any;
  const rule = await prisma.autoReplyRule.update({
    where: { id: ctx.params.id },
    data: { keyword, matchMode, replyType, replyContent, sortOrder, status },
  });
  ctx.body = { success: true, data: rule };
}

export async function deleteAutoReplyRule(ctx: Context) {
  await prisma.autoReplyRule.delete({ where: { id: ctx.params.id } });
  ctx.body = { success: true, message: '删除成功' };
}

// ─── AI 配置 ────────────────────────────────────────

let cachedAiConfig: any = null;

export async function getAiConfig(ctx: Context) {
  let aiConfig = await prisma.aiConfig.findFirst();
  if (!aiConfig) {
    aiConfig = await prisma.aiConfig.create({ data: {} });
  }
  ctx.body = { success: true, data: aiConfig };
}

export async function updateAiConfig(ctx: Context) {
  const { model, temperature, maxTokens, topP, contextWindow, skillEnabled, skillWeight, pointsPerQuery, pointsPerDeep } = ctx.request.body as any;

  const aiConfig = await prisma.aiConfig.findFirst();
  if (!aiConfig) throw new Error('AI 配置不存在');

  const updated = await prisma.aiConfig.update({
    where: { id: aiConfig.id },
    data: { model, temperature, maxTokens, topP, contextWindow, skillEnabled, skillWeight, pointsPerQuery, pointsPerDeep },
  });

  cachedAiConfig = updated;
  ctx.body = { success: true, data: updated };
}

// ─── 公众号菜单管理 ────────────────────────────────

export async function getWechatMenu(ctx: Context) {
  const menus = await prisma.wechatMenu.findMany({ orderBy: { sortOrder: 'asc' } });
  ctx.body = { success: true, data: menus };
}

export async function syncWechatMenu(ctx: Context) {
  await syncWechatMenuService();
  ctx.body = { success: true, message: '菜单同步成功' };
}

// ─── 数据大盘 ───────────────────────────────────────

export async function getDashboard(ctx: Context) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    todayNewUsers,
    monthNewUsers,
    todayConsultations,
    monthConsultations,
    revenueToday,
    revenueMonth,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.consultationRecord.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.consultationRecord.count({ where: { createdAt: { gte: monthStart } } }),
    getRevenueStats(todayStart, now),
    getRevenueStats(monthStart, now),
  ]);

  ctx.body = {
    success: true,
    data: {
      users: {
        total: totalUsers,
        todayNew: todayNewUsers,
        monthNew: monthNewUsers,
      },
      consultations: {
        today: todayConsultations,
        month: monthConsultations,
      },
      revenue: {
        today: revenueToday.totalRevenue,
        todayOrders: revenueToday.totalOrders,
        month: revenueMonth.totalRevenue,
        monthOrders: revenueMonth.totalOrders,
      },
    },
  };
}
