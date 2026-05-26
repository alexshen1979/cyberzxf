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
        class="phone-login"
        :class="{ disabled: !agreementChecked || loading }"
        :disabled="!agreementChecked || loading"
        open-type="getPhoneNumber"
        @getphonenumber="onGetPhoneNumber"
      >
        {{ loading ? '登录中...' : '手机号一键登录' }}
      </button>
      <text class="error-text" v-if="phoneError">{{ phoneError }}</text>
      <button class="ghost-button" @click="goBack">暂不登录</button>

      <view class="terms-row" @click="toggleAgreement">
        <view class="terms-check" :class="{ checked: agreementChecked }">
          <text v-if="agreementChecked">✓</text>
        </view>
        <view class="terms-copy">
          <text>我已阅读并同意</text>
          <text class="terms-link" @click.stop="openAgreement('user')">《用户服务协议》</text>
          <text>和</text>
          <text class="terms-link" @click.stop="openAgreement('privacy')">《隐私政策》</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();
const loading = ref(false);
const phoneError = ref('');
const agreementChecked = ref(false);

async function onGetPhoneNumber(e: any) {
  if (loading.value) return;
  if (!agreementChecked.value) {
    phoneError.value = '请先阅读并勾选同意用户服务协议和隐私政策';
    uni.showToast({ title: phoneError.value, icon: 'none' });
    return;
  }
  if (e?.detail?.errMsg !== 'getPhoneNumber:ok' || !e?.detail?.code) {
    const errMsg = String(e?.detail?.errMsg || 'getPhoneNumber:fail');
    phoneError.value = readablePhoneError(errMsg);
    uni.showToast({ title: phoneError.value, icon: 'none' });
    return;
  }

  phoneError.value = '';
  loading.value = true;
  const ok = await userStore.completeWechatLogin({ phoneCode: e.detail.code });
  loading.value = false;
  if (ok) {
    uni.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => goBack(), 500);
  }
}

function toggleAgreement() {
  agreementChecked.value = !agreementChecked.value;
  if (agreementChecked.value && phoneError.value.includes('协议')) phoneError.value = '';
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
  return '手机号授权未完成';
}

function goBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) uni.navigateBack();
  else uni.reLaunch({ url: '/pages/volunteer/index' });
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
</style>
