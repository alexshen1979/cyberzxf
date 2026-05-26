<template>
  <view class="library-page">
    <view class="library-hero">
      <view>
        <text class="hero-kicker">资料库</text>
        <text class="hero-title">{{ activeLibraryMeta.title }}</text>
      </view>
      <text class="hero-count" v-if="activeTotal">{{ activeTotal }} 条</text>
    </view>

    <view class="library-switch">
      <view
        class="library-card"
        :class="[item.key, { active: activeLibrary === item.key }]"
        v-for="item in libraries"
        :key="item.key"
        @click="switchLibrary(item.key)"
      >
        <text class="library-title">{{ item.title }}</text>
        <text class="library-desc">{{ item.desc }}</text>
      </view>
    </view>

    <view class="volunteer-banner" @click="openVolunteerTool">
      <view class="banner-copy">
        <text class="banner-kicker">智能推荐</text>
        <text class="banner-title">AI 高考志愿分析</text>
        <text class="banner-desc">按分数、位次、城市和专业偏好生成冲稳保方案</text>
      </view>
      <view class="banner-action">
        <text>去分析</text>
      </view>
      <view class="banner-mark">AI</view>
    </view>

    <view class="search-bar">
      <input
        class="search-input"
        v-model="keyword"
        :placeholder="activeLibraryMeta.placeholder"
        confirm-type="search"
        @confirm="doSearch"
      />
      <text class="search-btn" @click="doSearch">搜索</text>
    </view>

    <scroll-view class="category-bar" scroll-x v-if="filterTags.length">
      <view
        class="category-tag"
        :class="{ active: activeFilter === tag.value }"
        v-for="tag in filterTags"
        :key="tag.value || 'all'"
        @click="switchFilter(tag.value)"
      >
        <text>{{ tag.label }}</text>
      </view>
    </scroll-view>

    <view class="university-level-filter" v-if="activeLibrary === 'universities'">
      <text
        class="level-filter-chip"
        :class="{ active: activeUniversityLevel === item.value }"
        v-for="item in universityLevelOptions"
        :key="item.value || 'all-levels'"
        @click="switchUniversityLevel(item.value)"
      >{{ item.label }}</text>
    </view>

    <view class="entry-list">
      <view
        class="entry-card"
        v-for="entry in entries"
        :key="`${activeLibrary}-${entry.id}`"
        @click="openDetail(entry)"
      >
        <view class="entry-header">
          <view class="entry-title-wrap">
            <text class="entry-title">{{ entryTitle(entry) }}</text>
            <text class="entry-subtitle" v-if="entrySubtitle(entry)">{{ entrySubtitle(entry) }}</text>
          </view>
          <text class="entry-badge">{{ entryBadge(entry) }}</text>
        </view>

        <view class="entry-tags" v-if="entryTags(entry).length">
          <text class="tag" v-for="t in entryTags(entry)" :key="t">{{ t }}</text>
        </view>

        <text class="entry-summary" v-if="entrySummary(entry)">{{ entrySummary(entry) }}</text>

        <view class="entry-meta">
          <text>{{ activeLibraryMeta.detailLabel }}</text>
          <text v-if="activeLibrary === 'knowledge'">{{ entry.viewCount || 0 }} 浏览</text>
        </view>
      </view>
    </view>

    <view class="load-more" v-if="loading && entries.length">加载中...</view>
    <view class="empty" v-if="!loading && entries.length === 0">暂无资料</view>
    <view class="no-more" v-if="!hasMore && entries.length">—— 没有更多了 ——</view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { onLoad, onPullDownRefresh, onReachBottom, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app';
import { api } from '@/api';
import { recordShare, withShareRef } from '@/utils/share';

type LibraryKey = 'universities' | 'majors' | 'knowledge';

const libraries: Array<{ key: LibraryKey; title: string; desc: string; placeholder: string; detailLabel: string }> = [
  { key: 'universities', title: '院校库', desc: '学校层次与城市', placeholder: '搜索院校名称、城市', detailLabel: '查看院校详情' },
  { key: 'majors', title: '专业库', desc: '方向、就业与风险', placeholder: '搜索专业名称、方向', detailLabel: '查看专业详情' },
  { key: 'knowledge', title: '知识库', desc: '政策、分数线、解读', placeholder: '搜索知识标题、内容', detailLabel: '查看知识详情' },
];

const activeLibrary = ref<LibraryKey>('universities');
const keyword = ref('');
const entries = ref<any[]>([]);
const page = ref(1);
const pageSize = 20;
const hasMore = ref(true);
const loading = ref(false);
const totals = reactive<Record<LibraryKey, number>>({ universities: 0, majors: 0, knowledge: 0 });

const universityProvinces = ref<string[]>([]);
const majorCategories = ref<string[]>([]);
const knowledgeCategories = ref<string[]>([]);
const activeUniversityProvince = ref('');
const activeUniversityLevel = ref('');
const activeMajorCategory = ref('');
const activeKnowledgeCategory = ref('');
const universityLevelOptions = [
  { label: '全部层次', value: '' },
  { label: '本科', value: '本科' },
  { label: '专科', value: '专科' },
];

const activeLibraryMeta = computed(() => libraries.find(item => item.key === activeLibrary.value) || libraries[0]);
const activeTotal = computed(() => totals[activeLibrary.value]);
const activeFilter = computed(() => {
  if (activeLibrary.value === 'universities') return activeUniversityProvince.value;
  if (activeLibrary.value === 'majors') return activeMajorCategory.value;
  return activeKnowledgeCategory.value;
});
const filterTags = computed(() => {
  const base = [{ label: '全部', value: '' }];
  if (activeLibrary.value === 'universities') {
    return base.concat(universityProvinces.value.slice(0, 30).map(item => ({ label: item, value: item })));
  }
  if (activeLibrary.value === 'majors') {
    return base.concat(majorCategories.value.map(item => ({ label: item, value: item })));
  }
  return base.concat(knowledgeCategories.value.map(item => ({ label: item, value: item })));
});

function switchLibrary(key: LibraryKey) {
  if (activeLibrary.value === key) return;
  activeLibrary.value = key;
  keyword.value = '';
  uni.setNavigationBarTitle({ title: activeLibraryMeta.value.title });
  refreshEntries();
}

function switchFilter(value: string) {
  if (activeLibrary.value === 'universities') activeUniversityProvince.value = value;
  else if (activeLibrary.value === 'majors') activeMajorCategory.value = value;
  else activeKnowledgeCategory.value = value;
  doSearch();
}

function switchUniversityLevel(value: string) {
  if (activeUniversityLevel.value === value) return;
  activeUniversityLevel.value = value;
  doSearch();
}

function doSearch() {
  page.value = 1;
  entries.value = [];
  hasMore.value = true;
  loadEntries();
}

function openVolunteerTool() {
  uni.switchTab({ url: '/pages/volunteer/index' });
}

async function loadFilterOptions() {
  if (activeLibrary.value === 'universities' && universityProvinces.value.length === 0) {
    const res = await api.universities.filters() as any;
    universityProvinces.value = res.data?.provinces || [];
  } else if (activeLibrary.value === 'majors' && majorCategories.value.length === 0) {
    const res = await api.majors.categories();
    majorCategories.value = res.data || [];
  } else if (activeLibrary.value === 'knowledge' && knowledgeCategories.value.length === 0) {
    const res = await api.knowledge.categories();
    knowledgeCategories.value = res.data || [];
  }
}

async function loadEntries() {
  if (loading.value) return;
  loading.value = true;
  try {
    let res: any;
    if (activeLibrary.value === 'universities') {
      res = await api.universities.list(page.value, pageSize, {
        keyword: keyword.value || undefined,
        province: activeUniversityProvince.value || undefined,
        level: activeUniversityLevel.value || undefined,
      });
    } else if (activeLibrary.value === 'majors') {
      res = await api.majors.list(
        page.value,
        pageSize,
        activeMajorCategory.value || undefined,
        keyword.value || undefined,
      );
    } else {
      res = await api.knowledge.list(
        page.value,
        pageSize,
        activeKnowledgeCategory.value || undefined,
        keyword.value || undefined,
      );
    }
    const data = res.data || {};
    entries.value = [...entries.value, ...(data.list || [])];
    totals[activeLibrary.value] = data.total || 0;
    hasMore.value = entries.value.length < (data.total || 0);
  } finally {
    loading.value = false;
  }
}

function loadMore() {
  if (!hasMore.value || loading.value) return;
  page.value++;
  loadEntries();
}

onReachBottom(() => {
  loadMore();
});

async function refreshEntries() {
  page.value = 1;
  entries.value = [];
  hasMore.value = true;
  await loadFilterOptions();
  await loadEntries();
}

function openDetail(entry: any) {
  if (activeLibrary.value === 'universities') {
    uni.navigateTo({ url: `/pages/universities/detail?id=${entry.id}` });
  } else if (activeLibrary.value === 'majors') {
    uni.navigateTo({ url: `/pages/majors/detail?id=${entry.id}` });
  } else {
    uni.navigateTo({ url: `/pages/knowledge/detail?id=${entry.id}` });
  }
}

function entryTitle(entry: any) {
  return entry.name || entry.title || '资料详情';
}

function entrySubtitle(entry: any) {
  if (activeLibrary.value === 'universities') {
    return [entry.province, entry.city].filter(Boolean).join(' · ');
  }
  if (activeLibrary.value === 'majors') {
    return [entry.category, entry.degreeType].filter(Boolean).join(' · ');
  }
  return entry.sourceName ? `来源：${entry.sourceName}` : '';
}

function entryBadge(entry: any) {
  if (activeLibrary.value === 'universities') return entry.level || entry.type || '院校';
  if (activeLibrary.value === 'majors') return entry.category || '专业';
  return entry.category || '知识';
}

function entryTags(entry: any) {
  if (activeLibrary.value === 'universities') {
    return [
      entry.is985 ? '985' : '',
      entry.is211 ? '211' : '',
      entry.isDoubleFirst ? '双一流' : '',
      ...(Array.isArray(entry.featureTags) ? entry.featureTags : []),
      entry.level,
      entry.type,
      entry.properties,
    ].filter(Boolean);
  }
  return (Array.isArray(entry.tags) ? entry.tags : []);
}

function entrySummary(entry: any) {
  if (activeLibrary.value === 'universities') return entry.introduction || '';
  if (activeLibrary.value === 'majors') return entry.employment || entry.description || '';
  return '';
}

function normalizeLibraryKey(value?: string): LibraryKey {
  if (value === 'majors' || value === 'major') return 'majors';
  if (value === 'knowledge') return 'knowledge';
  return 'universities';
}

onLoad((query: any) => {
  activeLibrary.value = normalizeLibraryKey(query?.tab || query?.type);
  uni.setNavigationBarTitle({ title: activeLibraryMeta.value.title });
  if (query?.id) {
    uni.navigateTo({ url: `/pages/knowledge/detail?id=${query.id}` });
  }
});

onShow(() => {
  const id = uni.getStorageSync('open_knowledge_id');
  if (id) {
    uni.removeStorageSync('open_knowledge_id');
    uni.navigateTo({ url: `/pages/knowledge/detail?id=${id}` });
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
  const path = withShareRef(`/pages/knowledge/index?tab=${activeLibrary.value}`);
  recordShare('friend', path);
  return {
    title: activeLibraryMeta.value.title,
    path,
  };
});

onShareTimeline(() => {
  const path = withShareRef(`/pages/knowledge/index?tab=${activeLibrary.value}`);
  recordShare('timeline', path);
  return {
    title: activeLibraryMeta.value.title,
    query: path.split('?')[1] || '',
  };
});

onMounted(() => {
  refreshEntries();
});
</script>

<style lang="scss" scoped>
.library-page {
  min-height: 100vh;
  padding: 24rpx $spacing-md 64rpx;
  background: linear-gradient(180deg, #f8fafc 0%, #eef6ff 42%, #fff7ed 100%);
}

.library-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.hero-kicker,
.library-desc,
.entry-subtitle,
.entry-meta {
  color: $text-secondary;
}

.hero-kicker {
  display: block;
  font-size: 24rpx;
  font-weight: 800;
}

.hero-title {
  display: block;
  color: $text-primary;
  font-size: 44rpx;
  font-weight: 900;
  line-height: 1.2;
  margin-top: 4rpx;
}

.hero-count {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: $radius-full;
  background: #ffffff;
  color: #0f766e;
  font-size: 24rpx;
  font-weight: 800;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
}

.library-switch {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.library-card {
  min-height: 126rpx;
  padding: 18rpx;
  border-radius: 18rpx;
  background: #fff;
  border: 2rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.04);
  box-sizing: border-box;
}

.library-card.active {
  border-color: transparent;
}

.library-card.universities.active {
  background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%);
}

.library-card.majors.active {
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
}

.library-card.knowledge.active {
  background: linear-gradient(135deg, #b45309 0%, #f97316 100%);
}

.library-title {
  display: block;
  color: $text-primary;
  font-size: 29rpx;
  font-weight: 900;
  line-height: 1.25;
}

.library-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 21rpx;
  line-height: 1.35;
}

.library-card.active .library-title,
.library-card.active .library-desc {
  color: #fff;
}

.volunteer-banner {
  position: relative;
  overflow: hidden;
  min-height: 168rpx;
  padding: 28rpx 28rpx;
  margin-bottom: 18rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(135deg, #13251f 0%, #0f766e 52%, #f97316 100%);
  box-shadow: 0 18rpx 42rpx rgba(15, 118, 110, 0.22);
  box-sizing: border-box;
}

.volunteer-banner::before {
  content: "";
  position: absolute;
  right: -76rpx;
  top: -92rpx;
  width: 260rpx;
  height: 260rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.16);
  border-radius: 50%;
}

.volunteer-banner::after {
  content: "";
  position: absolute;
  right: 132rpx;
  bottom: -96rpx;
  width: 220rpx;
  height: 220rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.10);
}

.banner-copy,
.banner-action {
  position: relative;
  z-index: 1;
}

.banner-copy {
  flex: 1;
  min-width: 0;
}

.banner-kicker {
  display: block;
  margin-bottom: 8rpx;
  color: rgba(255, 255, 255, 0.76);
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.2;
}

.banner-title {
  display: block;
  color: #fff;
  font-size: 36rpx;
  line-height: 1.25;
  font-weight: 900;
}

.banner-desc {
  display: block;
  margin-top: 8rpx;
  max-width: 470rpx;
  color: rgba(255, 255, 255, 0.82);
  font-size: 23rpx;
  line-height: 1.45;
}

.search-btn {
  flex-shrink: 0;
  color: #fff;
  background: $brand;
  font-weight: 800;
}

.banner-action {
  flex-shrink: 0;
  padding: 13rpx 22rpx;
  border-radius: $radius-full;
  background: rgba(255, 255, 255, 0.94);
  color: #0f766e;
  font-size: 24rpx;
  font-weight: 900;
  box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.14);
}

