import { Context } from 'koa';
import { parseStringPromise } from 'xml2js';
import { verifySignature, handleMessage } from '../services/wechat.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('wechat-ctrl');

// 微信服务器验证（GET 请求）
export async function verifyServer(ctx: Context) {
  const { signature, timestamp, nonce, echostr } = ctx.query;

  if (verifySignature(signature as string, timestamp as string, nonce as string)) {
    ctx.body = echostr;
  } else {
    ctx.status = 403;
    ctx.body = '签名验证失败';
  }
}

// 接收微信消息（POST 请求）
export async function receiveMessage(ctx: Context) {
  try {
    const xmlBody = (ctx.request as any).rawBody || ctx.request.body?.xml || ctx.request.body;

    // Parse XML to JSON
    const xmlData = typeof xmlBody === 'string'
      ? await parseStringPromise(xmlBody)
      : xmlBody;

    // Handle the message
    const replyXml = await handleMessage(xmlData);

    ctx.type = 'application/xml';
    ctx.body = replyXml;
  } catch (err) {
    logger.error('微信消息处理异常: %o', err);
    ctx.status = 200;
    ctx.body = 'success'; // 微信要求返回 success，否则会重试
  }
}
