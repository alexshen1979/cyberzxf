import { prisma } from '../utils/prisma';
import { signToken, JwtPayload } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import axios from 'axios';
import { getWechatMiniProgramCredentials } from './payment.service';
import { getPointSettings } from './point-config.service';
import { createReferralForNewUser } from './distribution.service';

let accessTokenCache: { token: string; expiresAt: number } | null = null;

// 微信小程序登录：code 换 OpenID
async function miniProgramLogin(code: string) {
  const { appId, secret } = await getWechatMiniProgramCredentials();
  if (isPlaceholder(appId) || isPlaceholder(secret)) {
    throw new AppError(503, '微信小程序登录未配置：WECHAT_MINI_APPID、WECHAT_MINI_SECRET', 'WECHAT_MINI_NOT_CONFIGURED');
  }

  const { data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
    params: {
      appid: appId,
      secret,
      js_code: code,
      grant_type: 'authorization_code',
    },
    timeout: 10000,
  });

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
export async function loginByMiniProgram(code: string, profile?: { nickName?: string; avatarUrl?: string; phoneCode?: string }, referralCode?: string) {
  const { openId, unionId } = await miniProgramLogin(code);
  const profileData = normalizeWechatProfile(profile);
  const phone = profile?.phoneCode ? await getPhoneNumberByCode(profile.phoneCode) : '';
  const defaultNickname = profileData.nickname || buildDefaultNickname(phone);

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
        ...profileData,
        ...(!profileData.nickname && phone && shouldRefreshDefaultNickname(user.nickname) ? { nickname: defaultNickname } : {}),
        ...(phone ? { phone } : {}),
      },
    });
  } else {
    // 新用户注册 + 赠送点数（事务保证原子性）
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          miniOpenId: openId,
          ...(unionId ? { unionId } : {}),
          nickname: defaultNickname,
          ...(profileData.avatar ? { avatar: profileData.avatar } : {}),
          ...(phone ? { phone } : {}),
        },
      });
      await giftNewUserPoints(newUser.id, tx);
      await createReferralForNewUser(tx, newUser.id, referralCode);
      return newUser;
    });
  }

  const token = signToken({ userId: user.id });
  return { token, user: sanitizeUser(user) };
}

// 公众号网页授权登录：code 换公众号 OpenID 后绑定/创建统一用户
export async function loginByMpOAuth(code: string) {
  const { openId, unionId } = await mpOAuth(code);
  const user = await findOrCreateByMpOpenId(openId, unionId);
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
  const settings = await getPointSettings();
  const expiredAt = new Date();
  expiredAt.setDate(expiredAt.getDate() + settings.expireDays);

  await db.pointsAccount.create({
    data: { userId, balance: settings.freeGift, expiredAt },
  });

  await db.pointsTransaction.create({
    data: {
      userId,
      type: 'gift',
      amount: settings.freeGift,
      balanceAfter: settings.freeGift,
      source: 'system',
      remark: '新用户注册赠送',
    },
  });
}

// 脱敏用户信息
function sanitizeUser(user: any) {
  const { id, nickname, avatar, phone, status, createdAt } = user;
  return { id, nickname, avatar, phone, status, createdAt };
}

async function getPhoneNumberByCode(phoneCode: string) {
  if (!phoneCode.trim()) return '';

  const { appId, secret } = await getWechatMiniProgramCredentials();
  if (isPlaceholder(appId) || isPlaceholder(secret)) {
    throw new AppError(503, '微信小程序登录未配置：WECHAT_MINI_APPID、WECHAT_MINI_SECRET', 'WECHAT_MINI_NOT_CONFIGURED');
  }

  let data = await requestPhoneNumber(phoneCode, await getMiniProgramAccessToken(appId, secret));
  if (isWechatAccessTokenInvalid(data)) {
    accessTokenCache = null;
    data = await requestPhoneNumber(phoneCode, await getMiniProgramAccessToken(appId, secret, true));
  }

  if (data.errcode) {
    const errmsg = String(data.errmsg || '');
    if (errmsg.includes('invalid code')) {
      throw new AppError(
        400,
        `手机号授权 code 无效：请确认微信开发者工具项目 AppID 与后台配置一致、已开通手机号能力，并用真机预览重试。微信返回：${errmsg}`,
        'WECHAT_PHONE_INVALID_CODE',
      );
    }
    throw new AppError(400, `手机号授权失败: ${errmsg}`, 'WECHAT_PHONE_FAIL');
  }

  return data.phone_info?.phoneNumber || data.phone_info?.purePhoneNumber || '';
}

async function requestPhoneNumber(phoneCode: string, accessToken: string) {
  const { data } = await axios.post(
    'https://api.weixin.qq.com/wxa/business/getuserphonenumber',
    { code: phoneCode },
    {
      params: { access_token: accessToken },
      timeout: 10000,
    },
  );
  return data;
}

function isWechatAccessTokenInvalid(data: any) {
  return [40001, 40014, 42001].includes(Number(data?.errcode));
}

async function getMiniProgramAccessToken(appId: string, secret: string, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && accessTokenCache && accessTokenCache.expiresAt > now + 60_000) {
    return accessTokenCache.token;
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
    throw new AppError(400, `微信 access_token 获取失败: ${data.errmsg}`, 'WECHAT_ACCESS_TOKEN_FAIL');
  }

  accessTokenCache = {
    token: data.access_token,
    expiresAt: now + Math.max(0, Number(data.expires_in || 7200) - 300) * 1000,
  };
  return accessTokenCache.token;
}

function normalizeWechatProfile(profile?: { nickName?: string; avatarUrl?: string }) {
  const nickname = profile?.nickName?.trim();
  const avatar = profile?.avatarUrl?.trim();
  return {
    ...(nickname ? { nickname } : {}),
    ...(avatar ? { avatar } : {}),
  };
}

function buildDefaultNickname(phone?: string) {
  if (phone && phone.length >= 4) return `用户${phone.slice(-4)}`;
  return `微信用户${Date.now().toString(36).slice(-4)}`;
}

function shouldRefreshDefaultNickname(nickname?: string | null) {
  return !nickname || /^用户[0-9a-z]+$/i.test(nickname) || /^微信用户[0-9a-z]+$/i.test(nickname);
}

function isPlaceholder(value?: string) {
  if (!value) return true;
  return /^(wx_.*|your_.*)$/i.test(value);
}

export { sanitizeUser };
