<template>
  <view class="orders-page">
    <view class="section-title">充值记录</view>
    <view class="order-card card" v-for="order in orders" :key="order.id">
      <view class="order-header">
        <text class="order-no">{{ order.orderNo }}</text>
        <text class="order-status" :class="order.status">{{ statusLabel(order.status) }}</text>
      </view>
      <view class="order-body">
        <text class="order-product">{{ order.productName }}</text>
        <text class="order-amount">¥{{ (order.amount / 100).toFixed(2) }}</text>
      </view>
      <text class="order-time">{{ formatTime(order.createdAt) }}</text>
    </view>
    <view class="empty" v-if="orders.length === 0">
      <text>暂无充值记录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';

const orders = ref<any[]>([]);

const statusLabels: Record<string, string> = {
  pending: '待支付',
  paid: '已完成',
  refunded: '已退款',
  closed: '已关闭',
};

function statusLabel(s: string) { return statusLabels[s] || s; }
function formatTime(d: string) { return d ? new Date(d).toLocaleString('zh-CN') : ''; }

onMounted(async () => {
  const res = await api.payment.getOrders();
  orders.value = (res.data as any).list;
});
</script>

<style lang="scss" scoped>
.orders-page { padding: $spacing-md; min-height: 100vh; }
.section-title { font-size: $font-lg; font-weight: 600; margin-bottom: $spacing-sm; }
.order-card { padding: $spacing-md; margin: 0 0 $spacing-sm; }
.order-header { display: flex; justify-content: space-between; margin-bottom: $spacing-sm; }
.order-no { font-size: $font-sm; color: $text-secondary; }
.order-status { font-size: $font-xs; padding: 2rpx 12rpx; border-radius: 4rpx; }
.order-status.paid { background: rgba(34,197,94,0.15); color: $success; }
.order-status.pending { background: rgba(234,179,8,0.15); color: $warning; }
.order-status.refunded { background: rgba(239,68,68,0.15); color: $danger; }
.order-body { display: flex; justify-content: space-between; margin-bottom: 4rpx; }
.order-product { font-size: $font-md; }
.order-amount { font-size: $font-lg; font-weight: 700; color: $primary; }
.order-time { font-size: $font-xs; color: $text-dim; }
.empty { text-align: center; padding: 120rpx 0; color: $text-dim; }
</style>
