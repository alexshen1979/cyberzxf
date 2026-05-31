import axios from 'axios';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { config } from '../config';
import { getPointSettings } from './point-config.service';
import {
  createWechatMerchantTransfer,
  getWechatTransferRuntimeConfig,
  handleWechatTransferNotify,
  queryWechatMerchantTransferByOutBillNo,
} from './wechat-transfer.service';

const logger = createLogger('distribution');
const SYSTEM_DISTRIBUTOR_ID = 'system-distributor';
const SYSTEM_DISTRIBUTOR_CODE = 'SYSTEM';
const DEFAULT_LEVEL1_RATE = 5000;
const DEFAULT_LEVEL2_RATE = 2000;
const DEFAULT_MIN_WITHDRAWAL_AMOUNT = 1000;
const DEFAULT_WITHDRAWAL_FREEZE_DAYS = 7;
const DEFAULT_TRANSFER_SCENE_ID = '1005';
const DEFAULT_TRANSFER_SCENE_NAME = '佣金报酬';
const DEFAULT_TRANSFER_DAILY_LIMIT = 5000000;
const DEFAULT_TRANSFER_SINGLE_MIN = 10;
const DEFAULT_TRANSFER_SINGLE_MAX = 20000;
const DEFAULT_TRANSFER_USER_DAILY_LIMIT = 200000;
const DEFAULT_TRANSFER_USER_CONFIRM = true;
const DEFAULT_TRANSFER_REPORT_JOB_TYPE = '推广服务';
const DEFAULT_TRANSFER_REPORT_REWARD_DESC = '涨识推荐合作佣金报酬';
const DEFAULT_RECURRING_COMMISSION_ENABLED = false;
const DEFAULT_RECURRING_LEVEL1_RATE = 1000;
const DEFAULT_RECURRING_LEVEL2_RATE = 500;
const DEFAULT_RECURRING_COMMISSION_DAYS = 180;
const DEFAULT_GENERAL_AGENT_RATE = 2000;
const DEFAULT_DAILY_SHARE_REWARD_POINTS = 10;
const DAILY_SHARE_REWARD_SOURCE = 'daily_share_reward';
const DEFAULT_SHARE_REFERRAL_REWARD_POINTS = 20;
const SHARE_REFERRAL_REWARD_SOURCE = 'share_referral_reward';
const PARTNER_NEW_USER_EXTRA_GIFT_SOURCE = 'partner_new_user_extra_gift';
const DIRECT_COMMISSION_ROLES = ['level1_direct', 'level2_direct'];
const TRANSFERRING_WITHDRAWAL_STATUSES = ['transferring', 'wait_user_confirm'];
const LOCKED_WITHDRAWAL_STATUSES = ['pending', 'approved', ...TRANSFERRING_WITHDRAWAL_STATUSES];
const WECHAT_TRANSFER_SUCCESS_STATES = ['SUCCESS'];
const WECHAT_TRANSFER_CONFIRM_STATES = ['WAIT_USER_CONFIRM'];
const WECHAT_TRANSFER_PROCESSING_STATES = ['ACCEPTED', 'PROCESSING', 'WAIT_USER_CONFIRM'];
const WECHAT_TRANSFER_FAILED_STATES = ['FAIL', 'CANCELING', 'CANCELLED'];

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
        transferSceneId: DEFAULT_TRANSFER_SCENE_ID,
        transferSceneName: DEFAULT_TRANSFER_SCENE_NAME,
        transferDailyLimit: DEFAULT_TRANSFER_DAILY_LIMIT,
        transferSingleMin: DEFAULT_TRANSFER_SINGLE_MIN,
        transferSingleMax: DEFAULT_TRANSFER_SINGLE_MAX,
        transferUserDailyLimit: DEFAULT_TRANSFER_USER_DAILY_LIMIT,
        transferUserConfirm: DEFAULT_TRANSFER_USER_CONFIRM,
        transferReportJobType: DEFAULT_TRANSFER_REPORT_JOB_TYPE,
        transferReportRewardDesc: DEFAULT_TRANSFER_REPORT_REWARD_DESC,
        recurringCommissionEnabled: DEFAULT_RECURRING_COMMISSION_ENABLED,
        recurringLevel1Rate: DEFAULT_RECURRING_LEVEL1_RATE,
        recurringLevel2Rate: DEFAULT_RECURRING_LEVEL2_RATE,
        recurringCommissionDays: DEFAULT_RECURRING_COMMISSION_DAYS,
      },
    }),
    db.distributor.upsert({
      where: { code: SYSTEM_DISTRIBUTOR_CODE },
      update: { level: 1, parentId: null, generalAgentParentId: null, generalAgentParentAssignedAt: null, isGeneralAgent: false, status: 'active' },
      create: {
        id: SYSTEM_DISTRIBUTOR_ID,
        name: '系统',
        code: SYSTEM_DISTRIBUTOR_CODE,
        level: 1,
        isGeneralAgent: false,
        generalAgentRate: DEFAULT_GENERAL_AGENT_RATE,
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

export async function grantPartnerNewUserExtraGift(db: any, userId: string, referralCode?: string) {
  const code = normalizeDistributorCode(referralCode);
  if (!code) return null;

  const existing = await db.pointsTransaction.findFirst({
    where: { userId, source: PARTNER_NEW_USER_EXTRA_GIFT_SOURCE },
    select: { id: true },
  });
  if (existing) return null;

  const resolved = await resolveReferralCode(db, userId, code);
  const levelOne = await resolveLevelOneDistributorForExtraGift(db, resolved?.distributor);
  const extraPoints = normalizeOptionalPointAmount(levelOne?.newUserGiftOverride, '特邀合作伙伴新用户额外赠点') || 0;
  if (!levelOne || extraPoints <= 0) return null;

  const settings = await getPointSettings();
  const now = new Date();
  const expiredAt = new Date(now);
  expiredAt.setDate(expiredAt.getDate() + settings.expireDays);

  let account = await db.pointsAccount.findUnique({ where: { userId } });
  if (!account) {
    account = await db.pointsAccount.create({
      data: { userId, balance: 0, frozen: 0, expiredAt },
    });
  } else if (account.expiredAt < now) {
    account = await db.pointsAccount.update({
      where: { userId },
      data: { balance: 0, expiredAt },
    });
  }

  const updated = await db.pointsAccount.update({
    where: { userId },
    data: {
      balance: { increment: extraPoints },
      expiredAt,
    },
  });

  return db.pointsTransaction.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      type: 'gift',
      amount: extraPoints,
      balanceAfter: updated.balance,
      source: PARTNER_NEW_USER_EXTRA_GIFT_SOURCE,
      sourceId: levelOne.id,
      remark: `特邀合作伙伴额外赠送 ${extraPoints} 点`,
    },
  });
}

