import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { config } from '../config';

const logger = createLogger('distribution');
const SYSTEM_DISTRIBUTOR_ID = 'system-distributor';
const SYSTEM_DISTRIBUTOR_CODE = 'SYSTEM';
const DEFAULT_LEVEL1_RATE = 5000;
const DEFAULT_LEVEL2_RATE = 2000;

let miniAccessTokenCache: { token: string; expiresAt: number } | null = null;

export async function ensureDistributionDefaults(db: any = prisma) {
  const [setting, system] = await Promise.all([
    db.distributionSetting.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        enabled: true,
        level1Rate: DEFAULT_LEVEL1_RATE,
        level2Rate: DEFAULT_LEVEL2_RATE,
      },
    }),
    db.distributor.upsert({
      where: { code: SYSTEM_DISTRIBUTOR_CODE },
      update: { level: 1, parentId: null, status: 'active' },
      create: {
        id: SYSTEM_DISTRIBUTOR_ID,
        name: '系统',
        code: SYSTEM_DISTRIBUTOR_CODE,
        level: 1,
        status: 'active',
        approvedAt: new Date(),
      },
    }),
  ]);

  return { setting, system };
}

export async function createReferralForNewUser(db: any, userId: string, referralCode?: string) {
  const code = normalizeDistributorCode(referralCode);
  if (!code) return null;

  const { system } = await ensureDistributionDefaults(db);
  const distributor = await db.distributor.findUnique({
    where: { code },
    include: { parent: true },
  });

  if (!distributor || distributor.status !== 'active' || distributor.userId === userId) {
    return null;
  }

  const firstLevelDistributorId = distributor.level === 1
    ? distributor.id
    : distributor.parentId || system.id;

  await db.user.update({
    where: { id: userId },
    data: { referredByDistributorId: distributor.id, referredAt: new Date() },
  });

  return db.distributionReferral.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      distributorId: distributor.id,
      firstLevelDistributorId,
      sourceCode: distributor.code,
    },
  });
}

export async function applyDistributor(userId: string) {
  const { system } = await ensureDistributionDefaults();
  const existing = await prisma.distributor.findUnique({
    where: { userId },
    include: { parent: true },
  });
  if (existing) return getMyDistribution(userId);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, '用户不存在', 'USER_NOT_FOUND');

  const code = await generateDistributorCode(userId);
  await prisma.distributor.create({
    data: {
      userId,
      name: user.nickname || user.phone || `分销员${userId.slice(0, 6)}`,
      code,
      level: 2,
      parentId: system.id,
      status: 'pending',
    },
  });

  return getMyDistribution(userId);
}

export async function getMyDistribution(userId: string) {
  const { setting } = await ensureDistributionDefaults();
  const distributor = await prisma.distributor.findUnique({
    where: { userId },
    include: {
      parent: { select: { id: true, name: true, code: true, level: true } },
      children: { select: { id: true, name: true, code: true, status: true } },
    },
  });

  if (!distributor) {
    return {
      distributor: null,
      setting: formatDistributionSetting(setting),
      stats: emptyDistributionStats(),
      sharePath: '',
      canApply: true,
    };
  }

  const [directReferralCount, paidReferralCount, commissionTotal, commissionCount, teamReferralCount] = await Promise.all([
    prisma.distributionReferral.count({ where: { distributorId: distributor.id } }),
    prisma.distributionReferral.count({ where: { distributorId: distributor.id, firstOrderId: { not: null } } }),
    prisma.distributionCommission.aggregate({
      where: { distributorId: distributor.id },
      _sum: { amount: true },
    }),
    prisma.distributionCommission.count({ where: { distributorId: distributor.id } }),
    distributor.level === 1
      ? prisma.distributionReferral.count({ where: { firstLevelDistributorId: distributor.id } })
      : Promise.resolve(0),
  ]);

  return {
    distributor,
    setting: formatDistributionSetting(setting),
    stats: {
      directReferralCount,
      paidReferralCount,
      teamReferralCount,
      commissionCount,
      commissionAmount: commissionTotal._sum.amount || 0,
    },
    sharePath: buildSharePath(distributor.code),
    canApply: false,
  };
}

export async function getMyDistributionCommissions(userId: string, page = 1, pageSize = 20) {
  const distributor = await prisma.distributor.findUnique({ where: { userId } });
  if (!distributor) return { list: [], total: 0, page, pageSize };

  return listCommissionsByWhere({ distributorId: distributor.id }, page, pageSize);
}