.banner-mark {
  position: absolute;
  right: 38rpx;
  bottom: 22rpx;
  color: rgba(255, 255, 255, 0.13);
  font-size: 78rpx;
  line-height: 1;
  font-weight: 900;
}

.search-bar {
  display: flex;
  gap: $spacing-sm;
  margin-bottom: 14rpx;
}

.search-input {
  flex: 1;
  height: 72rpx;
  padding: 0 $spacing-md;
  background: $bg-card;
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  border-radius: 18rpx;
  font-size: $font-sm;
  box-sizing: border-box;
}

.search-btn {
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 $spacing-lg;
  border-radius: 18rpx;
  font-size: $font-sm;
}

.category-bar {
  white-space: nowrap;
  margin-bottom: 18rpx;
  padding: 4rpx 0 8rpx;
}

.category-tag {
  display: inline-block;
  padding: 10rpx 20rpx;
  margin-right: 12rpx;
  background: rgba(255, 255, 255, 0.82);
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  border-radius: $radius-full;
  font-size: 24rpx;
  color: $text-secondary;
}

.category-tag.active {
  background: #0f172a;
  color: #fff;
  border-color: #0f172a;
  font-weight: 800;
}

.university-level-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin: -4rpx 0 18rpx;
}

.level-filter-chip {
  padding: 10rpx 20rpx;
  border-radius: $radius-full;
  background: rgba(255, 255, 255, 0.82);
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  color: $text-secondary;
  font-size: 24rpx;
  font-weight: 700;
}

