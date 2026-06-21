import { prisma } from '../utils/prisma';
import { signToken, JwtPayload } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import axios from 'axios';
import crypto from 'crypto';
import { getWechatMiniProgramCredentials } from './payment.service';
import { getPointSettings } from './point-config.service';
import { createReferralForNewUser, ensureUserShareCode, grantPartnerNewUserExtraGift } from './distribution.service';
import { lookupIpLocation } from './ip-location.service';
import { reportTencentRegisterConversion } from './tencent-ad-conversion.service';

let accessTokenCache: { token: string; expiresAt: number } | null = null;

// 微信小程序登录：code 换 OpenID
async function miniProgramLogin(code: string) {
  const { appId, secret } = await getWechatMiniProgramCredentials();
  if (isPlaceholder(appId) || isPlaceholder(secret)) {
    throw new AppError(503, '微信小程序登录未配置：WECHAT_MINI_APPID、WECHAT_MINI_SECRET', 'WECHAT_MINI_NOT_CONFIGURED');
  }

  const data = await requestWechatCodeSession(appId, secret, code);

  if (data.errcode) {
    throw new AppError(400, `微信登录失败: ${data.errmsg}`, 'WECHAT_LOGIN_FAIL');
  }

  return { openId: data.openid, unionId: data.unionid, sessionKey: data.session_key };
}

async function requestWechatCodeSession(appId: string, secret: string, code: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
        params: {
          appid: appId,
          secret,
          js_code: code,
          grant_type: 'authorization_code',
        },
        timeout: 10000,
      });
      return data;
    } catch (error) {
      lastError = error;
      if (!shouldRetryWechatRequest(error) || attempt === 1) break;
    }
  }

  throw normalizeWechatAxiosError(lastError, '微信登录服务暂时不可用，请稍后重试', 'WECHAT_LOGIN_UPSTREAM_UNAVAILABLE');
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
export async function loginByMiniProgram(code: string, profile?: { nickName?: string; avatarUrl?: string; phoneCode?: string; phoneEncryptedData?: string; phoneIv?: string; province?: string; city?: string }, referralCode?: string, clientIp?: string, adAttribution?: any) {
  const { openId, unionId, sessionKey } = await miniProgramLogin(code);
  const profileData = normalizeWechatProfile(profile);
  const locationData = normalizeUserLocation(profile);
  const ipLocationData = await lookupUserLocationByIp(clientIp);
  const phone = await resolvePhoneNumber(profile, sessionKey);
  const defaultNickname = profileData.nickname || buildDefaultNickname(phone);
  let isNewUser = false;

  let user = await prisma.user.findFirst({
    where: unionId ? { unionId } : { miniOpenId: openId },
  });

  if (user) {
    const locationPatch = buildExistingUserLocationPatch(user, locationData, ipLocationData);
    // 更新绑定信息
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        miniOpenId: openId,
        miniSessionKey: sessionKey,
        ...(unionId ? { unionId } : {}),
        ...profileData,
        ...locationPatch,
        ...(!profileData.nickname && phone && shouldRefreshDefaultNickname(user.nickname) ? { nickname: defaultNickname } : {}),
        ...(phone ? { phone } : {}),
      },
    });
    user = await ensureUserShareCode(user.id);
  } else {
    // 新用户注册 + 赠送点数（事务保证原子性）
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          miniOpenId: openId,
          miniSessionKey: sessionKey,
          ...(unionId ? { unionId } : {}),
          nickname: defaultNickname,
          ...(profileData.avatar ? { avatar: profileData.avatar } : {}),
          ...buildNewUserLocationData(locationData, ipLocationData),
          ...(clientIp ? { registerIp: clientIp } : {}),
          ...(phone ? { phone } : {}),
        },
      });
      await giftNewUserPoints(newUser.id, tx, referralCode);
      await createReferralForNewUser(tx, newUser.id, referralCode);
      return ensureUserShareCode(newUser.id, tx);
    });
    isNewUser = true;
  }

  if (!user) throw new AppError(404, '用户不存在', 'USER_NOT_FOUND');
  if (isNewUser) {
    reportTencentRegisterConversion({
      userId: user.id,
      openId,
      unionId,
      registeredAt: user.createdAt,
      attribution: adAttribution,
    }).catch((err) => {
      console.error('腾讯广告注册转化回传排队失败:', err);
    });
  }
  const token = signToken({ userId: user.id });
  return { token, user: sanitizeUser(user) };
}

export async function ensureUserLocationByIp(user: any, clientIp?: string) {
  if (!user?.id || (user.province && user.city)) return user;
  const ipLocationData = await lookupUserLocationByIp(clientIp);
  const data = buildExistingUserLocationPatch(user, {}, ipLocationData);
  if (!Object.keys(data).length) return user;
  return prisma.user.update({
    where: { id: user.id },
    data,
  });
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
    user = await ensureUserShareCode(user.id);
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
      return ensureUserShareCode(newUser.id, tx);
    });
  }

  return user;
}

// 新用户赠送免费点数（可选事务客户端）
async function giftNewUserPoints(userId: string, tx?: any, referralCode?: string) {
  const db = tx || prisma;
  const settings = await getPointSettings();
  const giftPoints = Math.max(0, Math.round(Number(settings.freeGift || 0)));
  const expiredAt = new Date();
  expiredAt.setDate(expiredAt.getDate() + settings.expireDays);

  await db.pointsAccount.create({
    data: { userId, balance: giftPoints, expiredAt },
  });

  await db.pointsTransaction.create({
    data: {
      userId,
      type: 'gift',
      amount: giftPoints,
      balanceAfter: giftPoints,
      source: 'system',
      sourceId: 'register',
      remark: '新用户注册赠送',
    },
  });

  await grantPartnerNewUserExtraGift(db, userId, referralCode);
}

