<template>
  <view class="articles-page">
    <!-- 分类切换 -->
    <scroll-view class="category-bar" scroll-x>
      <view class="category-tag" v-for="cat in categories" :key="cat.key"
        :class="{ active: activeCategory === cat.key }" @click="switchCategory(cat.key)">
        <text>{{ cat.label }}</text>
      </view>
    </scroll-view>

    <!-- 文章列表 -->
    <view class="article-list">
      <view class="article-card card" v-for="article in articles" :key="article.id" @click="goDetail(article.id)">
        <image class="article-cover" :src="article.cover || defaultCover" mode="aspectFill" />
        <view class="article-info">
          <text class="article-title">{{ article.title }}</text>
          <view class="article-meta">
            <text class="article-category">{{ categoryLabel(article.category) }}</text>
            <text class="article-views">{{ article.viewCount }} 阅读</text>
          </view>
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

const categories = [
  { key: '', label: '全部' },
  { key: 'gaokao', label: '高考志愿' },
  { key: 'kaoyan', label: '考研规划' },
  { key: 'zhiye', label: '职业发展' },
  { key: 'bimian', label: '专业避坑' },
];

const categoryLabels: Record<string, string> = {
  gaokao: '高考志愿',
  kaoyan: '考研规划',
  zhiye: '职业发展',
  bimian: '专业避坑',
};

const activeCategory = ref('');
const articles = ref<any[]>([]);
const page = ref(1);
const hasMore = ref(true);
const defaultCover = '/static/images/article-default.png';

function categoryLabel(key: string) {
  return categoryLabels[key] || key;
}

function switchCategory(key: string) {
  activeCategory.value = key;
  page.value = 1;
  articles.value = [];
  hasMore.value = true;
  loadArticles();
}

async function loadArticles() {
  const res = await api.articles.list(page.value, 20, activeCategory.value || undefined);
  const data = res.data as any;
  articles.value = [...articles.value, ...data.list];
  hasMore.value = articles.value.length < data.total;
}

function loadMore() {
  page.value++;
  loadArticles();
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/articles/detail?id=${id}` });
}

onMounted(() => {
  loadArticles();
});
</script>

<style lang="scss" scoped>

.articles-page {
  padding: $spacing-md;
  min-height: 100vh;
}

.category-bar {
  white-space: nowrap;
  margin-bottom: $spacing-md;
  padding: $spacing-xs 0;
}

.category-tag {
  display: inline-block;
  padding: $spacing-xs $spacing-md;
  margin-right: $spacing-sm;
  background: $bg-card;
  border: 1rpx solid $border-color;
  border-radius: $radius-lg;
  font-size: $font-sm;
  color: $text-secondary;

  &.active {
    background: linear-gradient(135deg, $primary-dark, $secondary);
    color: #fff;
    border-color: transparent;
  }
}

.article-card {
  display: flex;
  gap: $spacing-sm;
  padding: $spacing-sm;
  margin: 0 0 $spacing-sm;
}

.article-cover {
  width: 160rpx;
  height: 120rpx;
  border-radius: $radius-sm;
  flex-shrink: 0;
  background: $bg-secondary;
}

.article-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.article-title {
  font-size: $font-md;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.article-meta {
  display: flex;
  justify-content: space-between;
  font-size: $font-xs;
  color: $text-dim;
}

.load-more, .no-more {
  text-align: center;
  padding: $spacing-md;
  font-size: $font-sm;
  color: $text-secondary;
}
</style>
