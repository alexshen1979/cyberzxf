<template>
  <view class="page">
    <!-- 顶部：头像 + 点数 -->
    <view class="top-bar">
      <view class="avatar" @click="goProfile">
        <text>{{ (userStore.userInfo?.nickname || '张').charAt(0) }}</text>
      </view>
      <view class="points-chip" @click="goRecharge">
        <text>⚡ {{ userStore.pointsBalance }} 点</text>
      </view>
    </view>

    <!-- 问候语 -->
    <view class="greeting-section">
      <text class="greeting-hi">你好，{{ userStore.userInfo?.nickname || '同学' }}</text>
    </view>

    <!-- 未登录提示 -->
    <view class="login-banner" v-if="!userStore.isLogin">
      <text class="login-text">
        剩余免费提问 {{ Math.max(0, freeAskLimit - freeCount) }} 次 · 登录后获得更多点数和深度分析
      </text>
      <text class="login-link" @click="handleLogin">登录 →</text>
    </view>

    <!-- 新对话入口 -->
    <view class="prompt-area">
      <text class="prompt-label">开始一个新问题</text>

      <!-- 分类选择 -->
      <view class="cat-row">
        <view
          v-for="cat in categories"
          :key="cat.key"
          class="cat-chip"
          :class="{ active: activeCategory === cat.key }"
          @click="activeCategory = cat.key"
        >
          <text>{{ cat.icon }} {{ cat.label }}</text>
        </view>
      </view>

      <!-- 输入框 -->
      <textarea
        class="prompt-input"
        v-model="question"
        placeholder="输入你的升学问题，例如：理科580分能上什么大学？"
        :maxlength="500"
        :auto-height="true"
      />

      <!-- 底部操作栏 -->
      <view class="prompt-footer">
        <text class="char-hint">{{ question.length }}/500</text>
        <view class="send-btn" :class="{ disabled: !question.trim() }" @click="handleAsk">
          <text>发送</text>
        </view>
      </view>
    </view>

    <!-- 快捷提问 -->
    <view class="quick-section">
      <view class="quick-tags">
        <text
          class="quick-chip"
          v-for="q in quickQuestions"
          :key="q.id"
          @click="question = q.question"
        >{{ q.question }}</text>
      </view>
    </view>

    <!-- 登录提醒弹窗 -->
    <view class="modal-mask" v-if="showLoginModal" @click="showLoginModal = false">
      <view class="modal-card" @click.stop>
        <text class="modal-title">登录后可获得更多</text>
        <text class="modal-desc">免费咨询点数和深度分析结果，AI 为你精准匹配院校和专业</text>
        <view class="modal-btn" @click="handleLogin">
          <text>微信一键登录</text>
        </view>
        <text class="modal-close" @click="showLoginModal = false">暂不登录</text>
      </view>
    </view>

    <!-- 公告 -->
    <view class="notice-strip" v-if="userStore.notices.length > 0" @click="goNotices">
      <text class="notice-dot">●</text>
      <swiper class="notice-swiper" vertical autoplay circular :interval="3000">
        <swiper-item v-for="n in userStore.notices" :key="n.id">
          <text class="notice-text">{{ n.title }}</text>
        </swiper-item>
      </swiper>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useUserStore } from '@/store/user';
import { api } from '@/api';

const userStore = useUserStore();

const categories = [
  { key: 'gaokao', icon: '🎓', label: '智能选校' },
  { key: 'kaoyan', icon: '📚', label: '考研规划' },
  { key: 'zhiye', icon: '💼', label: '职业方向' },
  { key: 'bimian', icon: '🔍', label: '专业避坑' },
];

const activeCategory = ref('gaokao');
const question = ref('');
const showLoginModal = ref(false);
const freeCount = ref(0);
const freeAskLimit = ref(100);

const defaultQuestions = [
  { id: '1', question: '理科580分能上什么大学？' },
  { id: '2', question: '计算机专业就业前景如何？' },
  { id: '3', question: '土木工程还值得学吗？' },
  { id: '4', question: '考研二战划算吗？' },
  { id: '5', question: '金融学和经济学有什么区别？' },
];

const quickQuestions = ref<Array<{ id: string; question: string }>>([]);

onMounted(async () => {
  freeCount.value = parseInt(uni.getStorageSync('free_ask_count') || '0');
  // 从后台获取免费提问次数配置
  try {
    const cfg = await api.config.getPublic();
    if (cfg.data?.freeAskLimit !== undefined) {
      freeAskLimit.value = cfg.data.freeAskLimit;
    }
  } catch { /* 使用默认值 */ }
  try {
    const res = await api.ai.getQuickQuestions();
    if ((res.data as any[])?.length > 0) {
      quickQuestions.value = res.data as any[];
    } else {
      quickQuestions.value = defaultQuestions;
    }
  } catch {
    quickQuestions.value = defaultQuestions;
  }
});

