<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col :span="6" v-for="card in cards" :key="card.key">
        <div class="stat-card">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value">{{ card.value }}</div>
          <div class="stat-sub" v-if="card.sub">较上月 {{ card.sub }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <div class="chart-card">
          <h3>用户增长趋势</h3>
          <div class="chart-placeholder">图表组件 — 接入 ECharts</div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="chart-card">
          <h3>咨询量趋势</h3>
          <div class="chart-placeholder">图表组件 — 接入 ECharts</div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';

const cards = ref([
  { key: 'users', label: '总用户数', value: '--', sub: '' },
  { key: 'todayUsers', label: '今日新增用户', value: '--', sub: '' },
  { key: 'todayConsults', label: '今日咨询量', value: '--', sub: '' },
  { key: 'monthRevenue', label: '本月营收(元)', value: '--', sub: '' },
]);

onMounted(async () => {
  try {
    const res = await api.dashboard.get() as any;
    const d = res.data;
    cards.value = [
      { key: 'users', label: '总用户数', value: String(d.users.total), sub: `月增 ${d.users.monthNew}` },
      { key: 'todayUsers', label: '今日新增用户', value: String(d.users.todayNew), sub: '' },
      { key: 'todayConsults', label: '今日咨询量', value: String(d.consultations.today), sub: `本月 ${d.consultations.month}` },
      { key: 'monthRevenue', label: '本月营收(元)', value: `¥${(d.revenue.month / 100).toFixed(2)}`, sub: `${d.revenue.monthOrders} 笔订单` },
    ];
  } catch (e) {
    console.error('Dashboard 加载失败:', e);
  }
});
</script>

<style lang="scss" scoped>
.stat-card {
  background: #1a1f4a;
  border: 1px solid #1e2550;
  border-radius: 12px;
  padding: 20px;
}

.stat-label {
  font-size: 13px;
  color: #8890b0;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #00f5ff;
}

.stat-sub {
  font-size: 12px;
  color: #5a6080;
  margin-top: 4px;
}

.chart-card {
  background: #1a1f4a;
  border: 1px solid #1e2550;
  border-radius: 12px;
  padding: 20px;
  min-height: 300px;

  h3 {
    color: #e8eaf0;
    margin: 0 0 16px;
    font-size: 16px;
  }
}

.chart-placeholder {
  height: 250px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5a6080;
  background: #111640;
  border-radius: 8px;
}
</style>
