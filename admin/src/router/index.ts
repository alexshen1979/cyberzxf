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
      { path: 'distribution', redirect: '/distribution/overview' },
      { path: 'distribution/overview', name: 'DistributionOverview', component: () => import('@/views/distribution/index.vue'), meta: { title: '推荐合作', distributionSection: 'overview' } },
      { path: 'distribution/distributors', name: 'DistributionDistributors', component: () => import('@/views/distribution/index.vue'), meta: { title: '合作人员', distributionSection: 'distributors', editorAllowed: true } },
      { path: 'distribution/commissions', name: 'DistributionCommissions', component: () => import('@/views/distribution/index.vue'), meta: { title: '奖励流水', distributionSection: 'commissions' } },
      { path: 'distribution/general-agent-commissions', name: 'DistributionGeneralAgentCommissions', component: () => import('@/views/distribution/index.vue'), meta: { title: '总代佣金', distributionSection: 'generalAgentCommissions' } },
      { path: 'distribution/withdrawals', name: 'DistributionWithdrawals', component: () => import('@/views/distribution/index.vue'), meta: { title: '提现管理', distributionSection: 'withdrawals' } },
      { path: 'admins', name: 'Admins', component: () => import('@/views/admins/index.vue'), meta: { title: '管理员账号' } },
      { path: 'content/articles', name: 'Articles', component: () => import('@/views/content/articles.vue'), meta: { title: '干货文库' } },
      { path: 'content/quick-questions', name: 'QuickQuestions', component: () => import('@/views/content/quick-questions.vue'), meta: { title: '快捷提问', editorAllowed: true } },
      { path: 'content/auto-reply', name: 'AutoReply', component: () => import('@/views/content/auto-reply.vue'), meta: { title: '自动回复' } },
      { path: 'content/knowledge', name: 'Knowledge', component: () => import('@/views/content/knowledge.vue'), meta: { title: '知识库', editorAllowed: true } },
      { path: 'content/categories', name: 'Categories', component: () => import('@/views/content/categories.vue'), meta: { title: '分类管理' } },
      { path: 'content/regions', name: 'Regions', component: () => import('@/views/content/regions.vue'), meta: { title: '省市管理' } },
      { path: 'content/universities', name: 'Universities', component: () => import('@/views/content/universities.vue'), meta: { title: '院校库', editorAllowed: true } },
      { path: 'content/majors', name: 'Majors', component: () => import('@/views/content/majors.vue'), meta: { title: '专业库', editorAllowed: true } },
      { path: 'content/score-ranks', name: 'ScoreRanks', component: () => import('@/views/content/score-ranks.vue'), meta: { title: '一分一段表' } },
      { path: 'content/admission-scores', name: 'AdmissionScores', component: () => import('@/views/content/admission-scores.vue'), meta: { title: '录取分数线' } },
      { path: 'content/art-admission-rules', name: 'ArtAdmissionRules', component: () => import('@/views/content/art-admission-rules.vue'), meta: { title: '艺术类规则' } },
      { path: 'content/art-admission-scores', name: 'ArtAdmissionScores', component: () => import('@/views/content/art-admission-scores.vue'), meta: { title: '艺术类投档线' } },
      { path: 'content/volunteer-data', name: 'VolunteerData', component: () => import('@/views/content/volunteer-data.vue'), meta: { title: '志愿报告' } },
      { path: 'ai-config', name: 'AiConfig', component: () => import('@/views/ai-config/index.vue'), meta: { title: 'AI配置' } },
      { path: 'skills', name: 'Skills', component: () => import('@/views/skills/index.vue'), meta: { title: 'Skill 管理' } },
      { path: 'wechat', name: 'Wechat', component: () => import('@/views/wechat/index.vue'), meta: { title: '公众号管理', editorAllowed: true } },
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
  } else if (to.path === '/distribution' && store.isEditor) {
    next('/distribution/distributors');
  } else if (store.isEditor && !to.meta.editorAllowed) {
    next('/content/quick-questions');
  } else {
    next();
  }
});

export default router;
