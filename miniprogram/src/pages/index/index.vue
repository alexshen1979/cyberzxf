<template>
  <view class="home-page">
    <!-- 顶部品牌区 -->
    <view class="brand-section">
      <view class="brand-slogan">
        <text class="slogan-title">赛博张老师</text>
        <text class="slogan-sub">AI 升学咨询 · 科学决策不踩坑</text>
      </view>
      <!-- 点数展示条 -->
      <view class="points-bar glow-card" @click="goRecharge">
        <view class="points-left">
          <text class="points-icon">⚡</text>
          <text class="points-label">咨询点数</text>
        </view>
        <view class="points-right">
          <text class="points-value">{{ userStore.pointsBalance }}</text>
          <text class="points-unit">点</text>
          <text class="points-recharge">充值 →</text>
        </view>
      </view>
    </view>

    <!-- 四大功能入口 -->
    <view class="features-grid">
      <view class="feature-card" v-for="item in features" :key="item.key" @click="goPage(item.path)">
        <view class="feature-icon" :style="{ background: item.color }">
          <text>{{ item.icon }}</text>
        </view>
        <text class="feature-title">{{ item.title }}</text>
        <text class="feature-desc">{{ item.desc }}</text>
      </view>
    </view>

    <!-- 快捷咨询入口 -->
    <view class="quick-ask-section">
      <view class="section-title">
        <text class="title-icon">💬</text>
        <text>快捷提问</text>
      </view>
      <view class="quick-tags">
        <view class="quick-tag" v-for="q in quickQuestions" :key="q.id" @click="quickAsk(q.question)">
          <text>{{ q.question }}</text>
        </view>
      </view>
    </view>

    <!-- 系统公告 -->
    <view class="notice-section" v-if="userStore.notices.length > 0">
      <view class="notice-bar" @click="goNotices">
        <text class="notice-icon">📢</text>
        <swiper class="notice-swiper" vertical autoplay circular :interval="3000">
          <swiper-item v-for="notice in userStore.notices" :key="notice.id">
            <text class="notice-text">{{ notice.title }}</text>
          </swiper-item>
        </swiper>
      </view>
    </view>

    <!-- 底部悬浮充值按钮 -->
    <view class="float-recharge" @click="goRecharge">
      <text class="float-icon">⚡</text>
      <text>充值咨询点数</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

const features = [
  { key: 'gaokao', icon: '🎓', title: '志愿填报', desc: '高考择校分析', color: 'linear-gradient(135deg, #00f5ff, #0099ff)', path: '/pages/consult/index?type=gaokao' },
  { key: 'kaoyan', icon: '📚', title: '考研规划', desc: '院校专业推荐', color: 'linear-gradient(135deg, #7c3aed, #a855f7)', path: '/pages/consult/index?type=kaoyan' },
  { key: 'zhiye', icon: '💼', title: '职业规划', desc: '行业前景分析', color: 'linear-gradient(135deg, #f97316, #fb923c)', path: '/pages/consult/index?type=zhiye' },
  { key: 'bimian', icon: '⚠️', title: '专业避坑', desc: '深度解析避雷', color: 'linear-gradient(135deg, #ef4444, #f87171)', path: '/pages/consult/index?type=bimian' },
];

const quickQuestions = ref([
  { id: '1', question: '理科580分能上什么大学？' },
  { id: '2', question: '计算机专业就业前景如何？' },
  { id: '3', question: '土木工程还值得学吗？' },
  { id: '4', question: '考研二战划算吗？' },
  { id: '5', question: '金融学和经济学有什么区别？' },
]);

function goPage(path: string) {
  uni.navigateTo({ url: path });
}

function goRecharge() {
  uni.navigateTo({ url: '/pages/recharge/index' });
}

function goNotices() {
  uni.navigateTo({ url: '/pages/notices/index' });
}

function quickAsk(question: string) {
  uni.navigateTo({ url: `/pages/consult/index?question=${encodeURIComponent(question)}` });
}
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.home-page {
  padding-bottom: 120rpx;
}

.brand-section {
  padding: $spacing-xl $spacing-md $spacing-md;
  text-align: center;
}

.slogan-title {
  font-size: $font-xxl;
  font-weight: 800;
  @include gradient-text;
  display: block;
}

.slogan-sub {
  font-size: $font-sm;
  color: $text-secondary;
  margin-top: $spacing-xs;
  display: block;
}

.points-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: $spacing-lg;
  padding: $spacing-sm $spacing-md;
}

.points-left {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.points-icon {
  font-size: $font-lg;
}

.points-label {
  font-size: $font-sm;
  color: $text-secondary;
}

.points-right {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}

.points-value {
  font-size: $font-xl;
  font-weight: 700;
  color: $primary;
}

.points-unit {
  font-size: $font-sm;
  color: $text-secondary;
}

.points-recharge {
  font-size: $font-xs;
  color: $primary;
  margin-left: $spacing-xs;
}

.features-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-sm;
  padding: 0 $spacing-md;
}

.feature-card {
  @include card;
  padding: $spacing-md;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-xs;
}

.feature-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  @include flex-center;
  font-size: $font-xl;
}

.feature-title {
  font-size: $font-md;
  font-weight: 600;
}

.feature-desc {
  font-size: $font-xs;
  color: $text-dim;
}

.quick-ask-section {
  padding: $spacing-md;
}

.section-title {
  font-size: $font-lg;
  font-weight: 600;
  margin-bottom: $spacing-sm;
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.title-icon {
  font-size: $font-lg;
}

.quick-tags {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.quick-tag {
  background: $bg-card;
  border: 1rpx solid $border-color;
  border-radius: 32rpx;
  padding: $spacing-xs $spacing-md;
  font-size: $font-sm;
  color: $text-secondary;
}

.notice-section {
  padding: 0 $spacing-md;
  margin-top: $spacing-sm;
}

.notice-bar {
  @include card;
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  padding: $spacing-sm $spacing-md;
}

.notice-icon {
  font-size: $font-md;
  flex-shrink: 0;
}

.notice-swiper {
  flex: 1;
  height: 40rpx;
}

.notice-text {
  font-size: $font-sm;
  color: $text-secondary;
  line-height: 40rpx;
}

.float-recharge {
  position: fixed;
  bottom: 120rpx;
  left: 50%;
  transform: translateX(-50%);
  @include gradient-btn;
  padding: $spacing-sm $spacing-lg;
  border-radius: 48rpx;
  font-size: $font-md;
  font-weight: 600;
  z-index: 100;
  @include flex-center;
  gap: $spacing-xs;
  box-shadow: 0 4rpx 20rpx rgba(124, 58, 237, 0.4);
}

.float-icon {
  font-size: $font-md;
}
</style>