export async function getMyDistributionQrCode(userId: string) {
  const distributor = await prisma.distributor.findUnique({ where: { userId } });
  if (!distributor) throw new AppError(404, '请先申请成为分销员', 'DISTRIBUTOR_NOT_FOUND');
  if (distributor.status !== 'active') {
    throw new AppError(403, '分销申请审核通过后才能生成小程序码', 'DISTRIBUTOR_NOT_APPROVED');
  }

  const scene = `d=${distributor.code}`;
  const page = 'pages/volunteer/index';
  const token = await getMiniAccessToken();
  const response = await axios.post(
    `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token)}`,
    {
      scene,
      page,
      check_path: false,
      env_version: 'release',
    },
    { responseType: 'arraybuffer', timeout: 15000 },
  );

  const body = Buffer.from(response.data);
  const contentType = String(response.headers['content-type'] || '');
  if (contentType.includes('json')) {
    const detail = safeJson(body.toString('utf8'), {});
    throw new AppError(502, `小程序码生成失败：${detail.errmsg || detail.errcode || '微信接口异常'}`, 'WXACODE_FAILED', detail);
  }

  return {
    dataUrl: `data:image/png;base64,${body.toString('base64')}`,
    scene,
    page,
    sharePath: buildSharePath(distributor.code),
  };
}

export async function settleDistributionCommissionForOrder(orderId: string) {
  await ensureDistributionDefaults();

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'paid' || order.commissionSettled) return null;

    const existingCommissionCount = await tx.distributionCommission.count({ where: { orderId: order.id } });
    if (existingCommissionCount > 0) {
      await tx.order.update({ where: { id: order.id }, data: { commissionSettled: true } });
      return null;
    }

    const firstPaidOrder = await tx.order.findFirst({
      where: { userId: order.userId, status: 'paid' },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    if (!firstPaidOrder || firstPaidOrder.id !== order.id) {
      await tx.order.update({ where: { id: order.id }, data: { commissionSettled: true } });
      return null;
    }

    const referral = await tx.distributionReferral.findUnique({
      where: { userId: order.userId },
      include: { distributor: { include: { parent: true } } },
    });

    if (!referral || referral.firstOrderId) {
      await tx.order.update({ where: { id: order.id }, data: { commissionSettled: true } });
      return null;
    }

    const setting = await tx.distributionSetting.findUnique({ where: { id: 'default' } });
    if (!setting?.enabled) {
      await tx.distributionReferral.update({
        where: { id: referral.id },
        data: { firstOrderId: order.id, commissionSettledAt: new Date() },
      });
      await tx.order.update({ where: { id: order.id }, data: { commissionSettled: true } });
      return null;
    }

    const rows = buildCommissionRows(order, referral, setting);
    for (const row of rows) {
      await tx.distributionCommission.create({ data: row });
    }

    await tx.distributionReferral.update({
      where: { id: referral.id },
      data: { firstOrderId: order.id, commissionSettledAt: new Date() },
    });
    await tx.order.update({ where: { id: order.id }, data: { commissionSettled: true } });

    if (rows.length) {
      logger.info('分销佣金已结算: orderId=%s rows=%d amount=%d', order.id, rows.length, rows.reduce((sum, row) => sum + row.amount, 0));
    }
    return rows;
  });
}

export async function getDistributionSettingsForAdmin() {
  const { setting } = await ensureDistributionDefaults();
  return formatDistributionSetting(setting);
}

export async function updateDistributionSettingsForAdmin(input: Record<string, any>) {
  const level1Rate = normalizeRateBps(input.level1Rate);
  const level2Rate = normalizeRateBps(input.level2Rate);
  if (level1Rate < level2Rate) {
    throw new AppError(422, '一级分销比例不能低于二级分销比例', 'DISTRIBUTION_RATE_INVALID');
  }

  const setting = await prisma.distributionSetting.upsert({
    where: { id: 'default' },
    update: {
      enabled: input.enabled !== false,
      level1Rate,
      level2Rate,
    },
    create: {
      id: 'default',
      enabled: input.enabled !== false,
      level1Rate,
      level2Rate,
    },
  });
  return formatDistributionSetting(setting);
}

export async function getDistributionDashboardForAdmin() {
  await ensureDistributionDefaults();
  const [
    distributorCount,
    level1Count,
    level2Count,
    referralCount,
    commissionCount,
    commissionTotal,
  ] = await Promise.all([
    prisma.distributor.count(),
    prisma.distributor.count({ where: { level: 1 } }),
    prisma.distributor.count({ where: { level: 2 } }),
    prisma.distributionReferral.count(),
    prisma.distributionCommission.count(),
    prisma.distributionCommission.aggregate({ _sum: { amount: true } }),
  ]);

  return {
    distributorCount,
    level1Count,
    level2Count,
    referralCount,
    commissionCount,
    commissionAmount: commissionTotal._sum.amount || 0,
  };
}

