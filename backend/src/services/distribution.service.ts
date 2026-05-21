import axios from 'axios';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { config } from '../config';
import { getPointSettings } from './point-config.service';

const logger = createLogger('distribution');
const SYSTEM_DISTRIBUTOR_ID = 'system-distributor';
const SYSTEM_DISTRIBUTOR_CODE = 'SYSTEM';
const DEFAULT_LEVEL1_RATE = 5000;
const DEFAULT_LEVEL2_RATE = 2000;
const DEFAULT_MIN_WITHDRAWAL_AMOUNT = 1000;
const DEFAULT_WITHDRAWAL_FREEZE_DAYS = 7;
const DEFAULT_DAILY_SHARE_REWARD_POINTS = 10;
const DAILY_SHARE_REWARD_SOURCE = 'daily_share_reward';
const DEFAULT_SHARE_REFERRAL_REWARD_POINTS = 20;
const SHARE_REFERRAL_REWARD_SOURCE = 'share_referral_reward';
const DIRECT_COMMISSION_ROLES = ['level1_direct', 'level2_direct'];
const LOCKED_WITHDRAWAL_STATUSES = ['pending', 'approved'];

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
        dailyShareReward: DEFAULT_DAILY_SHARE_REWARD_POINTS,
        referralReward: DEFAULT_SHARE_REFERRAL_REWARD_POINTS,
        minWithdrawalAmount: DEFAULT_MIN_WITHDRAWAL_AMOUNT,
        withdrawalFreezeDays: DEFAULT_WITHDRAWAL_FREEZE_DAYS,
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

export async function ensureUserShareCode(userId: string, db: any = prisma) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: userShareSelect(),
  });
  if (!user) throw new AppError(404, '用户不存在', 'USER_NOT_FOUND');
  if (user.shareCode) return user;

  const shareCode = await generateUserShareCode(userId, db);
  return db.user.update({
    where: { id: userId },
    data: { shareCode },
    select: userShareSelect(),
  });
}

export async function createReferralForNewUser(db: any, userId: string, referralCode?: string) {
  const code = normalizeDistributorCode(referralCode);
  if (!code) return null;

  const resolved = await resolveReferralCode(db, userId, code);
  if (!resolved) return null;
  const { referrerUserId, distributor } = resolved;

  const shareReferral = await createShareReferralAndReward(db, userId, referrerUserId, code);

  return createDistributionReferralFromDistributor(db, userId, distributor, code, shareReferral.createdAt);
}

export async function resolveNewUserGiftPoints(db: any, userId: string, referralCode?: string, defaultGift?: number) {
  const settings = await getPointSettings();
  const fallbackGift = normalizePointAmount(defaultGift ?? settings.freeGift, '新用户赠送点数');
  const code = normalizeDistributorCode(referralCode);
  if (!code) return fallbackGift;

  const resolved = await resolveReferralCode(db, userId, code);
  const distributor = resolved?.distributor;
  const levelOne = distributor?.level === 1
    ? distributor
    : (distributor?.parent || (distributor?.parentId
      ? await db.distributor.findUnique({ where: { id: distributor.parentId } })
      : null));
  const override = levelOne?.level === 1 ? levelOne.newUserGiftOverride : null;
  return override === null || override === undefined
    ? fallbackGift
    : normalizePointAmount(override, '特邀合作伙伴新用户赠点');
}

async function createDistributionReferralFromDistributor(db: any, userId: string, distributor: any, sourceCode?: string, relationshipCreatedAt?: Date | string | null) {
  if (!distributor || distributor.status !== 'active' || distributor.userId === userId) return null;

  const existing = await db.distributionReferral.findUnique({ where: { userId } });
  if (existing) return existing;

  const { system } = await ensureDistributionDefaults(db);
  const createdAt = relationshipCreatedAt ? new Date(relationshipCreatedAt) : new Date();
  const firstLevelDistributorId = distributor.level === 1
    ? distributor.id
    : distributor.parentId || system.id;

  await db.user.update({
    where: { id: userId },
    data: { referredByDistributorId: distributor.id, referredAt: createdAt },
  });

  return db.distributionReferral.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      distributorId: distributor.id,
      firstLevelDistributorId,
      sourceCode: sourceCode || distributor.code,
      createdAt,
    },
  });
}

async function resolveDistributorParentFromShareReferral(db: any, distributorUserId?: string | null) {
  if (!distributorUserId) return null;
  const referral = await db.shareReferral.findUnique({
    where: { userId: distributorUserId },
    include: {
      referrer: {
        include: { distributorProfile: true },
      },
    },
  });
  const parent = referral?.referrer?.distributorProfile;
  if (parent?.level === 1 && parent.status === 'active') return parent.id;
  return null;
}

async function syncDistributorParentFromInvitation(db: any, distributor: any) {
  if (!distributor?.id || !distributor.userId || distributor.level !== 2 || distributor.status !== 'active') {
    return distributor;
  }

  const parentId = await resolveDistributorParentFromShareReferral(db, distributor.userId);
  if (!parentId || parentId === distributor.parentId) return distributor;

  return db.distributor.update({
    where: { id: distributor.id },
    data: { parentId },
  });
}

async function syncDistributionReferralFirstLevel(db: any, distributor: any) {
  if (!distributor?.id || distributor.level !== 2 || !distributor.parentId || distributor.parentId === SYSTEM_DISTRIBUTOR_ID) {
    return 0;
  }

  const result = await db.distributionReferral.updateMany({
    where: {
      distributorId: distributor.id,
      firstLevelDistributorId: { not: distributor.parentId },
    },
    data: { firstLevelDistributorId: distributor.parentId },
  });
  return result.count || 0;
}

async function migrateSystemOverrideCommissions(db: any, distributor: any) {
  if (!distributor?.id || distributor.level !== 2 || !distributor.parentId || distributor.parentId === SYSTEM_DISTRIBUTOR_ID) {
    return 0;
  }

  const parent = distributor.parent?.id === distributor.parentId
    ? distributor.parent
    : await db.distributor.findUnique({ where: { id: distributor.parentId } });
  if (!parent || parent.status !== 'active') return 0;

  const directRows = await db.distributionCommission.findMany({
    where: {
      distributorId: distributor.id,
      role: 'level2_direct',
    },
    select: { orderId: true, order: { select: { paidAt: true, createdAt: true } } },
  });
  const orderIds = directRows
    .filter((row: any) => isOrderAfterDistributorApproval(row.order, parent))
    .map((row: any) => row.orderId)
    .filter(Boolean);
  if (!orderIds.length) return 0;

  const existingParentRows = await db.distributionCommission.findMany({
    where: {
      orderId: { in: orderIds },
      distributorId: distributor.parentId,
      role: 'level1_override',
    },
    select: { orderId: true },
  });
  const alreadyMoved = new Set(existingParentRows.map((row: any) => row.orderId));
  const movableOrderIds = orderIds.filter((orderId: string) => !alreadyMoved.has(orderId));
  if (!movableOrderIds.length) return 0;

  const result = await db.distributionCommission.updateMany({
    where: {
      orderId: { in: movableOrderIds },
      distributorId: SYSTEM_DISTRIBUTOR_ID,
      role: 'level1_override',
    },
    data: { distributorId: distributor.parentId },
  });
  return result.count || 0;
}

async function syncInvitedLevel2ChildrenForLevelOne(db: any, distributor: any) {
  if (!distributor?.id || !distributor.userId || distributor.level !== 1 || distributor.status !== 'active') {
    return 0;
  }

  const referrals = await db.shareReferral.findMany({
    where: { referrerUserId: distributor.userId },
    include: { user: { include: { distributorProfile: true } } },
  });

  let updatedCount = 0;
  for (const referral of referrals) {
    const child = referral.user?.distributorProfile;
    if (!child || child.level !== 2 || child.status !== 'active' || child.parentId === distributor.id) {
      continue;
    }

    const updated = await db.distributor.update({
      where: { id: child.id },
      data: { parentId: distributor.id },
    });
    updatedCount += 1;
    await syncDistributionReferralFirstLevel(db, updated);
    await migrateSystemOverrideCommissions(db, { ...updated, parent: distributor });
  }

  return updatedCount;
}

