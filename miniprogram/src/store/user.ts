import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api';

let wechatLoginInFlight: Promise<boolean> | null = null;

export const useUserStore = defineStore('user', () => {
  const token = ref<string>('');
  const userInfo = ref<any>(null);
  const pointsBalance = ref(0);
  const notices = ref<any[]>([]);
  const consultQuestion = ref('');
  const consultType = ref('gaokao');
  const consultContext = ref('');
  const pendingConsult = ref(false);
  const forceNewConsult = ref(false);
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

  async function completeWechatLogin(profile: { nickName?: string; avatarUrl?: string; phoneCode?: string; phoneEncryptedData?: string; phoneIv?: string }) {
    if (wechatLoginInFlight) return wechatLoginInFlight;

    wechatLoginInFlight = (async () => {
      try {
        const { code } = await uni.login();
        const referralCode = uni.getStorageSync('distribution_referral_code') || '';
        const adAttribution = getStoredTencentAdAttribution();
        const res = await api.auth.miniLogin(code, profile, referralCode, adAttribution);
        token.value = res.data.token;
        userInfo.value = res.data.user;
        uni.setStorageSync('token', res.data.token);
        if (referralCode) uni.removeStorageSync('distribution_referral_code');
        if (adAttribution) uni.removeStorageSync('tencent_ad_attribution');
        await fetchBalance();
        return true;
      } catch (e) {
        console.error('微信授权登录失败:', e);
        uni.showToast({ title: getWechatLoginErrorMessage(e), icon: 'none' });
        return false;
      } finally {
        wechatLoginInFlight = null;
      }
    })();

    return wechatLoginInFlight;
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
    forceNewConsult,
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

function getStoredTencentAdAttribution() {
  const data = uni.getStorageSync('tencent_ad_attribution');
  if (!data || typeof data !== 'object') return null;
  const capturedAt = new Date((data as any).capturedAt || 0).getTime();
  const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
  if (!capturedAt || Date.now() - capturedAt > maxAgeMs) {
    uni.removeStorageSync('tencent_ad_attribution');
    return null;
  }
  return data;
}

function getWechatLoginErrorMessage(error: any) {
  const errCode = String(error?.code || error?.data?.code || '');
  const errMsg = String(error?.errMsg || error?.message || error || '');

  if (errMsg.includes('cancel')) return '已取消微信授权';
  if (errMsg.includes('timeout')) return '微信授权超时，请重试';
  if (errMsg.includes('未配置') || errCode === 'WECHAT_MINI_NOT_CONFIGURED') return '微信登录参数未配置';
  if (errCode === 'WECHAT_LOGIN_UPSTREAM_UNAVAILABLE' || errCode === 'WECHAT_ACCESS_TOKEN_UPSTREAM_UNAVAILABLE' || errCode === 'WECHAT_PHONE_UPSTREAM_UNAVAILABLE') {
    return '微信服务暂时不稳定，请稍后再试';
  }
  if (errCode === 'WECHAT_LOGIN_FAIL' && errMsg.includes('invalid code')) {
    return '微信登录态已失效，请重试';
  }
  if (errCode === 'WECHAT_PHONE_INVALID_CODE') {
    return '手机号授权已失效，请重新点击登录';
  }
  if (errCode === 'WECHAT_PHONE_FAIL') {
    return '手机号授权失败，请稍后重试';
  }
  return '微信登录失败，请重试';
}
