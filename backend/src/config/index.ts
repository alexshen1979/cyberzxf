import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    isDev: (process.env.NODE_ENV || 'development') === 'development',
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  wechat: {
    miniProgram: {
      appId: process.env.WECHAT_MINI_APPID!,
      secret: process.env.WECHAT_MINI_SECRET!,
    },
    officialAccount: {
      appId: process.env.WECHAT_MP_APPID!,
      secret: process.env.WECHAT_MP_SECRET!,
      token: process.env.WECHAT_MP_TOKEN!,
      aesKey: process.env.WECHAT_MP_AES_KEY,
    },
    pay: {
      mchId: process.env.WECHAT_PAY_MCHID!,
      apiKey: process.env.WECHAT_PAY_API_KEY!,
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      privateKeyPath: process.env.WECHAT_PAY_PRIVATE_KEY_PATH!,
    },
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY!,
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  },
  oss: {
    endpoint: process.env.OSS_ENDPOINT,
    bucket: process.env.OSS_BUCKET,
    accessKey: process.env.OSS_ACCESS_KEY,
    accessSecret: process.env.OSS_ACCESS_SECRET,
  },
  points: {
    freeGift: 10,                          // 新用户免费赠送点数
    defaultCost: 5,                        // 普通问答消耗
    deepAnalysisCost: 18,                  // 深度分析消耗
    expireDays: 365,                       // 点数有效期（天）
    dailyConsultLimit: 50,                 // 单用户每日咨询上限
  },
};

// Validate required configs on startup
export function validateConfig(): void {
  const required: Record<string, string | undefined> = {
    DATABASE_URL: config.database.url,
    JWT_SECRET: process.env.JWT_SECRET,
    DEEPSEEK_API_KEY: config.deepseek.apiKey,
  };
  const missing = Object.entries(required)
    .filter(([_, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    console.error(`❌ 缺少必要环境变量: ${missing.join(', ')}`);
    if (!config.server.isDev) {
      process.exit(1);
    }
  }
}

validateConfig();