async function backfillDistributionReferralsForDistributor(db: any, distributor: any) {
  if (!distributor?.userId || distributor.status !== 'active') return 0;

  distributor = await syncDistributorParentFromInvitation(db, distributor);
  await syncInvitedLevel2ChildrenForLevelOne(db, distributor);
  await syncDistributionReferralFirstLevel(db, distributor);
  await migrateSystemOverrideCommissions(db, distributor);

  const referrals = await db.shareReferral.findMany({
    where: { referrerUserId: distributor.userId },
    include: { user: { select: { id: true, createdAt: true } } },
  });

  let created = 0;
  for (const referral of referrals) {
    const before = await db.distributionReferral.findUnique({ where: { userId: referral.userId } });
    if (before) continue;

    const result = await createDistributionReferralFromDistributor(
      db,
      referral.userId,
      distributor,
      referral.sourceCode || distributor.code,
      referral.createdAt,
    );
    if (result) created += 1;
  }

  return created;
}

export async function bindShareReferral(userId: string, referralCode?: string) {
  const code = normalizeDistributorCode(referralCode);
  if (!code) throw new AppError(422, '请输入邀请码', 'REFERRAL_CODE_REQUIRED');

  return prisma.$transaction(async (tx) => {
    const existing = await tx.shareReferral.findUnique({
      where: { userId },
      include: { referrer: { select: { id: true, nickname: true, phone: true, shareCode: true } } },
    });
    if (existing) {
      throw new AppError(409, '你已经绑定过邀请人，不能重复填写', 'SHARE_REFERRAL_EXISTS');
    }

    await ensureDistributionDefaults(tx);
    const resolved = await resolveReferralCode(tx, userId, code);
    if (!resolved) {
      throw new AppError(404, '邀请码不存在或不可用', 'REFERRAL_CODE_NOT_FOUND');
    }

    const shareReferral = await createShareReferralAndReward(tx, userId, resolved.referrerUserId, code);
    let distributionReferral = null;
    const distributor = resolved.distributor;
    if (distributor?.status === 'active' && distributor.userId !== userId) {
      distributionReferral = await createDistributionReferralFromDistributor(tx, userId, distributor, code, shareReferral.createdAt);
    }

    return {
      shareReferral,
      distributionReferral,
      rewardPoints: getReferralRewardPoints(await getCurrentDistributionSetting(tx)),
    };
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
  const user = await ensureUserShareCode(userId);
  const distributor = await prisma.distributor.findUnique({
    where: { userId },
    include: {
      parent: { select: { id: true, name: true, code: true, level: true } },
      children: { select: { id: true, name: true, code: true, status: true } },
    },
  });

  if (!distributor) {
    return buildShareOnlyDistribution(userId, user, setting, true);
  }

  if (distributor.status === 'disabled' || distributor.status === 'rejected') {
    return buildShareOnlyDistribution(userId, user, setting, false);
  }

  if (distributor.status === 'active') {
    await backfillMissingCommissionsForDistributor(distributor.id).catch((err) => {
      logger.warn({ err, distributorId: distributor.id }, '分销漏结算修复失败');
    });
  }

  const [
    directReferralCount,
    paidReferralCount,
    commissionTotal,
    commissionCount,
    withdrawalSummary,
    teamReferralCount,
    shareReferralCount,
    shareRewardCount,
    shareReferral,
  ] = await Promise.all([
    prisma.distributionReferral.count({ where: { distributorId: distributor.id } }),
    prisma.distributionReferral.count({ where: { distributorId: distributor.id, firstOrderId: { not: null } } }),
    prisma.distributionCommission.aggregate({
      where: { distributorId: distributor.id },
      _sum: { amount: true },
    }),
    prisma.distributionCommission.count({ where: { distributorId: distributor.id } }),
    getDistributorWithdrawalSummary(distributor.id, setting),
    distributor.level === 1
      ? prisma.distributionReferral.count({ where: { firstLevelDistributorId: distributor.id } })
      : Promise.resolve(0),
    prisma.shareReferral.count({ where: { referrerUserId: userId } }),
    prisma.pointsTransaction.count({ where: { userId, source: SHARE_REFERRAL_REWARD_SOURCE } }),
    getUserShareReferral(userId),
  ]);

  return {
    distributor,
    setting: formatDistributionSetting(setting),
    stats: {
      directReferralCount,
      paidReferralCount,
      teamReferralCount,
      commissionCount,
      ...withdrawalSummary,
      shareReferralCount,
      shareRewardCount,
    },
    shareReferral: formatShareReferral(shareReferral),
    shareCode: user.shareCode,
    sharePath: buildSharePath(user.shareCode),
    distributorShareCode: distributor.code,
    dailyShareRewardPoints: getDailyShareRewardPoints(setting),
    referralRewardPoints: getReferralRewardPoints(setting),
    canApply: false,
  };
}

export async function getMyDistributionCommissions(userId: string, page = 1, pageSize = 20) {
  const distributor = await prisma.distributor.findUnique({ where: { userId } });
  if (!distributor || distributor.status !== 'active') return { list: [], total: 0, page, pageSize };

  await backfillMissingCommissionsForDistributor(distributor.id).catch((err) => {
    logger.warn({ err, distributorId: distributor.id }, '分销佣金列表漏结算修复失败');
  });

  return listCommissionsByWhere({ distributorId: distributor.id }, page, pageSize);
}

export async function getMyDistributionWithdrawals(userId: string, page = 1, pageSize = 20) {
  const distributor = await prisma.distributor.findUnique({ where: { userId } });
  if (!distributor || distributor.status !== 'active') return { list: [], total: 0, page, pageSize };
  return listWithdrawalsByWhere({ distributorId: distributor.id }, page, pageSize);
}

export async function applyDistributionWithdrawal(userId: string, input: Record<string, any> = {}) {
  const { setting } = await ensureDistributionDefaults();
  const distributor = await prisma.distributor.findUnique({
    where: { userId },
    include: { user: { select: { id: true, nickname: true, phone: true, miniOpenId: true, mpOpenId: true } } },
  });
  if (!distributor || distributor.status !== 'active') {
    throw new AppError(403, '只有审核通过的分销员才能申请提现', 'DISTRIBUTOR_NOT_ACTIVE');
  }

  const amount = normalizeMoneyAmount(input.amount);
  const minAmount = setting.minWithdrawalAmount || DEFAULT_MIN_WITHDRAWAL_AMOUNT;
  if (amount < minAmount) {
    throw new AppError(422, `提现金额不能低于 ${formatYuan(minAmount)}`, 'WITHDRAWAL_AMOUNT_TOO_LOW');
  }

  const summary = await getDistributorWithdrawalSummary(distributor.id, setting);
  if (amount > summary.availableWithdrawalAmount) {
    throw new AppError(422, '可提现余额不足', 'WITHDRAWAL_BALANCE_NOT_ENOUGH');
  }

  const todayStart = startOfShanghaiDay(new Date());
  const todayCount = await prisma.distributionWithdrawal.count({
    where: {
      distributorId: distributor.id,
      requestedAt: { gte: todayStart },
    },
  });
  if (todayCount > 0) {
    throw new AppError(429, '每天最多提交 1 次提现申请', 'WITHDRAWAL_DAILY_LIMIT');
  }

  const withdrawal = await prisma.distributionWithdrawal.create({
    data: {
      id: crypto.randomUUID(),
      withdrawalNo: await generateWithdrawalNo(),
      distributorId: distributor.id,
      userId,
      amount,
      status: 'pending',
      method: 'wechat_balance',
      accountName: String(input.accountName || distributor.user?.nickname || distributor.user?.phone || distributor.name || '').trim().slice(0, 50) || null,
      openId: distributor.user?.miniOpenId || distributor.user?.mpOpenId || null,
      remark: String(input.remark || '').trim().slice(0, 200) || null,
    },
    include: withdrawalInclude(),
  });

  return {
    withdrawal,
    summary: await getDistributorWithdrawalSummary(distributor.id, setting),
  };
}

export async function getMyDistributionQrCode(userId: string) {
  const user = await ensureUserShareCode(userId);
  if (!user.shareCode) throw new AppError(404, '分享码生成失败，请稍后重试', 'SHARE_CODE_NOT_FOUND');

  const scene = `ref=${user.shareCode}`;
  const page = 'pages/volunteer/index';
  const sharePath = buildSharePath(user.shareCode);
  const miniQr = await tryGenerateMiniQrCode(scene, page);
  return {
    dataUrl: miniQr?.dataUrl || await generateInviteCodeQrDataUrl(user.shareCode, sharePath),
    scene,
    page,
    shareCode: user.shareCode,
    sharePath,
    imageType: miniQr ? 'wechat' : 'invite_qr',
  };
}

export async function recordUserShare(userId: string, input: Record<string, any> = {}) {
  const user = await ensureUserShareCode(userId);
  const { setting } = await ensureDistributionDefaults();
  const rewardPoints = getDailyShareRewardPoints(setting);
  const channel = normalizeShareChannel(input.channel);
  const path = normalizeSharePath(input.path);
  const rewardable = channel === 'friend' || channel === 'timeline';
  const now = new Date();
  const rewardDate = formatShanghaiDate(now);

  if (!rewardable || rewardPoints <= 0) {
    await prisma.shareEvent.create({
      data: {
        userId,
        shareCode: user.shareCode,
        channel,
        path,
        rewarded: false,
        rewardPoints: 0,
      },
    });
    return {
      awarded: false,
      alreadyRewarded: false,
      points: 0,
      rewardDate,
      shareCode: user.shareCode,
      sharePath: buildSharePath(user.shareCode),
    };
  }

  const settings = await getPointSettings();
  const expiredAt = new Date(now);
  expiredAt.setDate(expiredAt.getDate() + settings.expireDays);

  const result = await prisma.$transaction(async (tx) => {
    const existingReward = await tx.dailyShareReward.findUnique({
      where: { userId_rewardDate: { userId, rewardDate } },
    });

    if (existingReward) {
      await tx.shareEvent.create({
        data: {
          userId,
          shareCode: user.shareCode,
          channel,
          path,
          rewarded: false,
          rewardPoints: 0,
        },
      });
      return { awarded: false, alreadyRewarded: true, balanceAfter: null };
    }

    let account = await tx.pointsAccount.findUnique({ where: { userId } });
    if (!account) {
      account = await tx.pointsAccount.create({
        data: { userId, balance: 0, frozen: 0, expiredAt },
      });
    } else if (account.expiredAt < now) {
      account = await tx.pointsAccount.update({
        where: { userId },
        data: { balance: 0, expiredAt },
      });
    }

    const updated = await tx.pointsAccount.update({
      where: { userId },
      data: {
        balance: { increment: rewardPoints },
        expiredAt,
      },
    });
    const transactionId = crypto.randomUUID();
    await tx.pointsTransaction.create({
      data: {
        id: transactionId,
        userId,
        type: 'gift',
        amount: rewardPoints,
        balanceAfter: updated.balance,
        source: DAILY_SHARE_REWARD_SOURCE,
        sourceId: `${userId}:${rewardDate}`,
        remark: `每日分享赠送 ${rewardPoints} 点`,
      },
    });
    await tx.dailyShareReward.create({
      data: {
        userId,
        rewardDate,
        points: rewardPoints,
        transactionId,
      },
    });
    await tx.shareEvent.create({
      data: {
        userId,
        shareCode: user.shareCode,
        channel,
        path,
        rewarded: true,
        rewardPoints,
      },
    });
    return { awarded: true, alreadyRewarded: false, balanceAfter: updated.balance };
  });

  return {
    awarded: result.awarded,
    alreadyRewarded: result.alreadyRewarded,
    points: result.awarded ? rewardPoints : 0,
    balanceAfter: result.balanceAfter,
    rewardDate,
    shareCode: user.shareCode,
    sharePath: buildSharePath(user.shareCode),
  };
}

async function resolveReferralCode(db: any, userId: string, code: string) {
  const distributor = await db.distributor.findUnique({
    where: { code },
    include: { parent: true },
  });
  if (distributor) {
    if (!distributor.userId || distributor.userId === userId) return null;
    return {
      referrerUserId: distributor.userId,
      distributor,
    };
  }

  const referrer = await db.user.findUnique({
    where: { shareCode: code },
    include: { distributorProfile: { include: { parent: true } } },
  });
  if (!referrer || referrer.id === userId) return null;
  return {
    referrerUserId: referrer.id,
    distributor: referrer.distributorProfile,
  };
}

async function createShareReferralAndReward(db: any, userId: string, referrerUserId: string, sourceCode: string) {
  const shareReferral = await db.shareReferral.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      referrerUserId,
      sourceCode,
    },
  });
  await grantShareReferralReward(db, referrerUserId, shareReferral.id);
  return shareReferral;
}

