<template>
  <view class="consult-page">
    <!-- 顶部栏 -->
    <view class="top-bar">
      <text class="greeting">你好，{{ userStore.userInfo?.nickname || '同学' }}</text>
      <view class="top-actions">
        <view class="top-btn" @click="newConsultation">
          <image class="top-btn-icon" :src="getIconSrc('Plus')" mode="aspectFit" />
        </view>
        <view class="top-btn" @click="openHistory">
          <image class="top-btn-icon" :src="getIconSrc('Clock')" mode="aspectFit" />
        </view>
        <view class="points-chip" @click="goRecharge">
          <text>⚡ {{ userStore.pointsBalance }} 点</text>
        </view>
      </view>
    </view>
    <!-- 未登录提示 -->
    <view class="login-banner" v-if="!userStore.isLogin">
      <text class="login-text">
        剩余免费提问 {{ Math.max(0, freeAskLimit - freeCount) }} 次 · 登录后获得更多点数和深度分析
      </text>
      <text class="login-link" @click="handleLogin">登录 →</text>
    </view>

    <!-- 对话区域 -->
    <scroll-view class="chat-list" scroll-y :scroll-into-view="scrollToId" :scroll-with-animation="true">
      <view class="chat-content">
        <!-- 空状态：欢迎 + 分类 + 快捷提问 -->
        <view class="welcome-area" v-if="messages.length === 0">
          <text class="welcome-icon">🤖</text>
          <text class="welcome-title">打破信息差，关键选择不迷茫</text>
          <text class="welcome-desc">选一个方向，告诉我你的困惑</text>

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
            <view class="msg-top-actions" v-if="msg.role === 'ai' && msg.content">
              <view class="listen-icon-btn" :class="{ active: readingMessageId === msg.id }" @click.stop="toggleReadMessage(msg)">
                <image class="listen-icon" :src="getIconSrc(readingMessageId === msg.id ? 'PauseCircle' : 'Speaker')" mode="aspectFit" />
              </view>
              <view
                class="listen-icon-btn collapse-btn"
                v-if="canCollapseMessage(msg)"
                :class="{ active: isMessageCollapsed(msg.id) }"
                @click.stop="toggleMessageCollapse(msg.id)"
              >
                <image class="listen-icon" :src="getIconSrc(isMessageCollapsed(msg.id) ? 'ArrowDown' : 'ArrowUp')" mode="aspectFit" />
              </view>
            </view>
            <view class="msg-content-wrap" :class="{ collapsed: msg.role === 'ai' && isMessageCollapsed(msg.id) }">
              <text class="msg-content">{{ msg.content }}</text>
              <view class="collapse-fade" v-if="msg.role === 'ai' && isMessageCollapsed(msg.id)">
                <text>已收起，点上方箭头展开</text>
              </view>
            </view>
            <view class="msg-footer" v-if="msg.role === 'ai' && msg.content">
              <view class="listen-icon-btn bottom" :class="{ active: readingMessageId === msg.id }" @click.stop="toggleReadMessage(msg)">
                <image class="listen-icon" :src="getIconSrc(readingMessageId === msg.id ? 'PauseCircle' : 'Speaker')" mode="aspectFit" />
              </view>
              <view
                class="listen-icon-btn bottom collapse-btn"
                v-if="canCollapseMessage(msg)"
                :class="{ active: isMessageCollapsed(msg.id) }"
                @click.stop="toggleMessageCollapse(msg.id)"
              >
                <image class="listen-icon" :src="getIconSrc(isMessageCollapsed(msg.id) ? 'ArrowDown' : 'ArrowUp')" mode="aspectFit" />
              </view>
              <text class="msg-cost" v-if="msg.pointsCost">-{{ msg.pointsCost }} 点数</text>
            </view>
          </view>
        </view>

        <!-- 加载中 -->
        <view class="message-item msg-ai" v-if="loading && showTypingIndicator">
          <view class="msg-avatar"><text>🤖</text></view>
          <view class="msg-bubble bubble-ai typing-indicator">
            <text class="typing-text">对方正在输入</text>
            <view class="typing-dots">
              <text></text>
              <text></text>
              <text></text>
            </view>
          </view>
        </view>

        <view id="msg-bottom"></view>
      </view>
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
          placeholder="输入你的问题，或者选择上面的模版问题。"
          :maxlength="500"
          :auto-height="true"
          :disabled="loading"
        />

        <!-- 底部操作栏 -->
        <view class="prompt-footer">
          <view class="footer-left">
            <text class="char-hint">{{ inputText.length }}/500</text>
            <view class="type-switch">
              <text class="type-option" :class="{ active: consultType === 'normal' }" @click="consultType = 'normal'">普通 5点</text>
              <text class="type-option" :class="{ active: consultType === 'deep' }" @click="consultType = 'deep'">深度 18点</text>
            </view>
            <text class="mode-help" @click="showModeTips = true">区别</text>
            <text class="context-btn" :class="{ active: showContextForm }" @click="showContextForm = !showContextForm">背景</text>
          </view>
          <view class="send-btn" :class="{ disabled: !inputText.trim() || loading }" @click="sendMessage">
            <text>发送</text>
          </view>
        </view>

        <!-- 背景信息表单 -->
        <view class="context-form" v-if="showContextForm">
          <textarea class="context-textarea" v-model="userContext" :placeholder="contextPlaceholder" :maxlength="500" />
          <view class="context-confirm" @click="showContextForm = false">
            <text>确认</text>
          </view>
        </view>
      </view>

    <!-- 历史记录浮层 -->
    <view class="drawer-mask" v-if="showHistoryDrawer" @click="showHistoryDrawer = false">
      <view class="drawer-panel" @click.stop>
        <view class="drawer-header">
          <text class="drawer-title">历史记录</text>
          <text class="drawer-close" @click="showHistoryDrawer = false">✕</text>
        </view>
        <!-- 未登录 -->
        <view class="drawer-login" v-if="!userStore.isLogin">
          <text class="drawer-login-text">登录后可查看咨询历史</text>
          <view class="drawer-login-btn" @click="handleLogin"><text>微信一键登录</text></view>
        </view>
        <!-- 已登录：历史列表 -->
        <scroll-view v-else class="drawer-list" scroll-y @scrolltolower="loadMoreHistory">
          <view class="history-item" v-for="item in historyList" :key="item.id" @click="enterHistory(item)">
            <view class="history-meta">
              <text class="history-type">{{ item.type === 'deep' ? '深度分析' : '普通问答' }}</text>
              <text class="history-date">{{ formatDate(item.createdAt) }}</text>
            </view>
            <text class="history-question">{{ formatHistoryQuestion(item.question) }}</text>
            <text class="history-answer" v-if="item.answer">{{ historyPreview(item.answer) }}</text>
            <view class="history-footer">
              <text class="history-cost" v-if="item.pointsCost">-{{ item.pointsCost }} 点</text>
              <text class="history-enter">查看对话</text>
            </view>
          </view>
          <view class="empty" v-if="historyList.length === 0">
            <text>暂无咨询记录</text>
          </view>
          <view class="no-more" v-if="!historyHasMore && historyList.length > 0">—— 没有更多了 ——</view>
        </scroll-view>
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

    <view class="modal-mask" v-if="showModeTips" @click="showModeTips = false">
      <view class="mode-card" @click.stop>
        <view class="mode-head">
          <view>
            <text class="mode-title">普通和深度</text>
            <text class="mode-sub">按问题复杂度选，别多花冤枉点数</text>
          </view>
          <text class="mode-close" @click="showModeTips = false">✕</text>
        </view>
        <view class="mode-option-card">
          <view class="mode-option-top">
            <text class="mode-option-name">普通问答</text>
            <text class="mode-badge">5 点</text>
          </view>
          <text class="mode-desc">适合快速问答、概念解释、方向判断。回答更短，先把核心结论说清楚。</text>
          <text class="mode-example">比如：某专业学什么、就业大概怎么样、两个方向怎么初步选。</text>
        </view>
        <view class="mode-option-card deep">
          <view class="mode-option-top">
            <text class="mode-option-name">深度分析</text>
            <text class="mode-badge deep">18 点</text>
          </view>
          <text class="mode-desc">适合择校、专业取舍、院校对比、志愿风险。会结合背景拆依据、风险和下一步。</text>
          <text class="mode-example">比如：这所学校值不值得冲、几个方案怎么排序、调剂风险怎么避。</text>
        </view>
        <view class="mode-confirm" @click="showModeTips = false"><text>知道了</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { api, BASE_URL } from '@/api';
