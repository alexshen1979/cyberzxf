import { Context, Next } from 'koa';
import { AppError } from './errorHandler';
import { redisIncr, getRedis } from '../utils/redis';

const LIMITS: Record<string, { windowMs: number; max: number }> = {
  '/api/v1/ai/consult':    { windowMs: 60_000, max: 5 },
  '/api/v1/orders/charge': { windowMs: 60_000, max: 3 },
  default:                  { windowMs: 60_000, max: 60 },
};

// ─── 内存 fallback ───────────────────────────────────

const memoryMap = new Map<string, { count: number; resetAt: number }>();
const MAX_MEMORY_ENTRIES = 10000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startMemoryCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryMap) {
      if (now > entry.resetAt) memoryMap.delete(key);
    }
  }, 120_000);
}

startMemoryCleanup();

function memoryRateLimit(ip: string, path: string, windowMs: number, max: number): { allowed: boolean; remaining: number } {
  const key = `${ip}:${path}`;
  const now = Date.now();
  let entry = memoryMap.get(key);

  if (!entry || now > entry.resetAt) {
    if (!entry && memoryMap.size >= MAX_MEMORY_ENTRIES) {
      const oldest = [...memoryMap.entries()]
        .sort((a, b) => a[1].resetAt - b[1].resetAt)
        .slice(0, Math.floor(MAX_MEMORY_ENTRIES * 0.1));
      for (const [k] of oldest) memoryMap.delete(k);
    }
    entry = { count: 0, resetAt: now + windowMs };
    memoryMap.set(key, entry);
  }

  entry.count++;
  const remaining = Math.max(0, max - entry.count);
  return { allowed: entry.count <= max, remaining };
}

// ─── Redis 限流 ───────────────────────────────────────

async function redisRateLimit(ip: string, path: string, windowMs: number, max: number): Promise<{ allowed: boolean; remaining: number } | null> {
  const windowSec = Math.ceil(windowMs / 1000);
  const key = `ratelimit:${path}:${ip}`;
  const count = await redisIncr(key, windowSec);
  if (count === null) return null; // Redis 不可用
  const remaining = Math.max(0, max - count);
  return { allowed: count <= max, remaining };
}

// ─── 中间件 ──────────────────────────────────────────

export async function rateLimiter(ctx: Context, next: Next) {
  const ip = ctx.ip;
  const path = ctx.path;

  const limitConfig = LIMITS[path] || LIMITS.default;
  const { windowMs, max } = limitConfig;

  let result: { allowed: boolean; remaining: number };

  // 优先 Redis
  const redisResult = await redisRateLimit(ip, path, windowMs, max);
  if (redisResult) {
    result = redisResult;
  } else {
    result = memoryRateLimit(ip, path, windowMs, max);
  }

  ctx.set('X-RateLimit-Limit', String(max));
  ctx.set('X-RateLimit-Remaining', String(result.remaining));

  if (!result.allowed) {
    throw new AppError(429, '请求过于频繁，请稍后再试', 'RATE_LIMITED');
  }

  await next();
}
