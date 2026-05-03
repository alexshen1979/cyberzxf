<template>
  <div class="orders-page">
    <h2>订单管理</h2>
    <el-radio-group v-model="statusFilter" @change="load" style="margin-bottom: 16px">
      <el-radio-button value="">全部</el-radio-button>
      <el-radio-button value="pending">待支付</el-radio-button>
      <el-radio-button value="paid">已支付</el-radio-button>
      <el-radio-button value="refunded">已退款</el-radio-button>
    </el-radio-group>
    <el-table :data="orders" style="width: 100%" v-loading="loading">
      <el-table-column prop="orderNo" label="订单号" width="180" />
      <el-table-column prop="productName" label="套餐" min-width="200" />
      <el-table-column label="金额" width="100">
        <template #default="{ row }">¥{{ (row.amount / 100).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';

const orders = ref([]);
const loading = ref(false);
const statusFilter = ref('');

function statusType(s: string) {
  const map: Record<string, string> = { paid: 'success', pending: 'warning', refunded: 'info', closed: 'danger' };
  return map[s] || 'info';
}

async function load() {
  loading.value = true;
  try {
    const res = await api.orders.list({ status: statusFilter.value }) as any;
    orders.value = res.data.list;
  } finally { loading.value = false; }
}

onMounted(load);
</script>

<style lang="scss" scoped>
h2 { color: #e8eaf0; margin-bottom: 20px; }
</style>