async function resolveLevelOneDistributorForExtraGift(db: any, distributor?: any) {
  if (!distributor) return null;
  if (distributor.status !== 'active') return null;
  const levelOne = distributor.level === 1
    ? distributor
    : (distributor.parent || (distributor.parentId
      ? await db.distributor.findUnique({ where: { id: distributor.parentId } })
      : null));

  if (!levelOne || levelOne.level !== 1 || levelOne.status !== 'active') return null;
  if (levelOne.code === SYSTEM_DISTRIBUTOR_CODE) return null;
  return levelOne;
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
    const extraGift = await grantPartnerNewUserExtraGift(tx, userId, code);
    let distributionReferral = null;
    const distributor = resolved.distributor;
    if (distributor?.status === 'active' && distributor.userId !== userId) {
      distributionReferral = await createDistributionReferralFromDistributor(tx, userId, distributor, code, shareReferral.createdAt);
    }

    return {
      shareReferral,
      distributionReferral,
      extraGiftPoints: extraGift?.amount || 0,
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

  const userWithShareCode = await ensureUserShareCode(userId);
  await prisma.distributor.create({
    data: {
      userId,
      name: user.nickname || user.phone || `分销员${userId.slice(0, 6)}`,
      code: userWithShareCode.shareCode || await generateDistributorCode(userId),
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
    distributor: formatDistributorForMini(distributor),
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
  await assertWithdrawalTransferRule(amount, userId, setting);

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
  const generalAgentRows: any[] = [];

  let referral = await ensureDistributionReferralForOrder(tx, order) || await tx.distributionReferral.findUnique({
    where: { userId: order.userId },
    include: { distributor: { include: { parent: true } } },
  });

  if (!referral) {
    generalAgentRows.push(...await buildEligibleGeneralAgentCommissionRowsForPersonalOrder(tx, order));
    for (const row of generalAgentRows) {
      await tx.generalAgentCommission.create({ data: row });
    }
    if (!order.commissionSettled) {
      await tx.order.update({ where: { id: order.id }, data: { commissionSettled: true } });
    }
    return generalAgentRows.length ? generalAgentRows : null;
  }

  referral = await syncReferralForCommission(tx, referral);
  if (!referral || !isOrderAfterDistributorApproval(order, referral.distributor)) {
    generalAgentRows.push(...await buildEligibleGeneralAgentCommissionRowsForPersonalOrder(tx, order));
    for (const row of generalAgentRows) {
      await tx.generalAgentCommission.create({ data: row });
    }
    return generalAgentRows.length ? generalAgentRows : null;
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
    appendUniqueGeneralAgentRows(generalAgentRows, await buildEligibleGeneralAgentCommissionRows(tx, order, referral));
    appendUniqueGeneralAgentRows(generalAgentRows, await buildEligibleGeneralAgentCommissionRowsForPersonalOrder(tx, order));
    for (const row of generalAgentRows) {
      await tx.generalAgentCommission.create({ data: row });
    }
    await tx.order.update({ where: { id: order.id }, data: { commissionSettled: true } });
    return generalAgentRows.length ? generalAgentRows : null;
  }

  const rows = await buildEligibleCommissionRows(tx, order, referral, setting);
  for (const row of rows) {
    await tx.distributionCommission.create({ data: row });
  }
  appendUniqueGeneralAgentRows(generalAgentRows, await buildEligibleGeneralAgentCommissionRows(tx, order, referral));
  appendUniqueGeneralAgentRows(generalAgentRows, await buildEligibleGeneralAgentCommissionRowsForPersonalOrder(tx, order));
  for (const row of generalAgentRows) {
    await tx.generalAgentCommission.create({ data: row });
  }

  if (rows.some((row) => row.role === 'level1_direct' || row.role === 'level2_direct')) {
    await tx.distributionReferral.update({
      where: { id: referral.id },
      data: { firstOrderId: order.id, commissionSettledAt: new Date() },
    });
  }
  await tx.order.update({ where: { id: order.id }, data: { commissionSettled: true } });

  if (rows.length || generalAgentRows.length) {
    logger.info(
      '分销佣金已结算: orderId=%s rows=%d amount=%d generalAgentRows=%d generalAgentAmount=%d',
      order.id,
      rows.length,
      rows.reduce((sum, row) => sum + row.amount, 0),
      generalAgentRows.length,
      generalAgentRows.reduce((sum, row) => sum + row.amount, 0),
    );
  }
  return [...rows, ...generalAgentRows];
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

function addDays(date: Date | string, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isRecurringCommissionEnabled(setting: any) {
  return Boolean(setting?.recurringCommissionEnabled) && Number(setting?.recurringCommissionDays || 0) > 0;
}

function recurringCommissionWindow(after: Date | string | null | undefined, days: number) {
  if (!after || Number(days || 0) <= 0) return null;
  const start = new Date(after);
  const end = addDays(start, Number(days || 0));
  return { start, end };
}

function isOrderInRecurringWindow(order: any, after: Date | string | null | undefined, days: number) {
  const window = recurringCommissionWindow(after, days);
  if (!window) return false;
  const paidAt = order.paidAt ? new Date(order.paidAt) : new Date();
  return paidAt >= window.start && paidAt <= window.end;
}

function appendUniqueGeneralAgentRows(target: any[], rows: any[]) {
  for (const row of rows) {
    if (!target.some((item) => item.orderId === row.orderId && item.generalAgentId === row.generalAgentId)) {
      target.push(row);
    }
  }
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
        if (isRecurringCommissionEnabled(setting)) {
          const directRecurringOrders = await findRecurringPaidOrdersForUser(tx, referral.userId, directEligibleAfter, setting.recurringCommissionDays);
          for (const order of directRecurringOrders) candidateOrderIds.add(order.id);
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
        if (isRecurringCommissionEnabled(setting)) {
          const parentRecurringOrders = await findRecurringPaidOrdersForUser(tx, referral.userId, overrideEligibleAfter, setting.recurringCommissionDays);
          for (const order of parentRecurringOrders) candidateOrderIds.add(order.id);
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

async function findRecurringPaidOrdersForUser(db: any, userId: string, after: Date | string | null | undefined, days: number) {
  const window = recurringCommissionWindow(after, days);
  if (!window) return [];
  return db.order.findMany({
    where: {
      userId,
      status: 'paid',
      paidAt: { gte: window.start, lte: window.end },
    },
    orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
    take: 200,
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

async function hasCommissionForOrderRole(db: any, orderId: string, distributorId: string, role: string) {
  const count = await db.distributionCommission.count({
    where: { orderId, distributorId, role },
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
  const runtimeTransferConfig = await getWechatTransferRuntimeConfig().catch(() => null);
  const formatted = formatDistributionSetting(setting);
  return {
    ...formatted,
    transferNotifyUrl: formatted.transferNotifyUrl || runtimeTransferConfig?.transferNotifyUrl || '',
    transferRule: {
      ...formatted.transferRule,
      notifyUrl: formatted.transferRule.notifyUrl || runtimeTransferConfig?.transferNotifyUrl || '',
    },
    transferRuntimeConfig: runtimeTransferConfig,
  };
}

export async function updateDistributionSettingsForAdmin(input: Record<string, any>) {
  const level1Rate = normalizeRateBps(input.level1Rate);
  const level2Rate = normalizeRateBps(input.level2Rate);
  const dailyShareReward = normalizePointAmount(input.dailyShareReward ?? DEFAULT_DAILY_SHARE_REWARD_POINTS, '每日分享赠点');
  const referralReward = normalizePointAmount(input.referralReward ?? DEFAULT_SHARE_REFERRAL_REWARD_POINTS, '好友注册奖励');
  const minWithdrawalAmount = normalizeMoneyAmount(input.minWithdrawalAmount ?? DEFAULT_MIN_WITHDRAWAL_AMOUNT, true);
  const withdrawalFreezeDays = normalizeFreezeDays(input.withdrawalFreezeDays ?? DEFAULT_WITHDRAWAL_FREEZE_DAYS);
  const transferRule = normalizeTransferRule(input);
  const recurringLevel1Rate = normalizeRateBps(input.recurringLevel1Rate ?? DEFAULT_RECURRING_LEVEL1_RATE);
  const recurringLevel2Rate = normalizeRateBps(input.recurringLevel2Rate ?? DEFAULT_RECURRING_LEVEL2_RATE);
  const recurringCommissionDays = normalizeRecurringCommissionDays(input.recurringCommissionDays ?? DEFAULT_RECURRING_COMMISSION_DAYS);
  if (level1Rate < level2Rate) {
    throw new AppError(422, '特邀总比例不能低于推荐官比例', 'DISTRIBUTION_RATE_INVALID');
  }
  if (recurringLevel1Rate < recurringLevel2Rate) {
    throw new AppError(422, '复充特邀总比例不能低于复充推荐官比例', 'DISTRIBUTION_RATE_INVALID');
  }
  if (recurringLevel1Rate > level1Rate || recurringLevel2Rate > level2Rate) {
    throw new AppError(422, '复充比例不能高于首充比例', 'DISTRIBUTION_RECURRING_RATE_INVALID');
  }
  if (minWithdrawalAmount < transferRule.transferSingleMin) {
    throw new AppError(422, `最低提现金额不能低于转账场景单笔下限 ${formatYuan(transferRule.transferSingleMin)}`, 'WITHDRAWAL_MIN_AMOUNT_INVALID');
  }
  if (minWithdrawalAmount > transferRule.transferSingleMax) {
    throw new AppError(422, `最低提现金额不能高于转账场景单笔上限 ${formatYuan(transferRule.transferSingleMax)}`, 'WITHDRAWAL_MIN_AMOUNT_INVALID');
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
      ...transferRule,
      recurringCommissionEnabled: input.recurringCommissionEnabled === true,
      recurringLevel1Rate,
      recurringLevel2Rate,
      recurringCommissionDays,
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
      ...transferRule,
      recurringCommissionEnabled: input.recurringCommissionEnabled === true,
      recurringLevel1Rate,
      recurringLevel2Rate,
      recurringCommissionDays,
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
    generalAgentCount,
    generalAgentCommissionCount,
    generalAgentCommissionTotal,
    generalAgentPendingTotal,
    generalAgentPaidTotal,
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
    prisma.distributionWithdrawal.aggregate({ where: { status: { in: LOCKED_WITHDRAWAL_STATUSES } }, _sum: { amount: true } }),
    prisma.distributor.count({ where: { level: 1, isGeneralAgent: true, code: { not: SYSTEM_DISTRIBUTOR_CODE } } }),
    prisma.generalAgentCommission.count(),
    prisma.generalAgentCommission.aggregate({ _sum: { amount: true } }),
    prisma.generalAgentCommission.aggregate({ where: { status: 'pending' }, _sum: { amount: true } }),
    prisma.generalAgentCommission.aggregate({ where: { status: 'paid' }, _sum: { amount: true } }),
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
    generalAgentCount,
    generalAgentCommissionCount,
    generalAgentCommissionAmount: generalAgentCommissionTotal._sum.amount || 0,
    generalAgentPendingAmount: generalAgentPendingTotal._sum.amount || 0,
    generalAgentPaidAmount: generalAgentPaidTotal._sum.amount || 0,
    withdrawalFreezeDays: freezeDays,
  };
}

export async function getDistributionPendingCountsForAdmin() {
  await ensureDistributionDefaults();
  const [pendingDistributors, pendingWithdrawals] = await Promise.all([
    prisma.distributor.count({
      where: {
        status: 'pending',
        code: { not: SYSTEM_DISTRIBUTOR_CODE },
      },
    }),
    prisma.distributionWithdrawal.count({
      where: { status: 'pending' },
    }),
  ]);

  return {
    pendingDistributors,
    pendingWithdrawals,
    total: pendingDistributors + pendingWithdrawals,
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
        generalAgentParent: { select: { id: true, name: true, code: true, generalAgentRate: true } },
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
  const generalAgent = String(params.generalAgent || '').trim();

  const distributors = await prisma.distributor.findMany({
    where: { code: { not: SYSTEM_DISTRIBUTOR_CODE } },
    orderBy: [{ level: 'asc' }, { createdAt: 'desc' }],
    include: {
      user: { select: { id: true, nickname: true, phone: true, createdAt: true, shareCode: true } },
      parent: { select: { id: true, name: true, code: true } },
      generalAgentParent: { select: { id: true, name: true, code: true, generalAgentRate: true } },
      generalAgentChildren: {
        select: {
          id: true,
          name: true,
          code: true,
          level: true,
          status: true,
          userId: true,
          user: { select: { id: true, nickname: true, phone: true, createdAt: true, shareCode: true } },
          _count: { select: { children: true, referrals: true, commissions: true } },
        },
      },
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
      const filter = { keyword, level, status, generalAgent };
      const rootMatches = distributorMatchesTreeFilter(root, filter);
      const children = (root.children || []).filter((child: any) => distributorMatchesTreeFilter(child, filter));
      const agentChildren = (root.generalAgentChildren || []).filter((child: any) => child.level === 1 && child.id !== root.id);
      const hasFilter = Boolean(keyword || status || level || generalAgent);
      const shouldInclude = rootMatches || children.length > 0 || !hasFilter;
      if (!shouldInclude) return null;
      return {
        ...root,
        children: rootMatches && level !== 2 && !status && !keyword && !generalAgent ? root.children : children,
        generalAgentChildren: agentChildren,
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
    select: { id: true, name: true, code: true, userId: true, newUserGiftOverride: true, isGeneralAgent: true, generalAgentRate: true },
  });
}

export async function listGeneralAgentsForAdmin() {
  await ensureDistributionDefaults();
  return prisma.distributor.findMany({
    where: { level: 1, status: 'active', isGeneralAgent: true, code: { not: SYSTEM_DISTRIBUTOR_CODE } },
    orderBy: [{ code: 'asc' }],
    select: { id: true, name: true, code: true, userId: true, generalAgentRate: true },
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
  const userWithShareCode = await ensureUserShareCode(userId);
  const parentId = level === 2 ? await resolveLevel2ParentId(input.parentId || invitedParentId) : null;
  const newUserGiftOverride = level === 1 ? normalizeOptionalPointAmount(input.newUserGiftOverride, '特邀合作伙伴新用户额外赠点') : null;
  const isGeneralAgent = level === 1 && input.isGeneralAgent === true;
  const generalAgentRate = level === 1 ? normalizeRateBps(input.generalAgentRate ?? DEFAULT_GENERAL_AGENT_RATE) : DEFAULT_GENERAL_AGENT_RATE;
  const generalAgentParentId = level === 1 && !isGeneralAgent ? await resolveGeneralAgentParentId(input.generalAgentParentId, userId) : null;
  const distributor = await prisma.distributor.create({
    data: {
      userId,
      name: String(input.name || user.nickname || user.phone || `分销员${userId.slice(0, 6)}`).trim(),
      code: userWithShareCode.shareCode || await generateDistributorCode(userId),
      level,
      parentId,
      generalAgentParentId,
      generalAgentParentAssignedAt: generalAgentParentId ? new Date() : null,
      isGeneralAgent,
      generalAgentRate,
      status,
      newUserGiftOverride,
      approvedAt: status === 'active' ? new Date() : null,
    },
  });
  if (status !== 'active') return distributor;

  const synced = await syncDistributorParentFromInvitation(prisma, distributor);
  await backfillDistributionReferralsForDistributor(prisma, synced);
  if (synced.level === 1) await backfillGeneralAgentCommissionsForSource(prisma, synced);
  return synced;
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
    const generalAgentInputTouched = Object.prototype.hasOwnProperty.call(input, 'isGeneralAgent')
      || Object.prototype.hasOwnProperty.call(input, 'generalAgentRate')
      || Object.prototype.hasOwnProperty.call(input, 'generalAgentParentId');
    const nextIsGeneralAgent = input.isGeneralAgent !== undefined ? input.isGeneralAgent === true : distributor.isGeneralAgent;
    data.isGeneralAgent = nextIsGeneralAgent;
    data.generalAgentRate = nextIsGeneralAgent
      ? normalizeRateBps(input.generalAgentRate ?? distributor.generalAgentRate ?? DEFAULT_GENERAL_AGENT_RATE)
      : DEFAULT_GENERAL_AGENT_RATE;
    if (nextIsGeneralAgent) {
      data.generalAgentParentId = null;
      data.generalAgentParentAssignedAt = null;
    } else if (generalAgentInputTouched) {
      const nextGeneralAgentParentId = await resolveGeneralAgentParentId(input.generalAgentParentId, distributor.userId, distributor.id);
      data.generalAgentParentId = nextGeneralAgentParentId;
      data.generalAgentParentAssignedAt = nextGeneralAgentParentId
        ? (nextGeneralAgentParentId === distributor.generalAgentParentId
          ? (distributor.generalAgentParentAssignedAt || new Date())
          : new Date())
        : null;
    }
    if (input.newUserGiftOverride !== undefined) {
      data.newUserGiftOverride = normalizeOptionalPointAmount(input.newUserGiftOverride, '特邀合作伙伴新用户额外赠点');
    }
  } else {
    const invitedParentId = data.status === 'active' || (!data.status && distributor.status === 'active')
      ? await resolveDistributorParentFromShareReferral(prisma, distributor.userId)
      : null;
    data.parentId = await resolveLevel2ParentId(input.parentId || invitedParentId || distributor.parentId);
    data.newUserGiftOverride = null;
    data.isGeneralAgent = false;
    data.generalAgentRate = DEFAULT_GENERAL_AGENT_RATE;
    data.generalAgentParentId = null;
    data.generalAgentParentAssignedAt = null;
  }

  return prisma.$transaction(async (tx) => {
    if (distributor.level === 1 && nextLevel === 2 && distributor.children.length) {
      const { system } = await ensureDistributionDefaults(tx);
      await tx.distributor.updateMany({
        where: { parentId: distributor.id },
        data: { parentId: system.id },
      });
    }
    if ((distributor.level === 1 && nextLevel !== 1) || (distributor.isGeneralAgent && data.isGeneralAgent === false)) {
      await tx.distributor.updateMany({
        where: { generalAgentParentId: distributor.id },
        data: { generalAgentParentId: null, generalAgentParentAssignedAt: null },
      });
    }
    const updated = await tx.distributor.update({ where: { id }, data });
    if (updated.status === 'active') {
      await backfillDistributionReferralsForDistributor(tx, updated);
    }
    if (updated.status === 'active' && updated.level === 1) {
      await backfillGeneralAgentCommissionsForSource(tx, updated);
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

export async function listGeneralAgentCommissionsForAdmin(params: Record<string, any>) {
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize || '20', 10)));
  const where: any = {};
  if (params.generalAgentId) where.generalAgentId = String(params.generalAgentId);
  if (params.sourceDistributorId) where.sourceDistributorId = String(params.sourceDistributorId);
  if (params.status) where.status = String(params.status);

  const [list, total] = await Promise.all([
    prisma.generalAgentCommission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        generalAgent: { select: { id: true, name: true, code: true, generalAgentRate: true } },
        sourceDistributor: { select: { id: true, name: true, code: true, level: true } },
        directDistributor: { select: { id: true, name: true, code: true, level: true } },
        order: { select: { id: true, orderNo: true, amount: true, productName: true, paidAt: true } },
      },
    }),
    prisma.generalAgentCommission.count({ where }),
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

export async function getGeneralAgentStatsForAdmin(id: string) {
  const agent = await prisma.distributor.findUnique({
    where: { id },
    include: {
      generalAgentChildren: {
        where: { level: 1 },
        select: { id: true, name: true, code: true, status: true, _count: { select: { children: true, referrals: true } } },
      },
    },
  });
  if (!agent || agent.level !== 1 || !agent.isGeneralAgent) {
    throw new AppError(404, '总代不存在', 'GENERAL_AGENT_NOT_FOUND');
  }
  const sourceIds = agent.generalAgentChildren.map(child => child.id);
  const [
    totalCommission,
    pendingCommission,
    paidCommission,
    commissionCount,
    orderCount,
  ] = await Promise.all([
    prisma.generalAgentCommission.aggregate({ where: { generalAgentId: id }, _sum: { amount: true } }),
    prisma.generalAgentCommission.aggregate({ where: { generalAgentId: id, status: 'pending' }, _sum: { amount: true } }),
    prisma.generalAgentCommission.aggregate({ where: { generalAgentId: id, status: 'paid' }, _sum: { amount: true } }),
    prisma.generalAgentCommission.count({ where: { generalAgentId: id } }),
    prisma.generalAgentCommission.count({ where: { generalAgentId: id } }),
  ]);
  return {
    agent,
    childPartnerCount: sourceIds.length,
    childReferralOfficerCount: agent.generalAgentChildren.reduce((sum, child) => sum + (child._count?.children || 0), 0),
    childDirectReferralCount: agent.generalAgentChildren.reduce((sum, child) => sum + (child._count?.referrals || 0), 0),
    commissionCount,
    orderCount,
    commissionAmount: totalCommission._sum.amount || 0,
    pendingAmount: pendingCommission._sum.amount || 0,
    paidAmount: paidCommission._sum.amount || 0,
  };
}

export async function markGeneralAgentCommissionForAdmin(id: string, input: Record<string, any>) {
  const status = normalizeGeneralAgentCommissionStatus(input.status);
  const commission = await prisma.generalAgentCommission.findUnique({ where: { id } });
  if (!commission) throw new AppError(404, '总代佣金不存在', 'GENERAL_AGENT_COMMISSION_NOT_FOUND');
  const now = new Date();
  return prisma.generalAgentCommission.update({
    where: { id },
    data: {
      status,
      settledAt: status === 'paid' ? now : null,
      adminRemark: String(input.adminRemark || '').trim().slice(0, 200) || null,
    },
    include: {
      generalAgent: { select: { id: true, name: true, code: true, generalAgentRate: true } },
      sourceDistributor: { select: { id: true, name: true, code: true, level: true } },
      directDistributor: { select: { id: true, name: true, code: true, level: true } },
      order: { select: { id: true, orderNo: true, amount: true, productName: true, paidAt: true } },
    },
  });
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
    const { setting } = await ensureDistributionDefaults();
    await assertWithdrawalTransferRule(withdrawal.amount, withdrawal.userId || '', setting, {
      excludeWithdrawalId: withdrawal.id,
      usageDateField: 'paidAt',
      usageStatuses: ['paid'],
    });
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

export async function startWechatTransferForAdmin(id: string, input: Record<string, any> = {}) {
  const { setting } = await ensureDistributionDefaults();
  const withdrawal = await prisma.distributionWithdrawal.findUnique({
    where: { id },
    include: withdrawalInclude(),
  });
  if (!withdrawal) throw new AppError(404, '提现申请不存在', 'WITHDRAWAL_NOT_FOUND');
  if (withdrawal.status === 'paid') {
    throw new AppError(409, '该提现已打款完成', 'WITHDRAWAL_ALREADY_PAID');
  }
  if (!['approved', 'failed', 'transferring', 'wait_user_confirm'].includes(withdrawal.status)) {
    throw new AppError(409, '请先审核通过提现申请，再发起微信转账', 'WITHDRAWAL_STATUS_INVALID');
  }
  await assertWithdrawalTransferRule(withdrawal.amount, withdrawal.userId || '', setting, {
    excludeWithdrawalId: withdrawal.id,
    usageDateField: 'transferRequestedAt',
    usageStatuses: [...TRANSFERRING_WITHDRAWAL_STATUSES, 'paid'],
  });

  const outBillNo = withdrawal.outBillNo || await generateTransferOutBillNo();
  const rule = formatTransferRule(setting);
  const remark = String(input.remark || `涨识${rule.sceneName}`).trim().slice(0, 32) || `涨识${rule.sceneName}`;
  await markWithdrawalTransferRequested(withdrawal.id, {
    outBillNo,
    remark,
    transferSceneId: rule.sceneId,
  });
  let response: any;
  try {
    response = await createWechatMerchantTransfer({
      openId: withdrawal.openId || withdrawal.distributor?.user?.miniOpenId || withdrawal.distributor?.user?.mpOpenId || '',
      outBillNo,
      amount: withdrawal.amount,
      sceneId: rule.sceneId,
      sceneName: rule.sceneName,
      remark,
      jobType: rule.reportJobType,
      rewardDesc: rule.reportRewardDesc,
      userName: null,
    });
  } catch (err: any) {
    await markWithdrawalTransferFailed(withdrawal.id, err?.details?.message || err?.message || '微信商家转账发起失败');
    throw err;
  }
  const updated = await updateWithdrawalFromWechatTransferResponse(withdrawal.id, response, {
    outBillNo,
    remark,
    transferSceneId: rule.sceneId,
    fallbackStatus: 'transferring',
  });
  const runtimeConfig = await getWechatTransferRuntimeConfig().catch(() => null);
  return {
    withdrawal: updated,
    transfer: buildMiniTransferPayload(updated, runtimeConfig),
    summary: await getDistributorWithdrawalSummary(updated.distributorId),
  };
}

export async function queryWechatTransferForAdmin(id: string) {
  const withdrawal = await prisma.distributionWithdrawal.findUnique({ where: { id }, include: withdrawalInclude() });
  if (!withdrawal) throw new AppError(404, '提现申请不存在', 'WITHDRAWAL_NOT_FOUND');
  return syncWithdrawalWechatTransfer(withdrawal);
}

export async function getWithdrawalTransferPackage(userId: string, id: string) {
  const withdrawal = await prisma.distributionWithdrawal.findFirst({
    where: { id, userId },
    include: withdrawalInclude(),
  });
  if (!withdrawal) throw new AppError(404, '提现申请不存在', 'WITHDRAWAL_NOT_FOUND');
  const synced = await syncWithdrawalWechatTransfer(withdrawal).catch(() => ({ withdrawal }));
  const runtimeConfig = await getWechatTransferRuntimeConfig().catch(() => null);
  return {
    withdrawal: synced.withdrawal,
    transfer: buildMiniTransferPayload(synced.withdrawal, runtimeConfig),
  };
}

export async function syncMyWechatWithdrawal(userId: string, id: string) {
  const withdrawal = await prisma.distributionWithdrawal.findFirst({
    where: { id, userId },
    include: withdrawalInclude(),
  });
  if (!withdrawal) throw new AppError(404, '提现申请不存在', 'WITHDRAWAL_NOT_FOUND');
  return syncWithdrawalWechatTransfer(withdrawal);
}

export async function handleWechatTransferCallbackForDistribution(body: Record<string, any>, headers?: Record<string, any>, rawBody?: string) {
  const payload = await handleWechatTransferNotify(body, headers, rawBody);
  const outBillNo = payload.out_bill_no || payload.out_detail_no || payload.out_batch_no;
  if (!outBillNo) {
    logger.warn({ payload }, '商家转账回调缺少商户单号');
    return payload;
  }
  const withdrawal = await prisma.distributionWithdrawal.findUnique({ where: { outBillNo }, include: withdrawalInclude() });
  if (!withdrawal) {
    logger.warn({ outBillNo, payload }, '商家转账回调找不到提现单');
    return payload;
  }
  await updateWithdrawalFromWechatTransferResponse(withdrawal.id, payload, { outBillNo });
  return payload;
}

function realDistributorCommissionWhere() {
  return { distributor: { code: { not: SYSTEM_DISTRIBUTOR_CODE } } };
}

async function resolveGeneralAgentParentId(value: any, userId?: string | null, selfId?: string) {
  const id = String(value || '').trim();
  if (!id) return null;
  if (id === selfId) {
    throw new AppError(422, '合伙人不能归属于自己作为总代', 'GENERAL_AGENT_SELF_PARENT_INVALID');
  }
  const parent = await prisma.distributor.findUnique({ where: { id } });
  if (!parent || parent.level !== 1 || parent.status !== 'active' || !parent.isGeneralAgent) {
    throw new AppError(422, '所属总代必须是已启用的总代合伙人', 'GENERAL_AGENT_PARENT_INVALID');
  }
  if (parent.userId && userId && parent.userId === userId) {
    throw new AppError(422, '合伙人不能归属于自己作为总代', 'GENERAL_AGENT_SELF_PARENT_INVALID');
  }
  return parent.id;
}

function distributorMatchesTreeFilter(distributor: any, filter: { keyword: string; level?: number; status: string; generalAgent?: string }) {
  if (filter.level === 1 || filter.level === 2) {
    if (distributor.level !== filter.level) return false;
  }
  if (filter.status && distributor.status !== filter.status) return false;
  if (filter.generalAgent === 'agent' && !distributor.isGeneralAgent) return false;
  if (filter.generalAgent === 'child' && !distributor.generalAgentParentId) return false;
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
    distributor.generalAgentParent?.name,
    distributor.generalAgentParent?.code,
  ].filter(Boolean).join(' ').toLowerCase();
  return text.includes(filter.keyword.toLowerCase());
}

async function buildEligibleGeneralAgentCommissionRows(db: any, order: any, referral: any) {
  const rows: any[] = [];
  const source = await resolveGeneralAgentSourceDistributor(db, referral);
  if (!source?.generalAgentParentId) return rows;
  if (!isOrderAfterDate(order, maxDate(source.approvedAt, source.generalAgentParentAssignedAt))) return rows;

  const agent = await db.distributor.findUnique({ where: { id: source.generalAgentParentId } });
  if (!agent || agent.level !== 1 || !agent.isGeneralAgent || agent.status !== 'active') return rows;
  if (!isOrderAfterDate(order, agent.approvedAt)) return rows;
  if (await hasGeneralAgentCommissionForOrder(db, order.id, agent.id)) return rows;

  const rateBps = normalizeRateBps(agent.generalAgentRate ?? DEFAULT_GENERAL_AGENT_RATE);
  const amount = calculateCommission(order.amount, rateBps);
  if (amount > 0) {
    rows.push({
      id: crypto.randomUUID(),
      orderId: order.id,
      generalAgentId: agent.id,
      sourceDistributorId: source.id,
      referralUserId: referral.userId,
      directDistributorId: referral.distributorId || referral.distributor?.id || null,
      rateBps,
      amount,
      status: 'pending',
    });
  }
  return rows;
}

async function buildEligibleGeneralAgentCommissionRowsForPersonalOrder(db: any, order: any) {
  const rows: any[] = [];
  const direct = await db.distributor.findUnique({
    where: { userId: order.userId },
    include: { parent: true },
  });
  if (!direct || direct.status !== 'active') return rows;

  const source = direct.level === 1
    ? direct
    : direct.parentId && direct.parentId !== SYSTEM_DISTRIBUTOR_ID
      ? (direct.parent || await db.distributor.findUnique({ where: { id: direct.parentId } }))
      : null;
  if (!source || source.level !== 1 || source.status !== 'active' || !source.generalAgentParentId) return rows;
  if (!isOrderAfterDate(order, maxDate(source.approvedAt, source.generalAgentParentAssignedAt, direct.approvedAt))) return rows;

  const agent = await db.distributor.findUnique({ where: { id: source.generalAgentParentId } });
  if (!agent || agent.level !== 1 || !agent.isGeneralAgent || agent.status !== 'active') return rows;
  if (!isOrderAfterDate(order, agent.approvedAt)) return rows;
  if (await hasGeneralAgentCommissionForOrder(db, order.id, agent.id)) return rows;

  const rateBps = normalizeRateBps(agent.generalAgentRate ?? DEFAULT_GENERAL_AGENT_RATE);
  const amount = calculateCommission(order.amount, rateBps);
  if (amount > 0) {
    rows.push({
      id: crypto.randomUUID(),
      orderId: order.id,
      generalAgentId: agent.id,
      sourceDistributorId: source.id,
      referralUserId: order.userId,
      directDistributorId: direct.id,
      rateBps,
      amount,
      status: 'pending',
    });
  }
  return rows;
}

async function backfillGeneralAgentCommissionsForSource(db: any, sourceDistributor: any) {
  if (!sourceDistributor?.id || sourceDistributor.level !== 1 || sourceDistributor.status !== 'active') return 0;
  const source = sourceDistributor.generalAgentParentId !== undefined
    ? sourceDistributor
    : await db.distributor.findUnique({ where: { id: sourceDistributor.id } });
  if (!source?.generalAgentParentId) return 0;

  const agent = await db.distributor.findUnique({ where: { id: source.generalAgentParentId } });
  if (!agent || agent.level !== 1 || !agent.isGeneralAgent || agent.status !== 'active') return 0;

  const referrals = await db.distributionReferral.findMany({
    where: { firstLevelDistributorId: source.id },
    include: { distributor: { include: { parent: true } } },
  });
  let created = 0;
  const personalUserIds = new Set<string>();
  if (source.userId) personalUserIds.add(source.userId);
  const children = await db.distributor.findMany({
    where: { parentId: source.id, status: 'active', userId: { not: null } },
    select: { userId: true },
  });
  for (const child of children) {
    if (child.userId) personalUserIds.add(child.userId);
  }

  for (const userId of personalUserIds) {
    const after = maxDate(source.approvedAt, source.generalAgentParentAssignedAt, agent.approvedAt);
    const orders = await db.order.findMany({
      where: {
        userId,
        status: 'paid',
        paidAt: after ? { gte: after } : { not: null },
      },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    });
    for (const order of orders) {
      const rows = await buildEligibleGeneralAgentCommissionRowsForPersonalOrder(db, order);
      for (const row of rows) {
        await db.generalAgentCommission.create({ data: row });
        created += 1;
      }
    }
  }

  for (const referral of referrals) {
    const after = maxDate(referral.createdAt, source.approvedAt, source.generalAgentParentAssignedAt, agent.approvedAt);
    const orders = await db.order.findMany({
      where: {
        userId: referral.userId,
        status: 'paid',
        paidAt: after ? { gte: after } : { not: null },
      },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
      take: 200,
    });

    for (const order of orders) {
      const rows = await buildEligibleGeneralAgentCommissionRows(db, order, referral);
      for (const row of rows) {
        await db.generalAgentCommission.create({ data: row });
        created += 1;
      }
    }
  }
  return created;
}

async function resolveGeneralAgentSourceDistributor(db: any, referral: any) {
  if (!referral?.distributor) return null;
  const direct = referral.distributor;
  if (direct.level === 1) {
    return direct.generalAgentParentId !== undefined
      ? direct
      : db.distributor.findUnique({ where: { id: direct.id } });
  }
  const parentId = referral.firstLevelDistributorId || direct.parentId;
  if (!parentId || parentId === SYSTEM_DISTRIBUTOR_ID) return null;
  return db.distributor.findUnique({ where: { id: parentId } });
}

async function hasGeneralAgentCommissionForOrder(db: any, orderId: string, generalAgentId: string) {
  const count = await db.generalAgentCommission.count({ where: { orderId, generalAgentId } });
  return count > 0;
}

async function buildEligibleCommissionRows(db: any, order: any, referral: any, setting: any) {
  const rows: any[] = [];
  const direct = referral.distributor;
  if (!direct || direct.status !== 'active') return rows;

  if (direct.level === 1) {
    const directEligibleAfter = maxDate(referral.createdAt, direct.approvedAt);
    const isFirstDirectOrder = await isFirstPaidOrderForUserAfter(db, referral.userId, order.id, directEligibleAfter);
    const canSettleDirect = isFirstDirectOrder
      && !await hasDirectCommissionForReferral(db, referral.userId, direct.id);
    if (canSettleDirect) {
      const amount = calculateCommission(order.amount, setting.level1Rate);
      if (amount > 0) {
        rows.push(buildCommissionRow(order, direct.id, referral.userId, 'level1_direct', setting.level1Rate, amount));
      }
    }
    if (!isFirstDirectOrder) {
      await addRecurringCommissionRowIfEligible(
        db,
        rows,
        order,
        referral.userId,
        direct.id,
        'level1_recurring_direct',
        setting.recurringLevel1Rate,
        directEligibleAfter,
        setting,
      );
    }
    return rows;
  }

  const directEligibleAfter = maxDate(referral.createdAt, direct.approvedAt);
  const isFirstLevel2DirectOrder = await isFirstPaidOrderForUserAfter(db, referral.userId, order.id, directEligibleAfter);
  const canSettleLevel2Direct = isFirstLevel2DirectOrder
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
  const isFirstParentOrder = parent?.id
    ? await isFirstPaidOrderForUserAfter(db, referral.userId, order.id, parentEligibleAfter)
    : false;
  const canSettleParentOverride = parent?.id
    && parent.id !== SYSTEM_DISTRIBUTOR_ID
    && parent.status === 'active'
    && parentRate > 0
    && isOrderAfterDate(order, parentEligibleAfter)
    && isFirstParentOrder
    && !await hasCommissionForReferral(db, referral.userId, parent.id, 'level1_override');
  if (canSettleParentOverride) {
    const parentAmount = calculateCommission(order.amount, parentRate);
    if (parentAmount > 0) {
      rows.push(buildCommissionRow(order, parent.id, referral.userId, 'level1_override', parentRate, parentAmount));
    }
  }

  if (!isFirstLevel2DirectOrder) {
    await addRecurringCommissionRowIfEligible(
      db,
      rows,
      order,
      referral.userId,
      direct.id,
      'level2_recurring_direct',
      setting.recurringLevel2Rate,
      directEligibleAfter,
      setting,
    );
  }

  if (!isFirstParentOrder && parent?.id && parent.id !== SYSTEM_DISTRIBUTOR_ID && parent.status === 'active') {
    const recurringParentRate = Math.max(0, setting.recurringLevel1Rate - setting.recurringLevel2Rate);
    await addRecurringCommissionRowIfEligible(
      db,
      rows,
      order,
      referral.userId,
      parent.id,
      'level1_recurring_override',
      recurringParentRate,
      parentEligibleAfter,
      setting,
    );
  }

  return rows;
}

async function addRecurringCommissionRowIfEligible(
  db: any,
  rows: any[],
  order: any,
  referralUserId: string,
  distributorId: string,
  role: string,
  rateBps: number,
  eligibleAfter: Date | string | null | undefined,
  setting: any,
) {
  if (!isRecurringCommissionEnabled(setting) || rateBps <= 0) return;
  if (!isOrderInRecurringWindow(order, eligibleAfter, setting.recurringCommissionDays)) return;
  if (await hasCommissionForOrderRole(db, order.id, distributorId, role)) return;

  const amount = calculateCommission(order.amount, rateBps);
  if (amount > 0) {
    rows.push(buildCommissionRow(order, distributorId, referralUserId, role, rateBps, amount));
  }
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

async function markWithdrawalTransferRequested(id: string, input: {
  outBillNo: string;
  remark: string;
  transferSceneId: string;
}) {
  const now = new Date();
  return prisma.distributionWithdrawal.update({
    where: { id },
    data: {
      outBillNo: input.outBillNo,
      transferRemark: input.remark,
      transferSceneId: input.transferSceneId,
      transferRequestedAt: now,
      transferFailReason: null,
      failedAt: null,
    },
  });
}

async function markWithdrawalTransferFailed(id: string, reason: string) {
  return prisma.distributionWithdrawal.update({
    where: { id },
    data: {
      status: 'failed',
      transferState: 'FAIL',
      transferFailReason: String(reason || '微信商家转账发起失败').slice(0, 500),
      failedAt: new Date(),
    },
  });
}

async function syncWithdrawalWechatTransfer(withdrawal: any) {
  if (!withdrawal.outBillNo) {
    return {
      withdrawal,
      transfer: buildMiniTransferPayload(withdrawal),
      summary: await getDistributorWithdrawalSummary(withdrawal.distributorId),
    };
  }
  const response = await queryWechatMerchantTransferByOutBillNo(withdrawal.outBillNo);
  const updated = await updateWithdrawalFromWechatTransferResponse(withdrawal.id, response, {
    outBillNo: withdrawal.outBillNo,
    fallbackStatus: withdrawal.status,
  });
  const runtimeConfig = await getWechatTransferRuntimeConfig().catch(() => null);
  return {
    withdrawal: updated,
    transfer: buildMiniTransferPayload(updated, runtimeConfig),
    summary: await getDistributorWithdrawalSummary(updated.distributorId),
  };
}

async function updateWithdrawalFromWechatTransferResponse(id: string, response: any, options: {
  outBillNo?: string;
  remark?: string;
  transferSceneId?: string;
  fallbackStatus?: string;
} = {}) {
  const transferState = normalizeWechatTransferState(response);
  const status = mapWechatTransferStateToWithdrawalStatus(transferState, options.fallbackStatus);
  const now = new Date();
  const data: any = {
    outBillNo: response.out_bill_no || options.outBillNo || undefined,
    transferNo: response.transfer_bill_no || response.detail_id || response.bill_id || response.wechatpay_transfer_bill_no || undefined,
    wechatTransferBillNo: response.transfer_bill_no || response.detail_id || response.bill_id || response.wechatpay_transfer_bill_no || undefined,
    transferState,
    transferPackageInfo: response.package_info || undefined,
    transferSceneId: response.transfer_scene_id || options.transferSceneId || undefined,
    transferFailReason: response.fail_reason || response.fail_message || response.state_desc || undefined,
    transferRemark: options.remark || response.transfer_remark || undefined,
    status,
  };
  Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
  if (options.remark && !data.adminRemark) data.adminRemark = options.remark;
  if (['transferring', 'wait_user_confirm'].includes(status) && !data.transferRequestedAt) data.transferRequestedAt = now;
  if (status === 'paid') {
    data.paidAt = response.success_time ? new Date(response.success_time) : now;
    data.transferConfirmedAt = data.paidAt;
    data.failedAt = null;
  }
  if (status === 'failed') {
    data.failedAt = now;
  }
  const updated = await prisma.distributionWithdrawal.update({
    where: { id },
    data,
    include: withdrawalInclude(),
  });
  return updated;
}

function normalizeWechatTransferState(response: any) {
  const state = String(response.state || response.transfer_state || response.status || response.bill_status || '').trim().toUpperCase();
  if (!state && response.package_info) return 'WAIT_USER_CONFIRM';
  return state || 'UNKNOWN';
}

function mapWechatTransferStateToWithdrawalStatus(state: string, fallback = 'transferring') {
  if (WECHAT_TRANSFER_SUCCESS_STATES.includes(state)) return 'paid';
  if (WECHAT_TRANSFER_CONFIRM_STATES.includes(state)) return 'wait_user_confirm';
  if (WECHAT_TRANSFER_FAILED_STATES.includes(state)) return 'failed';
  if (WECHAT_TRANSFER_PROCESSING_STATES.includes(state)) return 'transferring';
  return fallback || 'transferring';
}

function buildMiniTransferPayload(withdrawal: any, runtimeConfig?: any) {
  if (!withdrawal?.transferPackageInfo || withdrawal.status !== 'wait_user_confirm') return null;
  return {
    mchId: runtimeConfig?.mchId || '',
    appId: runtimeConfig?.appId || '',
    package: withdrawal.transferPackageInfo,
    outBillNo: withdrawal.outBillNo,
  };
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
    transferRule: formatTransferRule(currentSetting),
  };
}

async function assertWithdrawalTransferRule(
  amount: number,
  userId: string,
  setting: any,
  options: { excludeWithdrawalId?: string; usageDateField?: 'requestedAt' | 'paidAt' | 'transferRequestedAt'; usageStatuses?: string[] } = {},
) {
  const rule = formatTransferRule(setting);
  if (amount < rule.singleMin) {
    throw new AppError(422, `提现金额不能低于转账场景单笔下限 ${formatYuan(rule.singleMin)}`, 'WITHDRAWAL_TRANSFER_SINGLE_MIN');
  }
  if (amount > rule.singleMax) {
    throw new AppError(422, `提现金额不能超过转账场景单笔上限 ${formatYuan(rule.singleMax)}`, 'WITHDRAWAL_TRANSFER_SINGLE_MAX');
  }

  const todayStart = startOfShanghaiDay(new Date());
  const usageDateField = options.usageDateField || 'requestedAt';
  const countedStatuses = options.usageStatuses || ['pending', 'approved', 'paid'];
  const baseWhere: any = {
    status: { in: countedStatuses },
    [usageDateField]: { gte: todayStart },
  };
  if (options.excludeWithdrawalId) {
    baseWhere.id = { not: options.excludeWithdrawalId };
  }
  const [dailyTotal, userDailyTotal] = await Promise.all([
    prisma.distributionWithdrawal.aggregate({
      where: baseWhere,
      _sum: { amount: true },
    }),
    prisma.distributionWithdrawal.aggregate({
      where: {
        ...baseWhere,
        userId: userId || '__missing_user__',
      },
      _sum: { amount: true },
    }),
  ]);
  const usedDailyAmount = dailyTotal._sum.amount || 0;
  const usedUserDailyAmount = userDailyTotal._sum.amount || 0;
  if (usedDailyAmount + amount > rule.dailyLimit) {
    throw new AppError(422, `今日商家转账总额度剩余 ${formatYuan(Math.max(0, rule.dailyLimit - usedDailyAmount))}，请明天再试`, 'WITHDRAWAL_TRANSFER_DAILY_LIMIT');
  }
  if (usedUserDailyAmount + amount > rule.userDailyLimit) {
    throw new AppError(422, `你今日可提现额度剩余 ${formatYuan(Math.max(0, rule.userDailyLimit - usedUserDailyAmount))}，请明天再试`, 'WITHDRAWAL_TRANSFER_USER_DAILY_LIMIT');
  }
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

async function generateTransferOutBillNo() {
  const date = formatShanghaiDate(new Date()).replace(/-/g, '');
  let outBillNo = '';
  do {
    outBillNo = `MT${date}${crypto.randomInt(100000, 999999)}`;
  } while (await prisma.distributionWithdrawal.findUnique({ where: { outBillNo }, select: { id: true } }));
  return outBillNo;
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

function normalizeOptionalUrl(value: any) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (!/^https:\/\/[^/\s]+\/.+/i.test(text)) {
    throw new AppError(422, '回调地址必须是 https 完整地址', 'URL_INVALID');
  }
  return text.slice(0, 500);
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

function normalizeTransferRule(input: Record<string, any>) {
  const transferSceneId = String(input.transferSceneId ?? DEFAULT_TRANSFER_SCENE_ID).trim() || DEFAULT_TRANSFER_SCENE_ID;
  const transferSceneName = String(input.transferSceneName ?? DEFAULT_TRANSFER_SCENE_NAME).trim().slice(0, 30) || DEFAULT_TRANSFER_SCENE_NAME;
  const transferDailyLimit = normalizeMoneyAmount(input.transferDailyLimit ?? DEFAULT_TRANSFER_DAILY_LIMIT);
  const transferSingleMin = normalizeMoneyAmount(input.transferSingleMin ?? DEFAULT_TRANSFER_SINGLE_MIN);
  const transferSingleMax = normalizeMoneyAmount(input.transferSingleMax ?? DEFAULT_TRANSFER_SINGLE_MAX);
  const transferUserDailyLimit = normalizeMoneyAmount(input.transferUserDailyLimit ?? DEFAULT_TRANSFER_USER_DAILY_LIMIT);
  const transferNotifyUrl = normalizeOptionalUrl(input.transferNotifyUrl);
  const transferUserConfirm = input.transferUserConfirm !== false;
  const transferReportJobType = String(input.transferReportJobType ?? DEFAULT_TRANSFER_REPORT_JOB_TYPE).trim().slice(0, 32) || DEFAULT_TRANSFER_REPORT_JOB_TYPE;
  const transferReportRewardDesc = String(input.transferReportRewardDesc ?? DEFAULT_TRANSFER_REPORT_REWARD_DESC).trim().slice(0, 128) || DEFAULT_TRANSFER_REPORT_REWARD_DESC;
  if (!/^\d{1,10}$/.test(transferSceneId)) {
    throw new AppError(422, '转账场景 ID 格式不正确', 'TRANSFER_SCENE_ID_INVALID');
  }
  if (transferSingleMax < transferSingleMin) {
    throw new AppError(422, '单笔转账上限不能低于下限', 'TRANSFER_SINGLE_LIMIT_INVALID');
  }
  if (transferDailyLimit < transferSingleMax) {
    throw new AppError(422, '单日转账额度不能低于单笔上限', 'TRANSFER_DAILY_LIMIT_INVALID');
  }
  if (transferUserDailyLimit < transferSingleMax) {
    throw new AppError(422, '单日向单用户转账额度不能低于单笔上限', 'TRANSFER_USER_DAILY_LIMIT_INVALID');
  }
  if (transferUserDailyLimit > transferDailyLimit) {
    throw new AppError(422, '单日向单用户转账额度不能高于单日转账额度', 'TRANSFER_USER_DAILY_LIMIT_INVALID');
  }
  return {
    transferSceneId,
    transferSceneName,
    transferDailyLimit,
    transferSingleMin,
    transferSingleMax,
    transferUserDailyLimit,
    transferNotifyUrl,
    transferUserConfirm,
    transferReportJobType,
    transferReportRewardDesc,
  };
}

function normalizeRecurringCommissionDays(value: any) {
  const days = Math.round(Number(value));
  if (!Number.isFinite(days) || days < 0 || days > 730) {
    throw new AppError(422, '复充有效期必须在 0 到 730 天之间', 'DISTRIBUTION_RECURRING_DAYS_INVALID');
  }
  return days;
}

function normalizeWithdrawalStatus(value: any) {
  const status = String(value || '').trim();
  if (['approved', 'rejected', 'paid', 'failed', 'transferring', 'wait_user_confirm'].includes(status)) return status;
  throw new AppError(422, '提现状态不正确', 'WITHDRAWAL_STATUS_INVALID');
}

function normalizeGeneralAgentCommissionStatus(value: any) {
  const status = String(value || '').trim();
  if (['pending', 'paid'].includes(status)) return status;
  throw new AppError(422, '总代佣金状态不正确', 'GENERAL_AGENT_COMMISSION_STATUS_INVALID');
}

function formatDistributionSetting(setting: any) {
  const transferRule = formatTransferRule(setting);
  return {
    enabled: setting.enabled,
    level1Rate: setting.level1Rate,
    level2Rate: setting.level2Rate,
    dailyShareReward: getDailyShareRewardPoints(setting),
    referralReward: getReferralRewardPoints(setting),
    minWithdrawalAmount: setting.minWithdrawalAmount ?? DEFAULT_MIN_WITHDRAWAL_AMOUNT,
    withdrawalFreezeDays: setting.withdrawalFreezeDays ?? DEFAULT_WITHDRAWAL_FREEZE_DAYS,
    transferSceneId: transferRule.sceneId,
    transferSceneName: transferRule.sceneName,
    transferDailyLimit: transferRule.dailyLimit,
    transferSingleMin: transferRule.singleMin,
    transferSingleMax: transferRule.singleMax,
    transferUserDailyLimit: transferRule.userDailyLimit,
    transferNotifyUrl: transferRule.notifyUrl,
    transferUserConfirm: transferRule.userConfirm,
    transferReportJobType: transferRule.reportJobType,
    transferReportRewardDesc: transferRule.reportRewardDesc,
    transferRule,
    recurringCommissionEnabled: setting.recurringCommissionEnabled ?? DEFAULT_RECURRING_COMMISSION_ENABLED,
    recurringLevel1Rate: setting.recurringLevel1Rate ?? DEFAULT_RECURRING_LEVEL1_RATE,
    recurringLevel2Rate: setting.recurringLevel2Rate ?? DEFAULT_RECURRING_LEVEL2_RATE,
    recurringCommissionDays: setting.recurringCommissionDays ?? DEFAULT_RECURRING_COMMISSION_DAYS,
    level1Percent: setting.level1Rate / 100,
    level2Percent: setting.level2Rate / 100,
    recurringLevel1Percent: (setting.recurringLevel1Rate ?? DEFAULT_RECURRING_LEVEL1_RATE) / 100,
    recurringLevel2Percent: (setting.recurringLevel2Rate ?? DEFAULT_RECURRING_LEVEL2_RATE) / 100,
    minWithdrawalYuan: (setting.minWithdrawalAmount ?? DEFAULT_MIN_WITHDRAWAL_AMOUNT) / 100,
  };
}

function formatTransferRule(setting: any = {}) {
  return {
    sceneId: setting.transferSceneId || DEFAULT_TRANSFER_SCENE_ID,
    sceneName: setting.transferSceneName || DEFAULT_TRANSFER_SCENE_NAME,
    dailyLimit: setting.transferDailyLimit ?? DEFAULT_TRANSFER_DAILY_LIMIT,
    singleMin: setting.transferSingleMin ?? DEFAULT_TRANSFER_SINGLE_MIN,
    singleMax: setting.transferSingleMax ?? DEFAULT_TRANSFER_SINGLE_MAX,
    userDailyLimit: setting.transferUserDailyLimit ?? DEFAULT_TRANSFER_USER_DAILY_LIMIT,
    notifyUrl: setting.transferNotifyUrl || '',
    userConfirm: setting.transferUserConfirm ?? DEFAULT_TRANSFER_USER_CONFIRM,
    reportJobType: setting.transferReportJobType || DEFAULT_TRANSFER_REPORT_JOB_TYPE,
    reportRewardDesc: setting.transferReportRewardDesc || DEFAULT_TRANSFER_REPORT_REWARD_DESC,
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

function formatDistributorForMini(distributor: any) {
  if (!distributor) return null;
  const {
    generalAgentParentId,
    generalAgentParent,
    generalAgentChildren,
    isGeneralAgent,
    generalAgentRate,
    generalAgentCommissions,
    generatedGeneralAgentCommissions,
    ...safeDistributor
  } = distributor;
  return safeDistributor;
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
