<template>
  <view class="points-page">
    <view class="balance-header glow-card">
      <text class="balance-label">可用咨询点数</text>
      <text class="balance-value">{{ userStore.pointsBalance }}</text>
    </view>

    <view class="section-title">点数明细</view>
    <view class="transaction-list">
      <view class="tx-item" v-for="tx in transactions" :key="tx.id">
        <view class="tx-left">
          <text class="tx-type" :class="tx.type">{{ typeLabel(tx.type) }}</text>
          <text class="tx-remark">{{ tx.remark }}</text>
          <text class="tx-time">{{ formatTime(tx.createdAt) }}</text>
        </view>
        <view class="tx-right">
          <text class="tx-amount" :class="tx.amount > 0 ? 'income' : 'expense'">
            {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount }}
          </text>
          <text class="tx-balance">余额: {{ tx.balanceAfter }}</text>
        </view>
      </view>
    </view>

    <view class="load-more" v-if="hasMore" @click="loadMore">加载更多</view>
    <view class="no-more" v-else>—— 没有更多了 ——</view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();
const transactions = ref<any[]>([]);
const page = ref(1);
const hasMore = ref(true);

const typeLabels: Record<string, string> = {
  gift: '赠送',
  charge: '充值',
  consume: '消费',
  refund: '退款',
  expire: '过期',
};

function typeLabel(type: string) {
  return typeLabels[type] || type;
}

function formatTime(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('zh-CN');
}

async function loadData() {
  const res = await api.points.getTransactions(page.value);
  const data = res.data as any;
  transactions.value = [...transactions.value, ...data.list];
  hasMore.value = transactions.value.length < data.total;
}

function loadMore() {
  page.value++;
  loadData();
}

onMounted(() => {
  loadData();
});
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.points-page {
  padding: $spacing-md;
  min-height: 100vh;
}

.balance-header {
  text-align: center;
  padding: $spacing-lg;
  margin: 0;
}

.balance-label {
  font-size: $font-sm;
  color: $text-secondary;
  display: block;
}

.balance-value {
  font-size: 72rpx;
  font-weight: 800;
  @include gradient-text;
  display: block;
  margin-top: $spacing-xs;
}

.section-title {
  font-size: $font-lg;
  font-weight: 600;
  margin: $spacing-lg 0 $spacing-sm;
}

.tx-item {
  @include card;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: $spacing-md;
  margin: 0 0 $spacing-sm;
}

.tx-left {
  flex: 1;
}

.tx-type {
  font-size: $font-sm;
  font-weight: 600;
  &.gift, &.charge { color: $success; }
  &.consume { color: $text-primary; }
  &.expire { color: $text-dim; }
  &.refund { color: $accent; }
}

.tx-remark {
  font-size: $font-sm;
  color: $text-secondary;
  display: block;
  margin-top: 4rpx;
}

.tx-time {
  font-size: $font-xs;
  color: $text-dim;
  display: block;
  margin-top: 4rpx;
}

.tx-right {
  text-align: right;
}

.tx-amount {
  font-size: $font-lg;
  font-weight: 700;
  display: block;
  &.income { color: $success; }
  &.expense { color: $text-primary; }
}

.tx-balance {
  font-size: $font-xs;
  color: $text-dim;
  margin-top: 4rpx;
  display: block;
}

.load-more, .no-more {
  text-align: center;
  padding: $spacing-md;
  font-size: $font-sm;
  color: $text-secondary;
}
</style>
