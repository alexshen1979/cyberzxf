import { Context } from 'koa';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { signToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { syncMenu as syncWechatMenuService } from '../services/wechat.service';
import { getBalance } from '../services/points.service';
import { getRevenueStats } from '../services/payment.service';
import { createLogger } from '../utils/logger';
import {
  createRechargeProduct,
  deleteRechargeProduct,
  getPointSettings,
  listRechargeProducts,
  updatePointSettings,
  updateRechargeProduct,
} from '../services/point-config.service';

const logger = createLogger('admin-ctrl');

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
  try {
    const user = await prisma.user.update({
      where: { id: ctx.params.id },
      data: { nickname, phone, status },
    });
    ctx.body = { success: true, data: user };
  } catch (err: any) {
    if (err?.code === 'P2025') {
      ctx.status = 404;
      ctx.body = { success: false, message: '用户不存在' };
      return;
    }
    throw err;
  }
}

// ─── 点数管理 ───────────────────────────────────────

export async function getUserPoints(ctx: Context) {
  const balance = await getBalance(ctx.params.userId);
  ctx.body = { success: true, data: balance };
}

export async function adjustPoints(ctx: Context) {
  const { userId, amount, remark } = ctx.request.body as any;

  // Input validation
  if (!userId || typeof amount !== 'number' || !Number.isFinite(amount) || !Number.isInteger(amount)) {
    ctx.status = 422;
    ctx.body = { success: false, message: '参数错误：userId 和 amount（整数）为必填项' };
    return;
  }
  if (amount > 10000 || amount < -10000) {
    ctx.status = 422;
    ctx.body = { success: false, message: '单次调整不得超过 ±10000 点' };
    return;
  }

  await prisma.$transaction(async (tx) => {
    const account = await tx.pointsAccount.findUnique({ where: { userId } });
    if (!account) throw new AppError(404, '用户点数账户不存在', 'POINTS_ACCOUNT_NOT_FOUND');

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
  try {
    const notice = await prisma.systemNotice.update({
      where: { id: ctx.params.id },
      data,
    });
    ctx.body = { success: true, data: notice };
  } catch (err: any) {
    if (err?.code === 'P2025') {
      ctx.status = 404;
      ctx.body = { success: false, message: '公告不存在' };
      return;
    }
    throw err;
  }
}

export async function deleteNotice(ctx: Context) {
  try {
    await prisma.systemNotice.delete({ where: { id: ctx.params.id } });
    ctx.body = { success: true, message: '删除成功' };
  } catch (err: any) {
    if (err?.code === 'P2025') {
      ctx.status = 404;
      ctx.body = { success: false, message: '公告不存在' };
      return;
    }
    throw err;
  }
}

// ─── 快捷提问管理 ──────────────────────────────────

export async function getQuickQuestions(ctx: Context) {
  const { keyword, category } = ctx.query as Record<string, string>;
  const where: any = {};
  if (keyword) where.question = { contains: keyword };
  if (category) where.category = category;
  const questions = await prisma.quickQuestion.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
  });
  ctx.body = { success: true, data: questions };
}

export async function createQuickQuestion(ctx: Context) {
  const { question, category, sortOrder, enabled } = ctx.request.body as any;
  const q = await prisma.quickQuestion.create({
    data: {
      question,
      category: category || 'general',
      sortOrder: sortOrder || 0,
      enabled: enabled !== undefined ? enabled : true,
    },
  });
  ctx.body = { success: true, data: q };
}

export async function updateQuickQuestion(ctx: Context) {
  const { question, category, sortOrder, enabled } = ctx.request.body as any;
  const data: any = {};
  if (question !== undefined) data.question = question;
  if (category !== undefined) data.category = category;
  if (sortOrder !== undefined) data.sortOrder = sortOrder;
  if (enabled !== undefined) data.enabled = enabled;
  try {
    const q = await prisma.quickQuestion.update({
      where: { id: ctx.params.id },
      data,
    });
    ctx.body = { success: true, data: q };
  } catch (err: any) {
    if (err?.code === 'P2025') {
      ctx.status = 404;
      ctx.body = { success: false, message: '快捷提问不存在' };
      return;
    }
    throw err;
  }
}

