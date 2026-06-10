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
        <text class="section-action" :class="{ disabled: qrcodeLoading || qrcodeSaving }" @click="saveInviteQrcode">
          {{ qrcodeActionText }}
        </text>
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
      <view class="reward-tip">{{ rewardTipText }}</view>
      <view class="action-row">
        <view class="secondary-btn" @click="copyShareCode">复制邀请码</view>
        <button class="primary-btn button-reset" open-type="share">分享给朋友</button>
      </view>
    </view>

    <view class="stats-grid" :class="{ compact: !showCommissionStats, four: showRegistrationRewardStats }">
      <view class="stat-item">
        <text class="stat-value">{{ stats.shareReferralCount || 0 }}</text>
        <text class="stat-label">邀请注册</text>
      </view>
      <view class="stat-item">
        <text class="stat-value">{{ stats.shareRewardCount || 0 }}</text>
        <text class="stat-label">注册奖励</text>
      </view>
      <view class="stat-item" v-if="showCommissionStats">
        <text class="stat-value">{{ formatMoney(stats.rechargeCommissionAmount || 0) }}</text>
        <text class="stat-label">充值提成</text>
      </view>
      <view class="stat-item" v-if="showRegistrationRewardStats">
        <text class="stat-value">{{ formatMoney(stats.registrationRewardAmount || 0) }}</text>
        <text class="stat-label">注册现金奖励</text>
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
        <text class="empty-desc">邀请码已可正常使用。申请通过后，通过你的邀请码带来的新用户充值会按后台规则产生推荐奖励。</text>
        <view class="primary-btn" @click="apply" :class="{ disabled: applying }">
          <text>{{ applying ? '申请中...' : '申请推荐官身份' }}</text>
        </view>
      </view>
    </view>

    <view v-else>
      <view class="status-card pending" v-if="isPending">
        <text class="empty-title">申请已提交，等待后台审核</text>
        <text class="empty-desc">邀请码仍可正常追踪和领取每日分享点数；审核通过后，符合规则的充值才会产生推荐奖励。</text>
      </view>
      <view class="withdraw-card" v-if="isActive">
        <view class="section-head">
          <text class="section-title">奖励提现</text>
          <text class="section-action" @click="withdrawRuleVisible = true">查看说明</text>
        </view>
        <view class="withdraw-grid">
          <view>
            <text class="withdraw-value">{{ formatMoney(stats.availableWithdrawalAmount || 0) }}</text>
            <text class="withdraw-label">可提现</text>
            <text class="withdraw-source">{{ deviceBreakdownText(stats.availableDeviceBreakdown) }}</text>
          </view>
          <view>
            <text class="withdraw-value">{{ formatMoney(stats.frozenCommissionAmount || 0) }}</text>
            <text class="withdraw-label">待结算</text>
            <text class="withdraw-source">{{ pendingDeviceBreakdownText }}</text>
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
            <text class="commission-sub" v-if="item.transferState">微信状态：{{ item.transferState }}</text>
            <text class="commission-sub" v-if="item.adminRemark">{{ item.adminRemark }}</text>
          </view>
          <view class="withdraw-right">
            <text class="commission-amount">{{ formatMoney(item.amount) }}</text>
            <view class="mini-btn" v-if="item.status === 'wait_user_confirm'" @click="confirmMerchantTransfer(item)">确认收款</view>
            <view class="mini-btn ghost" v-if="item.outBillNo" @click="syncTransfer(item)">刷新</view>
          </view>
        </view>
      </view>
      <view class="rule-modal-mask" v-if="withdrawRuleVisible" @click="withdrawRuleVisible = false">
        <view class="rule-modal" @click.stop>
          <view class="rule-modal-head">
            <text>奖励提现说明</text>
            <text class="rule-modal-close" @click="withdrawRuleVisible = false">关闭</text>
          </view>
          <view class="rule-row">
            <text class="rule-label">提现门槛</text>
            <text class="rule-text">最低 {{ formatMoney(stats.minWithdrawalAmount || 1000) }} 可申请；安卓/鸿蒙奖励满 {{ stats.withdrawalFreezeDays ?? 7 }} 天后可提现。</text>
          </view>
          <view class="rule-row">
            <text class="rule-label">苹果结算</text>
            <text class="rule-text">根据 Apple 规定，iPhone 充值经 Apple IAP 结算，通常在自然月结束后 45-60 天内结算给腾讯，再划转至开发者虚拟支付账户。Apple 充值产生的奖励请按苹果结算周期耐心等待，到账后会进入可提现金额。</text>
          </view>
          <view class="rule-row">
            <text class="rule-label">确认收款</text>
            <text class="rule-text">根据微信规定，提现审核通过并发起微信转账后，需要回到本页面点击“确认收款”，完成后进入微信零钱。</text>
          </view>
          <view class="rule-row" v-if="transferRuleText">
            <text class="rule-label">转账规则</text>
            <text class="rule-text">{{ transferRuleText }}</text>
          </view>
        </view>
      </view>
      <view class="commission-card" v-if="showRegistrationRewardStats">
        <view class="section-head">
          <text class="section-title">邀请注册现金奖励</text>
          <text class="section-action" @click="loadRegistrationRewards">刷新</text>
        </view>
        <view class="registration-reward-summary">
          <view>
            <text class="summary-label">每邀请 1 人注册</text>
            <text class="summary-value">{{ formatMoney(registrationRewardUnitAmount) }}</text>
          </view>
          <view>
            <text class="summary-label">已获得</text>
            <text class="summary-value">{{ formatMoney(stats.registrationRewardAmount || 0) }}</text>
          </view>
        </view>
        <view class="empty-list" v-if="registrationRewards.length === 0">暂无邀请注册现金奖励</view>
        <view class="commission-item" v-for="item in registrationRewards" :key="item.id">
          <view>
            <text class="commission-title">邀请注册奖励</text>
            <text class="commission-sub">{{ registrationRewardSourceText(item) }}</text>
            <text class="commission-sub">邀请码 {{ item.shareReferral?.sourceCode || shareCode || '--' }} · {{ formatDate(item.createdAt) }}</text>
          </view>
          <text class="commission-amount">{{ formatMoney(item.amount) }}</text>
        </view>
      </view>
      <view class="commission-card" v-if="isActive">
        <view class="section-head">
          <text class="section-title">充值提成</text>
          <text class="section-action" @click="loadCommissions">刷新</text>
        </view>
        <view class="empty-list" v-if="commissions.length === 0">暂无充值提成记录</view>
        <view class="commission-item" v-for="item in commissions" :key="item.id">
          <view>
            <text class="commission-title">{{ roleLabel(item.role) }}</text>
            <text class="commission-sub">{{ commissionSourceText(item) }}</text>
            <text class="commission-sub">{{ item.order?.productName || '充值订单' }} · {{ paymentDeviceLabel(item.order?.paymentDevice) }} · {{ formatDate(item.createdAt) }}</text>
          </view>
          <text class="commission-amount">{{ formatMoney(item.amount) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { onLoad, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import QRCode from 'qrcode';
import { api } from '@/api';
import { useUserStore } from '@/store/user';
import { recordShare, withShareRef } from '@/utils/share';

declare const wx: any;

const userStore = useUserStore();
const data = ref<any>(null);
const commissions = ref<any[]>([]);
const registrationRewards = ref<any[]>([]);
const withdrawals = ref<any[]>([]);
const applying = ref(false);
const withdrawing = ref(false);
const qrcodeLoading = ref(false);
const qrcodeSaving = ref(false);
const qrcodeUrl = ref('');
const canvasQrVisible = ref(false);
const referralCodeInput = ref('');
const bindingReferral = ref(false);
const withdrawAmountInput = ref('');
const withdrawRuleVisible = ref(false);

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
const showRegistrationRewardStats = computed(() => (
  isActive.value
  && Number(distributor.value?.level) === 2
  && distributor.value?.registrationCashRewardEnabled === true
));
const shareReferral = computed(() => data.value?.shareReferral || null);
const canApplyDistribution = computed(() => data.value?.canApply === true);
const shareCode = computed(() => data.value?.shareCode || userStore.userInfo?.shareCode || '');
const sharePath = computed(() => data.value?.sharePath || withShareRef('pages/volunteer/index'));
const dailyShareRewardPoints = computed(() => data.value?.dailyShareRewardPoints ?? 10);
const referralRewardPoints = computed(() => data.value?.referralRewardPoints ?? 20);
const registrationRewardUnitAmount = computed(() => setting.value?.referrerRegistrationRewardAmount ?? 50);
const qrcodeActionText = computed(() => {
  if (qrcodeSaving.value) return '保存中';
  if (qrcodeLoading.value) return '生成中';
  return '下载专属二维码';
});
const transferRule = computed(() => stats.value?.transferRule || setting.value?.transferRule || {});
const transferRuleText = computed(() => {
  const rule = transferRule.value || {};
  const singleMax = rule.singleMax ?? 20000;
  const userDailyLimit = rule.userDailyLimit ?? 200000;
  return `受微信支付限制，单笔不超过 ${formatRuleMoney(singleMax)}，单日不超过 ${formatRuleMoney(userDailyLimit)}。`;
});
const pendingDeviceBreakdownText = computed(() => {
  const total = stats.value.deviceBreakdown || {};
  const settled = stats.value.settledDeviceBreakdown || {};
  return deviceBreakdownText({
    ios: { amount: Math.max(0, deviceAmount(total, 'ios') - deviceAmount(settled, 'ios')) },
    android: { amount: Math.max(0, deviceAmount(total, 'android') - deviceAmount(settled, 'android')) },
  });
});
const rewardTipText = computed(() => {
  const tips = [];
  if (dailyShareRewardPoints.value > 0) tips.push(`每天分享可领 ${dailyShareRewardPoints.value} 点`);
  if (referralRewardPoints.value > 0) tips.push(`好友通过你的码注册，再赠送 ${referralRewardPoints.value} 点`);
  return tips.length ? tips.join('；') : '邀请码可用于好友注册追踪。';
});
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
  const firstRate = distributor.value.level === 1
    ? Number(setting.value.level1Percent || 0)
    : Number(setting.value.level2Percent || 0);
  const parts = [`首充 ${formatPercent(firstRate)}`];
  if (setting.value.recurringCommissionEnabled) {
    const recurringRate = distributor.value.level === 1
      ? Number(setting.value.recurringLevel1Percent || 0)
      : Number(setting.value.recurringLevel2Percent || 0);
    parts.push(`复充 ${formatPercent(recurringRate)}，限 ${setting.value.recurringCommissionDays || 0} 天`);
  }
  return parts.join('；');
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
    const tasks = [loadCommissions(), loadWithdrawals()];
    if (showRegistrationRewardStats.value) tasks.push(loadRegistrationRewards());
    await Promise.all(tasks);
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
      const rawQrUrl = await materializeImageDataUrl(payload.dataUrl);
      qrcodeUrl.value = await decorateInviteQrToTempFile(rawQrUrl, payload.shareCode || shareCode.value) || rawQrUrl;
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

async function saveInviteQrcode() {
  if (qrcodeSaving.value || qrcodeLoading.value) return;
  qrcodeSaving.value = true;
  try {
    const filePath = await ensureInviteQrImagePath();
    if (!filePath) throw new Error('专属二维码生成失败');
    await saveImageToAlbum(filePath);
    uni.showToast({ title: '已保存到相册', icon: 'success' });
    recordShare('qrcode', sharePath.value);
  } catch (e: any) {
    const message = e?.errMsg || e?.message || '';
    if (String(message).includes('auth deny') || String(message).includes('authorize no response')) {
      uni.showModal({
        title: '需要相册权限',
        content: '请允许保存到相册，才能下载你的专属邀请码图片。',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) uni.openSetting({});
        },
      });
    } else {
      uni.showToast({ title: e?.message || '保存失败，请稍后重试', icon: 'none' });
    }
  } finally {
    qrcodeSaving.value = false;
  }
}

async function ensureInviteQrImagePath() {
  if (!qrcodeUrl.value) {
    await loadQrcode(false);
  }
  if (!qrcodeUrl.value) return '';
  return materializeQrImagePath(qrcodeUrl.value);
}

async function materializeQrImagePath(path: string) {
  const raw = String(path || '');
  if (!raw) return '';
  if (/^data:image\/png;base64,/.test(raw)) {
    return writePngDataUrlToTempFile(raw, `zhangshi-invite-code-${shareCode.value || 'me'}.png`);
  }
  if (/^https?:\/\//.test(raw)) {
    const res = await uni.downloadFile({ url: raw });
    if (res.statusCode && res.statusCode >= 400) throw new Error('二维码下载失败');
    return res.tempFilePath;
  }
  return raw;
}

function saveImageToAlbum(filePath: string) {
  return uni.saveImageToPhotosAlbum({ filePath });
}

async function loadCommissions() {
  if (!distributor.value || !isActive.value) return;
  const res = await api.distribution.commissions(1, 20);
  commissions.value = (res.data as any).list || [];
}

async function loadRegistrationRewards() {
  if (!showRegistrationRewardStats.value) {
    registrationRewards.value = [];
    return;
  }
  const res = await api.distribution.registrationRewards(1, 20);
  registrationRewards.value = (res.data as any).list || [];
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
  const rule = transferRule.value || {};
  if (amount < Number(rule.singleMin || 10)) {
    uni.showToast({ title: `单笔最低${formatMoney(rule.singleMin || 10)}`, icon: 'none' });
    return;
  }
  if (amount > Number(rule.singleMax || 20000)) {
    uni.showToast({ title: `单笔最高${formatMoney(rule.singleMax || 20000)}`, icon: 'none' });
    return;
  }
  withdrawing.value = true;
  try {
    await api.distribution.applyWithdrawal(amount);
    withdrawAmountInput.value = '';
    uni.showModal({
      title: '提现申请已提交',
      content: '审核通过并发起微信转账后，请回到本页面点击“确认收款”，完成后才会进入微信零钱。',
      showCancel: false,
      confirmText: '知道了',
    });
    await loadAll();
  } catch (e: any) {
    uni.showToast({ title: e.message || '申请失败', icon: 'none' });
  } finally {
    withdrawing.value = false;
  }
}

async function confirmMerchantTransfer(item: any) {
  try {
    const res = await api.distribution.transferPackage(item.id);
    const transfer = (res.data as any)?.transfer;
    if (!transfer?.package) {
      uni.showToast({ title: '暂无可确认的收款单', icon: 'none' });
      await loadAll();
      return;
    }
    const wxApi = (wx as any);
    if (!wxApi?.requestMerchantTransfer) {
      uni.showToast({ title: '当前微信版本暂不支持确认收款', icon: 'none' });
      return;
    }
    await new Promise((resolve, reject) => {
      wxApi.requestMerchantTransfer({
        mchId: transfer.mchId,
        appId: transfer.appId,
        package: transfer.package,
        success: resolve,
        fail: reject,
      });
    });
    uni.showToast({ title: '已提交确认', icon: 'success' });
    await syncTransfer(item);
  } catch (e: any) {
    uni.showToast({ title: e?.errMsg || e.message || '确认收款失败', icon: 'none' });
  }
}

async function syncTransfer(item: any) {
  try {
    await api.distribution.syncTransfer(item.id);
    await Promise.all([loadWithdrawals(), loadAll()]);
  } catch (e: any) {
    uni.showToast({ title: e.message || '刷新失败', icon: 'none' });
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

  return withInviteQrCanvas((ctx, metrics) => {
    const qrArea = getInviteQrArea(metrics);
    const cellSize = Math.floor(qrArea.codeSize / matrixSize);
    const qrSize = cellSize * matrixSize;
    const offsetX = qrArea.x + Math.floor((qrArea.codeSize - qrSize) / 2);
    const offsetY = qrArea.y + Math.floor((qrArea.codeSize - qrSize) / 2);

    paintInviteQrBackground(ctx, metrics);
    ctx.setFillStyle('#0f766e');
    for (let row = 0; row < matrixSize; row += 1) {
      for (let col = 0; col < matrixSize; col += 1) {
        if (modules.get(row, col)) {
          ctx.fillRect(offsetX + col * cellSize, offsetY + row * cellSize, cellSize, cellSize);
        }
      }
    }
    drawInviteCodeCaption(ctx, code, metrics);
  });
}

async function decorateInviteQrToTempFile(imagePath: string, code: string) {
  const normalizedCode = normalizeInviteCodeForImage(code);
  if (!imagePath || !normalizedCode) return imagePath;
  qrcodeUrl.value = '';
  canvasQrVisible.value = true;
  await nextTick();

  return withInviteQrCanvas((ctx, metrics) => {
    const qrArea = getInviteQrArea(metrics);
    paintInviteQrBackground(ctx, metrics);
    ctx.drawImage(imagePath, qrArea.x, qrArea.y, qrArea.codeSize, qrArea.codeSize);
    drawInviteCodeCaption(ctx, normalizedCode, metrics);
  });
}

function withInviteQrCanvas(drawer: (ctx: any, metrics: { width: number; height: number }) => void) {
  return new Promise<string>((resolve) => {
    getInviteQrCanvasMetrics().then((metrics) => {
      const ctx = uni.createCanvasContext('inviteQrCanvas');
      drawer(ctx, metrics);
      ctx.draw(false, () => {
        uni.canvasToTempFilePath({
          canvasId: 'inviteQrCanvas',
          width: metrics.width,
          height: metrics.height,
          destWidth: metrics.width * 3,
          destHeight: metrics.height * 3,
          fileType: 'png',
          success: (res) => resolve(res.tempFilePath),
          fail: () => resolve(''),
        });
      });
    });
  });
}

function getInviteQrCanvasMetrics() {
  return new Promise<{ width: number; height: number }>((resolve) => {
    nextTick(() => {
      uni.createSelectorQuery()
        .select('.qr-canvas')
        .boundingClientRect((rect: any) => {
          const width = Math.max(160, Math.round(Number(rect?.width) || 210));
          const height = Math.max(188, Math.round(Number(rect?.height) || 245));
          resolve({ width, height });
        })
        .exec();
    });
  });
}

function paintInviteQrBackground(ctx: any, metrics: { width: number; height: number }) {
  ctx.setFillStyle('#ffffff');
  ctx.fillRect(0, 0, metrics.width, metrics.height);
  ctx.setFillStyle('#f0fdfa');
  const bottomBarHeight = getInviteQrBottomBarHeight(metrics);
  ctx.fillRect(0, metrics.height - bottomBarHeight, metrics.width, bottomBarHeight);
}

function getInviteQrArea(metrics: { width: number; height: number }) {
  const bottomBarHeight = getInviteQrBottomBarHeight(metrics);
  const topPadding = Math.max(4, Math.round(metrics.width * 0.025));
  const sidePadding = Math.max(5, Math.round(metrics.width * 0.025));
  const availableHeight = metrics.height - bottomBarHeight - topPadding;
  const codeSize = Math.max(120, Math.min(metrics.width - sidePadding * 2, availableHeight));
  return {
    codeSize,
    x: Math.round((metrics.width - codeSize) / 2),
    y: topPadding + Math.round((availableHeight - codeSize) * 0.42),
  };
}

function getInviteQrBottomBarHeight(metrics: { height: number }) {
  return Math.max(30, Math.round(metrics.height * 0.13));
}

function drawInviteCodeCaption(ctx: any, code: string, metrics: { width: number; height: number }) {
  const text = normalizeInviteCodeForImage(code);
  if (!text) return;
  const label = `邀请码 ${text}`;
  const fontSize = getInviteCodeFontSize(label, metrics.width);
  ctx.setFontSize(fontSize);
  ctx.setFillStyle('#0f766e');
  ctx.setTextAlign('center');
  if (typeof ctx.setTextBaseline === 'function') ctx.setTextBaseline('middle');
  ctx.fillText(label, metrics.width / 2, metrics.height - Math.round(getInviteQrBottomBarHeight(metrics) / 2));
}

function normalizeInviteCodeForImage(code: string) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 24);
}

