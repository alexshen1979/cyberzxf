<template>
  <view class="distribution-page">
    <view class="summary-band">
      <text class="eyebrow">我的邀请码</text>
      <text class="title">{{ pageTitle }}</text>
      <text class="subtitle">{{ pageSubtitle }}</text>
    </view>

    <view class="qr-card">
      <view class="section-head">
        <text class="section-title">我的邀请码</text>
        <text class="section-action" @click="loadQrcode(true)">刷新</text>
      </view>
      <view class="qr-box">
        <image v-if="qrcodeUrl" class="qr-img" :src="qrcodeUrl" mode="aspectFit" />
        <canvas v-else-if="canvasQrVisible" canvas-id="inviteQrCanvas" class="qr-canvas" />
        <view v-else class="qr-placeholder" @click="loadQrcode(true)">
          <text>{{ qrcodeLoading ? '生成中...' : '点击生成分享二维码' }}</text>
        </view>
      </view>
      <view class="invite-code-box" @click="copyShareCode">
        <text class="invite-code-label">邀请码</text>
        <text class="invite-code-value">{{ shareCode || '正在生成...' }}</text>
        <text class="copy-code" @click.stop="copyShareCode">复制</text>
      </view>
      <view class="reward-tip">每天分享可领 {{ dailyShareRewardPoints }} 点；好友通过你的码注册，再赠送 {{ referralRewardPoints }} 点。</view>
      <view class="action-row">
        <view class="secondary-btn" @click="copyShareCode">复制邀请码</view>
        <button class="primary-btn button-reset" open-type="share">分享给朋友</button>
      </view>
    </view>

    <view class="stats-grid" :class="{ compact: !showCommissionStats }">
      <view class="stat-item">
        <text class="stat-value">{{ stats.shareReferralCount || 0 }}</text>
        <text class="stat-label">邀请注册</text>
      </view>
      <view class="stat-item">
        <text class="stat-value">{{ stats.shareRewardCount || 0 }}</text>
        <text class="stat-label">注册奖励</text>
      </view>
      <view class="stat-item" v-if="showCommissionStats">
        <text class="stat-value">{{ formatMoney(stats.commissionAmount || 0) }}</text>
        <text class="stat-label">奖励累计</text>
      </view>
    </view>

    <view class="bind-card">
      <view class="section-head">
        <text class="section-title">邀请我的人</text>
      </view>
      <view class="bound-row" v-if="shareReferral">
        <view class="bound-copy">
          <text class="bound-label">已绑定</text>
          <text class="bound-value">{{ inviterText }}</text>
        </view>
        <text class="copy-code" @click="copyBoundReferralCode">复制</text>
      </view>
      <view class="invite-input-row" v-else>
        <input class="invite-input" v-model="referralCodeInput" placeholder="输入对方邀请码" maxlength="32" />
        <view class="secondary-btn bind-btn" :class="{ disabled: bindingReferral }" @click="bindReferralCode">
          <text>{{ bindingReferral ? '绑定中' : '确认' }}</text>
        </view>
      </view>
    </view>

    <view class="info-card" v-if="showDistributionInfo">
      <view class="info-row">
        <text class="info-label">合作身份</text>
        <text class="info-value">{{ statusText }}</text>
      </view>
      <view class="info-row" v-if="distributor">
        <text class="info-label">身份类型</text>
        <text class="info-value">{{ levelName(distributor.level) }}</text>
      </view>
      <view class="info-row" v-if="distributor">
        <text class="info-label">合作伙伴</text>
        <text class="info-value">{{ distributor.level === 1 ? '无' : (distributor.parent?.name || '系统') }}</text>
      </view>
      <view class="info-row" v-if="distributor">
        <text class="info-label">奖励规则</text>
        <text class="info-value">{{ rateText }}</text>
      </view>
    </view>

    <view class="apply-section" v-if="canApplyDistribution">
      <view class="empty-card">
        <text class="empty-title">申请成为涨识推荐官</text>
        <text class="empty-desc">邀请码已可正常使用。申请通过后，通过你的邀请码带来的新用户首单才会按后台规则产生推荐奖励。</text>
        <view class="primary-btn" @click="apply" :class="{ disabled: applying }">
          <text>{{ applying ? '申请中...' : '申请推荐官身份' }}</text>
        </view>
      </view>
    </view>

    <view v-else>
      <view class="status-card pending" v-if="isPending">
        <text class="empty-title">申请已提交，等待后台审核</text>
        <text class="empty-desc">邀请码仍可正常追踪和领取每日分享点数；审核通过后，符合规则的首单才会产生推荐奖励。</text>
      </view>
      <view class="withdraw-card" v-if="isActive">
        <view class="section-head">
          <text class="section-title">奖励提现</text>
          <text class="section-action" @click="loadWithdrawals">刷新</text>
        </view>
        <view class="withdraw-grid">
          <view>
            <text class="withdraw-value">{{ formatMoney(stats.availableWithdrawalAmount || 0) }}</text>
            <text class="withdraw-label">可提现</text>
          </view>
          <view>
            <text class="withdraw-value">{{ formatMoney(stats.frozenCommissionAmount || 0) }}</text>
            <text class="withdraw-label">待结算</text>
          </view>
          <view>
            <text class="withdraw-value">{{ formatMoney(stats.lockedWithdrawalAmount || 0) }}</text>
            <text class="withdraw-label">提现中</text>
          </view>
          <view>
            <text class="withdraw-value">{{ formatMoney(stats.paidWithdrawalAmount || 0) }}</text>
            <text class="withdraw-label">已提现</text>
          </view>
        </view>
        <view class="withdraw-tip">最低 {{ formatMoney(stats.minWithdrawalAmount || 1000) }} 可申请；新奖励满 {{ stats.withdrawalFreezeDays ?? 7 }} 天后可提现。</view>
        <view class="withdraw-form">
          <input class="withdraw-input" v-model="withdrawAmountInput" type="digit" placeholder="输入提现金额" />
          <view class="primary-btn withdraw-btn" :class="{ disabled: withdrawing }" @click="applyWithdrawal">
            <text>{{ withdrawing ? '提交中' : '申请提现' }}</text>
          </view>
        </view>
        <view class="withdraw-actions">
          <text @click="fillAllWithdrawal">全部提现</text>
        </view>
        <view class="empty-list" v-if="withdrawals.length === 0">暂无提现记录</view>
        <view class="withdraw-item" v-for="item in withdrawals" :key="item.id">
          <view>
            <text class="commission-title">{{ withdrawalStatusLabel(item.status) }}</text>
            <text class="commission-sub">{{ item.withdrawalNo }} · {{ formatDate(item.requestedAt || item.createdAt) }}</text>
            <text class="commission-sub" v-if="item.adminRemark">{{ item.adminRemark }}</text>
          </view>
          <text class="commission-amount">{{ formatMoney(item.amount) }}</text>
        </view>
      </view>
      <view class="commission-card" v-if="isActive">
        <view class="section-head">
          <text class="section-title">推荐奖励</text>
          <text class="section-action" @click="loadCommissions">刷新</text>
        </view>
        <view class="empty-list" v-if="commissions.length === 0">暂无奖励记录</view>
        <view class="commission-item" v-for="item in commissions" :key="item.id">
          <view>
            <text class="commission-title">{{ roleLabel(item.role) }}</text>
            <text class="commission-sub">{{ commissionSourceText(item) }}</text>
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
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import QRCode from 'qrcode';
import { api } from '@/api';
import { useUserStore } from '@/store/user';
import { recordShare, withShareRef } from '@/utils/share';

