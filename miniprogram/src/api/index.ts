const BASE_URL = 'https://api.cyberzhang.com/api/v1';

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: any;
  showLoading?: boolean;
}

export async function request<T = any>(options: RequestOptions): Promise<{ success: boolean; data: T; message?: string }> {
  const { url, method = 'GET', data, header = {}, showLoading = false } = options;

  if (showLoading) {
    uni.showLoading({ title: '加载中...', mask: true });
  }

  try {
    const token = uni.getStorageSync('token');

    const res = await uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...header,
      },
    });

    if (res.statusCode === 401) {
      uni.removeStorageSync('token');
      uni.reLaunch({ url: '/pages/index/index' });
      throw new Error('登录已过期');
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
    miniLogin: (code: string) =>
      request<{ token: string; user: any }>({ url: '/auth/miniprogram-login', method: 'POST', data: { code } }),
    getProfile: () =>
      request<{ id: string; nickname: string; avatar: string }>({ url: '/auth/profile' }),
    updateProfile: (data: any) =>
      request({ url: '/auth/profile', method: 'PUT', data }),
  },

  // AI 咨询
  ai: {
    consult: (data: { question: string; channel?: string; type?: string; sessionId?: string; context?: string }) =>
      request<{ answer: string; pointsCost: number; model: string; sessionId: string }>({ url: '/ai/consult', method: 'POST', data }),
    getHistory: (page = 1, pageSize = 20) =>
      request({ url: `/ai/history?page=${page}&pageSize=${pageSize}` }),
    getQuickQuestions: () =>
      request({ url: '/ai/quick-questions' }),
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
      request<Array<{ id: string; name: string; price: number; points: number; bonus: number }>>({ url: '/payments/products' }),
    createOrder: (productId: string) =>
      request<{ orderNo: string; amount: number; productName: string }>({ url: '/payments/order', method: 'POST', data: { productId } }),
    getOrders: (page = 1, pageSize = 20) =>
      request({ url: `/payments/orders?page=${page}&pageSize=${pageSize}` }),
  },

  // 文章
  articles: {
    list: (page = 1, pageSize = 20, category?: string) => {
      let url = `/articles?page=${page}&pageSize=${pageSize}`;
      if (category) url += `&category=${category}`;
      return request(url);
    },
    detail: (id: string) =>
      request({ url: `/articles/${id}` }),
  },

  // 公告
  notices: {
    list: () =>
      request({ url: '/notices' }),
  },
};