function getInviteCodeFontSize(text: string, canvasWidth: number) {
  const length = Math.max(1, text.length);
  const maxWidth = canvasWidth * 0.76;
  return Math.max(10, Math.min(14, Math.floor(maxWidth / (length * 0.62))));
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
  if (role === 'level1_recurring_direct') return '复充直接奖励';
  if (role === 'level2_recurring_direct') return '复充推荐奖励';
  if (role === 'level1_recurring_override') return '复充合作奖励';
  return '分享奖励';
}

function commissionSourceText(item: any) {
  const userName = item.referralUser?.nickname || item.referralUser?.phone || item.referralUserId || '用户';
  const orderAmount = formatMoney(item.order?.amount || 0);
  const orderType = isRecurringRole(item.role) ? '复充' : '首充';
  return `${userName} ${orderType} ${orderAmount}，产生推荐奖励`;
}

function paymentDeviceLabel(value: string) {
  if (value === 'ios') return 'Apple IAP';
  if (value === 'android') return '安卓/鸿蒙';
  if (value === 'wechat_pay') return '普通微信支付';
  return '未识别支付端';
}

function deviceAmount(summary: any, key: string) {
  return Number(summary?.[key]?.amount || 0);
}

function deviceBreakdownText(summary: any) {
  return `iOS ${formatMoney(deviceAmount(summary, 'ios'))} / 安卓 ${formatMoney(deviceAmount(summary, 'android'))}`;
}

