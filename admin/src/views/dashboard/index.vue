<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col :span="6" v-for="card in cards" :key="card.key">
        <div class="stat-card">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value">{{ card.value }}</div>
          <div class="stat-sub" v-if="card.sub">{{ card.sub }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <div class="chart-card">
          <h3>用户增长趋势</h3>
          <div ref="userChartRef" class="chart-box"></div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="chart-card">
          <h3>咨询量趋势</h3>
          <div ref="consultChartRef" class="chart-box"></div>
        </div>
      </el-col>
    </el-row>

    <div class="export-section">
      <h3>数据导出</h3>
      <div class="export-btns">
        <el-button type="primary" @click="handleExport('users')">导出用户数据</el-button>
        <el-button type="success" @click="handleExport('orders')">导出订单数据</el-button>
        <el-button type="warning" @click="handleExport('consultations')">导出咨询记录</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { api } from '@/api';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';

const cards = ref([
  { key: 'users', label: '总用户数', value: '--', sub: '' },
  { key: 'todayUsers', label: '今日新增用户', value: '--', sub: '' },
  { key: 'todayConsults', label: '今日咨询量', value: '--', sub: '' },
  { key: 'monthRevenue', label: '本月营收(元)', value: '--', sub: '' },
]);

const userChartRef = ref<HTMLElement | null>(null);
const consultChartRef = ref<HTMLElement | null>(null);
let userChart: echarts.ECharts | null = null;
let consultChart: echarts.ECharts | null = null;
const trendData = ref<{ labels: string[]; users: number[]; consultations: number[] } | null>(null);

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
    if (d.trends) {
      trendData.value = d.trends;
    }
  } catch (e) {
    console.error('Dashboard 加载失败:', e);
  }

  await nextTick();
  initCharts();
});

function initCharts() {
  const baseTheme = {
    textStyle: { color: '#64748b' },
    grid: { top: 10, right: 20, bottom: 30, left: 50 },
  };

  const labels = trendData.value?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const userValues = trendData.value?.users || [12, 8, 15, 20, 18, 25, 22];
  const consultValues = trendData.value?.consultations || [35, 28, 42, 38, 55, 48, 60];

  if (userChartRef.value) {
    userChart = echarts.init(userChartRef.value);
    userChart.setOption({
      ...baseTheme,
      xAxis: { data: labels, axisLine: { lineStyle: { color: '#e2e8f0' } } },
      yAxis: { axisLine: { lineStyle: { color: '#e2e8f0' } }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
      series: [{
        data: userValues, type: 'line', smooth: true,
        lineStyle: { color: '#3b82f6' }, itemStyle: { color: '#3b82f6' },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(59,130,246,0.15)' }, { offset: 1, color: 'rgba(59,130,246,0)' },
        ]) },
      }],
    });
  }

  if (consultChartRef.value) {
    consultChart = echarts.init(consultChartRef.value);
    consultChart.setOption({
      ...baseTheme,
      xAxis: { data: labels, axisLine: { lineStyle: { color: '#e2e8f0' } } },
      yAxis: { axisLine: { lineStyle: { color: '#e2e8f0' } }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
      series: [{
        data: consultValues, type: 'bar',
        itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#3b82f6' }, { offset: 1, color: '#93c5fd' },
        ]) },
      }],
    });
  }
}

async function handleExport(type: string) {
  try {
    if (type === 'users') {
      await api.export.users();
    } else if (type === 'orders') {
      await api.export.orders();
    } else if (type === 'consultations') {
      await api.export.consultations();
    }
    ElMessage.success('导出成功');
  } catch (e: any) {
    ElMessage.error(e.message || '导出失败');
  }
}
</script>

<style lang="scss" scoped>
.stat-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  padding: 20px;
  box-shadow: var(--el-box-shadow-lighter);
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.stat-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

.chart-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  padding: 20px;
  min-height: 300px;
  box-shadow: var(--el-box-shadow-lighter);

  h3 {
    color: var(--el-text-color-primary);
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
  }
}

.chart-box {
  height: 250px;
}

.export-section {
  margin-top: 24px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  padding: 20px;
  box-shadow: var(--el-box-shadow-lighter);

  h3 {
    color: var(--el-text-color-primary);
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
  }
}

.export-btns {
  display: flex;
  gap: 12px;
}
</style>
