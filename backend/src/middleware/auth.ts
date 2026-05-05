import { Context, Next } from 'koa';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from './errorHandler';

export interface JwtPayload {
  userId: string;
  role?: string;
}

// 验证 JWT Token（用户端 + 管理端通用）
export async function auth(ctx: Context, next: Next) {
  const token = extractToken(ctx);

  if (!token) {
    throw new AppError(401, '请先登录', 'UNAUTHORIZED');
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch {
    throw new AppError(401, '登录已过期，请重新登录', 'TOKEN_EXPIRED');
  }

  ctx.state.user = payload;
  await next();
}

// 仅管理端鉴权
export async function adminAuth(ctx: Context, next: Next) {
  const token = extractToken(ctx);

  if (!token) {
    throw new AppError(401, '请先登录', 'UNAUTHORIZED');
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch {
    throw new AppError(401, '登录已过期，请重新登录', 'TOKEN_EXPIRED');
  }

  if (!payload.role || !['admin', 'super_admin'].includes(payload.role)) {
    throw new AppError(403, '无管理员权限', 'FORBIDDEN');
  }

  ctx.state.user = payload;
  await next();
}

// 可选鉴权（不强制要求登录，但若提供了 token 则解析）
export async function optionalAuth(ctx: Context, next: Next) {
  const token = extractToken(ctx);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      ctx.state.user = payload;
    } catch {
      // Ignore invalid tokens
    }
  }
  await next();
}

function extractToken(ctx: Context): string | null {
  const header = ctx.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

// 签发 Token
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as string,
  } as jwt.SignOptions);
}