export async function deleteQuickQuestion(ctx: Context) {
  try {
    await prisma.quickQuestion.delete({ where: { id: ctx.params.id } });
    ctx.body = { success: true, message: '删除成功' };
  } catch (err: any) {
    if (err?.code === 'P2025') {
      ctx.status = 404;
      ctx.body = { success: false, message: '快捷提问不存在' };
      return;
    }
    throw err;
  }
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
  try {
    await prisma.autoReplyRule.delete({ where: { id: ctx.params.id } });
    ctx.body = { success: true, message: '删除成功' };
  } catch (err: any) {
    if (err?.code === 'P2025') {
      ctx.status = 404;
      ctx.body = { success: false, message: '自动回复规则不存在' };
      return;
    }
    throw err;
  }
}

// ─── AI 配置 ────────────────────────────────────────

export async function getAiConfig(ctx: Context) {
  let aiConfig = await prisma.aiConfig.findFirst();
  if (!aiConfig) {
    aiConfig = await prisma.aiConfig.create({ data: {} });
  }
  ctx.body = { success: true, data: aiConfig };
}

export async function updateAiConfig(ctx: Context) {
  const { model, temperature, maxTokens, topP, contextWindow, skillEnabled, skillWeight, pointsPerQuery, pointsPerDeep, freeAskLimit, apiKey, apiBaseUrl, timeout } = ctx.request.body as any;

  const aiConfig = await prisma.aiConfig.findFirst();
  if (!aiConfig) throw new AppError(404, 'AI 配置不存在', 'AI_CONFIG_NOT_FOUND');

  const updated = await prisma.aiConfig.update({
    where: { id: aiConfig.id },
    data: { model, temperature, maxTokens, topP, contextWindow, skillEnabled, skillWeight, pointsPerQuery, pointsPerDeep, freeAskLimit, apiKey, apiBaseUrl, timeout },
  });
  if (pointsPerQuery !== undefined || pointsPerDeep !== undefined) {
    const current = await getPointSettings();
    await updatePointSettings({
      freeGift: current.freeGift,
      defaultCost: pointsPerQuery ?? current.defaultCost,
      deepAnalysisCost: pointsPerDeep ?? current.deepAnalysisCost,
      volunteerAnalysisCost: current.volunteerAnalysisCost,
      expireDays: current.expireDays,
    });
  }

  ctx.body = { success: true, data: updated };
}

// ─── 点数规则与充值套餐 ──────────────────────────────

export async function getPointSettingsForAdmin(ctx: Context) {
  const [settings, aiConfig] = await Promise.all([
    getPointSettings(),
    prisma.aiConfig.findFirst(),
  ]);
  ctx.body = {
    success: true,
    data: {
      ...settings,
      freeAskLimit: aiConfig?.freeAskLimit ?? 2,
    },
  };
}

export async function updatePointSettingsForAdmin(ctx: Context) {
  const input = ctx.request.body as Record<string, any>;
  const updated = await updatePointSettings(input);
  const currentAiConfig = await prisma.aiConfig.findFirst();
  const freeAskLimit = input.freeAskLimit !== undefined
    ? normalizeFreeAskLimit(input.freeAskLimit)
    : (currentAiConfig?.freeAskLimit ?? 2);
  if (currentAiConfig) {
    await prisma.aiConfig.update({
      where: { id: currentAiConfig.id },
      data: {
        pointsPerQuery: updated.defaultCost,
        pointsPerDeep: updated.deepAnalysisCost,
        freeAskLimit,
      },
    });
  } else {
    await prisma.aiConfig.create({
      data: {
        pointsPerQuery: updated.defaultCost,
        pointsPerDeep: updated.deepAnalysisCost,
        freeAskLimit,
      },
    });
  }
  ctx.body = { success: true, data: { ...updated, freeAskLimit } };
}

function normalizeFreeAskLimit(value: any) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 999) {
    throw new AppError(422, '未登录免费次数必须是 0-999 之间的整数', 'POINT_CONFIG_INVALID');
  }
  return n;
}

export async function getRechargeProductsForAdmin(ctx: Context) {
  const includeDisabled = ctx.query.includeDisabled !== 'false';
  ctx.body = { success: true, data: await listRechargeProducts({ includeDisabled }) };
}

