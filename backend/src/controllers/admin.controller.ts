import { Context } from 'koa';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { prisma } from '../utils/prisma';
import { signToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { syncMenu as syncWechatMenuService } from '../services/wechat.service';
import { getBalance } from '../services/points.service';
import { getRevenueStats } from '../services/payment.service';
import { createLogger } from '../utils/logger';
import { ensureDistributionDefaults, getDistributionSettingsForAdmin } from '../services/distribution.service';
import {
  createRechargeProduct,
  deleteRechargeProduct,
  getPointSettings,
  listRechargeProducts,
  updatePointSettings,
  updateRechargeProduct,
} from '../services/point-config.service';
import {
  DEFAULT_BAILIAN_MODEL,
  DEFAULT_DEEPSEEK_MODEL,
  inferAiProvider,
  normalizeAiProvider,
} from '../services/ai-runtime.service';

const logger = createLogger('admin-ctrl');
const REPORT_OUTPUT_DIR = path.resolve(process.cwd(), 'uploads', 'reports');

type AdminInvitationNode = {
  id: string;
  nickname: string | null;
  phone: string | null;
  miniOpenId: string | null;
  mpOpenId: string | null;
  shareCode: string | null;
  status: number;
  createdAt: Date;
  pointsAccount: any;
  distributorProfile: any;
  invitation: any;
  depth: number;
  roleLabel: string;
  children: AdminInvitationNode[];
  directInviteCount: number;
};

function safePathSegment(value: string) {
  return String(value || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 120) || 'unknown';
}

function normalizeAdminShareCode(value: any) {
  return String(value || '').trim().toUpperCase();
}

function validateAdminShareCode(value: string) {
  if (!value) {
    throw new AppError(422, '邀请码不能为空', 'SHARE_CODE_REQUIRED');
  }
  if (!/^[A-Z0-9_-]{4,32}$/.test(value)) {
    throw new AppError(422, '邀请码只能包含字母、数字、下划线或短横线，长度 4-32 位', 'SHARE_CODE_INVALID');
  }
}

function parseDateQuery(value: any) {
  const text = String(value || '').trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeAdminRole(value: any) {
  const role = String(value || '').trim();
  if (!['admin', 'editor'].includes(role)) {
    throw new AppError(422, '管理员角色参数错误', 'ADMIN_ROLE_INVALID');
  }
  return role;
}

function normalizeSkillModel(value: any) {
  const model = String(value || '').trim() || 'global';
  if (model === 'global') return model;
  return normalizeModelId(model, 'global');
}

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
  const normalizedUsername = String(username || '').trim();
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(normalizedUsername)) {
    throw new AppError(422, '账号只能包含字母、数字、下划线或短横线，长度 3-32 位', 'ADMIN_USERNAME_INVALID');
  }
  if (String(password || '').length < 6) {
    throw new AppError(422, '密码至少 6 位', 'ADMIN_PASSWORD_INVALID');
  }
  const normalizedRole = normalizeAdminRole(role || 'editor');
  try {
    const hashed = await bcrypt.hash(password, 10);
    const admin = await prisma.admin.create({
      data: { username: normalizedUsername, password: hashed, role: normalizedRole },
    });
    ctx.body = { success: true, data: sanitizeAdmin(admin) };
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new AppError(409, '账号已存在', 'ADMIN_USERNAME_TAKEN');
    }
    throw err;
  }
}

export async function listAdmins(ctx: Context) {
  const admins = await prisma.admin.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  ctx.body = { success: true, data: admins };
}

