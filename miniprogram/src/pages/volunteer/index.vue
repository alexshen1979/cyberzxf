<template>
  <view class="volunteer-page">
    <view class="hero">
      <view class="hero-top">
        <text class="eyebrow">AI 志愿分析</text>
        <view class="points-pill" @click="handlePointsPill">
          <text>{{ pointsPillText }}</text>
        </view>
      </view>
      <text class="title">拉平信息差，拒绝迷茫，多些清晰</text>
      <text class="hero-desc">输入成绩与位次，先把范围、风险和下一步看清楚。</text>
    </view>

    <view class="mock-card">
      <view class="mock-head">
        <text class="mock-title">模拟报志愿</text>
        <view class="category-switch">
          <view class="radio-option" :class="{ active: examCategory === 'normal' }" @click="examCategory = 'normal'">
            <text class="radio-dot"></text>
            <text>普通类</text>
          </view>
          <view class="radio-option" :class="{ active: examCategory === 'art' }" @click="examCategory = 'art'">
            <text class="radio-dot"></text>
            <text>艺术类</text>
          </view>
        </view>
      </view>

      <view class="meta-row">
        <view class="meta-pill" @click="provincePanelOpen = !provincePanelOpen">
          <text>{{ form.province || '选择省份' }}</text>
        </view>
        <view class="meta-pill ghost" @click="yearPanelOpen = !yearPanelOpen">
          <text>{{ form.year }}年</text>
        </view>
        <view class="meta-pill ghost" :class="{ locating }" @click="detectProvince(true)">
          <text>{{ locating ? '定位中' : '定位' }}</text>
        </view>
      </view>
      <text
        v-if="locationStatus"
        class="location-status"
        :class="locationStatusTone"
      >{{ locationStatus }}</text>

      <view class="year-tags" v-if="yearPanelOpen">
        <text
          v-for="item in yearOptions"
          :key="item"
          class="year-tag"
          :class="{ active: form.year === item }"
          @click="selectYear(item)"
        >{{ item }}年</text>
      </view>

      <view class="province-tags" v-if="provincePanelOpen">
        <text
          v-for="item in provinceOptions"
          :key="item"
          class="province-tag"
          :class="{ active: form.province === item }"
          @click="selectProvince(item)"
        >{{ item }}</text>
      </view>

      <view v-if="examCategory === 'normal'" class="subject-area">
        <view class="level-row">
          <text class="field-label">{{ selectionMode === 'legacy' ? '高考科类' : '选科' }}</text>
          <view class="category-switch compact">
            <view class="radio-option" :class="{ active: admissionLevel === '本科' }" @click="setAdmissionLevel('本科')">
              <text class="radio-dot"></text>
              <text>本科</text>
            </view>
            <view class="radio-option" :class="{ active: admissionLevel === '专科' }" @click="setAdmissionLevel('专科')">
              <text class="radio-dot"></text>
              <text>专科</text>
            </view>
          </view>
        </view>

        <view v-if="selectionMode === 'six-three'" class="subject-block">
          <view class="field-label-row">
            <text class="field-hint">6选3</text>
          </view>
          <view class="choice-grid three">
            <view
              v-for="item in subjectPool"
              :key="item"
              class="choice-chip"
              :class="{ active: comprehensiveSubjects.includes(item), disabled: !comprehensiveSubjects.includes(item) && comprehensiveSubjects.length >= 3 }"
              @click="toggleComprehensiveSubject(item)"
            >
              <text>{{ item }}</text>
            </view>
          </view>
        </view>

        <view v-else-if="selectionMode === 'two-one-four-two'" class="subject-block split">
          <view class="subject-line">
            <view class="field-label-row compact">
              <text class="field-label">首选</text>
              <text class="field-hint">2选1</text>
            </view>
            <view class="choice-row">
              <view
                v-for="item in firstChoiceOptions"
                :key="item"
                class="choice-chip small"
                :class="{ active: firstSubject === item }"
                @click="selectFirstSubject(item)"
              >
                <text>{{ item }}</text>
              </view>
            </view>
          </view>
          <view class="subject-line">
            <view class="field-label-row compact">
              <text class="field-label">次选</text>
              <text class="field-hint">4选2</text>
            </view>
            <view class="choice-row wrap">
              <view
                v-for="item in secondChoiceOptions"
                :key="item"
                class="choice-chip small"
                :class="{ active: secondarySubjects.includes(item), disabled: !secondarySubjects.includes(item) && secondarySubjects.length >= 2 }"
                @click="toggleSecondarySubject(item)"
              >
                <text>{{ item }}</text>
              </view>
            </view>
          </view>
        </view>

        <view v-else class="subject-block">
          <view class="field-label-row">
            <text class="field-hint">按省份规则</text>
          </view>
          <view class="choice-row wrap">
            <view
              v-for="item in subjectOptions"
              :key="item"
              class="choice-chip"
              :class="{ active: form.subjectType === item }"
              @click="form.subjectType = item"
            >
              <text>{{ item }}</text>
            </view>
          </view>
        </view>

        <view class="score-title">分数</view>
        <view class="input-grid">
          <view class="score-input">
            <text class="input-mark">分</text>
            <input v-model.number="form.score" type="number" placeholder="500" @input="handleScoreInput" />
          </view>
          <view class="score-input">
            <text class="input-mark">位</text>
            <input v-model.number="form.rank" type="number" :placeholder="rankPlaceholder" @input="handleRankInput" />
          </view>
        </view>
        <text class="rank-lookup-tip" :class="rankLookupState">{{ rankLookupMessage }}</text>
      </view>

      <view v-else class="art-area">
        <view class="field-label-row">
          <text class="field-label">专业类别</text>
        </view>
        <picker :range="artMajorOptions" :value="artMajorIndex" @change="selectArtMajor">
          <view class="select-field">
            <text>{{ artMajorOptions[artMajorIndex] }}</text>
            <text class="select-arrow">⌄</text>
          </view>
        </picker>

        <view class="score-input full">
          <text class="input-mark">分</text>
          <input v-model.number="artScore" type="number" placeholder="请输入统考分/预估分" />
        </view>

        <view class="art-line">
          <text class="field-label">高考科目</text>
          <view class="category-switch compact">
            <view class="radio-option" :class="{ active: artLevel === '本科' }" @click="artLevel = '本科'">
              <text class="radio-dot"></text>
              <text>本科</text>
            </view>
            <view class="radio-option" :class="{ active: artLevel === '专科' }" @click="artLevel = '专科'">
              <text class="radio-dot"></text>
              <text>专科</text>
            </view>
          </view>
        </view>

        <picker :range="subjectComboOptions" :value="subjectComboIndex" @change="selectSubjectCombo">
          <view class="select-field">
            <text>{{ currentSubjectComboLabel }}</text>
            <text class="select-arrow">⌄</text>
          </view>
        </picker>

        <view class="score-input full">
          <text class="input-mark">分</text>
          <input v-model.number="form.score" type="number" placeholder="500" @input="handleScoreInput" />
        </view>
        <text class="rank-lookup-tip" :class="rankLookupState">{{ rankLookupMessage }}</text>
      </view>

      <view class="chart-card" v-if="form.score || form.rank">
        <view class="chart-canvas">
          <view class="chart-info">
            <text>{{ displayScore }} 分</text>
            <text>{{ rankRangeLabel }}</text>
            <text>{{ exceedText }}</text>
          </view>
          <view class="chart-base"></view>
          <view class="chart-curve">
            <view class="chart-curve-line"></view>
          </view>
          <view class="chart-marker" :style="{ left: chartMarkerLeft }"></view>
          <text class="axis-left">{{ minScoreLabel }}</text>
          <text class="axis-right">750分</text>
        </view>
        <view class="school-counts">
          <text class="count-label">候选池</text>
          <text class="count rush">{{ recommendationCountText('rush') }}</text>
          <text>可冲击</text>
          <text class="count stable">{{ recommendationCountText('stable') }}</text>
          <text>较稳妥</text>
          <text class="count safe">{{ recommendationCountText('safe') }}</text>
          <text>可保底</text>
        </view>
        <text class="candidate-hint">{{ recommendationCountHint }}</text>
      </view>

      <view class="preference-entry" @click="advancedOpen = true">
        <view>
          <text class="preference-title">偏好与风险：{{ riskOptions.find(item => item.value === form.riskPreference)?.label }}</text>
          <text class="preference-desc">{{ preferenceSummary }}</text>
        </view>
        <text class="preference-arrow">›</text>
      </view>

      <view class="submit-main" :class="{ disabled: loading || !form.score }" @click="submit">
        <text>{{ loading ? '生成中...' : '智能推荐大学' }}</text>
      </view>

      <view class="engagement-line" :class="engagementState">
        <text>{{ engagementInline }}</text>
      </view>
    </view>

    <view class="advanced-mask" v-if="advancedOpen" @click="advancedOpen = false">
      <view class="advanced-sheet" @click.stop>
        <view class="sheet-head">
          <view>
            <text class="sheet-title">偏好与风险</text>
            <text class="sheet-sub">不确定可以先跳过，报告仍可生成。</text>
          </view>
          <text class="sheet-close" @click="advancedOpen = false">完成</text>
        </view>

        <scroll-view class="sheet-body" scroll-y>
          <view class="sheet-section">
            <text class="sheet-label">风险偏好</text>
            <view class="chip-row">
              <text
                v-for="item in riskOptions"
                :key="item.value"
                class="chip"
                :class="{ active: form.riskPreference === item.value }"
                @click="form.riskPreference = item.value"
              >{{ item.label }}</text>
            </view>
          </view>

          <view class="sheet-section">
            <text class="sheet-label">城市和专业</text>
            <view class="suggest-field">
              <input
                class="sheet-input"
                v-model="preferredCitiesText"
                placeholder="目标城市或省份"
              />
              <view class="suggest-row" v-if="citySuggestions.length">
                <text
                  v-for="item in citySuggestions"
                  :key="item"
                  class="suggest-chip"
                  @click="chooseSuggestion('city', item)"
                >{{ item }}</text>
              </view>
            </view>

            <view class="suggest-field">
              <input
                class="sheet-input"
                v-model="preferredMajorsText"
                placeholder="偏好专业，如 计算机,电子信息"
                @input="handleMajorInput('preferred')"
              />
              <view class="suggest-row" v-if="preferredMajorSuggestions.length">
                <text
                  v-for="item in preferredMajorSuggestions"
                  :key="item.name"
                  class="suggest-chip"
                  @click="chooseSuggestion('preferredMajor', item.name)"
                >{{ item.name }}</text>
              </view>
            </view>

            <view class="suggest-field">
              <input
                class="sheet-input"
                v-model="avoidMajorsText"
                placeholder="规避专业，如 土木,护理"
                @input="handleMajorInput('avoid')"
              />
              <view class="suggest-row" v-if="avoidMajorSuggestions.length">
                <text
                  v-for="item in avoidMajorSuggestions"
                  :key="item.name"
                  class="suggest-chip danger"
                  @click="chooseSuggestion('avoidMajor', item.name)"
                >{{ item.name }}</text>
              </view>
            </view>
          </view>

          <view class="sheet-section">
            <text class="sheet-label">退档风险</text>
            <view class="chip-row">
              <text
                v-for="item in adjustmentOptions"
                :key="item.value"
                class="chip"
                :class="{ active: adjustmentPreference === item.value }"
                @click="adjustmentPreference = item.value"
              >{{ item.label }}</text>
            </view>
            <input class="sheet-input" v-model="riskNotes" placeholder="体检/单科限制，如 色弱、英语不高" />
          </view>

          <view class="sheet-section">
            <text class="sheet-label">家庭/就业期待</text>
            <textarea
              class="sheet-textarea"
              v-model="form.familyExpectation"
              placeholder="如 希望就业稳定，能考公优先"
              :maxlength="300"
            />
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="history-card" v-if="showHistoryCard">
      <view class="section-title">近期方案</view>
      <view v-if="reportsLoading" class="history-state">正在加载近期方案...</view>
      <view v-else-if="reports.length">
        <view class="report-item" v-for="item in reports" :key="item.id" @click="openReport(item.id)">
          <text class="report-main">{{ item.province }} {{ item.subjectType }} {{ item.score }}分</text>
          <text class="report-sub">{{ item.rank ? `位次 ${item.rank}` : '未填位次' }} · {{ formatDate(item.createdAt) }}</text>
        </view>
      </view>
      <view v-else class="history-state">暂无近期方案，生成后会自动保存在这里</view>
    </view>

    <view class="analysis-overlay" v-if="loading" @touchmove.stop.prevent>
      <view class="analysis-panel">
        <view class="orbit-loader">
          <view class="orbit-ring ring-one"></view>
          <view class="orbit-ring ring-two"></view>
          <view class="orbit-core">
            <text>AI</text>
          </view>
          <view class="orbit-dot dot-one"></view>
          <view class="orbit-dot dot-two"></view>
          <view class="orbit-dot dot-three"></view>
        </view>
        <text class="analysis-title">正在生成志愿方案</text>
        <text class="analysis-desc">正在按分数、位次、城市偏好和专业取舍重排候选院校</text>
        <view class="analysis-steps">
          <text>匹配历年录取线</text>
          <text>识别偏好命中</text>
          <text>剔除规避方向</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app';
