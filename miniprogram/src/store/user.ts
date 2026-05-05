import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api';

export const useUserStore = defineStore('user', () => {
  const token = ref<string>('');
  const userInfo = ref<any>(null);
  const pointsBalance = ref(0);
  const notices = ref<any[]>([]);
  const consultQuestion = ref('');
  const consultType = ref('gaokao');
  const pendingConsult = ref(false);
  const showHistoryTab = ref(false);
  const loadSessionId = ref('');

  const isLogin = computed(() => !!token.value);

  // 静默登录
  async function silentLogin() {
    try {
      const { code } = await uni.login();
      const res = await api.auth.miniLogin(code);
      token.value = res.data.token;
      userInfo.value = res.data.user;
      uni.setStorageSync('token', res.data.token);

      // 获取点数余额
      await fetchBalance();
    } catch (e) {
      console.error('静默登录失败:', e);
    }
  }

  // 获取点数余额
  async function fetchBalance() {
    if (!isLogin.value) return;
    try {
      const res = await api.points.getBalance();
      pointsBalance.value = res.data.balance;
    } catch (e) {
      console.error('获取点数余额失败:', e);
    }
  }

  // 更新个人信息
  async function updateProfile(data: any) {
    const res = await api.auth.updateProfile(data);
    userInfo.value = { ...userInfo.value, ...res.data };
  }

  // 获取系统公告
  async function checkNotices() {
    try {
      const res = await api.notices.list();
      notices.value = res.data as any[];
    } catch (e) {
      // ignore
    }
  }

  // 退出登录
  function logout() {
    token.value = '';
    userInfo.value = null;
    pointsBalance.value = 0;
    uni.removeStorageSync('token');
    uni.reLaunch({ url: '/pages/index/index' });
  }

  return {
    token,
    userInfo,
    pointsBalance,
    notices,
    consultQuestion,
    consultType,
    pendingConsult,
    showHistoryTab,
    loadSessionId,
    isLogin,
    silentLogin,
    fetchBalance,
    updateProfile,
    checkNotices,
    logout,
  };
});