import CategoryIcon from '@/components/CategoryIcon.vue';
import { getIconSrc } from '@/utils/iconSvgs';
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

declare const requirePlugin: undefined | ((name: string) => any);

let speechAudio: any = null;
let WechatSIPlugin: any = null;
let speechRequestSeq = 0;
let speechQueue: { seq: number; chunks: string[]; index: number; messageId: string } | null = null;
const SPEECH_PLAYBACK_RATE = 1.16;
const SPEECH_CHUNK_MAX_BYTES = 190;
const SPEECH_MAX_CHUNKS = 32;
const PUBLIC_FIGURE_TERM = ['张', '雪', '峰'].join('');
const FIXED_NOTICE_TITLE = ['免', '责', '声', '明'].join('');

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 分类（从后端加载）
const categories = ref<Array<{ key: string; icon: string; label: string }>>([]);
const activeCategory = ref('');

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

const messages = ref<Message[]>([]);
const inputText = ref('');
const loading = ref(false);
const activeAiMessageId = ref('');
const showTypingIndicator = computed(() => {
  if (!loading.value || !activeAiMessageId.value) return false;
  const msg = messages.value.find(item => item.id === activeAiMessageId.value);
  return !msg?.content;
});
const showContextForm = ref(false);
const showModeTips = ref(false);
const readingMessageId = ref('');
const userContext = ref('');
const contextPlaceholder = [
  '填写你的背景信息，获得更精准的分析：',
  '- 所在省份',
  '- 文/理科',
  '- 预估分数/排名',
  '- 目标专业/学校',
  '- 家庭情况（可选）',
].join('\n');
const consultType = ref<'normal' | 'deep'>('normal');
const scrollToId = ref('');
const sessionId = ref('');

// 历史记录
const showHistoryDrawer = ref(false);
const historyList = ref<any[]>([]);
const historyPage = ref(1);
const historyHasMore = ref(true);
const revealStates: Record<string, { pending: string; timer?: ReturnType<typeof setInterval>; cost?: number }> = {};
const collapsedMessages = ref<Record<string, boolean>>({});
const COLLAPSE_MIN_LENGTH = 360;
const COLLAPSE_MIN_LINES = 8;

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
    openHistory();
    return;
  }
  if (userStore.pendingConsult) {
    userStore.pendingConsult = false;
    if (userStore.consultQuestion) {
      inputText.value = userStore.consultQuestion;
    }
    if (userStore.consultContext) {
      userContext.value = userStore.consultContext;
      userStore.consultContext = '';
    } else {
      hydrateContextFromLatestReport();
    }
    const type = userStore.consultType;
    consultType.value = type === 'deep' ? 'deep' : 'normal';
    if (inputText.value) {
      nextTick(() => {
        setTimeout(() => sendMessage(), 180);
      });
    }
  }
}

