import axios from 'axios';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { deductPoints } from './points.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('ai');

interface ConsultParams {
  userId: string;
  question: string;
  channel: 'miniprogram' | 'mp_public';
  type?: 'normal' | 'deep';
  sessionId?: string;
  context?: string; // 用户填写的个人资料/背景
}

interface ConsultResult {
  answer: string;
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

// 加载张雪峰 Skill 知识库（检索相关知识点）
async function retrieveKnowledge(question: string, aiConfig: any): Promise<string> {
  if (!aiConfig.skillEnabled) return '';

  try {
    // TODO: 对接 ChromaDB / 向量数据库进行语义检索
    // 当前使用关键词简单匹配作为占位实现
    const keywords = extractKeywords(question);

    // 从干货文库检索相关内容
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
      take: 3,
      orderBy: { viewCount: 'desc' },
    });

    if (articles.length === 0) return '';

    return `\n【参考知识库】\n${articles.map(a => `- ${a.title}: ${a.content.slice(0, 200)}`).join('\n')}`;
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

// 核心咨询接口
export async function consult(params: ConsultParams): Promise<ConsultResult> {
  const { userId, question, channel, type = 'normal', context: userContext } = params;
  const sessionId = params.sessionId || `${userId}_${Date.now()}`;

  // 1. 获取 AI 配置
  const aiConfig = await getAiConfig();

  // 2. 确定扣点数
  const pointsCost = type === 'deep' ? aiConfig.pointsPerDeep : aiConfig.pointsPerQuery;

  // 3. 扣减点数（原子操作，余额不足会抛异常）
  await deductPoints(userId, pointsCost, {
    source: 'consultation',
    sourceId: sessionId,
    remark: `${type === 'deep' ? '深度分析' : '普通问答'} - "${question.slice(0, 30)}..."`,
  });

  try {
    // 4. 检索知识库
    const knowledge = await retrieveKnowledge(question, aiConfig);

    // 5. 构建 Prompt
    const systemPrompt = buildSystemPrompt(knowledge, userContext);

    // 6. 调用 DeepSeek 模型
    const modelName = aiConfig.model === 'deepseek-flash' ? 'deepseek-flash' : 'deepseek-chat';
    const response = await axios.post(
      `${config.deepseek.baseUrl}/v1/chat/completions`,
      {
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        temperature: aiConfig.temperature,
        max_tokens: aiConfig.maxTokens,
        top_p: aiConfig.topP,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.deepseek.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const answer = response.data.choices[0]?.message?.content || '抱歉，暂时无法回答您的问题，请稍后重试。';

    // 7. 保存咨询记录
    await prisma.consultationRecord.create({
      data: {
        userId,
        sessionId,
        question,
        answer,
        model: modelName,
        pointsCost,
        channel,
        type,
      },
    });

    logger.info(`AI咨询完成: userId=${userId}, model=${modelName}, cost=${pointsCost}pts`);

    return { answer, pointsCost, model: modelName, sessionId };

  } catch (err) {
    // AI 调用失败时退还点数
    if (axios.isAxiosError(err) && err.response?.status) {
      await refundPoints(userId, pointsCost, sessionId);
      logger.error('DeepSeek API 调用失败: %o', err.response.data);
      throw new Error('AI 服务暂时不可用，点数已退还，请稍后重试');
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
