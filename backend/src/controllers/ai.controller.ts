import { Context } from 'koa';
import {
  consult as aiConsult,
  streamConsult as aiStreamConsult,
  getUserHistory,
  getSessionHistory,
} from '../services/ai.service';
import { prisma } from '../utils/prisma';
import { createLogger } from '../utils/logger';

const logger = createLogger('ai-ctrl');

export async function consult(ctx: Context) {
  const userId = ctx.state.user?.userId || `anon_${Date.now()}`;
  const isAnonymous = !ctx.state.user?.userId;
  const { question, channel, type, sessionId, context } = ctx.request.body as Record<string, any>;

  if (!question) {
    ctx.status = 422;
    ctx.body = { success: false, message: '请输入咨询问题' };
    return;
  }

  const result = await aiConsult({
    userId,
    question,
    channel: channel || 'miniprogram',
    type: type || 'normal',
    sessionId,
    context,
    isAnonymous,
  });

  ctx.body = { success: true, data: result };
}

// SSE 流式响应
export async function streamConsult(ctx: Context) {
  const userId = ctx.state.user?.userId || `anon_${Date.now()}`;
  const isAnonymous = !ctx.state.user?.userId;
  const { question, channel, type, sessionId, context } = ctx.request.body as Record<string, any>;

  if (!question) {
    ctx.status = 422;
    ctx.body = { success: false, message: '请输入咨询问题' };
    return;
  }

  // 设置 SSE 响应头
  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  ctx.respond = false;
  const { res } = ctx;

  let fullAnswer = '';
  let actualModel = '';
  let actualCost = 0;

  try {
    const result = await aiStreamConsult({
      userId,
      question,
      channel: channel || 'miniprogram',
      type: type || 'normal',
      sessionId,
      context,
      isAnonymous,
    });

    // 读取流，逐块转发给客户端
    const reader = result.stream.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      // DeepSeek 返回的是 SSE 格式 "data: {...}\n\n"
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullAnswer += delta;
              // 转发增量内容给客户端
              res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
            }
          } catch {
            // 非 JSON 行跳过
          }
        }
      }
    }

    actualModel = result.model;
    actualCost = result.pointsCost;

    // 保存咨询记录
    await prisma.consultationRecord.create({
      data: {
        userId,
        sessionId: result.sessionId,
        question,
        answer: fullAnswer,
        model: actualModel,
        pointsCost: actualCost,
        channel: channel || 'miniprogram',
        type: type || 'normal',
      },
    });

    // 发送完成信号
    res.write(`data: ${JSON.stringify({
      done: true,
      pointsCost: actualCost,
      model: actualModel,
      sessionId: result.sessionId,
    })}\n\n`);
    res.end();

  } catch (err: any) {
    logger.error('流式响应错误: %s', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message || 'AI 服务暂时不可用' })}\n\n`);
    res.end();
  }
}

export async function getHistory(ctx: Context) {
  const userId = ctx.state.user.userId;
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);

  const result = await getUserHistory(userId, page, pageSize);
  ctx.body = { success: true, data: result };
}

export async function getSession(ctx: Context) {
  const sessionId = ctx.params.sessionId;
  const history = await getSessionHistory(sessionId);
  ctx.body = { success: true, data: history };
}

export async function getQuickQuestions(ctx: Context) {
  const questions = await prisma.quickQuestion.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  ctx.body = { success: true, data: questions };
}