const pageLoaded = ref(false);

async function initPage() {
  await loadCategories();
  fetchConfig();
  loadQuickQuestions(activeCategory.value);
  hydrateContextFromLatestReport();
}

onLoad((options: any) => {
  // 初始化
  freeCount.value = parseInt(uni.getStorageSync('free_ask_count') || '0');
  initPage();

  if (options?.tab === 'history') {
    openHistory();
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
  if (userStore.isLogin && historyList.value.length === 0) {
    resetHistory();
    loadHistory(false);
  }
  handleStoreNavigation();
});

onPullDownRefresh(async () => {
  try {
    await Promise.all([
      loadCategories(),
      loadQuickQuestions(activeCategory.value),
      userStore.fetchBalance(),
    ]);
    if (userStore.isLogin) {
      resetHistory();
      await loadHistory(false);
    }
  } finally {
    uni.stopPullDownRefresh();
  }
});

async function fetchConfig() {
  try {
    const cfg = await api.config.getPublic();
    if (cfg.data?.freeAskLimit !== undefined) {
      freeAskLimit.value = cfg.data.freeAskLimit;
    }
  } catch { /* use default */ }
}

async function loadQuickQuestions(category?: string) {
  try {
    const res = await api.ai.getQuickQuestions(category);
    if ((res.data as any[])?.length > 0) {
      quickQuestions.value = res.data as any[];
    } else {
      quickQuestions.value = defaultQuestions;
    }
  } catch {
    quickQuestions.value = defaultQuestions;
  }
}

// 分类切换时自动刷新快捷提问
watch(activeCategory, (cat) => {
  if (cat) loadQuickQuestions(cat);
  else loadQuickQuestions();
});

async function loadCategories() {
  try {
    const res = await api.categories.list();
    if ((res.data as any[])?.length > 0) {
      categories.value = res.data as any[];
      // 优先选择默认分类，否则选第一个
      if (!activeCategory.value) {
        const def = categories.value.find((c: any) => c.isDefault);
        activeCategory.value = def?.key || categories.value[0]?.key || '';
      }
    }
  } catch { /* keep defaults */ }
}

function handleLogin() {
  userStore.loginWithWechatProfile();
}

function openHistory() {
  showHistoryDrawer.value = true;
  if (historyList.value.length === 0) loadHistory();
}

function newConsultation() {
  stopAllRevealTimers();
  stopReading();
  activeAiMessageId.value = '';
  collapsedMessages.value = {};
  messages.value = [];
  sessionId.value = '';
  inputText.value = '';
  hydrateContextFromLatestReport();
  scrollToBottom();
}

function enterHistory(item: any) {
  showHistoryDrawer.value = false;
  enterHistorySession(item);
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

function speechByteLength(text: string) {
  let total = 0;
  for (const char of text) {
    const code = char.codePointAt(0) || 0;
    total += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return total;
}

function ensureSpeechSentenceEnd(text = '') {
  const clean = text.trim().replace(/[；;，,、:：]+$/g, '。');
  if (!clean) return '';
  if (/[。！？!?.]$/.test(clean)) return clean;
  return `${clean}。`;
}

function normalizeSpeechLines(content = '') {
  return sanitizeAnswerPart(content)
    .split(/\r?\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line
      .replace(/^\s*(\d+)[.、]\s*/g, '第$1点，')
      .replace(/^\s*[-•]\s*/g, '')
      .trim())
    .filter(Boolean)
    .map(ensureSpeechSentenceEnd)
    .join(' ');
}

function normalizeSpeechText(content = '') {
  return normalizeSpeechLines(content)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/(^|\s)(\d+)[.、]\s*/g, '$1第$2点，')
    .replace(/[#>*`_~|{}\[\]\\]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s，。！？；：、,.!?;:()（）《》“”"'\-+%/]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*([，。！？；：、,.!?;:])\s*/g, '$1')
    .replace(/[，,]{2,}/g, '，')
    .replace(/[。]{2,}/g, '。')
    .trim();
}

function simplifySpeechChunk(content = '') {
  return content
    .replace(/[《》“”"'\-+%/()（）:：]/g, ' ')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9，。！？；、,.!?;\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSpeechText(content = '') {
  const text = normalizeSpeechText(content);
  if (!text) return [];
  const pieces = text.match(/[^。！？!?；;]+[。！？!?；;]?/g) || [text];
  const chunks: string[] = [];
  let current = '';

  const pushChunk = (chunk: string) => {
    const clean = ensureSpeechSentenceEnd(chunk.trim());
    if (clean && chunks.length < SPEECH_MAX_CHUNKS) chunks.push(clean);
  };

  const pushLongPiece = (piece: string) => {
    let part = '';
    for (const char of piece) {
      const next = `${part}${char}`;
      if (speechByteLength(next) > SPEECH_CHUNK_MAX_BYTES) {
        pushChunk(part);
        part = char;
        if (chunks.length >= SPEECH_MAX_CHUNKS) return '';
      } else {
        part = next;
      }
    }
    return part;
  };

  for (const piece of pieces) {
    if (chunks.length >= SPEECH_MAX_CHUNKS) break;
    const clean = ensureSpeechSentenceEnd(piece.trim());
    if (!clean) continue;
    const candidate = `${current}${clean}`;
    if (speechByteLength(candidate) <= SPEECH_CHUNK_MAX_BYTES) {
      current = candidate;
      continue;
    }
    pushChunk(current);
    current = '';
    if (speechByteLength(clean) <= SPEECH_CHUNK_MAX_BYTES) {
      current = clean;
    } else {
      current = pushLongPiece(clean);
    }
  }
  pushChunk(current);
  return chunks;
}

function getSpeechAudio() {
  if (speechAudio) return speechAudio;
  const wxApi = (globalThis as any).wx || (uni as any);
  const factory = (wxApi as any)?.createInnerAudioContext || (uni as any).createInnerAudioContext;
  if (typeof factory !== 'function') return null;
  speechAudio = factory.call(wxApi);
  speechAudio.obeyMuteSwitch = false;
  try {
    speechAudio.playbackRate = SPEECH_PLAYBACK_RATE;
  } catch { /* ignore */ }
  speechAudio.onEnded?.(() => {
    playNextSpeechChunk();
  });
  speechAudio.onStop?.(() => {
    if (!speechQueue) readingMessageId.value = '';
  });
  speechAudio.onError?.(() => {
    speechQueue = null;
    readingMessageId.value = '';
    uni.showToast({ title: '朗读失败，请稍后再试', icon: 'none' });
  });
  return speechAudio;
}

function getWechatSIPlugin() {
  if (WechatSIPlugin) return WechatSIPlugin;
  const loaders = [
    () => (typeof requirePlugin === 'function' ? requirePlugin('WechatSI') : null),
    () => {
      const req = (globalThis as any).requirePlugin;
      return typeof req === 'function' ? req('WechatSI') : null;
    },
    () => {
      const req = (globalThis as any).wx?.requirePlugin;
      return typeof req === 'function' ? req('WechatSI') : null;
    },
  ];
  for (const load of loaders) {
    try {
      const plugin = load();
      if (plugin) {
        WechatSIPlugin = plugin;
        break;
      }
    } catch (err) {
      console.warn('[consult] WechatSI 插件加载失败', err);
    }
  }
  return WechatSIPlugin;
}

function stopReading() {
  speechRequestSeq++;
  speechQueue = null;
  uni.hideLoading();
  if (speechAudio) {
    try {
      speechAudio.stop();
    } catch { /* ignore */ }
  }
  readingMessageId.value = '';
}

function toggleReadMessage(msg: Message) {
  if (readingMessageId.value === msg.id) {
    stopReading();
    return;
  }
  readMessage(msg);
}

function readMessage(msg: Message) {
  const chunks = splitSpeechText(msg.content);
  if (!chunks.length) {
    uni.showToast({ title: '暂无可朗读内容', icon: 'none' });
    return;
  }

  const plugin = getWechatSIPlugin();
  const audio = getSpeechAudio();
  if (!plugin?.textToSpeech) {
    console.warn('[consult] WechatSI textToSpeech 不可用', plugin);
    uni.showToast({ title: '朗读插件未就绪', icon: 'none' });
    return;
  }
  if (!audio) {
    console.warn('[consult] InnerAudioContext 不可用');
    uni.showToast({ title: '音频播放不可用', icon: 'none' });
    return;
  }

  stopReading();
  const seq = ++speechRequestSeq;
  readingMessageId.value = msg.id;
  speechQueue = { seq, chunks, index: 0, messageId: msg.id };
  uni.showLoading({ title: '准备朗读...', mask: true });
  playNextSpeechChunk();
}

function playNextSpeechChunk() {
  const queue = speechQueue;
  if (!queue || queue.seq !== speechRequestSeq) {
    speechQueue = null;
    readingMessageId.value = '';
    return;
  }

  if (queue.index >= queue.chunks.length) {
    speechQueue = null;
    readingMessageId.value = '';
    return;
  }

  const plugin = getWechatSIPlugin();
  const audio = getSpeechAudio();
  if (!plugin?.textToSpeech || !audio) {
    speechQueue = null;
    readingMessageId.value = '';
    uni.hideLoading();
    uni.showToast({ title: '朗读服务暂不可用', icon: 'none' });
    return;
  }

  const content = queue.chunks[queue.index];
  queue.index += 1;
  requestSpeechChunk(queue, content, 0);
}

function requestSpeechChunk(
  queue: { seq: number; chunks: string[]; index: number; messageId: string },
  content: string,
  attempt: number,
) {
  const plugin = getWechatSIPlugin();
  const audio = getSpeechAudio();
  if (!plugin?.textToSpeech || !audio || queue.seq !== speechRequestSeq) return;

  plugin.textToSpeech({
    lang: 'zh_CN',
    tts: true,
    content,
    success: (res: any) => {
      if (queue.seq !== speechRequestSeq) return;
      uni.hideLoading();
      if (res?.retcode && res.retcode !== 0) {
        handleSpeechChunkError(queue, content, attempt, res);
        return;
      }
      const filePath = res?.filename || res?.tempFilePath || res?.filePath;
      if (!filePath) {
        console.warn('[consult] 朗读音频生成失败，返回值缺少音频地址', res);
        handleSpeechChunkError(queue, content, attempt, res);
        return;
      }
      try {
        audio.stop?.();
        audio.src = filePath;
        try {
          audio.playbackRate = SPEECH_PLAYBACK_RATE;
        } catch { /* ignore */ }
        audio.play();
      } catch {
        handleSpeechChunkError(queue, content, attempt, { msg: 'audio play failed' });
      }
    },
    fail: (err: any) => {
      if (queue.seq !== speechRequestSeq) return;
      uni.hideLoading();
      handleSpeechChunkError(queue, content, attempt, err);
    },
  });
}

function handleSpeechChunkError(
  queue: { seq: number; chunks: string[]; index: number; messageId: string },
  content: string,
  attempt: number,
  err: any,
) {
  if (queue.seq !== speechRequestSeq) return;
  console.warn('[consult] WechatSI textToSpeech 单段失败', {
    err,
    attempt,
    length: content.length,
    bytes: speechByteLength(content),
  });

  const retryContent = simplifySpeechChunk(content);
  if (attempt < 1 && retryContent && retryContent !== content) {
    setTimeout(() => {
      requestSpeechChunk(queue, retryContent, attempt + 1);
    }, 160);
    return;
  }

  if (queue.index < queue.chunks.length) {
    setTimeout(() => playNextSpeechChunk(), 120);
    return;
  }

  speechQueue = null;
  readingMessageId.value = '';
  uni.showToast({ title: '部分内容朗读失败', icon: 'none' });
}

function appendMessageText(id: string, delta: string, cost?: number) {
  const clean = sanitizeAnswerPart(delta, { preserveEdges: true });
  if (!clean && cost === undefined) return;
  ensureAiMessage(id);
  if (cost !== undefined) {
    const msg = messages.value.find(m => m.id === id);
    if (msg) msg.pointsCost = cost;
  }
  if (!clean) return;
  const state = revealStates[id] || { pending: '' };
  state.pending += clean;
  if (cost !== undefined) state.cost = cost;
  revealStates[id] = state;
  startRevealTimer(id);
}

function canCollapseMessage(msg: Message) {
  if (msg.role !== 'ai' || !msg.content) return false;
  const lineCount = msg.content.split(/\r?\n/).filter(Boolean).length;
  return msg.content.length >= COLLAPSE_MIN_LENGTH || lineCount >= COLLAPSE_MIN_LINES;
}

function isMessageCollapsed(id: string) {
  return Boolean(collapsedMessages.value[id]);
}

function toggleMessageCollapse(id: string) {
  collapsedMessages.value = Object.assign({}, collapsedMessages.value, {
    [id]: !collapsedMessages.value[id],
  });
  nextTick(scrollToBottom);
}

function startRevealTimer(id: string) {
  const state = revealStates[id];
  if (!state || state.timer) return;

  state.timer = setInterval(() => {
    const current = revealStates[id];
    if (!current) return;
    const msg = messages.value.find(m => m.id === id);
    if (!msg) {
      clearRevealTimer(id);
      return;
    }
    if (!current.pending) {
      clearRevealTimer(id);
      return;
    }

    const step = current.pending.startsWith('\n') ? 1 : Math.min(current.pending.length, current.pending.length > 80 ? 5 : 3);
    const next = current.pending.slice(0, step);
    current.pending = current.pending.slice(step);
    msg.content = sanitizeAnswerPart(`${msg.content}${next}`, { preserveEdges: true });
    if (current.cost !== undefined) msg.pointsCost = current.cost;
    scrollToBottom();
  }, 24);
}

function clearRevealTimer(id: string) {
  const state = revealStates[id];
  if (!state) return;
  if (state.timer) clearInterval(state.timer);
  delete revealStates[id];
}

function finishMessageReveal(id: string, cost?: number) {
  const msg = messages.value.find(m => m.id === id);
  if (msg) {
    msg.content = sanitizeAnswerPart(msg.content);
    if (cost !== undefined) msg.pointsCost = cost;
    if (canCollapseMessage(msg) && collapsedMessages.value[id] === undefined) {
      collapsedMessages.value = Object.assign({}, collapsedMessages.value, { [id]: true });
    }
  }
}

function stopAllRevealTimers() {
  Object.keys(revealStates).forEach(clearRevealTimer);
}

function ensureAiMessage(id: string) {
  if (!messages.value.some(m => m.id === id)) {
    messages.value.push({ id, role: 'ai', content: '' });
  }
}

function hydrateContextFromLatestReport() {
  if (userContext.value.trim()) return;
  const context = buildLatestVolunteerContext();
  if (context) userContext.value = context;
}

function buildLatestVolunteerContext() {
  const latest = uni.getStorageSync('latest_volunteer_report');
  const input = latest?.input || latest?.inputSnapshot || latest?.result?.input;
  if (!input) return '';
  return [
    input.province ? `省份：${input.province}` : '',
    input.subjectType ? `科类/选科：${input.subjectType}` : '',
    input.score ? `分数：${input.score}` : '',
    input.rank ? `位次：${input.rank}` : '',
    input.targetBatch ? `目标批次：${input.targetBatch}` : '',
    Array.isArray(input.preferredCities) && input.preferredCities.length ? `目标城市或省份：${input.preferredCities.join('、')}` : '',
    Array.isArray(input.preferredMajors) && input.preferredMajors.length ? `偏好专业：${input.preferredMajors.join('、')}` : '',
    Array.isArray(input.avoidMajors) && input.avoidMajors.length ? `规避专业：${input.avoidMajors.join('、')}` : '',
    input.riskPreference ? `风险偏好：${riskPreferenceLabel(input.riskPreference)}` : '',
    input.familyExpectation ? `家庭/个人期待：${String(input.familyExpectation).slice(0, 160)}` : '',
  ].filter(Boolean).join('\n');
}

function riskPreferenceLabel(value: string) {
  if (value === 'conservative') return '稳妥优先';
  if (value === 'aggressive') return '适度进攻';
  return '稳中带冲';
}

function sanitizeAnswerPart(content = '', options: { preserveEdges?: boolean } = {}) {
  const cleaned = content
    .replace(/^[#＃]+\s*[^\n#＃]{0,12}上线[！!。.\s]*$/gm, '')
    .replace(/(?:^|\n)\s*第三方\s*AI\s*服务[^。！？!?；;\n]*(?:异常|不可用|失败)[^。！？!?；;\n]*[。！？!?；;]?\s*/g, '\n')
    .replace(new RegExp(`^[#＃]{1,6}\\s*(?:${escapeRegExp(FIXED_NOTICE_TITLE)}|温馨提醒|重要声明)\\s*$`, 'gm'), '')
    .replace(/📌\s*温馨提醒[:：][\s\S]*?(?=\n{2,}|$)/g, '')
    .replace(new RegExp(`(?:^|\\n)\\s*${escapeRegExp(FIXED_NOTICE_TITLE)}[:：][\\s\\S]*?(?=\\n{2,}|$)`, 'g'), '\n')
    .replace(/(?:^|\n)\s*重要声明[:：][\s\S]*?(?=\n{2,}|$)/g, '\n')
    .replace(new RegExp(`[^。！？!?；;\\n]*${escapeRegExp(PUBLIC_FIGURE_TERM)}[^。！？!?；;\\n]*[。！？!?；;]?`, 'g'), '')
    .replace(/[^。！？!?；;\n]*(?:公开言论启发|风格启发|非本人观点|本人观点|复刻)[^。！？!?；;\n]*[。！？!?；;]?/g, '')
    .replace(/本回答内容由AI生成，仅作参考，不构成升学决策唯一依据。?建议结合实际情况，多方查证后做决定。?/g, '')
    .replace(/本回答仅作参考，不构成升学决策唯一依据。?/g, '')
    .replace(/仅供参考，不构成[^。！？!?；;\n]*[。！？!?；;]?/g, '')
    .replace(/我是AI助手赛博张老师[^。]*。?/g, '')
    .replace(/\n{3,}/g, '\n\n');
  return options.preserveEdges ? cleaned : cleaned.trim();
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
    appendMessageText(aiMsgId, res.data.answer, res.data.pointsCost);
    userStore.fetchBalance();
  } catch (e: any) {
    appendMessageText(aiMsgId, buildLocalErrorAnswer(question, e));
  }
}

function buildLocalErrorAnswer(question: string, error: any) {
  const errMsg = String(error?.message || '');
  const school = extractContextLine('关注院校') || extractSchoolFromQuestion(question);
  const province = extractContextLine('考生省份') || extractContextLine('省份');
  const subject = extractContextLine('选科/科类') || extractContextLine('科类/选科');
  const score = extractContextLine('分数');
  const rank = extractContextLine('位次');
  const target = extractContextLine('目标城市') || extractContextLine('偏好城市') || extractContextLine('目标城市或省份');
  const preferredMajors = extractContextLine('偏好专业');
  const avoidMajors = extractContextLine('规避专业');
  const backgroundLine = [province, subject, score ? `${score}分` : '', rank ? `位次${rank}` : ''].filter(Boolean).join('，');
  if (school) {
    return [
      `先看结论：${school}要不要放进志愿，要按${backgroundLine || '你的分数和位次'}来判断，核心看近三年录取位次、专业组可接受度、城市和就业资源。`,
      '',
      '建议你这样看：',
      `1. 先用${rank ? `位次 ${rank}` : score ? `${score} 分` : '你的位次'}对比这所学校近三年最低录取位次，别只看分数。`,
      `2. 再核对专业组。${preferredMajors ? `偏好专业是 ${preferredMajors}，要看能不能进相关专业线。` : '偏好专业没填时，先把能接受和不能接受的方向分清。'}${avoidMajors ? ` 规避 ${avoidMajors} 的组要谨慎。` : ''}`,
      `3. 城市也要算进去。${target ? `你填了目标城市或省份 ${target}，如果学校所在地不匹配，就要确认学校层次或专业优势能不能抵消。` : '如果城市不喜欢，再好的保底也可能读得难受。'}`,
    ].join('\n');
  }
  if (errMsg.includes('点数不足') || errMsg.includes('登录') || errMsg.includes('过期')) return errMsg;
  return '先给简版判断：优先用位次看匹配度，再看专业和城市，不要只按学校名排序。';
}

function extractContextLine(label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = userContext.value.match(new RegExp(`${escaped}[：:]\\s*([^\\n]+)`));
  return match?.[1]?.trim() || '';
}

function extractSchoolFromQuestion(question: string) {
  const match = question.match(/分析\s*([^：:，,。\n]+?大学|[^：:，,。\n]+?学院|[^：:，,。\n]+?学校)/);
  return match?.[1]?.trim() || '';
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
  const categoryLabel = categories.value.find(c => c.key === activeCategory.value)?.label || '';
  const fullQuestion = categoryLabel ? `[${categoryLabel}] ${text}` : text;

  inputText.value = '';
  messages.value.push({ id: genId(), role: 'user', content: text });
  scrollToBottom();

  const aiMsgId = genId();
  activeAiMessageId.value = aiMsgId;
  loading.value = true;

  const token = uni.getStorageSync('token');
  let chunkBuffer = '';
  let streamStarted = false;
  let fallbackTriggered = false;
  let fallbackPromise: Promise<void> | null = null;

  const runFallback = () => {
    if (!fallbackTriggered) {
      fallbackTriggered = true;
      fallbackPromise = handleStreamFallback(fullQuestion, aiMsgId);
    }
    return fallbackPromise;
  };

  const task = uni.request({
    url: `${BASE_URL}/ai/stream-consult`,
    method: 'POST',
    header: Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: `Bearer ${token}` } : {},
    ),
    data: {
      question: fullQuestion,
      channel: 'miniprogram',
      type: consultType.value,
      sessionId: sessionId.value || undefined,
      context: userContext.value || undefined,
    },
    enableChunked: true,
    responseType: 'text',
    timeout: consultType.value === 'deep' ? 90000 : 60000,
    success() {},
    fail() {
      runFallback();
    },
    complete() {
      if (!streamStarted) runFallback();
      const finish = () => {
        loading.value = false;
        activeAiMessageId.value = '';
        scrollToBottom();
      };
      if (fallbackPromise) fallbackPromise.finally(finish);
      else finish();
    },
  });

  if (typeof (task as any).onChunkReceived === 'function') {
    (task as any).onChunkReceived((res: any) => {
      streamStarted = true;
      let chunk = '';
      try {
        chunk = typeof res.data === 'string' ? res.data :
          (typeof TextDecoder !== 'undefined'
            ? new TextDecoder('utf-8').decode(res.data)
            : String.fromCharCode.apply(null, Array.from(new Uint8Array(res.data))));
      } catch {
        chunk = '';
      }
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
            finishMessageReveal(aiMsgId, parsed.pointsCost);
            userStore.fetchBalance();
          } else if (parsed.error) {
            appendMessageText(aiMsgId, parsed.error);
          } else if (parsed.content) {
            appendMessageText(aiMsgId, parsed.content);
          }
        } catch { /* skip malformed JSON */ }
      }
      scrollToBottom();
    });
  } else {
    await runFallback();
    loading.value = false;
    activeAiMessageId.value = '';
  }
}

async function handleStreamFallback(question: string, aiMsgId: string) {
  await sendMessageRegular(question, aiMsgId);
}

function goRecharge() {
  uni.navigateTo({ url: '/pages/recharge/index' });
}

function resetHistory() {
  historyPage.value = 1;
  historyList.value = [];
  historyHasMore.value = true;
}

async function loadHistory(showError = true) {
  try {
    const res = await api.ai.getHistory(historyPage.value);
    const data = res.data as any;
    historyList.value = [...historyList.value, ...(data.list || [])];
    historyHasMore.value = historyList.value.length < (data.total || 0);
  } catch (e: any) {
    console.error('加载历史记录失败:', e?.message || e);
    if (showError) uni.showToast({ title: '加载历史失败，请检查网络', icon: 'none' });
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
    collapsedMessages.value = msgs.reduce((acc: Record<string, boolean>, msg) => {
      if (canCollapseMessage(msg)) acc[msg.id] = true;
      return acc;
    }, {});
    sessionId.value = sid;
    scrollToBottom();
  } catch (e: any) {
    console.error('加载会话失败:', e?.message || e);
    uni.showToast({ title: '加载会话失败，请重试', icon: 'error' });
  }
}

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

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('zh-CN');
}

function stripCategoryPrefix(text = '') {
  return String(text).replace(/^\[[^\]]+\]\s*/, '').trim();
}

