<template>
  <view class="auth-page">
    <view class="sheet">
      <view class="brand-mark">
        <image class="brand-logo" src="/static/images/brand-logo.png" mode="aspectFit" />
      </view>
      <text class="title">手机号快捷登录</text>
      <text class="desc">用于领取体验点数、保存志愿报告和同步咨询记录。</text>

      <view class="benefits">
        <view class="benefit"><text>登录即领体验点数</text></view>
        <view class="benefit"><text>报告自动保存</text></view>
        <view class="benefit"><text>充值与订单可追踪</text></view>
      </view>

      <button
        id="auth-phone-target"
        class="phone-login"
        :class="[{ disabled: !agreementChecked || loading }, tutorialTapTargetClass('phone')]"
        :disabled="!agreementChecked || loading"
        open-type="getPhoneNumber"
        @getphonenumber="onGetPhoneNumber"
      >
        {{ loading ? '登录中...' : '手机号一键登录' }}
        <text v-if="tutorialFocusVisible('phone')" class="tutorial-hit-label">点击完成登录</text>
      </button>
      <text class="error-text" v-if="phoneError">{{ phoneError }}</text>
      <button class="ghost-button" @click="goBack">暂不登录</button>

      <view id="auth-terms-target" class="terms-row" :class="tutorialTapTargetClass('terms')" @click="toggleAgreement">
        <view class="terms-check" :class="{ checked: agreementChecked }">
          <text v-if="agreementChecked">✓</text>
        </view>
        <view class="terms-copy">
          <text>我已阅读并同意</text>
          <text class="terms-link" @click.stop="openAgreement('user')">《用户服务协议》</text>
          <text>和</text>
          <text class="terms-link" @click.stop="openAgreement('privacy')">《隐私政策》</text>
        </view>
        <text v-if="tutorialFocusVisible('terms')" class="tutorial-hit-label">先勾选同意</text>
      </view>
    </view>

    <view class="tutorial-focus-mask" v-if="tutorialOpen" @click.stop></view>
    <view class="tutorial-card" :class="tutorialCardPlacement" v-if="tutorialOpen" @touchmove.stop>
      <view class="tutorial-head">
        <view class="tutorial-step-badge">
          <text>{{ tutorialStep + 1 }}</text>
        </view>
        <view class="tutorial-copy">
          <text class="tutorial-progress">{{ tutorialStep + 1 }}/{{ authTutorialSteps.length }}</text>
          <text class="tutorial-title">{{ currentTutorialStep.title }}</text>
          <text class="tutorial-desc">{{ currentTutorialStep.desc }}</text>
        </view>
        <text class="tutorial-close" @click="finishTutorial">×</text>
      </view>
      <view class="tutorial-dots">
        <text
          v-for="(_, index) in authTutorialSteps"
          :key="index"
          :class="{ active: index === tutorialStep }"
        ></text>
      </view>
      <view class="tutorial-actions">
        <text class="tutorial-skip" @click="finishTutorial">跳过</text>
        <text class="tutorial-auto-note">按高亮处操作，将自动继续</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { onReady } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();
const loading = ref(false);
const phoneError = ref('');
const agreementChecked = ref(false);
const tutorialOpen = ref(false);
const tutorialStep = ref(0);
const tutorialCardPlacement = ref<'top' | 'bottom'>('top');
const authTutorialSteps = [
  {
    key: 'terms',
    anchor: 'auth-terms-target',
    title: '先勾选协议',
    desc: '为了完成手机号授权，需要先阅读并同意用户服务协议和隐私政策。',
  },
  {
    key: 'phone',
    anchor: 'auth-phone-target',
    title: '完成手机号登录',
    desc: '点击手机号一键登录，成功后会回到刚才的页面继续生成报告。',
  },
] as const;

const currentTutorialStep = computed(() => authTutorialSteps[tutorialStep.value] || authTutorialSteps[0]);

onReady(() => {
  setTimeout(() => openTutorial(), 220);
});