const userStore = useUserStore();
const data = ref<any>(null);
const commissions = ref<any[]>([]);
const withdrawals = ref<any[]>([]);
const applying = ref(false);
const withdrawing = ref(false);
const qrcodeLoading = ref(false);
const qrcodeUrl = ref('');
const canvasQrVisible = ref(false);
const referralCodeInput = ref('');
const bindingReferral = ref(false);
const withdrawAmountInput = ref('');

const distributor = computed(() => data.value?.distributor || null);
const stats = computed(() => data.value?.stats || {});
const setting = computed(() => data.value?.setting || {});
const isActive = computed(() => distributor.value?.status === 'active');
const isPending = computed(() => distributor.value?.status === 'pending');
const isDisabled = computed(() => distributor.value?.status === 'disabled');
const isRejected = computed(() => distributor.value?.status === 'rejected');
const isBlocked = computed(() => isDisabled.value || isRejected.value);
const showDistributionInfo = computed(() => Boolean(distributor.value) && !isBlocked.value);
const showCommissionStats = computed(() => isActive.value);
const shareReferral = computed(() => data.value?.shareReferral || null);
const canApplyDistribution = computed(() => data.value?.canApply === true);
const shareCode = computed(() => data.value?.shareCode || userStore.userInfo?.shareCode || '');
const sharePath = computed(() => data.value?.sharePath || withShareRef('pages/volunteer/index'));
const dailyShareRewardPoints = computed(() => data.value?.dailyShareRewardPoints || 10);
const referralRewardPoints = computed(() => data.value?.referralRewardPoints || 20);
const inviterText = computed(() => {
  const referral = shareReferral.value;
  if (!referral) return '';
  const referrer = referral.referrer || {};
  return referrer.nickname || referrer.phone || referral.sourceCode || '已绑定邀请人';
});
const statusText = computed(() => {
  if (!distributor.value) return '未申请';
  if (isActive.value) return '审核通过';
  if (isPending.value) return '待后台审核';
  if (isRejected.value) return '已驳回';
  if (isDisabled.value) return '已禁用';
  return '-';
});
const pageTitle = computed(() => {
  if (!distributor.value) return '我的邀请码';
  if (isPending.value) return '邀请码已生成，推荐官审核中';
  if (isRejected.value) return '我的邀请码';
  if (isDisabled.value) return '我的邀请码';
  return `我的邀请码 · ${levelName(distributor.value.level)}`;
});
const pageSubtitle = computed(() => {
  if (isBlocked.value || !distributor.value) return `邀请码 ${shareCode.value || '--'}，每天分享可领点数，好友注册后还有奖励。`;
  if (!isActive.value) return `邀请码 ${shareCode.value || '--'} 可正常邀请注册；合作身份：${statusText.value}`;
  return `邀请码 ${shareCode.value || '--'}，合作身份已通过`;
});
const rateText = computed(() => {
  if (!distributor.value) return '-';
  if (distributor.value.level === 1) return `特邀合作奖励 ${setting.value.level1Percent || 0}%`;
  return `推荐奖励 ${setting.value.level2Percent || 0}%`;
});

