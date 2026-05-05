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
        <view class="product-points">
          <text class="product-points-num">{{ p.points + p.bonus }}</text>
          <text class="product-points-label">点数</text>
        </view>
        <view class="product-detail">
          <text class="product-name">{{ p.name }}</text>
          <view class="product-bonus" v-if="p.bonus > 0">
            <text>🎁 赠送 {{ p.bonus }} 点</text>
          </view>
        </view>
        <view class="product-price">
          <text class="price-symbol">¥</text>
          <text class="price-value">{{ p.price }}</text>
        </view>
        <view class="check-mark" v-if="selectedProduct?.id === p.id">✓</view>
      </view>
    </view>

    <!-- 合规文案 -->
    <view class="compliance-notice">
      <text>📌 温馨提示：</text>
      <text>· 咨询点数仅用于本平台 AI 咨询服务，不可转让、不可提现</text>
      <text>· 充值后点数有效期为 1 年</text>
      <text>· 未成年人请在监护人指导下进行充值</text>
    </view>

    <!-- 支付按钮 -->
    <view class="pay-btn safe-area-bottom" :class="{ disabled: !selectedProduct || paying }" @click="handlePay">
      <text>{{ paying ? '支付中...' : `确认支付 ¥${selectedProduct?.price || '0.00'}` }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

const products = ref<Array<{
  id: string;
  name: string;
  price: number;
  points: number;
  bonus: number;
}>>([]);

const selectedProduct = ref<any>(null);
const paying = ref(false);

onMounted(async () => {
  const res = await api.payment.getProducts();
  products.value = res.data;
  if (products.value.length > 0) {
    selectedProduct.value = products.value[0];
  }
});

async function handlePay() {
  if (!selectedProduct.value || paying.value) return;

  paying.value = true;

  try {
    // 创建订单
    const orderRes = await api.payment.createOrder(selectedProduct.value.id);

    // 调起微信支付
    // TODO: 实际对接微信虚拟支付 API
    // uni.requestPayment({
    //   timeStamp: '',
    //   nonceStr: '',
    //   package: '',
    //   signType: 'RSA',
    //   paySign: '',
    //   success: async () => {
    //     await userStore.fetchBalance();
    //     uni.showToast({ title: '充值成功', icon: 'success' });
    //     setTimeout(() => uni.navigateBack(), 1500);
    //   },
    //   fail: () => {
    //     uni.showToast({ title: '支付取消', icon: 'none' });
    //   },
    // });

    uni.showToast({ title: '支付功能接入中...', icon: 'none' });

  } catch (e: any) {
    uni.showToast({ title: e.message || '支付失败', icon: 'error' });
  } finally {
    paying.value = false;
  }
}
</script>

<style lang="scss" scoped>

.recharge-page {
  padding: $spacing-md;
  min-height: 100vh;
}

.balance-card {
  text-align: center;
  padding: $spacing-lg;
  margin: 0;
}

.balance-label {
  font-size: $font-sm;
  color: $text-secondary;
}

.balance-row {
  margin-top: $spacing-xs;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4rpx;
}

.balance-value {
  font-size: 80rpx;
  font-weight: 800;
  @include gradient-text;
}

.balance-unit {
  font-size: $font-md;
  color: $text-secondary;
}

.section-title {
  font-size: $font-lg;
  font-weight: 600;
  margin: $spacing-lg 0 $spacing-sm;
}

.product-list {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.product-card {
  @include card;
  display: flex;
  align-items: center;
  padding: $spacing-md;
  position: relative;
  transition: border-color 0.2s;

  &.selected {
    border-color: $primary;
    box-shadow: $shadow-glow;
  }
}

.product-points {
  text-align: center;
  width: 120rpx;
}

.product-points-num {
  font-size: $font-xl;
  font-weight: 800;
  color: $primary;
  display: block;
}

.product-points-label {
  font-size: $font-xs;
  color: $text-dim;
}

.product-detail {
  flex: 1;
  margin: 0 $spacing-md;
}

.product-name {
  font-size: $font-md;
  font-weight: 500;
}

.product-bonus {
  font-size: $font-xs;
  color: $accent;
  margin-top: 4rpx;
}

.product-price {
  display: flex;
  align-items: baseline;
}

.price-symbol {
  font-size: $font-sm;
  color: $text-secondary;
}

.price-value {
  font-size: $font-xl;
  font-weight: 700;
  color: $primary;
}

.check-mark {
  position: absolute;
  top: 0;
  right: 0;
  width: 48rpx;
  height: 48rpx;
  background: $primary;
  color: $bg-primary;
  border-radius: 0 $radius-md 0 $radius-md;
  @include flex-center;
  font-size: $font-sm;
  font-weight: 700;
}

.compliance-notice {
  margin-top: $spacing-lg;
  padding: $spacing-md;
  background: $bg-secondary;
  border-radius: $radius-md;
  font-size: $font-xs;
  color: $text-dim;
  line-height: 1.8;

  text {
    display: block;
  }
}

.pay-btn {
  @include gradient-btn;
  margin-top: $spacing-lg;
  padding: $spacing-md;
  border-radius: $radius-lg;
  text-align: center;
  font-size: $font-lg;
  font-weight: 700;

  &.disabled {
    opacity: 0.5;
  }
}
</style>
