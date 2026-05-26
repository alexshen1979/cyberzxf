import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';

const logger = createLogger('wechat-transfer');

interface ResolvedWechatPayConfig {
  miniAppId: string;
  mchId: string;
  apiV3Key: string;
  serialNo: string;
  privateKeyPath: string;
  platformPublicKeyPath: string;
}

export async function getWechatTransferRuntimeConfig() {
  const payConfig = await ensureWechatPayConfigured();
  const transferNotifyUrl = await resolveTransferNotifyUrl();
  if (isPlaceholder(transferNotifyUrl)) {
    throw new AppError(503, '商家转账回调地址未配置', 'WECHAT_TRANSFER_NOTIFY_URL_NOT_CONFIGURED');
  }
  return {
    appId: payConfig.miniAppId,
    mchId: payConfig.mchId,
    transferNotifyUrl,
  };
}

export async function createWechatMerchantTransfer(input: {
  openId: string;
  outBillNo: string;
  amount: number;
  sceneId: string;
  sceneName: string;
  remark: string;
  jobType: string;
  rewardDesc: string;
  userName?: string | null;
}) {
  const payConfig = await ensureWechatPayConfigured();
  const transferNotifyUrl = await resolveTransferNotifyUrl();
  if (isPlaceholder(transferNotifyUrl)) {
    throw new AppError(503, '商家转账回调地址未配置', 'WECHAT_TRANSFER_NOTIFY_URL_NOT_CONFIGURED');
  }
  if (!input.openId) {
    throw new AppError(422, '用户缺少微信 OpenID，无法转账到零钱', 'WECHAT_TRANSFER_OPENID_REQUIRED');
  }

  const requestPath = '/v3/fund-app/mch-transfer/transfer-bills';
  const body: Record<string, any> = {
    appid: payConfig.miniAppId,
    out_bill_no: input.outBillNo,
    transfer_scene_id: input.sceneId,
    openid: input.openId,
    transfer_amount: input.amount,
    transfer_remark: input.remark.slice(0, 32),
    notify_url: transferNotifyUrl,
    user_recv_perception: '劳务报酬',
    user_name: input.userName || undefined,
    transfer_scene_report_infos: [
      { info_type: '岗位类型', info_content: input.jobType.slice(0, 32) },
      { info_type: '报酬说明', info_content: input.rewardDesc.slice(0, 32) },
    ],
  };
  Object.keys(body).forEach(key => body[key] === undefined && delete body[key]);
  return requestWechatPayApi('POST', requestPath, body, '微信商家转账发起失败', payConfig);
}

export async function queryWechatMerchantTransferByOutBillNo(outBillNo: string) {
  const payConfig = await ensureWechatPayConfigured();
  const requestPath = `/v3/fund-app/mch-transfer/transfer-bills/out-bill-no/${encodeURIComponent(outBillNo)}`;
  return requestWechatPayApi('GET', requestPath, null, '微信商家转账查单失败', payConfig);
}

export async function handleWechatTransferNotify(body: Record<string, any>, headers?: Record<string, any>, rawBody?: string) {
  const payConfig = await resolveWechatPayConfig();
  verifyWechatPayNotifySignature(payConfig, headers, rawBody);
  const resource = body?.resource;
  if (!resource?.ciphertext || !resource?.nonce) {
    throw new AppError(422, '商家转账回调参数不完整', 'WECHAT_TRANSFER_NOTIFY_INVALID');
  }
  return decryptWechatPayResource(payConfig, resource);
}

async function resolveWechatPayConfig(): Promise<ResolvedWechatPayConfig> {
  const dbConfig = await prisma.wechatPayConfig.findFirst();
  return {
    miniAppId: dbConfig?.miniAppId || config.wechat.miniProgram.appId || '',
    mchId: dbConfig?.mchId || config.wechat.pay.mchId || '',
    apiV3Key: dbConfig?.apiV3Key || config.wechat.pay.apiV3Key || '',
    serialNo: dbConfig?.serialNo || config.wechat.pay.serialNo || '',
    privateKeyPath: dbConfig?.privateKeyPath || config.wechat.pay.privateKeyPath || '',
    platformPublicKeyPath: dbConfig?.platformPublicKeyPath || config.wechat.pay.platformPublicKeyPath || '',
  };
}

async function ensureWechatPayConfigured() {
  const payConfig = await resolveWechatPayConfig();
  const missing: string[] = [];
  if (isPlaceholder(payConfig.miniAppId)) missing.push('WECHAT_MINI_APPID');
  if (isPlaceholder(payConfig.mchId)) missing.push('WECHAT_PAY_MCHID');
  if (isPlaceholder(payConfig.serialNo)) missing.push('WECHAT_PAY_SERIAL_NO');
  if (isPlaceholder(payConfig.privateKeyPath) || !fs.existsSync(payConfig.privateKeyPath)) missing.push('WECHAT_PAY_PRIVATE_KEY_PATH');
  if (isPlaceholder(payConfig.apiV3Key) || payConfig.apiV3Key.length < 32) missing.push('WECHAT_PAY_APIV3_KEY');
  if (missing.length > 0) {
    throw new AppError(503, `微信支付未配置完整：${missing.join('、')}`, 'WECHAT_PAY_NOT_CONFIGURED');
  }
  return payConfig;
}