async function grantShareReferralReward(db: any, referrerUserId: string, shareReferralId: string) {
  const distributionSetting = await getCurrentDistributionSetting(db);
  const rewardPoints = getReferralRewardPoints(distributionSetting);
  if (rewardPoints <= 0) return null;

  const settings = await getPointSettings();
  const now = new Date();
  const expiredAt = new Date(now);
  expiredAt.setDate(expiredAt.getDate() + settings.expireDays);

  let account = await db.pointsAccount.findUnique({ where: { userId: referrerUserId } });
  if (!account) {
    account = await db.pointsAccount.create({
      data: { userId: referrerUserId, balance: 0, frozen: 0, expiredAt },
    });
  } else if (account.expiredAt < now) {
    account = await db.pointsAccount.update({
      where: { userId: referrerUserId },
      data: { balance: 0, expiredAt },
    });
  }

  const updated = await db.pointsAccount.update({
    where: { userId: referrerUserId },
    data: {
      balance: { increment: rewardPoints },
      expiredAt,
    },
  });

  return db.pointsTransaction.create({
    data: {
      id: crypto.randomUUID(),
      userId: referrerUserId,
      type: 'gift',
      amount: rewardPoints,
      balanceAfter: updated.balance,
      source: SHARE_REFERRAL_REWARD_SOURCE,
      sourceId: shareReferralId,
      remark: `邀请新用户注册赠送 ${rewardPoints} 点`,
    },
  });
}

export async function settleDistributionCommissionForOrder(orderId: string) {
  await ensureDistributionDefaults();

  return prisma.$transaction((tx) => settleDistributionCommissionForOrderInTx(tx, orderId));
}

export async function backfillMissingDistributionCommissions(distributorId?: string) {
  await ensureDistributionDefaults();

  const distributors = await prisma.distributor.findMany({
    where: {
      status: 'active',
      ...(distributorId ? { id: distributorId } : {}),
    },
    select: { id: true },
  });

  let settledRows = 0;
  for (const distributor of distributors) {
    settledRows += await backfillMissingCommissionsForDistributor(distributor.id);
  }

  const removedSystemRows = distributorId ? 0 : await deleteResidualSystemCommissions(prisma);
  return { distributorCount: distributors.length, settledRows, removedSystemRows };
}

