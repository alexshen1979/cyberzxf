<template>
  <view class="knowledge-detail">
    <view class="header-card" v-if="entry">
      <text class="eyebrow">{{ entry.category || '知识库' }}</text>
      <text class="title">{{ entry.title }}</text>
      <view class="meta-row">
        <text v-if="entry.sourceName">来源：{{ entry.sourceName }}</text>
        <text v-if="entry.sourceDate">{{ formatDate(entry.sourceDate) }}</text>
        <text>{{ entry.viewCount || 0 }} 浏览</text>
      </view>
      <view class="tag-row" v-if="tags.length">
        <text class="tag" v-for="tag in tags" :key="tag">{{ tag }}</text>
      </view>
      <view class="favorite-pill" :class="{ active: isFavorited }" @click="toggleFavorite">
        <image class="favorite-icon" :src="favoriteIcon" mode="aspectFit" />
        <text>{{ isFavorited ? '已收藏' : '收藏知识' }}</text>
      </view>
    </view>

    <view class="content-card" v-if="entry">
      <rich-text :nodes="contentNodes"></rich-text>
    </view>

    <view class="loading" v-else>
      <text>{{ loading ? '加载中...' : '知识条目不存在' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { api } from '@/api';
import { useUserStore } from '@/store/user';
import { buildIconSrc } from '@/utils/iconSvgs';
import { recordShare, withShareRef } from '@/utils/share';

const userStore = useUserStore();
const entry = ref<any>(null);
const loading = ref(false);
const isFavorited = ref(false);

const tags = computed(() => Array.isArray(entry.value?.tags) ? entry.value.tags : []);
const favoriteIcon = computed(() => buildIconSrc('Star', isFavorited.value ? '#ffffff' : '#b45309'));
const contentNodes = computed(() => formatKnowledgeContent(entry.value?.content || '暂无正文内容。'));

async function loadEntry(id?: string) {
  if (!id) {
    uni.showToast({ title: '知识 ID 缺失', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    const res = await api.knowledge.detail(id);
    entry.value = res.data;
    if (res.data?.title) uni.setNavigationBarTitle({ title: res.data.title });
    checkFavorite(id);
  } catch (err: any) {
    uni.showToast({ title: err?.message || '知识加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function checkFavorite(id?: string) {
  if (!id || !hasLoginToken()) return;
  try {
    const res = await api.favorites.check('knowledge', id);
    isFavorited.value = Boolean((res.data as any)?.favorited);
  } catch { /* ignore */ }
}

async function toggleFavorite() {
  const id = entry.value?.id;
  if (!id) return;
  if (!hasLoginToken()) {
    userStore.loginWithWechatProfile();
    return;
  }
  try {
    const res = await api.favorites.toggle('knowledge', id);
    const result = res.data as any;
    isFavorited.value = Boolean(result.favorited);
    uni.showToast({ title: result.favorited ? '已收藏' : '已取消', icon: 'none' });
  } catch (err: any) {
    uni.showToast({ title: err?.message || '操作失败', icon: 'none' });
  }
}

function hasLoginToken() {
  return userStore.isLogin || Boolean(uni.getStorageSync('token'));
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('zh-CN') : '';
}

function formatKnowledgeContent(content: string) {
  const text = String(content || '').replace(/\r\n/g, '\n');
  const blocks = text.split(/\n{2,}/).map(item => item.trim()).filter(Boolean);
  const paragraphs = blocks.length ? blocks : [text.trim()].filter(Boolean);
  return paragraphs.map((paragraph) => ({
    name: 'p',
    attrs: { class: 'knowledge-paragraph' },
    children: paragraph.split('\n').flatMap((line, index) => {
      const nodes: any[] = [];
      if (index > 0) nodes.push({ name: 'br' });
      nodes.push({ type: 'text', text: line });
      return nodes;
    }),
  }));
}

onLoad((query: any) => {
  loadEntry(query?.id);
});

onShareAppMessage(() => {
  const path = withShareRef(entry.value?.id ? `/pages/knowledge/detail?id=${entry.value.id}` : '/pages/knowledge/index?tab=knowledge');
  recordShare('friend', path);
  return {
    title: entry.value?.title || '知识详情',
    path,
  };
});

onShareTimeline(() => {
  const path = withShareRef(entry.value?.id ? `/pages/knowledge/detail?id=${entry.value.id}` : '/pages/knowledge/index?tab=knowledge');
  recordShare('timeline', path);
  return {
    title: entry.value?.title || '知识详情',
    query: path.split('?')[1] || '',
  };
});
</script>

<style lang="scss" scoped>
.knowledge-detail {
  min-height: 100vh;
  padding: 24rpx $spacing-md 56rpx;
  background: linear-gradient(180deg, #f8fafc 0%, #eef6ff 45%, #fff7ed 100%);
}

.header-card,
.content-card {
  padding: 28rpx;
  margin-bottom: $spacing-md;
  border-radius: 22rpx;
  background: #fff;
  border: 1rpx solid rgba(15, 23, 42, 0.07);
  box-shadow: 0 14rpx 34rpx rgba(15, 23, 42, 0.05);
}

.header-card {
  background: linear-gradient(135deg, #ffffff 0%, #f0fdfa 52%, #fff7ed 100%);
}

.eyebrow {
  display: block;
  color: #0f766e;
  font-size: 24rpx;
  font-weight: 800;
  margin-bottom: 8rpx;
}

.title {
  display: block;
  color: $text-primary;
  font-size: 40rpx;
  font-weight: 900;
  line-height: 1.3;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 14rpx;
  color: $text-secondary;
  font-size: 23rpx;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 20rpx;
}

.tag {
  padding: 8rpx 14rpx;
  border-radius: $radius-full;
  background: #ecfdf5;
  color: #047857;
  font-size: 22rpx;
  font-weight: 800;
}

.favorite-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin-top: 20rpx;
  padding: 13rpx 24rpx;
  border-radius: $radius-full;
  background: #fff7ed;
  color: #b45309;
  border: 2rpx solid rgba(180, 83, 9, 0.22);
  font-size: 24rpx;
  font-weight: 900;
  box-shadow: 0 8rpx 20rpx rgba(180, 83, 9, 0.10);
}

.favorite-pill.active {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 10rpx 24rpx rgba(217, 119, 6, 0.24);
}

.favorite-icon {
  width: 28rpx;
  height: 28rpx;
  flex-shrink: 0;
}

.content-card {
  color: $text-primary;
  font-size: 28rpx;
  line-height: 1.75;
  word-break: break-word;
}

.content-card :deep(.knowledge-paragraph) {
  margin: 0 0 24rpx;
}

.loading {
  padding: 140rpx 0;
  text-align: center;
  color: $text-tertiary;
  font-size: 28rpx;
}
</style>
