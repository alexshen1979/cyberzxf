<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';

onLaunch((options: any) => {
  captureDistributionReferral(options);
  captureTencentAdAttribution(options);

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
  captureTencentAdAttribution(options);
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

function captureTencentAdAttribution(options: any) {
  const query = collectLaunchQuery(options);
  const debugAd = normalizeAdParam(query.debug_ad) === '1';
  const directClickId = normalizeAdParam(query.click_id || query.clickid || query.__CLICK_ID__);
  const gdtVid = normalizeAdParam(query.gdt_vid);
  const qzGdt = normalizeAdParam(query.qz_gdt);
  const clickId = normalizeAdParam(directClickId || gdtVid || qzGdt);
  const cb = normalizeAdParam(query.cb || query.__CALLBACK__ || query.callback);
  const callbackUrl = normalizeAdParam(query.callback_url || query.callbackUrl);
  if (!clickId && !cb && !callbackUrl) {
    if (debugAd) {
      console.log('[tencent-ad] 未捕获广告参数', query);
      uni.showToast({ title: '未捕获广告参数', icon: 'none' });
    }
    return;
  }

  uni.setStorageSync('tencent_ad_attribution', {
    clickId,
    clickIdSource: directClickId ? 'click_id' : gdtVid ? 'gdt_vid' : qzGdt ? 'qz_gdt' : '',
    gdtVid,
    qzGdt,
    cb,
    callbackUrl,
    rawQuery: query,
    capturedAt: new Date().toISOString(),
  });
  if (debugAd) {
    console.log('[tencent-ad] 已捕获广告参数', query);
    uni.showToast({ title: `已捕获${directClickId ? 'click_id' : gdtVid ? 'gdt_vid' : qzGdt ? 'qz_gdt' : 'cb'}`, icon: 'none' });
  }
}

function collectLaunchQuery(options: any) {
  const query = { ...(options?.query || {}) } as Record<string, any>;
  const scene = query.scene || options?.scene;
  Object.assign(query, parseQueryString(scene));
  return query;
}

function parseQueryString(value?: string) {
  const decoded = decodeURIComponent(String(value || ''));
  if (!decoded || !decoded.includes('=')) return {};
  const result: Record<string, string> = {};
  decoded.split('&').forEach((pair) => {
    const index = pair.indexOf('=');
    if (index <= 0) return;
    const key = pair.slice(0, index);
    const val = pair.slice(index + 1);
    if (key) result[key] = val;
  });
  return result;
}

function normalizeAdParam(value: any) {
  return String(value || '').trim();
}
</script>

<style lang="scss">
@use '@/styles/global.scss';
</style>