export async function listDistributorsForAdmin(params: Record<string, any>) {
  await ensureDistributionDefaults();
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || '20', 10)));
  const keyword = String(params.keyword || '').trim();
  const level = params.level ? Number(params.level) : undefined;
  const status = String(params.status || '').trim();

  const where: any = {};
  if (level === 1 || level === 2) where.level = level;
  if (status) where.status = status;
  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { code: { contains: keyword } },
      { user: { nickname: { contains: keyword } } },
      { user: { phone: { contains: keyword } } },
    ];
  }

  const [list, total] = await Promise.all([
    prisma.distributor.findMany({
      where,
      orderBy: [{ level: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, nickname: true, phone: true, createdAt: true } },
        parent: { select: { id: true, name: true, code: true } },
        _count: { select: { children: true, referrals: true, commissions: true } },
      },
    }),
    prisma.distributor.count({ where }),
  ]);

  return { list, total, page, pageSize };
}

export async function listLevelOneDistributorsForAdmin() {
  await ensureDistributionDefaults();
  return prisma.distributor.findMany({
    where: { level: 1, status: 'active' },
    orderBy: [{ code: 'asc' }],
    select: { id: true, name: true, code: true, userId: true },
  });
}

export async function createDistributorForAdmin(input: Record<string, any>) {
  await ensureDistributionDefaults();
  const userId = String(input.userId || '').trim();
  if (!userId) throw new AppError(422, '请选择用户', 'DISTRIBUTOR_USER_REQUIRED');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, '用户不存在', 'USER_NOT_FOUND');

  const existing = await prisma.distributor.findUnique({ where: { userId } });
  if (existing) return updateDistributorForAdmin(existing.id, input);

  const level = normalizeDistributorLevel(input.level || 2);
  const parentId = level === 2 ? await resolveLevel2ParentId(input.parentId) : null;
  return prisma.distributor.create({
    data: {
      userId,
      name: String(input.name || user.nickname || user.phone || `分销员${userId.slice(0, 6)}`).trim(),
      code: await generateDistributorCode(userId),
      level,
      parentId,
      status: normalizeDistributorStatus(input.status),
      approvedAt: new Date(),
    },
  });
}

export async function updateDistributorForAdmin(id: string, input: Record<string, any>) {
  const distributor = await prisma.distributor.findUnique({ where: { id }, include: { children: true } });
  if (!distributor) throw new AppError(404, '分销员不存在', 'DISTRIBUTOR_NOT_FOUND');

  const data: any = {};
  if (input.name !== undefined) data.name = String(input.name || distributor.name).trim();
  if (input.status !== undefined) {
    data.status = normalizeDistributorStatus(input.status);
    if (data.status === 'active' && !distributor.approvedAt) data.approvedAt = new Date();
  }

  if (distributor.code === SYSTEM_DISTRIBUTOR_CODE) {
    data.level = 1;
    data.parentId = null;
    data.status = 'active';
    return prisma.distributor.update({ where: { id }, data });
  }

  const nextLevel = input.level !== undefined ? normalizeDistributorLevel(input.level) : distributor.level;
  data.level = nextLevel;
  if (nextLevel === 1) {
    data.parentId = null;
  } else {
    data.parentId = await resolveLevel2ParentId(input.parentId || distributor.parentId);
  }

  return prisma.$transaction(async (tx) => {
    if (distributor.level === 1 && nextLevel === 2 && distributor.children.length) {
      const { system } = await ensureDistributionDefaults(tx);
      await tx.distributor.updateMany({
        where: { parentId: distributor.id },
        data: { parentId: system.id },
      });
    }
    return tx.distributor.update({ where: { id }, data });
  });
}

export async function listCommissionsForAdmin(params: Record<string, any>) {
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || '20', 10)));
  const where: any = {};
  if (params.distributorId) where.distributorId = String(params.distributorId);
  return listCommissionsByWhere(where, page, pageSize);
}

function buildCommissionRows(order: any, referral: any, setting: any) {
  const rows: any[] = [];
  const direct = referral.distributor;
  if (!direct || direct.status !== 'active') return rows;

  if (direct.level === 1) {
    const amount = calculateCommission(order.amount, setting.level1Rate);
    if (amount > 0) {
      rows.push(buildCommissionRow(order, direct.id, referral.userId, 'level1_direct', setting.level1Rate, amount));
    }
    return rows;
  }

  const level2Amount = calculateCommission(order.amount, setting.level2Rate);
  if (level2Amount > 0) {
    rows.push(buildCommissionRow(order, direct.id, referral.userId, 'level2_direct', setting.level2Rate, level2Amount));
  }

  const parent = direct.parent;
  const parentRate = Math.max(0, setting.level1Rate - setting.level2Rate);
  if (parent?.id && parent.status === 'active' && parentRate > 0) {
    const parentAmount = calculateCommission(order.amount, parentRate);
    if (parentAmount > 0) {
      rows.push(buildCommissionRow(order, parent.id, referral.userId, 'level1_override', parentRate, parentAmount));
    }
  }

  return rows;
}

