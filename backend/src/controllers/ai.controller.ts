import { Context } from 'koa';
import { consult as aiConsult, getUserHistory, getSessionHistory } from '../services/ai.service';
import { prisma } from '../utils/prisma';

export async function consult(ctx: Context) {
  const userId = ctx.state.user.userId;
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
  });

  ctx.body = { success: true, data: result };
}

// SSE 流式响应（预留接口）
export async function streamConsult(ctx: Context) {
  const userId = ctx.state.user.userId;
  const { question, channel, type } = ctx.request.body as Record<string, any>;

  if (!question) {
    ctx.status = 422;
    ctx.body = { success: false, message: '请输入咨询问题' };
    return;
  }

  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const result = await aiConsult({
    userId,
    question,
    channel: channel || 'miniprogram',
    type: type || 'normal',
  });

  ctx.body = `data: ${JSON.stringify(result)}\n\n`;
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
