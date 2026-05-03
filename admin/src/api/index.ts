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
  },
  orders: {
    list: (params?: any) => http.get('/admin/orders', { params }),
    detail: (id: string) => http.get(`/admin/orders/${id}`),
  },
  articles: {
    list: (params?: any) => http.get('/admin/articles', { params }),
    create: (data: any) => http.post('/admin/articles', data),
    update: (id: string, data: any) => http.put(`/admin/articles/${id}`, data),
    delete: (id: string) => http.delete(`/admin/articles/${id}`),
  },
  quickQuestions: {
    list: () => http.get('/admin/quick-questions'),
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
};