async function loadAll() {
  if (!userStore.isLogin) {
    userStore.loginWithWechatProfile();
    return;
  }
  const res = await api.distribution.me();
  data.value = res.data;
  if (data.value?.shareCode) {
    userStore.userInfo = Object.assign({}, userStore.userInfo || {}, { shareCode: data.value.shareCode });
  }
  await loadQrcode(false);
  if (isActive.value) {
    await Promise.all([loadCommissions(), loadWithdrawals()]);
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
  if (qrcodeLoading.value) return;
  if (!userStore.isLogin) {
    userStore.loginWithWechatProfile();
    return;
  }
  qrcodeLoading.value = true;
  try {
    await ensureShareCode();
    try {
      const res = await api.distribution.qrcode();
      const payload = res.data as any;
      data.value = Object.assign({}, data.value || {}, {
        shareCode: payload.shareCode || data.value?.shareCode,
        sharePath: payload.sharePath || data.value?.sharePath,
      });
      syncUserShareCode(data.value?.shareCode);
      qrcodeUrl.value = await materializeImageDataUrl(payload.dataUrl);
      canvasQrVisible.value = false;
    } catch (error) {
      const localQrUrl = await generateLocalInviteQr();
      if (localQrUrl) {
        qrcodeUrl.value = localQrUrl;
        canvasQrVisible.value = false;
      }
    }
    recordShare('qrcode', sharePath.value);
  } catch (e: any) {
    if (showToast) uni.showToast({ title: e.message || '邀请码图片生成失败', icon: 'none' });
  } finally {
    qrcodeLoading.value = false;
  }
}

async function loadCommissions() {
  if (!distributor.value || !isActive.value) return;
  const res = await api.distribution.commissions(1, 20);
  commissions.value = (res.data as any).list || [];
}

async function loadWithdrawals() {
  if (!distributor.value || !isActive.value) return;
  const res = await api.distribution.withdrawals(1, 20);
  withdrawals.value = (res.data as any).list || [];
}

function fillAllWithdrawal() {
  const amount = Number(stats.value.availableWithdrawalAmount || 0);
  if (amount <= 0) {
    uni.showToast({ title: '暂无可提现奖励', icon: 'none' });
    return;
  }
  withdrawAmountInput.value = (amount / 100).toFixed(2);
}

async function applyWithdrawal() {
  if (withdrawing.value) return;
  const amount = Math.round(Number(withdrawAmountInput.value || 0) * 100);
  if (!Number.isFinite(amount) || amount <= 0) {
    uni.showToast({ title: '请输入提现金额', icon: 'none' });
    return;
  }
  if (amount < Number(stats.value.minWithdrawalAmount || 1000)) {
    uni.showToast({ title: `最低${formatMoney(stats.value.minWithdrawalAmount || 1000)}可提现`, icon: 'none' });
    return;
  }
  withdrawing.value = true;
  try {
    await api.distribution.applyWithdrawal(amount);
    withdrawAmountInput.value = '';
    uni.showToast({ title: '提现申请已提交', icon: 'success' });
    await loadAll();
  } catch (e: any) {
    uni.showToast({ title: e.message || '申请失败', icon: 'none' });
  } finally {
    withdrawing.value = false;
  }
}

async function copyShareCode() {
  try {
    await ensureShareCode();
    if (!shareCode.value) {
      uni.showToast({ title: '邀请码生成失败，请稍后重试', icon: 'none' });
      return;
    }
    uni.setClipboardData({ data: shareCode.value });
    recordShare('copy', sharePath.value);
  } catch (e: any) {
    uni.showToast({ title: e.message || '邀请码生成失败', icon: 'none' });
  }
}

function copyBoundReferralCode() {
  const code = shareReferral.value?.sourceCode;
  if (!code) return;
  uni.setClipboardData({ data: code });
}

async function bindReferralCode() {
  const code = referralCodeInput.value.trim().toUpperCase();
  if (!code) {
    uni.showToast({ title: '请输入邀请码', icon: 'none' });
    return;
  }
  if (code === String(shareCode.value || '').toUpperCase()) {
    uni.showToast({ title: '不能填写自己的邀请码', icon: 'none' });
    return;
  }
  if (bindingReferral.value) return;
  bindingReferral.value = true;
  try {
    await api.distribution.bindReferral(code);
    referralCodeInput.value = '';
    uni.showToast({ title: '已绑定邀请人', icon: 'success' });
    await loadAll();
  } catch (e: any) {
    uni.showToast({ title: e.message || '绑定失败', icon: 'none' });
  } finally {
    bindingReferral.value = false;
  }
}

async function ensureShareCode() {
  if (shareCode.value) return shareCode.value;
  const res = await api.distribution.me();
  data.value = res.data;
  syncUserShareCode(data.value?.shareCode);
  return shareCode.value;
}

function syncUserShareCode(code?: string) {
  if (!code) return;
  userStore.userInfo = Object.assign({}, userStore.userInfo || {}, { shareCode: code });
}

async function materializeImageDataUrl(dataUrl: string) {
  const raw = String(dataUrl || '');
  const match = raw.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return raw;

  return writePngDataUrlToTempFile(raw, `zhangshi-share-code-${shareCode.value || 'me'}.png`);
}

async function generateLocalInviteQr() {
  const code = await ensureShareCode();
  if (!code) throw new Error('邀请码生成失败，请稍后重试');
  const content = `zhangshi://invite?code=${encodeURIComponent(code)}&path=${encodeURIComponent(sharePath.value)}`;
  return drawInviteQrToTempFile(content, code);
}

function drawInviteQrToTempFile(content: string, code: string) {
  const qr = QRCode.create(content, {
    errorCorrectionLevel: 'M',
  });
  qrcodeUrl.value = '';
  canvasQrVisible.value = true;
  const modules = qr.modules;
  const matrixSize = modules.size;
  const canvasSize = 320;
  const margin = 18;
  const cellSize = Math.floor((canvasSize - margin * 2) / matrixSize);
  const qrSize = cellSize * matrixSize;
  const offset = Math.floor((canvasSize - qrSize) / 2);
  const ctx = uni.createCanvasContext('inviteQrCanvas');

  ctx.setFillStyle('#ffffff');
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  ctx.setFillStyle('#0f766e');
  for (let row = 0; row < matrixSize; row += 1) {
    for (let col = 0; col < matrixSize; col += 1) {
      if (modules.get(row, col)) {
        ctx.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize);
      }
    }
  }

  return new Promise<string>((resolve) => {
    ctx.draw(false, () => {
      uni.canvasToTempFilePath({
        canvasId: 'inviteQrCanvas',
        width: canvasSize,
        height: canvasSize,
        destWidth: canvasSize,
        destHeight: canvasSize,
        fileType: 'png',
        success: (res) => resolve(res.tempFilePath),
        fail: () => resolve(''),
      });
    });
  });
}

