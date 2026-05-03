import { createRouter, createWebHashHistory } from 'vue-router';
import { useAdminStore } from '@/store/admin';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { noAuth: true },
  },
  {
    path: '/',
    component: () => import('@/views/layout/index.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/dashboard/index.vue'), meta: { title: '数据大盘' } },
      { path: 'users', name: 'Users', component: () => import('@/views/users/index.vue'), meta: { title: '用户管理' } },
      { path: 'users/:id', name: 'UserDetail', component: () => import('@/views/users/detail.vue'), meta: { title: '用户详情', hidden: true } },
      { path: 'points', name: 'Points', component: () => import('@/views/points/index.vue'), meta: { title: '点数管理' } },
      { path: 'orders', name: 'Orders', component: () => import('@/views/orders/index.vue'), meta: { title: '订单管理' } },
      { path: 'content/articles', name: 'Articles', component: () => import('@/views/content/articles.vue'), meta: { title: '干货文库' } },
      { path: 'content/quick-questions', name: 'QuickQuestions', component: () => import('@/views/content/quick-questions.vue'), meta: { title: '快捷提问' } },
      { path: 'ai-config', name: 'AiConfig', component: () => import('@/views/ai-config/index.vue'), meta: { title: 'AI配置' } },
      { path: 'wechat', name: 'Wechat', component: () => import('@/views/wechat/index.vue'), meta: { title: '公众号管理' } },
      { path: 'notices', name: 'Notices', component: () => import('@/views/notices/index.vue'), meta: { title: '系统公告' } },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const store = useAdminStore();
  if (to.meta.noAuth) {
    next();
  } else if (!store.token) {
    next('/login');
  } else {
    next();
  }
});

export default router;
