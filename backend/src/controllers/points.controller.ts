import { Context } from 'koa';
import { getBalance as svcGetBalance, getTransactions as svcGetTransactions } from '../services/points.service';

export async function getBalance(ctx: Context) {
  const userId = ctx.state.user.userId;
  const balance = await svcGetBalance(userId);
  ctx.body = { success: true, data: balance };
}

export async function getTransactions(ctx: Context) {
  const userId = ctx.state.user.userId;
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);

  const result = await svcGetTransactions(userId, page, pageSize);
  ctx.body = { success: true, data: result };
}