function formatHistoryQuestion(question = '') {
  return stripCategoryPrefix(question) || '未命名话题';
}

function historyPreview(answer = '') {
  const text = sanitizeAnswerPart(answer)
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 76 ? `${text.slice(0, 76)}...` : text;
}
</script>

<style lang="scss" scoped>
.consult-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $bg-page;
  overflow: hidden;
}

// ─── Top bar ─────────────────────────────────
.top-bar {
  position: sticky;
  top: 0;
  z-index: 120;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx $spacing-md;
  background: #fff;
  border-bottom: 1rpx solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.04);
  box-sizing: border-box;
}

.greeting {
  font-size: $font-lg;
  font-weight: 700;
  color: $text-primary;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-actions { display: flex; align-items: center; gap: 12rpx; }

.top-btn {
  width: 56rpx; height: 56rpx;
  border-radius: 50%;
  background: $bg-page;
  @include flex-center;
  font-size: 28rpx;
  &:active { opacity: 0.7; }
}

.top-btn-icon {
  width: 32rpx;
  height: 32rpx;
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

// ─── Chat list ────────────────────────────────
.chat-list {
  flex: 1;
  min-height: 0;
}

.chat-content {
  padding: $spacing-sm $spacing-md;
}

// ─── Welcome area ─────────────────────────────
.welcome-area {
  text-align: center;
  padding: 32rpx 0;
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
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-bottom: $spacing-md;
  padding-right: 0;
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
  background: #fff;
  border: 1rpx solid $border;
  width: calc((100% - 16rpx) / 2);
  box-sizing: border-box;
  margin-bottom: 16rpx;

  &.active {
    font-weight: 600;
  }
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
  box-sizing: border-box;
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

.msg-content-wrap {
  position: relative;
}

.msg-content-wrap.collapsed {
  max-height: 420rpx;
  overflow: hidden;
}

.msg-content {
  display: block;
  word-break: break-all;
  white-space: pre-wrap;
}

.msg-top-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10rpx;
  margin-bottom: 8rpx;
}

.msg-footer {
  margin-top: 14rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12rpx;
}

.bubble-ai .msg-footer {
  justify-content: space-between;
}

.listen-icon-btn {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  background: #f8fafc;
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 6rpx 16rpx rgba(15, 23, 42, 0.05);

  &:active {
    transform: scale(0.96);
  }
}

.listen-icon-btn.active {
  background: #fff7ed;
  border-color: #fed7aa;
}

.collapse-btn.active {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.listen-icon-btn.bottom {
  width: 48rpx;
  height: 48rpx;
}

.listen-icon {
  width: 28rpx;
  height: 28rpx;
}

.msg-cost {
  margin-left: auto;
  font-size: $font-xs;
  color: $text-tertiary;
}

.collapse-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 70rpx 0 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0), #fff 58%);
  text-align: center;
  pointer-events: none;

  text {
    display: inline-block;
    padding: 6rpx 14rpx;
    border-radius: 999rpx;
    background: #f8fafc;
    color: $text-tertiary;
    font-size: 20rpx;
  }
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 14rpx;
  color: $text-secondary;
  background: #f8fafc;
  border-color: rgba(15, 118, 110, 0.12);
  .typing-text {
    font-size: $font-sm;
  }
}

.typing-dots {
  display: flex;
  align-items: center;
  gap: 7rpx;
}

.typing-dots text {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #0f766e;
  animation: typing-bounce 1.2s infinite ease-in-out;
}

.typing-dots text:nth-child(2) {
  animation-delay: 0.16s;
}

.typing-dots text:nth-child(3) {
  animation-delay: 0.32s;
}

@keyframes typing-bounce {
  0%, 80%, 100% {
    transform: translateY(0);
    opacity: 0.35;
  }
  40% {
    transform: translateY(-8rpx);
    opacity: 1;
  }
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
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.char-hint {
  font-size: 22rpx;
  color: $text-tertiary;
}

.type-switch {
  display: flex;
  padding: 4rpx;
  border-radius: 14rpx;
  background: #f1f5f9;
  border: 1rpx solid rgba(15, 23, 42, 0.05);
}

.type-option {
  padding: 6rpx 12rpx;
  border-radius: 10rpx;
  color: $text-secondary;
  font-size: 20rpx;
  line-height: 1.2;
}

.type-option.active {
  background: #ecfdf5;
  color: #0f766e;
  font-weight: 700;
}

.context-btn {
  padding: 8rpx 14rpx;
  border-radius: 12rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  font-size: 20rpx;
  color: $text-secondary;
}

.context-btn.active {
  color: #b45309;
  background: #fffbeb;
  border-color: #fde68a;
}

.mode-help {
  padding: 8rpx 12rpx;
  border-radius: 12rpx;
  background: #eff6ff;
  color: #2563eb;
  font-size: 20rpx;
  font-weight: 700;
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

.mode-card {
  width: 100%;
  max-width: 620rpx;
  box-sizing: border-box;
  background: #fff;
  border-radius: 22rpx;
  padding: 30rpx;
  box-shadow: 0 28rpx 80rpx rgba(15, 23, 42, 0.18);
}

.mode-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
  margin-bottom: 22rpx;
}

.mode-title {
  display: block;
  color: $text-primary;
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1.2;
}

.mode-sub {
  display: block;
  margin-top: 8rpx;
  color: $text-tertiary;
  font-size: 23rpx;
  line-height: 1.4;
}

.mode-close {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #f8fafc;
  color: $text-tertiary;
  font-size: 28rpx;
  line-height: 56rpx;
  text-align: center;
  flex-shrink: 0;
}

.mode-option-card {
  padding: 22rpx;
  border-radius: 18rpx;
  border: 1rpx solid #bfdbfe;
  background: #eff6ff;
  margin-bottom: 16rpx;
}

.mode-option-card.deep {
  border-color: #a7f3d0;
  background: #ecfdf5;
}

.mode-option-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 12rpx;
}

.mode-option-name {
  color: $text-primary;
  font-size: 28rpx;
  font-weight: 800;
}

.mode-badge {
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: #fff;
  color: #2563eb;
  font-size: 22rpx;
  font-weight: 800;
  flex-shrink: 0;
}

.mode-badge.deep {
  color: #059669;
}

.mode-desc {
  display: block;
  color: $text-secondary;
  font-size: 25rpx;
  line-height: 1.55;
}

.mode-example {
  display: block;
  margin-top: 10rpx;
  color: $text-tertiary;
  font-size: 23rpx;
  line-height: 1.5;
}

.mode-confirm {
  margin-top: 22rpx;
  height: 76rpx;
  border-radius: 16rpx;
  background: $text-primary;
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    color: #fff;
    font-size: 28rpx;
    font-weight: 700;
  }
}