export async function createRechargeProductForAdmin(ctx: Context) {
  const product = await createRechargeProduct(ctx.request.body as Record<string, any>);
  ctx.body = { success: true, data: product };
}

export async function updateRechargeProductForAdmin(ctx: Context) {
  const product = await updateRechargeProduct(ctx.params.id, ctx.request.body as Record<string, any>);
  ctx.body = { success: true, data: product };
}

export async function deleteRechargeProductForAdmin(ctx: Context) {
  const product = await deleteRechargeProduct(ctx.params.id);
  ctx.body = { success: true, data: product, message: product ? '套餐已有订单，已改为下架' : '删除成功' };
}

// ─── 公共配置（供小程序读取） ──────────────────────────

export async function getPublicConfig(ctx: Context) {
  const [aiConfig, pointSettings] = await Promise.all([
    prisma.aiConfig.findFirst(),
    getPointSettings(),
  ]);
  ctx.body = {
    success: true,
    data: {
      freeAskLimit: aiConfig?.freeAskLimit ?? 2,
      freeGift: pointSettings.freeGift,
      volunteerAnalysisCost: pointSettings.volunteerAnalysisCost,
    },
  };
}

// ─── Skill 管理 ─────────────────────────────────────

export async function getSkills(ctx: Context) {
  const skills = await prisma.skill.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  ctx.body = { success: true, data: skills };
}

export async function createSkill(ctx: Context) {
  const { name, description, systemPrompt, model, temperature, maxTokens, topP, keywords, status, isDefault, sortOrder } = ctx.request.body as any;

  const skill = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.skill.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return tx.skill.create({
      data: {
        name,
        description,
        systemPrompt,
        model: model || 'deepseek-chat',
        temperature,
        maxTokens,
        topP,
        keywords: Array.isArray(keywords) ? JSON.stringify(keywords) : (keywords || '[]'),
        status: status || 'enabled',
        isDefault: isDefault || false,
        sortOrder: sortOrder || 0,
      },
    });
  });

  ctx.body = { success: true, data: skill };
}

export async function updateSkill(ctx: Context) {
  const { name, description, systemPrompt, model, temperature, maxTokens, topP, keywords, status, isDefault, sortOrder } = ctx.request.body as any;

  try {
    const skill = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.skill.updateMany({
          where: { isDefault: true, id: { not: ctx.params.id } },
          data: { isDefault: false },
        });
      }
      const data: any = { name, description, systemPrompt, model, temperature, maxTokens, topP, status, isDefault, sortOrder };
      if (keywords !== undefined) {
        data.keywords = Array.isArray(keywords) ? JSON.stringify(keywords) : keywords;
      }
      return tx.skill.update({ where: { id: ctx.params.id }, data });
    });
    ctx.body = { success: true, data: skill };
  } catch (err: any) {
    if (err?.code === 'P2025') {
      ctx.status = 404;
      ctx.body = { success: false, message: 'Skill 不存在' };
      return;
    }
    throw err;
  }
}

export async function deleteSkill(ctx: Context) {
  try {
    await prisma.skill.delete({ where: { id: ctx.params.id } });
    ctx.body = { success: true, message: '删除成功' };
  } catch (err: any) {
    if (err?.code === 'P2025') {
      ctx.status = 404;
      ctx.body = { success: false, message: 'Skill 不存在' };
      return;
    }
    throw err;
  }
}

// ─── Skill GitHub 同步 ───────────────────────────