async function onGetPhoneNumber(e: any) {
  if (loading.value) return;
  if (!agreementChecked.value) {
    phoneError.value = '请先阅读并勾选同意用户服务协议和隐私政策';
    uni.showToast({ title: phoneError.value, icon: 'none' });
    return;
  }
  console.log('[auth] getPhoneNumber detail', e?.detail);
  if (e?.detail?.errMsg !== 'getPhoneNumber:ok' || (!e?.detail?.code && !(e?.detail?.encryptedData && e?.detail?.iv))) {
    const errMsg = String(e?.detail?.errMsg || 'getPhoneNumber:fail');
    phoneError.value = readablePhoneError(errMsg);
    uni.showToast({ title: phoneError.value, icon: 'none' });
    return;
  }

  phoneError.value = '';
  loading.value = true;
  const ok = await userStore.completeWechatLogin({
    phoneCode: e.detail.code || '',
    phoneEncryptedData: e.detail.encryptedData || '',
    phoneIv: e.detail.iv || '',
  });
  loading.value = false;
  if (ok) {
    finishTutorial();
    uni.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => goBack(), 500);
  }
}

function toggleAgreement() {
  agreementChecked.value = !agreementChecked.value;
  if (agreementChecked.value && phoneError.value.includes('协议')) phoneError.value = '';
  if (agreementChecked.value) advanceTutorialFrom('terms');
}

function openAgreement(type: 'user' | 'privacy') {
  uni.navigateTo({ url: `/pages/agreement/index?type=${type}` });
}

function readablePhoneError(errMsg: string) {
  if (errMsg.includes('短信验证') || errMsg.includes('验证步骤') || errMsg.includes('verify')) {
    return '当前微信绑定手机号需短信验证，请在微信客户端完成验证后重试';
  }
  if (errMsg.includes('deny') || errMsg.includes('cancel')) return '你取消了手机号授权';
  if (errMsg.includes('timeout')) return '手机号授权超时，请重试';
  if (errMsg.includes('no permission') || errMsg.includes('permission')) return '小程序未开通手机号能力';
  if (errMsg.includes('fail')) return `手机号授权失败：${errMsg}`;
  return `手机号授权未完成：${errMsg}`;
}

function goBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) uni.navigateBack();
  else uni.reLaunch({ url: '/pages/volunteer/index' });
}

function tutorialFocusVisible(key: typeof authTutorialSteps[number]['key']) {
  return tutorialOpen.value && currentTutorialStep.value.key === key;
}

function tutorialTapTargetClass(key: typeof authTutorialSteps[number]['key']) {
  return {
    'tutorial-tap-target': tutorialFocusVisible(key),
  };
}

function openTutorial() {
  if (userStore.isLogin) return;
  tutorialStep.value = agreementChecked.value ? 1 : 0;
  tutorialOpen.value = true;
  scrollToCurrentTutorialStep();
}

function finishTutorial() {
  tutorialOpen.value = false;
}

function advanceTutorialFrom(key: typeof authTutorialSteps[number]['key']) {
  if (!tutorialOpen.value || currentTutorialStep.value.key !== key) return;
  if (tutorialStep.value >= authTutorialSteps.length - 1) {
    finishTutorial();
    return;
  }
  tutorialStep.value += 1;
  scrollToCurrentTutorialStep();
}

function scrollToCurrentTutorialStep() {
  nextTick(() => {
    setTimeout(() => {
      const selector = `#${currentTutorialStep.value.anchor}`;
      uni.createSelectorQuery()
        .select(selector)
        .boundingClientRect()
        .selectViewport()
        .scrollOffset()
        .exec((res: any[]) => {
          const rect = res?.[0];
          const viewport = res?.[1];
          if (!rect || !viewport) {
            uni.pageScrollTo({ selector, duration: 220 } as any);
            return;
          }
          const windowHeight = uni.getSystemInfoSync().windowHeight || 667;
          tutorialCardPlacement.value = Number(rect.top || 0) > windowHeight * 0.56 ? 'top' : 'bottom';
          const currentScrollTop = Number(viewport.scrollTop || 0);
          const targetTop = currentScrollTop + Number(rect.top || 0);
          const targetHeight = Number(rect.height || 0);
          const topSafe = tutorialCardPlacement.value === 'top' ? 276 : 88;
          const bottomSafe = tutorialCardPlacement.value === 'bottom' ? 276 : 96;
          const availableHeight = Math.max(160, windowHeight - topSafe - bottomSafe);
          const desiredTop = topSafe + Math.max(0, (availableHeight - targetHeight - 48) / 2);
          uni.pageScrollTo({
            scrollTop: Math.max(0, Math.round(targetTop - desiredTop)),
            duration: 220,
          });
        });
    }, 60);
  });
}
</script>

