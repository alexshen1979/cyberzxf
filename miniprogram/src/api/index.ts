// Element Plus 图标名 → emoji 映射（小程序端回退方案）
const ICON_EMOJI_MAP: Record<string, string> = {
  School: '🎓', Reading: '📖', Briefcase: '💼', View: '👁️',
  OfficeBuilding: '🏢', EditPen: '✏️', Sunny: '☀️', Star: '⭐',
  Aim: '🎯', DataLine: '📊', Monitor: '🖥️', Connection: '🔗',
  Trophy: '🏆', TrendCharts: '📈', Notebook: '📋', FolderOpened: '📂',
  Compass: '🧭', Medal: '🏅', Clock: '🕐', MagicStick: '🪄',
};

export function categoryIcon(iconName: string): string {
  return ICON_EMOJI_MAP[iconName] || iconName || '📌';
}

// 开发环境使用本地后端，生产环境使用正式域名
// 可通过 .env 文件中的 VITE_API_BASE_URL 覆盖
export const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: any;
  showLoading?: boolean;
  loadingTitle?: string;
  timeout?: number;
}

export async function request<T = any>(options: RequestOptions): Promise<{ success: boolean; data: T; message?: string }> {
  const { url, method = 'GET', data, header = {}, showLoading = false, timeout = 15000 } = options;

  if (showLoading) {
    uni.showLoading({ title: options.loadingTitle || '加载中...', mask: true });
  }

  try {
    const token = uni.getStorageSync('token');

    const res = await uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      timeout,
      header: Object.assign(
        { 'Content-Type': 'application/json' },
        token ? { Authorization: `Bearer ${token}` } : {},
        header,
      ),
    });

    if (res.statusCode === 401) {
      uni.removeStorageSync('token');
      throw new Error('登录已过期，请重新登录');
    }

    if (res.statusCode >= 400) {
      throw new Error((res.data as any)?.message || '请求失败');
    }

    return res.data as any;
  } finally {
    if (showLoading) {
      uni.hideLoading();
    }
  }
}

// ─── API 方法 ───────────────────────────────────────

