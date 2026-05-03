<template>
  <view class="article-detail">
    <view class="article-header" v-if="article">
      <text class="article-title">{{ article.title }}</text>
      <view class="article-meta">
        <text class="article-category">{{ article.category }}</text>
        <text class="article-date">{{ formatDate(article.createdAt) }}</text>
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
import { ref, onLoad } from 'vue';
import { api } from '@/api';

const article = ref<any>(null);

onLoad(async (options: any) => {
  if (options?.id) {
    const res = await api.articles.detail(options.id);
    article.value = res.data;
  }
});

function formatDate(d: string) {
  return d ? new Date(d).toLocaleDateString('zh-CN') : '';
}
</script>

<style lang="scss" scoped>
.article-detail { padding: 32rpx; color: #e8eaf0; }
.article-header { margin-bottom: 32rpx; padding-bottom: 24rpx; border-bottom: 1rpx solid #1e2550; }
.article-title { font-size: 40rpx; font-weight: 700; display: block; }
.article-meta { display: flex; gap: 16rpx; margin-top: 16rpx; font-size: 24rpx; color: #5a6080; }
.article-content { line-height: 1.8; }
.loading { text-align: center; padding: 120rpx 0; color: #5a6080; }
</style>