// ─── History Drawer ──────────────────────────
.drawer-mask {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(15, 23, 42, 0.42);
}
.drawer-panel {
  position: absolute; top: 0; right: 0; bottom: 0;
  width: 640rpx; max-width: 88vw; background: #f8fafc;
  display: flex; flex-direction: column;
  box-shadow: -20rpx 0 50rpx rgba(15, 23, 42, 0.18);
}
.drawer-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 28rpx $spacing-md 22rpx; border-bottom: 1rpx solid rgba(148, 163, 184, 0.18);
  background: #fff;
}
.drawer-title { font-size: $font-lg; font-weight: 600; color: $text-primary; }
.drawer-close { font-size: 36rpx; color: $text-tertiary; padding: 8rpx; }
.drawer-login {
  flex: 1; @include flex-center; flex-direction: column; gap: 24rpx; padding: 48rpx;
}
.drawer-login-text { font-size: $font-md; color: $text-secondary; }
.drawer-login-btn {
  background: $brand; border-radius: 16rpx; padding: 16rpx 48rpx;
  text { color: #fff; font-size: 28rpx; font-weight: 600; }
}
.drawer-list {
  flex: 1;
  min-height: 0;
  padding: $spacing-sm $spacing-md 36rpx;
  box-sizing: border-box;
}
.history-item {
  padding: 22rpx;
  margin: 0 0 18rpx;
  border-radius: 18rpx;
  background: #fff;
  border: 1rpx solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.04);

  &:active {
    opacity: 0.8;
  }
}

.history-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 12rpx;
}

.history-question {
  display: block;
  color: $text-primary;
  font-size: 28rpx;
  font-weight: 800;
  line-height: 1.45;
  word-break: break-word;
}

.history-date {
  font-size: $font-xs;
  color: $text-tertiary;
  flex-shrink: 0;
}

.history-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16rpx;
}

.history-type {
  font-size: $font-xs;
  color: #0f766e;
  background: #ecfdf5;
  border-radius: 999rpx;
  padding: 6rpx 14rpx;
  flex-shrink: 0;
}

.history-answer {
  display: block;
  margin-top: 10rpx;
  color: $text-secondary;
  font-size: 24rpx;
  line-height: 1.55;
  word-break: break-word;
}

.history-cost {
  font-size: $font-xs;
  color: $warning;
}

.history-enter {
  color: #2563eb;
  font-size: $font-xs;
  font-weight: 700;
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