export const api = {
  // 认证
  auth: {
    miniLogin: (code: string, userInfo?: any, referralCode?: string) =>
      request<{ token: string; user: any }>({ url: '/auth/miniprogram-login', method: 'POST', data: { code, userInfo, referralCode } }),
    getProfile: () =>
      request<{ id: string; nickname: string; avatar: string; phone: string }>({ url: '/auth/profile' }),
    updateProfile: (data: any) =>
      request({ url: '/auth/profile', method: 'PUT', data }),
  },

  // AI 咨询
  ai: {
    consult: (data: { question: string; channel?: string; type?: string; sessionId?: string; context?: string }) =>
      request<{ answer: string; pointsCost: number; model: string; sessionId: string }>({
        url: '/ai/consult',
        method: 'POST',
        data,
        timeout: data.type === 'deep' ? 90000 : 45000,
      }),
    getHistory: (page = 1, pageSize = 20) =>
      request({ url: `/ai/history?page=${page}&pageSize=${pageSize}` }),
    getSession: (sessionId: string) =>
      request({ url: `/ai/session/${sessionId}` }),
    getQuickQuestions: (category?: string) => {
      let url = '/ai/quick-questions';
      if (category) url += `?category=${encodeURIComponent(category)}`;
      return request({ url });
    },
  },

  // 点数
  points: {
    getBalance: () =>
      request<{ balance: number; frozen: number; total: number; expiredAt: string }>({ url: '/points/balance' }),
    getTransactions: (page = 1, pageSize = 20) =>
      request({ url: `/points/transactions?page=${page}&pageSize=${pageSize}` }),
  },

  // 支付
  payment: {
    getProducts: () =>
      request<Array<{
        id: string;
        name: string;
        price: number;
        originalPrice?: number | null;
        points: number;
        bonus: number;
        description?: string;
        isDefault?: boolean;
        badgeType?: 'hot' | 'best_value' | null;
      }>>({ url: '/payments/products' }),
    createOrder: (productId: string) =>
      request<{
        orderNo: string;
        amount: number;
        productName: string;
        payParams: {
          timeStamp: string;
          nonceStr: string;
          package: string;
          signType: 'RSA';
          paySign: string;
        };
      }>({ url: '/payments/order', method: 'POST', data: { productId } }),
    getOrder: (orderNo: string) =>
      request<{ orderNo: string; status: string; paidAt?: string; transactionId?: string }>({ url: `/payments/orders/${orderNo}` }),
    getOrders: (page = 1, pageSize = 20) =>
      request({ url: `/payments/orders?page=${page}&pageSize=${pageSize}` }),
  },

  // 文章
  articles: {
    list: (page = 1, pageSize = 20, category?: string) => {
      let url = `/articles?page=${page}&pageSize=${pageSize}`;
      if (category) url += `&category=${category}`;
      return request({ url });
    },
    detail: (id: string) =>
      request({ url: `/articles/${id}` }),
  },

  // 公告
  notices: {
    list: () =>
      request({ url: '/notices' }),
  },

  // 公共配置
  config: {
    getPublic: () =>
      request<{
        freeAskLimit: number;
        freeGift: number;
        volunteerAnalysisCost: number;
        volunteerReportPdfCost: number;
        volunteerReportImageCost: number;
      }>({ url: '/public-config' }),
  },

  // 知识库
  knowledge: {
    list: (page = 1, pageSize = 20, category?: string, keyword?: string) => {
      let url = `/knowledge?page=${page}&pageSize=${pageSize}`;
      if (category) url += `&category=${encodeURIComponent(category)}`;
      if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
      return request({ url });
    },
    detail: (id: string) =>
      request({ url: `/knowledge/${id}` }),
    categories: () =>
      request<string[]>({ url: '/knowledge-categories' }),
  },

  // 分类
  categories: {
    list: () =>
      request<Array<{ key: string; label: string; icon: string }>>({ url: '/categories' }),
  },

  // 省市区域
  regions: {
    tree: () =>
      request<Array<{ id: string; name: string; level: string; children?: Array<{ id: string; name: string; level: string }> }>>({ url: '/regions/tree' }),
  },

  // 收藏
  favorites: {
    toggle: (targetType: string, targetId: string) =>
      request({ url: '/favorites/toggle', method: 'POST', data: { targetType, targetId } }),
    check: (targetType: string, targetId: string) =>
      request({ url: `/favorites/check?targetType=${targetType}&targetId=${targetId}` }),
    list: (page = 1, pageSize = 20) =>
      request({ url: `/favorites?page=${page}&pageSize=${pageSize}` }),
    remove: (id: string) =>
      request({ url: `/favorites/${id}`, method: 'DELETE' }),
  },

  // 分销体系
  distribution: {
    me: () =>
      request({ url: '/distribution/me' }),
    apply: () =>
      request({ url: '/distribution/apply', method: 'POST' }),
    qrcode: () =>
      request({ url: '/distribution/qrcode' }),
    commissions: (page = 1, pageSize = 20) =>
      request({ url: `/distribution/commissions?page=${page}&pageSize=${pageSize}` }),
  },

  // AI 高考志愿分析
  volunteer: {
    dataYears: () =>
      request<{
        years: number[];
        defaultYear: number;
        scoreRankYears: Array<{ year: number; count: number }>;
        admissionScoreYears: Array<{ year: number; count: number }>;
      }>({ url: '/volunteer/data-years' }),
    majorSuggestions: (keyword: string) =>
      request<Array<{ id: string; name: string; category?: string | null }>>({ url: `/volunteer/major-suggestions?keyword=${encodeURIComponent(keyword)}` }),
    scoreRank: (data: { province: string; year: number; subjectType: string; score: number }) =>
      request<{
        available: boolean;
        exact: boolean;
        province: string;
        year: number;
        subjectType: string;
        score: number;
        rank: number | null;
        sameScoreCount?: number | null;
        sourceName?: string | null;
        sourceUrl?: string | null;
        sourceType?: string | null;
        message?: string;
      }>({
        url: `/volunteer/score-rank?province=${encodeURIComponent(data.province)}&year=${data.year}&subjectType=${encodeURIComponent(data.subjectType)}&score=${data.score}`,
      }),
    analyze: (data: {
      province: string;
      year?: number;
      subjectType: string;
      score: number;
      rank?: number;
      targetBatch?: string;
      preferredCities?: string[];
      preferredMajors?: string[];
      avoidMajors?: string[];
      familyExpectation?: string;
      riskPreference?: 'conservative' | 'balanced' | 'aggressive';
      recommendationLimit?: number;
    }) =>
      request({ url: '/volunteer/analyze', method: 'POST', data, timeout: 90000 }),
    preview: (data: {
      province: string;
      year?: number;
      subjectType: string;
      score: number;
      rank?: number;
      targetBatch?: string;
      preferredCities?: string[];
      preferredMajors?: string[];
      avoidMajors?: string[];
      familyExpectation?: string;
      riskPreference?: 'conservative' | 'balanced' | 'aggressive';
      recommendationLimit?: number;
    }) =>
      request({ url: '/volunteer/preview', method: 'POST', data }),
    reports: (page = 1, pageSize = 20) =>
      request({ url: `/volunteer/reports?page=${page}&pageSize=${pageSize}` }),
    detail: (id: string) =>
      request({ url: `/volunteer/reports/${id}` }),
    exportCosts: () =>
      request<{ pdf: number; image: number }>({ url: '/volunteer/report-export-costs' }),
    exportUrl: (id: string, type: 'pdf' | 'image' = 'pdf') =>
      `${BASE_URL}/volunteer/reports/${id}/export?type=${type}`,
  },

  // 院校库
  universities: {
    detail: (id: string) =>
      request({ url: `/universities/${id}` }),
  },
};
