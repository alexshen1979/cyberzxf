import axios from 'axios';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { findOrCreateByMpOpenId } from './auth.service';
import { consult } from './ai.service';
import { getBalance } from './points.service';
import { getPointSettings } from './point-config.service';

const logger = createLogger('wechat');

// ─── 接入验证 ───────────────────────────────────────

export function verifySignature(signature: string, timestamp: string, nonce: string): boolean {
  const crypto = require('crypto-js');
  const token = config.wechat.officialAccount.token;
  const arr = [token, timestamp, nonce].sort();
  const str = arr.join('');
  const sha1 = crypto.SHA1(str).toString();
  return sha1 === signature;
}

// ─── 获取 Access Token ──────────────────────────────

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt) {
    return cachedAccessToken.token;
  }

  const { appId, secret } = config.wechat.officialAccount;
  const { data } = await axios.get(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${secret}`
  );

  if (data.errcode) {
    throw new AppError(502, `获取 Access Token 失败: ${data.errmsg}`, 'WECHAT_TOKEN_ERROR');
  }

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000, // 提前5分钟刷新
  };

  return cachedAccessToken.token;
}

// ─── 消息处理 ───────────────────────────────────────

export async function handleMessage(xmlData: any): Promise<string> {
  const parsed = parseXmlMessage(xmlData);
  logger.info('收到公众号消息: %s - %s', parsed.msgType, parsed.fromUser);

  // 查找或创建用户
  const user = await findOrCreateByMpOpenId(parsed.fromUser);
  if (!user) {
    return buildTextReply(parsed, '系统繁忙，请稍后重试。');
  }

  switch (parsed.msgType) {
    case 'text':
      return handleTextMessage(parsed, user.id);
    case 'voice':
      return handleVoiceMessage(parsed, user.id);
    case 'event':
      return handleEvent(parsed, user.id);
    default:
      return buildTextReply(parsed,
        '欢迎关注涨识！\n\n' +
        '🤖 直接发送文字或语音，即可获得高考志愿、考研规划、职业规划 AI 咨询服务。\n\n' +
        '💡 快捷指令：\n' +
        '- 发送「点数」查看余额\n' +
        '- 发送「充值」获取充值入口\n' +
        '- 发送「帮助」查看使用说明'
      );
  }
}

// 文字消息处理
async function handleTextMessage(parsed: any, userId: string): Promise<string> {
  const text = parsed.content?.trim();

  // 快捷指令
  const commandResult = await handleQuickCommand(text, userId, parsed);
  if (commandResult) return commandResult;

  // 检查频次限制
  const todayCount = await getTodayConsultCount(userId);
  if (todayCount >= config.points.dailyConsultLimit) {
    return buildTextReply(parsed, '您今日的咨询次数已达上限，请明天再来哦。');
  }

  // 检查点数余额
  const { balance } = await getBalance(userId);
  if (balance < 5) {
    return buildNewsReply(parsed, [
      {
        title: '您的咨询点数不足',
        description: `当前剩余 ${balance} 点，普通问答需要 5 点。点击进入小程序充值。`,
        picUrl: 'https://cdn.zhangshi.com/recharge-banner.jpg',
        url: '',
      },
    ]);
  }

  // 调用 AI 咨询
  try {
    const result = await consult({
      userId,
      question: text,
      channel: 'mp_public',
      type: 'normal',
    });

    return buildTextReply(parsed,
      `${result.answer}\n\n---\n💰 本次消耗 ${result.pointsCost} 点数 | 🤖 ${result.model}`
    );
  } catch (err: any) {
    logger.error('公众号AI咨询失败: %o', err);
    return buildTextReply(parsed, err.message || 'AI 服务暂时不可用，请稍后重试。');
  }
}

// 语音消息处理
async function handleVoiceMessage(parsed: any, userId: string): Promise<string> {
  const recognition = parsed.recognition; // 微信语音识别结果

  if (!recognition) {
    return buildTextReply(parsed,
      '已收到您的语音消息，正在识别中...\n\n' +
      '💡 微信语音识别需要您在发送语音时选择「转换为文字」，否则我们暂时无法处理纯语音消息哦。'
    );
  }

  // 将识别后的文字作为文本消息处理
  parsed.content = recognition;
  return handleTextMessage(parsed, userId);
}

// 事件处理
async function handleEvent(parsed: any, userId: string): Promise<string> {
  const event = parsed.event;

  switch (event) {
    case 'subscribe': {
      const settings = await getPointSettings();
      return buildTextReply(parsed,
        '🎓 欢迎关注涨识！\n\n' +
        '我是赛博张老师，专注于：\n' +
        '📚 高考志愿填报分析\n' +
        '🎯 考研院校专业推荐\n' +
        '💼 职业规划避坑指南\n' +
        '🔍 大学专业深度解析\n\n' +
        `新用户已自动赠送 ${settings.freeGift} 免费咨询点数，直接发送问题即可开始！`
      );
    }

    case 'unsubscribe':
      logger.info('用户取消关注: %s', userId);
      return '';

    case 'CLICK':
      return handleMenuClick(parsed.eventKey, parsed, userId);

    case 'VIEW':
      return ''; // 跳转类菜单无需回复

    default:
      return '';
  }
}

// 快捷指令
async function handleQuickCommand(
  text: string,
  userId: string,
  parsed: any
): Promise<string | null> {
  const cmd = text.toLowerCase();

  if (cmd === '点数' || cmd === '余额' || cmd === 'points') {
    const { balance } = await getBalance(userId);
    return buildTextReply(parsed,
      `💰 您的咨询点数余额：${balance} 点\n\n` +
      '📌 点数有效期 1 年，不可转让、不可提现。\n' +
      '如需充值请点击下方小程序卡片。'
    );
  }

  if (cmd === '充值' || cmd === 'charge' || cmd === 'recharge') {
    return buildNewsReply(parsed, [
      {
        title: '点击进入充值中心',
        description: '在线充值咨询点数，最低 9.9 元起',
        picUrl: '',
        url: '',
      },
    ]);
  }

  if (cmd === '帮助' || cmd === 'help' || cmd === '？') {
    return buildTextReply(parsed,
      '🤖 涨识使用指南：\n\n' +
      '1️⃣ 直接发送问题，如：\n' +
      '  "理科580分能上什么大学"\n' +
      '  "计算机专业哪些学校好"\n' +
      '  "土木工程还值得学吗"\n\n' +
      '2️⃣ 发送语音消息（需转文字）\n\n' +
      '3️⃣ 快捷指令：\n' +
      '  「点数」- 查询余额\n' +
      '  「充值」- 获取充值入口\n' +
      '  「帮助」- 查看本消息\n\n' +
      '💰 普通问答消耗 5 点，深度择校分析消耗 18 点。'
    );
  }

  // 自动回复规则匹配
  const rules = await prisma.autoReplyRule.findMany({
    where: { status: 'enabled' },
    orderBy: { sortOrder: 'asc' },
  });

  for (const rule of rules) {
    const matched =
      rule.matchMode === 'exact' ? text === rule.keyword :
      rule.matchMode === 'contains' ? text.includes(rule.keyword) :
      false;

    if (matched) {
      return buildTextReply(parsed, rule.replyContent);
    }
  }

  return null;
}

// 菜单点击事件
async function handleMenuClick(eventKey: string, parsed: any, userId: string): Promise<string> {
  // 根据 eventKey 处理不同类型的菜单点击
  if (eventKey === 'CHECK_POINTS') {
    const { balance } = await getBalance(userId);
    return buildTextReply(parsed, `💰 当前咨询点数余额：${balance} 点`);
  }

  if (eventKey === 'QUICK_ASK') {
    const quickQuestions = await prisma.quickQuestion.findMany({
      where: { category: 'general' },
      orderBy: { sortOrder: 'asc' },
      take: 5,
    });
    const tips = quickQuestions.map((q, i) => `${i + 1}. ${q.question}`).join('\n');
    return buildTextReply(parsed,
      `📋 快捷提问（回复序号即可）：\n\n${tips}\n\n或者直接输入您的问题。`
    );
  }

  return buildTextReply(parsed, '功能开发中，敬请期待。');
}

// ─── 同步自定义菜单 ────────────────────────────────

export async function syncMenu() {
  const menus = await prisma.wechatMenu.findMany({ orderBy: { sortOrder: 'asc' } });
  if (menus.length === 0) return;

  const buttonTree = buildMenuTree(menus);
  const accessToken = await getAccessToken();
  const { data } = await axios.post(
    `https://api.weixin.qq.com/cgi-bin/menu/create?access_token=${accessToken}`,
    { button: buttonTree }
  );

  if (data.errcode !== 0) {
    throw new AppError(502, `菜单同步失败: ${data.errmsg}`, 'WECHAT_MENU_ERROR');
  }

  logger.info('公众号菜单同步成功');
}