async function settleDistributionCommissionForOrderInTx(tx: any, orderId: string, options: { retrySettled?: boolean } = {}) {
  const order = await tx.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== 'paid') return null;
  if (order.commissionSettled && !options.retrySettled) return null;

  let referral = await ensureDistributionReferralForOrder(tx, order) || await tx.distributionReferral.findUnique({
    where: { userId: order.userId },
    include: { distributor: { include: { parent: true } } },
  });

  if (!referral) {
    if (!order.commissionSettled) {
      await tx.order.update({ where: { id: order.id }, data: { commissionSettled: true } });
    }
    return null;
  }

  referral = await syncReferralForCommission(tx, referral);
  if (!referral || !isOrderAfterDistributorApproval(order, referral.distributor)) {
    return null;
  }

  const setting = await tx.distributionSetting.findUnique({ where: { id: 'default' } });
  if (!setting?.enabled) {
    const eligibleAfter = maxDate(referral.createdAt, referral.distributor?.approvedAt);
    if (!referral.firstOrderId && await isFirstPaidOrderForUserAfter(tx, referral.userId, order.id, eligibleAfter)) {
      await tx.distributionReferral.update({
        where: { id: referral.id },
        data: { firstOrderId: order.id, commissionSettledAt: new Date() },
      });
    }
    await tx.order.update({ where: { id: order.id }, data: { commissionSettled: true } });
    return null;
  }

  const rows = await buildEligibleCommissionRows(tx, order, referral, setting);
  for (const row of rows) {
    await tx.distributionCommission.create({ data: row });
  }

  if (rows.some((row) => row.role === 'level1_direct' || row.role === 'level2_direct')) {
    await tx.distributionReferral.update({
      where: { id: referral.id },
      data: { firstOrderId: order.id, commissionSettledAt: new Date() },
    });
  }
  await tx.order.update({ where: { id: order.id }, data: { commissionSettled: true } });

  if (rows.length) {
    logger.info('分销佣金已结算: orderId=%s rows=%d amount=%d', order.id, rows.length, rows.reduce((sum, row) => sum + row.amount, 0));
  }
  return rows;
}

function isOrderAfterDistributorApproval(order: any, distributor: any) {
  if (!distributor?.approvedAt) return true;
  const paidAt = order.paidAt ? new Date(order.paidAt) : new Date();
  return paidAt >= new Date(distributor.approvedAt);
}

function isOrderAfterDate(order: any, date?: Date | string | null) {
  if (!date) return true;
  const paidAt = order.paidAt ? new Date(order.paidAt) : new Date();
  return paidAt >= new Date(date);
}