// 脱敏用户信息
function sanitizeUser(user: any) {
  const { id, nickname, avatar, phone, province, city, status, createdAt, shareCode } = user;
  return { id, nickname, avatar, phone, province, city, status, createdAt, shareCode };
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

async function resolvePhoneNumber(profile: any, sessionKey?: string) {
  if (profile?.phoneCode) return getPhoneNumberByCode(String(profile.phoneCode));
  if (profile?.phoneEncryptedData && profile?.phoneIv && sessionKey) {
    return decryptPhoneNumber(String(profile.phoneEncryptedData), String(profile.phoneIv), sessionKey);
  }
  return '';
}

function decryptPhoneNumber(encryptedData: string, iv: string, sessionKey: string) {
  try {
    const decipher = crypto.createDecipheriv(
      'aes-128-cbc',
      Buffer.from(sessionKey, 'base64'),
      Buffer.from(iv, 'base64'),
    );
    decipher.setAutoPadding(true);
    const decoded = Buffer.concat([
      decipher.update(Buffer.from(encryptedData, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    const data = JSON.parse(decoded);
    return data.phoneNumber || data.purePhoneNumber || '';
  } catch (err) {
    throw new AppError(400, '手机号授权解密失败，请重新授权', 'WECHAT_PHONE_DECRYPT_FAIL');
  }
}

async function requestPhoneNumber(phoneCode: string, accessToken: string) {
  try {
    const { data } = await axios.post(
      'https://api.weixin.qq.com/wxa/business/getuserphonenumber',
      { code: phoneCode },
      {
        params: { access_token: accessToken },
        timeout: 10000,
      },
    );
    return data;
  } catch (error) {
    throw normalizeWechatAxiosError(error, '微信手机号服务暂时不可用，请稍后重试', 'WECHAT_PHONE_UPSTREAM_UNAVAILABLE');
  }
}

function isWechatAccessTokenInvalid(data: any) {
  return [40001, 40014, 42001].includes(Number(data?.errcode));
}

async function getMiniProgramAccessToken(appId: string, secret: string, forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && accessTokenCache && accessTokenCache.expiresAt > now + 60_000) {
    return accessTokenCache.token;
  }

  let data: any;
  try {
    const response = await axios.post(
      'https://api.weixin.qq.com/cgi-bin/stable_token',
      {
        grant_type: 'client_credential',
        appid: appId,
        secret,
        force_refresh: forceRefresh,
      },
      { timeout: 10000 },
    );
    data = response.data;
  } catch (error) {
    throw normalizeWechatAxiosError(error, '微信 access_token 服务暂时不可用，请稍后重试', 'WECHAT_ACCESS_TOKEN_UPSTREAM_UNAVAILABLE');
  }

  if (data.errcode) {
    throw new AppError(400, `微信 access_token 获取失败: ${data.errmsg}`, 'WECHAT_ACCESS_TOKEN_FAIL');
  }

  accessTokenCache = {
    token: data.access_token,
    expiresAt: now + Math.max(0, Number(data.expires_in || 7200) - 300) * 1000,
  };
  return accessTokenCache.token;
}

function shouldRetryWechatRequest(error: unknown) {
  if (!axios.isAxiosError(error)) return false;
  return error.code === 'ECONNABORTED' || !error.response;
}

function normalizeWechatAxiosError(error: unknown, message: string, code: string) {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return new AppError(504, message, code, { type: 'timeout' });
    }
    if (!error.response) {
      return new AppError(502, message, code, { type: 'network' });
    }
  }
  return error instanceof AppError
    ? error
    : new AppError(502, message, code);
}

function normalizeWechatProfile(profile?: { nickName?: string; avatarUrl?: string }) {
  const nickname = profile?.nickName?.trim();
  const avatar = profile?.avatarUrl?.trim();
  return {
    ...(nickname ? { nickname } : {}),
    ...(avatar ? { avatar } : {}),
  };
}

function normalizeUserLocation(input?: { province?: string; city?: string }) {
  const province = normalizeLocationText(input?.province, 40);
  const city = normalizeLocationText(input?.city, 40);
  return {
    ...(province ? { province } : {}),
    ...(city ? { city } : {}),
  };
}

async function lookupUserLocationByIp(clientIp?: string) {
  const location = await lookupIpLocation(clientIp);
  if (!location) return {};
  return {
    ...(location.province ? { province: location.province } : {}),
    ...(location.city ? { city: location.city } : {}),
  };
}

function buildNewUserLocationData(profileLocation: any, ipLocation: any) {
  return {
    ...(profileLocation.province ? { province: profileLocation.province } : ipLocation.province ? { province: ipLocation.province } : {}),
    ...(profileLocation.city ? { city: profileLocation.city } : ipLocation.city ? { city: ipLocation.city } : {}),
  };
}

function buildExistingUserLocationPatch(user: any, profileLocation: any, ipLocation: any) {
  const data: Record<string, string> = {};
  if (profileLocation.province) data.province = profileLocation.province;
  else if (!user.province && ipLocation.province) data.province = ipLocation.province;

  if (profileLocation.city) data.city = profileLocation.city;
  else if (!user.city && ipLocation.city) data.city = ipLocation.city;

  return data;
}

function normalizeLocationText(value: any, max: number) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/[<>]/g, '').slice(0, max);
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