export async function updateAdmin(ctx: Context) {
  const adminId = ctx.params.id;
  const { password, role, status } = ctx.request.body as any;
  const data: any = {};

  if (Object.prototype.hasOwnProperty.call(ctx.request.body as any, 'role')) {
    data.role = normalizeAdminRole(role);
  }
  if (Object.prototype.hasOwnProperty.call(ctx.request.body as any, 'status')) {
    const normalizedStatus = Number(status);
    if (![0, 1].includes(normalizedStatus)) {
      throw new AppError(422, '账号状态参数错误', 'ADMIN_STATUS_INVALID');
    }
    data.status = normalizedStatus;
  }
  if (password) {
    if (String(password).length < 6) {
      throw new AppError(422, '密码至少 6 位', 'ADMIN_PASSWORD_INVALID');
    }
    data.password = await bcrypt.hash(String(password), 10);
  }

  if (!Object.keys(data).length) {
    throw new AppError(422, '没有可更新的字段', 'ADMIN_UPDATE_EMPTY');
  }

  if (adminId === ctx.state.user?.userId && data.status === 0) {
    throw new AppError(422, '不能禁用当前登录账号', 'ADMIN_DISABLE_SELF');
  }

  const activeAdminCount = await prisma.admin.count({ where: { role: { in: ['admin', 'super_admin'] }, status: 1 } });
  const current = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!current) throw new AppError(404, '管理员账号不存在', 'ADMIN_NOT_FOUND');
  const willRemainFullAdmin = current.status === 1 && ['admin', 'super_admin'].includes(current.role)
    && (data.status ?? current.status) === 1
    && ['admin', 'super_admin'].includes(data.role ?? current.role);
  if (!willRemainFullAdmin && activeAdminCount <= 1 && current.status === 1 && ['admin', 'super_admin'].includes(current.role)) {
    throw new AppError(422, '至少保留一个启用的管理员账号', 'ADMIN_LAST_FULL_ADMIN');
  }

  const admin = await prisma.admin.update({
    where: { id: adminId },
    data,
  });
  ctx.body = { success: true, data: sanitizeAdmin(admin) };
}

export async function deleteAdmin(ctx: Context) {
  const adminId = ctx.params.id;
  if (adminId === ctx.state.user?.userId) {
    throw new AppError(422, '不能删除当前登录账号', 'ADMIN_DELETE_SELF');
  }
  const current = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!current) throw new AppError(404, '管理员账号不存在', 'ADMIN_NOT_FOUND');
  if (current.status === 1 && ['admin', 'super_admin'].includes(current.role)) {
    const activeAdminCount = await prisma.admin.count({ where: { role: { in: ['admin', 'super_admin'] }, status: 1 } });
    if (activeAdminCount <= 1) {
      throw new AppError(422, '至少保留一个启用的管理员账号', 'ADMIN_LAST_FULL_ADMIN');
    }
  }
  await prisma.admin.delete({ where: { id: adminId } });
  ctx.body = { success: true };
}