function maxDate(...values: Array<Date | string | null | undefined>) {
  const dates = values.filter(Boolean).map((value) => new Date(value as Date | string));
  if (!dates.length) return undefined;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

async function backfillMissingCommissionsForDistributor(distributorId: string) {
  await ensureDistributionDefaults();

  return prisma.$transaction(async (tx) => {
    let distributor = await tx.distributor.findUnique({
      where: { id: distributorId },
      include: { parent: true },
    });
    if (!distributor || distributor.status !== 'active') return 0;
    distributor = await syncDistributorParentFromInvitation(tx, distributor);
    if (!distributor) return 0;
    await syncDistributionReferralFirstLevel(tx, distributor);
    await migrateSystemOverrideCommissions(tx, distributor);

    await backfillDistributionReferralsForDistributor(tx, distributor);
    const setting = await tx.distributionSetting.findUnique({ where: { id: 'default' } });
    if (!setting) return 0;
    await normalizeDirectCommissionsForDistributor(tx, distributor, setting);

    const referrals = await tx.distributionReferral.findMany({
      where: {
        OR: [
          { distributorId: distributor.id },
          { firstLevelDistributorId: distributor.id },
        ],
      },
      include: { distributor: { include: { parent: true } } },
    });

    let settledRows = 0;
    const candidateOrderIds = new Set<string>();
    for (const referral of referrals) {
      const direct = referral.distributor;
      if (!direct || direct.status !== 'active') continue;

      if (direct.id === distributor.id) {
        const directEligibleAfter = maxDate(referral.createdAt, direct.approvedAt);
        const hasDirectCommission = await hasDirectCommissionForReferral(tx, referral.userId, distributor.id);
        if (!hasDirectCommission) {
          const firstDirectOrder = await findFirstPaidOrderForUserAfter(tx, referral.userId, directEligibleAfter);
          if (firstDirectOrder) candidateOrderIds.add(firstDirectOrder.id);
        }
      }

      if (distributor.level === 1 && direct.level === 2 && referral.firstLevelDistributorId === distributor.id) {
        const overrideEligibleAfter = maxDate(referral.createdAt, direct.approvedAt, distributor.approvedAt);
        const hasOverrideCommission = await hasCommissionForReferral(tx, referral.userId, distributor.id, 'level1_override');
        if (!hasOverrideCommission) {
          const firstOverrideOrder = await findFirstPaidOrderForUserAfter(
            tx,
            referral.userId,
            overrideEligibleAfter,
          );
          if (firstOverrideOrder) candidateOrderIds.add(firstOverrideOrder.id);
        }
      }
    }

    for (const orderId of candidateOrderIds) {
      const rows = await settleDistributionCommissionForOrderInTx(tx, orderId, { retrySettled: true });
      settledRows += rows?.length || 0;
    }

    return settledRows;
  });
}

async function syncReferralForCommission(db: any, referral: any) {
  if (!referral?.id || !referral.distributor) return referral;
  const syncedDistributor = await syncDistributorParentFromInvitation(db, referral.distributor);
  if (syncedDistributor?.level === 2) {
    await syncDistributionReferralFirstLevel(db, syncedDistributor);
  }
  return db.distributionReferral.findUnique({
    where: { id: referral.id },
    include: { distributor: { include: { parent: true } } },
  });
}

async function findFirstPaidOrderForUserAfter(db: any, userId: string, after?: Date | string | null) {
  return db.order.findFirst({
    where: {
      userId,
      status: 'paid',
      paidAt: after ? { gte: after } : { not: null },
    },
    orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
}

async function isFirstPaidOrderForUserAfter(db: any, userId: string, orderId: string, after?: Date | string | null) {
  const firstPaidOrder = await findFirstPaidOrderForUserAfter(db, userId, after);
  return firstPaidOrder?.id === orderId;
}

async function hasCommissionForReferral(db: any, referralUserId: string, distributorId: string, role: string) {
  const count = await db.distributionCommission.count({
    where: {
      referralUserId,
      distributorId,
      role,
    },
  });
  return count > 0;
}

async function hasDirectCommissionForReferral(db: any, referralUserId: string, distributorId: string) {
  const count = await db.distributionCommission.count({
    where: {
      referralUserId,
      distributorId,
      role: { in: DIRECT_COMMISSION_ROLES },
    },
  });
  return count > 0;
}

async function normalizeDirectCommissionsForDistributor(db: any, distributor: any, setting: any) {
  if (!distributor?.id || distributor.status !== 'active') return 0;

  const expectedRole = distributor.level === 1 ? 'level1_direct' : 'level2_direct';
  const expectedRate = distributor.level === 1 ? setting.level1Rate : setting.level2Rate;
  const referrals = await db.distributionReferral.findMany({
    where: { distributorId: distributor.id },
    select: { userId: true },
  });

  let changed = 0;
  for (const referral of referrals) {
    const directEligibleAfter = maxDate(referral.createdAt, distributor.approvedAt);
    const firstOrder = await db.order.findFirst({
      where: {
        userId: referral.userId,
        status: 'paid',
        paidAt: directEligibleAfter ? { gte: directEligibleAfter } : { not: null },
      },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, amount: true },
    });
    if (!firstOrder) continue;

    const rows = await db.distributionCommission.findMany({
      where: {
        referralUserId: referral.userId,
        distributorId: distributor.id,
        role: { in: DIRECT_COMMISSION_ROLES },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
    if (!rows.length) continue;

    const expectedAmount = calculateCommission(firstOrder.amount, expectedRate);
    const rowsOnExpectedOrder = rows.filter((row: any) => row.orderId === firstOrder.id);
    const existingExpected = rowsOnExpectedOrder.find((row: any) => row.role === expectedRole);
    const keep = existingExpected || rowsOnExpectedOrder[0];

    if (keep) {
      if (keep.role !== expectedRole || keep.rateBps !== expectedRate || keep.amount !== expectedAmount) {
        await db.distributionCommission.update({
          where: { id: keep.id },
          data: { role: expectedRole, rateBps: expectedRate, amount: expectedAmount },
        });
        changed += 1;
      }

      const duplicateIds = rows.filter((row: any) => row.id !== keep.id).map((row: any) => row.id);
      if (duplicateIds.length) {
        const result = await db.distributionCommission.deleteMany({ where: { id: { in: duplicateIds } } });
        changed += result.count || 0;
      }
    } else {
      const staleIds = rows.map((row: any) => row.id);
      const result = await db.distributionCommission.deleteMany({ where: { id: { in: staleIds } } });
      changed += result.count || 0;
    }
  }

  return changed;
}

async function deleteResidualSystemCommissions(db: any) {
  const result = await db.distributionCommission.deleteMany({
    where: { distributorId: SYSTEM_DISTRIBUTOR_ID },
  });
  return result.count || 0;
}

async function ensureDistributionReferralForOrder(db: any, order: any) {
  const existing = await db.distributionReferral.findUnique({
    where: { userId: order.userId },
    include: { distributor: { include: { parent: true } } },
  });
  if (existing) return existing;

  const shareReferral = await db.shareReferral.findUnique({
    where: { userId: order.userId },
    include: {
      referrer: {
        include: { distributorProfile: { include: { parent: true } } },
      },
    },
  });
  const distributor = shareReferral?.referrer?.distributorProfile;
  if (!shareReferral || !distributor || distributor.status !== 'active' || distributor.userId === order.userId) {
    return null;
  }

  const paidAt = order.paidAt ? new Date(order.paidAt) : new Date();
  const eligibleAfter = maxDate(shareReferral.createdAt, distributor.approvedAt);
  if (eligibleAfter && paidAt < eligibleAfter) {
    return null;
  }

  await createDistributionReferralFromDistributor(db, order.userId, distributor, shareReferral.sourceCode, shareReferral.createdAt);
  return db.distributionReferral.findUnique({
    where: { userId: order.userId },
    include: { distributor: { include: { parent: true } } },
  });
}

export async function getDistributionSettingsForAdmin() {
  const { setting } = await ensureDistributionDefaults();
  return formatDistributionSetting(setting);
}

export async function updateDistributionSettingsForAdmin(input: Record<string, any>) {
  const level1Rate = normalizeRateBps(input.level1Rate);
  const level2Rate = normalizeRateBps(input.level2Rate);
  const dailyShareReward = normalizePointAmount(input.dailyShareReward ?? DEFAULT_DAILY_SHARE_REWARD_POINTS, '每日分享赠点');
  const referralReward = normalizePointAmount(input.referralReward ?? DEFAULT_SHARE_REFERRAL_REWARD_POINTS, '好友注册奖励');
  const minWithdrawalAmount = normalizeMoneyAmount(input.minWithdrawalAmount ?? DEFAULT_MIN_WITHDRAWAL_AMOUNT, true);
  const withdrawalFreezeDays = normalizeFreezeDays(input.withdrawalFreezeDays ?? DEFAULT_WITHDRAWAL_FREEZE_DAYS);
  if (level1Rate < level2Rate) {
    throw new AppError(422, '一级分销比例不能低于二级分销比例', 'DISTRIBUTION_RATE_INVALID');
  }
  if (minWithdrawalAmount < 100) {
    throw new AppError(422, '最低提现金额不能低于 1 元', 'WITHDRAWAL_MIN_AMOUNT_INVALID');
  }

  const setting = await prisma.distributionSetting.upsert({
    where: { id: 'default' },
    update: {
      enabled: input.enabled !== false,
      level1Rate,
      level2Rate,
      dailyShareReward,
      referralReward,
      minWithdrawalAmount,
      withdrawalFreezeDays,
    },
    create: {
      id: 'default',
      enabled: input.enabled !== false,
      level1Rate,
      level2Rate,
      dailyShareReward,
      referralReward,
      minWithdrawalAmount,
      withdrawalFreezeDays,
    },
  });
  return formatDistributionSetting(setting);
}

export async function getDistributionDashboardForAdmin() {
  const { setting } = await ensureDistributionDefaults();
  const freezeDays = setting.withdrawalFreezeDays ?? DEFAULT_WITHDRAWAL_FREEZE_DAYS;
  const availableBefore = new Date();
  availableBefore.setDate(availableBefore.getDate() - freezeDays);
  const [
    distributorCount,
    level1Count,
    level2Count,
    referralCount,
    commissionCount,
    commissionTotal,
    settledCommissionTotal,
    withdrawalTotal,
    withdrawalPendingTotal,
  ] = await Promise.all([
    prisma.distributor.count({ where: { code: { not: SYSTEM_DISTRIBUTOR_CODE } } }),
    prisma.distributor.count({ where: { level: 1, code: { not: SYSTEM_DISTRIBUTOR_CODE } } }),
    prisma.distributor.count({ where: { level: 2 } }),
    prisma.distributionReferral.count(),
    prisma.distributionCommission.count({ where: realDistributorCommissionWhere() }),
    prisma.distributionCommission.aggregate({ where: realDistributorCommissionWhere(), _sum: { amount: true } }),
    prisma.distributionCommission.aggregate({
      where: {
        ...realDistributorCommissionWhere(),
        createdAt: { lte: availableBefore },
      },
      _sum: { amount: true },
    }),
    prisma.distributionWithdrawal.aggregate({ where: { status: 'paid' }, _sum: { amount: true } }),
    prisma.distributionWithdrawal.aggregate({ where: { status: { in: ['pending', 'approved'] } }, _sum: { amount: true } }),
  ]);
  const commissionAmount = commissionTotal._sum.amount || 0;
  const settledCommissionAmount = settledCommissionTotal._sum.amount || 0;

  return {
    distributorCount,
    level1Count,
    level2Count,
    referralCount,
    commissionCount,
    commissionAmount,
    settledCommissionAmount,
    frozenCommissionAmount: Math.max(0, commissionAmount - settledCommissionAmount),
    paidWithdrawalAmount: withdrawalTotal._sum.amount || 0,
    pendingWithdrawalAmount: withdrawalPendingTotal._sum.amount || 0,
    withdrawalFreezeDays: freezeDays,
  };
}

export async function listDistributorsForAdmin(params: Record<string, any>) {
  await ensureDistributionDefaults();
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || '20', 10)));
  const keyword = String(params.keyword || '').trim();
  const level = params.level ? Number(params.level) : undefined;
  const status = String(params.status || '').trim();

  const where: any = { code: { not: SYSTEM_DISTRIBUTOR_CODE } };
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

export async function listDistributorTreeForAdmin(params: Record<string, any>) {
  await ensureDistributionDefaults();
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || '20', 10)));
  const keyword = String(params.keyword || '').trim();
  const level = params.level ? Number(params.level) : undefined;
  const status = String(params.status || '').trim();

  const distributors = await prisma.distributor.findMany({
    where: { code: { not: SYSTEM_DISTRIBUTOR_CODE } },
    orderBy: [{ level: 'asc' }, { createdAt: 'desc' }],
    include: {
      user: { select: { id: true, nickname: true, phone: true, createdAt: true, shareCode: true } },
      parent: { select: { id: true, name: true, code: true } },
      _count: { select: { children: true, referrals: true, commissions: true } },
    },
  });

  const realLevelOneIds = new Set(distributors.filter(item => item.level === 1).map(item => item.id));
  const childrenByParent = new Map<string, any[]>();
  const unassignedChildren: any[] = [];
  for (const item of distributors) {
    if (item.level !== 2) continue;
    if (item.parentId && realLevelOneIds.has(item.parentId)) {
      const children = childrenByParent.get(item.parentId) || [];
      children.push(item);
      childrenByParent.set(item.parentId, children);
    } else {
      unassignedChildren.push(item);
    }
  }

  const roots: any[] = distributors
    .filter(item => item.level === 1)
    .map(item => ({ ...item, children: childrenByParent.get(item.id) || [] }));

  if (unassignedChildren.length) {
    roots.push({
      id: 'unassigned-level-one',
      name: '未归属一级',
      code: 'UNASSIGNED',
      level: 1,
      parentId: null,
      status: 'active',
      userId: null,
      user: null,
      parent: null,
      isGroup: true,
      createdAt: null,
      approvedAt: null,
      _count: {
        children: unassignedChildren.length,
        referrals: unassignedChildren.reduce((sum, item) => sum + (item._count?.referrals || 0), 0),
        commissions: unassignedChildren.reduce((sum, item) => sum + (item._count?.commissions || 0), 0),
      },
      children: unassignedChildren,
    });
  }

  const filtered = roots
    .map((root) => {
      const rootMatches = distributorMatchesTreeFilter(root, { keyword, level, status });
      const children = (root.children || []).filter((child: any) => distributorMatchesTreeFilter(child, { keyword, level, status }));
      const shouldInclude = rootMatches || children.length > 0 || (!keyword && !status && !level);
      if (!shouldInclude) return null;
      return {
        ...root,
        children: rootMatches && level !== 2 && !status && !keyword ? root.children : children,
        childCount: root.children?.length || 0,
      };
    })
    .filter(Boolean) as any[];

  const total = filtered.length;
  const list = filtered.slice((page - 1) * pageSize, page * pageSize);
  return { list, total, page, pageSize };
}