function registrationRewardSourceText(item: any) {
  const userName = item.referralUser?.nickname || item.referralUser?.phone || item.referralUserId || '新用户';
  return `${userName} 通过你的邀请码注册，产生邀请注册现金奖励`;
}

function isRecurringRole(role: string) {
  return String(role || '').includes('_recurring_');
}

function withdrawalStatusLabel(status: string) {
  if (status === 'pending') return '待审核';
  if (status === 'approved') return '已通过，待打款';
  if (status === 'transferring') return '微信转账中';
  if (status === 'wait_user_confirm') return '待确认收款';
  if (status === 'paid') return '已打款';
  if (status === 'rejected') return '已驳回';
  if (status === 'failed') return '打款失败';
  return status || '-';
}

function formatMoney(value: number) {
  return `¥${(Number(value || 0) / 100).toFixed(2)}`;
}

function formatRuleMoney(value: number) {
  const yuan = Number(value || 0) / 100;
  return Number.isInteger(yuan) ? `¥${yuan}` : `¥${yuan.toFixed(2)}`;
}

function formatPercent(value: number) {
  const normalized = Number(value || 0);
  return Number.isInteger(normalized) ? `${normalized}%` : `${normalized.toFixed(2)}%`;
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

  &.four {
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

.withdraw-source {
  display: block;
  margin-top: 8rpx;
  color: $text-tertiary;
  font-size: 20rpx;
  line-height: 1.35;
}

.rule-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 99;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  background: rgba(15, 23, 42, 0.45);
}

.rule-modal {
  width: 100%;
  max-height: 78vh;
  overflow-y: auto;
  padding: 28rpx;
  border-radius: 24rpx;
  background: #fff;
  box-shadow: 0 20rpx 60rpx rgba(15, 23, 42, 0.18);
}

.rule-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
  color: $text-primary;
  font-size: $font-lg;
  font-weight: 900;
}

