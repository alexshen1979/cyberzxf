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
      <view class="edit-btn" @click="openEditDialog">
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

    <!-- 编辑资料弹窗 -->
    <view class="modal-overlay" v-if="showEditDialog" @click="showEditDialog = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">编辑资料</text>
          <text class="modal-close" @click="showEditDialog = false">✕</text>
        </view>
        <view class="modal-body">
          <view class="form-item">
            <text class="form-label">昵称</text>
            <input class="form-input" v-model="editForm.nickname" placeholder="请输入昵称" :maxlength="20" />
          </view>
          <view class="form-item">
            <text class="form-label">手机号</text>
            <input class="form-input" v-model="editForm.phone" type="number" placeholder="请输入手机号（选填）" :maxlength="11" />
          </view>
        </view>
        <view class="modal-footer">
          <view class="modal-btn cancel" @click="showEditDialog = false"><text>取消</text></view>
          <view class="modal-btn confirm" @click="saveProfile"><text>保存</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

const showEditDialog = ref(false);
const editForm = reactive({ nickname: '', phone: '' });

const menuList = [
  { key: 'consult-records', icon: '💬', title: '咨询记录', action: () => goConsultHistory() },
  { key: 'orders', icon: '📋', title: '订单管理', action: () => uni.navigateTo({ url: '/pages/orders/index' }) },
  { key: 'points', icon: '⚡', title: '点数明细', action: () => uni.navigateTo({ url: '/pages/points/index' }) },
  { key: 'favorites', icon: '⭐', title: '我的收藏', action: () => uni.navigateTo({ url: '/pages/favorites/index' }) },
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
  userStore.showHistoryTab = true;
  uni.switchTab({ url: '/pages/consult/index' });
}

function openEditDialog() {
  const info = userStore.userInfo;
  editForm.nickname = info?.nickname || '';
  editForm.phone = info?.phone || '';
  showEditDialog.value = true;
}

async function saveProfile() {
  try {
    await userStore.updateProfile({
      nickname: editForm.nickname.trim(),
      phone: editForm.phone.trim(),
    });
    uni.showToast({ title: '保存成功', icon: 'success' });
    showEditDialog.value = false;
  } catch (e: any) {
    uni.showToast({ title: e.message || '保存失败', icon: 'error' });
  }
}
</script>

<style lang="scss" scoped>

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

// Modal overlay
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 999;
  @include flex-center;
}

.modal-content {
  width: 600rpx;
  background: $bg-card;
  border-radius: $radius-lg;
  border: 1rpx solid $border-color;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md;
  border-bottom: 1rpx solid $border-color;
}

.modal-title {
  font-size: $font-lg;
  font-weight: 600;
}

.modal-close {
  font-size: $font-lg;
  color: $text-dim;
  padding: $spacing-xs;
}

.modal-body {
  padding: $spacing-lg $spacing-md;
}

.form-item {
  margin-bottom: $spacing-md;
}

.form-label {
  font-size: $font-sm;
  color: $text-secondary;
  margin-bottom: $spacing-xs;
  display: block;
}

.form-input {
  background: $bg-input;
  border: 1rpx solid $border-color;
  border-radius: $radius-md;
  padding: $spacing-sm $spacing-md;
  font-size: $font-md;
  color: $text-primary;
  width: 100%;
  box-sizing: border-box;
}

.modal-footer {
  display: flex;
  border-top: 1rpx solid $border-color;
}

.modal-btn {
  flex: 1;
  text-align: center;
  padding: $spacing-md;
  font-size: $font-md;

  &.cancel {
    color: $text-secondary;
    border-right: 1rpx solid $border-color;
  }

  &.confirm {
    color: $primary;
    font-weight: 600;
  }
}
</style>