.level-filter-chip.active {
  background: #ecfdf5;
  border-color: #6ee7b7;
  color: #047857;
  font-weight: 900;
}

.entry-card {
  padding: 24rpx;
  margin-bottom: 16rpx;
  border-radius: 20rpx;
  background: #fff;
  border: 1rpx solid rgba(15, 23, 42, 0.07);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.05);
}

.entry-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.entry-title-wrap {
  flex: 1;
  min-width: 0;
}

.entry-title {
  display: block;
  color: $text-primary;
  font-size: 31rpx;
  font-weight: 900;
  line-height: 1.35;
}

.entry-subtitle {
  display: block;
  margin-top: 6rpx;
  font-size: 23rpx;
  line-height: 1.35;
}

.entry-badge {
  flex-shrink: 0;
  max-width: 180rpx;
  padding: 6rpx 12rpx;
  border-radius: $radius-full;
  background: #eff6ff;
  color: #2563eb;
  font-size: 22rpx;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 16rpx;
}

.tag {
  padding: 5rpx 12rpx;
  border-radius: $radius-full;
  background: #ecfdf5;
  color: #047857;
  font-size: 21rpx;
  font-weight: 700;
}

.entry-summary {
  display: -webkit-box;
  margin-top: 16rpx;
  color: $text-secondary;
  font-size: 25rpx;
  line-height: 1.55;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.entry-meta {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 18rpx;
  font-size: 23rpx;
}

.load-more,
.no-more,
.empty {
  text-align: center;
  padding: 30rpx 0;
  color: $text-secondary;
  font-size: $font-sm;
}

.empty {
  padding: 110rpx 0;
}
</style>
