<template>
  <view class="profile-page">
    <!-- 用户信息卡片 -->
    <view class="user-card glow-card">
      <view class="user-avatar">
        <text>👤</text>
      </view>
      <view class="user-info">
        <text class="user-name">{{ userStore.userInfo?.nickname || '未登录' }}</text>
        <text class="user-id">ID: {{ (userStore.userInfo?.id || '').slice(0, 8) }}</text>
      </view>
      <view class="edit-btn" @click="editProfile">
        <text>编辑</text>
      </view>
    </view>

    <!-- 点数余额 -->
    <view class="points-card card" @click="goPoints">
      <view class="points-info">
        <text class="points-label">咨询点数</text>
        <text class="points-value">{{ userStore.pointsBalance }} 点</text>
      </view>
      <view class="points-actions">
        <text class="points-recharge-btn" @click.stop="goRecharge">充值</text>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-section">
      <view class="menu-item" v-for="item in menuList" :key="item.key" @click="item.action">
        <text class="menu-icon">{{ item.icon }}</text>
        <text class="menu-title">{{ item.title }}</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 合规页面 -->
    <view class="menu-section">
      <view class="menu-item" v-for="item in legalList" :key="item.key" @click="item.action">
        <text class="menu-icon">📄</text>
        <text class="menu-title">{{ item.title }}</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="logout-btn" @click="userStore.logout">
      <text>退出登录</text>
    </view>

    <view class="version-text">
      <text>赛博张老师 v1.0.0</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

const menuList = [
  { key: 'consult-records', icon: '💬', title: '咨询记录', action: () => goConsultHistory() },
  { key: 'orders', icon: '📋', title: '订单管理', action: () => uni.navigateTo({ url: '/pages/orders/index' }) },
  { key: 'points', icon: '⚡', title: '点数明细', action: () => uni.navigateTo({ url: '/pages/points/index' }) },
  { key: 'favorites', icon: '⭐', title: '我的收藏', action: () => uni.showToast({ title: '功能开发中', icon: 'none' }) },
  { key: 'customer-service', icon: '🎧', title: '联系客服', action: () => uni.showToast({ title: '客服功能接入中', icon: 'none' }) },
];

const legalList = [
  { key: 'user-agreement', title: '用户协议', action: () => uni.navigateTo({ url: '/pages/agreement/index?type=user' }) },
  { key: 'privacy', title: '隐私政策', action: () => uni.navigateTo({ url: '/pages/agreement/index?type=privacy' }) },
  { key: 'points-rule', title: '点数规则', action: () => uni.navigateTo({ url: '/pages/agreement/index?type=points' }) },
  { key: 'minor-tips', title: '未成年人提示', action: () => uni.navigateTo({ url: '/pages/agreement/index?type=minor' }) },
];

function goPoints() {
  uni.navigateTo({ url: '/pages/points/index' });
}

function goRecharge() {
  uni.navigateTo({ url: '/pages/recharge/index' });
}

function goConsultHistory() {
  uni.navigateTo({ url: '/pages/consult/index?tab=history' });
}

function editProfile() {
  uni.showToast({ title: '功能开发中', icon: 'none' });
}
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.profile-page {
  padding: $spacing-md;
  min-height: 100vh;
}

.user-card {
  display: flex;
  align-items: center;
  padding: $spacing-lg $spacing-md;
  margin: 0;
}

.user-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: $bg-secondary;
  @include flex-center;
  font-size: 48rpx;
}

.user-info {
  flex: 1;
  margin-left: $spacing-md;
}

.user-name {
  font-size: $font-lg;
  font-weight: 600;
  display: block;
}

.user-id {
  font-size: $font-xs;
  color: $text-dim;
  margin-top: 4rpx;
}

.edit-btn {
  padding: $spacing-xs $spacing-md;
  border: 1rpx solid $border-color;
  border-radius: $radius-lg;
  font-size: $font-xs;
  color: $text-secondary;
}

.points-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  margin-top: $spacing-sm;
}

.points-label {
  font-size: $font-sm;
  color: $text-secondary;
  display: block;
}

.points-value {
  font-size: $font-xl;
  font-weight: 700;
  color: $primary;
  display: block;
  margin-top: 4rpx;
}

.points-actions {
  display: flex;
  gap: $spacing-sm;
}

.points-recharge-btn {
  @include gradient-btn;
  padding: $spacing-xs $spacing-md;
  border-radius: $radius-lg;
  font-size: $font-sm;
}

.menu-section {
  margin-top: $spacing-md;
  background: $bg-card;
  border-radius: $radius-md;
  border: 1rpx solid $border-color;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;

  &:last-child {
    border-bottom: none;
  }
}

.menu-icon {
  font-size: $font-lg;
  margin-right: $spacing-sm;
}

.menu-title {
  flex: 1;
  font-size: $font-md;
}

.menu-arrow {
  font-size: $font-lg;
  color: $text-dim;
}

.logout-btn {
  margin-top: $spacing-xl;
  padding: $spacing-md;
  text-align: center;
  background: $bg-card;
  border: 1rpx solid $border-color;
  border-radius: $radius-md;
  font-size: $font-md;
  color: $danger;
}

.version-text {
  margin-top: $spacing-lg;
  text-align: center;
  font-size: $font-xs;
  color: $text-dim;
}
</style>