function buildMenuTree(menus: any[]): any[] {
  const topLevel = menus.filter((m: any) => !m.parentId);

  return topLevel.map((menu: any) => {
    const children = menus.filter((m: any) => m.parentId === menu.id);
    if (children.length > 0) {
      return {
        name: menu.name,
        sub_button: children.map((child: any) => buildButtonItem(child)),
      };
    }
    return buildButtonItem(menu);
  });
}

function buildButtonItem(menu: any) {
  switch (menu.type) {
    case 'click':
      return { type: 'click', name: menu.name, key: menu.key };
    case 'view':
      return { type: 'view', name: menu.name, url: menu.url };
    case 'miniprogram':
      return {
        type: 'miniprogram',
        name: menu.name,
        url: menu.url,
        appid: menu.appId,
        pagepath: menu.pagePath,
      };
    default:
      return { type: 'click', name: menu.name, key: menu.key || menu.id };
  }
}

// ─── 辅助方法 ───────────────────────────────────────

function parseXmlMessage(xml: any) {
  const msg = xml.xml || xml;
  return {
    fromUser: msg.FromUserName?.[0] || msg.FromUserName,
    toUser: msg.ToUserName?.[0] || msg.ToUserName,
    msgType: msg.MsgType?.[0] || msg.MsgType,
    content: msg.Content?.[0] || msg.Content,
    recognition: msg.Recognition?.[0] || msg.Recognition, // 语音识别结果
    event: msg.Event?.[0] || msg.Event,
    eventKey: msg.EventKey?.[0] || msg.EventKey,
    msgId: msg.MsgId?.[0] || msg.MsgId,
  };
}

function buildTextReply(parsed: any, content: string): string {
  return `<xml>
<ToUserName><![CDATA[${parsed.fromUser}]]></ToUserName>
<FromUserName><![CDATA[${parsed.toUser}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;
}

function buildNewsReply(parsed: any, articles: Array<{title: string; description: string; picUrl: string; url: string}>): string {
  const items = articles.map(a =>
    `<item>
<Title><![CDATA[${a.title}]]></Title>
<Description><![CDATA[${a.description}]]></Description>
<PicUrl><![CDATA[${a.picUrl}]]></PicUrl>
<Url><![CDATA[${a.url}]]></Url>
</item>`
  ).join('');

  return `<xml>
<ToUserName><![CDATA[${parsed.fromUser}]]></ToUserName>
<FromUserName><![CDATA[${parsed.toUser}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[news]]></MsgType>
<ArticleCount>${articles.length}</ArticleCount>
<Articles>${items}</Articles>
</xml>`;
}

function getTodayConsultCount(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prisma.consultationRecord.count({
    where: {
      userId,
      createdAt: { gte: today },
    },
  });
}
