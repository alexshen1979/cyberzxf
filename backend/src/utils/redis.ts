import Redis from 'ioredis';
import { config } from '../config';
import { createLogger } from './logger';

const logger = createLogger('redis');

const KEY_PREFIX = 'cz:';

let client: Redis | null = null;
let unavailable = false;

export function getRedis(): Redis | null {
  if (unavailable) return null;
  if (client) return client;

  if (!config.redis.url || config.redis.url === 'redis://localhost:6379') {
    // Redis 未配置，使用内存 fallback
    return null;
  }

  try {
    client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          unavailable = true;
          logger.warn('Redis 连接失败，已切换到内存模式');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    client.on('error', (err) => {
      if (!unavailable) {
        logger.warn('Redis 连接错误: %s', err.message);
      }
    });

    client.on('connect', () => {
      logger.info('Redis 已连接');
    });

    return client;
  } catch {
    unavailable = true;
    return null;
  }
}

function k(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

export async function redisGet(key: string): Promise<string | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    return await r.get(k(key));
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  try {
    if (ttlSeconds) {
      await r.setex(k(key), ttlSeconds, value);
    } else {
      await r.set(k(key), value);
    }
    return true;
  } catch {
    return false;
  }
}

export async function redisDel(key: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  try {
    await r.del(k(key));
    return true;
  } catch {
    return false;
  }
}

export async function redisIncr(key: string, ttlSeconds?: number): Promise<number | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const val = await r.incr(k(key));
    if (ttlSeconds && val === 1) {
      await r.expire(k(key), ttlSeconds);
    }
    return val;
  } catch {
    return null;
  }
}

export async function redisKeys(pattern: string): Promise<string[]> {
  const r = getRedis();
  if (!r) return [];
  try {
    const keys = await r.keys(k(pattern));
    return keys.map(key => key.slice(KEY_PREFIX.length));
  } catch {
    return [];
  }
}
