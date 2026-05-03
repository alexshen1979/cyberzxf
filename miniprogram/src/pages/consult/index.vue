<template>
  <view class="consult-page">
    <!-- 对话列表 -->
    <scroll-view class="chat-list" scroll-y :scroll-into-view="scrollToId" :scroll-with-animation="true">
      <!-- 欢迎提示 -->
      <view class="welcome-card" v-if="messages.length === 0">
        <text class="welcome-icon">🤖</text>
        <text class="welcome-title">赛博张老师为您服务</text>
        <text class="welcome-desc">告诉我你的分数、目标或疑问，我会用张雪峰式的犀利分析帮你理清思路！</text>
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
      <view class="input-row" v-if="!showContextForm">
        <view class="input-wrapper">
          <input class="chat-input" v-model="inputText" placeholder="输入你的分数、目标或问题..."
            placeholder-style="color: #5a6080" confirm-type="send" @confirm="sendMessage" :disabled="loading" />
        </view>
        <view class="send-btn" :class="{ disabled: !inputText.trim() || loading }" @click="sendMessage">
          <text>发送</text>
        </view>
      </view>

      <!-- 快捷操作 -->
      <view class="quick-row">
        <view class="quick-btn" @click="showContextForm = !showContextForm">
          <text>📝 填写背景</text>
        </view>
        <view class="quick-btn" @click="switchConsultType">
          <text>{{ consultType === 'normal' ? '🔍 深度分析(18点)' : '💬 普通问答(5点)' }}</text>
        </view>
      </view>

      <!-- 个人背景填写表单 -->
      <view class="context-form" v-if="showContextForm">
        <textarea class="context-textarea" v-model="userContext" placeholder="填写你的背景信息，获得更精准的分析：
- 所在省份
- 文/理科
- 预估分数/排名
- 目标专业/学校
- 家庭情况（可选）" :maxlength="500" />
        <view class="context-btn" @click="showContextForm = false">
          <text>确认</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick, onLoad } from 'vue';
import { api } from '@/api';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  pointsCost?: number;
}

const messages = ref<Message[]>([]);
const inputText = ref('');
const loading = ref(false);
const showContextForm = ref(false);
const userContext = ref('');
const consultType = ref<'normal' | 'deep'>('normal');
const scrollToId = ref('');
const sessionId = ref('');

onLoad((options: any) => {
  const q = options?.question;
  if (q) {
    inputText.value = decodeURIComponent(q);
    sendMessage();
  }
});

function genId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function scrollToBottom() {
  scrollToId.value = '';
  nextTick(() => {
    scrollToId.value = 'msg-bottom';
  });
}

async function sendMessage() {
  const text = inputText.value.trim();
  if (!text || loading.value) return;

  inputText.value = '';

  // 添加用户消息
  messages.value.push({ id: genId(), role: 'user', content: text });
  scrollToBottom();

  loading.value = true;

  try {
    const res = await api.ai.consult({
      question: text,
      channel: 'miniprogram',
      type: consultType.value,
      sessionId: sessionId.value || undefined,
      context: userContext.value || undefined,
    });

    sessionId.value = res.data.sessionId;

    messages.value.push({
      id: genId(),
      role: 'ai',
      content: res.data.answer,
      pointsCost: res.data.pointsCost,
    });

    // 更新点数余额
    await userStore.fetchBalance();

  } catch (e: any) {
    messages.value.push({
      id: genId(),
      role: 'ai',
      content: e.message || '抱歉，AI 服务暂时不可用，请稍后重试。',
    });
  } finally {
    loading.value = false;
    scrollToBottom();
  }
}

function switchConsultType() {
  consultType.value = consultType.value === 'normal' ? 'deep' : 'normal';
}
</script>

<style lang="scss" scoped>
@import '@/styles/variables.scss';

.consult-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.chat-list {
  flex: 1;
  padding: $spacing-sm $spacing-md;
  overflow-y: auto;
}

.welcome-card {
  text-align: center;
  padding: $spacing-xl $spacing-md;
}

.welcome-icon {
  font-size: 80rpx;
  display: block;
}

.welcome-title {
  font-size: $font-xl;
  font-weight: 700;
  @include gradient-text;
  display: block;
  margin-top: $spacing-sm;
}

.welcome-desc {
  font-size: $font-sm;
  color: $text-secondary;
  margin-top: $spacing-xs;
  display: block;
}

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
  background: $bg-card;
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
  background: linear-gradient(135deg, $primary-dark, $secondary);
  color: #fff;
  border-radius: $radius-md $radius-md 0 $radius-md;
}

.bubble-ai {
  background: $bg-card;
  border: 1rpx solid $border-color;
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
  color: $text-dim;
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

.input-area {
  background: $bg-secondary;
  padding: $spacing-sm $spacing-md;
  border-top: 1rpx solid $border-color;
}

.input-row {
  display: flex;
  gap: $spacing-sm;
  align-items: center;
}

.input-wrapper {
  flex: 1;
  background: $bg-input;
  border-radius: $radius-lg;
  border: 1rpx solid $border-color;
  padding: $spacing-xs $spacing-md;
}

.chat-input {
  height: 72rpx;
  font-size: $font-md;
  color: $text-primary;
}

.send-btn {
  @include gradient-btn;
  padding: $spacing-xs $spacing-lg;
  border-radius: $radius-lg;
  font-size: $font-sm;
  font-weight: 600;
  white-space: nowrap;
  &.disabled {
    opacity: 0.5;
  }
}

.quick-row {
  display: flex;
  gap: $spacing-sm;
  margin-top: $spacing-sm;
}

.quick-btn {
  background: $bg-card;
  border: 1rpx solid $border-color;
  border-radius: $radius-lg;
  padding: $spacing-xs $spacing-md;
  font-size: $font-xs;
  color: $text-secondary;
}

.context-form {
  margin-top: $spacing-sm;
}

.context-textarea {
  width: 100%;
  height: 200rpx;
  background: $bg-input;
  border: 1rpx solid $border-color;
  border-radius: $radius-md;
  padding: $spacing-sm;
  font-size: $font-sm;
  color: $text-primary;
  box-sizing: border-box;
}

.context-btn {
  @include gradient-btn;
  margin-top: $spacing-sm;
  padding: $spacing-xs;
  border-radius: $radius-md;
  text-align: center;
  font-size: $font-sm;
}
</style>