function writePngDataUrlToTempFile(dataUrl: string, filename: string) {
  const match = String(dataUrl || '').match(/^data:image\/png;base64,(.+)$/);
  if (!match) return Promise.resolve(dataUrl);
  const fs = (uni as any).getFileSystemManager?.();
  const root = (globalThis as any)?.wx?.env?.USER_DATA_PATH || (globalThis as any)?.uni?.env?.USER_DATA_PATH || '';
  if (!fs || !root) return Promise.resolve(dataUrl);

  return new Promise<string>((resolve) => {
    const filePath = `${root}/${filename}`;
    fs.writeFile({
      filePath,
      data: match[1],
      encoding: 'base64',
      success: () => resolve(filePath),
      fail: () => resolve(dataUrl),
    });
  });
}

function levelName(level: number) {
  return level === 1 ? '特邀合作伙伴' : '涨识推荐官';
}

function roleLabel(role: string) {
  if (role === 'level1_direct') return '直接推荐奖励';
  if (role === 'level2_direct') return '推荐奖励';
  if (role === 'level1_override') return '合作伙伴奖励';
  return '分享奖励';
}

function commissionSourceText(item: any) {
  const userName = item.referralUser?.nickname || item.referralUser?.phone || item.referralUserId || '用户';
  const orderAmount = formatMoney(item.order?.amount || 0);
  return `${userName} 充值 ${orderAmount}，产生推荐奖励`;
}

