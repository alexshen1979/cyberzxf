<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';

onLaunch((options: any) => {
  captureDistributionReferral(options);

  // 只恢复已有登录态；新用户先以游客状态进入，在关键动作处再引导登录领取赠点。
  const userStore = useUserStore();
  setTimeout(() => {
    userStore.restoreSession().catch((e) => {
      console.error('恢复登录失败:', e);
    });
    userStore.checkNotices();
  }, 300);
});

onShow((options: any) => {
  captureDistributionReferral(options);
});

function captureDistributionReferral(options: any) {
  const query = options?.query || {};
  const code = normalizeReferralCode(query.ref || extractReferralFromScene(query.scene));
  if (code) uni.setStorageSync('distribution_referral_code', code);
}

function extractReferralFromScene(scene?: string) {
  const decoded = decodeURIComponent(String(scene || ''));
  if (!decoded) return '';
  const pairs = decoded.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key === 'd' || key === 'ref') return value || '';
  }
  return /^(D|ZS)/i.test(decoded) ? decoded : '';
}

function normalizeReferralCode(value: any) {
  return String(value || '').trim().toUpperCase();
}
</script>

<style lang="scss">
@use '@/styles/global.scss';
</style>