export async function syncSkillFromGithub(ctx: Context) {
  ctx.status = 403;
  ctx.body = { success: false, message: '为避免版权和公众人物风格风险，已禁用外部 Skill 同步。请在后台手动维护合规提示词。' };
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

// ─── 数据导出 ───────────────────────────────────────

function escapeCsvField(val: any): string {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function arrayToCsv(headers: string[], rows: any[][]): string {
  const headerLine = headers.map(escapeCsvField).join(',');
  const bodyLines = rows.map(row => row.map(escapeCsvField).join(','));
  return [headerLine, ...bodyLines].join('\n');
}

export async function exportUsers(ctx: Context) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { pointsAccount: { select: { balance: true } } },
  });

  const headers = ['ID', '昵称', '小程序OpenID', '公众号OpenID', 'UnionID', '点数余额', '状态', '注册时间'];
  const rows = users.map(u => [
    u.id, u.nickname || '', u.miniOpenId || '', u.mpOpenId || '', u.unionId || '',
    u.pointsAccount?.balance ?? 0, u.status === 1 ? '正常' : '禁用',
    u.createdAt.toISOString(),
  ]);

  ctx.set('Content-Type', 'text/csv; charset=utf-8');
  ctx.set('Content-Disposition', `attachment; filename="users_${new Date().toISOString().slice(0, 10)}.csv"`);
  ctx.body = '﻿' + arrayToCsv(headers, rows); // BOM for Excel
}

export async function exportOrders(ctx: Context) {
  const { startDate, endDate } = ctx.query as any;

  const where: any = { status: 'paid' };
  if (startDate || endDate) {
    where.paidAt = {};
    if (startDate) where.paidAt.gte = new Date(startDate);
    if (endDate) where.paidAt.lte = new Date(endDate);
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  const headers = ['订单号', '微信交易号', '用户ID', '商品名称', '金额(分)', '购买点数', '赠送点数', '状态', '支付时间', '创建时间'];
  const rows = orders.map(o => [
    o.orderNo, o.transactionId || '', o.userId, o.productName, o.amount, o.points, o.bonusPoints,
    o.status === 'paid' ? '已完成' : o.status,
    o.paidAt?.toISOString() || '',
    o.createdAt.toISOString(),
  ]);

  const revenue = orders.reduce((sum, o) => sum + o.amount, 0);
  const summaryHeader = ['', '', '', '', '', '', '', '', '', ''];
  const summaryRow = ['', '', '', '合计营收(分):', revenue, '总订单数:', orders.length, '', '', ''];

  ctx.set('Content-Type', 'text/csv; charset=utf-8');
  ctx.set('Content-Disposition', `attachment; filename="orders_${new Date().toISOString().slice(0, 10)}.csv"`);
  ctx.body = '﻿' + arrayToCsv(headers, rows) + '\n' + arrayToCsv(summaryHeader, [summaryRow]);
}

export async function exportConsultations(ctx: Context) {
  const { startDate, endDate } = ctx.query as any;

  const where: any = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const records = await prisma.consultationRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000, // 限制导出条数
  });

  const headers = ['ID', '用户ID', 'SessionID', '问题', '回答', '模型', '消耗点数', '类型', '渠道', '时间'];
  const rows = records.map(r => [
    r.id, r.userId, r.sessionId,
    r.question.replace(/[\n\r]/g, ' ').slice(0, 200),
    r.answer.replace(/[\n\r]/g, ' ').slice(0, 500),
    r.model, r.pointsCost, r.type, r.channel,
    r.createdAt.toISOString(),
  ]);

  ctx.set('Content-Type', 'text/csv; charset=utf-8');
  ctx.set('Content-Disposition', `attachment; filename="consultations_${new Date().toISOString().slice(0, 10)}.csv"`);
  ctx.body = '﻿' + arrayToCsv(headers, rows);
}

// ─── 数据大盘 ───────────────────────────────────────

export async function getDashboard(ctx: Context) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // 近 7 天趋势
  const trendDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const trendLabels = trendDays.map(d => `${d.getMonth() + 1}/${d.getDate()}`);

  const trendQueries = trendDays.map(d => {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return {
      users: prisma.user.count({ where: { createdAt: { gte: d, lt: next } } }),
      consults: prisma.consultationRecord.count({ where: { createdAt: { gte: d, lt: next } } }),
    };
  });

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

  const trendResults = await Promise.all(trendQueries.flatMap(q => [q.users, q.consults]));
  const userTrend: number[] = [];
  const consultTrend: number[] = [];
  for (let i = 0; i < trendResults.length; i += 2) {
    userTrend.push(trendResults[i]);
    consultTrend.push(trendResults[i + 1]);
  }

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
      trends: {
        labels: trendLabels,
        users: userTrend,
        consultations: consultTrend,
      },
    },
  };
}