export async function listLevelOneDistributorsForAdmin() {
  await ensureDistributionDefaults();
  return prisma.distributor.findMany({
    where: { level: 1, status: 'active', code: { not: SYSTEM_DISTRIBUTOR_CODE } },
    orderBy: [{ code: 'asc' }],
    select: { id: true, name: true, code: true, userId: true, newUserGiftOverride: true },
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
  const status = normalizeDistributorStatus(input.status);
  const invitedParentId = level === 2 && status === 'active'
    ? await resolveDistributorParentFromShareReferral(prisma, userId)
    : null;
  const parentId = level === 2 ? await resolveLevel2ParentId(input.parentId || invitedParentId) : null;
  const newUserGiftOverride = level === 1 ? normalizeOptionalPointAmount(input.newUserGiftOverride, '特邀合作伙伴新用户赠点') : null;
  const distributor = await prisma.distributor.create({
    data: {
      userId,
      name: String(input.name || user.nickname || user.phone || `分销员${userId.slice(0, 6)}`).trim(),
      code: await generateDistributorCode(userId),
      level,
      parentId,
      status,
      newUserGiftOverride,
      approvedAt: status === 'active' ? new Date() : null,
    },
  });
  return status === 'active' ? syncDistributorParentFromInvitation(prisma, distributor) : distributor;
}

export async function updateDistributorForAdmin(id: string, input: Record<string, any>) {
  const distributor = await prisma.distributor.findUnique({ where: { id }, include: { children: true } });
  if (!distributor) throw new AppError(404, '分销员不存在', 'DISTRIBUTOR_NOT_FOUND');

  const data: any = {};
  if (input.name !== undefined) data.name = String(input.name || distributor.name).trim();
  if (input.status !== undefined) {
    data.status = normalizeDistributorStatus(input.status);
    if (data.status === 'active' && (distributor.status !== 'active' || !distributor.approvedAt)) {
      data.approvedAt = new Date();
    } else if (data.status !== 'active') {
      data.approvedAt = null;
    }
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
    if (input.newUserGiftOverride !== undefined) {
      data.newUserGiftOverride = normalizeOptionalPointAmount(input.newUserGiftOverride, '特邀合作伙伴新用户赠点');
    }
  } else {
    const invitedParentId = data.status === 'active' || (!data.status && distributor.status === 'active')
      ? await resolveDistributorParentFromShareReferral(prisma, distributor.userId)
      : null;
    data.parentId = await resolveLevel2ParentId(input.parentId || invitedParentId || distributor.parentId);
    data.newUserGiftOverride = null;
  }

  return prisma.$transaction(async (tx) => {
    if (distributor.level === 1 && nextLevel === 2 && distributor.children.length) {
      const { system } = await ensureDistributionDefaults(tx);
      await tx.distributor.updateMany({
        where: { parentId: distributor.id },
        data: { parentId: system.id },
      });
    }
    const updated = await tx.distributor.update({ where: { id }, data });
    if (updated.status === 'active') {
      await backfillDistributionReferralsForDistributor(tx, updated);
    }
    return updated;
  });
}

export async function listCommissionsForAdmin(params: Record<string, any>) {
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || '20', 10)));
  const where: any = realDistributorCommissionWhere();
  if (params.distributorId) where.distributorId = String(params.distributorId);
  return listCommissionsByWhere(where, page, pageSize);
}

export async function listWithdrawalsForAdmin(params: Record<string, any>) {
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || '20', 10)));
  const where: any = {};
  if (params.distributorId) where.distributorId = String(params.distributorId);
  if (params.status) where.status = String(params.status);
  return listWithdrawalsByWhere(where, page, pageSize);
}

export async function reviewWithdrawalForAdmin(id: string, input: Record<string, any>) {
  const status = normalizeWithdrawalStatus(input.status);
  const withdrawal = await prisma.distributionWithdrawal.findUnique({
    where: { id },
    include: { distributor: true },
  });
  if (!withdrawal) throw new AppError(404, '提现申请不存在', 'WITHDRAWAL_NOT_FOUND');

  if (withdrawal.status === 'paid') {
    throw new AppError(409, '已打款的提现不能重复处理', 'WITHDRAWAL_ALREADY_PAID');
  }

  const now = new Date();
  const data: any = {
    status,
    adminRemark: String(input.adminRemark || '').trim().slice(0, 200) || null,
  };
  if (status === 'approved') data.reviewedAt = withdrawal.reviewedAt || now;
  if (status === 'rejected') data.reviewedAt = now;
  if (status === 'paid') {
    data.reviewedAt = withdrawal.reviewedAt || now;
    data.paidAt = now;
    data.transferNo = String(input.transferNo || withdrawal.transferNo || '').trim().slice(0, 100) || null;
  }
  if (status === 'failed') data.failedAt = now;

  const updated = await prisma.distributionWithdrawal.update({
    where: { id },
    data,
    include: withdrawalInclude(),
  });

  return {
    withdrawal: updated,
    summary: await getDistributorWithdrawalSummary(updated.distributorId),
  };
}

function realDistributorCommissionWhere() {
  return { distributor: { code: { not: SYSTEM_DISTRIBUTOR_CODE } } };
}

function distributorMatchesTreeFilter(distributor: any, filter: { keyword: string; level?: number; status: string }) {
  if (filter.level === 1 || filter.level === 2) {
    if (distributor.level !== filter.level) return false;
  }
  if (filter.status && distributor.status !== filter.status) return false;
  if (!filter.keyword) return true;
  const text = [
    distributor.name,
    distributor.code,
    distributor.userId,
    distributor.user?.nickname,
    distributor.user?.phone,
    distributor.user?.shareCode,
    distributor.parent?.name,
    distributor.parent?.code,
  ].filter(Boolean).join(' ').toLowerCase();
  return text.includes(filter.keyword.toLowerCase());
}

