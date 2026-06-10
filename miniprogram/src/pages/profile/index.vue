<template>
  <view class="profile-page">
    <view class="account-card">
      <view class="account-row">
        <view class="user-avatar">
          <image v-if="userStore.userInfo?.avatar" class="avatar-img" :src="userStore.userInfo.avatar" mode="aspectFill" />
          <text v-else>{{ (userStore.userInfo?.nickname || '张').charAt(0) }}</text>
        </view>
        <view class="user-info">
          <text class="user-name">{{ userStore.userInfo?.nickname || '未登录' }}</text>
          <text class="user-id">{{ profileSubtitle }}</text>
        </view>
        <view class="edit-btn" @click="openEditDialog">
          <text>{{ userStore.isLogin ? '资料' : '登录' }}</text>
        </view>
      </view>

      <view class="account-metrics">
        <view class="metric-block" @click="goPoints">
          <text class="metric-label">{{ pointsLabel }}</text>
          <text class="metric-value">{{ pointsValue }}</text>
        </view>
        <view class="metric-action" @click.stop="goRecharge">
          <text class="metric-action-main">{{ pointsActionText }}</text>
          <text class="metric-action-sub">{{ pointsActionSub }}</text>
        </view>
      </view>
    </view>

    <view class="share-card" @click="goDistribution">
      <view class="share-icon">
        <CategoryIcon name="Connection" color="#0f766e" bg="#ccfbf1" />
      </view>
      <view class="share-copy">
        <text class="share-kicker">邀请入口</text>
        <text class="share-title">我的邀请码</text>
        <text class="share-desc">登录即有专属邀请码，每天分享可领点数。</text>
      </view>
      <text class="menu-arrow">›</text>
    </view>

    <view class="menu-section">
      <view class="section-head">
        <text>常用功能</text>
      </view>
      <view class="menu-item" v-for="item in menuList" :key="item.key" @click="item.action">
        <CategoryIcon :name="item.icon" :color="item.color" :bg="item.bg" />
        <view class="menu-copy">
          <text class="menu-title">{{ item.title }}</text>
          <text class="menu-desc">{{ item.desc }}</text>
        </view>
        <button v-if="item.key === 'customer-service'" class="contact-cover" open-type="contact"></button>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="menu-section">
      <view class="section-head">
        <text>协议与规则</text>
      </view>
      <view class="menu-item" v-for="item in legalList" :key="item.key" @click="item.action">
        <CategoryIcon :name="item.icon" :color="item.color" :bg="item.bg" />
        <view class="menu-copy">
          <text class="menu-title">{{ item.title }}</text>
          <text class="menu-desc">{{ item.desc }}</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="logout-btn" v-if="userStore.isLogin" @click="userStore.logout">
      <text>退出登录</text>
    </view>

    <view class="version-text">
      <text>涨识 v{{ appVersion }}</text>
    </view>

    <!-- 编辑资料弹窗 -->
    <view class="modal-overlay" v-if="showEditDialog" @click="showEditDialog = false">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">编辑资料</text>
          <text class="modal-close" @click="showEditDialog = false">✕</text>
        </view>
        <view class="modal-body">
          <view class="avatar-editor">
            <image v-if="editForm.avatar" class="edit-avatar-img" :src="editForm.avatar" mode="aspectFill" />
            <view v-else class="edit-avatar-placeholder">{{ (editForm.nickname || '张').charAt(0) }}</view>
            <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">更换头像</button>
          </view>
          <view class="form-item">
            <text class="form-label">昵称</text>
            <input class="form-input" v-model="editForm.nickname" placeholder="请输入昵称" :maxlength="20" />
          </view>
          <view class="form-item">
            <text class="form-label">手机号</text>
            <view class="readonly-input">
              <text>{{ maskPhone(editForm.phone) || '未绑定' }}</text>
            </view>
            <text class="form-hint">手机号来自微信授权，用于账号识别，不支持手动修改。</text>
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
import { computed, ref, reactive } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/api';
import { useUserStore } from '@/store/user';
import CategoryIcon from '@/components/CategoryIcon.vue';
import pkg from '../../../package.json';

const userStore = useUserStore();

const showEditDialog = ref(false);
const editForm = reactive({ nickname: '', phone: '', avatar: '' });
const pendingAvatarPath = ref('');
const publicFreeGift = ref(100);
const appVersion = pkg.version;

