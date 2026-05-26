<template>
  <view class="recharge-page">
    <!-- 余额展示 -->
    <view class="balance-card glow-card">
      <text class="balance-label">当前咨询点数</text>
      <view class="balance-row">
        <text class="balance-value">{{ userStore.pointsBalance }}</text>
        <text class="balance-unit">点</text>
      </view>
    </view>

    <!-- 充值套餐 -->
    <view class="section-title">选择充值套餐</view>
    <view class="product-list">
      <view class="product-card" v-for="p in products" :key="p.id"
        :class="{ selected: selectedProduct?.id === p.id }" @click="selectedProduct = p">
        <view class="corner-badge" :class="badgeClass(p)" v-if="productBadge(p)">
          {{ productBadge(p) }}
        </view>
        <view class="product-points">
          <text class="product-points-num">{{ p.points + p.bonus }}</text>
          <text class="product-points-label">点数</text>
        </view>
        <view class="product-detail">
          <text class="product-name">{{ p.name }}</text>
          <text class="product-desc" v-if="p.description">{{ p.description }}</text>
          <view class="product-bonus" v-if="p.bonus > 0">
            <text>赠送 {{ p.bonus }} 点</text>
          </view>
        </view>
        <view class="product-price">
          <text class="original-price" v-if="hasDiscount(p)">¥{{ formatPrice(p.originalPrice) }}</text>
          <view class="discount-price">
            <text class="price-symbol">¥</text>
            <text class="price-value">{{ formatPrice(p.price) }}</text>
          </view>
          <text class="discount-tag" v-if="hasDiscount(p)">省 ¥{{ formatPrice(Number(p.originalPrice) - p.price) }}</text>
        </view>
        <view class="check-mark" v-if="selectedProduct?.id === p.id">✓</view>
      </view>
    </view>

    <!-- 合规文案 -->
    <view class="compliance-notice">
      <text>温馨提示：</text>
      <text>· 咨询点数仅用于本平台 AI 咨询服务，不可转让、不可提现</text>
      <text>· 充值后点数有效期为 1 年</text>
      <text>· 未成年人请在监护人指导下进行充值</text>
    </view>

    <!-- 支付按钮 -->
    <view class="pay-btn safe-area-bottom" :class="{ disabled: !selectedProduct || paying }" @click="handlePay">
      <text>{{ paying ? '支付中...' : `确认支付 ¥${formatPrice(selectedProduct?.price || 0)}` }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number | null;
  points: number;
  bonus: number;
  description?: string;
  isDefault?: boolean;
  badgeType?: 'hot' | 'best_value' | null;
}

const products = ref<Product[]>([]);

const selectedProduct = ref<Product | null>(null);
const paying = ref(false);

onMounted(async () => {
  const res = await api.payment.getProducts();
  products.value = res.data;
  if (products.value.length > 0) {
    selectedProduct.value = chooseDefaultProduct(products.value);
  }
});

async function handlePay() {
  if (!selectedProduct.value || paying.value) return;

  paying.value = true;

  try {
    if (!userStore.isLogin) {
      await userStore.loginWithWechatProfile();
      return;
    }

    const orderRes = await api.payment.createOrder(selectedProduct.value.id);
    const payParams = orderRes.data.payParams;
    if (!payParams) {
      uni.showToast({ title: '支付参数生成失败', icon: 'none' });
      return;
    }

    await requestWechatPayment(payParams);
    const paid = await waitOrderPaid(orderRes.data.orderNo);
    await refreshBalanceAfterPayment();

    if (paid) {
      uni.showToast({ title: '充值已到账', icon: 'success' });
      setTimeout(() => uni.navigateBack(), 1200);
    } else {
      uni.showToast({ title: '支付成功，到账稍后刷新', icon: 'none' });
    }
  } catch (e: any) {
    const message = e?.errMsg?.includes('cancel')
      ? '支付已取消'
      : (e?.response?.data?.message || e?.message || '支付失败');
    uni.showToast({ title: message, icon: 'none' });
  } finally {
    paying.value = false;
  }
}

function requestWechatPayment(payParams: {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
}) {
  return new Promise<void>((resolve, reject) => {
    uni.requestPayment(Object.assign({}, payParams, {
      success: () => resolve(),
      fail: reject,
    } as any));
  });
}

async function waitOrderPaid(orderNo: string) {
  for (let i = 0; i < 18; i += 1) {
    const res = await api.payment.getOrder(orderNo);
    if (res.data.status === 'paid') return true;
    if (res.data.status === 'failed') return false;
    await new Promise(resolve => setTimeout(resolve, i < 6 ? 1000 : 1500));
  }
  return false;
}

