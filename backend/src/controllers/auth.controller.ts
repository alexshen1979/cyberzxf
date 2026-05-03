import { Context } from 'koa';
import * as authService from '../services/auth.service';
import { prisma } from '../utils/prisma';

export async function miniProgramLogin(ctx: Context) {
  const { code } = ctx.request.body as any;
  if (!code) {
    ctx.status = 422;
    ctx.body = { success: false, message: '缺少登录凭证 code' };
    return;
  }

  const result = await authService.loginByMiniProgram(code);
  ctx.body = { success: true, data: result };
}

export async function mpOAuthLogin(ctx: Context) {
  const { code } = ctx.request.body as any;
  if (!code) {
    ctx.status = 422;
    ctx.body = { success: false, message: '缺少授权 code' };
    return;
  }

  const result = await authService.loginByMiniProgram(code);
  ctx.body = { success: true, data: result };
}

export async function getProfile(ctx: Context) {
  const userId = ctx.state.user.userId;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nickname: true,
      avatar: true,
      phone: true,
      createdAt: true,
    },
  });

  ctx.body = { success: true, data: user };
}

export async function updateProfile(ctx: Context) {
  const userId = ctx.state.user.userId;
  const { nickname, avatar, phone } = ctx.request.body as any;

  const user = await prisma.user.update({
    where: { id: userId },
    data: { nickname, avatar, phone },
    select: { id: true, nickname: true, avatar: true, phone: true },
  });

  ctx.body = { success: true, data: user };
}
