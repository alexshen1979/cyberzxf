<template>
  <view class="fav-page">
    <view class="fav-list">
      <view class="fav-card card" v-for="item in favorites" :key="item.id" @click="goDetail(item)">
        <view class="fav-header">
          <text class="fav-type" :class="item.targetType">{{ typeLabel(item.targetType) }}</text>
          <text class="fav-date">{{ formatDate(item.createdAt) }}</text>
        </view>
        <text class="fav-title">{{ item.title }}</text>
        <text class="fav-summary" v-if="item.summary">{{ item.summary }}</text>
        <view class="fav-action">
          <text class="fav-del" @click.stop="removeFav(item.id)">取消收藏</text>
        </view>
      </view>
    </view>
    <view class="load-more" v-if="hasMore" @click="loadMore">加载更多</view>
    <view class="empty" v-if="favorites.length === 0">暂无收藏</view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

const favorites = ref<any[]>([]);
const page = ref(1);
const hasMore = ref(true);

async function load() {
  try {
    const res = await api.favorites.list(page.value) as any;
    const data = res.data;
    favorites.value = [...favorites.value, ...data.list];
    hasMore.value = favorites.value.length < data.total;
  } catch { /* ignore */ }
}

function loadMore() { page.value++; load(); }

async function removeFav(id: string) {
  try {
    await api.favorites.remove(id);
    favorites.value = favorites.value.filter(f => f.id !== id);
    uni.showToast({ title: '已取消', icon: 'none' });
  } catch { uni.showToast({ title: '操作失败', icon: 'error' }); }
}

function goDetail(item: any) {
  if (item.targetType === 'article') {
    uni.navigateTo({ url: `/pages/articles/detail?id=${item.targetId}` });
  } else if (item.targetType === 'knowledge') {
    uni.navigateTo({ url: `/pages/knowledge/detail?id=${item.targetId}` });
  } else if (item.targetType === 'university') {
    uni.navigateTo({ url: `/pages/universities/detail?id=${item.targetId}` });
  } else if (item.targetType === 'major') {
    uni.navigateTo({ url: `/pages/majors/detail?id=${item.targetId}` });
  } else if (item.targetType === 'consultation') {
    userStore.loadSessionId = item.targetId;
    uni.switchTab({ url: '/pages/consult/index' });
  } else if (item.targetType === 'volunteer_report') {
    uni.navigateTo({ url: `/pages/volunteer/report?id=${item.targetId}` });
  }
}

function typeLabel(type: string) {
  if (type === 'article') return '文章';
  if (type === 'knowledge') return '知识';
  if (type === 'university') return '院校';
  if (type === 'major') return '专业';
  if (type === 'volunteer_report') return '志愿报告';
  return '咨询';
}

function formatDate(d: string) {
  return d ? new Date(d).toLocaleDateString('zh-CN') : '';
}

onMounted(load);
</script>

<style lang="scss" scoped>
.fav-page { padding: $spacing-md; min-height: 100vh; }
.fav-card { padding: $spacing-md; margin: 0 0 $spacing-sm; }
.fav-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: $spacing-xs; }
.fav-type { font-size: $font-xs; padding: 2rpx 12rpx; border-radius: 4rpx; }
.fav-type.article { background: rgba(0,245,255,0.1); color: $primary; }
.fav-type.consultation { background: rgba(124,58,237,0.1); color: $secondary; }
.fav-type.knowledge { background: rgba(15,118,110,0.10); color: #0f766e; }
.fav-type.university { background: rgba(37,99,235,0.10); color: #2563eb; }
.fav-type.major { background: rgba(217,119,6,0.12); color: #b45309; }
.fav-type.volunteer_report { background: rgba(5,150,105,0.12); color: #047857; }
.fav-date { font-size: $font-xs; color: $text-dim; }
.fav-title { font-size: $font-md; font-weight: 600; display: block; margin-bottom: 4rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fav-summary { font-size: $font-xs; color: $text-secondary; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.fav-action { margin-top: $spacing-sm; text-align: right; }
.fav-del { font-size: $font-xs; color: $danger; }
.load-more { text-align: center; padding: $spacing-md; font-size: $font-sm; color: $text-secondary; }
.empty { text-align: center; padding: 120rpx 0; color: $text-dim; }
</style>