const profileSubtitle = computed(() => {
  if (!userStore.isLogin) return `登录领取 ${publicFreeGift.value} 点体验额度`;
  const shortId = (userStore.userInfo?.id || '').slice(0, 8);
  return shortId ? `ID: ${shortId}` : 'ID: --';
});
const pointsLabel = computed(() => userStore.isLogin ? '咨询点数' : '新用户福利');
const pointsValue = computed(() => userStore.isLogin ? `${userStore.pointsBalance} 点` : `登录即送 ${publicFreeGift.value} 点`);
const pointsActionText = computed(() => userStore.isLogin ? '充值' : '登录领取');
const pointsActionSub = computed(() => userStore.isLogin ? '查看套餐' : '立即体验');

const menuList = [
  { key: 'volunteer-records', icon: 'School', color: '#0f766e', bg: '#ecfdf5', title: '志愿分析方案记录', desc: '查看已生成的冲稳保方案', action: () => goVolunteerReports() },
  { key: 'consult-records', icon: 'Clock', color: '#7c3aed', bg: '#f5f3ff', title: '咨询记录', desc: '查看 AI 追问历史', action: () => goConsultHistory() },
  { key: 'orders', icon: 'Notebook', color: '#2563eb', bg: '#eff6ff', title: '订单管理', desc: '充值订单和支付状态', action: () => uni.navigateTo({ url: '/pages/orders/index' }) },
  { key: 'points', icon: 'DataLine', color: '#059669', bg: '#ecfdf5', title: '点数明细', desc: '余额变化与消费记录', action: () => uni.navigateTo({ url: '/pages/points/index' }) },
  { key: 'favorites', icon: 'Star', color: '#d97706', bg: '#fff7ed', title: '我的收藏', desc: '保存院校、专业和资料', action: () => uni.navigateTo({ url: '/pages/favorites/index' }) },
  { key: 'customer-service', icon: 'Briefcase', color: '#475569', bg: '#f1f5f9', title: '联系客服', desc: '订单、账号和使用问题', action: () => {} },
];

const legalList = [
  { key: 'user-agreement', icon: 'Reading', color: '#475569', bg: '#f8fafc', title: '用户协议', desc: '服务使用说明', action: () => uni.navigateTo({ url: '/pages/agreement/index?type=user' }) },
  { key: 'privacy', icon: 'View', color: '#475569', bg: '#f8fafc', title: '隐私政策', desc: '信息收集与保护', action: () => uni.navigateTo({ url: '/pages/agreement/index?type=privacy' }) },
  { key: 'points-rule', icon: 'Medal', color: '#475569', bg: '#f8fafc', title: '点数规则', desc: '赠送、扣除和有效期', action: () => uni.navigateTo({ url: '/pages/agreement/index?type=points' }) },
  { key: 'minor-tips', icon: 'Aim', color: '#475569', bg: '#f8fafc', title: '未成年人提示', desc: '理性使用与监护提醒', action: () => uni.navigateTo({ url: '/pages/agreement/index?type=minor' }) },
];

function goPoints() {
  if (!userStore.isLogin) {
    userStore.loginWithWechatProfile();
    return;
  }
  uni.navigateTo({ url: '/pages/points/index' });
}

function goRecharge() {
  if (!userStore.isLogin) {
    userStore.loginWithWechatProfile();
    return;
  }
  uni.navigateTo({ url: '/pages/recharge/index' });
}

function goConsultHistory() {
  userStore.showHistoryTab = true;
  uni.switchTab({ url: '/pages/consult/index' });
}

function goVolunteerReports() {
  if (!userStore.isLogin) {
    userStore.loginWithWechatProfile();
    return;
  }
  uni.switchTab({ url: '/pages/volunteer/index' });
}

function goDistribution() {
  if (!userStore.isLogin) {
    userStore.loginWithWechatProfile();
    return;
  }
  uni.navigateTo({ url: '/pages/distribution/index' });
}

function openEditDialog() {
  if (!userStore.isLogin) {
    userStore.loginWithWechatProfile();
    return;
  }
  const info = userStore.userInfo;
  editForm.nickname = info?.nickname || '';
  editForm.phone = info?.phone || '';
  editForm.avatar = info?.avatar || '';
  pendingAvatarPath.value = '';
  showEditDialog.value = true;
}