<style lang="scss" scoped>
.auth-page {
  min-height: 100vh;
  padding: 56rpx 32rpx;
  background: #f7f8fb;
  display: flex;
  align-items: center;
}

.sheet {
  width: 100%;
  background: #fff;
  border: 1rpx solid $border;
  border-radius: 24rpx;
  padding: 44rpx 36rpx;
  box-shadow: 0 20rpx 60rpx rgba(15, 23, 42, 0.08);
  text-align: center;
}

.brand-mark {
  width: 112rpx;
  height: 112rpx;
  margin: 0 auto 28rpx;
  border-radius: 28rpx;
  overflow: hidden;
  background: #101010;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 18rpx 42rpx rgba(15, 23, 42, 0.16);
}

.brand-logo {
  width: 112rpx;
  height: 112rpx;
  display: block;
}

.title {
  display: block;
  font-size: 42rpx;
  font-weight: 900;
  color: $text-primary;
}

.desc {
  display: block;
  margin-top: 14rpx;
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 1.6;
}

.benefits {
  margin: 36rpx 0;
  display: grid;
  gap: 14rpx;
  text-align: left;
}

.benefit {
  padding: 20rpx 24rpx;
  border-radius: $radius-md;
  background: #f8fafc;
  color: $text-primary;
  font-size: $font-sm;
}

.phone-login {
  position: relative;
  height: 92rpx;
  line-height: 92rpx;
  border-radius: $radius-full;
  background: #07c160;
  color: #fff;
  font-size: $font-md;
  font-weight: 800;
}

.phone-login.disabled {
  background: #cbd5e1;
  color: #f8fafc;
}

.error-text {
  display: block;
  margin: -12rpx 0 18rpx;
  color: $danger;
  font-size: $font-xs;
  line-height: 1.5;
}

.ghost-button {
  margin-top: 18rpx;
  height: 76rpx;
  line-height: 76rpx;
  background: transparent;
  color: $text-secondary;
  font-size: $font-sm;
}

.phone-login::after,
.ghost-button::after {
  border: 0;
}

.terms-row {
  position: relative;
  margin-top: 24rpx;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 12rpx;
  text-align: left;
}

.terms-check {
  width: 30rpx;
  height: 30rpx;
  margin-top: 2rpx;
  box-sizing: border-box;
  border-radius: 50%;
  border: 2rpx solid #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $text-dim;
  font-size: $font-xs;
}

.terms-check.checked {
  border-color: #07c160;
  background: #07c160;
  color: #fff;
}

.terms-copy {
  flex: 0 1 auto;
  max-width: 540rpx;
  color: $text-dim;
  font-size: $font-xs;
  line-height: 1.5;
}

.terms-link {
  color: #2563eb;
  font-weight: 700;
}

.tutorial-focus-mask {
  position: fixed;
  inset: 0;
  z-index: 8888;
  background: rgba(15, 23, 42, 0.46);
}

.tutorial-tap-target {
  position: relative;
  z-index: 8891;
  border-radius: 18rpx;
  box-shadow: 0 0 0 6rpx rgba(20, 184, 166, 0.28), 0 0 0 16rpx rgba(20, 184, 166, 0.10), 0 24rpx 48rpx rgba(15, 23, 42, 0.24);
  animation: tutorialGlowFlash 1.05s ease-in-out infinite;
}

.tutorial-tap-target::before {
  content: '';
  position: absolute;
  inset: -10rpx;
  border: 3rpx solid rgba(20, 184, 166, 0.82);
  border-radius: 22rpx;
  box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.46);
  animation: tutorialBorderFlash 1.05s ease-in-out infinite;
  pointer-events: none;
}

