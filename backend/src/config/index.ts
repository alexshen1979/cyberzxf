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
      apiV3Key: process.env.WECHAT_PAY_APIV3_KEY || process.env.WECHAT_PAY_API_KEY || '',
      serialNo: process.env.WECHAT_PAY_SERIAL_NO!,
      privateKeyPath: process.env.WECHAT_PAY_PRIVATE_KEY_PATH!,
      platformPublicKeyPath: process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH || '',
      notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || '',
      transferNotifyUrl: process.env.WECHAT_TRANSFER_NOTIFY_URL || '',
    },
    virtualPay: {
      offerId: process.env.WECHAT_VIRTUAL_PAY_OFFER_ID || '',
      appKey: process.env.WECHAT_VIRTUAL_PAY_APP_KEY || '',
      sandboxAppKey: process.env.WECHAT_VIRTUAL_PAY_SANDBOX_APP_KEY || '',
      env: process.env.WECHAT_VIRTUAL_PAY_ENV || '0',
      productMap: process.env.WECHAT_VIRTUAL_PAY_PRODUCT_MAP || '',
      pushToken: process.env.WECHAT_VIRTUAL_PAY_PUSH_TOKEN || '',
    },
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  },
  bailian: {
    apiKey: process.env.BAILIAN_API_KEY || process.env.DASHSCOPE_API_KEY || '',
    baseUrl: process.env.BAILIAN_BASE_URL || process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  oss: {
    endpoint: process.env.OSS_ENDPOINT,
    bucket: process.env.OSS_BUCKET,
    accessKey: process.env.OSS_ACCESS_KEY,
    accessSecret: process.env.OSS_ACCESS_SECRET,
  },
  points: {
    freeGift: 100,                         // 新用户免费赠送点数
    defaultCost: 5,                        // 普通问答消耗
    deepAnalysisCost: 18,                  // 深度分析消耗
    volunteerAnalysisCost: 38,             // 志愿分析消耗
    volunteerReportPdfCost: 3,             // 志愿报告 PDF 导出消耗
    volunteerReportImageCost: 5,           // 志愿报告长图导出消耗
    expireDays: 365,                       // 点数有效期（天）
    dailyConsultLimit: 50,                 // 单用户每日咨询上限
  },
};

// Validate required configs on startup
export function validateConfig(): void {
  const required: Record<string, string | undefined> = {
    DATABASE_URL: config.database.url,
    JWT_SECRET: process.env.JWT_SECRET,
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

  if (!config.deepseek.apiKey) {
    console.warn('⚠️  DEEPSEEK_API_KEY 未设置，请在管理后台 AI 配置中设置或添加环境变量');
  }
  if (!config.bailian.apiKey) {
    console.warn('⚠️  BAILIAN_API_KEY/DASHSCOPE_API_KEY 未设置，如需使用阿里百炼请在管理后台 AI 配置中设置或添加环境变量');
  }
}

validateConfig();
