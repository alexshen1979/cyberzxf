<template>
  <view class="consult-page">
    <!-- 顶部栏 -->
    <view class="top-bar">
      <text class="greeting">你好，{{ userStore.userInfo?.nickname || '同学' }}</text>
      <view class="points-chip" @click="goRecharge">
        <text>⚡ {{ userStore.pointsBalance }} 点</text>
      </view>
    </view>

    <!-- 未登录提示 -->
    <view class="login-banner" v-if="!userStore.isLogin">
      <text class="login-text">
        剩余免费提问 {{ Math.max(0, freeAskLimit - freeCount) }} 次 · 登录后获得更多点数和深度分析
      </text>
      <text class="login-link" @click="handleLogin">登录 →</text>
    </view>

    <!-- 内页 Tab 切换 -->
    <view class="tab-bar">
      <view class="tab-item" :class="{ active: activeTab === 'chat' }" @click="switchMainTab('chat')">
        <text>AI 对话</text>
      </view>
      <view class="tab-item" :class="{ active: activeTab === 'history' }" @click="switchMainTab('history')">
        <text>历史记录</text>
      </view>
    </view>

    <!-- 对话模式 -->
    <template v-if="activeTab === 'chat'">
      <scroll-view class="chat-list" scroll-y :scroll-into-view="scrollToId" :scroll-with-animation="true">
        <!-- 空状态：欢迎 + 分类 + 快捷提问 -->
        <view class="welcome-area" v-if="messages.length === 0">
          <text class="welcome-icon">🤖</text>
          <text class="welcome-title">赛博张老师为您服务</text>
          <text class="welcome-desc">选一个方向，告诉我你的困惑</text>

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

          <!-- 快捷提问 -->
          <view class="quick-tags" v-if="quickQuestions.length > 0">
            <text
              class="quick-chip"
              v-for="q in quickQuestions"
              :key="q.id"
              @click="inputText = q.question"
            >{{ q.question }}</text>
          </view>
        </view>

        <!-- 消息列表 -->
        <view class="message-item" v-for="msg in messages" :key="msg.id" :id="`msg-${msg.id}`"
          :class="msg.role === 'user' ? 'msg-user' : 'msg-ai'">
          <view class="msg-avatar">
            <text>{{ msg.role === 'user' ? '👤' : '🤖' }}</text>
          </view>
          <view class="msg-bubble" :class="msg.role === 'user' ? 'bubble-user' : 'bubble-ai'">
            <text class="msg-content">{{ msg.content }}</text>
            <view class="msg-footer" v-if="msg.pointsCost">
              <text class="msg-cost">-{{ msg.pointsCost }} 点数</text>
            </view>
          </view>
        </view>

        <!-- 加载中 -->
        <view class="message-item msg-ai" v-if="loading">
          <view class="msg-avatar"><text>🤖</text></view>
          <view class="msg-bubble bubble-ai typing-indicator">
            <text class="dot">·</text><text class="dot">·</text><text class="dot">·</text>
          </view>
        </view>

        <view id="msg-bottom"></view>
      </scroll-view>

      <!-- 底部输入区 -->
      <view class="input-area safe-area-bottom">
        <!-- 点数不足提醒 -->
        <view class="points-warn" v-if="userStore.isLogin && pointsLow" @click="goRecharge">
          <text>⚠️ 点数余额不足，{{ consultType === 'deep' ? '深度分析需18点' : '普通问答需5点' }}，当前仅 {{ userStore.pointsBalance }} 点。点击充值 →</text>
        </view>

        <!-- 输入框 -->
        <textarea
          class="prompt-input"
          v-model="inputText"
          placeholder="输入你的升学问题，例如：理科580分能上什么大学？"
          :maxlength="500"
          :auto-height="true"
          :disabled="loading"
        />

        <!-- 底部操作栏 -->
        <view class="prompt-footer">
          <view class="footer-left">
            <text class="char-hint">{{ inputText.length }}/500</text>
            <text class="type-tag" @click="switchConsultType">
              {{ consultType === 'normal' ? '普通问答' : '深度分析' }}
            </text>
            <text class="context-btn" @click="showContextForm = !showContextForm">📝 背景</text>
          </view>
          <view class="send-btn" :class="{ disabled: !inputText.trim() || loading }" @click="sendMessage">
            <text>发送</text>
          </view>
        </view>

        <!-- 背景信息表单 -->
        <view class="context-form" v-if="showContextForm">
          <textarea class="context-textarea" v-model="userContext" placeholder="填写你的背景信息，获得更精准的分析：