async function buildEligibleCommissionRows(db: any, order: any, referral: any, setting: any) {
  const rows: any[] = [];
  const direct = referral.distributor;
  if (!direct || direct.status !== 'active') return rows;

  if (direct.level === 1) {
    const directEligibleAfter = maxDate(referral.createdAt, direct.approvedAt);
    const canSettleDirect = await isFirstPaidOrderForUserAfter(db, referral.userId, order.id, directEligibleAfter)
      && !await hasDirectCommissionForReferral(db, referral.userId, direct.id);
    if (canSettleDirect) {
      const amount = calculateCommission(order.amount, setting.level1Rate);
      if (amount > 0) {
        rows.push(buildCommissionRow(order, direct.id, referral.userId, 'level1_direct', setting.level1Rate, amount));
      }
    }
    return rows;
  }

  const directEligibleAfter = maxDate(referral.createdAt, direct.approvedAt);
  const canSettleLevel2Direct = await isFirstPaidOrderForUserAfter(db, referral.userId, order.id, directEligibleAfter)
    && !await hasDirectCommissionForReferral(db, referral.userId, direct.id);
  if (canSettleLevel2Direct) {
    const level2Amount = calculateCommission(order.amount, setting.level2Rate);
    if (level2Amount > 0) {
      rows.push(buildCommissionRow(order, direct.id, referral.userId, 'level2_direct', setting.level2Rate, level2Amount));
    }
  }

  const parent = direct.parent;
  const parentRate = Math.max(0, setting.level1Rate - setting.level2Rate);
  const parentEligibleAfter = maxDate(referral.createdAt, direct.approvedAt, parent?.approvedAt);
  const canSettleParentOverride = parent?.id
    && parent.id !== SYSTEM_DISTRIBUTOR_ID
    && parent.status === 'active'
    && parentRate > 0
    && isOrderAfterDate(order, parentEligibleAfter)
    && await isFirstPaidOrderForUserAfter(db, referral.userId, order.id, parentEligibleAfter)
    && !await hasCommissionForReferral(db, referral.userId, parent.id, 'level1_override');
  if (canSettleParentOverride) {
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

async function listWithdrawalsByWhere(where: any, page: number, pageSize: number) {
  const [list, total] = await Promise.all([
    prisma.distributionWithdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: withdrawalInclude(),
    }),
    prisma.distributionWithdrawal.count({ where }),
  ]);

  return { list, total, page, pageSize };
}

function withdrawalInclude() {
  return {
    distributor: {
      select: {
        id: true,
        name: true,
        code: true,
        level: true,
        user: { select: { id: true, nickname: true, phone: true, miniOpenId: true, mpOpenId: true } },
      },
    },
  };
}

async function getDistributorWithdrawalSummary(distributorId: string, setting?: any) {
  const currentSetting = setting || (await ensureDistributionDefaults()).setting;
  const freezeDays = currentSetting.withdrawalFreezeDays ?? DEFAULT_WITHDRAWAL_FREEZE_DAYS;
  const availableBefore = new Date();
  availableBefore.setDate(availableBefore.getDate() - freezeDays);

  const [
    commissionTotal,
    availableCommissionTotal,
    pendingWithdrawalTotal,
    paidWithdrawalTotal,
  ] = await Promise.all([
    prisma.distributionCommission.aggregate({
      where: { distributorId },
      _sum: { amount: true },
    }),
    prisma.distributionCommission.aggregate({
      where: {
        distributorId,
        createdAt: { lte: availableBefore },
      },
      _sum: { amount: true },
    }),
    prisma.distributionWithdrawal.aggregate({
      where: {
        distributorId,
        status: { in: LOCKED_WITHDRAWAL_STATUSES },
      },
      _sum: { amount: true },
    }),
    prisma.distributionWithdrawal.aggregate({
      where: {
        distributorId,
        status: 'paid',
      },
      _sum: { amount: true },
    }),
  ]);

  const commissionAmount = commissionTotal._sum.amount || 0;
  const settledCommissionAmount = availableCommissionTotal._sum.amount || 0;
  const lockedWithdrawalAmount = pendingWithdrawalTotal._sum.amount || 0;
  const paidWithdrawalAmount = paidWithdrawalTotal._sum.amount || 0;
  const availableWithdrawalAmount = Math.max(0, settledCommissionAmount - lockedWithdrawalAmount - paidWithdrawalAmount);
  const frozenCommissionAmount = Math.max(0, commissionAmount - settledCommissionAmount);

  return {
    commissionAmount,
    settledCommissionAmount,
    frozenCommissionAmount,
    availableWithdrawalAmount,
    lockedWithdrawalAmount,
    paidWithdrawalAmount,
    minWithdrawalAmount: currentSetting.minWithdrawalAmount || DEFAULT_MIN_WITHDRAWAL_AMOUNT,
    withdrawalFreezeDays: freezeDays,
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
  while (await isShareOrDistributorCodeTaken(code)) {
    code = `${base}${index}`;
    index += 1;
  }
  return code;
}

async function generateUserShareCode(userId: string, db: any = prisma) {
  const seed = userId.replace(/-/g, '').slice(0, 8).toUpperCase();
  let code = `ZS${seed}`;
  let index = 1;
  while (await isShareOrDistributorCodeTaken(code, db)) {
    code = `ZS${seed}${index}`;
    index += 1;
  }
  return code;
}

async function generateWithdrawalNo() {
  const date = formatShanghaiDate(new Date()).replace(/-/g, '');
  let withdrawalNo = '';
  do {
    withdrawalNo = `WD${date}${crypto.randomInt(100000, 999999)}`;
  } while (await prisma.distributionWithdrawal.findUnique({ where: { withdrawalNo }, select: { id: true } }));
  return withdrawalNo;
}

async function isShareOrDistributorCodeTaken(code: string, db: any = prisma) {
  const [user, distributor] = await Promise.all([
    db.user.findUnique({ where: { shareCode: code }, select: { id: true } }),
    db.distributor.findUnique({ where: { code }, select: { id: true } }),
  ]);
  return Boolean(user || distributor);
}

function userShareSelect() {
  return {
    id: true,
    nickname: true,
    avatar: true,
    phone: true,
    status: true,
    createdAt: true,
    shareCode: true,
  };
}

function normalizeDistributorCode(value?: string) {
  return String(value || '').trim().replace(/^d=/i, '').toUpperCase();
}

function normalizeShareChannel(value: any) {
  const channel = String(value || 'friend').trim().toLowerCase();
  if (['friend', 'timeline', 'copy', 'qrcode'].includes(channel)) return channel;
  return 'friend';
}

function normalizeSharePath(value: any) {
  const path = String(value || '').trim();
  return path ? path.slice(0, 500) : '';
}

function formatShanghaiDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function startOfShanghaiDay(date: Date) {
  const dateText = formatShanghaiDate(date);
  return new Date(`${dateText}T00:00:00+08:00`);
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
  if (status === 'pending' || status === 'disabled' || status === 'rejected') return status;
  return 'active';
}

function normalizeRateBps(value: any) {
  const rate = Math.round(Number(value));
  if (!Number.isFinite(rate) || rate < 0 || rate > 10000) {
    throw new AppError(422, '分销比例必须在 0% 到 100% 之间', 'DISTRIBUTION_RATE_INVALID');
  }
  return rate;
}

function normalizePointAmount(value: any, label: string) {
  const points = Math.round(Number(value));
  if (!Number.isFinite(points) || points < 0 || points > 100000) {
    throw new AppError(422, `${label}必须是 0-100000 之间的整数`, 'POINT_AMOUNT_INVALID');
  }
  return points;
}

function normalizeOptionalPointAmount(value: any, label: string) {
  if (value === null || value === undefined || value === '') return null;
  return normalizePointAmount(value, label);
}

function normalizeMoneyAmount(value: any, allowZero = false) {
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount) || amount < (allowZero ? 0 : 1)) {
    throw new AppError(422, '金额格式不正确', 'MONEY_AMOUNT_INVALID');
  }
  return amount;
}

