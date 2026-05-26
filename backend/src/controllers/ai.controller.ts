import { Context } from 'koa';
import {
  consult as aiConsult,
  streamConsult as aiStreamConsult,
  localFallbackConsult,
  sanitizeAiOutput,
  getUserHistory,
  getSessionHistory,
} from '../services/ai.service';
import { prisma } from '../utils/prisma';
import { createLogger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

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
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  ctx.status = 200;
  ctx.respond = false;
  const { res } = ctx;
  res.statusCode = 200;

  let fullAnswer = '';
  let actualModel = '';
  let actualCost = 0;
  const startedAt = Date.now();
  let firstTokenAt = 0;

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
    actualModel = result.model;
    actualCost = result.pointsCost;

    let streamBuffer = '';
    const consumeUpstreamChunk = (chunk: string, flush = false) => {
      streamBuffer += chunk;
      const lines = streamBuffer.split('\n');
      streamBuffer = flush ? '' : (lines.pop() || '');

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (line.startsWith('data:')) {
          const jsonStr = line.slice(5).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullAnswer += delta;
              if (!firstTokenAt) firstTokenAt = Date.now();
              res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
            }
          } catch {
            // 非 JSON 行跳过
          }
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      consumeUpstreamChunk(chunk);
    }
    consumeUpstreamChunk(decoder.decode(), true);

    fullAnswer = sanitizeAiOutput(fullAnswer);

    // 保存咨询记录
    if (!isAnonymous) {
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
    }

    // 发送完成信号
    res.write(`data: ${JSON.stringify({
      done: true,
      pointsCost: actualCost,
      model: actualModel,
      sessionId: result.sessionId,
    })}\n\n`);
    logger.info(
      '流式AI咨询完成: userId=%s provider=%s model=%s firstTokenMs=%d totalMs=%d chars=%d',
      userId,
      result.providerName,
      actualModel,
      firstTokenAt ? firstTokenAt - startedAt : -1,
      Date.now() - startedAt,
      fullAnswer.length,
    );
    res.end();

  } catch (err: any) {
    logger.error('流式响应错误: %s', err.message);
    try {
      if (err instanceof AppError && !['AI_API_ERROR', 'AI_NO_STREAM'].includes(err.code)) {
        throw err;
      }
      const fallback = await localFallbackConsult({
        userId,
        question,
        channel: channel || 'miniprogram',
        type: type || 'normal',
        sessionId,
        context,
        isAnonymous,
      });
      for (const part of chunkText(fallback.answer)) {
        res.write(`data: ${JSON.stringify({ content: part })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({
        done: true,
        pointsCost: fallback.pointsCost,
        model: fallback.model,
        sessionId: fallback.sessionId,
      })}\n\n`);
    } catch (fallbackErr: any) {
      logger.error('流式兜底响应错误: %s', fallbackErr.message);
      res.write(`data: ${JSON.stringify({ error: fallbackErr.message || err.message || 'AI 服务暂时不可用' })}\n\n`);
    }
    res.end();
  }
}

function chunkText(text: string) {
  const chunks: string[] = [];
  const chars = Array.from(text || '');
  for (let i = 0; i < chars.length; i += 24) {
    chunks.push(chars.slice(i, i + 24).join(''));
  }
  return chunks.length ? chunks : [''];
}

export async function getHistory(ctx: Context) {
  const userId = ctx.state.user?.userId;
  if (!userId) {
    ctx.body = { success: true, data: { list: [], total: 0 } };
    return;
  }
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);

  const result = await getUserHistory(userId, page, pageSize);
  ctx.body = { success: true, data: result };
}

export async function getSession(ctx: Context) {
  const userId = ctx.state.user?.userId;
  if (!userId) {
    ctx.body = { success: true, data: [] };
    return;
  }
  const sessionId = ctx.params.sessionId;
  const history = await getSessionHistory(sessionId);
  ctx.body = { success: true, data: history };
}

export async function getQuickQuestions(ctx: Context) {
  const { category } = ctx.query as Record<string, string>;
  const where: any = { enabled: true };
  if (category) where.category = category;
  const questions = await prisma.quickQuestion.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
  });
  ctx.body = { success: true, data: questions };
}

export async function getActiveSkill(ctx: Context) {
  const skill = await prisma.skill.findFirst({
    where: { isDefault: true, status: 'enabled' },
    select: { name: true },
  });
  ctx.body = {
    success: true,
    data: {
      name: skill?.name || '赛博张老师',
    },
  };
}
