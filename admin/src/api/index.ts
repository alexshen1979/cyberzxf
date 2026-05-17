import axios from 'axios';

const http = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.hash = '#/login';
    }
    return Promise.reject(err);
  }
);

export const api = {
  admin: {
    login: (username: string, password: string) =>
      http.post('/admin/admins/login', { username, password }),
  },
  dashboard: {
    get: () => http.get('/admin/dashboard'),
  },
  users: {
    list: (params?: any) => http.get('/admin/users', { params }),
    detail: (id: string) => http.get(`/admin/users/${id}`),
    update: (id: string, data: any) => http.put(`/admin/users/${id}`, data),
  },
  points: {
    getUser: (userId: string) => http.get(`/admin/points/${userId}`),
    adjust: (data: any) => http.post('/admin/points/adjust', data),
    settings: () => http.get('/admin/point-settings'),
    updateSettings: (data: any) => http.put('/admin/point-settings', data),
    products: (params?: any) => http.get('/admin/recharge-products', { params }),
    createProduct: (data: any) => http.post('/admin/recharge-products', data),
    updateProduct: (id: string, data: any) => http.put(`/admin/recharge-products/${id}`, data),
    deleteProduct: (id: string) => http.delete(`/admin/recharge-products/${id}`),
  },
  orders: {
    list: (params?: any) => http.get('/admin/orders', { params }),
    detail: (id: string) => http.get(`/admin/orders/${id}`),
    paymentConfigStatus: () => http.get('/admin/payment-config/status'),
    paymentConfig: () => http.get('/admin/payment-config'),
    updatePaymentConfig: (data: any) => http.put('/admin/payment-config', data),
  },
  distribution: {
    settings: () => http.get('/admin/distribution/settings'),
    updateSettings: (data: any) => http.put('/admin/distribution/settings', data),
    dashboard: () => http.get('/admin/distribution/dashboard'),
    distributors: (params?: any) => http.get('/admin/distribution/distributors', { params }),
    levelOne: () => http.get('/admin/distribution/level-one'),
    createDistributor: (data: any) => http.post('/admin/distribution/distributors', data),
    updateDistributor: (id: string, data: any) => http.put(`/admin/distribution/distributors/${id}`, data),
    commissions: (params?: any) => http.get('/admin/distribution/commissions', { params }),
  },
  articles: {
    list: (params?: any) => http.get('/admin/articles', { params }),
    create: (data: any) => http.post('/admin/articles', data),
    update: (id: string, data: any) => http.put(`/admin/articles/${id}`, data),
    delete: (id: string) => http.delete(`/admin/articles/${id}`),
  },
  quickQuestions: {
    list: (params?: any) => http.get('/admin/quick-questions', { params }),
    create: (data: any) => http.post('/admin/quick-questions', data),
    update: (id: string, data: any) => http.put(`/admin/quick-questions/${id}`, data),
    delete: (id: string) => http.delete(`/admin/quick-questions/${id}`),
  },
  autoReply: {
    list: () => http.get('/admin/auto-reply'),
    create: (data: any) => http.post('/admin/auto-reply', data),
    update: (id: string, data: any) => http.put(`/admin/auto-reply/${id}`, data),
    delete: (id: string) => http.delete(`/admin/auto-reply/${id}`),
  },
  aiConfig: {
    get: () => http.get('/admin/ai-config'),
    update: (data: any) => http.put('/admin/ai-config', data),
  },
  wechatMenu: {
    list: () => http.get('/admin/wechat-menu'),
    sync: () => http.post('/admin/wechat-menu/sync'),
  },
  notices: {
    list: () => http.get('/admin/notices'),
    create: (data: any) => http.post('/admin/notices', data),
    update: (id: string, data: any) => http.put(`/admin/notices/${id}`, data),
    delete: (id: string) => http.delete(`/admin/notices/${id}`),
  },
  skills: {
    list: () => http.get('/admin/skills'),
    create: (data: any) => http.post('/admin/skills', data),
    update: (id: string, data: any) => http.put(`/admin/skills/${id}`, data),
    delete: (id: string) => http.delete(`/admin/skills/${id}`),
    syncGithub: (skillId?: string) => http.post('/admin/skills/sync-github', { skillId }),
  },
  knowledge: {
    list: (params?: any) => http.get('/admin/knowledge', { params }),
    detail: (id: string) => http.get(`/admin/knowledge/${id}`),
    create: (data: any) => http.post('/admin/knowledge', data),
    update: (id: string, data: any) => http.put(`/admin/knowledge/${id}`, data),
    delete: (id: string) => http.delete(`/admin/knowledge/${id}`),
  },
  categories: {
    list: (params?: any) => http.get('/admin/categories', { params }),
    create: (data: any) => http.post('/admin/categories', data),
    update: (id: string, data: any) => http.put(`/admin/categories/${id}`, data),
    setDefault: (id: string) => http.put(`/admin/categories/set-default/${id}`),
    delete: (id: string) => http.delete(`/admin/categories/${id}`),
  },
  universities: {
    list: (params?: any) => http.get('/admin/universities', { params }),
    create: (data: any) => http.post('/admin/universities', data),
    update: (id: string, data: any) => http.put(`/admin/universities/${id}`, data),
    delete: (id: string) => http.delete(`/admin/universities/${id}`),
  },
  regions: {
    list: (params?: any) => http.get('/admin/regions', { params }),
    tree: (params?: any) => http.get('/admin/regions/tree', { params }),
    create: (data: any) => http.post('/admin/regions', data),
    update: (id: string, data: any) => http.put(`/admin/regions/${id}`, data),
    delete: (id: string) => http.delete(`/admin/regions/${id}`),
    syncUniversities: () => http.post('/admin/regions/sync-universities'),
  },
  admissionScores: {
    list: (params?: any) => http.get('/admin/admission-scores', { params }),
    create: (data: any) => http.post('/admin/admission-scores', data),
    update: (id: string, data: any) => http.put(`/admin/admission-scores/${id}`, data),
    delete: (id: string) => http.delete(`/admin/admission-scores/${id}`),
    import: (items: any[]) => http.post('/admin/admission-scores/import', { items }),
    autoFillStatus: () => http.get('/admin/admission-scores/auto-fill/status'),
    startAutoFill: (data?: any) => http.post('/admin/admission-scores/auto-fill/start', data || {}),
    stopAutoFill: () => http.post('/admin/admission-scores/auto-fill/stop'),
  },
  scoreRanks: {
    list: (params?: any) => http.get('/admin/score-ranks', { params }),
    dataYears: () => http.get('/volunteer/data-years'),
    create: (data: any) => http.post('/admin/score-ranks', data),
    update: (id: string, data: any) => http.put(`/admin/score-ranks/${id}`, data),
    delete: (id: string) => http.delete(`/admin/score-ranks/${id}`),
    import: (items: any[]) => http.post('/admin/score-ranks/import', { items }),
  },
  majors: {
    list: (params?: any) => http.get('/admin/majors', { params }),
    create: (data: any) => http.post('/admin/majors', data),
    update: (id: string, data: any) => http.put(`/admin/majors/${id}`, data),
    delete: (id: string) => http.delete(`/admin/majors/${id}`),
    import: (items: any[]) => http.post('/admin/majors/import', { items }),
  },
  universityMajors: {
    list: (params?: any) => http.get('/admin/university-majors', { params }),
    create: (data: any) => http.post('/admin/university-majors', data),
    update: (id: string, data: any) => http.put(`/admin/university-majors/${id}`, data),
    delete: (id: string) => http.delete(`/admin/university-majors/${id}`),
    import: (items: any[]) => http.post('/admin/university-majors/import', { items }),
  },
  volunteerReports: {
    list: (params?: any) => http.get('/admin/volunteer/reports', { params }),
  },
  webScrape: {
    search: (keyword: string) => http.post('/admin/web-search', { keyword }),
    scrape: (url: string) => http.post('/admin/web-scrape', { url }),
    polish: (title: string, content: string, type: 'article' | 'knowledge') =>
      http.post('/admin/web-polish', { title, content, type }),
  },
  export: {
    users: () => downloadCsv('/admin/export/users'),
    orders: (startDate?: string, endDate?: string) => {
      let url = '/admin/export/orders';
      const params: string[] = [];
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      if (params.length) url += `?${params.join('&')}`;
      return downloadCsv(url);
    },
    consultations: (startDate?: string, endDate?: string) => {
      let url = '/admin/export/consultations';
      const params: string[] = [];
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      if (params.length) url += `?${params.join('&')}`;
      return downloadCsv(url);
    },
  },
};

async function downloadCsv(url: string) {
  const token = localStorage.getItem('admin_token');
  const response = await fetch(`/api/v1${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('导出失败');
  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  const filename = url.split('/').pop()?.split('?')[0] || 'export';
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}
