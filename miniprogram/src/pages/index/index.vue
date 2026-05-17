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

    <!-- Slogan -->
    <view class="slogan-bar">
      <text class="slogan-title">拉平信息差，拒绝迷茫，多些清晰</text>
      <text class="slogan-sub">把关键选择拆成看得懂的依据和下一步</text>
    </view>

    <!-- 问候语 -->
    <view class="greeting-section">
      <text class="greeting-hi">你好，{{ userStore.userInfo?.nickname || '同学' }}</text>
      <text class="greeting-sub">把志愿填报从"问 AI"变成"做决策"</text>
    </view>

    <!-- 未登录提示 -->
    <view class="login-banner" v-if="!userStore.isLogin">
      <text class="login-text">免费提问 {{ Math.max(0, freeAskLimit - freeCount) }}/{{ freeAskLimit }} 次 · 登录解锁深度分析</text>
      <text class="login-link" @click="handleLogin">登录 →</text>
    </view>

    <view class="volunteer-entry">
      <view>
        <text class="entry-kicker">核心工具</text>
        <text class="entry-title">位次志愿规划</text>
        <text class="entry-desc">输入省份、分数、位次，生成可追溯的冲稳保方案，并检查调剂、选科和体检风险。</text>
      </view>
      <view class="entry-btn" @click="goVolunteer">
        <text>开始分析</text>
      </view>
    </view>

    <view class="proof-grid">
      <view class="proof-item">
        <text class="proof-title">历年录取线</text>
        <text class="proof-desc">不是只听 AI 猜</text>
      </view>
      <view class="proof-item">
        <text class="proof-title">专业组风险</text>
        <text class="proof-desc">调剂范围单独看</text>
      </view>
      <view class="proof-item">
        <text class="proof-title">报告可追问</text>
        <text class="proof-desc">拿方案继续细化</text>
      </view>
    </view>

    <!-- 追问入口 -->
    <view class="prompt-area">
      <text class="prompt-label">已有困惑？直接追问</text>

      <!-- 分类选择 -->
      <view class="cat-row">
        <view
          v-for="cat in categories"
          :key="cat.key"
          class="cat-chip"
          :class="{ active: activeCategory === cat.key }"
          :style="activeCategory === cat.key ? { color: catColor(cat.key).deep, borderColor: catColor(cat.key).border, background: catColor(cat.key).light } : {}"
          @click="activeCategory = cat.key"
        >
          <CategoryIcon :name="cat.icon" :color="catColor(cat.key).deep" :bg="catColor(cat.key).light" :active="activeCategory === cat.key" />
          <text>{{ cat.label }}</text>
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
import { ref, computed, onMounted, watch } from 'vue';
import { onPullDownRefresh } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';
import { api } from '@/api';
import CategoryIcon from '@/components/CategoryIcon.vue';

const userStore = useUserStore();

const categories = ref<Array<{ key: string; icon: string; label: string }>>([]);
const activeCategory = ref('');
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

const CAT_PALETTE = [
  { deep: '#2563eb', light: '#eff6ff', border: '#93c5fd' },
  { deep: '#d97706', light: '#fffbeb', border: '#fcd34d' },
  { deep: '#7c3aed', light: '#f5f3ff', border: '#c4b5fd' },
  { deep: '#059669', light: '#ecfdf5', border: '#6ee7b7' },
  { deep: '#dc2626', light: '#fef2f2', border: '#fca5a5' },
  { deep: '#475569', light: '#f1f5f9', border: '#cbd5e1' },
  { deep: '#0891b2', light: '#ecfeff', border: '#67e8f9' },
  { deep: '#db2777', light: '#fdf2f8', border: '#f9a8d4' },
];

const categoryColorIndex = computed(() => {
  const map: Record<string, number> = {};
  categories.value.forEach((cat, i) => {
    map[cat.key] = i;
  });
  return map;
});

function catColor(key: string) {
  const idx = categoryColorIndex.value[key] != null ? categoryColorIndex.value[key] : 0;
  return CAT_PALETTE[idx % CAT_PALETTE.length];
}

async function initHome() {
  freeCount.value = parseInt(uni.getStorageSync('free_ask_count') || '0');
  // 加载分类
  try {
    const res = await api.categories.list();
    if ((res.data as any[])?.length > 0) {
      categories.value = res.data as any[];
      const def = categories.value.find((c: any) => c.isDefault);
      activeCategory.value = def?.key || categories.value[0]?.key || '';
    }
  } catch { /* keep defaults */ }
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
}

onMounted(initHome);

onPullDownRefresh(async () => {
  try {
    await Promise.all([initHome(), userStore.checkNotices(), userStore.fetchBalance()]);
  } finally {
    uni.stopPullDownRefresh();
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
  userStore.loginWithWechatProfile();
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

function goVolunteer() {
  uni.switchTab({ url: '/pages/volunteer/index' });
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

// ─── Slogan ───────────────────────────────────
.slogan-bar {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 32rpx;
  border-radius: $radius-md;
  background: linear-gradient(135deg, rgba($brand, 0.06), rgba($secondary, 0.06));
  border-left: 6rpx solid $brand;
}

.slogan-title {
  font-size: 30rpx;
  font-weight: 800;
  color: $brand;
}

.slogan-sub {
  font-size: 22rpx;
  color: $text-tertiary;
}

// ─── Greeting ────────────────────────────────
.greeting-section {
  margin-bottom: 24rpx;
}

.greeting-hi {
  font-size: 48rpx;
  font-weight: 700;
  color: $text-primary;
  letter-spacing: -1rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.greeting-sub {
  display: block;
  margin-top: 8rpx;
  color: $text-secondary;
  font-size: $font-sm;
}

.volunteer-entry {
  @include card;
  padding: $spacing-md;
  margin-bottom: $spacing-md;
  display: flex;
  justify-content: space-between;
  gap: $spacing-md;
  align-items: center;
}

.entry-kicker {
  display: block;
  color: $brand;
  font-size: $font-xs;
  font-weight: 800;
  margin-bottom: 6rpx;
}

.entry-title {
  display: block;
  color: $text-primary;
  font-size: 40rpx;
  font-weight: 850;
}

.entry-desc {
  display: block;
  margin-top: 8rpx;
  color: $text-secondary;
  font-size: $font-sm;
  line-height: 1.55;
}

.entry-btn {
  flex-shrink: 0;
  padding: 18rpx 24rpx;
  border-radius: $radius-md;
  background: $brand;
  color: #fff;
  font-size: $font-sm;
  font-weight: 800;
}

.proof-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.proof-item {
  @include card;
  padding: $spacing-sm;
}

.proof-title {
  display: block;
  color: $text-primary;
  font-size: $font-xs;
  font-weight: 800;
}

.proof-desc {
  display: block;
  margin-top: 4rpx;
  color: $text-tertiary;
  font-size: 20rpx;
  line-height: 1.3;
}

// ─── Login banner ────────────────────────────
.login-banner {
  background: $brand-light;
  border-radius: 12rpx;
  padding: 12rpx 16rpx;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
}

.login-text {
  font-size: 22rpx;
  color: $brand;
  flex: 1;
  min-width: 0;
  @include text-ellipsis;
}

.login-link {
  font-size: 22rpx;
  color: $brand;
  font-weight: 700;
  flex-shrink: 0;
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
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.cat-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 16rpx 0;
  border-radius: 16rpx;
  font-size: 26rpx;
  color: $text-secondary;
  background: $bg-page;
  border: 1rpx solid transparent;
  width: calc((100% - 16rpx) / 2);
  box-sizing: border-box;
  margin-bottom: 16rpx;

  &.active {
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