// 登录后重置免费次数
watch(() => userStore.isLogin, (val) => {
  if (val) {
    freeCount.value = 0;
    uni.removeStorageSync('free_ask_count');
    showLoginModal.value = false;
  }
});

function handleLogin() {
  userStore.silentLogin();
}

function handleAsk() {
  if (!question.value.trim()) return;

  // 已登录直接提问
  if (userStore.isLogin) {
    goAsk();
    return;
  }

  // 未登录：检查免费次数
  if (freeCount.value >= freeAskLimit.value) {
    showLoginModal.value = true;
    return;
  }

  freeCount.value++;
  uni.setStorageSync('free_ask_count', String(freeCount.value));
  goAsk();
}

function goAsk() {
  userStore.consultType = activeCategory.value;
  userStore.consultQuestion = question.value.trim();
  userStore.pendingConsult = true;
  uni.switchTab({ url: '/pages/consult/index' });
}

function goProfile() {
  uni.switchTab({ url: '/pages/profile/index' });
}

function goRecharge() {
  uni.navigateTo({ url: '/pages/recharge/index' });
}

function goNotices() {
  uni.navigateTo({ url: '/pages/notices/index' });
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f8f9fa;
  padding: 0 $spacing-md;
}

// ─── Top bar ─────────────────────────────────
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24rpx;
  margin-bottom: 48rpx;
}

.avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: $radius-full;
  background: $brand;
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
  @include flex-center;
}

.points-chip {
  background: #fff;
  border: 1rpx solid $border;
  border-radius: 20rpx;
  padding: 8rpx 20rpx;
  font-size: 22rpx;
  color: $text-secondary;
}

// ─── Greeting ────────────────────────────────
.greeting-section {
  margin-bottom: 24rpx;
}

.greeting-hi {
  font-size: 52rpx;
  font-weight: 700;
  color: $text-primary;
  letter-spacing: -1rpx;
}

// ─── Login banner ────────────────────────────
.login-banner {
  background: $brand-light;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.login-text {
  font-size: 24rpx;
  color: $brand;
}

.login-link {
  font-size: 24rpx;
  color: $brand;
  font-weight: 600;
}

// ─── Prompt area ─────────────────────────────
.prompt-area {
  background: #fff;
  border: 1rpx solid $border;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}

.prompt-label {
  font-size: 22rpx;
  color: $text-tertiary;
  display: block;
  margin-bottom: 20rpx;
}

.cat-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.cat-chip {
  padding: 16rpx 0;
  border-radius: 16rpx;
  font-size: 26rpx;
  color: $text-secondary;
  background: $bg-page;
  border: 1rpx solid transparent;
  text-align: center;

  &.active {
    background: $brand-light;
    border-color: rgba($brand, 0.2);
    color: $brand;
    font-weight: 600;
  }
}

.prompt-input {
  width: 100%;
  min-height: 200rpx;
  font-size: 30rpx;
  color: $text-primary;
  line-height: 1.8;
}

.prompt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16rpx;
  margin-top: 8rpx;
  border-top: 1rpx solid $border-light;
}

.char-hint {
  font-size: 22rpx;
  color: $text-tertiary;
}

.send-btn {
  background: $text-primary;
  padding: 12rpx 32rpx;
  border-radius: 20rpx;

  text {
    color: #fff;
    font-size: 26rpx;
    font-weight: 500;
  }

  &.disabled {
    opacity: 0.3;
  }
}

// ─── Quick questions ─────────────────────────
.quick-section {
  margin-bottom: 24rpx;
}

.quick-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.quick-chip {
  background: #fff;
  border: 1rpx solid $border;
  border-radius: 20rpx;
  padding: 10rpx 20rpx;
  font-size: 24rpx;
  color: $text-secondary;
}

// ─── Modal ────────────────────────────────────
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 999;
  @include flex-center;
  padding: 48rpx;
}

.modal-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 36rpx 36rpx;
  text-align: center;
  width: 100%;
  max-width: 560rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $text-primary;
  display: block;
  margin-bottom: 12rpx;
}

.modal-desc {
  font-size: 26rpx;
  color: $text-secondary;
  line-height: 1.6;
  display: block;
  margin-bottom: 36rpx;
}

.modal-btn {
  background: $brand;
  border-radius: 16rpx;
  padding: 20rpx 0;
  margin-bottom: 20rpx;

  text {
    color: #fff;
    font-size: 30rpx;
    font-weight: 600;
  }
}

.modal-close {
  font-size: 24rpx;
  color: $text-tertiary;
}

// ─── Notice ──────────────────────────────────
.notice-strip {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 0;
}

.notice-dot {
  color: $brand;
  font-size: 20rpx;
}

.notice-swiper {
  flex: 1;
  height: 36rpx;
}

.notice-text {
  font-size: 24rpx;
  color: $text-tertiary;
  line-height: 36rpx;
  @include text-ellipsis;
}
</style>
