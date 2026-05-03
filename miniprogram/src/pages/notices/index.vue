<template>
  <view class="notices-page">
    <view class="notice-card card" v-for="notice in notices" :key="notice.id">
      <view class="notice-header">
        <text class="notice-type" :class="notice.type">{{ typeLabel(notice.type) }}</text>
        <text class="notice-date">{{ formatDate(notice.publishedAt) }}</text>
      </view>
      <text class="notice-title">{{ notice.title }}</text>
      <text class="notice-content">{{ notice.content }}</text>
    </view>
    <view class="empty" v-if="notices.length === 0">暂无公告</view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';

const notices = ref<any[]>([]);

const typeLabels: Record<string, string> = { notice: '公告', popup: '弹窗', alert: '重要' };

function typeLabel(type: string) { return typeLabels[type] || type; }
function formatDate(d: string) { return d ? new Date(d).toLocaleDateString('zh-CN') : ''; }

onMounted(async () => {
  const res = await api.notices.list();
  notices.value = (res.data as any[]) || [];
});
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';
.notices-page { padding: $spacing-md; min-height: 100vh; }
.notice-card { padding: $spacing-md; margin: 0 0 $spacing-sm; }
.notice-header { display: flex; justify-content: space-between; margin-bottom: $spacing-xs; }
.notice-type { font-size: $font-xs; padding: 2rpx 12rpx; border-radius: 4rpx; }
.notice-type.notice { background: rgba(0,245,255,0.1); color: $primary; }
.notice-type.popup { background: rgba(124,58,237,0.1); color: $secondary; }
.notice-type.alert { background: rgba(239,68,68,0.1); color: $danger; }
.notice-date { font-size: $font-xs; color: $text-dim; }
.notice-title { font-size: $font-md; font-weight: 600; display: block; margin-bottom: $spacing-xs; }
.notice-content { font-size: $font-sm; color: $text-secondary; display: block; }
.empty { text-align: center; padding: 120rpx 0; color: $text-dim; }
</style>
