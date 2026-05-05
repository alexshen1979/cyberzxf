<template>
  <view class="article-detail">
    <view class="article-header" v-if="article">
      <text class="article-title">{{ article.title }}</text>
      <view class="article-meta">
        <text class="article-category">{{ article.category }}</text>
        <text class="article-date">{{ formatDate(article.createdAt) }}</text>
      </view>
      <view class="article-actions">
        <view class="action-btn" @click="toggleFav">
          <text>{{ isFavorited ? '⭐' : '☆' }} 收藏</text>
        </view>
      </view>
    </view>
    <view class="article-content" v-if="article">
      <rich-text :nodes="article.content"></rich-text>
    </view>
    <view class="loading" v-else>
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '@/api';

const article = ref<any>(null);
const isFavorited = ref(false);

onLoad(async (options: any) => {
  if (options?.id) {
    const res = await api.articles.detail(options.id);
    article.value = res.data;
    checkFav(options.id);
  }
});

async function checkFav(articleId: string) {
  try {
    const res = await api.favorites.check('article', articleId);
    isFavorited.value = (res.data as any)?.favorited || false;
  } catch { /* ignore */ }
}

async function toggleFav() {
  if (!article.value?.id) return;
  try {
    const res = await api.favorites.toggle('article', article.value.id);
    const result = res.data as any;
    isFavorited.value = result.favorited;
    uni.showToast({ title: result.favorited ? '已收藏' : '已取消', icon: 'none' });
  } catch (e: any) {
    uni.showToast({ title: e.message || '操作失败', icon: 'error' });
  }
}

function formatDate(d: string) {
  return d ? new Date(d).toLocaleDateString('zh-CN') : '';
}
</script>

<style lang="scss" scoped>
.article-detail { padding: 32rpx; color: #e8eaf0; }
.article-header { margin-bottom: 32rpx; padding-bottom: 24rpx; border-bottom: 1rpx solid #1e2550; }
.article-title { font-size: 40rpx; font-weight: 700; display: block; }
.article-meta { display: flex; gap: 16rpx; margin-top: 16rpx; font-size: 24rpx; color: #5a6080; }
.article-actions { margin-top: 16rpx; display: flex; gap: 16rpx; }
.action-btn { padding: 8rpx 24rpx; border-radius: 32rpx; border: 1rpx solid #1e2550; font-size: 24rpx; color: #ffd700; }
.article-content { line-height: 1.8; }
.loading { text-align: center; padding: 120rpx 0; color: #5a6080; }
</style>
