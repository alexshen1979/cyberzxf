import { Context, Next } from 'koa';
import { AppError } from './errorHandler';

// In-memory rate limiter (replace with Redis in production)
const windowMap = new Map<string, { count: number; resetAt: number }>();

const LIMITS: Record<string, { windowMs: number; max: number }> = {
  '/api/v1/ai/consult':    { windowMs: 60_000, max: 5 },    // AI咨询: 5次/分钟
  '/api/v1/orders/charge': { windowMs: 60_000, max: 3 },    // 充值: 3次/分钟
  default:                  { windowMs: 60_000, max: 60 },   // 默认: 60次/分钟
};

export async function rateLimiter(ctx: Context, next: Next) {
  const ip = ctx.ip;
  const path = ctx.path;

  // Find matching limit rule
  const limitConfig = LIMITS[path] || LIMITS.default;
  const key = `${ip}:${path}`;

  const now = Date.now();
  let entry = windowMap.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + limitConfig.windowMs };
    windowMap.set(key, entry);
  }

  entry.count++;

  ctx.set('X-RateLimit-Limit', String(limitConfig.max));
  ctx.set('X-RateLimit-Remaining', String(Math.max(0, limitConfig.max - entry.count)));

  if (entry.count > limitConfig.max) {
    throw new AppError(429, '请求过于频繁，请稍后再试', 'RATE_LIMITED');
  }

  await next();
}

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windowMap) {
    if (now > entry.resetAt) windowMap.delete(key);
  }
}, 60_000);