- 所在省份
- 文/理科
- 预估分数/排名
- 目标专业/学校
- 家庭情况（可选）" :maxlength="500" />
          <view class="context-confirm" @click="showContextForm = false">
            <text>确认</text>
          </view>
        </view>
      </view>
    </template>

    <!-- 历史记录模式 -->
    <template v-if="activeTab === 'history'">
      <scroll-view class="history-list" scroll-y @scrolltolower="loadMoreHistory">
        <view class="history-item card" v-for="item in historyList" :key="item.id" @click="enterHistorySession(item)">
          <view class="history-header">
            <text class="history-question">{{ item.question }}</text>
            <text class="history-date">{{ formatDate(item.createdAt) }}</text>
          </view>
          <view class="history-footer">
            <text class="history-type">{{ item.type === 'deep' ? '深度分析' : '普通问答' }}</text>
            <text class="history-cost" v-if="item.pointsCost">-{{ item.pointsCost }} 点</text>
          </view>
        </view>
        <view class="empty" v-if="historyList.length === 0">
          <text>暂无咨询记录</text>
        </view>
        <view class="no-more" v-if="!historyHasMore && historyList.length > 0">—— 没有更多了 ——</view>
      </scroll-view>
    </template>

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
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { api, BASE_URL } from '@/api';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

const pointsLow = computed(() => {
  const cost = consultType.value === 'deep' ? 18 : 5;
  return userStore.pointsBalance < cost;
});

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  pointsCost?: number;
}

// 分类
const categories = [
  { key: 'gaokao', icon: '🎓', label: '智能选校' },
  { key: 'kaoyan', icon: '📚', label: '考研规划' },
  { key: 'zhiye', icon: '💼', label: '职业方向' },
  { key: 'bimian', icon: '🔍', label: '专业避坑' },
];
const activeCategory = ref('gaokao');

// 快捷提问
const defaultQuestions = [
  { id: '1', question: '理科580分能上什么大学？' },
  { id: '2', question: '计算机专业就业前景如何？' },
  { id: '3', question: '土木工程还值得学吗？' },
  { id: '4', question: '考研二战划算吗？' },
  { id: '5', question: '金融学和经济学有什么区别？' },
];
const quickQuestions = ref<Array<{ id: string; question: string }>>([]);

// 免费提问
const freeCount = ref(0);
const freeAskLimit = ref(100);
const showLoginModal = ref(false);

const activeTab = ref<'chat' | 'history'>('chat');
const messages = ref<Message[]>([]);
const inputText = ref('');
const loading = ref(false);
const showContextForm = ref(false);
const userContext = ref('');
const consultType = ref<'normal' | 'deep'>('normal');
const scrollToId = ref('');
const sessionId = ref('');

// 历史记录
const historyList = ref<any[]>([]);
const historyPage = ref(1);
const historyHasMore = ref(true);

// 登录后重置免费次数
watch(() => userStore.isLogin, (val) => {
  if (val) {
    freeCount.value = 0;
    uni.removeStorageSync('free_ask_count');
    showLoginModal.value = false;
  }
});

function handleStoreNavigation() {
  if (userStore.loadSessionId) {
    const sid = userStore.loadSessionId;
    userStore.loadSessionId = '';
    const item = historyList.value.find((h: any) => h.sessionId === sid || h.id === sid);
    if (item) {
      enterHistorySession(item);
    } else if (sid) {
      enterHistorySession({ sessionId: sid });
    }
    return;
  }
  if (userStore.showHistoryTab) {
    userStore.showHistoryTab = false;
    activeTab.value = 'history';
    if (historyList.value.length === 0) loadHistory();
    return;
  }
  if (userStore.pendingConsult) {
    userStore.pendingConsult = false;
    if (userStore.consultQuestion) {
      inputText.value = userStore.consultQuestion;
    }
    const type = userStore.consultType;
    consultType.value = type === 'deep' ? 'deep' : 'normal';
    if (inputText.value) {
      nextTick(() => sendMessage());
    }
  }
}

const pageLoaded = ref(false);

