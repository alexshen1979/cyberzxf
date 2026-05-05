<template>
  <view class="plans-page">
    <view class="page-header">
      <text class="page-title">📋 升学规划</text>
      <text class="page-desc">选择你需要的深度分析服务</text>
    </view>
    <view class="plan-card glow-card" v-for="plan in plans" :key="plan.key" @click="goPlan(plan)">
      <view class="plan-icon"><text>{{ plan.icon }}</text></view>
      <view class="plan-info">
        <text class="plan-name">{{ plan.name }}</text>
        <text class="plan-desc">{{ plan.desc }}</text>
      </view>
      <view class="plan-cost">
        <text class="cost-num">18</text>
        <text class="cost-unit">点</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

const plans = [
  { key: 'gaokao-deep', icon: '🎓', name: '全套志愿方案', desc: '根据分数、排名、省份，生成冲/稳/保志愿梯度方案' },
  { key: 'major-analysis', icon: '🔍', name: '深度择校分析', desc: '目标院校全方位对比：就业率、师资、区位、行业认可度' },
  { key: 'career-path', icon: '🗺️', name: '职业路径规划', desc: '专业→行业→岗位全链路分析，避坑指南' },
];

function goPlan(plan: any) {
  userStore.consultType = 'deep';
  userStore.consultQuestion = '';
  userStore.pendingConsult = true;
  uni.switchTab({ url: '/pages/consult/index' });
}
</script>

<style lang="scss" scoped>
.plans-page { padding: $spacing-md; min-height: 100vh; }
.page-header { text-align: center; padding: $spacing-lg 0; }
.page-title { font-size: $font-xl; font-weight: 700; display: block; }
.page-desc { font-size: $font-sm; color: $text-secondary; display: block; margin-top: $spacing-xs; }
.plan-card { display: flex; align-items: center; padding: $spacing-md; margin: 0 0 $spacing-sm; gap: $spacing-md; }
.plan-icon { font-size: 48rpx; }
.plan-info { flex: 1; }
.plan-name { font-size: $font-md; font-weight: 600; display: block; }
.plan-desc { font-size: $font-xs; color: $text-secondary; margin-top: 4rpx; display: block; }
.plan-cost { text-align: center; }
.cost-num { font-size: $font-xl; font-weight: 700; color: $primary; display: block; }
.cost-unit { font-size: $font-xs; color: $text-dim; }
</style>