import { computed, reactive, ref, watch } from 'vue';
import { api } from '@/api';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();

const comprehensiveProvinces = ['北京', '天津', '上海', '浙江', '山东', '海南'];
const legacyProvinces = ['西藏', '新疆'];
const majorModeProvinces = ['浙江', '山东', '河北', '辽宁', '重庆', '贵州'];
const threePlusOnePlusTwoProvinces = [
  '河北', '辽宁', '江苏', '福建', '湖北', '湖南', '广东', '重庆',
  '黑龙江', '甘肃', '吉林', '安徽', '江西', '贵州', '广西',
];
const subjectPool = ['物理', '化学', '生物', '政治', '历史', '地理'];
const firstChoiceOptions = ['物理', '历史'] as const;
const secondChoiceOptions = ['化学', '生物', '政治', '地理'];
const artMajorOptions = ['美术与设计类', '音乐类', '舞蹈类', '播音与主持类', '表（导）演类', '书法类'];
const riskOptions = [
  { label: '稳中带冲', value: 'balanced' },
  { label: '稳妥优先', value: 'conservative' },
  { label: '适度进攻', value: 'aggressive' },
] as const;
const adjustmentOptions = [
  { label: '接受调剂', value: 'accept' },
  { label: '看专业组', value: 'depends' },
  { label: '不接受', value: 'reject' },
] as const;
const fallbackMajorNames = [
  '计算机科学与技术', '软件工程', '人工智能', '数据科学与大数据技术', '网络工程', '信息安全', '物联网工程',
  '电子信息工程', '通信工程', '自动化', '电气工程及其自动化', '微电子科学与工程', '集成电路设计与集成系统',
  '机械设计制造及其自动化', '车辆工程', '能源与动力工程', '土木工程', '建筑学', '城乡规划',
  '临床医学', '口腔医学', '医学影像学', '麻醉学', '护理学', '药学', '中医学', '中西医临床医学',
  '法学', '知识产权', '公安学类', '汉语言文学', '新闻学', '传播学', '英语', '翻译',
  '会计学', '财务管理', '金融学', '经济学', '财政学', '国际经济与贸易', '工商管理',
  '师范类', '数学与应用数学', '物理学', '化学', '生物科学', '心理学', '教育学',
  '统计学', '应用统计学', '信息与计算科学', '环境工程', '食品科学与工程', '农学', '动物医学',
];

type ExamCategory = 'normal' | 'art';
type SelectionMode = 'six-three' | 'two-one-four-two' | 'legacy';

const fallbackDataYear = 2025;
const form = reactive({
  province: '',
  year: fallbackDataYear,
  subjectType: '综合改革',
  score: undefined as number | undefined,
  rank: undefined as number | undefined,
  targetBatch: '本科批',
  familyExpectation: '',
  riskPreference: 'balanced' as 'conservative' | 'balanced' | 'aggressive',
});

const preferredCitiesText = ref('');
const preferredMajorsText = ref('');
const avoidMajorsText = ref('');
const preferredMajorSuggestions = ref<Array<{ id: string; name: string; category?: string | null }>>([]);
const avoidMajorSuggestions = ref<Array<{ id: string; name: string; category?: string | null }>>([]);
const examCategory = ref<ExamCategory>('normal');
const admissionLevel = ref<'本科' | '专科'>('本科');
const comprehensiveSubjects = ref<string[]>([]);
const firstSubject = ref<'物理' | '历史' | ''>('');
const secondarySubjects = ref<string[]>([]);
const artMajorIndex = ref(0);
const artScore = ref<number | undefined>(undefined);
const artLevel = ref<'本科' | '专科'>('本科');
const subjectComboIndex = ref(0);
const adjustmentPreference = ref<'accept' | 'depends' | 'reject'>('depends');
const riskNotes = ref('');
const loading = ref(false);
const reports = ref<any[]>([]);
const reportsLoading = ref(false);
const reportsLoaded = ref(false);
const advancedOpen = ref(false);
const provinceTouched = ref(false);
const provincePanelOpen = ref(false);
const yearPanelOpen = ref(false);
const yearOptions = ref([2026, 2025]);
const regionTree = ref<any[]>([]);
const locating = ref(false);
const locationStatus = ref('');
const locationStatusTone = ref<'muted' | 'success' | 'warning'>('muted');
const rankLookupLoading = ref(false);
const rankAutoFilled = ref(false);
const rankLookupTried = ref(false);
const rankManuallyEdited = ref(false);
const rankLookupMessage = ref('填写分数后自动匹配一分一段位次');
const recommendationPreview = ref<any>(null);
const recommendationPreviewLoading = ref(false);
const reportCost = ref(38);
const publicFreeGift = ref(100);
let rankLookupTimer: ReturnType<typeof setTimeout> | null = null;
let rankLookupSeq = 0;
let recommendationPreviewTimer: ReturnType<typeof setTimeout> | null = null;
let recommendationPreviewSeq = 0;
let preferredMajorTimer: ReturnType<typeof setTimeout> | null = null;
let avoidMajorTimer: ReturnType<typeof setTimeout> | null = null;
let preferredMajorSeq = 0;
let avoidMajorSeq = 0;
let lastSubjectRequiredToastAt = 0;