.rule-modal-close {
  color: #0f766e;
  font-size: $font-sm;
  font-weight: 800;
}

.rule-row {
  display: flex;
  gap: 14rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid rgba(15, 118, 110, 0.1);

  &:last-child {
    border-bottom: 0;
  }
}

.rule-label {
  flex: none;
  width: 112rpx;
  color: #0f766e;
  font-size: 22rpx;
  font-weight: 900;
}

.rule-text {
  flex: 1;
  min-width: 0;
  color: #315e59;
  font-size: 22rpx;
  line-height: 1.55;
}

.registration-reward-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.registration-reward-summary > view {
  padding: 18rpx 14rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.summary-label,
.summary-value {
  display: block;
}

.summary-label {
  color: $text-tertiary;
  font-size: $font-xs;
}

.summary-value {
  margin-top: 6rpx;
  color: #0f766e;
  font-size: 30rpx;
  font-weight: 900;
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
  width: 420rpx;
  height: 490rpx;
  margin: 0 auto;
  padding: 14rpx;
  border-radius: 24rpx;
  background: #fff;
  border: 1rpx solid rgba(15, 118, 110, 0.12);
  box-shadow: 0 16rpx 36rpx rgba(15, 23, 42, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.qr-img {
  width: 100%;
  height: 100%;
  border-radius: 16rpx;
}

.qr-canvas {
  width: 392rpx;
  height: 462rpx;
  border-radius: 16rpx;
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

.withdraw-right {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.mini-btn {
  min-width: 112rpx;
  height: 48rpx;
  padding: 0 16rpx;
  border-radius: 12rpx;
  background: #0f766e;
  color: #fff;
  font-size: 22rpx;
  line-height: 48rpx;
  text-align: center;
}

.mini-btn.ghost {
  background: #f0fdfa;
  color: #0f766e;
}
</style>
