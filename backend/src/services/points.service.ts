import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { getPointSettings } from './point-config.service';

// 查询用户点数余额
export async function getBalance(userId: string) {
  const account = await prisma.pointsAccount.findUnique({ where: { userId } });
  if (!account) {
    return { balance: 0, frozen: 0, total: 0 };
  }

  // 检查过期
  if (account.expiredAt < new Date()) {
    await expirePoints(userId, account.balance);
    return { balance: 0, frozen: account.frozen, total: 0 };
  }

  return {
    balance: account.balance,
    frozen: account.frozen,
    total: account.balance + account.frozen,
    expiredAt: account.expiredAt,
  };
}

// 扣减点数（原子操作）
export async function deductPoints(
  userId: string,
  amount: number,
  options: {
    source: string;
    sourceId?: string;
    remark?: string;
  }
) {
  // 使用事务保证原子性
  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.pointsAccount.findUnique({ where: { userId } });
    if (!account) {
      throw new AppError(402, '点数账户不存在', 'NO_POINTS_ACCOUNT');
    }

    // 检查是否过期
    if (account.expiredAt < new Date()) {
      await tx.pointsAccount.update({
        where: { userId },
        data: { balance: 0 },
      });
      throw new AppError(402, '您的咨询点数已过期，请充值后继续使用', 'POINTS_EXPIRED');
    }

    if (account.balance < amount) {
      throw new AppError(
        402,
        `咨询点数不足，当前剩余 ${account.balance} 点，本次需要 ${amount} 点`,
        'INSUFFICIENT_POINTS'
      );
    }

    // 扣减
    const updated = await tx.pointsAccount.update({
      where: { userId },
      data: { balance: { decrement: amount } },
    });

    // 记录流水
    await tx.pointsTransaction.create({
      data: {
        userId,
        type: 'consume',
        amount: -amount,
        balanceAfter: updated.balance,
        source: options.source,
        sourceId: options.sourceId,
        remark: options.remark || `咨询消费 ${amount} 点`,
      },
    });

    return updated;
  });

  return result;
}

// 充值到账
export async function chargePoints(
  userId: string,
  amount: number,
  bonusPoints: number,
  orderId: string
) {
  const totalPoints = amount + bonusPoints;
  const settings = await getPointSettings();
  const expiredAt = new Date();
  expiredAt.setDate(expiredAt.getDate() + settings.expireDays);

  await prisma.$transaction(async (tx) => {
    let account = await tx.pointsAccount.findUnique({ where: { userId } });

    if (!account) {
      account = await tx.pointsAccount.create({
        data: { userId, balance: 0, frozen: 0, expiredAt },
      });
    }

    await tx.pointsAccount.update({
      where: { userId },
      data: {
        balance: { increment: totalPoints },
        expiredAt, // 冲值后刷新过期时间
      },
    });

    // 流水：购买点数
    await tx.pointsTransaction.create({
      data: {
        userId,
        type: 'charge',
        amount,
        balanceAfter: account.balance + totalPoints,
        source: 'order',
        sourceId: orderId,
        remark: `购买 ${amount} 点数`,
      },
    });

    // 流水：赠送点数
    if (bonusPoints > 0) {
      await tx.pointsTransaction.create({
        data: {
          userId,
          type: 'gift',
          amount: bonusPoints,
          balanceAfter: account.balance + totalPoints,
          source: 'order',
          sourceId: orderId,
          remark: `充值赠送 ${bonusPoints} 点数`,
        },
      });
    }
  });
}

// 点数过期处理
async function expirePoints(userId: string, amount: number) {
  await prisma.$transaction(async (tx) => {
    await tx.pointsAccount.update({
      where: { userId },
      data: { balance: 0 },
    });

    await tx.pointsTransaction.create({
      data: {
        userId,
        type: 'expire',
        amount: -amount,
        balanceAfter: 0,
        source: 'system',
        remark: '点数已过期',
      },
    });
  });
}

// 批量过期检查（定时任务）
export async function checkExpiredPoints() {
  const now = new Date();
  const expiredAccounts = await prisma.pointsAccount.findMany({
    where: {
      expiredAt: { lt: now },
      balance: { gt: 0 },
    },
  });

  for (const account of expiredAccounts) {
    await expirePoints(account.userId, account.balance);
  }

  return expiredAccounts.length;
}

// 查询点数流水
export async function getTransactions(userId: string, page = 1, pageSize = 20) {
  const [list, total] = await Promise.all([
    prisma.pointsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.pointsTransaction.count({ where: { userId } }),
  ]);

  return { list, total, page, pageSize };
}
