import { prisma } from '../utils/prisma';
import { signToken, JwtPayload } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import axios from 'axios';

// 微信小程序登录：code 换 OpenID
async function miniProgramLogin(code: string) {
  const { appId, secret } = config.wechat.miniProgram;
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;
  const { data } = await axios.get(url);

  if (data.errcode) {
    throw new AppError(400, `微信登录失败: ${data.errmsg}`, 'WECHAT_LOGIN_FAIL');
  }

  return { openId: data.openid, unionId: data.unionid, sessionKey: data.session_key };
}

// 微信公众号网页授权
async function mpOAuth(code: string) {
  const { appId, secret } = config.wechat.officialAccount;
  const tokenUrl = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${secret}&code=${code}&grant_type=authorization_code`;
  const { data } = await axios.get(tokenUrl);

  if (data.errcode) {
    throw new AppError(400, `公众号授权失败: ${data.errmsg}`, 'WECHAT_OAUTH_FAIL');
  }

  return { openId: data.openid, unionId: data.unionid, accessToken: data.access_token };
}

// 统一登录入口：查找或创建用户
export async function loginByMiniProgram(code: string) {
  const { openId, unionId } = await miniProgramLogin(code);

  let user = await prisma.user.findFirst({
    where: unionId ? { unionId } : { miniOpenId: openId },
  });

  if (user) {
    // 更新绑定信息
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        miniOpenId: openId,
        ...(unionId ? { unionId } : {}),
      },
    });
  } else {
    // 新用户注册 + 赠送点数（事务保证原子性）
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          miniOpenId: openId,
          ...(unionId ? { unionId } : {}),
          nickname: `用户${Date.now().toString(36)}`,
        },
      });
      await giftNewUserPoints(newUser.id, tx);
      return newUser;
    });
  }

  const token = signToken({ userId: user.id });
  return { token, user: sanitizeUser(user) };
}

// 公众号 OpenID 绑定用户（用于消息回调时自动关联）
export async function findOrCreateByMpOpenId(mpOpenId: string, unionId?: string) {
  let user: any;

  if (unionId) {
    user = await prisma.user.findFirst({ where: { unionId } });
  }

  if (!user) {
    user = await prisma.user.findFirst({ where: { mpOpenId } });
  }

  if (user) {
    // 更新绑定
    user = await prisma.user.update({
      where: { id: user.id },
      data: { mpOpenId, ...(unionId ? { unionId } : {}) },
    });
  } else {
    // 新用户：公众号关注即注册 + 赠送点数（事务保证原子性）
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          mpOpenId,
          ...(unionId ? { unionId } : {}),
          nickname: `公众号用户${Date.now().toString(36)}`,
        },
      });
      await giftNewUserPoints(newUser.id, tx);
      return newUser;
    });
  }

  return user;
}

// 新用户赠送免费点数（可选事务客户端）
async function giftNewUserPoints(userId: string, tx?: any) {
  const db = tx || prisma;
  const expiredAt = new Date();
  expiredAt.setDate(expiredAt.getDate() + config.points.expireDays);

  await db.pointsAccount.create({
    data: { userId, balance: config.points.freeGift, expiredAt },
  });

  await db.pointsTransaction.create({
    data: {
      userId,
      type: 'gift',
      amount: config.points.freeGift,
      balanceAfter: config.points.freeGift,
      source: 'system',
      remark: '新用户注册赠送',
    },
  });
}

// 脱敏用户信息
function sanitizeUser(user: any) {
  const { id, nickname, avatar, status, createdAt } = user;
  return { id, nickname, avatar, status, createdAt };
}

export { sanitizeUser };