onLoad((options: any) => {
  // 初始化
  freeCount.value = parseInt(uni.getStorageSync('free_ask_count') || '0');
  fetchConfig();

  if (options?.tab === 'history') {
    activeTab.value = 'history';
    loadHistory();
  }
  const q = options?.question;
  if (q) {
    inputText.value = decodeURIComponent(q);
    if (options?.type) {
      consultType.value = options.type === 'deep' ? 'deep' : 'normal';
    }
    sendMessage();
    return;
  }
  handleStoreNavigation();
  pageLoaded.value = true;
});

onShow(() => {
  if (!pageLoaded.value) return;
  handleStoreNavigation();
});

async function fetchConfig() {
  try {
    const cfg = await api.config.getPublic();
    if (cfg.data?.freeAskLimit !== undefined) {
      freeAskLimit.value = cfg.data.freeAskLimit;
    }
  } catch { /* use default */ }
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

function handleLogin() {
  userStore.silentLogin();
}

function switchMainTab(tab: 'chat' | 'history') {
  activeTab.value = tab;
  if (tab === 'history' && historyList.value.length === 0) {
    loadHistory();
  }
}

function genId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function scrollToBottom() {
  scrollToId.value = '';
  nextTick(() => {
    scrollToId.value = 'msg-bottom';
  });
}

function updateMessage(id: string, content: string, cost?: number) {
  const msg = messages.value.find(m => m.id === id);
  if (msg) {
    msg.content = content;
    if (cost !== undefined) msg.pointsCost = cost;
  }
}

async function sendMessageRegular(question: string, aiMsgId: string) {
  try {
    const res = await api.ai.consult({
      question,
      channel: 'miniprogram',
      type: consultType.value,
      sessionId: sessionId.value || undefined,
      context: userContext.value || undefined,
    });
    sessionId.value = res.data.sessionId;
    updateMessage(aiMsgId, res.data.answer, res.data.pointsCost);
    userStore.fetchBalance();
  } catch (e: any) {
    updateMessage(aiMsgId, e.message || '抱歉，AI 服务暂时不可用，请稍后重试。');
  }
}

async function sendMessage() {
  const text = inputText.value.trim();
  if (!text || loading.value) return;

  // 未登录：检查免费次数
  if (!userStore.isLogin) {
    if (freeCount.value >= freeAskLimit.value) {
      showLoginModal.value = true;
      return;
    }
    freeCount.value++;
    uni.setStorageSync('free_ask_count', String(freeCount.value));
  }

  // 将分类信息追加到问题中
  const categoryLabel = categories.find(c => c.key === activeCategory.value)?.label || '';
  const fullQuestion = categoryLabel ? `[${categoryLabel}] ${text}` : text;

  inputText.value = '';
  messages.value.push({ id: genId(), role: 'user', content: text });
  scrollToBottom();

  const aiMsgId = genId();
  messages.value.push({ id: aiMsgId, role: 'ai', content: '' });
  loading.value = true;

  const token = uni.getStorageSync('token');
  let fullAnswer = '';
  let chunkBuffer = '';
  let streamStarted = false;
  let fallbackTriggered = false;

  const task = uni.request({
    url: `${BASE_URL}/ai/stream-consult`,
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    data: {
      question: fullQuestion,
      channel: 'miniprogram',
      type: consultType.value,
      sessionId: sessionId.value || undefined,
      context: userContext.value || undefined,
    },
    enableChunked: true,
    responseType: 'text',
    timeout: 60000,
    success() {
      if (!streamStarted && !fallbackTriggered) {
        fallbackTriggered = true;
        handleStreamFallback(fullQuestion, aiMsgId);
      }
    },
    fail() {
      if (!fallbackTriggered) {
        fallbackTriggered = true;
        handleStreamFallback(fullQuestion, aiMsgId);
      }
    },
    complete() {
      loading.value = false;
      scrollToBottom();
    },
  });

  if (typeof (task as any).onChunkReceived === 'function') {
    (task as any).onChunkReceived((res: any) => {
      streamStarted = true;
    const chunk = typeof res.data === 'string' ? res.data :
      (typeof TextDecoder !== 'undefined'
        ? new TextDecoder().decode(res.data)
        : String.fromCharCode.apply(null, Array.from(new Uint8Array(res.data))));
    chunkBuffer += chunk;

    const lines = chunkBuffer.split('\n');
    chunkBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.done) {
          sessionId.value = parsed.sessionId;
          updateMessage(aiMsgId, fullAnswer, parsed.pointsCost);
          userStore.fetchBalance();
        } else if (parsed.error) {
          updateMessage(aiMsgId, parsed.error);
        } else if (parsed.content) {
          fullAnswer += parsed.content;
          updateMessage(aiMsgId, fullAnswer);
        }
      } catch { /* skip malformed JSON */ }
    }
    scrollToBottom();
    });
  } else {
    fallbackTriggered = true;
    handleStreamFallback(fullQuestion, aiMsgId);
  }
}