function formatYuan(amount: number) {
  return `${(Number(amount || 0) / 100).toFixed(2)} 元`;
}

function normalizeFreezeDays(value: any) {
  const days = Math.round(Number(value));
  if (!Number.isFinite(days) || days < 0 || days > 90) {
    throw new AppError(422, '冻结天数必须在 0 到 90 天之间', 'WITHDRAWAL_FREEZE_DAYS_INVALID');
  }
  return days;
}

function normalizeWithdrawalStatus(value: any) {
  const status = String(value || '').trim();
  if (['approved', 'rejected', 'paid', 'failed'].includes(status)) return status;
  throw new AppError(422, '提现状态不正确', 'WITHDRAWAL_STATUS_INVALID');
}

function formatDistributionSetting(setting: any) {
  return {
    enabled: setting.enabled,
    level1Rate: setting.level1Rate,
    level2Rate: setting.level2Rate,
    dailyShareReward: getDailyShareRewardPoints(setting),
    referralReward: getReferralRewardPoints(setting),
    minWithdrawalAmount: setting.minWithdrawalAmount ?? DEFAULT_MIN_WITHDRAWAL_AMOUNT,
    withdrawalFreezeDays: setting.withdrawalFreezeDays ?? DEFAULT_WITHDRAWAL_FREEZE_DAYS,
    level1Percent: setting.level1Rate / 100,
    level2Percent: setting.level2Rate / 100,
    minWithdrawalYuan: (setting.minWithdrawalAmount ?? DEFAULT_MIN_WITHDRAWAL_AMOUNT) / 100,
  };
}

async function getCurrentDistributionSetting(db: any = prisma) {
  const setting = await db.distributionSetting.findUnique({ where: { id: 'default' } });
  return setting || (await ensureDistributionDefaults(db)).setting;
}

function getDailyShareRewardPoints(setting: any) {
  return normalizePointAmount(setting?.dailyShareReward ?? DEFAULT_DAILY_SHARE_REWARD_POINTS, '每日分享赠点');
}

function getReferralRewardPoints(setting: any) {
  return normalizePointAmount(setting?.referralReward ?? DEFAULT_SHARE_REFERRAL_REWARD_POINTS, '好友注册奖励');
}

function emptyDistributionStats() {
  return {
    directReferralCount: 0,
    paidReferralCount: 0,
    teamReferralCount: 0,
    commissionCount: 0,
    commissionAmount: 0,
    settledCommissionAmount: 0,
    frozenCommissionAmount: 0,
    availableWithdrawalAmount: 0,
    lockedWithdrawalAmount: 0,
    paidWithdrawalAmount: 0,
    minWithdrawalAmount: DEFAULT_MIN_WITHDRAWAL_AMOUNT,
    withdrawalFreezeDays: DEFAULT_WITHDRAWAL_FREEZE_DAYS,
    shareReferralCount: 0,
    shareRewardCount: 0,
  };
}

async function buildShareOnlyDistribution(userId: string, user: any, setting: any, canApply: boolean) {
  const [shareReferralCount, shareRewardCount, shareReferral] = await Promise.all([
    prisma.shareReferral.count({ where: { referrerUserId: userId } }),
    prisma.pointsTransaction.count({ where: { userId, source: SHARE_REFERRAL_REWARD_SOURCE } }),
    getUserShareReferral(userId),
  ]);

  return {
    distributor: null,
    setting: formatDistributionSetting(setting),
    stats: { ...emptyDistributionStats(), shareReferralCount, shareRewardCount },
    shareReferral: formatShareReferral(shareReferral),
    shareCode: user.shareCode,
    sharePath: buildSharePath(user.shareCode),
    dailyShareRewardPoints: getDailyShareRewardPoints(setting),
    referralRewardPoints: getReferralRewardPoints(setting),
    canApply,
  };
}

function getUserShareReferral(userId: string) {
  return prisma.shareReferral.findUnique({
    where: { userId },
    include: {
      referrer: {
        select: {
          id: true,
          nickname: true,
          phone: true,
          shareCode: true,
        },
      },
    },
  });
}

function formatShareReferral(referral: any) {
  if (!referral) return null;
  return {
    id: referral.id,
    sourceCode: referral.sourceCode,
    createdAt: referral.createdAt,
    referrer: referral.referrer
      ? {
          id: referral.referrer.id,
          nickname: referral.referrer.nickname,
          phone: maskPhone(referral.referrer.phone),
          shareCode: referral.referrer.shareCode,
        }
      : null,
  };
}

function maskPhone(phone?: string | null) {
  if (!phone) return '';
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function buildSharePath(code: string) {
  return `pages/volunteer/index?ref=${encodeURIComponent(code)}`;
}

async function tryGenerateMiniQrCode(scene: string, page: string) {
  try {
    let response = await requestMiniQrCode(scene, page, await getMiniAccessToken());
    let errorDetail = readMiniQrCodeError(response);
    if (isWechatAccessTokenInvalid(errorDetail)) {
      miniAccessTokenCache = null;
      response = await requestMiniQrCode(scene, page, await getMiniAccessToken(true));
      errorDetail = readMiniQrCodeError(response);
    }

    const body = Buffer.from(response.data);
    if (errorDetail) {
      logger.warn({ errorDetail }, 'wechat mini qrcode generation failed, using invite code fallback');
      return null;
    }

    return { dataUrl: `data:image/png;base64,${body.toString('base64')}` };
  } catch (error: any) {
    logger.warn({ err: error?.message || error }, 'wechat mini qrcode unavailable, using invite code fallback');
    return null;
  }
}

async function generateInviteCodeQrDataUrl(shareCode: string, sharePath: string) {
  const content = `zhangshi://invite?code=${encodeURIComponent(shareCode)}&path=${encodeURIComponent(sharePath)}`;
  return QRCode.toDataURL(content, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
    color: {
      dark: '#0f766e',
      light: '#ffffff',
    },
  });
}

async function getMiniAccessToken(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && miniAccessTokenCache && miniAccessTokenCache.expiresAt > now + 60_000) {
    return miniAccessTokenCache.token;
  }

  const { appId, secret } = await resolveMiniProgramCredentials();
  if (!appId || !secret || /^(wx_.*|your_.*)$/i.test(appId) || /^(wx_.*|your_.*)$/i.test(secret)) {
    throw new AppError(503, '微信小程序参数未配置，无法生成小程序码', 'WECHAT_MINI_NOT_CONFIGURED');
  }

  const { data } = await axios.post(
    'https://api.weixin.qq.com/cgi-bin/stable_token',
    {
      grant_type: 'client_credential',
      appid: appId,
      secret,
      force_refresh: forceRefresh,
    },
    { timeout: 10000 },
  );

  if (data.errcode) {
    throw new AppError(502, `微信 access_token 获取失败：${data.errmsg}`, 'WECHAT_ACCESS_TOKEN_FAIL', data);
  }

  miniAccessTokenCache = {
    token: data.access_token,
    expiresAt: now + Math.max(0, Number(data.expires_in || 7200) - 300) * 1000,
  };
  return miniAccessTokenCache.token;
}

async function requestMiniQrCode(scene: string, page: string, token: string) {
  return axios.post(
    `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token)}`,
    {
      scene,
      page,
      check_path: false,
      env_version: 'release',
    },
    { responseType: 'arraybuffer', timeout: 15000 },
  );
}

function readMiniQrCodeError(response: any) {
  const body = Buffer.from(response.data);
  const contentType = String(response.headers['content-type'] || '');
  if (!contentType.includes('json')) return null;
  return safeJson(body.toString('utf8'), {});
}

function isWechatAccessTokenInvalid(data: any) {
  return [40001, 40014, 42001].includes(Number(data?.errcode));
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