function withdrawalStatusLabel(status: string) {
  if (status === 'pending') return '待审核';
  if (status === 'approved') return '已通过，待打款';
  if (status === 'paid') return '已打款';
  if (status === 'rejected') return '已驳回';
  if (status === 'failed') return '打款失败';
  return status || '-';
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

onShareAppMessage(() => {
  const path = sharePath.value || withShareRef('pages/volunteer/index');
  recordShare('friend', path);
  return {
    title: '涨识 志愿分析',
    path,
  };
});

onShareTimeline(() => {
  const path = sharePath.value || withShareRef('pages/volunteer/index');
  recordShare('timeline', path);
  return {
    title: '涨识 志愿分析',
    query: path.split('?')[1] || '',
  };
});
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
.blocked-card,
.bind-card,
.info-card,
.qr-card,
.withdraw-card,
.commission-card {
  margin-top: $spacing-md;
  padding: 26rpx;
  border-radius: 18rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  background: #fff;
}

.blocked-card {
  border-color: rgba(220, 38, 38, 0.14);
  background: #fff7f7;
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

  &.compact {
    grid-template-columns: repeat(2, 1fr);
  }
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

.withdraw-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.withdraw-grid > view {
  padding: 18rpx 10rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  text-align: center;
}

.withdraw-value {
  display: block;
  color: #0f766e;
  font-size: 30rpx;
  font-weight: 900;
}

.withdraw-label,
.withdraw-tip,
.withdraw-actions {
  color: $text-tertiary;
  font-size: $font-xs;
}

.withdraw-label {
  display: block;
  margin-top: 6rpx;
}

.withdraw-tip {
  margin-top: 14rpx;
  line-height: 1.5;
}

.withdraw-form {
  display: grid;
  grid-template-columns: 1fr 180rpx;
  gap: 12rpx;
  margin-top: 18rpx;
  align-items: center;
}

.withdraw-input {
  height: 76rpx;
  padding: 0 20rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  color: $text-primary;
  font-size: $font-sm;
  box-sizing: border-box;
}

.withdraw-btn {
  height: 76rpx;
  line-height: 76rpx;
}

.withdraw-actions {
  margin-top: 12rpx;
  text-align: right;
  color: #0f766e;
  font-weight: 800;
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

.qr-canvas {
  width: 320px;
  height: 320px;
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

.invite-code-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.invite-code-label {
  color: $text-tertiary;
  font-size: $font-xs;
}

.invite-code-value {
  flex: 1;
  text-align: center;
  color: #0f766e;
  font-size: 28rpx;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-code {
  padding: 6rpx 12rpx;
  border-radius: $radius-full;
  background: #ecfdf5;
  color: #047857;
  font-size: 22rpx;
  font-weight: 800;
}

.reward-tip {
  margin-top: 14rpx;
  color: #b45309;
  font-size: $font-xs;
  line-height: 1.5;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 18rpx;
}

.invite-input-row {
  display: grid;
  grid-template-columns: 1fr 150rpx;
  gap: 12rpx;
  align-items: center;
}

.invite-input {
  height: 76rpx;
  padding: 0 20rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  color: $text-primary;
  font-size: $font-sm;
  box-sizing: border-box;
}

.bind-btn {
  height: 76rpx;
  line-height: 76rpx;
}

.bound-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 18rpx 20rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.bound-copy {
  min-width: 0;
}

.bound-label {
  display: block;
  color: $text-tertiary;
  font-size: $font-xs;
}

.bound-value {
  display: block;
  margin-top: 4rpx;
  color: $text-primary;
  font-size: $font-sm;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.withdraw-item,
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