function sanitizeAdmin(admin: any) {
  return {
    id: admin.id,
    username: admin.username,
    role: admin.role,
    status: admin.status,
    lastLogin: admin.lastLogin,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}

// ─── 用户管理 ───────────────────────────────────────

export async function getUsers(ctx: Context) {
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);
  const keyword = ctx.query.keyword as string;
  const tree = String(ctx.query.tree || '') === '1';

  const where: any = {};
  if (keyword) {
    where.OR = [
      { id: { contains: keyword } },
      { nickname: { contains: keyword } },
      { phone: { contains: keyword } },
      { shareCode: { contains: keyword } },
      { mpOpenId: { contains: keyword } },
      { miniOpenId: { contains: keyword } },
    ];
  }

  if (tree) {
    const data = await getUserInvitationTree({ page, pageSize, keyword });
    ctx.body = { success: true, data };
    return;
  }

  const [list, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        pointsAccount: { select: { balance: true, frozen: true, expiredAt: true } },
        distributorProfile: {
          select: {
            id: true,
            code: true,
            level: true,
            status: true,
            parentId: true,
            name: true,
            newUserGiftOverride: true,
            isGeneralAgent: true,
            generalAgentRate: true,
            generalAgentParentId: true,
          },
        },
        shareReferralRecord: {
          select: {
            referrerUserId: true,
            sourceCode: true,
            createdAt: true,
            referrer: {
              select: {
                id: true,
                nickname: true,
                phone: true,
                shareCode: true,
              },
            },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  ctx.body = { success: true, data: { list, total, page, pageSize } };
}

export async function getUserMenuStats(ctx: Context) {
  const lastSeen = parseDateQuery(ctx.query.lastSeen);
  const where = lastSeen ? { createdAt: { gt: lastSeen } } : {};
  const [newCount, latest] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);
  ctx.body = {
    success: true,
    data: {
      newCount,
      latestCreatedAt: latest?.createdAt || null,
    },
  };
}

async function getUserInvitationTree(params: { page: number; pageSize: number; keyword?: string }) {
  const keyword = String(params.keyword || '').trim();
  const [users, shareReferrals] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        pointsAccount: { select: { balance: true, frozen: true, expiredAt: true } },
        distributorProfile: { select: { id: true, code: true, level: true, status: true, parentId: true } },
        shareReferralRecord: { select: { referrerUserId: true, sourceCode: true, createdAt: true } },
      },
    }),
    prisma.shareReferral.findMany({
      select: { userId: true, referrerUserId: true, sourceCode: true, createdAt: true },
    }),
  ]);

  const userMap = new Map(users.map(user => [user.id, user]));
  const referralsByReferrer = new Map<string, any[]>();
  const referredUserIds = new Set<string>();
  for (const referral of shareReferrals) {
    const list = referralsByReferrer.get(referral.referrerUserId) || [];
    list.push(referral);
    referralsByReferrer.set(referral.referrerUserId, list);
    referredUserIds.add(referral.userId);
  }

  for (const list of referralsByReferrer.values()) {
    list.sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));
  }

  const roots = users
    .filter(user => user.distributorProfile?.level === 1 || (!referredUserIds.has(user.id) && (referralsByReferrer.get(user.id)?.length || 0) > 0))
    .map((user) => {
      const directReferrals = referralsByReferrer.get(user.id) || [];
      const children = directReferrals
        .map(referral => buildInvitationNode(userMap.get(referral.userId), referral, referralsByReferrer, userMap, 1))
        .filter((item): item is AdminInvitationNode => Boolean(item));
      return buildInvitationNode(user, null, referralsByReferrer, userMap, 0, children);
    })
    .filter(Boolean) as any[];

  const filtered = keyword
    ? roots
      .map(root => filterInvitationNode(root, keyword))
      .filter(Boolean) as any[]
    : roots;

  const total = filtered.length;
  const list = filtered.slice((params.page - 1) * params.pageSize, params.page * params.pageSize);
  return { list, total, page: params.page, pageSize: params.pageSize };
}

function buildInvitationNode(
  user: any,
  referral: any,
  referralsByReferrer: Map<string, any[]>,
  userMap: Map<string, any>,
  depth: number,
  childrenOverride?: AdminInvitationNode[],
): AdminInvitationNode | null {
  if (!user) return null;
  const directSecondLevel = user.distributorProfile?.level === 2;
  const children: AdminInvitationNode[] = childrenOverride ?? (directSecondLevel
    ? (referralsByReferrer.get(user.id) || [])
      .map(childReferral => buildInvitationNode(userMap.get(childReferral.userId), childReferral, referralsByReferrer, userMap, depth + 1))
      .filter((item): item is AdminInvitationNode => Boolean(item))
    : []);
  return {
    id: user.id,
    nickname: user.nickname,
    phone: user.phone,
    miniOpenId: user.miniOpenId,
    mpOpenId: user.mpOpenId,
    shareCode: user.shareCode,
    status: user.status,
    createdAt: user.createdAt,
    pointsAccount: user.pointsAccount,
    distributorProfile: user.distributorProfile,
    invitation: referral ? {
      sourceCode: referral.sourceCode,
      createdAt: referral.createdAt,
      referrerUserId: referral.referrerUserId,
    } : null,
    depth,
    roleLabel: userInvitationRoleLabel(user, depth),
    children,
    directInviteCount: referralsByReferrer.get(user.id)?.length || 0,
  };
}