async function handleStreamFallback(question: string, aiMsgId: string) {
  await sendMessageRegular(question, aiMsgId);
}

function switchConsultType() {
  consultType.value = consultType.value === 'normal' ? 'deep' : 'normal';
}

function goRecharge() {
  uni.navigateTo({ url: '/pages/recharge/index' });
}

async function loadHistory() {
  try {
    const res = await api.ai.getHistory(historyPage.value);
    const data = res.data as any;
    historyList.value = [...historyList.value, ...(data.list || [])];
    historyHasMore.value = historyList.value.length < (data.total || 0);
  } catch (e: any) {
    console.error('加载历史记录失败:', e?.message || e);
    uni.showToast({ title: '加载历史失败，请检查网络', icon: 'none' });
  }
}

function loadMoreHistory() {
  historyPage.value++;
  loadHistory();
}

async function enterHistorySession(item: any) {
  const sid = item?.sessionId || item?.id;
  if (!sid) {
    uni.showToast({ title: '会话ID缺失', icon: 'error' });
    return;
  }
  try {
    const res = await api.ai.getSession(sid);
    const history = (res.data as any[]) || [];
    if (history.length === 0) {
      uni.showToast({ title: '该会话暂无内容', icon: 'none' });
      return;
    }
    const msgs: Message[] = [];
    for (const h of history) {
      msgs.push({ id: genId(), role: 'user', content: h.question });
      msgs.push({ id: genId(), role: 'ai', content: h.answer || '（AI 未返回内容）' });
    }
    messages.value = msgs;
    sessionId.value = sid;
    activeTab.value = 'chat';
    scrollToBottom();
  } catch (e: any) {
    console.error('加载会话失败:', e?.message || e);
    uni.showToast({ title: '加载会话失败，请重试', icon: 'error' });
  }
}

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('zh-CN');
}
</script>

<style lang="scss" scoped>
.consult-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-page;
}

// ─── Top bar ─────────────────────────────────
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx $spacing-md;
  background: #fff;
}

.greeting {
  font-size: $font-lg;
  font-weight: 700;
  color: $text-primary;
}

.points-chip {
  background: #fff;
  border: 1rpx solid $border;
  border-radius: 20rpx;
  padding: 8rpx 20rpx;
  font-size: 22rpx;
  color: $text-secondary;
}

// ─── Login banner ────────────────────────────
.login-banner {
  background: $brand-light;
  margin: 0 $spacing-md 8rpx;
  border-radius: 12rpx;
  padding: 12rpx 20rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.login-text {
  font-size: 22rpx;
  color: $brand;
  flex: 1;
}

.login-link {
  font-size: 24rpx;
  color: $brand;
  font-weight: 600;
}

// ─── Tab bar ──────────────────────────────────
.tab-bar {
  display: flex;
  background: #fff;
  border-bottom: 1rpx solid $border;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: $spacing-sm 0;
  font-size: $font-md;
  color: $text-secondary;
  border-bottom: 4rpx solid transparent;

  &.active {
    color: $brand;
    border-bottom-color: $brand;
  }
}

// ─── Chat list ────────────────────────────────
.chat-list {
  flex: 1;
  padding: $spacing-sm $spacing-md;
  overflow-y: auto;
}

// ─── Welcome area ─────────────────────────────
.welcome-area {
  text-align: center;
  padding: $spacing-lg 0;
}

.welcome-icon {
  font-size: 72rpx;
  display: block;
}

.welcome-title {
  font-size: $font-xl;
  font-weight: 700;
  color: $text-primary;
  display: block;
  margin-top: $spacing-sm;
}

.welcome-desc {
  font-size: $font-sm;
  color: $text-secondary;
  margin-top: $spacing-xs;
  margin-bottom: $spacing-lg;
  display: block;
}

.cat-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  padding: 0 $spacing-md;
  margin-bottom: $spacing-md;
}