async function saveProfile() {
  try {
    let avatar = editForm.avatar;
    if (pendingAvatarPath.value) {
      uni.showLoading({ title: '上传头像...', mask: true });
      const dataUrl = await readImageAsDataUrl(pendingAvatarPath.value);
      const uploadRes = await api.auth.uploadAvatar(dataUrl) as any;
      avatar = uploadRes.data.avatar;
      editForm.avatar = avatar;
      pendingAvatarPath.value = '';
      userStore.userInfo = Object.assign({}, userStore.userInfo, uploadRes.data.user);
      uni.hideLoading();
    }
    const payload: Record<string, any> = {
      nickname: editForm.nickname.trim(),
    };
    if (!isTemporaryAvatar(avatar)) payload.avatar = avatar;
    await userStore.updateProfile(payload);
    uni.showToast({ title: '保存成功', icon: 'success' });
    showEditDialog.value = false;
  } catch (e: any) {
    uni.hideLoading();
    uni.showToast({ title: e.message || '保存失败', icon: 'error' });
  }
}

function onChooseAvatar(event: any) {
  const avatarUrl = event?.detail?.avatarUrl || '';
  if (!avatarUrl) return;
  editForm.avatar = avatarUrl;
  pendingAvatarPath.value = avatarUrl;
}

function readImageAsDataUrl(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fs = (uni as any).getFileSystemManager?.();
    if (!fs) {
      reject(new Error('当前环境不支持读取头像文件'));
      return;
    }
    fs.readFile({
      filePath,
      encoding: 'base64',
      success: (res: any) => {
        const mime = avatarMimeFromPath(filePath);
        resolve(`data:${mime};base64,${res.data}`);
      },
      fail: (err: any) => reject(new Error(err?.errMsg || '头像读取失败')),
    });
  });
}

function avatarMimeFromPath(filePath: string) {
  const lower = String(filePath || '').toLowerCase();
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.png')) return 'image/png';
  return 'image/jpeg';
}

function isTemporaryAvatar(value: string) {
  return /^(wxfile|http:\/\/tmp|https?:\/\/tmp|file):/i.test(String(value || ''));
}