function filterInvitationNode(node: any, keyword: string): any | null {
  const children = (node.children || []).map((child: any) => filterInvitationNode(child, keyword)).filter(Boolean);
  if (invitationNodeMatches(node, keyword) || children.length) {
    return { ...node, children };
  }
  return null;
}

function invitationNodeMatches(node: any, keyword: string) {
  const text = [
    node.id,
    node.nickname,
    node.phone,
    node.shareCode,
    node.miniOpenId,
    node.mpOpenId,
    node.distributorProfile?.code,
    node.roleLabel,
    node.invitation?.sourceCode,
  ].filter(Boolean).join(' ').toLowerCase();
  return text.includes(keyword.toLowerCase());
}

function userInvitationRoleLabel(user: any, depth: number) {
  if (user.distributorProfile?.level === 1) return '一级分销';
  if (user.distributorProfile?.level === 2) return '二级分销';
  if (depth >= 2) return '二级邀请普通用户';
  if (depth === 1) return '一级邀请普通用户';
  return '普通用户';
}

export async function getUserDetail(ctx: Context) {
  const user = await prisma.user.findUnique({
    where: { id: ctx.params.id },
    include: {
      pointsAccount: true,
      orders: { orderBy: { createdAt: 'desc' }, take: 10 },
      consultationRecords: { orderBy: { createdAt: 'desc' }, take: 10 },
      distributorProfile: {
        select: {
          id: true,
          code: true,
          level: true,
          status: true,
          parentId: true,
          name: true,
          newUserGiftOverride: true,
          isGeneralAgent: true,
          generalAgentRate: true,
          generalAgentParentId: true,
        },
      },
      shareReferralRecord: {
        select: {
          sourceCode: true,
          createdAt: true,
          referrer: {
            select: { id: true, nickname: true, phone: true, shareCode: true },
          },
        },
      },
      shareReferrals: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              phone: true,
              miniOpenId: true,
              mpOpenId: true,
              shareCode: true,
              status: true,
              createdAt: true,
              pointsAccount: { select: { balance: true, frozen: true, expiredAt: true } },
              distributorProfile: { select: { code: true, level: true, status: true } },
            },
          },
        },
      },
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
  const { nickname, status, shareCode } = ctx.request.body as any;
  const data: any = {};

  if (Object.prototype.hasOwnProperty.call(ctx.request.body as any, 'nickname')) {
    data.nickname = String(nickname || '').trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(ctx.request.body as any, 'status')) {
    const normalizedStatus = Number(status);
    if (![0, 1].includes(normalizedStatus)) {
      throw new AppError(422, '用户状态参数错误', 'USER_STATUS_INVALID');
    }
    data.status = normalizedStatus;
  }
  if (Object.prototype.hasOwnProperty.call(ctx.request.body as any, 'shareCode')) {
    const normalizedShareCode = normalizeAdminShareCode(shareCode);
    validateAdminShareCode(normalizedShareCode);

    const ownDistributor = await prisma.distributor.findUnique({
      where: { userId: ctx.params.id },
      select: { id: true },
    });
    const [duplicateUser, duplicateDistributor] = await Promise.all([
      prisma.user.findFirst({
        where: {
          shareCode: normalizedShareCode,
          id: { not: ctx.params.id },
        },
        select: { id: true },
      }),
      prisma.distributor.findUnique({
        where: { code: normalizedShareCode },
        select: { id: true, userId: true },
      }),
    ]);
    if (duplicateUser || (duplicateDistributor && duplicateDistributor.id !== ownDistributor?.id)) {
      throw new AppError(409, '邀请码已被占用，请换一个', 'SHARE_CODE_TAKEN');
    }
    data.shareCode = normalizedShareCode;
  }

  if (!Object.keys(data).length) {
    ctx.status = 422;
    ctx.body = { success: false, message: '没有可更新的字段' };
    return;
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: ctx.params.id },
        data,
      });

      const distributorData: any = {};
      if (Object.prototype.hasOwnProperty.call(data, 'nickname')) {
        distributorData.name = updated.nickname || updated.phone || `分销员${updated.id.slice(0, 6)}`;
      }
      if (Object.prototype.hasOwnProperty.call(data, 'shareCode')) {
        distributorData.code = updated.shareCode;
      }
      if (Object.keys(distributorData).length) {
        await tx.distributor.updateMany({
          where: { userId: updated.id },
          data: distributorData,
        });
      }

      return updated;
    });
    ctx.body = { success: true, data: user };
  } catch (err: any) {
    if (err?.code === 'P2025') {
      ctx.status = 404;
      ctx.body = { success: false, message: '用户不存在' };
      return;
    }
    if (err?.code === 'P2002') {
      ctx.status = 409;
      ctx.body = { success: false, message: '邀请码已被占用，请换一个' };
      return;
    }
    throw err;
  }
}