async function resolveTransferNotifyUrl() {
  const [payConfig, setting] = await Promise.all([
    prisma.wechatPayConfig.findFirst(),
    prisma.distributionSetting.findUnique({ where: { id: 'default' } }),
  ]);
  return setting?.transferNotifyUrl
    || payConfig?.transferNotifyUrl
    || config.wechat.pay.transferNotifyUrl
    || config.wechat.pay.notifyUrl?.replace('/payments/callback', '/distribution/transfer-callback')
    || '';
}

async function requestWechatPayApi(
  method: 'GET' | 'POST',
  requestPath: string,
  body: Record<string, any> | null,
  fallbackMessage: string,
  payConfig: ResolvedWechatPayConfig,
) {
  const url = `https://api.mch.weixin.qq.com${requestPath}`;
  const bodyText = body ? JSON.stringify(body) : '';
  const authorization = buildWechatPayAuthorization(payConfig, method, requestPath, bodyText);
  try {
    const response = await axios.request({
      url,
      method,
      data: body || undefined,
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 12000,
    });
    return response.data;
  } catch (err: any) {
    const detail = err?.response?.data;
    const message = detail?.message || detail?.code || err?.message || fallbackMessage;
    logger.error('%s: %s %j', fallbackMessage, message, detail || {});
    throw new AppError(502, `${fallbackMessage}：${message}`, 'WECHAT_TRANSFER_API_FAILED', detail);
  }
}

function isPlaceholder(value?: string) {
  if (!value) return true;
  return /^(wx_.*|your_.*|\/path\/to\/.*)$/i.test(value);
}

function buildWechatPayAuthorization(payConfig: ResolvedWechatPayConfig, method: string, requestPath: string, bodyText: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const message = `${method}\n${requestPath}\n${timestamp}\n${nonceStr}\n${bodyText}\n`;
  const signature = signWithMerchantKey(payConfig, message);

  return `WECHATPAY2-SHA256-RSA2048 ${[
    `mchid="${payConfig.mchId}"`,
    `nonce_str="${nonceStr}"`,
    `signature="${signature}"`,
    `timestamp="${timestamp}"`,
    `serial_no="${payConfig.serialNo}"`,
  ].join(',')}`;
}

function signWithMerchantKey(payConfig: ResolvedWechatPayConfig, message: string) {
  try {
    const privateKey = fs.readFileSync(payConfig.privateKeyPath, 'utf8');
    return crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64');
  } catch (err: any) {
    throw new AppError(503, `微信支付商户私钥不可用：${err.message}`, 'WECHAT_PAY_PRIVATE_KEY_INVALID');
  }
}

function decryptWechatPayResource(payConfig: ResolvedWechatPayConfig, resource: Record<string, string>) {
  const apiV3Key = Buffer.from(payConfig.apiV3Key, 'utf8');
  const encrypted = Buffer.from(resource.ciphertext, 'base64');
  const authTag = encrypted.subarray(encrypted.length - 16);
  const data = encrypted.subarray(0, encrypted.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', apiV3Key, Buffer.from(resource.nonce, 'utf8'));

  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
  }
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted);
}

function verifyWechatPayNotifySignature(payConfig: ResolvedWechatPayConfig, headers?: Record<string, any>, rawBody?: string) {
  if (config.server.isDev && !rawBody) return;
  const signature = getHeader(headers, 'wechatpay-signature');
  const timestamp = getHeader(headers, 'wechatpay-timestamp');
  const nonce = getHeader(headers, 'wechatpay-nonce');
  const serial = getHeader(headers, 'wechatpay-serial');

  if (!signature || !timestamp || !nonce || !serial || !rawBody) {
    throw new AppError(401, '微信支付回调签名头不完整', 'WECHAT_PAY_SIGNATURE_MISSING');
  }
  if (isPlaceholder(payConfig.platformPublicKeyPath) || !fs.existsSync(payConfig.platformPublicKeyPath)) {
    throw new AppError(503, '微信支付平台公钥未配置，无法校验回调签名', 'WECHAT_PAY_PLATFORM_KEY_NOT_CONFIGURED');
  }

  const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
  const publicKey = fs.readFileSync(payConfig.platformPublicKeyPath, 'utf8');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(message), publicKey, Buffer.from(signature, 'base64'));
  if (!ok) {
    throw new AppError(401, '微信支付回调签名校验失败', 'WECHAT_PAY_SIGNATURE_INVALID');
  }
  logger.info('商家转账回调签名校验通过: serial=%s, timestamp=%s', serial, timestamp);
}

function getHeader(headers: Record<string, any> | undefined, name: string) {
  if (!headers) return '';
  const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key]) : '';
}
