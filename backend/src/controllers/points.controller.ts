import { Context } from 'koa';
import { getBalance, getTransactions } from '../services/points.service';

export async function getBalance(ctx: Context) {
  const userId = ctx.state.user.userId;
  const balance = await getBalance(userId);
  ctx.body = { success: true, data: balance };
}

export async function getTransactions(ctx: Context) {
  const userId = ctx.state.user.userId;
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);

  const result = await getTransactions(userId, page, pageSize);
  ctx.body = { success: true, data: result };
}