export async function purgeUserForAdmin(ctx: Context) {
  const userId = ctx.params.id;
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        phone: true,
        miniOpenId: true,
        mpOpenId: true,
        shareCode: true,
      },
    });
    if (!user) {
      throw new AppError(404, '用户不存在或已被清除', 'USER_NOT_FOUND');
    }

    const { system } = await ensureDistributionDefaults(tx);
    const summary: Record<string, number> = {};
    const addCount = (key: string, value?: number) => {
      summary[key] = (summary[key] || 0) + (value || 0);
    };

    const ownShareReferral = await tx.shareReferral.findUnique({ where: { userId } });
    if (ownShareReferral) {
      const rewardTransactions = await tx.pointsTransaction.findMany({
        where: {
          source: 'share_referral_reward',
          sourceId: ownShareReferral.id,
          amount: { gt: 0 },
        },
        select: { id: true, userId: true, amount: true },
      });
      const rewardsByUser = new Map<string, number>();
      for (const item of rewardTransactions) {
        rewardsByUser.set(item.userId, (rewardsByUser.get(item.userId) || 0) + item.amount);
      }
      for (const [rewardUserId, amount] of rewardsByUser.entries()) {
        const account = await tx.pointsAccount.findUnique({ where: { userId: rewardUserId } });
        if (account) {
          await tx.pointsAccount.update({
            where: { userId: rewardUserId },
            data: { balance: Math.max(0, account.balance - amount) },
          });
        }
      }
      const rewardDeleted = await tx.pointsTransaction.deleteMany({
        where: { id: { in: rewardTransactions.map(item => item.id) } },
      });
      addCount('referrerRewardTransactions', rewardDeleted.count);
    }

    const distributor = await tx.distributor.findUnique({
      where: { userId },
      select: { id: true, level: true },
    });
    if (distributor) {
      const directReferrals = await tx.distributionReferral.findMany({
        where: { distributorId: distributor.id },
        select: { userId: true },
      });
      const directReferralUserIds = directReferrals.map(item => item.userId);
      if (directReferralUserIds.length) {
        const directCommissionDeleted = await tx.distributionCommission.deleteMany({
          where: { referralUserId: { in: directReferralUserIds } },
        });
        addCount('distributionCommissions', directCommissionDeleted.count);
        const directReferralDeleted = await tx.distributionReferral.deleteMany({
          where: { userId: { in: directReferralUserIds } },
        });
        addCount('distributionReferrals', directReferralDeleted.count);
        const referredUserCleared = await tx.user.updateMany({
          where: { id: { in: directReferralUserIds }, referredByDistributorId: distributor.id },
          data: { referredByDistributorId: null, referredAt: null },
        });
        addCount('referredUsersCleared', referredUserCleared.count);
      }

      const overrideCommissionDeleted = await tx.distributionCommission.deleteMany({
        where: { distributorId: distributor.id },
      });
      addCount('distributionCommissions', overrideCommissionDeleted.count);
      const firstLevelCleared = await tx.distributionReferral.updateMany({
        where: { firstLevelDistributorId: distributor.id },
        data: { firstLevelDistributorId: system.id },
      });
      addCount('firstLevelReferralsCleared', firstLevelCleared.count);
      const childDistributorsMoved = await tx.distributor.updateMany({
        where: { parentId: distributor.id },
        data: { parentId: system.id },
      });
      addCount('childDistributorsMoved', childDistributorsMoved.count);
      const referredByCleared = await tx.user.updateMany({
        where: { referredByDistributorId: distributor.id },
        data: { referredByDistributorId: null, referredAt: null },
      });
      addCount('referredUsersCleared', referredByCleared.count);
    }

    const targetCommissionDeleted = await tx.distributionCommission.deleteMany({
      where: { referralUserId: userId },
    });
    addCount('distributionCommissions', targetCommissionDeleted.count);

    const ownDistributionReferralDeleted = await tx.distributionReferral.deleteMany({
      where: { userId },
    });
    addCount('distributionReferrals', ownDistributionReferralDeleted.count);

    const invitedUsers = await tx.shareReferral.findMany({
      where: { referrerUserId: userId },
      select: { userId: true },
    });
    const invitedUserIds = invitedUsers.map(item => item.userId);
    const shareReferralDeleted = await tx.shareReferral.deleteMany({
      where: { OR: [{ userId }, { referrerUserId: userId }] },
    });
    addCount('shareReferrals', shareReferralDeleted.count);
    if (invitedUserIds.length) {
      const invitedDistributionReferralDeleted = await tx.distributionReferral.deleteMany({
        where: { userId: { in: invitedUserIds } },
      });
      addCount('distributionReferrals', invitedDistributionReferralDeleted.count);
      const invitedUserCleared = await tx.user.updateMany({
        where: { id: { in: invitedUserIds } },
        data: { referredByDistributorId: null, referredAt: null },
      });
      addCount('referredUsersCleared', invitedUserCleared.count);
    }

    const orders = await tx.order.findMany({ where: { userId }, select: { id: true } });
    const orderIds = orders.map(item => item.id);
    if (orderIds.length) {
      const orderCommissionDeleted = await tx.distributionCommission.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      addCount('distributionCommissions', orderCommissionDeleted.count);
    }

    const deletions = await Promise.all([
      tx.favorite.deleteMany({ where: { userId } }),
      tx.consultationRecord.deleteMany({ where: { userId } }),
      tx.volunteerReport.deleteMany({ where: { userId } }),
      tx.dailyShareReward.deleteMany({ where: { userId } }),
      tx.shareEvent.deleteMany({ where: { OR: [{ userId }, ...(user.shareCode ? [{ shareCode: user.shareCode }] : [])] } }),
      tx.pointsTransaction.deleteMany({ where: { userId } }),
      tx.pointsAccount.deleteMany({ where: { userId } }),
      tx.order.deleteMany({ where: { userId } }),
    ]);
    [
      'favorites',
      'consultationRecords',
      'volunteerReports',
      'dailyShareRewards',
      'shareEvents',
      'pointsTransactions',
      'pointsAccounts',
      'orders',
    ].forEach((key, index) => addCount(key, deletions[index].count));

    if (distributor) {
      const distributorDeleted = await tx.distributor.deleteMany({ where: { id: distributor.id } });
      addCount('distributors', distributorDeleted.count);
    }

    const userDeleted = await tx.user.delete({ where: { id: userId } });
    addCount('users', 1);

    return {
      user: {
        id: userDeleted.id,
        nickname: userDeleted.nickname,
        phone: userDeleted.phone,
        miniOpenId: user.miniOpenId,
        mpOpenId: user.mpOpenId,
      },
      summary,
    };
  });

  const reportDir = path.join(REPORT_OUTPUT_DIR, safePathSegment(userId));
  let reportFilesRemoved = false;
  try {
    await fs.promises.rm(reportDir, { recursive: true, force: true });
    reportFilesRemoved = true;
  } catch (err) {
    logger.warn({ err, userId, reportDir }, '清除用户报告缓存失败');
  }

  logger.warn({ adminId: ctx.state.user?.userId, userId, summary: result.summary }, '管理员清除测试用户');
  ctx.body = {
    success: true,
    data: {
      ...result,
      reportFilesRemoved,
    },
  };
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
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            phone: true,
            shareCode: true,
            distributorProfile: { select: { id: true, level: true, status: true, name: true, code: true } },
          },
        },
        distributionCommissions: {
          orderBy: { createdAt: 'desc' },
          include: {
            distributor: { select: { id: true, name: true, code: true, level: true } },
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  ctx.body = { success: true, data: { list, total, page, pageSize } };
}

export async function getOrderMenuStats(ctx: Context) {
  const lastSeen = parseDateQuery(ctx.query.lastSeen);
  const where = lastSeen ? { createdAt: { gt: lastSeen } } : {};
  const [newCount, latest] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);
  ctx.body = {
    success: true,
    data: {
      newCount,
      latestCreatedAt: latest?.createdAt || null,
    },
  };
}

