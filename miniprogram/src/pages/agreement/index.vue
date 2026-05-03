<template>
  <view class="agreement-page">
    <rich-text :nodes="content"></rich-text>
  </view>
</template>

<script setup lang="ts">
import { ref, onLoad } from 'vue';

const content = ref('');

const agreements: Record<string, string> = {
  user: `<h2>用户服务协议</h2><p>欢迎使用赛博张老师AI升学咨询平台...</p><p>本协议详细说明了用户的权利与义务。</p>`,
  privacy: `<h2>隐私政策</h2><p>我们重视您的隐私...</p><p>本平台最小化收集用户隐私信息，仅用于提供AI咨询服务。</p>`,
  points: `<h2>咨询点数规则</h2><p>1. 咨询点数仅可在本平台使用，不可转让、不可提现、不可交易。</p><p>2. 点数有效期为1年，过期自动作废。</p><p>3. 充值点数不可退款（法律法规另有规定除外）。</p>`,
  minor: `<h2>未成年人充值提醒</h2><p>未成年人请在监护人指导下使用本平台服务。</p><p>如发生未经监护人同意的充值，请联系客服处理。</p>`,
};

onLoad((options: any) => {
  const type = options?.type || 'user';
  content.value = agreements[type] || agreements.user;
  uni.setNavigationBarTitle({
    title: type === 'user' ? '用户协议' :
           type === 'privacy' ? '隐私政策' :
           type === 'points' ? '点数规则' : '未成年人提示',
  });
});
</script>

<style lang="scss" scoped>
.agreement-page { padding: 32rpx; line-height: 1.8; color: #e8eaf0; }
</style>
