<template>
  <view class="university-page">
    <view class="hero-card">
      <view class="hero-top">
        <view>
          <text class="eyebrow">{{ university?.province || '院校库' }}</text>
          <text class="title">{{ university?.name || '院校详情' }}</text>
        </view>
        <view class="level-badge" v-if="university?.level">{{ university.level }}</view>
      </view>
      <view class="tag-row">
        <text class="tag" v-for="tag in universityTags" :key="tag">{{ tag }}</text>
      </view>
      <text class="intro" v-if="university?.introduction">{{ university.introduction }}</text>
      <text class="intro muted" v-else>{{ loading ? '正在读取院校资料...' : '该院校简介暂未补充。' }}</text>
    </view>

    <view class="info-card">
      <text class="section-title">基础信息</text>
      <view class="info-row">
        <text class="info-label">所在城市</text>
        <text class="info-value">{{ [university?.province, university?.city].filter(Boolean).join(' · ') || '待补充' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">院校类型</text>
        <text class="info-value">{{ university?.type || '待补充' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">办学属性</text>
        <text class="info-value">{{ university?.properties || '待补充' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">院校代码</text>
        <text class="info-value">{{ university?.code || '待补充' }}</text>
      </view>
      <view class="info-row" v-if="university?.website">
        <text class="info-label">官网</text>
        <text class="info-value link">{{ university.website }}</text>
      </view>
      <view class="info-row" v-if="university?.address">
        <text class="info-label">地址</text>
        <text class="info-value">{{ university.address }}</text>
      </view>
    </view>

    <view class="action-row">
      <view class="secondary-btn" @click="goBack">返回报告</view>
      <view class="primary-btn" @click="askAboutUniversity">问问这所学校</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '@/api';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();
const university = ref<any>(null);
const loading = ref(false);

const universityTags = computed(() => {
  const item = university.value || {};
  return [
    item.is985 ? '985' : '',
    item.is211 ? '211' : '',
    item.isDoubleFirst ? '双一流' : '',
    ...(Array.isArray(item.featureTags) ? item.featureTags : []),
    item.type,
    item.properties,
  ].filter(Boolean);
});

async function loadUniversity(id?: string) {
  if (!id) {
    uni.showToast({ title: '院校 ID 缺失', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    const res = await api.universities.detail(id);
    university.value = res.data;
    if (res.data?.name) {
      uni.setNavigationBarTitle({ title: res.data.name });
    }
  } catch (err: any) {
    uni.showToast({ title: err?.message || '院校加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function goBack() {
  uni.navigateBack();
}

function askAboutUniversity() {
  const item = university.value;
  if (!item?.name) return;
  userStore.consultQuestion = `请帮我分析 ${item.name}：院校层次、城市资源、适合哪些专业方向，以及放在高考志愿里的风险。`;
  userStore.consultType = 'deep';
  userStore.consultContext = buildUniversityContext(item);
  userStore.pendingConsult = true;
  uni.switchTab({ url: '/pages/consult/index' });
}

function buildUniversityContext(item: any) {
  const latest = uni.getStorageSync('latest_volunteer_report');
  const input = latest?.input || latest?.inputSnapshot || latest?.result?.input || {};
  return [
    `关注院校：${item.name}`,
    [item.province, item.city].filter(Boolean).length ? `院校城市：${[item.province, item.city].filter(Boolean).join(' · ')}` : '',
    item.type ? `院校类型：${item.type}` : '',
    item.level ? `院校层次：${item.level}` : '',
    input.province ? `考生省份：${input.province}` : '',
    input.subjectType ? `选科/科类：${input.subjectType}` : '',
    input.score ? `分数：${input.score}` : '',
    input.rank ? `位次：${input.rank}` : '',
    input.targetBatch ? `批次：${input.targetBatch}` : '',
    Array.isArray(input.preferredCities) && input.preferredCities.length ? `目标城市或省份：${input.preferredCities.join('、')}` : '',
    Array.isArray(input.preferredMajors) && input.preferredMajors.length ? `偏好专业：${input.preferredMajors.join('、')}` : '',
    Array.isArray(input.avoidMajors) && input.avoidMajors.length ? `规避专业：${input.avoidMajors.join('、')}` : '',
  ].filter(Boolean).join('\n');
}

onLoad((query: any) => {
  loadUniversity(query?.id);
});
</script>

<style lang="scss" scoped>
.university-page {
  min-height: 100vh;
  padding: 24rpx $spacing-md 56rpx;
  background: linear-gradient(180deg, #f8fafc 0%, #f0fdfa 48%, #fff7ed 100%);
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
  background: linear-gradient(135deg, #ffffff 0%, #ecfeff 52%, #fff7ed 100%);
}

.hero-top {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  align-items: flex-start;
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
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.25;
}

.level-badge {
  flex-shrink: 0;
  padding: 8rpx 14rpx;
  border-radius: $radius-full;
  background: #f5f3ff;
  color: #6d28d9;
  font-size: 22rpx;
  font-weight: 900;
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

.section-title {
  display: block;
  color: $text-primary;
  font-size: 32rpx;
  font-weight: 900;
  margin-bottom: 10rpx;
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

.info-value.link {
  color: #0f766e;
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
  background: linear-gradient(135deg, #0f766e 0%, #7c3aed 100%);
  color: #fff;
}

.secondary-btn {
  background: #fff;
  color: $text-secondary;
  border: 1rpx solid rgba(15, 23, 42, 0.10);
}
</style>