export async function getOrderDetail(ctx: Context) {
  const order = await prisma.order.findUnique({
    where: { id: ctx.params.id },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          phone: true,
          shareCode: true,
          distributorProfile: { select: { id: true, level: true, status: true, name: true, code: true } },
        },
      },
      distributionCommissions: {
        orderBy: { createdAt: 'desc' },
        include: {
          distributor: { select: { id: true, name: true, code: true, level: true } },
        },
      },
    },
  });
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
  const {
    provider,
    model,
    temperature,
    maxTokens,
    topP,
    contextWindow,
    skillEnabled,
    skillWeight,
    pointsPerQuery,
    pointsPerDeep,
    freeAskLimit,
    apiKey,
    apiBaseUrl,
    bailianModel,
    bailianApiKey,
    bailianBaseUrl,
    normalModel,
    deepModel,
    normalMaxTokens,
    deepMaxTokens,
    timeout,
  } = ctx.request.body as any;

  const aiConfig = await prisma.aiConfig.findFirst();
  if (!aiConfig) throw new AppError(404, 'AI 配置不存在', 'AI_CONFIG_NOT_FOUND');

  const selectedProvider = provider ? normalizeAiProvider(provider) : inferAiProvider(undefined, bailianModel || model);
  const normalizedDeepSeekModel = normalizeDeepSeekModel(model || aiConfig.model || DEFAULT_DEEPSEEK_MODEL);
  const normalizedBailianModel = normalizeModelId(bailianModel || (selectedProvider === 'bailian' ? model : '') || DEFAULT_BAILIAN_MODEL, DEFAULT_BAILIAN_MODEL);
  const normalizedNormalModel = normalizeScenarioModel(normalModel, normalizedBailianModel);
  const normalizedDeepModel = normalizeScenarioModel(deepModel, selectedProvider === 'bailian' ? DEFAULT_BAILIAN_MODEL : normalizedDeepSeekModel);

  const updated = await prisma.aiConfig.update({
    where: { id: aiConfig.id },
    data: {
      provider: selectedProvider,
      model: normalizedDeepSeekModel,
      temperature,
      maxTokens,
      topP,
      contextWindow,
      skillEnabled,
      skillWeight,
      pointsPerQuery,
      pointsPerDeep,
      freeAskLimit,
      apiKey: normalizeOptionalSecret(apiKey),
      apiBaseUrl: normalizeOptionalUrl(apiBaseUrl),
      bailianModel: normalizedBailianModel,
      bailianApiKey: normalizeOptionalSecret(bailianApiKey),
      bailianBaseUrl: normalizeOptionalUrl(bailianBaseUrl),
      normalModel: normalizedNormalModel,
      deepModel: normalizedDeepModel,
      normalMaxTokens: normalizeTokenLimit(normalMaxTokens, 700, 100, 3000),
      deepMaxTokens: normalizeTokenLimit(deepMaxTokens, 2600, 500, 8000),
      timeout,
    },
  });
  if (pointsPerQuery !== undefined || pointsPerDeep !== undefined) {
    const current = await getPointSettings();
    await updatePointSettings({
      freeGift: current.freeGift,
      defaultCost: pointsPerQuery ?? current.defaultCost,
      deepAnalysisCost: pointsPerDeep ?? current.deepAnalysisCost,
      volunteerAnalysisCost: current.volunteerAnalysisCost,
      volunteerReportPdfCost: current.volunteerReportPdfCost,
      volunteerReportImageCost: current.volunteerReportImageCost,
      expireDays: current.expireDays,
    });
  }

  ctx.body = { success: true, data: updated };
}