.phone-login.tutorial-tap-target {
  background: #07c160;
  color: #fff;
}

.terms-row.tutorial-tap-target {
  justify-content: flex-start;
  margin-left: -14rpx;
  margin-right: -14rpx;
  padding: 14rpx;
  box-sizing: border-box;
  background: #fff;
}

.tutorial-hit-label {
  position: absolute;
  right: 0;
  bottom: -54rpx;
  min-width: 112rpx;
  height: 42rpx;
  padding: 0 18rpx;
  box-sizing: border-box;
  border-radius: 999rpx;
  background: #0f766e;
  color: #fff;
  font-size: 23rpx;
  font-weight: 900;
  line-height: 42rpx;
  text-align: center;
  box-shadow: 0 12rpx 24rpx rgba(15, 118, 110, 0.24);
  pointer-events: none;
  white-space: nowrap;
}

.phone-login .tutorial-hit-label {
  bottom: auto;
  top: -58rpx;
  line-height: 42rpx;
}

.tutorial-card {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  z-index: 8892;
  box-sizing: border-box;
  max-height: 238rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.98);
  border: 1rpx solid rgba(15, 118, 110, 0.18);
  box-shadow: 0 28rpx 72rpx rgba(15, 23, 42, 0.22);
  overflow: hidden;
}

.tutorial-card.top {
  top: calc(24rpx + env(safe-area-inset-top));
  bottom: auto;
}

.tutorial-card.bottom {
  top: auto;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.tutorial-head {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.tutorial-step-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 56rpx;
  height: 56rpx;
  border-radius: $radius-full;
  background: #0f766e;
  color: #fff;
  font-size: 28rpx;
  font-weight: 900;
}

.tutorial-copy {
  flex: 1;
  min-width: 0;
}

.tutorial-progress {
  display: block;
  color: #0f766e;
  font-size: 21rpx;
  font-weight: 900;
  line-height: 1.2;
}

.tutorial-title {
  display: block;
  margin-top: 4rpx;
  color: $text-primary;
  font-size: 32rpx;
  font-weight: 900;
  line-height: 1.24;
}

.tutorial-desc {
  display: block;
  margin-top: 8rpx;
  color: $text-secondary;
  font-size: 25rpx;
  line-height: 1.38;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tutorial-close {
  flex-shrink: 0;
  width: 48rpx;
  height: 48rpx;
  color: #94a3b8;
  font-size: 44rpx;
  line-height: 42rpx;
  text-align: center;
}

.tutorial-dots {
  display: flex;
  gap: 8rpx;
  margin-top: 14rpx;
}

.tutorial-dots text {
  width: 32rpx;
  height: 7rpx;
  border-radius: $radius-full;
  background: #e2e8f0;
}

.tutorial-dots text.active {
  width: 54rpx;
  background: #0f766e;
}

.tutorial-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 14rpx;
}

.tutorial-skip {
  flex-shrink: 0;
  color: #64748b;
  font-size: 25rpx;
  font-weight: 800;
}

.tutorial-auto-note {
  min-width: 0;
  color: #0f766e;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 1.35;
  text-align: right;
}

@keyframes tutorialGlowFlash {
  0%,
  100% {
    box-shadow: 0 0 0 5rpx rgba(20, 184, 166, 0.22), 0 0 0 14rpx rgba(20, 184, 166, 0.08), 0 24rpx 48rpx rgba(15, 23, 42, 0.22);
  }
  50% {
    box-shadow: 0 0 0 8rpx rgba(250, 204, 21, 0.52), 0 0 0 20rpx rgba(20, 184, 166, 0.16), 0 28rpx 54rpx rgba(15, 23, 42, 0.28);
  }
}

@keyframes tutorialBorderFlash {
  0%,
  100% {
    border-color: rgba(20, 184, 166, 0.70);
    box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.22);
    opacity: 0.72;
    transform: scale(1);
  }
  50% {
    border-color: rgba(250, 204, 21, 0.98);
    box-shadow: 0 0 0 10rpx rgba(250, 204, 21, 0.22);
    opacity: 1;
    transform: scale(1.025);
  }
}
</style>