.cat-chip {
  padding: 16rpx 0;
  border-radius: 16rpx;
  font-size: 26rpx;
  color: $text-secondary;
  background: #fff;
  border: 1rpx solid $border;
  text-align: center;

  &.active {
    background: $brand-light;
    border-color: rgba($brand, 0.3);
    color: $brand;
    font-weight: 600;
  }
}

.quick-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 0 $spacing-md;
}

.quick-chip {
  background: #fff;
  border: 1rpx solid $border;
  border-radius: 20rpx;
  padding: 10rpx 20rpx;
  font-size: 24rpx;
  color: $text-secondary;
}

// ─── Messages ─────────────────────────────────
.message-item {
  display: flex;
  gap: $spacing-xs;
  margin-bottom: $spacing-md;
}

.msg-user {
  flex-direction: row-reverse;
}

.msg-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #fff;
  @include flex-center;
  font-size: $font-lg;
  flex-shrink: 0;
}

.msg-bubble {
  max-width: 70%;
  padding: $spacing-sm $spacing-md;
  border-radius: $radius-md;
  font-size: $font-md;
  line-height: 1.6;
}

.bubble-user {
  background: linear-gradient(135deg, $brand-hover, $secondary);
  color: #fff;
  border-radius: $radius-md $radius-md 0 $radius-md;
}

.bubble-ai {
  background: #fff;
  border: 1rpx solid $border;
  border-radius: $radius-md $radius-md $radius-md 0;
}

.msg-content {
  word-break: break-all;
  white-space: pre-wrap;
}

.msg-footer {
  margin-top: $spacing-xs;
  display: flex;
  justify-content: flex-end;
}

.msg-cost {
  font-size: $font-xs;
  color: $text-tertiary;
}

.typing-indicator {
  display: flex;
  gap: 8rpx;
  .dot {
    animation: blink 1.4s infinite both;
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes blink {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}

// ─── Input area ───────────────────────────────
.input-area {
  background: #fff;
  padding: $spacing-sm $spacing-md;
  border-top: 1rpx solid $border;
}

.points-warn {
  background: rgba(239, 68, 68, 0.08);
  border: 1rpx solid rgba(239, 68, 68, 0.2);
  border-radius: $radius-sm;
  padding: $spacing-xs $spacing-sm;
  margin-bottom: $spacing-sm;
  font-size: $font-xs;
  color: #f87171;
  line-height: 1.5;
}

.prompt-input {
  width: 100%;
  min-height: 80rpx;
  max-height: 240rpx;
  font-size: $font-md;
  color: $text-primary;
  line-height: 1.6;
}

.prompt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12rpx;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.char-hint {
  font-size: 22rpx;
  color: $text-tertiary;
}

.type-tag {
  font-size: 20rpx;
  color: $brand;
  background: $brand-light;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.context-btn {
  font-size: 20rpx;
  color: $text-secondary;
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

.context-form {
  margin-top: $spacing-sm;
}

.context-textarea {
  width: 100%;
  height: 180rpx;
  background: $bg-page;
  border: 1rpx solid $border;
  border-radius: $radius-md;
  padding: $spacing-sm;
  font-size: $font-sm;
  color: $text-primary;
  box-sizing: border-box;
}

.context-confirm {
  background: $brand;
  margin-top: $spacing-sm;
  padding: 12rpx;
  border-radius: $radius-md;
  text-align: center;

  text {
    color: #fff;
    font-size: $font-sm;
  }
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

// ─── History ──────────────────────────────────
.history-list {
  flex: 1;
  padding: $spacing-sm $spacing-md;
  overflow-y: auto;
}

.history-item {
  padding: $spacing-md;
  margin: 0 0 $spacing-sm;

  &:active {
    opacity: 0.8;
  }
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: $spacing-xs;
}

.history-question {
  font-size: $font-md;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: $spacing-sm;
}

.history-date {
  font-size: $font-xs;
  color: $text-tertiary;
  flex-shrink: 0;
}

.history-footer {
  display: flex;
  justify-content: space-between;
}

.history-type {
  font-size: $font-xs;
  color: $text-tertiary;
}

.history-cost {
  font-size: $font-xs;
  color: $warning;
}

.empty {
  text-align: center;
  padding: 120rpx 0;
  color: $text-tertiary;
  font-size: $font-sm;
}

.no-more {
  text-align: center;
  padding: $spacing-md;
  font-size: $font-sm;
  color: $text-secondary;
}
</style>