function normalizeDeepSeekModel(value: any) {
  const model = String(value || '').trim() || DEFAULT_DEEPSEEK_MODEL;
  if (!['deepseek-chat', 'deepseek-flash'].includes(model)) {
    throw new AppError(422, 'DeepSeek 官方模型只能选择 deepseek-chat 或 deepseek-flash', 'AI_MODEL_INVALID');
  }
  return model;
}

function normalizeScenarioModel(value: any, fallback: string) {
  const model = String(value || '').trim();
  if (!model || model === 'global') return 'global';
  return normalizeModelId(model, fallback);
}

function normalizeTokenLimit(value: any, fallback: number, min: number, max: number) {
  const raw = value === undefined || value === null || value === '' ? fallback : Number(value);
  const n = Math.round(raw);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new AppError(422, `最大回复长度必须是 ${min}-${max} 之间的整数`, 'AI_TOKEN_LIMIT_INVALID');
  }
  return n;
}

function normalizeModelId(value: any, fallback: string) {
  const model = String(value || '').trim();
  if (!model) return fallback;
  if (!/^[a-zA-Z0-9._:-]{2,100}$/.test(model)) {
    throw new AppError(422, '模型 ID 格式不正确，只能包含字母、数字、点、下划线、中横线和冒号', 'AI_MODEL_INVALID');
  }
  if (['qwen-image-2.0', 'qwen-image-2.0-pro', 'wan2.7-image', 'wan2.7-image-pro'].includes(model)) {
    throw new AppError(422, '图片生成模型不能用于 AI 文本咨询，请选择文本生成或推理模型', 'AI_TEXT_MODEL_REQUIRED');
  }
  return model;
}

function normalizeOptionalSecret(value: any) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeOptionalUrl(value: any) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) {
    throw new AppError(422, 'API 地址必须以 http:// 或 https:// 开头', 'AI_API_BASE_URL_INVALID');
  }
  return text;
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
  const [aiConfig, pointSettings, distributionSettings] = await Promise.all([
    prisma.aiConfig.findFirst(),
    getPointSettings(),
    getDistributionSettingsForAdmin(),
  ]);
  ctx.body = {
    success: true,
    data: {
      freeAskLimit: aiConfig?.freeAskLimit ?? 2,
      freeGift: pointSettings.freeGift,
      dailyShareReward: distributionSettings.dailyShareReward,
      referralReward: distributionSettings.referralReward,
      volunteerAnalysisCost: pointSettings.volunteerAnalysisCost,
      volunteerReportPdfCost: pointSettings.volunteerReportPdfCost,
      volunteerReportImageCost: pointSettings.volunteerReportImageCost,
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
        model: normalizeSkillModel(model),
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
      const data: any = { name, description, systemPrompt, model: normalizeSkillModel(model), temperature, maxTokens, topP, status, isDefault, sortOrder };
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