const engagementState = computed(() => {
  if (!userStore.isLogin) return 'guest';
  return userStore.pointsBalance >= reportCost.value ? 'ready' : 'low-points';
});

const pointsPillText = computed(() => userStore.isLogin ? `${userStore.pointsBalance} 点` : `登录即送${publicFreeGift.value}点`);

const engagementInline = computed(() => {
  if (!userStore.isLogin) return `可先填写，生成时登录即送 ${publicFreeGift.value} 点`;
  if (userStore.pointsBalance >= reportCost.value) return `将消耗 ${reportCost.value} 点，报告自动保存`;
  return `当前 ${userStore.pointsBalance} 点，还差 ${Math.max(0, reportCost.value - userStore.pointsBalance)} 点`;
});

const showHistoryCard = computed(() => userStore.isLogin && (reportsLoading.value || reportsLoaded.value || reports.value.length > 0));

const preferenceSummary = computed(() => {
  const parts = [
    preferredCitiesText.value ? `城市 ${splitList(preferredCitiesText.value).slice(0, 2).join('、')}` : '',
    preferredMajorsText.value ? `专业 ${splitList(preferredMajorsText.value).slice(0, 2).join('、')}` : '',
    avoidMajorsText.value ? `规避 ${splitList(avoidMajorsText.value).slice(0, 2).join('、')}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : '城市、专业、调剂、体检限制';
});

const provinceOptions = computed(() => regionTree.value.map(item => item.name).filter(Boolean));
const allCityOptions = computed(() => {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const province of regionTree.value) {
    const provinceName = String(province?.name || '').trim();
    if (provinceName && !seen.has(provinceName)) {
      seen.add(provinceName);
      names.push(provinceName);
    }
    for (const city of province?.children || []) {
      const cityName = String(city?.name || '').trim();
      if (cityName && !seen.has(cityName)) {
        seen.add(cityName);
        names.push(cityName);
      }
    }
  }
  return names;
});

const citySuggestions = computed(() => {
  const keyword = getCurrentToken(preferredCitiesText.value);
  if (!keyword) return [];
  return allCityOptions.value
    .filter(name => name.includes(keyword))
    .slice(0, 16);
});

const subjectOptions = computed(() => {
  if (!form.province) return ['物理类', '历史类', '综合改革', '理科', '文科'];
  if (comprehensiveProvinces.includes(form.province)) return ['综合改革'];
  if (legacyProvinces.includes(form.province)) return ['理科', '文科'];
  return ['物理类', '历史类'];
});

const selectionMode = computed<SelectionMode>(() => {
  if (comprehensiveProvinces.includes(form.province)) return 'six-three';
  if (threePlusOnePlusTwoProvinces.includes(form.province)) return 'two-one-four-two';
  return 'legacy';
});

const subjectComboOptions = computed(() => {
  if (selectionMode.value === 'six-three') {
    return comprehensiveSubjects.value.length === 3 ? [comprehensiveSubjects.value.join('/')] : ['请选择3门科目'];
  }
  if (selectionMode.value === 'two-one-four-two') {
    return firstSubject.value && secondarySubjects.value.length === 2
      ? [`${firstSubject.value}/${secondarySubjects.value.join('/')}`]
      : ['请选择首选和2门次选'];
  }
  return subjectOptions.value;
});

const currentSubjectComboLabel = computed(() => subjectComboOptions.value[subjectComboIndex.value] || subjectComboOptions.value[0] || '选择科目');

const subjectSelectionValid = computed(() => {
  if (!form.province) return false;
  if (selectionMode.value === 'six-three') return comprehensiveSubjects.value.length === 3;
  if (selectionMode.value === 'two-one-four-two') return Boolean(firstSubject.value) && secondarySubjects.value.length === 2;
  return Boolean(form.subjectType);
});

const displayScore = computed(() => Number(form.score) || 0);

const displayRank = computed(() => {
  const score = Number(form.score) || 0;
  if (form.rank) return Number(form.rank);
  if (!score) return 0;
  const base = selectionMode.value === 'six-three' ? 185000 : 620000;
  const rank = Math.round(base * Math.pow((760 - Math.min(score, 750)) / 660, 1.62));
  return Math.max(120, rank);
});

const rankRangeLabel = computed(() => {
  if (!displayRank.value) return '暂未匹配位次';
  const end = displayRank.value;
  const start = Math.max(1, end - Math.max(280, Math.round(end * 0.018)));
  return `${start}-${end}名`;
});

const exceedPercent = computed(() => {
  const score = Number(form.score) || 0;
  if (!score) return 0;
  const raw = Math.round(((score - 100) / 650) * 100);
  return Math.min(96, Math.max(1, raw));
});

const exceedText = computed(() => displayScore.value ? `超过本省${exceedPercent.value}%考生` : '填写分数后自动估算');

const minScoreLabel = computed(() => (selectionMode.value === 'six-three' ? '100分' : '220分'));

const chartMarkerLeft = computed(() => {
  const score = Math.min(750, Math.max(100, Number(form.score) || 100));
  const pct = ((score - 100) / 650) * 100;
  return `${Math.min(86, Math.max(8, pct))}%`;
});

const recommendationCounts = computed(() => {
  const stats = recommendationPreview.value?.recommendationStats;
  return {
    rush: Number(stats?.rush || 0),
    stable: Number(stats?.stable || 0),
    safe: Number(stats?.safe || 0),
    displayLimit: Number(stats?.displayLimit || 12),
  };
});

const recommendationCountHint = computed(() => {
  if (recommendationPreviewLoading.value) return '正在匹配同分段历年录取线...';
  if (!recommendationPreview.value) return '填写完整成绩和科类后匹配真实候选池';
  return `报告默认展示每档前 ${recommendationCounts.value.displayLimit} 个，报告页可继续查看更多候选。`;
});

const fillMode = computed(() => {
  if (!form.province) {
    return {
      label: '先选择高考省份',
      unit: '自动匹配',
      desc: '选择省份后，系统会切换对应的科类、批次和志愿单位。',
    };
  }
  if (legacyProvinces.includes(form.province)) {
    return {
      label: '传统文理分科',
      unit: '院校志愿',
      desc: '按文科/理科和批次匹配录取线，重点看同科类位次。',
    };
  }
  if (majorModeProvinces.includes(form.province)) {
    return {
      label: '专业（类）+院校',
      unit: '无调剂',
      desc: '一个专业加一所院校作为一个志愿单位，投档后基本锁定专业。',
    };
  }
  return {
    label: '院校专业组',
    unit: '组内调剂',
    desc: '一个院校专业组作为一个志愿单位，调剂通常只在同组内发生。',
  };
});

const batchOptions = computed(() => {
  if (legacyProvinces.includes(form.province)) return ['本科一批', '本科二批', '专科批'];
  if (['山东', '浙江'].includes(form.province)) return ['普通类一段', '普通类二段'];
  if (form.province === '上海') return ['本科普通批', '专科普通批'];
  return ['本科批', '专科批', '本科提前批'];
});

const batchIndex = computed(() => {
  const index = batchOptions.value.indexOf(form.targetBatch);
  return index >= 0 ? index : 0;
});

const rankLookupState = computed(() => {
  if (rankLookupLoading.value) return 'loading';
  if (rankAutoFilled.value) return 'found';
  if (rankLookupTried.value) return 'missing';
  return 'idle';
});

const rankBadgeText = computed(() => {
  if (rankLookupLoading.value) return '查询中';
  if (rankAutoFilled.value) return '已自动';
  if (rankLookupTried.value) return '可手填';
  return '自动';
});

const rankPlaceholder = computed(() => {
  if (!form.score) return '自动查';
  if (rankLookupLoading.value) return '查询中';
  if (rankLookupTried.value && !rankAutoFilled.value) return '请手填';
  return '自动查';
});

const PROVINCE_CENTERS = [
  { province: '北京', lat: 39.9042, lng: 116.4074 },
  { province: '天津', lat: 39.3434, lng: 117.3616 },
  { province: '河北', lat: 38.0428, lng: 114.5149 },
  { province: '山西', lat: 37.8706, lng: 112.5489 },
  { province: '内蒙古', lat: 40.8426, lng: 111.7492 },
  { province: '辽宁', lat: 41.8057, lng: 123.4315 },
  { province: '吉林', lat: 43.8171, lng: 125.3235 },
  { province: '黑龙江', lat: 45.8038, lng: 126.5349 },
  { province: '上海', lat: 31.2304, lng: 121.4737 },
  { province: '江苏', lat: 32.0603, lng: 118.7969 },
  { province: '浙江', lat: 30.2741, lng: 120.1551 },
  { province: '安徽', lat: 31.8206, lng: 117.2272 },
  { province: '福建', lat: 26.0745, lng: 119.2965 },
  { province: '江西', lat: 28.6820, lng: 115.8582 },
  { province: '山东', lat: 36.6512, lng: 117.1201 },
  { province: '河南', lat: 34.7466, lng: 113.6254 },
  { province: '湖北', lat: 30.5928, lng: 114.3055 },
  { province: '湖南', lat: 28.2282, lng: 112.9388 },
  { province: '广东', lat: 23.1291, lng: 113.2644 },
  { province: '广西', lat: 22.8170, lng: 108.3669 },
  { province: '海南', lat: 20.0440, lng: 110.1999 },
  { province: '重庆', lat: 29.5630, lng: 106.5516 },
  { province: '四川', lat: 30.5728, lng: 104.0668 },
  { province: '贵州', lat: 26.6470, lng: 106.6302 },
  { province: '云南', lat: 25.0389, lng: 102.7183 },
  { province: '西藏', lat: 29.6520, lng: 91.1721 },
  { province: '陕西', lat: 34.3416, lng: 108.9398 },
  { province: '甘肃', lat: 36.0611, lng: 103.8343 },
  { province: '青海', lat: 36.6171, lng: 101.7782 },
  { province: '宁夏', lat: 38.4872, lng: 106.2309 },
  { province: '新疆', lat: 43.8256, lng: 87.6168 },
];

function splitList(text: string) {
  return text.split(/[,，、\s]+/).map(item => item.trim()).filter(Boolean);
}

function getCurrentToken(text: string) {
  const parts = String(text || '').split(/[,，、\s]+/);
  return (parts[parts.length - 1] || '').trim();
}

function replaceCurrentToken(text: string, value: string) {
  const raw = String(text || '');
  const match = raw.match(/^(.*?)([^,，、\s]*)$/);
  const prefix = match?.[1] || '';
  const current = (match?.[2] || '').trim();
  const existing = splitList(prefix);
  if (!current && existing.includes(value)) return raw;
  if (existing.includes(value)) return prefix.trimEnd();
  return `${prefix}${value}，`;
}

function chooseSuggestion(type: 'city' | 'preferredMajor' | 'avoidMajor', value: string) {
  if (type === 'city') {
    preferredCitiesText.value = replaceCurrentToken(preferredCitiesText.value, value);
  } else if (type === 'preferredMajor') {
    preferredMajorsText.value = replaceCurrentToken(preferredMajorsText.value, value);
    preferredMajorSuggestions.value = [];
  } else {
    avoidMajorsText.value = replaceCurrentToken(avoidMajorsText.value, value);
    avoidMajorSuggestions.value = [];
  }
  scheduleRecommendationPreview();
}

function handleMajorInput(kind: 'preferred' | 'avoid') {
  updateLocalMajorSuggestions(kind);
  scheduleMajorSuggestions(kind);
  scheduleRecommendationPreview();
}

function scheduleMajorSuggestions(kind: 'preferred' | 'avoid') {
  const timer = kind === 'preferred' ? preferredMajorTimer : avoidMajorTimer;
  if (timer) clearTimeout(timer);
  const nextTimer = setTimeout(() => {
    loadMajorSuggestions(kind);
  }, 260);
  if (kind === 'preferred') preferredMajorTimer = nextTimer;
  else avoidMajorTimer = nextTimer;
}

async function loadMajorSuggestions(kind: 'preferred' | 'avoid') {
  const keyword = getCurrentToken(kind === 'preferred' ? preferredMajorsText.value : avoidMajorsText.value);
  if (!keyword) {
    if (kind === 'preferred') preferredMajorSuggestions.value = [];
    else avoidMajorSuggestions.value = [];
    return;
  }

  const seq = kind === 'preferred' ? ++preferredMajorSeq : ++avoidMajorSeq;
  try {
    const res = await api.volunteer.majorSuggestions(keyword);
    const merged = mergeMajorSuggestions(keyword, res.data || []);
    if (kind === 'preferred') {
      if (seq === preferredMajorSeq) preferredMajorSuggestions.value = merged;
    } else if (seq === avoidMajorSeq) {
      avoidMajorSuggestions.value = merged;
    }
  } catch {
    updateLocalMajorSuggestions(kind);
  }
}

function updateLocalMajorSuggestions(kind: 'preferred' | 'avoid') {
  const keyword = getCurrentToken(kind === 'preferred' ? preferredMajorsText.value : avoidMajorsText.value);
  const suggestions = keyword ? mergeMajorSuggestions(keyword, []) : [];
  if (kind === 'preferred') preferredMajorSuggestions.value = suggestions;
  else avoidMajorSuggestions.value = suggestions;
}

function mergeMajorSuggestions(keyword: string, remoteItems: Array<{ id: string; name: string; category?: string | null }>) {
  const seen = new Set<string>();
  const result: Array<{ id: string; name: string; category?: string | null }> = [];
  const push = (item: { id: string; name: string; category?: string | null }) => {
    const name = String(item.name || '').trim();
    if (!name || seen.has(name) || !name.includes(keyword)) return;
    seen.add(name);
    result.push(Object.assign({}, item, { name }));
  };

  fallbackMajorNames.forEach(name => push({ id: `local-${name}`, name, category: '常见专业' }));
  remoteItems.forEach(push);
  return result.slice(0, 18);
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestProvince(latitude: number, longitude: number) {
  return PROVINCE_CENTERS
    .map(item => Object.assign({}, item, {
      distance: distanceKm(latitude, longitude, item.lat, item.lng),
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.province || '';
}

function createLocationTimeoutError() {
  return Object.assign(new Error('location timeout'), { errMsg: 'location:timeout' });
}

function isLocationTimeout(err: any) {
  const message = String(err?.errMsg || err?.message || '');
  return /timeout|time out|超时/i.test(message);
}

function isLocationDenied(err: any) {
  const message = String(err?.errMsg || err?.message || '');
  return /auth deny|authorize|denied|deny|cancel|拒绝|取消|privacy/i.test(message);
}

function isNetworkLocationUnavailable(err: any) {
  const message = String(err?.errMsg || err?.message || '');
  return /NOCELL|WIFI_LOCATION|LOCATIONSWITCHOFF/i.test(message);
}

function formatLocationError(err: any) {
  if (isNetworkLocationUnavailable(err)) return '系统网络定位不可用，请打开手机定位、Wi-Fi或移动网络后重试，也可以手动选择省份';
  if (isLocationTimeout(err)) return '定位超时，请手动选择省份';
  if (isLocationDenied(err)) return '定位未开启，请手动选择省份';
  return '定位暂不可用，请手动选择省份';
}

function locationDebugText(err: any) {
  return String(err?.errMsg || err?.message || '').replace(/\s+/g, ' ').slice(0, 42);
}

function isDevtoolsRuntime() {
  try {
    const wxApi = (globalThis as any).wx;
    const info = typeof wxApi?.getDeviceInfo === 'function'
      ? wxApi.getDeviceInfo()
      : (uni as any).getSystemInfoSync?.();
    const platform = String(info?.platform || '').toLowerCase();
    const system = String(info?.system || '').toLowerCase();
    return platform === 'devtools' || /devtools|mac|windows/.test(`${platform} ${system}`);
  } catch {
    return false;
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function authorizeLocation() {
  const wxApi = (globalThis as any).wx;
  const authorize = (uni as any).authorize || wxApi?.authorize;
  if (typeof authorize !== 'function') return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    authorize({
      scope: 'scope.userLocation',
      success: () => resolve(),
      fail: (err: any) => reject(err),
    });
  });
}

function requestLocationByApi(
  apiFn: Function,
  options: { type: 'gcj02' | 'wgs84'; highAccuracy: boolean; timeoutMs: number },
) {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(createLocationTimeoutError());
    }, timeoutMs);

    const done = (err?: any, value?: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) {
        reject(err);
        return;
      }
      const latitude = Number(value?.latitude);
      const longitude = Number(value?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        reject(new Error('location invalid'));
        return;
      }
      resolve({ latitude, longitude });
    };

    const params: Record<string, any> = {
      type: options.type,
      isHighAccuracy: options.highAccuracy,
      success: (res: any) => done(undefined, res),
      fail: (err: any) => done(err),
    };
    if (options.highAccuracy) {
      params.highAccuracyExpireTime = Math.max(3000, Math.min(options.timeoutMs - 1000, 10000));
    }
    apiFn(params);
  });
}

async function getProvinceLocation() {
  await authorizeLocation().catch((err) => {
    if (isLocationDenied(err)) throw err;
  });
  await delay(250);

  const candidates = [
    (uni as any).getLocation,
    (globalThis as any).wx?.getLocation,
  ].filter((item, index, list) => typeof item === 'function' && list.indexOf(item) === index);

  if (!candidates.length) {
    throw new Error('location api not available');
  }

  let lastError: any;
  const attempts = [
    { type: 'gcj02' as const, highAccuracy: true, timeoutMs: 15000 },
    { type: 'wgs84' as const, highAccuracy: true, timeoutMs: 15000 },
    { type: 'gcj02' as const, highAccuracy: false, timeoutMs: 9000 },
    { type: 'wgs84' as const, highAccuracy: false, timeoutMs: 9000 },
  ];
  for (const apiFn of candidates) {
    for (const options of attempts) {
      try {
        return await requestLocationByApi(apiFn, options);
      } catch (err: any) {
        lastError = err;
        if (isLocationDenied(err)) break;
      }
    }
    if (isLocationDenied(lastError)) break;
  }
  throw lastError || new Error('location unavailable');
}

function selectProvince(province: string) {
  form.province = province;
  ensureSubjectOption();
  provinceTouched.value = true;
  provincePanelOpen.value = false;
  locationStatus.value = `已选择 ${province}，可重新定位`;
  locationStatusTone.value = 'success';
}

function selectYear(year: number) {
  if (year === 2026) {
    uni.showToast({ title: '不是不报日子未到 哈哈', icon: 'none' });
    form.year = fallbackDataYear;
    yearPanelOpen.value = false;
    return;
  }
  form.year = year;
  yearPanelOpen.value = false;
  rankAutoFilled.value = false;
  rankLookupTried.value = false;
  if (!rankManuallyEdited.value) form.rank = undefined;
  scheduleRankLookup();
}

function defaultBatchForLevel(level: '本科' | '专科') {
  if (level === '专科') {
    if (['山东', '浙江'].includes(form.province)) return '普通类二段';
    if (form.province === '上海') return '专科普通批';
    return '专科批';
  }
  if (legacyProvinces.includes(form.province)) return '本科一批';
  if (['山东', '浙江'].includes(form.province)) return '普通类一段';
  if (form.province === '上海') return '本科普通批';
  return '本科批';
}

function setAdmissionLevel(level: '本科' | '专科') {
  admissionLevel.value = level;
  form.targetBatch = defaultBatchForLevel(level);
  scheduleRecommendationPreview();
}

function toggleComprehensiveSubject(subject: string) {
  if (comprehensiveSubjects.value.includes(subject)) {
    comprehensiveSubjects.value = comprehensiveSubjects.value.filter(item => item !== subject);
    return;
  }
  if (comprehensiveSubjects.value.length >= 3) return;
  comprehensiveSubjects.value = [...comprehensiveSubjects.value, subject];
}

function selectFirstSubject(subject: '物理' | '历史') {
  firstSubject.value = subject;
  form.subjectType = subject === '物理' ? '物理类' : '历史类';
  scheduleRecommendationPreview();
}

function toggleSecondarySubject(subject: string) {
  if (secondarySubjects.value.includes(subject)) {
    secondarySubjects.value = secondarySubjects.value.filter(item => item !== subject);
    return;
  }
  if (secondarySubjects.value.length >= 2) return;
  secondarySubjects.value = [...secondarySubjects.value, subject];
}

function selectArtMajor(event: any) {
  artMajorIndex.value = Number(event?.detail?.value || 0);
}

function selectSubjectCombo(event: any) {
  subjectComboIndex.value = Number(event?.detail?.value || 0);
  if (selectionMode.value === 'legacy') {
    form.subjectType = subjectComboOptions.value[subjectComboIndex.value] || form.subjectType;
  }
}

function selectBatch(event: any) {
  const index = Number(event?.detail?.value || 0);
  form.targetBatch = batchOptions.value[index] || batchOptions.value[0] || '';
  admissionLevel.value = form.targetBatch.includes('专科') || form.targetBatch.includes('二段') ? '专科' : '本科';
  scheduleRecommendationPreview();
}

function handleScoreInput() {
  if (!subjectSelectionValid.value) {
    showSubjectRequiredToast();
    rankLookupLoading.value = false;
    rankLookupTried.value = false;
    rankAutoFilled.value = false;
    rankLookupMessage.value = '请先选择科目哦';
    return;
  }
  rankManuallyEdited.value = false;
  scheduleRankLookup();
}

function showSubjectRequiredToast() {
  const now = Date.now();
  if (now - lastSubjectRequiredToastAt < 1500) return;
  lastSubjectRequiredToastAt = now;
  uni.showToast({ title: '请先选择科目哦', icon: 'none' });
}

function handleRankInput() {
  rankManuallyEdited.value = true;
  rankAutoFilled.value = false;
  rankLookupTried.value = false;
  rankLookupMessage.value = form.rank ? '已手动填写位次，将按此生成报告' : '填写分数后自动匹配一分一段位次';
  scheduleRecommendationPreview();
}

function ensureSubjectOption() {
  if (selectionMode.value === 'six-three') {
    form.subjectType = '综合改革';
  } else if (selectionMode.value === 'two-one-four-two') {
    form.subjectType = firstSubject.value === '历史' ? '历史类' : firstSubject.value === '物理' ? '物理类' : '';
  }
  if (selectionMode.value !== 'two-one-four-two' && !subjectOptions.value.includes(form.subjectType)) {
    form.subjectType = subjectOptions.value[0] || '';
  }
  if (!batchOptions.value.includes(form.targetBatch)) {
    form.targetBatch = defaultBatchForLevel(admissionLevel.value);
    if (!batchOptions.value.includes(form.targetBatch)) {
      form.targetBatch = batchOptions.value[0] || '';
    }
  }
}

async function loadRegions() {
  try {
    const res = await api.regions.tree();
    regionTree.value = (res.data || []).map((province: any) => Object.assign({}, province, {
      children: province.children || [],
    }));
  } catch {
    regionTree.value = [];
  }
}

async function loadVolunteerDataYears() {
  try {
    const res = await api.volunteer.dataYears();
    const years = res.data?.years || [];
    yearOptions.value = [...new Set([...years, 2026, 2025])]
      .filter(year => year === 2026 || year === 2025)
      .sort((a, b) => b - a);
    form.year = fallbackDataYear;
  } catch {
    yearOptions.value = [2026, 2025];
    form.year = fallbackDataYear;
  }
}

async function loadPublicConfig() {
  try {
    const res = await api.config.getPublic();
    const freeGift = Number(res.data?.freeGift);
    if (Number.isFinite(freeGift) && freeGift >= 0) {
      publicFreeGift.value = Math.trunc(freeGift);
    }
    const volunteerCost = Number(res.data?.volunteerAnalysisCost);
    if (Number.isFinite(volunteerCost) && volunteerCost >= 0) {
      reportCost.value = Math.trunc(volunteerCost);
    }
  } catch {
    // 使用默认赠点文案，避免首页按钮空白。
  }
}

function scheduleRankLookup() {
  if (rankLookupTimer) clearTimeout(rankLookupTimer);
  rankLookupTimer = setTimeout(() => {
    lookupScoreRank();
  }, 420);
}

async function lookupScoreRank() {
  const score = Number(form.score);
  const year = Number(form.year);
  const province = form.province.trim();
  const subjectType = form.subjectType;

  if (!province || !subjectType || !Number.isInteger(year) || !Number.isInteger(score) || score <= 0 || score > 750) {
    rankLookupLoading.value = false;
    rankLookupTried.value = false;
    rankAutoFilled.value = false;
    if (!rankManuallyEdited.value) rankLookupMessage.value = '填写分数后自动匹配一分一段位次';
    return;
  }

  const seq = ++rankLookupSeq;
  rankLookupLoading.value = true;
  rankLookupMessage.value = '正在匹配一分一段位次...';

  try {
    const res = await api.volunteer.scoreRank({ province, year, subjectType, score });
    if (seq !== rankLookupSeq) return;

    rankLookupTried.value = true;
    if (res.data?.available && res.data.rank) {
      if (!rankManuallyEdited.value) {
        form.rank = Number(res.data.rank);
        rankAutoFilled.value = true;
      }
      const exactText = res.data.exact === false && res.data.score
        ? `（按${res.data.score}分及以上段估算）`
        : '';
      rankLookupMessage.value = `${year}${province}${res.data.subjectType}：约第 ${res.data.rank} 名${exactText}`;
      scheduleRecommendationPreview();
    } else {
      if (rankAutoFilled.value && !rankManuallyEdited.value) form.rank = undefined;
      rankAutoFilled.value = false;
      rankLookupMessage.value = res.data?.message || '暂无一分一段数据，请手动填写位次';
      scheduleRecommendationPreview();
    }
  } catch {
    if (seq !== rankLookupSeq) return;
    rankLookupTried.value = true;
    rankAutoFilled.value = false;
    rankLookupMessage.value = '位次自动查询失败，请手动填写';
    scheduleRecommendationPreview();
  } finally {
    if (seq === rankLookupSeq) rankLookupLoading.value = false;
  }
}

function scheduleRecommendationPreview() {
  if (recommendationPreviewTimer) clearTimeout(recommendationPreviewTimer);
  recommendationPreviewTimer = setTimeout(() => {
    loadRecommendationPreview();
  }, 520);
}

async function loadRecommendationPreview() {
  const score = Number(form.score);
  const year = Number(form.year);
  const province = form.province.trim();
  const subjectType = form.subjectType;

  if (!province || !subjectType || !Number.isInteger(year) || !Number.isFinite(score) || score <= 0 || score > 750) {
    recommendationPreview.value = null;
    recommendationPreviewLoading.value = false;
    return;
  }

  const seq = ++recommendationPreviewSeq;
  recommendationPreviewLoading.value = true;

  try {
    const res = await api.volunteer.preview({
      province,
      year,
      subjectType,
      score,
      rank: form.rank ? Number(form.rank) : undefined,
      targetBatch: form.targetBatch,
      preferredCities: splitList(preferredCitiesText.value),
      preferredMajors: splitList(preferredMajorsText.value),
      avoidMajors: splitList(avoidMajorsText.value),
      riskPreference: form.riskPreference,
    });
    if (seq === recommendationPreviewSeq) {
      recommendationPreview.value = res.data;
    }
  } catch {
    if (seq === recommendationPreviewSeq) {
      recommendationPreview.value = null;
    }
  } finally {
    if (seq === recommendationPreviewSeq) {
      recommendationPreviewLoading.value = false;
    }
  }
}

function recommendationCountText(key: 'rush' | 'stable' | 'safe') {
  if (recommendationPreviewLoading.value) return '--';
  return String(recommendationCounts.value[key] || 0);
}

function handlePointsPill() {
  if (!userStore.isLogin) {
    userStore.loginWithWechatProfile();
    return;
  }
  goRecharge();
}

function goRecharge() {
  uni.navigateTo({ url: '/pages/recharge/index' });
}

async function detectProvince(force = false) {
  if (locating.value) return;
  if (!force && (form.province || provinceTouched.value)) return;
  if (isDevtoolsRuntime()) {
    locationStatus.value = force ? '开发者工具定位不稳定，请真机预览或手动选择省份' : '';
    locationStatusTone.value = 'warning';
    if (force) uni.showToast({ title: locationStatus.value, icon: 'none' });
    return;
  }

  locating.value = true;
  locationStatus.value = '正在根据位置默认省份...';
  locationStatusTone.value = 'muted';
  try {
    const location = await getProvinceLocation();
    const province = nearestProvince(Number(location.latitude), Number(location.longitude));
    if (!province) {
      locationStatus.value = '定位结果不稳定，请手动选择省份';
      locationStatusTone.value = 'warning';
      return;
    }
    if (!provinceTouched.value || force) {
      form.province = province;
      ensureSubjectOption();
      locationStatus.value = `已根据定位默认：${province}，可手动修改`;
      locationStatusTone.value = 'success';
    } else {
      locationStatus.value = '已获取定位，省份仍可手动填写';
      locationStatusTone.value = 'success';
    }
  } catch (err: any) {
    const debug = locationDebugText(err);
    locationStatus.value = `${formatLocationError(err)}${debug && force ? `（${debug}）` : ''}`;
    locationStatusTone.value = 'warning';
    provincePanelOpen.value = true;
    if (force) {
      uni.showToast({
        title: isNetworkLocationUnavailable(err) ? '请打开定位和网络后重试' : formatLocationError(err),
        icon: 'none',
      });
    }
  } finally {
    locating.value = false;
  }
}

async function submit() {
  if (loading.value) return;
  if (!userStore.isLogin) {
    await userStore.loginWithWechatProfile();
    return;
  }
  if (!form.province.trim() || !form.score) {
    uni.showToast({ title: '请填写省份和分数', icon: 'none' });
    return;
  }
  if (!subjectSelectionValid.value) {
    const title = selectionMode.value === 'six-three'
      ? '请选择3门选科'
      : selectionMode.value === 'two-one-four-two'
        ? '请选择首选和2门次选'
        : '请选择科类';
    uni.showToast({ title, icon: 'none' });
    return;
  }
  if (!form.subjectType) {
    uni.showToast({ title: '请选择科类', icon: 'none' });
    return;
  }
  if (userStore.isLogin && userStore.pointsBalance < reportCost.value) {
    uni.showModal({
      title: '点数不足',
      content: `深度报告需 ${reportCost.value} 点，当前 ${userStore.pointsBalance} 点。新用户赠点可先体验，补足后即可生成完整报告。`,
      confirmText: '去充值',
      cancelText: '先看看',
      success: (res) => {
        if (res.confirm) goRecharge();
      },
    });
    return;
  }

  loading.value = true;
  try {
    const expectation = [
      form.familyExpectation?.trim(),
      `报考类别：${examCategory.value === 'art' ? `艺术类-${artMajorOptions[artMajorIndex.value]}，统考/预估分 ${artScore.value || '未填'}，${artLevel.value}` : `普通类，${admissionLevel.value}`}`,
      `选科组合：${currentSubjectComboLabel.value}`,
      `调剂态度：${adjustmentOptions.find(item => item.value === adjustmentPreference.value)?.label || '未填写'}`,
      riskNotes.value.trim() ? `体检/单科限制：${riskNotes.value.trim()}` : '',
    ].filter(Boolean).join('\n');
    const analysisInput = Object.assign({}, form, {
      province: form.province.trim(),
      score: Number(form.score),
      rank: form.rank ? Number(form.rank) : undefined,
      preferredCities: splitList(preferredCitiesText.value),
      preferredMajors: splitList(preferredMajorsText.value),
      avoidMajors: splitList(avoidMajorsText.value),
      familyExpectation: expectation,
    });
    const res = await api.volunteer.analyze(analysisInput);
    uni.setStorageSync('latest_volunteer_report', Object.assign({}, res.data, {
      input: (res.data as any)?.input || analysisInput,
    }));
    uni.navigateTo({ url: `/pages/volunteer/report?id=${(res.data as any).reportId}` });
  } catch (err: any) {
    const message = String(err?.errMsg || err?.message || '');
    const title = /timeout|time out|超时/i.test(message)
      ? '生成时间较长，请稍后到近期方案查看'
      : err?.message || '生成失败，请稍后重试';
    uni.showToast({ title, icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function loadReports() {
  if (!userStore.isLogin) {
    reports.value = [];
    reportsLoaded.value = false;
    return;
  }
  reportsLoading.value = true;
  try {
    const res = await api.volunteer.reports(1, 5);
    reports.value = (res.data as any).list || [];
    reportsLoaded.value = true;
  } catch {
    reports.value = [];
    reportsLoaded.value = true;
  } finally {
    reportsLoading.value = false;
  }
}

function openReport(id: string) {
  uni.navigateTo({ url: `/pages/volunteer/report?id=${id}` });
}

function formatDate(value: string) {
  return value ? value.slice(0, 10) : '';
}

onShow(() => {
  loadPublicConfig();
  loadVolunteerDataYears();
  loadRegions();
  loadReports();
  detectProvince(false);
});

onPullDownRefresh(async () => {
  try {
    await Promise.all([loadPublicConfig(), loadVolunteerDataYears(), loadRegions(), loadReports(), userStore.fetchBalance()]);
    await lookupScoreRank();
  } finally {
    uni.stopPullDownRefresh();
  }
});

watch(() => form.province, ensureSubjectOption);
watch(
  () => userStore.isLogin,
  (isLogin) => {
    if (isLogin) {
      loadReports();
    } else {
      reports.value = [];
      reportsLoaded.value = false;
      reportsLoading.value = false;
    }
  },
  { immediate: true },
);
watch(preferredCitiesText, scheduleRecommendationPreview);
watch(preferredMajorsText, () => handleMajorInput('preferred'));
watch(avoidMajorsText, () => handleMajorInput('avoid'));
watch(
  () => [form.province, form.year, form.subjectType, form.score],
  () => {
    rankManuallyEdited.value = false;
    scheduleRankLookup();
    scheduleRecommendationPreview();
  }
);
</script>

<style lang="scss" scoped>
.volunteer-page {
  min-height: 100vh;
  padding: 24rpx $spacing-md 56rpx;
  background: linear-gradient(180deg, #fbfdf9 0%, #f8fafc 46%, #fff7fb 100%);
}

.hero {
  margin-bottom: $spacing-md;
  padding: 28rpx 24rpx 26rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, #ffffff 0%, #f0fdfa 48%, #fff7ed 100%);
  border: 1rpx solid rgba(15, 118, 110, 0.12);
  box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.04);
}

.score-head,
.preference-entry,
.sheet-head {
  display: flex;
  justify-content: space-between;
  gap: $spacing-md;
  align-items: flex-start;
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  min-height: 60rpx;
  margin-bottom: 18rpx;
}

.eyebrow {
  flex: 1;
  min-width: 0;
  color: #0f766e;
  font-size: $font-xs;
  font-weight: 700;
  line-height: 1.35;
}

.title {
  display: block;
  color: $text-primary;
  font-size: 40rpx;
  font-weight: 800;
  line-height: 1.24;
}

.hero-desc {
  display: block;
  margin-top: 14rpx;
  color: $text-secondary;
  font-size: $font-sm;
  line-height: 1.45;
}

.points-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 132rpx;
  max-width: 228rpx;
  min-height: 56rpx;
  padding: 0 16rpx;
  box-sizing: border-box;
  border-radius: 16rpx;
  background: #fffbeb;
  border: 1rpx solid #fcd34d;
  color: #b45309;
  font-size: $font-xs;
  font-weight: 800;
  text-align: center;
  line-height: 1.25;
  white-space: normal;
}

.mock-card {
  position: relative;
  padding: 32rpx 26rpx;
  border-radius: 24rpx;
  margin-bottom: $spacing-md;
  background: #fff;
  border: 1rpx solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 14rpx 34rpx rgba(15, 23, 42, 0.05);
}

.mock-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: $spacing-md;
  margin-bottom: 28rpx;
}

.mock-title {
  color: $text-primary;
  font-size: 38rpx;
  font-weight: 800;
}

.category-switch {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.category-switch.compact {
  gap: 18rpx;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: $text-secondary;
  font-size: 28rpx;
  font-weight: 700;
}

.radio-option.active {
  color: #7c3aed;
}

.radio-dot {
  width: 30rpx;
  height: 30rpx;
  box-sizing: border-box;
  border-radius: $radius-full;
  border: 3rpx solid #cbd5e1;
  background: #fff;
}

.radio-option.active .radio-dot {
  border: 8rpx solid #8b5cf6;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 22rpx;
}

.meta-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 120rpx;
  height: 56rpx;
  padding: 0 18rpx;
  border-radius: 14rpx;
  background: #fff7ed;
  border: 1rpx solid #fed7aa;
  color: #c2410c;
  font-size: $font-xs;
  font-weight: 800;
}

.meta-pill.ghost {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #475569;
}

.meta-pill.locating {
  opacity: 0.72;
}

.location-status {
  display: block;
  margin: -8rpx 0 18rpx;
  color: #64748b;
  font-size: 23rpx;
  line-height: 1.45;
}

.location-status.success {
  color: #047857;
}

.location-status.warning {
  color: #b45309;
}

.province-tags,
.year-tags {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10rpx;
  margin-bottom: 18rpx;
  padding: 16rpx;
  border-radius: 22rpx;
  background: #f8fafc;
  border: 1rpx solid rgba(148, 163, 184, 0.14);
}

.year-tags {
  grid-template-columns: repeat(2, 1fr);
}

.province-tag,
.year-tag {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 56rpx;
  border-radius: $radius-md;
  background: #fff;
  border: 1rpx solid $border-light;
  color: $text-secondary;
  font-size: $font-xs;
  font-weight: 700;
}

.province-tag.active,
.year-tag.active {
  background: #ecfeff;
  border-color: #67e8f9;
  color: #0891b2;
}

.subject-area,
.art-area {
  margin-top: 6rpx;
}

.level-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-sm;
  margin-bottom: 18rpx;
}

.subject-block {
  margin-bottom: 28rpx;
}

.subject-block.split {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.subject-line {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.field-label-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.field-label-row.compact {
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
  width: 82rpx;
  margin-bottom: 0;
}

.field-label {
  color: $text-primary;
  font-size: 30rpx;
  font-weight: 700;
}

.field-hint {
  color: #64748b;
  font-size: 24rpx;
  font-weight: 700;
}

.choice-grid {
  display: grid;
  gap: 16rpx;
}

.choice-grid.three {
  grid-template-columns: repeat(3, 1fr);
}

.choice-row {
  display: flex;
  gap: 12rpx;
  flex: 1;
}

.choice-row.wrap {
  flex-wrap: wrap;
}

.choice-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 66rpx;
  box-sizing: border-box;
  padding: 0 20rpx;
  border-radius: 14rpx;
  background: #fbfdff;
  border: 2rpx solid #e5e7eb;
  color: $text-secondary;
  font-size: 28rpx;
  font-weight: 700;
}

.choice-chip.small {
  min-width: 104rpx;
  height: 62rpx;
}

.choice-chip.active {
  background: #ecfdf5;
  border-color: #6ee7b7;
  color: #059669;
  font-weight: 800;
}

.choice-chip.disabled {
  opacity: 0.42;
}

.score-title {
  margin: 30rpx 0 16rpx;
  color: $text-primary;
  font-size: 30rpx;
  font-weight: 700;
}

.input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-sm;
}

.score-input {
  display: flex;
  align-items: center;
  gap: 12rpx;
  height: 68rpx;
  padding: 0 18rpx;
  box-sizing: border-box;
  border-radius: 16rpx;
  background: #fbfdff;
  border: 1rpx solid #e2e8f0;
}

.score-input.full {
  margin-top: 20rpx;
}

.score-input input {
  flex: 1;
  min-width: 0;
  height: 68rpx;
  color: $text-primary;
  font-size: 30rpx;
}

.input-mark {
  order: 2;
  flex-shrink: 0;
  color: #64748b;
  font-size: 28rpx;
}

.rank-lookup-tip {
  display: block;
  margin-top: 12rpx;
  color: #64748b;
  font-size: 22rpx;
  line-height: 1.35;
}

.rank-lookup-tip.loading {
  color: #0f766e;
}

.rank-lookup-tip.found {
  color: #059669;
}

.rank-lookup-tip.missing {
  color: #d97706;
}

.art-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-sm;
  margin: 34rpx 0 18rpx;
}

.select-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 82rpx;
  padding: 0 22rpx;
  box-sizing: border-box;
  border-radius: 12rpx;
  background: #fbfdff;
  border: 1rpx solid #e2e8f0;
  color: $text-primary;
  font-size: 30rpx;
}

.select-arrow {
  color: #a1a1aa;
  font-size: 40rpx;
}

.chart-card {
  margin-top: 30rpx;
  padding: 18rpx 16rpx 16rpx;
  border-radius: 18rpx;
  background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%);
  border: 1rpx solid #fed7aa;
}

.chart-canvas {
  position: relative;
  height: 174rpx;
  overflow: hidden;
}

.chart-info {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 210rpx;
  padding: 12rpx 14rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.94);
  border: 1rpx solid #fdba74;
  color: #ea580c;
  font-size: 24rpx;
  line-height: 1.28;
}

.chart-base {
  position: absolute;
  left: 42rpx;
  right: 26rpx;
  bottom: 50rpx;
  height: 86rpx;
  border-bottom: 2rpx solid #e7e5e4;
}

.chart-curve {
  position: absolute;
  left: 42rpx;
  right: 26rpx;
  bottom: 42rpx;
  height: 112rpx;
  overflow: hidden;
}

.chart-curve-line {
  position: absolute;
  left: -24rpx;
  right: -18rpx;
  bottom: -92rpx;
  height: 172rpx;
  border-top: 8rpx solid rgba(217, 119, 6, 0.62);
  border-radius: 50% 50% 0 0;
  transform: rotate(-4deg);
  box-shadow: 0 -8rpx 20rpx rgba(217, 119, 6, 0.10);
}

.chart-marker {
  position: absolute;
  top: 8rpx;
  bottom: 44rpx;
  width: 0;
  border-left: 5rpx dotted #d97706;
}

.chart-marker::before {
  content: '';
  position: absolute;
  top: -4rpx;
  left: -10rpx;
  width: 16rpx;
  height: 16rpx;
  border-radius: $radius-full;
  background: #fff;
  border: 5rpx solid #d97706;
}

.axis-left,
.axis-right {
  position: absolute;
  bottom: 26rpx;
  color: #a1a1aa;
  font-size: 24rpx;
}

.axis-left {
  left: 0;
}

.axis-right {
  right: 0;
}

.school-counts {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 8rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid rgba(251, 146, 60, 0.18);
  color: #78716c;
  font-size: 24rpx;
}

.count-label {
  margin-right: 12rpx;
  color: $text-primary;
}

.count {
  font-size: 28rpx;
  font-weight: 800;
}

.count.rush {
  color: #dc2626;
}

.count.stable {
  color: #2563eb;
}

.count.safe {
  color: #16a34a;
}

.candidate-hint {
  display: block;
  margin-top: 12rpx;
  color: #78716c;
  font-size: 22rpx;
  line-height: 1.4;
}

.preference-entry {
  align-items: center;
  margin-top: 28rpx;
  padding: 18rpx 20rpx;
  border-radius: 16rpx;
  background: #fdf2f8;
  border: 1rpx solid #fbcfe8;
}

.preference-title {
  display: block;
  color: $text-primary;
  font-size: $font-sm;
  font-weight: 800;
}

.preference-desc {
  display: block;
  margin-top: 4rpx;
  color: $text-tertiary;
  font-size: 22rpx;
  line-height: 1.35;
}

.preference-arrow {
  color: $text-tertiary;
  font-size: 42rpx;
  line-height: 1;
}

.submit-main {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  margin-top: 18rpx;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #0f766e 0%, #7c3aed 54%, #d97706 100%);
  color: #fff;
  font-size: $font-md;
  font-weight: 800;
  box-shadow: 0 12rpx 24rpx rgba(20, 184, 166, 0.16);
}

.submit-main.disabled {
  opacity: 0.55;
}

.engagement-line {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10rpx;
  margin-top: 12rpx;
  color: $text-tertiary;
  font-size: 22rpx;
  text-align: center;
  line-height: 1.35;
}

.engagement-line.low-points {
  color: $warning;
}

.recommend-card {
  padding: 26rpx;
  margin-bottom: $spacing-md;
  border-radius: 18rpx;
  background: #fff;
  border: 1rpx solid rgba(148, 163, 184, 0.22);
}

.recommend-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-sm;
  margin-top: $spacing-sm;
}

.recommend-tab {
  padding: 16rpx 10rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  border: 1rpx solid $border-light;
}

.recommend-tab.active.rush {
  background: #fff7ed;
  border-color: #fdba74;
}

.recommend-tab.active.steady {
  background: #f5f3ff;
  border-color: #c4b5fd;
}

.recommend-tab.active.safe {
  background: #ecfdf5;
  border-color: #86efac;
}

.recommend-tab.active.rush .recommend-name {
  color: #c2410c;
}

.recommend-tab.active.steady .recommend-name {
  color: #6d28d9;
}

.recommend-tab.active.safe .recommend-name {
  color: #059669;
}

.recommend-name,
.recommend-ratio {
  display: block;
  text-align: center;
}

.recommend-name {
  color: $text-primary;
  font-size: $font-sm;
  font-weight: 800;
}

.recommend-ratio {
  margin-top: 2rpx;
  color: $text-tertiary;
  font-size: 21rpx;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin: $spacing-sm 0;
}

.filter-chip {
  padding: 8rpx 14rpx;
  border-radius: 12rpx;
  background: #f8fafc;
  color: $text-secondary;
  font-size: 21rpx;
}

.recommend-tip {
  display: block;
  color: $text-tertiary;
  font-size: 22rpx;
  line-height: 1.45;
}

.trust-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-sm;
  margin-bottom: $spacing-md;
}

.trust-item {
  padding: 18rpx 14rpx;
  border-radius: 16rpx;
  background: #fff;
  border: 1rpx solid $border-light;
}

.trust-item:nth-child(1) {
  background: #ecfeff;
  border-color: #a5f3fc;
}

.trust-item:nth-child(2) {
  background: #f5f3ff;
  border-color: #ddd6fe;
}

.trust-item:nth-child(3) {
  background: #fff7ed;
  border-color: #fed7aa;
}

.trust-title {
  display: block;
  color: $text-primary;
  font-size: 22rpx;
  font-weight: 800;
  text-align: center;
}

.trust-desc {
  display: block;
  margin-top: 4rpx;
  color: $text-tertiary;
  font-size: 20rpx;
  text-align: center;
  line-height: 1.3;
}

.advanced-mask {
  position: fixed;
  inset: 0;
  z-index: 99;
  display: flex;
  align-items: flex-end;
  background: rgba(15, 23, 42, 0.38);
}

.advanced-sheet {
  width: 100%;
  max-height: 78vh;
  box-sizing: border-box;
  padding: $spacing-md;
  border-radius: 30rpx 30rpx 0 0;
  background: $bg-page;
}

.sheet-head {
  margin-bottom: $spacing-sm;
}

.sheet-title {
  display: block;
  color: $text-primary;
  font-size: $font-lg;
  font-weight: 800;
}

.sheet-sub {
  display: block;
  margin-top: 4rpx;
  color: $text-tertiary;
  font-size: $font-xs;
}

.sheet-close {
  flex-shrink: 0;
  color: #0f766e;
  font-size: $font-sm;
  font-weight: 800;
}

.sheet-body {
  max-height: 64vh;
}

.sheet-section {
  padding: $spacing-md;
  margin-bottom: $spacing-sm;
  border-radius: 18rpx;
  background: #fff;
  border: 1rpx solid rgba(148, 163, 184, 0.22);
}

.sheet-label {
  display: block;
  margin-bottom: $spacing-sm;
  color: $text-primary;
  font-size: $font-sm;
  font-weight: 800;
}

.sheet-input,
.sheet-textarea {
  width: 100%;
  box-sizing: border-box;
  margin-top: $spacing-sm;
  border: 1rpx solid rgba(15, 23, 42, 0.07);
  border-radius: 18rpx;
  background: #fff;
  color: $text-primary;
  font-size: $font-sm;
}

.sheet-input {
  height: 76rpx;
  padding: 0 $spacing-md;
}

.suggest-field {
  margin-top: $spacing-sm;
}

.suggest-field .sheet-input {
  margin-top: 0;
}

.suggest-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 12rpx;
  padding: 12rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  border: 1rpx solid rgba(148, 163, 184, 0.18);
}

.suggest-chip {
  padding: 9rpx 16rpx;
  border-radius: $radius-full;
  background: #fff;
  border: 1rpx solid #bae6fd;
  color: #0369a1;
  font-size: 22rpx;
  font-weight: 700;
}

.suggest-chip.danger {
  border-color: #fecaca;
  color: #b91c1c;
}

.sheet-textarea {
  min-height: 148rpx;
  padding: $spacing-sm $spacing-md 0;
  line-height: 1.5;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;
}

.chip {
  padding: 10rpx 18rpx;
  border-radius: $radius-full;
  background: #fff;
  border: 1rpx solid $border;
  color: $text-secondary;
  font-size: $font-xs;
}

.chip.active {
  background: #ecfdf5;
  color: #047857;
  border-color: #6ee7b7;
  font-weight: 800;
}

.history-card {
  padding: 26rpx;
  margin-top: $spacing-md;
  border-radius: 18rpx;
  background: #fff;
  border: 1rpx solid rgba(148, 163, 184, 0.22);
}

.section-title {
  display: block;
  margin-bottom: $spacing-xs;
  color: $text-primary;
  font-size: $font-md;
  font-weight: 800;
}

.history-state {
  padding: 18rpx 0 4rpx;
  color: $text-tertiary;
  font-size: $font-sm;
  line-height: 1.6;
}

.report-item {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  padding: $spacing-sm 0;
  border-top: 1rpx solid $border-light;
}

.report-main {
  color: $text-primary;
  font-size: $font-md;
  font-weight: 700;
}

.report-sub {
  color: $text-tertiary;
  font-size: $font-xs;
}

.analysis-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  box-sizing: border-box;
  background: rgba(15, 23, 42, 0.58);
  backdrop-filter: blur(14rpx);
}

.analysis-panel {
  width: 100%;
  max-width: 620rpx;
  padding: 46rpx 34rpx 36rpx;
  box-sizing: border-box;
  border-radius: 28rpx;
  background: linear-gradient(145deg, #ffffff 0%, #ecfeff 46%, #fff7ed 100%);
  border: 1rpx solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 34rpx 90rpx rgba(15, 23, 42, 0.26);
  text-align: center;
}

.orbit-loader {
  position: relative;
  width: 176rpx;
  height: 176rpx;
  margin: 0 auto 30rpx;
}

.orbit-ring,
.orbit-core,
.orbit-dot {
  position: absolute;
  border-radius: $radius-full;
}

.orbit-ring {
  inset: 0;
  border: 4rpx solid rgba(20, 184, 166, 0.18);
  border-top-color: #0f766e;
  border-right-color: #7c3aed;
  animation: orbitSpin 1.45s linear infinite;
}

.orbit-ring.ring-two {
  inset: 24rpx;
  border-color: rgba(217, 119, 6, 0.16);
  border-left-color: #d97706;
  border-bottom-color: #14b8a6;
  animation-duration: 1.9s;
  animation-direction: reverse;
}

.orbit-core {
  left: 50%;
  top: 50%;
  width: 84rpx;
  height: 84rpx;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f766e 0%, #7c3aed 100%);
  color: #fff;
  font-size: 28rpx;
  font-weight: 900;
  box-shadow: 0 16rpx 34rpx rgba(124, 58, 237, 0.28);
  animation: corePulse 1.2s ease-in-out infinite;
}

.orbit-dot {
  width: 18rpx;
  height: 18rpx;
  background: #f59e0b;
  box-shadow: 0 0 24rpx rgba(245, 158, 11, 0.58);
}

.dot-one {
  left: 18rpx;
  top: 38rpx;
  animation: dotFloat 1.4s ease-in-out infinite;
}

.dot-two {
  right: 20rpx;
  top: 68rpx;
  background: #14b8a6;
  animation: dotFloat 1.7s ease-in-out infinite 0.18s;
}

.dot-three {
  left: 82rpx;
  bottom: 10rpx;
  background: #8b5cf6;
  animation: dotFloat 1.5s ease-in-out infinite 0.34s;
}

.analysis-title {
  display: block;
  color: $text-primary;
  font-size: 36rpx;
  font-weight: 900;
  line-height: 1.25;
}

.analysis-desc {
  display: block;
  margin: 14rpx auto 24rpx;
  max-width: 500rpx;
  color: $text-secondary;
  font-size: 26rpx;
  line-height: 1.55;
}

.analysis-steps {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10rpx;
}

.analysis-steps text {
  padding: 8rpx 14rpx;
  border-radius: $radius-full;
  background: rgba(255, 255, 255, 0.72);
  border: 1rpx solid rgba(15, 118, 110, 0.12);
  color: #0f766e;
  font-size: 22rpx;
  font-weight: 800;
}

@keyframes orbitSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes corePulse {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(0.96);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.06);
  }
}

@keyframes dotFloat {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.65;
  }
  50% {
    transform: translateY(-12rpx);
    opacity: 1;
  }
}
</style>
