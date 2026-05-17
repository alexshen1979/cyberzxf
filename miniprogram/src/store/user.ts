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
  const consultContext = ref('');
  const pendingConsult = ref(false);
  const showHistoryTab = ref(false);
  const loadSessionId = ref('');

  const isLogin = computed(() => !!token.value);

  async function restoreSession() {
    const savedToken = uni.getStorageSync('token');
    if (!savedToken) return;
    token.value = savedToken;
    try {
      const [profile] = await Promise.all([
        api.auth.getProfile(),
        fetchBalance(),
      ]);
      userInfo.value = profile.data;
    } catch (e) {
      console.error('恢复登录失败:', e);
      logout(false);
    }
  }

  // 进入微信授权登录页。头像、昵称、手机号必须由页面上的微信开放能力按钮触发。
  async function loginWithWechatProfile() {
    uni.navigateTo({ url: '/pages/auth/index' });
    return false;
  }

  async function completeWechatLogin(profile: { nickName?: string; avatarUrl?: string; phoneCode: string }) {
    try {
      const { code } = await uni.login();
      const referralCode = uni.getStorageSync('distribution_referral_code') || '';
      const res = await api.auth.miniLogin(code, profile, referralCode);
      token.value = res.data.token;
      userInfo.value = res.data.user;
      uni.setStorageSync('token', res.data.token);
      if (referralCode) uni.removeStorageSync('distribution_referral_code');
      await fetchBalance();
      return true;
    } catch (e) {
      console.error('微信授权登录失败:', e);
      const errMsg = String((e as any)?.errMsg || (e as any)?.message || '');
      if (errMsg.includes('cancel')) {
        uni.showToast({ title: '已取消微信授权', icon: 'none' });
      } else if (errMsg.includes('timeout')) {
        uni.showToast({ title: '微信授权超时，请重试', icon: 'none' });
      } else if (errMsg.includes('未配置')) {
        uni.showToast({ title: '微信登录参数未配置', icon: 'none' });
      } else {
        uni.showToast({ title: '微信登录失败，请重试', icon: 'none' });
      }
      return false;
    }
  }

  async function silentLogin() {
    return loginWithWechatProfile();
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
    userInfo.value = Object.assign({}, userInfo.value, res.data);
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
  function logout(redirect = true) {
    token.value = '';
    userInfo.value = null;
    pointsBalance.value = 0;
    uni.removeStorageSync('token');
    if (redirect) uni.reLaunch({ url: '/pages/volunteer/index' });
  }

  return {
    token,
    userInfo,
    pointsBalance,
    notices,
    consultQuestion,
    consultType,
    consultContext,
    pendingConsult,
    showHistoryTab,
    loadSessionId,
    isLogin,
    restoreSession,
    silentLogin,
    fetchBalance,
    updateProfile,
    loginWithWechatProfile,
    completeWechatLogin,
    checkNotices,
    logout,
  };
});