async function refreshBalanceAfterPayment() {
  for (let i = 0; i < 5; i += 1) {
    await userStore.fetchBalance();
    if (i < 4) {
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }
}

function formatPrice(price?: number | null) {
  const n = Number(price || 0);
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function hasDiscount(product: { price: number; originalPrice?: number | null }) {
  return Number(product.originalPrice || 0) > product.price;
}

function chooseDefaultProduct(list: Product[]) {
  return list.find(product => product.isDefault) || list[0];
}

function productBadge(product: Product) {
  if (product.badgeType === 'hot') return '热门';
  if (product.badgeType === 'best_value') return '最划算';
  return '';
}

function badgeClass(product: Product) {
  return {
    hot: product.badgeType === 'hot',
    value: product.badgeType === 'best_value',
  };
}
</script>

<style lang="scss" scoped>

.recharge-page {
  padding: 16rpx 20rpx 156rpx;
  min-height: 100vh;
  background:
    linear-gradient(180deg, rgba(236, 253, 245, 0.58), rgba(248, 250, 252, 0) 260rpx),
    $bg-page;
}

.balance-card {
  text-align: center;
  padding: 20rpx 24rpx;
  margin: 0;
}

.balance-label {
  font-size: $font-sm;
  color: $text-secondary;
}

.balance-row {
  margin-top: 4rpx;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4rpx;
}

.balance-value {
  font-size: 60rpx;
  font-weight: 800;
  @include gradient-text;
}

.balance-unit {
  font-size: $font-md;
  color: $text-secondary;
}

.section-title {
  font-size: $font-md;
  font-weight: 600;
  margin: 20rpx 0 12rpx;
}

.product-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.product-card {
  @include card;
  display: flex;
  align-items: center;
  min-height: 116rpx;
  padding: 34rpx 20rpx 18rpx;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s;

  &.selected {
    border-color: rgba(34, 197, 94, 0.45);
    box-shadow: 0 12rpx 36rpx rgba(34, 197, 94, 0.10);
  }
}

.corner-badge {
  position: absolute;
  top: 0;
  left: 0;
  min-width: 104rpx;
  height: 34rpx;
  padding: 0 16rpx;
  border-radius: $radius-md 0 $radius-md 0;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 800;
  line-height: 34rpx;
  text-align: center;
  letter-spacing: 0;

  &.hot {
    background: linear-gradient(135deg, #ef4444, #f97316);
  }

  &.value {
    background: linear-gradient(135deg, #7c3aed, #2563eb);
  }
}

.product-points {
  text-align: center;
  width: 108rpx;
}

.product-points-num {
  font-size: 34rpx;
  font-weight: 800;
  color: #059669;
  display: block;
}

.product-points-label {
  font-size: $font-xs;
  color: $text-dim;
}

.product-detail {
  flex: 1;
  margin: 0 16rpx;
  min-width: 0;
}

.product-name {
  font-size: $font-md;
  font-weight: 500;
  color: $text-primary;
  display: block;
}

.product-desc {
  display: block;
  margin-top: 2rpx;
  font-size: $font-xs;
  color: $text-tertiary;
  @include text-ellipsis;
}

.product-bonus {
  font-size: $font-xs;
  color: #b45309;
  margin-top: 4rpx;
}

.product-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 124rpx;
}

.original-price {
  font-size: $font-xs;
  color: $text-dim;
  text-decoration: line-through;
}

.discount-price {
  display: flex;
  align-items: baseline;
}

.price-symbol {
  font-size: $font-sm;
  color: $text-secondary;
}

.price-value {
  font-size: 34rpx;
  font-weight: 700;
  color: #047857;
}

.discount-tag {
  margin-top: 2rpx;
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
  background: #fef3c7;
  color: #92400e;
  font-size: 20rpx;
  line-height: 1.5;
}

.check-mark {
  position: absolute;
  top: 0;
  right: 0;
  width: 42rpx;
  height: 42rpx;
  background: #22c55e;
  color: #ffffff;
  border-radius: 0 $radius-md 0 $radius-md;
  @include flex-center;
  font-size: $font-sm;
  font-weight: 700;
}

.compliance-notice {
  margin-top: 16rpx;
  padding: 18rpx 20rpx;
  background: $bg-secondary;
  border-radius: $radius-md;
  font-size: $font-xs;
  color: $text-dim;
  line-height: 1.55;

  text {
    display: block;
  }
}

.pay-btn {
  position: fixed;
  left: 20rpx;
  right: 20rpx;
  bottom: 20rpx;
  z-index: 20;
  background: linear-gradient(135deg, #059669, #14b8a6);
  color: #fff;
  margin-top: 0;
  padding: 24rpx;
  border-radius: $radius-lg;
  text-align: center;
  font-size: $font-lg;
  font-weight: 700;

  &.disabled {
    opacity: 0.5;
  }
}
</style>
