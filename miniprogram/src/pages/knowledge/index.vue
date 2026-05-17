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

    <view class="volunteer-tool card" @click="openVolunteerTool">
      <view>
        <text class="tool-title">AI 高考志愿分析</text>
        <text class="tool-desc">填写分数、位次和偏好，生成冲稳保建议报告</text>
      </view>
      <view class="tool-side">
        <view class="tool-bars">
          <text class="tool-bar rush"></text>
          <text class="tool-bar steady"></text>
          <text class="tool-bar safe"></text>
        </view>
        <text class="tool-action">开始</text>
      </view>
    </view>

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
    <view class="detail-overlay" v-if="showDetail" @click="closeDetail">
      <view class="detail-panel" @click.stop>
        <view class="detail-header">
          <text class="detail-title">{{ detailItem?.title }}</text>
          <text class="detail-close" @click="closeDetail">✕</text>
        </view>
        <view class="detail-actions" v-if="detailItem?.id">
          <view class="detail-action" :class="{ active: detailFavorited }" @click="toggleFavorite">
            <text>{{ detailFavorited ? '已收藏' : '收藏' }}</text>
          </view>
          <button class="detail-action share" open-type="share">
            <text>分享</text>
          </button>
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
import { onLoad, onPullDownRefresh, onShareAppMessage, onShow } from '@dcloudio/uni-app';
import { api } from '@/api';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

const categories = ref<string[]>(['']);
const activeCategory = ref('');
const keyword = ref('');
const entries = ref<any[]>([]);
const page = ref(1);
const hasMore = ref(true);

const showDetail = ref(false);
const detailItem = ref<any>(null);
const detailFavorited = ref(false);

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

function openVolunteerTool() {
  uni.navigateTo({ url: '/pages/volunteer/index' });
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
  detailFavorited.value = false;
  detailItem.value = Object.assign({}, entry, { content: '' });
  const res = await api.knowledge.detail(entry.id);
  detailItem.value = (res.data as any);
  await checkFavorite(entry.id);
}

function closeDetail() {
  showDetail.value = false;
}

async function checkFavorite(id: string) {
  if (!userStore.isLogin || !id) return;
  try {
    const res = await api.favorites.check('knowledge', id) as any;
    detailFavorited.value = Boolean(res.data?.favorited);
  } catch {
    detailFavorited.value = false;
  }
}

async function toggleFavorite() {
  if (!detailItem.value?.id) return;
  if (!userStore.isLogin) {
    userStore.loginWithWechatProfile();
    return;
  }
  try {
    const res = await api.favorites.toggle('knowledge', detailItem.value.id) as any;
    detailFavorited.value = Boolean(res.data?.favorited);
    uni.showToast({ title: detailFavorited.value ? '已收藏' : '已取消', icon: 'none' });
  } catch (err: any) {
    uni.showToast({ title: err?.message || '收藏失败', icon: 'none' });
  }
}

async function loadCategories() {
  const res = await api.knowledge.categories();
  const data = res.data as string[];
  categories.value = ['', ...data];
}

async function refreshEntries() {
  page.value = 1;
  entries.value = [];
  hasMore.value = true;
  await Promise.all([loadCategories(), loadEntries()]);
}

onLoad((query: any) => {
  if (query?.id) {
    openDetail({ id: query.id, title: '资料详情' });
  }
});

onShow(() => {
  const id = uni.getStorageSync('open_knowledge_id');
  if (id) {
    uni.removeStorageSync('open_knowledge_id');
    openDetail({ id, title: '资料详情' });
  }
});

onPullDownRefresh(async () => {
  try {
    await refreshEntries();
  } finally {
    uni.stopPullDownRefresh();
  }
});

onShareAppMessage(() => {
  const title = detailItem.value?.title || '高考资料';
  const path = detailItem.value?.id ? `/pages/knowledge/index?id=${detailItem.value.id}` : '/pages/knowledge/index';
  return { title, path };
});

onMounted(() => {
  refreshEntries();
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
    background: linear-gradient(135deg, #6f7d4a, #c77d57);
    color: #fff;
    border-color: transparent;
  }
}

.volunteer-tool {
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-md;
  border-color: rgba(111, 125, 74, 0.14);
  background: linear-gradient(135deg, #edf3e8 0%, #ffffff 58%, #fff7eb 100%);
  box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.04);
}

.tool-title {
  display: block;
  font-size: $font-md;
  font-weight: 700;
  color: $text-primary;
}

.tool-desc {
  display: block;
  margin-top: 6rpx;
  font-size: $font-xs;
  color: $text-secondary;
  line-height: 1.45;
}

.tool-side {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.tool-bars {
  display: flex;
  gap: 6rpx;
  align-items: flex-end;
}

.tool-bar {
  display: block;
  width: 10rpx;
  border-radius: $radius-full;
}

.tool-bar.rush {
  height: 28rpx;
  background: #d97961;
}

.tool-bar.steady {
  height: 38rpx;
  background: #d6a85c;
}

.tool-bar.safe {
  height: 22rpx;
  background: #789262;
}

.tool-action {
  flex-shrink: 0;
  padding: 10rpx 18rpx;
  border-radius: $radius-full;
  background: #6f7d4a;
  color: #fff;
  font-size: $font-xs;
  font-weight: 700;
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
  height: 92vh;
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
  line-height: 1.35;
}

.detail-close {
  font-size: 40rpx;
  color: $text-tertiary;
  padding: $spacing-xs;
}

.detail-actions {
  display: flex;
  gap: 12rpx;
  padding: 0 $spacing-lg $spacing-sm;
  flex-shrink: 0;
}

.detail-action {
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 24rpx;
  border-radius: 16rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  background: #f8fafc;
  color: $text-secondary;
  font-size: $font-sm;
  box-sizing: border-box;
}

.detail-action.active {
  color: #0f766e;
  background: #ecfdf5;
  border-color: rgba(15, 118, 110, 0.18);
}

button.detail-action {
  margin: 0;
}

button.detail-action::after {
  border: 0;
}

.detail-body {
  flex: 1;
  padding: $spacing-lg;
  overflow-y: auto;
  box-sizing: border-box;
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
