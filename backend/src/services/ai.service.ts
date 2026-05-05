import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { deductPoints } from './points.service';
import { AppError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { redisGet, redisSet } from '../utils/redis';

const logger = createLogger('ai');

// AI 响应缓存 TTL（秒）
const CACHE_TTL_NORMAL = 30 * 60;  // 普通问答 30 分钟
const CACHE_TTL_DEEP = 60 * 60;    // 深度分析 60 分钟

interface ConsultParams {
  userId: string;
  question: string;
  channel: 'miniprogram' | 'mp_public';
  type?: 'normal' | 'deep';
  sessionId?: string;
  context?: string; // 用户填写的个人资料/背景
  isAnonymous?: boolean; // 未登录用户跳过扣点
}

interface ConsultResult {
  answer: string;
  pointsCost: number;
  model: string;
  sessionId: string;
}

interface StreamConsultResult {
  stream: ReadableStream;
  pointsCost: number;
  model: string;
  sessionId: string;
}

// 读取后台 AI 配置
async function getAiConfig() {
  let aiConfig = await prisma.aiConfig.findFirst();
  if (!aiConfig) {
    // 使用默认配置
    aiConfig = await prisma.aiConfig.create({
      data: {
        model: 'deepseek-chat',
        temperature: 0.7,
        maxTokens: 2000,
        topP: 0.9,
        contextWindow: 10,
        skillEnabled: true,
        skillWeight: 0.6,
        pointsPerQuery: config.points.defaultCost,
        pointsPerDeep: config.points.deepAnalysisCost,
      },
    });
  }
  return aiConfig;
}

// 解析 API 凭证：DB 配置优先，留空时回退环境变量
function resolveApiCredentials(aiConfig: any) {
  return {
    apiKey: (aiConfig.apiKey && aiConfig.apiKey.trim())
      ? aiConfig.apiKey
      : config.deepseek.apiKey,
    baseUrl: (aiConfig.apiBaseUrl && aiConfig.apiBaseUrl.trim())
      ? aiConfig.apiBaseUrl
      : config.deepseek.baseUrl,
    timeout: aiConfig.timeout || 30000,
  };
}

// 加载默认 Skill
async function getDefaultSkill(): Promise<any | null> {
  return prisma.skill.findFirst({
    where: { isDefault: true, status: 'enabled' },
  });
}

// 加载 Skill 知识库（检索相关知识点）
async function retrieveKnowledge(question: string, aiConfig: any, skillKeywords?: string[]): Promise<string> {
  if (!aiConfig.skillEnabled) return '';

  try {
    // TODO: 对接 ChromaDB / 向量数据库进行语义检索
    const keywords = skillKeywords?.length ? skillKeywords : extractKeywords(question);

    // 从知识库检索（结构化参考资料，优先）
    const knowledgeEntries = await prisma.knowledgeEntry.findMany({
      where: {
        status: 'published',
        OR: keywords.map(kw => ({
          OR: [
            { title: { contains: kw } },
            { content: { contains: kw } },
            { tags: { contains: kw } },
          ],
        })),
      },
      take: 5,
      orderBy: { viewCount: 'desc' },
    });

    // 从干货文库检索（补充）
    const articles = await prisma.article.findMany({
      where: {
        status: 'published',
        OR: keywords.map(kw => ({
          OR: [
            { title: { contains: kw } },
            { content: { contains: kw } },
          ],
        })),
      },
      take: 2,
      orderBy: { viewCount: 'desc' },
    });

    if (knowledgeEntries.length === 0 && articles.length === 0) return '';

    let block = '';
    if (knowledgeEntries.length > 0) {
      block += `\n【参考知识库】\n${knowledgeEntries.map(e =>
        `- [${e.category}] ${e.title}: ${e.content.slice(0, 300)}`
      ).join('\n')}`;
    }
    if (articles.length > 0) {
      block += `\n【相关文章】\n${articles.map(a =>
        `- ${a.title}: ${a.content.slice(0, 200)}`
      ).join('\n')}`;
    }
    return block;
  } catch (err) {
    logger.error('知识库检索失败: %s', (err as Error)?.message || String(err));
    return '';
  }
}

// 提取问题关键词
function extractKeywords(question: string): string[] {
  const keywordList = [
    '高考', '志愿', '分数线', '大学', '专业', '211', '985', '双一流',
    '考研', '复试', '调剂', '学硕', '专硕', '院校', '导师',
    '计算机', '金融', '医学', '法学', '土木', '机械', '电气',
    '文科', '理科', '工科', '就业', '考公', '考编', '避坑',
  ];

  return keywordList.filter(kw => question.includes(kw));
}

// 构建 System Prompt（张雪峰风格）
function buildSystemPrompt(knowledge: string, context?: string): string {
  const base = `你叫赛博张老师，是一个高考志愿填报、考研规划、职业规划的 AI 咨询专家。
你的回答风格应该像张雪峰老师一样：犀利、幽默、接地气、一针见血，习惯用反问和大白话讲清楚复杂的升学问题。

核心原则：
1. 用最直白的话说清楚利弊，不要官方套话
2. 该劝退就劝退，该推荐就推荐，态度鲜明
3. 用具体案例和数据说话，少讲空道理
4. 回答结尾必须加上："📌 温馨提醒：本回答内容由AI生成，仅作参考，不构成升学决策唯一依据。建议结合实际情况，多方查证后做决定。"

${context ? `用户提供的背景信息：${context}` : ''}
${knowledge ? `以下为相关参考知识，请结合回答：${knowledge}` : ''}`;

  return base;
}

// 将 Skill 的 systemPrompt 与 knowledge/context 拼接
function buildSkillPrompt(systemPrompt: string, knowledge: string, context?: string): string {
  let prompt = systemPrompt;
  if (context) prompt += `\n\n用户提供的背景信息：${context}`;
  if (knowledge) prompt += `\n\n以下为相关参考知识，请结合回答：${knowledge}`;
  return prompt;
}

// 生成缓存 key（基于问题内容和类型的哈希）
function cacheKey(question: string, type: string, context?: string): string {
  const normalized = question.trim().toLowerCase();
  const hash = crypto.createHash('md5').update(`${normalized}|${type}|${context || ''}`).digest('hex').slice(0, 16);
  return `ai:cache:${hash}`;
}

// 判断是否适合缓存（含个人具体分数/排名的个性化问题不适合缓存）
function isCacheable(question: string, context?: string): boolean {
  const combined = `${question} ${context || ''}`;
  // 包含具体分数、排名、个人标识的不缓存
  const personalPatterns = [/\d{3}分/, /\d+名/, /省排名/, /一模/, /二模/, /我的/];
  return !personalPatterns.some(p => p.test(combined));
}

// 核心咨询接口
export async function consult(params: ConsultParams): Promise<ConsultResult> {
  const { userId, question, channel, type = 'normal', context: userContext, isAnonymous } = params;
  const sessionId = params.sessionId || `${userId}_${Date.now()}`;

  // 1. 获取 AI 配置
  const aiConfig = await getAiConfig();

  // 2. 解析 API 凭证（DB 优先，留空回退 env）
  const creds = resolveApiCredentials(aiConfig);

  // 3. 确定扣点数（未登录用户免费）
  const pointsCost = isAnonymous ? 0 : (type === 'deep' ? aiConfig.pointsPerDeep : aiConfig.pointsPerQuery);

  // 4. 扣减点数（未登录用户跳过）
  if (!isAnonymous) {
    await deductPoints(userId, pointsCost, {
      source: 'consultation',
      sourceId: sessionId,
      remark: `${type === 'deep' ? '深度分析' : '普通问答'} - "${question.slice(0, 30)}..."`,
    });
  }

  try {
    // 5. 加载默认 Skill
    const skill = await getDefaultSkill();

    // 6. 解析 Skill 参数：skill 有值则覆盖 AiConfig
    const modelName = skill?.model || (aiConfig.model === 'deepseek-flash' ? 'deepseek-flash' : 'deepseek-chat');
    const temperature = skill?.temperature ?? aiConfig.temperature;
    const maxTokens = skill?.maxTokens ?? aiConfig.maxTokens;
    const topP = skill?.topP ?? aiConfig.topP;

    // 7. 解析 Skill 关键词
    let skillKeywords: string[] | undefined;
    if (skill?.keywords) {
      try { skillKeywords = JSON.parse(skill.keywords); } catch { /* ignore */ }
    }

    // 8. 检查缓存
    const cacheable = isCacheable(question, userContext);
    const ck = cacheKey(question, type, userContext);

    if (cacheable) {
      const cached = await redisGet(ck);
      if (cached) {
        logger.info('AI缓存命中: %s', ck);
        await prisma.consultationRecord.create({
          data: {
            userId, sessionId, question, answer: cached,
            model: `${modelName} (cached)`, pointsCost, channel, type,
          },
        });
        return { answer: cached, pointsCost, model: modelName, sessionId };
      }
    }

    // 9. 检索知识库
    const knowledge = await retrieveKnowledge(question, aiConfig, skillKeywords);

    // 10. 构建 System Prompt：优先用 Skill，fallback 硬编码
    const systemPrompt = skill?.systemPrompt
      ? buildSkillPrompt(skill.systemPrompt, knowledge, userContext)
      : buildSystemPrompt(knowledge, userContext);

    // 11. 调用 DeepSeek 模型
    const response = await axios.post(
      `${creds.baseUrl}/v1/chat/completions`,
      {
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
      },
      {
        headers: {
          'Authorization': `Bearer ${creds.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: creds.timeout,
      }
    );

    const answer = response.data.choices[0]?.message?.content || '抱歉，暂时无法回答您的问题，请稍后重试。';

    // 12. 写入缓存
    if (cacheable) {
      const ttl = type === 'deep' ? CACHE_TTL_DEEP : CACHE_TTL_NORMAL;
      redisSet(ck, answer, ttl);
    }

    // 13. 保存咨询记录（匿名用户跳过，因为没有真实 userId）
    if (!isAnonymous) {
      await prisma.consultationRecord.create({
        data: {
          userId, sessionId, question, answer,
          model: modelName, pointsCost, channel, type,
        },
      });
    }

    logger.info('AI咨询完成: userId=%s, model=%s, cost=%dpts, cached=%s', userId, modelName, pointsCost, 'no');

    return { answer, pointsCost, model: modelName, sessionId };

  } catch (err) {
    if (!isAnonymous) {
      await refundPoints(userId, pointsCost, sessionId);
    }
    if (axios.isAxiosError(err)) {
      const detail = err.response?.data || err.code || err.message;
      logger.error('DeepSeek API 调用失败: %s', String(detail));
      throw new AppError(502, 'AI 服务暂时不可用，请稍后重试', 'AI_SERVICE_UNAVAILABLE');
    }
    throw err;
  }
}

// 退还点数
async function refundPoints(userId: string, amount: number, sessionId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.pointsAccount.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });

    const account = await tx.pointsAccount.findUnique({ where: { userId } });

    await tx.pointsTransaction.create({
      data: {
        userId,
        type: 'refund',
        amount,
        balanceAfter: account!.balance,
        source: 'system',
        sourceId: sessionId,
        remark: 'AI服务故障，退还点数',
      },
    });
  });
}

// 流式咨询接口（返回 ReadableStream 供 SSE 管道转发）
export async function streamConsult(params: ConsultParams): Promise<StreamConsultResult> {
  const { userId, question, channel, type = 'normal', context: userContext, isAnonymous } = params;
  const sessionId = params.sessionId || `${userId}_${Date.now()}`;

  // 1. 获取 AI 配置
  const aiConfig = await getAiConfig();
  const creds = resolveApiCredentials(aiConfig);

  // 2. 确定扣点数（未登录用户免费）
  const pointsCost = isAnonymous ? 0 : (type === 'deep' ? aiConfig.pointsPerDeep : aiConfig.pointsPerQuery);

  // 3. 扣减点数（未登录用户跳过）
  if (!isAnonymous) {
    await deductPoints(userId, pointsCost, {
      source: 'consultation',
      sourceId: sessionId,
      remark: `${type === 'deep' ? '深度分析' : '普通问答'} - "${question.slice(0, 30)}..."`,
    });
  }

  try {
    // 4. 加载默认 Skill
    const skill = await getDefaultSkill();

    // 5. 解析模型参数
    const modelName = skill?.model || (aiConfig.model === 'deepseek-flash' ? 'deepseek-flash' : 'deepseek-chat');
    const temperature = skill?.temperature ?? aiConfig.temperature;
    const maxTokens = skill?.maxTokens ?? aiConfig.maxTokens;
    const topP = skill?.topP ?? aiConfig.topP;

    // 6. 检索知识库
    let skillKeywords: string[] | undefined;
    if (skill?.keywords) {
      try { skillKeywords = JSON.parse(skill.keywords); } catch { /* ignore */ }
    }
    const knowledge = await retrieveKnowledge(question, aiConfig, skillKeywords);

    // 7. 构建 System Prompt
    const systemPrompt = skill?.systemPrompt
      ? buildSkillPrompt(skill.systemPrompt, knowledge, userContext)
      : buildSystemPrompt(knowledge, userContext);

    // 8. 调用 DeepSeek API（stream 模式）
    const response = await fetch(`${creds.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        stream: true,
      }),
      signal: AbortSignal.timeout(creds.timeout),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new AppError(502, `DeepSeek API error ${response.status}: ${errText}`, 'AI_API_ERROR');
    }

    if (!response.body) {
      throw new AppError(502, 'DeepSeek API 未返回流式响应', 'AI_NO_STREAM');
    }

    return {
      stream: response.body,
      pointsCost,
      model: modelName,
      sessionId,
    };
  } catch (err) {
    if (!isAnonymous) {
      await refundPoints(userId, pointsCost, sessionId);
    }
    throw err;
  }
}

// 获取会话历史（多轮对话上下文）
export async function getSessionHistory(sessionId: string, limit = 10) {
  return prisma.consultationRecord.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { question: true, answer: true },
  });
}

// 获取用户咨询历史
export async function getUserHistory(userId: string, page = 1, pageSize = 20) {
  const [list, total] = await Promise.all([
    prisma.consultationRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        sessionId: true,
        question: true,
        answer: true,
        pointsCost: true,
        channel: true,
        type: true,
        createdAt: true,
      },
    }),
    prisma.consultationRecord.count({ where: { userId } }),
  ]);

  return { list, total, page, pageSize };
}