function maskPhone(phone?: string) {
  if (!phone) return '';
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

async function loadPublicConfig() {
  try {
    const res = await api.config.getPublic();
    const freeGift = Number(res.data?.freeGift);
    if (Number.isFinite(freeGift) && freeGift >= 0) {
      publicFreeGift.value = Math.trunc(freeGift);
    }
  } catch {
    // 保留默认值，避免未登录个人中心出现空文案。
  }
}

onShow(() => {
  loadPublicConfig();
});

onPullDownRefresh(async () => {
  try {
    await Promise.all([loadPublicConfig(), userStore.restoreSession(), userStore.fetchBalance()]);
  } finally {
    uni.stopPullDownRefresh();
  }
});
</script>

<style lang="scss" scoped>

.profile-page {
  min-height: 100vh;
  padding: 24rpx $spacing-md 56rpx;
  background: linear-gradient(180deg, #f8fffb 0%, #f8fafc 48%, #fff7fb 100%);
}

.account-card {
  padding: 28rpx;
  border-radius: 24rpx;
  background: #ffffff;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 16rpx 34rpx rgba(15, 23, 42, 0.05);
}

.account-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.user-avatar {
  width: 108rpx;
  height: 108rpx;
  border-radius: 30rpx;
  background: linear-gradient(135deg, #ecfdf5 0%, #eef2ff 100%);
  @include flex-center;
  font-size: 46rpx;
  overflow: hidden;
  color: #0f766e;
  font-weight: 900;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  display: block;
  color: $text-primary;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.25;
  @include text-ellipsis;
}

.user-id {
  display: block;
  font-size: $font-xs;
  color: $text-dim;
  margin-top: 4rpx;
  line-height: 1.45;
}

.edit-btn {
  flex-shrink: 0;
  min-width: 92rpx;
  height: 54rpx;
  line-height: 54rpx;
  padding: 0 18rpx;
  box-sizing: border-box;
  border: 1rpx solid rgba(15, 118, 110, 0.18);
  border-radius: 14rpx;
  background: #f0fdfa;
  font-size: $font-xs;
  color: #0f766e;
  font-weight: 800;
  text-align: center;
}

.account-metrics {
  display: flex;
  gap: 16rpx;
  margin-top: 28rpx;
}

.metric-block,
.metric-action {
  min-width: 0;
  border-radius: 18rpx;
}

.metric-block {
  flex: 1;
  padding: 20rpx;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
}

.metric-action {
  width: 188rpx;
  padding: 18rpx 16rpx;
  background: linear-gradient(135deg, #0f766e 0%, #7c3aed 100%);
  color: #fff;
  box-shadow: 0 12rpx 22rpx rgba(15, 118, 110, 0.12);
}

.metric-label,
.metric-action-sub {
  display: block;
  font-size: 22rpx;
  line-height: 1.3;
}

.metric-label {
  color: $text-tertiary;
}

.metric-value {
  display: block;
  margin-top: 8rpx;
  color: $text-primary;
  font-size: 38rpx;
  line-height: 1.15;
  font-weight: 900;
}

.metric-action-main {
  display: block;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.25;
}

.metric-action-sub {
  margin-top: 6rpx;
  opacity: 0.78;
}

.share-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: $spacing-md;
  padding: 24rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #ecfdf5 0%, #ffffff 60%, #fff7ed 100%);
  border: 1rpx solid rgba(15, 118, 110, 0.12);
}

.share-icon {
  flex-shrink: 0;
}

.share-copy {
  flex: 1;
  min-width: 0;
}

.share-kicker {
  display: block;
  color: #0f766e;
  font-size: 22rpx;
  font-weight: 800;
}

.share-title {
  display: block;
  margin-top: 4rpx;
  color: $text-primary;
  font-size: 31rpx;
  font-weight: 900;
}

.share-desc {
  display: block;
  margin-top: 6rpx;
  color: $text-secondary;
  font-size: 23rpx;
  line-height: 1.45;
}

.section-head {
  padding: 18rpx 22rpx 10rpx;
  color: $text-tertiary;
  font-size: 22rpx;
  font-weight: 800;
}

.menu-section {
  margin-top: $spacing-md;
  background: $bg-card;
  border-radius: 22rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  overflow: hidden;
  box-shadow: 0 8rpx 22rpx rgba(15, 23, 42, 0.035);
}

.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 20rpx 22rpx;
  border-bottom: 1rpx solid $border-light;

  &:last-child {
    border-bottom: none;
  }
}

.contact-cover {
  position: absolute;
  inset: 0;
  opacity: 0;
  z-index: 2;
}

.contact-cover::after {
  border: 0;
}

.menu-copy {
  flex: 1;
  min-width: 0;
}

.menu-title {
  display: block;
  color: $text-primary;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.3;
}

.menu-desc {
  display: block;
  margin-top: 4rpx;
  color: $text-tertiary;
  font-size: 22rpx;
  line-height: 1.35;
}

.menu-arrow {
  flex-shrink: 0;
  font-size: 40rpx;
  color: $text-dim;
  line-height: 1;
}

.logout-btn {
  margin-top: $spacing-xl;
  padding: 22rpx;
  text-align: center;
  background: $bg-card;
  border: 1rpx solid rgba(239, 68, 68, 0.14);
  border-radius: 18rpx;
  font-size: $font-md;
  color: $danger;
  font-weight: 800;
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
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.modal-content {
  width: 100%;
  max-height: 76vh;
  background: $bg-card;
  border-radius: 28rpx 28rpx 0 0;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom);
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

.avatar-editor {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  margin-bottom: $spacing-lg;
}

.edit-avatar-img,
.edit-avatar-placeholder {
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  overflow: hidden;
}

.edit-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ecfdf5;
  color: #0f766e;
  font-size: 42rpx;
  font-weight: 800;
}

.avatar-btn {
  margin: 0;
  height: 68rpx;
  line-height: 68rpx;
  padding: 0 24rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  color: $text-secondary;
  font-size: $font-sm;
}

.avatar-btn::after {
  border: 0;
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
  height: 84rpx;
  box-sizing: border-box;
}

.readonly-input {
  display: flex;
  align-items: center;
  min-height: 84rpx;
  background: $bg-secondary;
  border: 1rpx solid $border-color;
  border-radius: $radius-md;
  padding: 0 $spacing-md;
  font-size: $font-md;
  color: $text-secondary;
  box-sizing: border-box;
}

.form-hint {
  display: block;
  margin-top: 8rpx;
  font-size: $font-xs;
  color: $text-dim;
  line-height: 1.4;
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