function buildCommissionRow(order: any, distributorId: string, referralUserId: string, role: string, rateBps: number, amount: number) {
  return {
    id: crypto.randomUUID(),
    orderId: order.id,
    distributorId,
    referralUserId,
    role,
    rateBps,
    amount,
    status: 'settled',
  };
}

function calculateCommission(amount: number, rateBps: number) {
  return Math.max(0, Math.floor(Number(amount || 0) * Number(rateBps || 0) / 10000));
}

async function listCommissionsByWhere(where: any, page: number, pageSize: number) {
  const [list, total] = await Promise.all([
    prisma.distributionCommission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        distributor: { select: { id: true, name: true, code: true, level: true } },
        order: { select: { id: true, orderNo: true, amount: true, productName: true, paidAt: true } },
      },
    }),
    prisma.distributionCommission.count({ where }),
  ]);
  const userIds = [...new Set(list.map(item => item.referralUserId).filter(Boolean))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nickname: true, phone: true } })
    : [];
  const userMap = new Map(users.map(user => [user.id, user]));

  return {
    list: list.map(item => ({ ...item, referralUser: userMap.get(item.referralUserId) || null })),
    total,
    page,
    pageSize,
  };
}

async function resolveLevel2ParentId(parentId?: string) {
  const { system } = await ensureDistributionDefaults();
  const id = String(parentId || system.id).trim();
  const parent = await prisma.distributor.findUnique({ where: { id } });
  if (!parent || parent.level !== 1 || parent.status !== 'active') {
    throw new AppError(422, '二级分销必须归属于有效的一级分销', 'DISTRIBUTOR_PARENT_INVALID');
  }
  return parent.id;
}

async function generateDistributorCode(userId: string) {
  const base = `D${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  let code = base;
  let index = 1;
  while (await prisma.distributor.findUnique({ where: { code } })) {
    code = `${base}${index}`;
    index += 1;
  }
  return code;
}

function normalizeDistributorCode(value?: string) {
  return String(value || '').trim().replace(/^d=/i, '').toUpperCase();
}

function normalizeDistributorLevel(value: any) {
  const level = Number(value);
  if (level !== 1 && level !== 2) {
    throw new AppError(422, '分销层级只能是一级或二级', 'DISTRIBUTOR_LEVEL_INVALID');
  }
  return level;
}

function normalizeDistributorStatus(value: any) {
  const status = String(value || 'active');
  if (status === 'pending' || status === 'disabled') return status;
  return 'active';
}

function normalizeRateBps(value: any) {
  const rate = Math.round(Number(value));
  if (!Number.isFinite(rate) || rate < 0 || rate > 10000) {
    throw new AppError(422, '分销比例必须在 0% 到 100% 之间', 'DISTRIBUTION_RATE_INVALID');
  }
  return rate;
}

function formatDistributionSetting(setting: any) {
  return {
    enabled: setting.enabled,
    level1Rate: setting.level1Rate,
    level2Rate: setting.level2Rate,
    level1Percent: setting.level1Rate / 100,
    level2Percent: setting.level2Rate / 100,
  };
}

function emptyDistributionStats() {
  return {
    directReferralCount: 0,
    paidReferralCount: 0,
    teamReferralCount: 0,
    commissionCount: 0,
    commissionAmount: 0,
  };
}

function buildSharePath(code: string) {
  return `pages/volunteer/index?ref=${encodeURIComponent(code)}`;
}

async function getMiniAccessToken() {
  const now = Date.now();
  if (miniAccessTokenCache && miniAccessTokenCache.expiresAt > now + 60_000) {
    return miniAccessTokenCache.token;
  }

  const { appId, secret } = await resolveMiniProgramCredentials();
  if (!appId || !secret || /^(wx_.*|your_.*)$/i.test(appId) || /^(wx_.*|your_.*)$/i.test(secret)) {
    throw new AppError(503, '微信小程序参数未配置，无法生成小程序码', 'WECHAT_MINI_NOT_CONFIGURED');
  }

  const { data } = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    params: { grant_type: 'client_credential', appid: appId, secret },
    timeout: 10000,
  });

  if (data.errcode) {
    throw new AppError(502, `微信 access_token 获取失败：${data.errmsg}`, 'WECHAT_ACCESS_TOKEN_FAIL', data);
  }

  miniAccessTokenCache = {
    token: data.access_token,
    expiresAt: now + Math.max(0, Number(data.expires_in || 7200) - 300) * 1000,
  };
  return miniAccessTokenCache.token;
}

async function resolveMiniProgramCredentials() {
  const dbConfig = await prisma.wechatPayConfig.findFirst();
  return {
    appId: dbConfig?.miniAppId || config.wechat.miniProgram.appId || '',
    secret: dbConfig?.miniSecret || config.wechat.miniProgram.secret || '',
  };
}

function safeJson(text: string, fallback: any) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
