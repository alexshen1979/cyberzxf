<template>
  <view class="knowledge-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <input
        class="search-input"
        v-model="keyword"
        placeholder="搜索知识库..."
        confirm-type="search"
        @confirm="doSearch"
      />
      <text class="search-btn" @click="doSearch">搜索</text>
    </view>

    <!-- 分类切换 -->
    <scroll-view class="category-bar" scroll-x>
      <view
        class="category-tag"
        :class="{ active: activeCategory === cat }"
        v-for="cat in categories"
        :key="cat"
        @click="switchCategory(cat)"
      >
        <text>{{ cat === '' ? '全部' : cat }}</text>
      </view>
    </scroll-view>

    <!-- 知识条目列表 -->
    <view class="entry-list">
      <view class="entry-card card" v-for="entry in entries" :key="entry.id" @click="openDetail(entry)">
        <view class="entry-header">
          <text class="entry-title">{{ entry.title }}</text>
          <text class="entry-category-text">{{ entry.category }}</text>
        </view>
        <view class="entry-tags" v-if="entry.tags && entry.tags.length">
          <text class="tag" v-for="t in entry.tags" :key="t">{{ t }}</text>
        </view>
        <view class="entry-meta">
          <text class="entry-source" v-if="entry.sourceName">来源：{{ entry.sourceName }}</text>
          <text class="entry-views">{{ entry.viewCount }} 浏览</text>
        </view>
      </view>
    </view>

    <view class="load-more" v-if="hasMore" @click="loadMore">加载更多</view>
    <view class="no-more" v-else>—— 没有更多了 ——</view>

    <!-- 详情弹窗 -->
    <view class="detail-overlay" v-if="showDetail" @click="showDetail = false">
      <view class="detail-panel" @click.stop>
        <view class="detail-header">
          <text class="detail-title">{{ detailItem?.title }}</text>
          <text class="detail-close" @click="showDetail = false">✕</text>
        </view>
        <scroll-view class="detail-body" scroll-y>
          <view class="detail-meta">
            <text class="detail-cat">{{ detailItem?.category }}</text>
            <text class="detail-source" v-if="detailItem?.sourceName">来源：{{ detailItem?.sourceName }}</text>
            <text class="detail-date" v-if="detailItem?.sourceDate">{{ detailItem?.sourceDate }}</text>
          </view>
          <view class="detail-content" v-if="detailItem?.content">
            <rich-text :nodes="detailItem.content"></rich-text>
          </view>
          <view class="detail-loading" v-else>
            <text>加载中...</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';

const categories = ref<string[]>(['']);
const activeCategory = ref('');
const keyword = ref('');
const entries = ref<any[]>([]);
const page = ref(1);
const hasMore = ref(true);

const showDetail = ref(false);
const detailItem = ref<any>(null);

function switchCategory(cat: string) {
  activeCategory.value = cat;
  page.value = 1;
  entries.value = [];
  hasMore.value = true;
  loadEntries();
}

function doSearch() {
  page.value = 1;
  entries.value = [];
  hasMore.value = true;
  loadEntries();
}

async function loadEntries() {
  const res = await api.knowledge.list(page.value, 20, activeCategory.value || undefined, keyword.value || undefined);
  const data = res.data as any;
  entries.value = [...entries.value, ...data.list];
  hasMore.value = entries.value.length < data.total;
}

function loadMore() {
  page.value++;
  loadEntries();
}

async function openDetail(entry: any) {
  showDetail.value = true;
  detailItem.value = { ...entry, content: '' };
  const res = await api.knowledge.detail(entry.id);
  detailItem.value = (res.data as any);
}

async function loadCategories() {
  const res = await api.knowledge.categories();
  const data = res.data as string[];
  categories.value = ['', ...data];
}

onMounted(() => {
  loadCategories();
  loadEntries();
});
</script>

<style lang="scss" scoped>
.knowledge-page {
  padding: $spacing-md;
  min-height: 100vh;
}

.search-bar {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.search-input {
  flex: 1;
  height: 72rpx;
  padding: 0 $spacing-md;
  background: $bg-card;
  border: 1rpx solid $border-color;
  border-radius: $radius-lg;
  font-size: $font-sm;
}

.search-btn {
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 $spacing-lg;
  background: $brand;
  color: #fff;
  border-radius: $radius-lg;
  font-size: $font-sm;
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

.entry-card {
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
}

.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: $spacing-sm;
}

.entry-title {
  flex: 1;
  font-size: $font-md;
  font-weight: 500;
  color: $text-primary;
}

.entry-category-text {
  flex-shrink: 0;
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  background: $bg-secondary;
  border-radius: $radius-sm;
  color: $text-secondary;
}

.entry-tags {
  margin-top: $spacing-xs;
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.tag {
  font-size: 22rpx;
  padding: 2rpx 12rpx;
  background: $brand-light;
  color: $brand;
  border-radius: $radius-sm;
}

.entry-meta {
  display: flex;
  justify-content: space-between;
  margin-top: $spacing-sm;
  font-size: $font-xs;
  color: $text-dim;
}

.load-more, .no-more {
  text-align: center;
  padding: $spacing-md;
  font-size: $font-sm;
  color: $text-secondary;
}

// 详情弹窗
.detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.detail-panel {
  width: 100%;
  max-height: 85vh;
  background: #fff;
  border-radius: $radius-xl $radius-xl 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-md $spacing-lg;
  border-bottom: 1rpx solid $border-color;
  flex-shrink: 0;
}

.detail-title {
  font-size: $font-lg;
  font-weight: 600;
  flex: 1;
  margin-right: $spacing-md;
}

.detail-close {
  font-size: 40rpx;
  color: $text-tertiary;
  padding: $spacing-xs;
}

.detail-body {
  flex: 1;
  padding: $spacing-lg;
  overflow-y: auto;
}

.detail-meta {
  display: flex;
  gap: $spacing-md;
  margin-bottom: $spacing-lg;
  padding-bottom: $spacing-md;
  border-bottom: 1rpx solid $border-color;
  font-size: $font-xs;
  color: $text-dim;
}

.detail-content {
  font-size: $font-md;
  line-height: 1.8;
  color: $text-primary;
}

.detail-loading {
  text-align: center;
  padding: $spacing-xl;
  color: $text-tertiary;
}
</style>
