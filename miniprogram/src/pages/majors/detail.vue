<template>
  <view class="major-page">
    <view class="hero-card">
      <view class="hero-top">
        <view class="hero-main">
          <text class="eyebrow">{{ major?.category || '专业库' }}</text>
          <text class="title">{{ major?.name || '专业详情' }}</text>
          <text class="subtitle">{{ [major?.degreeType, major?.riskLevel ? `风险：${major.riskLevel}` : ''].filter(Boolean).join(' · ') }}</text>
        </view>
        <view class="category-badge" v-if="major?.category">{{ major.category }}</view>
      </view>

      <view class="tag-row" v-if="majorTags.length">
        <text class="tag" v-for="tag in majorTags" :key="tag">{{ tag }}</text>
      </view>

      <view class="favorite-pill" :class="{ active: isFavorited }" @click="toggleFavorite">
        <image class="favorite-icon" :src="favoriteIcon" mode="aspectFit" />
        <text>{{ isFavorited ? '已收藏' : '收藏专业' }}</text>
      </view>

      <text class="intro" v-if="primarySummary">{{ primarySummary }}</text>
      <text class="intro muted" v-else>{{ loading ? '正在读取专业资料...' : '该专业说明暂未补充。' }}</text>
    </view>

    <view class="info-card">
      <text class="section-title">专业信息</text>
      <view class="info-row">
        <text class="info-label">门类/大类</text>
        <text class="info-value">{{ major?.category || '待补充' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">培养层次</text>
        <text class="info-value">{{ major?.degreeType || '待补充' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">风险提示</text>
        <text class="info-value">{{ major?.riskLevel || '待补充' }}</text>
      </view>
    </view>

    <view class="info-card" v-if="major?.recommendedFor || major?.avoidFor || major?.description">
      <text class="section-title">选择建议</text>
      <view class="advice-block" v-if="major?.recommendedFor">
        <text class="advice-label">适合人群</text>
        <text class="advice-text">{{ major.recommendedFor }}</text>
      </view>
      <view class="advice-block" v-if="major?.avoidFor">
        <text class="advice-label warning">谨慎人群</text>
        <text class="advice-text">{{ major.avoidFor }}</text>
      </view>
      <view class="advice-block" v-if="major?.description">
        <text class="advice-label">补充说明</text>
        <text class="advice-text">{{ major.description }}</text>
      </view>
    </view>

    <view class="major-ask-card" @click="askAboutMajor">
      <text>问问这个专业</text>
    </view>

    <view class="info-card">
      <view class="section-head">
        <text class="section-title">开设院校</text>
        <text class="section-count" v-if="universityMajors.length">{{ universityMajors.length }} 所</text>
      </view>
      <view v-if="universityMajors.length">
        <view
          class="university-row"
          v-for="item in universityMajors"
          :key="item.id"
          @click="openUniversity(item.university?.id)"
        >
          <view class="university-main">
            <text class="university-name">{{ item.university?.name || item.majorName }}</text>
            <text class="university-meta">{{ universityMeta(item) }}</text>
            <view class="tag-row compact" v-if="universityTags(item).length">
              <text class="tag compact" v-for="tag in universityTags(item)" :key="tag">{{ tag }}</text>
            </view>
          </view>
          <text class="university-action">查看</text>
        </view>
      </view>
      <text class="intro muted no-university" v-else>{{ loading ? '正在读取开设院校...' : '暂未关联开设院校。' }}</text>
    </view>

    <view class="action-row">
      <view class="secondary-btn" @click="goBack">返回</view>
      <view class="primary-btn" @click="askAboutMajor">问问这个专业</view>
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
const major = ref<any>(null);
const loading = ref(false);
const isFavorited = ref(false);

const majorTags = computed(() => {
  const item = major.value || {};
  return [
    ...(Array.isArray(item.tags) ? item.tags : []),
    item.degreeType,
    item.riskLevel ? `风险：${item.riskLevel}` : '',
  ].filter(Boolean).slice(0, 8);
});
const favoriteIcon = computed(() => buildIconSrc('Star', isFavorited.value ? '#ffffff' : '#b45309'));

const primarySummary = computed(() => {
  const item = major.value || {};
  return item.employment || item.description || '';
});

const universityMajors = computed(() => {
  return Array.isArray(major.value?.universityMajors) ? major.value.universityMajors : [];
});

async function loadMajor(id?: string) {
  if (!id) {
    uni.showToast({ title: '专业 ID 缺失', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    const res = await api.majors.detail(id);
    major.value = res.data;
    if (res.data?.name) {
      uni.setNavigationBarTitle({ title: res.data.name });
    }
    checkFavorite(id);
  } catch (err: any) {
    uni.showToast({ title: err?.message || '专业加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function checkFavorite(id?: string) {
  if (!id || !hasLoginToken()) return;
  try {
    const res = await api.favorites.check('major', id);
    isFavorited.value = Boolean((res.data as any)?.favorited);
  } catch { /* ignore */ }
}

async function toggleFavorite() {
  const id = major.value?.id;
  if (!id) return;
  if (!hasLoginToken()) {
    userStore.loginWithWechatProfile();
    return;
  }
  try {
    const res = await api.favorites.toggle('major', id);
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

function universityMeta(item: any) {
  const uni = item.university || {};
  return [
    [uni.province, uni.city].filter(Boolean).join(' · '),
    uni.type,
    uni.level,
    item.duration,
    item.subjectLimit,
  ].filter(Boolean).join(' | ');
}

function universityTags(item: any) {
  const uni = item.university || {};
  return [
    uni.is985 ? '985' : '',
    uni.is211 ? '211' : '',
    uni.isDoubleFirst ? '双一流' : '',
    ...(Array.isArray(item.featureTags) ? item.featureTags : []),
  ].filter(Boolean).slice(0, 5);
}

function openUniversity(id?: string) {
  if (!id) return;
  uni.navigateTo({ url: `/pages/universities/detail?id=${id}` });
}

function goBack() {
  uni.navigateBack();
}

function askAboutMajor() {
  const item = major.value;
  if (!item?.name) return;
  userStore.consultQuestion = `请帮我分析 ${item.name} 专业：学什么、就业方向、适合什么样的学生，以及高考志愿填报时的风险。`;
  userStore.consultType = 'deep';
  userStore.consultContext = buildMajorContext(item);
  userStore.pendingConsult = true;
  uni.switchTab({ url: '/pages/consult/index' });
}

function buildMajorContext(item: any) {
  const latest = uni.getStorageSync('latest_volunteer_report');
  const input = latest?.input || latest?.inputSnapshot || latest?.result?.input || {};
  return [
    `关注专业：${item.name}`,
    item.category ? `专业门类：${item.category}` : '',
    item.degreeType ? `培养层次：${item.degreeType}` : '',
    item.riskLevel ? `专业风险：${item.riskLevel}` : '',
    item.employment ? `就业说明：${item.employment}` : '',
    input.province ? `考生省份：${input.province}` : '',
    input.subjectType ? `选科/科类：${input.subjectType}` : '',
    input.score ? `分数：${input.score}` : '',
    input.rank ? `位次：${input.rank}` : '',
    Array.isArray(input.preferredCities) && input.preferredCities.length ? `目标城市或省份：${input.preferredCities.join('、')}` : '',
    Array.isArray(input.avoidMajors) && input.avoidMajors.length ? `规避专业：${input.avoidMajors.join('、')}` : '',
  ].filter(Boolean).join('\n');
}

onLoad((query: any) => {
  loadMajor(query?.id);
});

onShareAppMessage(() => {
  const path = withShareRef(major.value?.id ? `/pages/majors/detail?id=${major.value.id}` : '/pages/knowledge/index?tab=majors');
  recordShare('friend', path);
  return {
    title: major.value?.name || '专业详情',
    path,
  };
});

onShareTimeline(() => {
  const path = withShareRef(major.value?.id ? `/pages/majors/detail?id=${major.value.id}` : '/pages/knowledge/index?tab=majors');
  recordShare('timeline', path);
  return {
    title: major.value?.name || '专业详情',
    query: path.split('?')[1] || '',
  };
});
</script>

<style lang="scss" scoped>
.major-page {
  min-height: 100vh;
  padding: 24rpx $spacing-md 56rpx;
  background: linear-gradient(180deg, #f8fafc 0%, #eef6ff 45%, #f7fee7 100%);
}

.hero-card,
.info-card {
  padding: 28rpx;
  margin-bottom: $spacing-md;
  border-radius: 22rpx;
  background: #fff;
  border: 1rpx solid rgba(15, 23, 42, 0.07);
  box-shadow: 0 14rpx 34rpx rgba(15, 23, 42, 0.05);
}

.hero-card {
  background: linear-gradient(135deg, #ffffff 0%, #eff6ff 54%, #f7fee7 100%);
}

.hero-top,
.section-head {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  align-items: flex-start;
}

.hero-main {
  flex: 1;
  min-width: 0;
}

.eyebrow {
  display: block;
  color: #2563eb;
  font-size: 24rpx;
  font-weight: 800;
  margin-bottom: 8rpx;
}

.title {
  display: block;
  color: $text-primary;
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.25;
}

.subtitle {
  display: block;
  margin-top: 12rpx;
  color: $text-secondary;
  font-size: 25rpx;
  line-height: 1.45;
}

.category-badge {
  flex-shrink: 0;
  max-width: 190rpx;
  padding: 8rpx 14rpx;
  border-radius: $radius-full;
  background: #eef2ff;
  color: #4338ca;
  font-size: 22rpx;
  font-weight: 900;
  word-break: break-all;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 20rpx;
}

.tag-row.compact {
  margin-top: 12rpx;
  gap: 8rpx;
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

.tag {
  padding: 8rpx 14rpx;
  border-radius: $radius-full;
  background: #ecfdf5;
  color: #047857;
  font-size: 22rpx;
  font-weight: 800;
}

.tag.compact {
  padding: 6rpx 10rpx;
  font-size: 20rpx;
}

.intro {
  display: block;
  margin-top: 22rpx;
  color: $text-secondary;
  font-size: 27rpx;
  line-height: 1.65;
}

.intro.muted {
  color: $text-tertiary;
}

.no-university {
  margin-top: 8rpx;
}

.section-title {
  display: block;
  color: $text-primary;
  font-size: 32rpx;
  font-weight: 900;
  margin-bottom: 10rpx;
}

.section-count {
  color: $text-tertiary;
  font-size: 24rpx;
  font-weight: 700;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  padding: 18rpx 0;
  border-top: 1rpx solid $border-light;
}

.info-label {
  flex-shrink: 0;
  color: $text-tertiary;
  font-size: 26rpx;
}

.info-value {
  flex: 1;
  color: $text-primary;
  font-size: 26rpx;
  font-weight: 700;
  text-align: right;
  line-height: 1.45;
  word-break: break-all;
}

.advice-block {
  padding: 18rpx 0;
  border-top: 1rpx solid $border-light;
}

.advice-label,
.advice-text {
  display: block;
}

.advice-label {
  color: #2563eb;
  font-size: 24rpx;
  font-weight: 900;
  margin-bottom: 8rpx;
}

.advice-label.warning {
  color: #b45309;
}

.advice-text {
  color: $text-secondary;
  font-size: 26rpx;
  line-height: 1.62;
}

.university-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 22rpx 0;
  border-top: 1rpx solid $border-light;
}

.university-main {
  flex: 1;
  min-width: 0;
}

.university-name {
  display: block;
  color: $text-primary;
  font-size: 29rpx;
  font-weight: 900;
  line-height: 1.35;
}

.university-meta {
  display: block;
  margin-top: 8rpx;
  color: $text-secondary;
  font-size: 23rpx;
  line-height: 1.45;
}

.university-action {
  flex-shrink: 0;
  color: #2563eb;
  font-size: 25rpx;
  font-weight: 900;
}

.major-ask-card {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 78rpx;
  margin-bottom: $spacing-md;
  border-radius: 18rpx;
  color: #fff;
  font-size: 27rpx;
  font-weight: 900;
  background: linear-gradient(135deg, #2563eb 0%, #16a34a 100%);
  box-shadow: 0 14rpx 30rpx rgba(37, 99, 235, 0.18);
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.primary-btn,
.secondary-btn {
  height: 82rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 900;
}

.primary-btn {
  color: #fff;
  background: linear-gradient(135deg, #2563eb 0%, #16a34a 100%);
  box-shadow: 0 14rpx 30rpx rgba(37, 99, 235, 0.18);
}

.secondary-btn {
  color: $text-secondary;
  background: #fff;
  border: 1rpx solid $border;
}
</style>
