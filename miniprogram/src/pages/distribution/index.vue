<template>
  <view class="distribution-page">
    <view class="summary-band">
      <text class="eyebrow">我的分享码</text>
      <text class="title">{{ pageTitle }}</text>
      <text class="subtitle">{{ pageSubtitle }}</text>
    </view>

    <view class="apply-section" v-if="!distributor">
      <view class="empty-card">
        <text class="empty-title">还没有分享码</text>
        <text class="empty-desc">申请通过后即可生成专属小程序码。朋友通过你的码进入并完成首单后，可按后台规则产生分享奖励。</text>
        <view class="primary-btn" @click="apply" :class="{ disabled: applying }">
          <text>{{ applying ? '申请中...' : '立即申请' }}</text>
        </view>
      </view>
    </view>

    <view v-else>
      <view class="status-card pending" v-if="isPending">
        <text class="empty-title">申请已提交，等待后台审核</text>
        <text class="empty-desc">审核通过后会开放专属小程序码和分享功能。当前还不会产生分享归因和奖励。</text>
      </view>
      <view class="status-card disabled" v-else-if="isDisabled">
        <text class="empty-title">分享码未启用</text>
        <text class="empty-desc">你的分享码当前不可用，如需恢复请联系平台管理员。</text>
      </view>

      <view class="stats-grid" v-if="isActive">
        <view class="stat-item">
          <text class="stat-value">{{ stats.directReferralCount || 0 }}</text>
          <text class="stat-label">直推用户</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ stats.paidReferralCount || 0 }}</text>
          <text class="stat-label">首单用户</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ formatMoney(stats.commissionAmount || 0) }}</text>
          <text class="stat-label">奖励累计</text>
        </view>
      </view>

      <view class="info-card">
        <view class="info-row">
          <text class="info-label">当前层级</text>
          <text class="info-value">{{ levelName(distributor.level) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">审核状态</text>
          <text class="info-value">{{ statusText }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">所属一级</text>
          <text class="info-value">{{ distributor.level === 1 ? '无' : (distributor.parent?.name || '系统') }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">分享奖励</text>
          <text class="info-value">{{ rateText }}</text>
        </view>
      </view>

      <view class="qr-card" v-if="isActive">
        <view class="section-head">
          <text class="section-title">我的分享码</text>
          <text class="section-action" @click="loadQrcode(true)">刷新</text>
        </view>
        <view class="qr-box">
          <image v-if="qrcodeUrl" class="qr-img" :src="qrcodeUrl" mode="aspectFit" />
          <view v-else class="qr-placeholder" @click="loadQrcode(true)">
            <text>{{ qrcodeLoading ? '生成中...' : '点击生成小程序码' }}</text>
          </view>
        </view>
        <view class="share-path">
          <text>{{ sharePath }}</text>
        </view>
        <view class="action-row">
          <view class="secondary-btn" @click="copySharePath">复制路径</view>
          <button class="primary-btn button-reset" open-type="share">分享给朋友</button>
        </view>
      </view>

      <view class="commission-card" v-if="isActive">
        <view class="section-head">
          <text class="section-title">分享奖励</text>
          <text class="section-action" @click="loadCommissions">刷新</text>
        </view>
        <view class="empty-list" v-if="commissions.length === 0">暂无奖励记录</view>
        <view class="commission-item" v-for="item in commissions" :key="item.id">
          <view>
            <text class="commission-title">{{ roleLabel(item.role) }}</text>
            <text class="commission-sub">{{ item.order?.productName || '充值订单' }} · {{ formatDate(item.createdAt) }}</text>
          </view>
          <text class="commission-amount">{{ formatMoney(item.amount) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad, onPullDownRefresh, onShareAppMessage } from '@dcloudio/uni-app';
import { api } from '@/api';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();
const data = ref<any>(null);
const commissions = ref<any[]>([]);
const applying = ref(false);
const qrcodeLoading = ref(false);
const qrcodeUrl = ref('');

const distributor = computed(() => data.value?.distributor || null);
const stats = computed(() => data.value?.stats || {});
const setting = computed(() => data.value?.setting || {});
const isActive = computed(() => distributor.value?.status === 'active');
const isPending = computed(() => distributor.value?.status === 'pending');
const isDisabled = computed(() => distributor.value?.status === 'disabled');
const sharePath = computed(() => data.value?.sharePath || (distributor.value ? `pages/volunteer/index?ref=${distributor.value.code}` : ''));
const statusText = computed(() => {
  if (isActive.value) return '审核通过';
  if (isPending.value) return '待后台审核';
  if (isDisabled.value) return '未启用';
  return '-';
});
const pageTitle = computed(() => {
  if (!distributor.value) return '申请我的分享码';
  if (isPending.value) return '分享码申请审核中';
  if (isDisabled.value) return '分享码未启用';
  return levelName(distributor.value.level);
});
const pageSubtitle = computed(() => {
  if (!distributor.value) return '申请后进入后台审核，审核通过后即可生成专属分享码。';
  if (!isActive.value) return `分享码 ${distributor.value.code}，当前状态：${statusText.value}`;
  return `分享码 ${distributor.value.code}`;
});
const rateText = computed(() => {
  if (!distributor.value) return '-';
  if (distributor.value.level === 1) return `一级 ${setting.value.level1Percent || 0}%`;
  return `二级 ${setting.value.level2Percent || 0}%`;
});

async function loadAll() {
  if (!userStore.isLogin) {
    userStore.loginWithWechatProfile();
    return;
  }
  const res = await api.distribution.me();
  data.value = res.data;
  if (isActive.value) {
    await Promise.all([loadQrcode(false), loadCommissions()]);
  }
}

async function apply() {
  if (applying.value) return;
  applying.value = true;
  try {
    const res = await api.distribution.apply();
    data.value = res.data;
    uni.showToast({ title: '已提交审核', icon: 'success' });
  } catch (e: any) {
    uni.showToast({ title: e.message || '申请失败', icon: 'none' });
  } finally {
    applying.value = false;
  }
}

async function loadQrcode(showToast = false) {
  if (!distributor.value || !isActive.value || qrcodeLoading.value) return;
  qrcodeLoading.value = true;
  try {
    const res = await api.distribution.qrcode();
    qrcodeUrl.value = (res.data as any).dataUrl;
  } catch (e: any) {
    if (showToast) uni.showToast({ title: e.message || '小程序码生成失败', icon: 'none' });
  } finally {
    qrcodeLoading.value = false;
  }
}

async function loadCommissions() {
  if (!distributor.value || !isActive.value) return;
  const res = await api.distribution.commissions(1, 20);
  commissions.value = (res.data as any).list || [];
}

function copySharePath() {
  if (!sharePath.value) return;
  uni.setClipboardData({ data: sharePath.value });
}

function levelName(level: number) {
  return level === 1 ? '一级分享码' : '二级分享码';
}

function roleLabel(role: string) {
  if (role === 'level1_direct') return '一级直推奖励';
  if (role === 'level2_direct') return '二级直推奖励';
  if (role === 'level1_override') return '一级差额奖励';
  return '分享奖励';
}

function formatMoney(value: number) {
  return `¥${(Number(value || 0) / 100).toFixed(2)}`;
}

function formatDate(value: string) {
  return value ? value.slice(0, 10) : '';
}

onLoad(loadAll);

onPullDownRefresh(async () => {
  try {
    await loadAll();
  } finally {
    uni.stopPullDownRefresh();
  }
});

onShareAppMessage(() => ({
  title: '涨识 志愿分析',
  path: sharePath.value || 'pages/volunteer/index',
}));
</script>

<style lang="scss" scoped>
.distribution-page {
  min-height: 100vh;
  padding: 24rpx $spacing-md 56rpx;
  background: #f8fafc;
}

.summary-band {
  padding: 28rpx 26rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #f0fdfa 0%, #ffffff 58%, #fff7ed 100%);
  border: 1rpx solid rgba(15, 23, 42, 0.06);
}

.eyebrow,
.subtitle,
.stat-label,
.info-label,
.commission-sub,
.section-action {
  color: $text-tertiary;
  font-size: $font-xs;
}

.eyebrow {
  display: block;
  color: #0f766e;
  font-weight: 800;
  margin-bottom: 8rpx;
}

.title {
  display: block;
  color: $text-primary;
  font-size: 42rpx;
  font-weight: 900;
}

.subtitle {
  display: block;
  margin-top: 8rpx;
  line-height: 1.5;
}

.empty-card,
.status-card,
.info-card,
.qr-card,
.commission-card {
  margin-top: $spacing-md;
  padding: 26rpx;
  border-radius: 18rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  background: #fff;
}

.status-card.pending {
  border-color: rgba(214, 168, 92, 0.22);
  background: #fffaf0;
}

.status-card.disabled {
  border-color: rgba(148, 163, 184, 0.22);
  background: #f8fafc;
}

.empty-title {
  display: block;
  color: $text-primary;
  font-size: $font-lg;
  font-weight: 800;
}

.empty-desc {
  display: block;
  margin: 12rpx 0 24rpx;
  color: $text-secondary;
  font-size: $font-sm;
  line-height: 1.6;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: $spacing-md;
}

.stat-item {
  padding: 20rpx 12rpx;
  border-radius: 16rpx;
  background: #fff;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  text-align: center;
}

.stat-value {
  display: block;
  color: #0f766e;
  font-size: 34rpx;
  font-weight: 900;
}

.stat-label {
  display: block;
  margin-top: 6rpx;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid $border-light;

  &:last-child {
    border-bottom: 0;
  }
}

.info-value {
  color: $text-primary;
  font-size: $font-sm;
  font-weight: 700;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18rpx;
}

.section-title {
  color: $text-primary;
  font-size: $font-lg;
  font-weight: 800;
}

.section-action {
  color: #60723f;
  font-weight: 700;
}

.qr-box {
  width: 360rpx;
  height: 360rpx;
  margin: 0 auto;
  border-radius: 22rpx;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.qr-img {
  width: 100%;
  height: 100%;
}

.qr-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $text-tertiary;
  font-size: $font-sm;
}

.share-path {
  margin-top: 18rpx;
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  color: $text-secondary;
  font-size: $font-xs;
  word-break: break-all;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 18rpx;
}

.primary-btn,
.secondary-btn {
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 18rpx;
  text-align: center;
  font-size: $font-sm;
  font-weight: 800;
}

.primary-btn {
  background: #0f766e;
  color: #fff;
}

.primary-btn.disabled {
  opacity: 0.7;
}

.secondary-btn {
  background: #eef4e8;
  color: #60723f;
}

.button-reset {
  padding: 0;
  margin: 0;
}

.button-reset::after {
  border: 0;
}

.empty-list {
  padding: 28rpx 0;
  text-align: center;
  color: $text-tertiary;
  font-size: $font-sm;
}

.commission-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid $border-light;

  &:last-child {
    border-bottom: 0;
  }
}

.commission-title,
.commission-amount {
  display: block;
  color: $text-primary;
  font-size: $font-sm;
  font-weight: 800;
}

.commission-sub {
  display: block;
  margin-top: 6rpx;
}

.commission-amount {
  color: #0f766e;
}
</style>
