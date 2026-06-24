<template>
  <view class="report-page">
    <view id="report-guide-summary" class="summary-card" :class="reportTutorialTargetClass('summary')">
      <text class="eyebrow">AI 志愿分析报告</text>
      <view class="title-row">
        <text class="title">{{ displayReportTitle }}</text>
        <text class="title-edit" v-if="currentReportId()" @click="editReportTitle">改名</text>
      </view>
      <text class="summary">{{ data?.summary || result?.summary || '正在加载报告...' }}</text>
      <view class="summary-actions" v-if="currentReportId()">
        <view class="favorite-pill" :class="{ active: isFavorited }" @click="toggleFavorite">
          <image class="favorite-icon" :src="favoriteIcon" mode="aspectFit" />
          <text>{{ isFavorited ? '已收藏' : '收藏报告' }}</text>
        </view>
      </view>
    </view>

    <view class="decision-card">
      <view class="decision-item">
        <text class="decision-label">定位原则</text>
        <text class="decision-value">{{ isArtReport ? '综合分优先' : '位次优先' }}</text>
      </view>
      <view class="decision-item">
        <text class="decision-label">推荐依据</text>
        <text class="decision-value">{{ recommendationBasisText }}</text>
      </view>
      <view class="decision-item">
        <text class="decision-label">风险检查</text>
        <text class="decision-value">调剂/选科/体检</text>
      </view>
    </view>

    <view id="report-guide-tabs" class="tabs" :class="reportTutorialTargetClass('tabs')">
      <text class="tab" :class="{ active: activeTab === 'cards' }" @click="setActiveReportTab('cards')">冲稳保</text>
      <text id="report-guide-report-tab" class="tab" :class="[{ active: activeTab === 'report' }, reportTutorialTargetClass('reportTab')]" @click="setActiveReportTab('report')">完整报告</text>
    </view>

    <view v-if="activeTab === 'cards'">
      <view
        class="section result-section"
        :id="`report-guide-${group.key}`"
        :class="[group.key, reportTutorialTargetClass(group.key)]"
        v-for="group in groups"
        :key="group.key"
      >
        <view class="section-head foldable" @click="handleGroupToggle(group.key)">
          <text class="section-title">{{ group.title }}</text>
          <view class="section-action">
            <text class="section-count">{{ groupCountText(group) }}</text>
            <text class="fold-arrow">{{ isGroupCollapsed(group.key) ? '展开' : '收起' }}</text>
          </view>
        </view>
        <view v-if="!isGroupCollapsed(group.key)">
          <view class="empty" v-if="group.items.length === 0">暂无足够匹配数据</view>
          <view class="school-list" v-else>
            <view
              class="school-card"
              :id="reportTutorialSchoolId(item)"
              :class="[group.key, reportTutorialSchoolTargetClass(item), { 'no-detail': !hasUniversityDetail(item) }]"
              v-for="item in displayedItems(group)"
              :key="`${group.key}-${item.universityId || item.universityName}-${item.majorName}`"
              @click="openUniversity(item)"
            >
              <view class="school-top">
                <view>
                  <text class="school-name">{{ item.universityName }}</text>
                  <view class="school-location-row" v-if="schoolInfoParts(item).length">
                    <view class="location-parts" v-if="locationParts(item).length">
                      <text
                        v-for="part in locationParts(item)"
                        :key="part.text"
                        class="school-location-part"
                        :class="{ matched: part.matched }"
                      >{{ part.text }}</text>
                    </view>
                    <text class="school-info-chip" v-for="chip in schoolBaseChips(item)" :key="chip">{{ chip }}</text>
                  </view>
                  <text class="school-location" v-else>院校信息待补充</text>
                </view>
                <text class="school-arrow" v-if="hasUniversityDetail(item)">›</text>
                <text class="school-arrow muted" v-else>资料</text>
              </view>
              <view class="tag-row" v-if="cardMetaChips(item).length || visiblePreferenceTags(item).length || visibleWarningTags(item).length">
                <text class="meta-chip" v-for="chip in cardMetaChips(item)" :key="chip">{{ chip }}</text>
                <text class="match-chip" v-for="tag in visiblePreferenceTags(item)" :key="`m-${tag}`">{{ tag }}</text>
                <text class="warn-chip" v-for="tag in visibleWarningTags(item)" :key="`w-${tag}`">{{ tag }}</text>
              </view>
              <view class="option-lines" v-if="optionLines(item).length">
                <view class="option-line" v-for="(line, index) in optionLines(item)" :key="optionLineKey(line, index)">
                  <view class="option-head">
                    <text class="option-title">{{ optionLineTitle(line, index) }}</text>
                    <text class="option-type" :class="`tone-${index % 4}`">{{ optionLineType(line) }}</text>
                  </view>
                  <view class="option-tags">
                    <text class="option-chip bucket" :class="line.bucket || ''" v-if="line.bucket">{{ bucketLabel(line.bucket) }}</text>
                    <text class="option-chip score" v-if="line.minScore">最低{{ line.minScore }}分</text>
                    <text class="option-chip rank" v-if="line.minRank">位次{{ line.minRank }}</text>
                    <text class="option-chip year" v-if="line.year">{{ line.year }}年</text>
                    <text class="option-chip subject" v-if="line.subjectRequirement">{{ line.subjectRequirement }}</text>
                    <text class="option-chip match" v-for="tag in visiblePreferenceTags(line)" :key="`line-m-${tag}`">{{ tag }}</text>
                    <text class="option-chip warn" v-for="tag in visibleWarningTags(line)" :key="`line-w-${tag}`">{{ tag }}</text>
                  </view>
                </view>
              </view>
              <text class="reason">{{ displayReason(item) }}</text>
              <view class="school-actions">
                <text
                  class="school-ask-btn"
                  :id="reportTutorialAskSchoolId(item)"
                  :class="reportTutorialAskSchoolTargetClass(item)"
                  @click.stop="askAboutSchool(item)"
                >问问这所学校</text>
              </view>
            </view>
          </view>
          <view class="more-row" v-if="groupTotal(group) > initialGroupLimit || currentGroupLimit(group.key) > initialGroupLimit">
            <view class="more-btn" v-if="hasMore(group)" :class="{ loading: loadingMoreGroup === group.key }" @click="loadMoreGroup(group)">
              {{ moreButtonText(group) }}
            </view>
            <view class="less-btn" v-if="currentGroupLimit(group.key) > initialGroupLimit" @click="collapseGroupItems(group.key)">
              收起到前 {{ initialGroupLimit }} 个
            </view>
          </view>
        </view>
      </view>

      <view class="section">
        <text class="section-title">专业建议</text>
        <view class="bullet" v-for="item in result?.majorAdvice || []" :key="item">{{ item }}</view>
      </view>

      <view class="section">
        <text class="section-title">城市建议</text>
        <view class="bullet" v-for="item in result?.cityAdvice || []" :key="item">{{ item }}</view>
      </view>

      <view class="section">
        <text class="section-title">风险提示</text>
        <view class="bullet" v-for="risk in result?.risks || []" :key="risk">{{ risk }}</view>
      </view>

      <view class="section" v-if="result?.references?.length">
        <text class="section-title">参考依据</text>
        <view class="reference" v-for="ref in result.references" :key="`${ref.type}-${ref.id || ref.title}`">
          <text class="reference-title">{{ ref.title }}</text>
          <text class="reference-source">{{ ref.source || ref.type }}</text>
        </view>
      </view>

      <view class="action-row">
        <view class="secondary-btn" @click="goBackForm">重新分析</view>
        <view id="report-guide-followup" class="primary-btn" :class="reportTutorialTargetClass('followup')" @click="askFollowup">继续追问</view>
      </view>
    </view>

    <view v-else class="complete-report">
      <view class="report-cover">
        <view class="cover-top">
          <text class="cover-brand">涨识 · 赛博张老师</text>
          <text class="cover-date">{{ formattedReportDate }}</text>
        </view>
        <text class="cover-title">{{ displayReportTitle }}志愿分析</text>
        <text class="cover-summary">{{ result?.summary || data?.summary || '报告正在整理中。' }}</text>
        <view class="cover-tags">
          <text class="cover-tag">位次优先</text>
          <text class="cover-tag">冲稳保结构</text>
          <text class="cover-tag">{{ riskPreferenceLabel(reportInput?.riskPreference) }}</text>
        </view>
      </view>

      <view id="report-guide-download" class="download-panel" :class="reportTutorialTargetClass('download')">
        <view class="download-copy">
          <text class="download-title">保存精美报告</text>
          <text class="download-subtitle">首次生成 PDF {{ exportCosts.pdf }}点，长图 {{ exportCosts.image }}点；同一报告重复保存不再扣点。</text>
        </view>
        <view class="download-actions">
          <view class="download-btn pdf" :class="{ disabled: exportingType === 'pdf' }" @click="downloadReport('pdf')">
            {{ exportingType === 'pdf' ? '生成中' : `PDF ${exportCosts.pdf}点` }}
          </view>
          <view class="download-btn image" :class="{ disabled: exportingType === 'image' }" @click="downloadReport('image')">
            {{ exportingType === 'image' ? '生成中' : `长图 ${exportCosts.image}点` }}
          </view>
        </view>
      </view>

      <view class="report-metrics">
        <view class="metric-tile" v-for="metric in reportMetrics" :key="metric.label">
          <text class="metric-label">{{ metric.label }}</text>
          <text class="metric-value">{{ metric.value }}</text>
        </view>
      </view>

      <view class="report-section">
        <view class="report-section-head">
          <text class="report-section-title">冲稳保速览</text>
          <text class="report-section-note">优先看院校层级，再看专业组风险</text>
        </view>
        <view class="plan-grid">
          <view class="plan-card" :class="card.key" v-for="card in reportPlanCards" :key="card.key">
            <view class="plan-head">
              <text class="plan-title">{{ card.title }}</text>
              <text class="plan-count">{{ card.count }} 所</text>
            </view>
            <text class="plan-desc">{{ card.desc }}</text>
            <view class="plan-school" v-for="school in card.schools" :key="`${card.key}-${school.name}`">
              <text class="plan-school-name">{{ school.name }}</text>
              <text class="plan-school-meta">{{ school.meta }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="report-section">
        <view class="report-section-head">
          <text class="report-section-title">偏好与风险</text>
          <text class="report-section-note">来自本次分析设定</text>
        </view>
        <view class="preference-list">
          <view class="preference-row" v-for="item in reportPreferenceRows" :key="item.label">
            <text class="preference-label">{{ item.label }}</text>
            <text class="preference-value">{{ item.value }}</text>
          </view>
        </view>
      </view>

      <view class="report-section two-columns">
        <view class="mini-report-card">
          <text class="mini-title">专业建议</text>
          <view class="report-bullet" v-for="item in result?.majorAdvice || []" :key="`major-${item}`">{{ item }}</view>
          <view class="report-empty" v-if="!(result?.majorAdvice || []).length">暂无专业建议</view>
        </view>
        <view class="mini-report-card">
          <text class="mini-title">城市建议</text>
          <view class="report-bullet" v-for="item in result?.cityAdvice || []" :key="`city-${item}`">{{ item }}</view>
          <view class="report-empty" v-if="!(result?.cityAdvice || []).length">暂无城市建议</view>
        </view>
      </view>

      <view class="report-section">
        <view class="report-section-head">
          <text class="report-section-title">风险提示</text>
          <text class="report-section-note">填报前逐项核验</text>
        </view>
        <view class="risk-list">
          <view class="risk-item" v-for="risk in result?.risks || []" :key="risk">{{ risk }}</view>
          <view class="report-empty" v-if="!(result?.risks || []).length">暂无额外风险提示</view>
        </view>
      </view>

      <view class="report-section detail-section">
        <view class="report-section-head">
          <text class="report-section-title">完整分析</text>
          <text class="report-section-note">可继续追问细化排序</text>
        </view>
        <view class="analysis-block" v-for="block in reportBlocks" :key="block.title">
          <text class="analysis-title">{{ block.title }}</text>
          <text class="analysis-content">{{ block.content }}</text>
        </view>
      </view>

      <view class="action-row">
        <view class="secondary-btn" @click="goBackForm">重新分析</view>
        <view id="report-guide-followup" class="primary-btn" :class="reportTutorialTargetClass('followup')" @click="askFollowup">继续追问</view>
      </view>
    </view>

    <view
      id="report-guide-knowledge"
      class="report-tutorial-nav-target"
      :class="reportTutorialTargetClass('knowledge')"
      v-if="reportTutorialOpen && currentReportTutorialStep.key === 'knowledge'"
    >
      <view class="report-tutorial-nav-item ai">
        <text class="nav-item-title">AI追问</text>
        <text class="nav-item-desc">继续比较学校和专业</text>
      </view>
      <view class="report-tutorial-nav-item knowledge">
        <text class="nav-item-title">资料库</text>
        <text class="nav-item-desc">查院校专业政策</text>
      </view>
    </view>

    <view class="report-tutorial-mask" v-if="reportTutorialOpen" @click.stop></view>
    <view class="report-tutorial-card" :class="reportTutorialCardPlacement" v-if="reportTutorialOpen" @touchmove.stop>
      <view class="report-tutorial-head">
        <text class="report-tutorial-kicker">{{ reportTutorialProgressText }}</text>
        <text class="report-tutorial-close" @click="finishReportTutorial">×</text>
      </view>
      <text class="report-tutorial-title">{{ currentReportTutorialStep.title }}</text>
      <text class="report-tutorial-desc">{{ currentReportTutorialStep.desc }}</text>
      <view class="report-tutorial-dots">
        <text
          v-for="(_, index) in reportTutorialSteps"
          :key="index"
          :class="{ active: index === reportTutorialStep }"
        ></text>
      </view>
      <view class="report-tutorial-actions">
        <text class="report-tutorial-skip" @click="finishReportTutorial">跳过</text>
        <text
          class="report-tutorial-link"
          v-if="currentReportTutorialStep.actionText"
          @click="handleReportTutorialAction"
        >{{ currentReportTutorialStep.actionText }}</text>
        <text class="report-tutorial-primary" @click="handleReportTutorialPrimary">{{ reportTutorialPrimaryText }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { onLoad, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { api } from '@/api';
import { useUserStore } from '@/store/user';
import { buildIconSrc } from '@/utils/iconSvgs';
import { recordShare, withShareRef } from '@/utils/share';

const userStore = useUserStore();
const activeTab = ref<'cards' | 'report'>('cards');
const data = ref<any>(null);
const collapsedGroups = ref<Record<string, boolean>>({});
const groupDisplayLimits = ref<Record<string, number>>({});
const loadingMoreGroup = ref('');
const exportingType = ref<'pdf' | 'image' | ''>('');
const exportCosts = ref({ pdf: 3, image: 5 });
const isFavorited = ref(false);
const reportTutorialOpen = ref(false);
const reportTutorialStep = ref(0);
const initialGroupLimit = 12;
const loadMoreStep = 12;
const result = computed(() => data.value?.result || data.value);
const markdownReport = computed(() => data.value?.markdownReport || '');
const favoriteIcon = computed(() => buildIconSrc('Star', isFavorited.value ? '#ffffff' : '#b45309'));
const PUBLIC_FIGURE_TERM = ['张', '雪', '峰'].join('');
const FIXED_NOTICE_TITLE = ['免', '责', '声', '明'].join('');

type ReportTutorialKey =
  | 'summary'
  | 'tabs'
  | 'rush'
  | 'stable'
  | 'safe'
  | 'school'
  | 'askSchool'
  | 'reportTab'
  | 'download'
  | 'followup'
  | 'knowledge';

const reportTutorialSteps: Array<{
  key: ReportTutorialKey;
  title: string;
  desc: string;
  actionText?: string;
}> = [
  {
    key: 'summary',
    title: '先看总体判断',
    desc: '这里是本次模拟报志愿的结论摘要，先判断整体方向，再往下看冲稳保结构。',
  },
  {
    key: 'rush',
    title: '点击查看冲刺建议',
    desc: '冲刺建议适合争取更高层次院校，重点看专业组、调剂和退档风险。',
    actionText: '展开冲刺',
  },
  {
    key: 'stable',
    title: '再看稳妥建议',
    desc: '稳妥建议通常是方案主体，录取概率和专业选择会更均衡。',
    actionText: '展开稳妥',
  },
  {
    key: 'safe',
    title: '最后看保底建议',
    desc: '保底建议用来守住底线，填报前要确认城市、专业和学费都能接受。',
    actionText: '展开保底',
  },
  {
    key: 'school',
    title: '点大学看详情',
    desc: '点开任意大学，可以查看院校资料；在院校详情底部也能继续问这所学校。',
  },
  {
    key: 'askSchool',
    title: '不确定就问这所学校',
    desc: '这里会带着本次报告背景进入 AI 追问，直接问它适合冲、稳还是保。',
    actionText: '现在追问',
  },
  {
    key: 'reportTab',
    title: '还能看完整报告',
    desc: '切换到完整报告，会看到更完整的分析、偏好与风险、冲稳保速览。',
    actionText: '打开完整报告',
  },
  {
    key: 'download',
    title: '保存或下载报告',
    desc: '完整报告可以生成 PDF 或长图。同一份报告重复保存，不会重复扣点。',
  },
  {
    key: 'followup',
    title: '用 AI 追问继续细化',
    desc: '点继续追问会自动带上报告上下文，适合比较学校、专业组和最终排序。',
    actionText: '去AI追问',
  },
  {
    key: 'knowledge',
    title: '资料库用来查依据',
    desc: '底部 AI追问适合做决策比较；资料库可以查院校、专业和政策原始资料。',
    actionText: '打开资料库',
  },
];

const currentReportTutorialStep = computed(() => reportTutorialSteps[reportTutorialStep.value] || reportTutorialSteps[0]);
const reportTutorialProgressText = computed(() => `${reportTutorialStep.value + 1}/${reportTutorialSteps.length}`);
const reportTutorialPrimaryText = computed(() => reportTutorialStep.value >= reportTutorialSteps.length - 1 ? '完成' : '下一步');
const reportTutorialCardPlacement = computed(() => {
  const key = currentReportTutorialStep.value.key;
  return key === 'followup' || key === 'knowledge' ? 'top' : 'bottom';
});
const reportTutorialSchool = computed(() => {
  const preferredOrder = ['stable', 'rush', 'safe'];
  for (const key of preferredOrder) {
    const group = groups.value.find(item => item.key === key);
    if (group?.items?.length) return group.items[0];
  }
  return null;
});
const reportTutorialSchoolGroupKey = computed(() => {
  const school = reportTutorialSchool.value;
  if (!school) return '';
  const schoolKey = school.universityId || school.universityName;
  const group = groups.value.find(item => item.items.some((candidate: any) => (candidate.universityId || candidate.universityName) === schoolKey));
  return group?.key || '';
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const reportBlocks = computed(() => {
  const text = sanitizeReport(markdownReport.value || fallbackReadableReport.value);
  const parts = text
    .split(/\n(?=#{1,3}\s+)/)
    .map(part => part.trim())
    .filter(Boolean);
  if (!parts.length && result.value?.summary) {
    return [{ title: '结论', content: result.value.summary }];
  }
  return parts.map((part, index) => {
    const lines = part.split('\n').map(line => line.trim()).filter(Boolean);
    const rawTitle = lines[0] || `第 ${index + 1} 部分`;
    const title = rawTitle.replace(/^#{1,3}\s*/, '').replace(/^[-*]\s*/, '');
    const content = lines.slice(1).join('\n').replace(/^[-*]\s*/gm, '· ') || title;
    return { title, content };
  });
});

const fallbackReadableReport = computed(() => {
  const groupsText = groups.value
    .map(group => {
      const names = group.items.slice(0, 5).map((item: any) => item.universityName).filter(Boolean).join('、');
      return `## ${group.title}\n${names || '暂无足够匹配数据'}`;
    })
    .join('\n\n');
  const major = (result.value?.majorAdvice || []).map((item: string) => `- ${item}`).join('\n');
  const city = (result.value?.cityAdvice || []).map((item: string) => `- ${item}`).join('\n');
  const risks = (result.value?.risks || []).map((item: string) => `- ${item}`).join('\n');
  return `## 先看结论\n${result.value?.summary || data.value?.summary || '报告正在整理。'}\n\n${groupsText}\n\n## 专业建议\n${major || '暂无'}\n\n## 城市建议\n${city || '暂无'}\n\n## 风险提示\n${risks || '暂无'}`;
});

function sanitizeReport(content = '') {
  return content
    .replace(/^[#＃]+\s*[^\n#＃]{0,12}上线[！!。.\s]*$/gm, '')
    .replace(/(?:^|\n)\s*第三方\s*AI\s*服务[^。！？!?；;\n]*(?:异常|不可用|失败)[^。！？!?；;\n]*[。！？!?；;]?\s*/g, '\n')
    .replace(new RegExp(`^[#＃]{1,6}\\s*(?:${escapeRegExp(FIXED_NOTICE_TITLE)}|温馨提醒|重要声明)\\s*$`, 'gm'), '')
    .replace(new RegExp(`(?:^|\\n)\\s*(?:${escapeRegExp(FIXED_NOTICE_TITLE)}|重要声明|温馨提醒)[:：][\\s\\S]*?(?=\\n{2,}|$)`, 'g'), '\n')
    .replace(new RegExp(`[^。！？!?；;\\n]*${escapeRegExp(PUBLIC_FIGURE_TERM)}[^。！？!?；;\\n]*[。！？!?；;]?`, 'g'), '')
    .replace(/[^。！？!?；;\n]*(?:公开言论启发|风格启发|非本人观点|本人观点|复刻)[^。！？!?；;\n]*[。！？!?；;]?/g, '')
    .replace(/我是AI助手赛博张老师[^。！？!?；;\n]*[。！？!?；;]?/g, '')
    .replace(/本回答内容由AI生成，仅作参考，不构成升学决策唯一依据。?建议结合实际情况，多方查证后做决定。?/g, '')
    .replace(/本回答仅作参考，不构成升学决策唯一依据。?/g, '')
    .replace(/仅供参考，不构成[^。！？!?；;\n]*[。！？!?；;]?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const reportTitle = computed(() => {
  const source = data.value?.input || data.value;
  if (!source?.province) return '志愿分析报告';
  if (source.examCategory === 'art') {
    return `${source.province} ${source.artCategory || '艺术类'} ${source.score || ''}分`;
  }
  return `${source.province} ${source.subjectType || ''} ${source.score || ''}分`;
});

const displayReportTitle = computed(() => data.value?.title || reportTitle.value);

const isArtReport = computed(() => {
  const source = data.value?.input || data.value;
  return source?.examCategory === 'art';
});

const hasFallbackRecommendations = computed(() => {
  const recommendations = result.value?.recommendations || {};
  return ['rush', 'stable', 'safe'].some(key =>
    (recommendations[key] || []).some((item: any) =>
      (item.optionLines || []).some((line: any) => line?.lineType === 'art_fallback') ||
      (item.optionLines || []).some((line: any) => line?.lineType === 'normal_fallback') ||
      (item.warningTags || []).includes('资料候选'),
    ),
  );
});

const recommendationBasisText = computed(() => {
  if (hasFallbackRecommendations.value) return '投档线/院校库';
  return isArtReport.value ? '艺术投档线' : '历年录取线';
});

const groups = computed(() => {
  const recommendations = result.value?.recommendations || {};
  const normalized = buildDisplayRecommendationGroups(recommendations);
  return [
    { key: 'rush', title: '冲刺建议', items: normalized.rush },
    { key: 'stable', title: '稳妥建议', items: normalized.stable },
    { key: 'safe', title: '保底建议', items: normalized.safe },
  ];
});

const recommendationStats = computed(() => result.value?.recommendationStats || {});
const reportInput = computed(() => {
  const source = data.value?.input;
  if (!source?.province || !source?.subjectType || source?.score === undefined) return null;
  return Object.assign({}, source, {
    province: String(source.province).trim(),
    subjectType: String(source.subjectType).trim(),
    score: Number(source.score),
    rank: source.rank ? Number(source.rank) : undefined,
  });
});

const formattedReportDate = computed(() => {
  const raw = data.value?.createdAt;
  const date = raw ? new Date(raw) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
});

const reportMetrics = computed(() => {
  const source = reportInput.value || data.value || {};
  return [
    { label: '考生省份', value: source.province || '未填写' },
    { label: isArtReport.value ? '艺术类别' : '科类/选科', value: isArtReport.value ? (source.artCategory || '未填写') : (source.subjectType || '未填写') },
    { label: '高考分数', value: source.score ? `${source.score} 分` : '未填写' },
    isArtReport.value
      ? { label: '统考/专业分', value: source.artProfessionalScore ? `${source.artProfessionalScore} 分` : '未填写' }
      : { label: '参考位次', value: source.rank ? `${source.rank}` : '未填写' },
    { label: '分析年份', value: source.year ? `${source.year} 年` : '默认年份' },
    { label: '风险偏好', value: riskPreferenceLabel(source.riskPreference) },
  ];
});

const reportPreferenceRows = computed(() => {
  const source = reportInput.value || {};
  return [
    { label: '目标城市或省份', value: joinDisplayList(source.preferredCities) },
    { label: '偏好专业', value: joinDisplayList(source.preferredMajors) },
    { label: '规避专业', value: joinDisplayList(source.avoidMajors) },
    { label: '补充背景', value: source.familyExpectation || '未填写' },
  ];
});

const reportPlanCards = computed(() => groups.value.map(group => ({
  key: group.key,
  title: group.key === 'rush' ? '冲刺' : group.key === 'safe' ? '保底' : '稳妥',
  desc: group.key === 'rush'
    ? '适合冲击更高层次院校，注意专业组和调剂风险。'
    : group.key === 'safe'
      ? '用于守住可接受底线，优先确认专业接受度。'
      : '录取概率和专业选择更均衡，是方案主体。' ,
  count: groupTotal(group),
  schools: group.items.slice(0, 4).map((item: any) => ({
    name: item.universityName,
    meta: [item.city || item.province, item.type, item.level].filter(Boolean).join(' · ') || '院校信息待补充',
  })),
})));

function joinDisplayList(value: unknown) {
  if (!Array.isArray(value) || !value.length) return '未填写';
  return value.filter(Boolean).join('、') || '未填写';
}

function riskPreferenceLabel(value?: string) {
  if (value === 'conservative') return '稳健保守';
  if (value === 'aggressive') return '积极冲刺';
  return '均衡配置';
}

function currentReportId() {
  return data.value?.id || data.value?.reportId || '';
}

function setActiveReportTab(tab: 'cards' | 'report') {
  activeTab.value = tab;
  if (tab === 'report' && reportTutorialOpen.value && currentReportTutorialStep.value.key === 'reportTab') {
    advanceReportTutorial();
  }
}

async function downloadReport(type: 'pdf' | 'image') {
  const reportId = currentReportId();
  if (!reportId) {
    uni.showToast({ title: '请先生成报告', icon: 'none' });
    return;
  }
  if (exportingType.value) return;

  const cost = type === 'pdf' ? exportCosts.value.pdf : exportCosts.value.image;
  try {
    await uni.showModal({
      title: type === 'pdf' ? '生成 PDF 报告' : '生成长图报告',
      content: `首次生成将消耗 ${cost} 点，同一报告重复保存不再扣点。确认继续吗？`,
      confirmText: '继续',
      cancelText: '取消',
    }).then((res: any) => {
      if (!res.confirm) throw new Error('CANCEL_EXPORT');
    });
  } catch (err: any) {
    if (err?.message === 'CANCEL_EXPORT') return;
    return;
  }

  exportingType.value = type;
  uni.showLoading({ title: type === 'pdf' ? '生成PDF中' : '生成长图中', mask: true });
  try {
    const token = uni.getStorageSync('token');
    const downloadRes = await uni.downloadFile({
      url: api.volunteer.exportUrl(reportId, type),
      header: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: 90000,
    });

    if (downloadRes.statusCode && downloadRes.statusCode >= 400) {
      throw new Error('报告生成失败');
    }
    if (!downloadRes.tempFilePath) {
      throw new Error('报告下载失败');
    }
    const namedFilePath = await persistExportFile(downloadRes.tempFilePath, type);

    if (type === 'pdf') {
      await uni.openDocument({ filePath: namedFilePath, fileType: 'pdf', showMenu: true });
      return;
    }

    await uni.saveImageToPhotosAlbum({ filePath: namedFilePath });
    uni.showToast({ title: '长图已保存', icon: 'success' });
  } catch (err: any) {
    const message = String(err?.errMsg || err?.message || '');
    const title = /auth|authorize|permission|scope/i.test(message)
      ? '请允许保存到相册'
      : err?.message || '导出失败，请稍后再试';
    uni.showToast({ title, icon: 'none' });
  } finally {
    exportingType.value = '';
    uni.hideLoading();
  }
}

function toggleGroup(key: string) {
  collapsedGroups.value = Object.assign({}, collapsedGroups.value, {
    [key]: !collapsedGroups.value[key],
  });
}

function handleGroupToggle(key: string) {
  toggleGroup(key);
  if (reportTutorialOpen.value && currentReportTutorialStep.value.key === key) {
    if (collapsedGroups.value[key]) {
      toggleGroup(key);
    }
    advanceReportTutorial();
  }
}

function isGroupCollapsed(key: string) {
  return Boolean(collapsedGroups.value[key]);
}

async function persistExportFile(tempFilePath: string, type: 'pdf' | 'image') {
  const fs = (uni as any).getFileSystemManager?.();
  const root = (globalThis as any)?.wx?.env?.USER_DATA_PATH || (globalThis as any)?.uni?.env?.USER_DATA_PATH || '';
  if (!fs || !root) return tempFilePath;

  const filePath = `${root}/${buildExportFilename(type)}`;
  const copied = await new Promise<boolean>((resolve) => {
    fs.unlink({
      filePath,
      complete: () => {
        fs.copyFile({
          srcPath: tempFilePath,
          destPath: filePath,
          success: () => resolve(true),
          fail: () => resolve(false),
        });
      },
    });
  });
  return copied ? filePath : tempFilePath;
}

function buildExportFilename(type: 'pdf' | 'image') {
  const ext = type === 'pdf' ? 'pdf' : 'png';
  const userName = userStore.userInfo?.nickname || userStore.userInfo?.phone || '用户';
  const reportId = currentReportId();
  const parts = [
    '涨识',
    '志愿分析报告',
    userName,
    displayReportTitle.value,
    formattedReportDate.value.replace(/\./g, ''),
    reportId ? reportId.slice(0, 8) : '',
  ].filter(Boolean);
  return `${safeDownloadFilename(parts.join('_'))}.${ext}`;
}

function safeDownloadFilename(value: string) {
  return String(value || '涨识_志愿分析报告')
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

function currentGroupLimit(key: string) {
  return groupDisplayLimits.value[key] || initialGroupLimit;
}

function groupTotal(group: { key: string; items: any[] }) {
  const total = Number(recommendationStats.value?.[group.key] || 0);
  return Math.max(Number.isFinite(total) ? total : 0, group.items.length);
}

function displayedItems(group: { key: string; items: any[] }) {
  return group.items.slice(0, currentGroupLimit(group.key));
}

function visibleGroupCount(group: { key: string; items: any[] }) {
  return displayedItems(group).length;
}

function groupCountText(group: { key: string; items: any[] }) {
  const total = groupTotal(group);
  const visible = visibleGroupCount(group);
  if (total > visible) {
    return `展示 ${visible} / 候选 ${total}`;
  }
  return `${visible} 项`;
}

function hasMore(group: { key: string; items: any[] }) {
  return visibleGroupCount(group) < groupTotal(group);
}

function moreButtonText(group: { key: string; items: any[] }) {
  if (loadingMoreGroup.value === group.key) return '加载中...';
  const total = groupTotal(group);
  const nextCount = Math.min(total, currentGroupLimit(group.key) + loadMoreStep);
  return nextCount >= total ? `查看全部 ${total} 条` : `查看更多（到 ${nextCount} 条）`;
}

async function loadMoreGroup(group: { key: string; items: any[] }) {
  if (loadingMoreGroup.value) return;

  const total = groupTotal(group);
  const nextLimit = Math.min(total, currentGroupLimit(group.key) + loadMoreStep);
  if (nextLimit <= currentGroupLimit(group.key)) return;

  const previousLimits = Object.assign({}, groupDisplayLimits.value);
  groupDisplayLimits.value = Object.assign({}, groupDisplayLimits.value, {
    [group.key]: nextLimit,
  });

  if (group.items.length >= nextLimit) return;

  if (!reportInput.value) {
    groupDisplayLimits.value = previousLimits;
    uni.showToast({ title: '请重新生成报告后查看更多', icon: 'none' });
    return;
  }

  loadingMoreGroup.value = group.key;
  try {
    const res = await api.volunteer.preview(Object.assign({}, reportInput.value, {
      recommendationLimit: nextLimit,
    }));
    mergePreviewResult(res.data);
  } catch (err: any) {
    groupDisplayLimits.value = previousLimits;
    uni.showToast({ title: err?.message || '加载更多失败', icon: 'none' });
  } finally {
    loadingMoreGroup.value = '';
  }
}

function collapseGroupItems(key: string) {
  groupDisplayLimits.value = Object.assign({}, groupDisplayLimits.value, {
    [key]: initialGroupLimit,
  });
}

function mergePreviewResult(nextResult: any) {
  if (!nextResult) return;
  const mergedResult = Object.assign({}, result.value || {}, {
    recommendations: nextResult.recommendations || result.value?.recommendations || {},
    recommendationStats: nextResult.recommendationStats || result.value?.recommendationStats || {},
  });
  data.value = data.value?.result
    ? Object.assign({}, data.value, { result: mergedResult })
    : Object.assign({}, data.value, mergedResult);
  if (data.value?.reportId || data.value?.id) {
    uni.setStorageSync('latest_volunteer_report', data.value);
  }
}

async function loadReport(id?: string) {
  const latest = uni.getStorageSync('latest_volunteer_report');
  const latestId = latest?.reportId || latest?.id;
  if (latest && (!id || latestId === id)) {
    data.value = latest;
    if (latest.input || !id) {
      await loadFavoriteState();
      maybeOpenReportTutorial(id);
      return;
    }
  }
  if (!id) return;

  try {
    const res = await api.volunteer.detail(id);
    data.value = res.data;
    uni.setStorageSync('latest_volunteer_report', res.data);
    await loadFavoriteState();
    maybeOpenReportTutorial(id);
  } catch (err: any) {
    uni.showToast({ title: err?.message || '报告加载失败', icon: 'none' });
  }
}

function maybeOpenReportTutorial(id?: string) {
  const pending = uni.getStorageSync('volunteer_report_tutorial_pending');
  if (!pending) return;
  const pendingId = String((pending as any)?.reportId || '');
  const createdAt = Number((pending as any)?.at || 0);
  const expired = createdAt > 0 && Date.now() - createdAt > 10 * 60 * 1000;
  const currentId = id || currentReportId();
  if (expired || (pendingId && currentId && pendingId !== currentId)) {
    uni.removeStorageSync('volunteer_report_tutorial_pending');
    return;
  }
  uni.removeStorageSync('volunteer_report_tutorial_pending');
  setTimeout(() => {
    openReportTutorial();
  }, 360);
}

function openReportTutorial() {
  reportTutorialStep.value = 0;
  reportTutorialOpen.value = true;
  prepareReportTutorialStep();
}

function finishReportTutorial() {
  reportTutorialOpen.value = false;
}

function reportTutorialFocusVisible(key: ReportTutorialKey) {
  return reportTutorialOpen.value && currentReportTutorialStep.value.key === key;
}

function reportTutorialTargetClass(key: ReportTutorialKey) {
  return {
    'report-tutorial-target': reportTutorialFocusVisible(key),
  };
}

function reportTutorialSchoolId(item: any) {
  return isReportTutorialSchool(item) ? 'report-guide-school' : '';
}

function reportTutorialAskSchoolId(item: any) {
  return isReportTutorialSchool(item) ? 'report-guide-ask-school' : '';
}

function reportTutorialSchoolTargetClass(item: any) {
  return {
    'report-tutorial-target': reportTutorialFocusVisible('school') && isReportTutorialSchool(item),
  };
}

function reportTutorialAskSchoolTargetClass(item: any) {
  return {
    'report-tutorial-target': reportTutorialFocusVisible('askSchool') && isReportTutorialSchool(item),
  };
}

function isReportTutorialSchool(item: any) {
  const target = reportTutorialSchool.value;
  if (!target || !item) return false;
  const targetKey = target.universityId || target.universityName;
  const itemKey = item.universityId || item.universityName;
  return Boolean(targetKey && itemKey && targetKey === itemKey);
}

function handleReportTutorialPrimary() {
  if (currentReportTutorialStep.value.key === 'reportTab') {
    setActiveReportTab('report');
    return;
  }
  if (reportTutorialStep.value >= reportTutorialSteps.length - 1) {
    finishReportTutorial();
    return;
  }
  advanceReportTutorial();
}

function handleReportTutorialAction() {
  const key = currentReportTutorialStep.value.key;
  if (key === 'rush' || key === 'stable' || key === 'safe') {
    collapsedGroups.value = Object.assign({}, collapsedGroups.value, { [key]: false });
    advanceReportTutorial();
    return;
  }
  if (key === 'askSchool') {
    const school = reportTutorialSchool.value;
    if (school) askAboutSchool(school);
    return;
  }
  if (key === 'reportTab') {
    setActiveReportTab('report');
    return;
  }
  if (key === 'followup') {
    askFollowup();
    return;
  }
  if (key === 'knowledge') {
    finishReportTutorial();
    uni.switchTab({ url: '/pages/knowledge/index' });
  }
}

function advanceReportTutorial() {
  if (reportTutorialStep.value >= reportTutorialSteps.length - 1) {
    finishReportTutorial();
    return;
  }
  reportTutorialStep.value += 1;
  skipUnavailableReportTutorialSteps();
  prepareReportTutorialStep();
}

function skipUnavailableReportTutorialSteps() {
  while (
    reportTutorialStep.value < reportTutorialSteps.length - 1 &&
    reportTutorialStepUnavailable(currentReportTutorialStep.value.key)
  ) {
    reportTutorialStep.value += 1;
  }
}

function reportTutorialStepUnavailable(key: ReportTutorialKey) {
  if (key === 'school' || key === 'askSchool') return !reportTutorialSchool.value;
  return false;
}

function prepareReportTutorialStep() {
  nextTick(() => {
    const key = currentReportTutorialStep.value.key;
    if (key === 'rush' || key === 'stable' || key === 'safe') {
      activeTab.value = 'cards';
      collapsedGroups.value = Object.assign({}, collapsedGroups.value, { [key]: false });
    }
    if (key === 'school' || key === 'askSchool') {
      activeTab.value = 'cards';
      const groupKey = reportTutorialSchoolGroupKey.value;
      if (groupKey) {
        collapsedGroups.value = Object.assign({}, collapsedGroups.value, { [groupKey]: false });
      }
    }
    if (key === 'reportTab') {
      activeTab.value = 'cards';
    }
    if (key === 'download' || key === 'followup') {
      activeTab.value = 'report';
    }
    nextTick(() => {
      scrollToReportTutorialTarget();
    });
  });
}

function scrollToReportTutorialTarget() {
  const selector = reportTutorialTargetSelector();
  if (!selector) return;
  uni.pageScrollTo({
    selector,
    offsetTop: -120,
    duration: 260,
  } as any);
}

function reportTutorialTargetSelector() {
  const key = currentReportTutorialStep.value.key;
  if (key === 'summary') return '#report-guide-summary';
  if (key === 'rush' || key === 'stable' || key === 'safe') return `#report-guide-${key}`;
  if (key === 'school') return '#report-guide-school';
  if (key === 'askSchool') return '#report-guide-ask-school';
  if (key === 'reportTab') return '#report-guide-tabs';
  if (key === 'download') return '#report-guide-download';
  if (key === 'followup') return '#report-guide-followup';
  return '';
}

function collapseAllGroups() {
  collapsedGroups.value = { rush: true, stable: true, safe: true };
}

async function loadFavoriteState() {
  const reportId = currentReportId();
  if (!reportId || !hasLoginToken()) return;
  try {
    const res = await api.favorites.check('volunteer_report', reportId);
    isFavorited.value = Boolean((res.data as any)?.favorited);
  } catch { /* ignore */ }
}

async function toggleFavorite() {
  const reportId = currentReportId();
  if (!reportId) return;
  if (!hasLoginToken()) {
    userStore.loginWithWechatProfile();
    return;
  }
  try {
    const res = await api.favorites.toggle('volunteer_report', reportId);
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

async function loadExportCosts() {
  try {
    const res = await api.volunteer.exportCosts();
    const pdf = Number(res.data?.pdf);
    const image = Number(res.data?.image);
    exportCosts.value = {
      pdf: Number.isFinite(pdf) ? Math.max(0, Math.trunc(pdf)) : 3,
      image: Number.isFinite(image) ? Math.max(0, Math.trunc(image)) : 5,
    };
  } catch {
    // Keep local defaults when the config endpoint is temporarily unavailable.
  }
}

function goBackForm() {
  uni.navigateTo({ url: '/pages/volunteer/index' });
}

function askFollowup() {
  const rec = result.value?.recommendations || {};
  const brief = ['rush', 'stable', 'safe']
    .map(key => ((rec[key] || []) as any[]).slice(0, 3).map(item => item.universityName).join('、'))
    .filter(Boolean)
    .join('；');
  const text = `请基于我的高考志愿分析报告继续帮我细化方案。
报告：${displayReportTitle.value}
结论：${result.value?.summary || ''}
候选院校：${brief || '暂无足够候选'}
我想继续比较院校、专业组风险、调剂风险和最终排序。`;
  userStore.consultQuestion = text;
  userStore.consultType = 'deep';
  userStore.consultContext = buildReportConsultContext();
  userStore.forceNewConsult = true;
  userStore.pendingConsult = true;
  uni.switchTab({ url: '/pages/consult/index' });
}

async function editReportTitle() {
  const reportId = currentReportId();
  if (!reportId) return;
  try {
    const modal = await uni.showModal({
      title: '修改报告名称',
      editable: true,
      placeholderText: '输入新的报告名称',
      content: displayReportTitle.value,
      confirmText: '保存',
      cancelText: '取消',
    } as any);
    if (!modal.confirm) return;
    const title = String((modal as any).content || '').trim();
    if (!title) {
      uni.showToast({ title: '报告名称不能为空', icon: 'none' });
      return;
    }
    const res = await api.volunteer.updateReportTitle(reportId, title);
    data.value = Object.assign({}, data.value, { title: res.data?.title || title });
    uni.setStorageSync('latest_volunteer_report', data.value);
    uni.showToast({ title: '已保存', icon: 'none' });
  } catch (err: any) {
    uni.showToast({ title: err?.message || '修改失败', icon: 'none' });
  }
}

function askAboutSchool(item: any) {
  const schoolName = item?.universityName || item?.name;
  if (!schoolName) return;
  userStore.consultQuestion = `请基于这份志愿分析报告，帮我分析 ${schoolName}：放在冲稳保哪一档更合适、专业组和调剂风险在哪里、是否符合我的偏好。`;
  userStore.consultType = 'deep';
  userStore.consultContext = buildReportConsultContext(item);
  userStore.forceNewConsult = true;
  userStore.pendingConsult = true;
  uni.switchTab({ url: '/pages/consult/index' });
}

function buildReportConsultContext(school?: any) {
  const input = reportInput.value || data.value?.input || {};
  const rec = result.value?.recommendations || {};
  const brief = ['rush', 'stable', 'safe']
    .map(key => {
      const label = key === 'rush' ? '冲刺' : key === 'safe' ? '保底' : '稳妥';
      const lines = ((rec[key] || []) as any[])
        .slice(0, 5)
        .map((item: any) => summarizeConsultSchool(item, key))
        .filter(Boolean);
      return lines.length ? `${label}候选：\n${lines.join('\n')}` : '';
    })
    .filter(Boolean)
    .join('\n');
  return [
    '咨询来源：志愿报告继续追问',
    '回答任务：基于现有志愿报告做解释、比较、细化和微调，不要脱离原报告重新推翻方案。',
    currentReportId() ? `志愿报告ID：${currentReportId()}` : '',
    input.province ? `考生省份：${input.province}` : '',
    input.subjectType ? `选科/科类：${input.subjectType}` : '',
    input.score ? `分数：${input.score}` : '',
    input.rank ? `位次：${input.rank}` : '',
    input.targetBatch ? `批次：${input.targetBatch}` : '',
    input.riskPreference ? `风险偏好：${riskPreferenceLabel(input.riskPreference)}` : '',
    Array.isArray(input.preferredCities) && input.preferredCities.length ? `目标城市或省份：${input.preferredCities.join('、')}` : '',
    Array.isArray(input.preferredMajors) && input.preferredMajors.length ? `偏好专业：${input.preferredMajors.join('、')}` : '',
    Array.isArray(input.avoidMajors) && input.avoidMajors.length ? `规避专业：${input.avoidMajors.join('、')}` : '',
    input.familyExpectation ? `家庭/个人期待：${String(input.familyExpectation).slice(0, 220)}` : '',
    result.value?.summary ? `报告结论：${result.value.summary}` : '',
    brief ? `报告候选明细：\n${brief}` : '',
    school?.universityName ? `关注院校：${school.universityName}` : '',
    [school?.province, school?.city].filter(Boolean).length ? `院校城市：${[school?.province, school?.city].filter(Boolean).join(' · ')}` : '',
    school?.type ? `院校类型：${school.type}` : '',
    school?.level ? `院校层次：${school.level}` : '',
    school?.bucket ? `报告分档：${bucketLabel(school.bucket)}` : '',
    school?.reason ? `报告推荐理由：${school.reason}` : '',
    school?.warningTags?.length ? `报告风险标签：${school.warningTags.join('、')}` : '',
    school?.preferenceTags?.length ? `报告偏好命中：${school.preferenceTags.join('、')}` : '',
  ].filter(Boolean).join('\n');
}

function summarizeConsultSchool(item: any, bucket?: string) {
  const name = item?.universityName || item?.name;
  if (!name) return '';
  const tags = [
    item?.majorName ? `专业${item.majorName}` : '',
    item?.minScore ? `最低${item.minScore}分` : '',
    item?.minRank ? `位次${item.minRank}` : '',
    item?.subjectRequirement ? `选科${item.subjectRequirement}` : '',
    item?.warningTags?.length ? `风险${item.warningTags.slice(0, 2).join('、')}` : '',
  ].filter(Boolean).join('，');
  const reason = String(item?.reason || '').trim().slice(0, 48);
  return `- ${name}${bucket ? `｜${bucketLabel(bucket)}` : ''}${tags ? `｜${tags}` : ''}${reason ? `｜理由：${reason}` : ''}`;
}

function openUniversity(item: any) {
  if (!hasUniversityDetail(item)) {
    askAboutSchool(item);
    return;
  }
  uni.navigateTo({ url: `/pages/universities/detail?id=${item.universityId}` });
}

function hasUniversityDetail(item: any) {
  const id = String(item?.universityId || '').trim();
  return Boolean(id && id !== 'null' && id !== 'undefined');
}

function cardMetaChips(item: any) {
  const chips = [
    ...(item.tags || []).filter((tag: string) => !schoolBaseChips(item).includes(tag)),
    item.batch || '批次待核',
  ].filter(Boolean);
  return [...new Set(chips)];
}

function schoolBaseChips(item: any) {
  const values = [
    item.type,
    item.level,
    ...(item.tags || []).filter((tag: string) => isSchoolBaseTag(tag, item)),
  ].filter(Boolean);
  return [...new Set(values)];
}

function isSchoolBaseTag(tag: string, item: any) {
  const value = String(tag || '');
  return value === item.type ||
    value === item.level ||
    /^(本科|专科|高职|普通本科|专科（高职）)$/.test(value) ||
    /^(综合|理工|师范|财经|政法|医药|农业|林业|语言|艺术|体育|民族|军事)$/.test(value);
}

function visiblePreferenceTags(item: any) {
  return (item.preferenceTags || []).filter((tag: string) => !isLocationPreferenceTag(tag));
}

function visibleWarningTags(item: any) {
  return item.warningTags || [];
}

function isLocationPreferenceTag(tag = '') {
  return /^目标(?:省份|城市)：/.test(String(tag));
}

function locationMatchTexts(item: any) {
  const tags = (item.preferenceTags || [])
    .filter((tag: string) => isLocationPreferenceTag(tag))
    .map((tag: string) => String(tag).split('：')[1])
    .filter(Boolean);
  return [...new Set(tags)];
}

function locationParts(item: any) {
  const matches = locationMatchTexts(item);
  return [item.city, item.province]
    .filter(Boolean)
    .map((text: string) => ({
      text,
      matched: matches.some(match => text.includes(match) || match.includes(text)),
    }));
}

function schoolInfoParts(item: any) {
  return [...locationParts(item).map(part => part.text), ...schoolBaseChips(item)];
}

function optionLines(item: any, bucket?: string) {
  const lines = Array.isArray(item.optionLines) && item.optionLines.length
    ? item.optionLines
    : [candidateToOptionLine(item, bucket)];
  return lines.filter((line: any) => line?.title || line?.minScore || line?.minRank);
}

function candidateToOptionLine(item: any, bucket?: string) {
  return {
    title: item.majorName || '院校录取线',
    bucket: item.bucket || bucket,
    lineType: item.lineType || null,
    groupCode: item.groupCode || null,
    groupName: item.groupName || null,
    subjectRequirement: item.subjectRequirement || null,
    year: item.year,
    batch: item.batch,
    subjectType: item.subjectType,
    majorName: item.majorName,
    minScore: item.minScore,
    minRank: item.minRank,
    avgScore: item.avgScore,
    planCount: item.planCount,
    preferenceTags: item.preferenceTags || [],
    warningTags: item.warningTags || [],
    reason: item.reason || '',
  };
}

function optionLineKey(line: any, index: number) {
  return [index, line.title, line.year, line.minScore, line.minRank].filter(Boolean).join('-');
}

function optionLineTitle(line: any, index: number) {
  const title = line.title || line.majorName || line.groupName || (line.groupCode ? `专业组${line.groupCode}` : '');
  return title || `录取线 ${index + 1}`;
}

function optionLineType(line: any) {
  if (line.groupCode) return `专业组${line.groupCode}`;
  if (line.groupName && line.groupName !== line.title) return line.groupName;
  if (line.majorName) return '专业线';
  return '院校线';
}

function bucketLabel(bucket: string) {
  if (bucket === 'rush') return '冲刺';
  if (bucket === 'safe') return '保底';
  return '稳妥';
}

function buildDisplayRecommendationGroups(recommendations: any) {
  const map = new Map<string, any>();
  (['rush', 'stable', 'safe'] as const).forEach(bucket => {
    for (const item of recommendations[bucket] || []) {
      const key = item.universityId || item.universityName;
      const existing = map.get(key);
      const lines = optionLines(item, bucket).map((line: any) => ({
        ...line,
        bucket: line.bucket || bucket,
      }));
      if (!existing) {
        map.set(key, Object.assign({}, item, {
          bucket,
          preferenceTags: [...new Set(item.preferenceTags || [])],
          warningTags: [...new Set(item.warningTags || [])],
          optionLines: lines,
        }));
        continue;
      }
      existing.preferenceTags = [...new Set([...(existing.preferenceTags || []), ...(item.preferenceTags || [])])];
      existing.warningTags = [...new Set([...(existing.warningTags || []), ...(item.warningTags || [])])];
      existing.optionLines = mergeOptionLines(existing.optionLines || [], lines);
      existing.bucket = chooseDisplayBucket(existing.optionLines, existing.bucket);
    }
  });

  const grouped: Record<string, any[]> = { rush: [], stable: [], safe: [] };
  for (const item of map.values()) {
    const bucket = chooseDisplayBucket(item.optionLines || [], item.bucket);
    grouped[bucket].push(item);
  }
  return grouped;
}

function chooseDisplayBucket(lines: any[] = [], fallback = 'stable') {
  const counts: Record<string, number> = { rush: 0, stable: 0, safe: 0 };
  for (const line of lines) {
    if (line.bucket && counts[line.bucket] !== undefined) counts[line.bucket] += 1;
  }
  const best = ['stable', 'safe', 'rush']
    .map(bucket => ({ bucket, count: counts[bucket] }))
    .sort((a, b) => b.count - a.count)[0];
  return best?.count ? best.bucket : fallback;
}

function groupSameUniversity(items: any[]) {
  const map = new Map<string, any>();
  for (const item of items || []) {
    const key = item.universityId || item.universityName;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, Object.assign({}, item, {
        preferenceTags: [...new Set(item.preferenceTags || [])],
        warningTags: [...new Set(item.warningTags || [])],
        optionLines: optionLines(item),
      }));
      continue;
    }
    existing.preferenceTags = [...new Set([...(existing.preferenceTags || []), ...(item.preferenceTags || [])])];
    existing.warningTags = [...new Set([...(existing.warningTags || []), ...(item.warningTags || [])])];
    existing.optionLines = mergeOptionLines(existing.optionLines || [], optionLines(item));
  }
  return [...map.values()];
}

function mergeOptionLines(current: any[], incoming: any[]) {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const line of [...current, ...incoming]) {
    const key = [line.title, line.year, line.minScore, line.minRank, line.subjectRequirement].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

function displayReason(item: any) {
  return String(item?.reason || '')
    .replace(/匹配目标城市或省份：[^。]*。?/g, '')
    .trim();
}

onLoad((query: any) => {
  collapseAllGroups();
  loadReport(query?.id);
  loadExportCosts();
});

onShareAppMessage(() => {
  const id = currentReportId();
  const path = withShareRef(id ? `/pages/volunteer/report?id=${id}` : '/pages/volunteer/index');
  recordShare('friend', path);
  return {
    title: displayReportTitle.value || '涨识 志愿分析报告',
    path,
  };
});

onShareTimeline(() => {
  const id = currentReportId();
  const path = withShareRef(id ? `/pages/volunteer/report?id=${id}` : '/pages/volunteer/index');
  recordShare('timeline', path);
  return {
    title: displayReportTitle.value || '涨识 志愿分析报告',
    query: path.split('?')[1] || '',
  };
});
</script>

<style lang="scss" scoped>
.report-page {
  min-height: 100vh;
  padding: 24rpx $spacing-md 56rpx;
  background: linear-gradient(180deg, #f8fafc 0%, #f6f8f3 44%, #f8fafc 100%);
}

.summary-card,
.decision-card,
.section {
  @include card;
  padding: 26rpx;
  margin-bottom: $spacing-md;
  border-color: rgba(15, 23, 42, 0.06);
}

.summary-card {
  position: relative;
  border-color: rgba(111, 125, 74, 0.14);
  background: linear-gradient(135deg, #edf3e8 0%, #ffffff 58%, #fff7eb 100%);
  box-shadow: 0 14rpx 34rpx rgba(15, 23, 42, 0.05);
}

.report-tutorial-target {
  position: relative;
  z-index: 8891;
  border-radius: 20rpx;
  box-shadow: 0 0 0 6rpx rgba(20, 184, 166, 0.24), 0 0 0 16rpx rgba(20, 184, 166, 0.08), 0 18rpx 42rpx rgba(15, 23, 42, 0.20);
  animation: reportTutorialGlow 1.08s ease-in-out infinite;
}

.report-tutorial-target::before {
  content: "";
  position: absolute;
  inset: -10rpx;
  border: 3rpx solid rgba(20, 184, 166, 0.82);
  border-radius: 24rpx;
  pointer-events: none;
  animation: reportTutorialBorder 1.08s ease-in-out infinite;
}

.tab.report-tutorial-target,
.school-ask-btn.report-tutorial-target,
.primary-btn.report-tutorial-target {
  z-index: 8891;
}

.decision-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10rpx;
  padding: 16rpx;
  background: #fff;
}

.decision-item {
  min-width: 0;
  padding: 16rpx 12rpx;
  border-radius: 18rpx;
  background: #f8fafc;
}

.decision-label {
  display: block;
  color: $text-tertiary;
  font-size: $font-xs;
  margin-bottom: 6rpx;
}

.decision-value {
  display: block;
  color: $text-primary;
  font-size: $font-sm;
  font-weight: 800;
}

.eyebrow {
  display: block;
  color: #0f766e;
  font-size: $font-xs;
  font-weight: 700;
  margin-bottom: $spacing-xs;
}

.title {
  display: block;
  flex: 1;
  min-width: 0;
  color: $text-primary;
  font-size: 40rpx;
  font-weight: 800;
  margin-bottom: $spacing-xs;
  line-height: 1.2;
  word-break: break-all;
}

.title-row {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  margin-bottom: $spacing-xs;
}

.title-edit {
  flex-shrink: 0;
  margin-top: 4rpx;
  padding: 7rpx 16rpx;
  border-radius: $radius-full;
  background: #eef4e8;
  color: #60723f;
  border: 1rpx solid rgba(111, 125, 74, 0.22);
  font-size: 22rpx;
  font-weight: 800;
}

.summary {
  display: block;
  color: $text-secondary;
  font-size: $font-sm;
  line-height: 1.6;
}

.summary-actions {
  display: flex;
  align-items: center;
  margin-top: 20rpx;
}

.favorite-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
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

.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6rpx;
  padding: 6rpx;
  margin-bottom: $spacing-md;
  border: 1rpx solid $border-light;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.82);
}

.report-tutorial-mask {
  position: fixed;
  inset: 0;
  z-index: 8888;
  background: rgba(15, 23, 42, 0.46);
}

.report-tutorial-card {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  z-index: 8892;
  padding: 24rpx;
  box-sizing: border-box;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.98);
  border: 1rpx solid rgba(15, 118, 110, 0.18);
  box-shadow: 0 28rpx 72rpx rgba(15, 23, 42, 0.22);
}

.report-tutorial-card.top {
  top: calc(24rpx + env(safe-area-inset-top));
  bottom: auto;
}

.report-tutorial-card.bottom {
  top: auto;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.report-tutorial-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.report-tutorial-kicker {
  color: #0f766e;
  font-size: 22rpx;
  font-weight: 900;
}

.report-tutorial-close {
  width: 48rpx;
  height: 48rpx;
  color: #94a3b8;
  font-size: 44rpx;
  line-height: 42rpx;
  text-align: center;
}

.report-tutorial-title {
  display: block;
  margin-top: 4rpx;
  color: $text-primary;
  font-size: 32rpx;
  font-weight: 900;
  line-height: 1.24;
}

.report-tutorial-desc {
  display: block;
  margin-top: 10rpx;
  color: $text-secondary;
  font-size: 25rpx;
  line-height: 1.42;
}

.report-tutorial-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 18rpx;
}

.report-tutorial-skip,
.report-tutorial-link,
.report-tutorial-primary {
  padding: 12rpx 22rpx;
  border-radius: $radius-full;
  font-size: 25rpx;
  font-weight: 900;
}

.report-tutorial-skip {
  color: #64748b;
}

.report-tutorial-link {
  margin-left: auto;
  background: #eef4e8;
  color: #0f766e;
}

.report-tutorial-primary {
  background: #0f766e;
  color: #fff;
}

.report-tutorial-dots {
  display: flex;
  gap: 8rpx;
  margin-top: 16rpx;
}

.report-tutorial-dots text {
  width: 26rpx;
  height: 7rpx;
  border-radius: $radius-full;
  background: #e2e8f0;
}

.report-tutorial-dots text.active {
  width: 48rpx;
  background: #0f766e;
}

.report-tutorial-nav-target {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(14rpx + env(safe-area-inset-bottom));
  z-index: 8891;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  padding: 14rpx;
  box-sizing: border-box;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.98);
  border: 1rpx solid rgba(15, 118, 110, 0.18);
}

.report-tutorial-nav-item {
  padding: 16rpx 14rpx;
  border-radius: 18rpx;
  background: #f8fafc;
  text-align: center;
}

.report-tutorial-nav-item.ai {
  background: #f5f3ff;
}

.report-tutorial-nav-item.knowledge {
  background: #ecfdf5;
}

.nav-item-title {
  display: block;
  color: $text-primary;
  font-size: 25rpx;
  font-weight: 900;
}

.nav-item-desc {
  display: block;
  margin-top: 4rpx;
  color: $text-tertiary;
  font-size: 20rpx;
  line-height: 1.3;
}

.tab {
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  border-radius: 18rpx;
  background: transparent;
  border: 1rpx solid transparent;
  color: $text-secondary;
  font-size: $font-sm;
}

.tab.active {
  background: #eef4e8;
  border-color: rgba(111, 125, 74, 0.22);
  color: #60723f;
  font-weight: 700;
  box-shadow: 0 8rpx 18rpx rgba(111, 125, 74, 0.10);
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: $spacing-sm;
}

.section-head.foldable {
  min-height: 54rpx;
}

.section-action {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.section-title {
  color: $text-primary;
  font-size: $font-lg;
  font-weight: 800;
}

.section-count,
.empty {
  color: $text-tertiary;
  font-size: $font-xs;
}

.fold-arrow {
  color: #60723f;
  font-size: $font-xs;
  font-weight: 700;
}

.result-section {
  border-left: 8rpx solid transparent;
}

.result-section.rush {
  background: #fffafb;
  border-left-color: #d97961;
}

.result-section.stable {
  background: #fffaf0;
  border-left-color: #d6a85c;
}

.result-section.safe {
  background: #f7fefb;
  border-left-color: #789262;
}

.school-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.school-card {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 20rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.78);
}

.school-card.rush {
  border-color: rgba(217, 121, 97, 0.18);
}

.school-card.stable {
  border-color: rgba(214, 168, 92, 0.20);
}

.school-card.safe {
  border-color: rgba(120, 146, 98, 0.18);
}

.school-card.no-detail {
  background: rgba(255, 255, 255, 0.64);
}

.school-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  min-width: 0;
}

.school-top > view {
  flex: 1;
  min-width: 0;
}

.school-name {
  display: block;
  overflow: hidden;
  color: $text-primary;
  font-size: 31rpx;
  font-weight: 800;
  line-height: 1.32;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-all;
}

.school-location {
  display: block;
  margin-top: 4rpx;
  color: $text-tertiary;
  font-size: 22rpx;
  line-height: 1.35;
}

.school-location-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14rpx;
  margin-top: 6rpx;
}

.location-parts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx;
}

.school-location-part {
  color: $text-tertiary;
  font-size: 22rpx;
  line-height: 1.35;
}

.school-location-part:not(:last-child)::after {
  content: " ·";
  color: #cbd5e1;
}

.school-location-part.matched {
  padding: 2rpx 10rpx;
  border-radius: 999rpx;
  background: #ecfdf5;
  color: #047857;
  font-weight: 800;
}

.school-location-part.matched::after {
  content: "";
}

.school-info-chip {
  color: $text-secondary;
  font-size: 22rpx;
  line-height: 1.35;
  font-weight: 700;
}

.school-arrow {
  flex-shrink: 0;
  color: #94a3b8;
  font-size: 44rpx;
  line-height: 1;
}

.school-arrow.muted {
  padding-top: 4rpx;
  color: #c08457;
  font-size: 22rpx;
  font-weight: 800;
}

.reason {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  color: $text-secondary;
  font-size: $font-sm;
  margin-top: 6rpx;
  line-height: 1.5;
  word-break: break-all;
}

.school-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 14rpx;
}

.school-ask-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 174rpx;
  height: 54rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
  border-radius: 14rpx;
  background: linear-gradient(135deg, #0f766e 0%, #7c3aed 100%);
  color: #fff;
  font-size: 23rpx;
  font-weight: 900;
  box-shadow: 0 10rpx 22rpx rgba(15, 118, 110, 0.18);
}

.reason {
  -webkit-line-clamp: 2;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx;
  margin-top: 12rpx;
}

.meta-chip {
  max-width: 100%;
  padding: 5rpx 10rpx;
  border-radius: $radius-full;
  background: rgba(111, 125, 74, 0.10);
  color: #60723f;
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-chip,
.warn-chip {
  padding: 5rpx 10rpx;
  border-radius: $radius-full;
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1.35;
}

.match-chip {
  background: #ecfdf5;
  color: #047857;
}

.warn-chip {
  background: #fff7ed;
  color: #c2410c;
}

.option-lines {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 14rpx;
}

.option-line {
  padding: 14rpx;
  border-radius: 14rpx;
  background: #f8fafc;
  border: 1rpx solid rgba(148, 163, 184, 0.18);
}

.option-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-bottom: 10rpx;
}

.option-title {
  flex: 1;
  min-width: 0;
  color: $text-primary;
  font-size: 25rpx;
  font-weight: 800;
  line-height: 1.35;
  word-break: break-word;
}

.option-type {
  flex-shrink: 0;
  max-width: 220rpx;
  padding: 5rpx 10rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-type.tone-0 {
  background: #eff6ff;
  color: #2563eb;
}

.option-type.tone-1 {
  background: #fff7ed;
  color: #c2410c;
}

.option-type.tone-2 {
  background: #f5f3ff;
  color: #7c3aed;
}

.option-type.tone-3 {
  background: #ecfdf5;
  color: #047857;
}

.option-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.option-chip {
  max-width: 100%;
  padding: 5rpx 10rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-chip.score {
  background: #fef2f2;
  color: #dc2626;
}

.option-chip.rank {
  background: #fff7ed;
  color: #d97706;
}

.option-chip.year,
.option-chip.subject {
  background: rgba(111, 125, 74, 0.10);
  color: #60723f;
}

.option-chip.match {
  background: #ecfdf5;
  color: #047857;
}

.option-chip.warn {
  background: #fef3c7;
  color: #b45309;
}

.option-chip.bucket.rush {
  background: #fff1f2;
  color: #be123c;
}

.option-chip.bucket.stable {
  background: #fffbeb;
  color: #b45309;
}

.option-chip.bucket.safe {
  background: #f0fdf4;
  color: #15803d;
}

.more-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: center;
  margin-top: 18rpx;
}

.more-btn,
.less-btn {
  min-width: 180rpx;
  height: 64rpx;
  padding: 0 18rpx;
  border-radius: 16rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-xs;
  font-weight: 700;
}

.more-btn {
  background: #eef4e8;
  color: #60723f;
  border: 1rpx solid rgba(111, 125, 74, 0.20);
}

.more-btn.loading {
  opacity: 0.68;
}

.less-btn {
  background: #fff;
  color: $text-tertiary;
  border: 1rpx solid rgba(15, 23, 42, 0.08);
}

.bullet {
  color: $text-secondary;
  font-size: $font-sm;
  line-height: 1.6;
  margin-top: $spacing-xs;
}

.reference {
  padding: $spacing-sm 0;
  border-top: 1rpx solid $border-light;
  display: flex;
  justify-content: space-between;
  gap: $spacing-md;
}

.reference-title {
  flex: 1;
  color: $text-primary;
  font-size: $font-sm;
}

.reference-source {
  flex-shrink: 0;
  color: $text-tertiary;
  font-size: $font-xs;
}

.bullet::before {
  content: "• ";
  color: $warning;
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-sm;
  margin-bottom: $spacing-lg;
}

.primary-btn,
.secondary-btn {
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  border-radius: 20rpx;
  font-size: $font-sm;
  font-weight: 700;
}

.primary-btn {
  background: linear-gradient(135deg, #6f7d4a 0%, #5f8a70 58%, #c77d57 100%);
  color: #fff;
  box-shadow: 0 12rpx 24rpx rgba(95, 138, 112, 0.16);
}

.secondary-btn {
  background: $bg-card;
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  color: $text-secondary;
}

.complete-report {
  padding-bottom: $spacing-md;
}

.report-cover {
  position: relative;
  overflow: hidden;
  padding: 34rpx;
  margin-bottom: $spacing-md;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #405136 0%, #4d7569 56%, #bf744d 100%);
  box-shadow: 0 20rpx 42rpx rgba(64, 81, 54, 0.18);
}

.report-cover::after {
  content: "";
  position: absolute;
  right: -90rpx;
  bottom: -120rpx;
  width: 260rpx;
  height: 260rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(255, 255, 255, 0.18);
}

.cover-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 44rpx;
}

.cover-brand,
.cover-date {
  color: rgba(255, 255, 255, 0.84);
  font-size: 22rpx;
  font-weight: 800;
}

.cover-title {
  position: relative;
  z-index: 1;
  display: block;
  color: #fff;
  font-size: 46rpx;
  font-weight: 900;
  line-height: 1.18;
  letter-spacing: 0;
}

.cover-summary {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 18rpx;
  color: rgba(255, 255, 255, 0.88);
  font-size: 26rpx;
  line-height: 1.65;
}

.cover-tags {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 30rpx;
}

.cover-tag {
  padding: 9rpx 16rpx;
  border-radius: $radius-full;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 21rpx;
  font-weight: 800;
}

.download-panel {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx;
  margin-bottom: $spacing-md;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  border-radius: 22rpx;
  background: #fff;
  box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.04);
}

.download-copy {
  flex: 1;
  min-width: 0;
}

.download-title {
  display: block;
  color: $text-primary;
  font-size: $font-md;
  font-weight: 900;
  line-height: 1.35;
}

.download-subtitle {
  display: block;
  margin-top: 6rpx;
  color: $text-tertiary;
  font-size: 22rpx;
  line-height: 1.45;
}

.download-actions {
  display: flex;
  gap: 10rpx;
  flex-shrink: 0;
}

.download-btn {
  min-width: 88rpx;
  height: 64rpx;
  padding: 0 16rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.download-btn.pdf {
  color: #fff;
  background: #4f6f63;
}

.download-btn.image {
  color: #7a4b28;
  background: #fff3e8;
  border: 1rpx solid rgba(191, 116, 77, 0.18);
}

.download-btn.disabled {
  opacity: 0.62;
}

.report-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-bottom: $spacing-md;
}

.metric-tile {
  min-width: 0;
  padding: 20rpx;
  border-radius: 20rpx;
  background: #fff;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
}

.metric-label {
  display: block;
  color: $text-tertiary;
  font-size: 22rpx;
  margin-bottom: 8rpx;
}

.metric-value {
  display: block;
  color: $text-primary;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.25;
  word-break: break-word;
}

.report-section {
  @include card;
  padding: 26rpx;
  margin-bottom: $spacing-md;
  border-color: rgba(15, 23, 42, 0.06);
  background: rgba(255, 255, 255, 0.92);
}

.report-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 20rpx;
}

.report-section-title {
  color: $text-primary;
  font-size: $font-lg;
  font-weight: 900;
  line-height: 1.3;
}

.report-section-note {
  flex-shrink: 0;
  max-width: 260rpx;
  color: $text-tertiary;
  font-size: 21rpx;
  line-height: 1.35;
  text-align: right;
}

.plan-grid {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.plan-card {
  padding: 20rpx;
  border-radius: 20rpx;
  border: 1rpx solid transparent;
}

.plan-card.rush {
  background: #fff7f5;
  border-color: rgba(217, 121, 97, 0.18);
}

.plan-card.stable {
  background: #fffbeb;
  border-color: rgba(214, 168, 92, 0.20);
}

.plan-card.safe {
  background: #f2fbf6;
  border-color: rgba(120, 146, 98, 0.18);
}

.plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.plan-title {
  color: $text-primary;
  font-size: 30rpx;
  font-weight: 900;
}

.plan-count {
  color: $text-tertiary;
  font-size: 22rpx;
  font-weight: 800;
}

.plan-desc {
  display: block;
  margin-top: 8rpx;
  color: $text-secondary;
  font-size: 23rpx;
  line-height: 1.45;
}

.plan-school {
  padding: 14rpx 0 0;
}

.plan-school-name {
  display: block;
  color: $text-primary;
  font-size: 26rpx;
  font-weight: 900;
  line-height: 1.35;
}

.plan-school-meta {
  display: block;
  margin-top: 4rpx;
  color: $text-tertiary;
  font-size: 21rpx;
  line-height: 1.35;
}

.preference-list {
  border-radius: 18rpx;
  overflow: hidden;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
}

.preference-row {
  display: flex;
  gap: 18rpx;
  padding: 18rpx;
  background: #fff;
  border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
}

.preference-row:last-child {
  border-bottom: 0;
}

.preference-label {
  width: 150rpx;
  flex-shrink: 0;
  color: $text-tertiary;
  font-size: 22rpx;
  line-height: 1.45;
}

.preference-value {
  flex: 1;
  min-width: 0;
  color: $text-primary;
  font-size: 25rpx;
  font-weight: 750;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.two-columns {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16rpx;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.mini-report-card {
  padding: 24rpx;
  border-radius: 22rpx;
  background: #fff;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  box-shadow: 0 8rpx 20rpx rgba(15, 23, 42, 0.035);
}

.mini-title {
  display: block;
  margin-bottom: 14rpx;
  color: $text-primary;
  font-size: $font-md;
  font-weight: 900;
}

.report-bullet,
.risk-item {
  position: relative;
  padding-left: 26rpx;
  color: $text-secondary;
  font-size: $font-sm;
  line-height: 1.68;
  margin-top: 10rpx;
}

.report-bullet::before,
.risk-item::before {
  content: "";
  position: absolute;
  left: 2rpx;
  top: 18rpx;
  width: 9rpx;
  height: 9rpx;
  border-radius: 50%;
  background: #bf744d;
}

.risk-list {
  display: flex;
  flex-direction: column;
}

.report-empty {
  color: $text-tertiary;
  font-size: $font-sm;
  line-height: 1.6;
}

.detail-section {
  background: #fff;
}

.analysis-block {
  padding: 22rpx 0;
  border-top: 1rpx solid rgba(15, 23, 42, 0.06);
}

.analysis-block:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.analysis-title {
  display: block;
  color: $text-primary;
  font-size: $font-md;
  font-weight: 900;
  margin-bottom: 12rpx;
  line-height: 1.35;
}

.analysis-content {
  display: block;
  white-space: pre-wrap;
  color: $text-secondary;
  font-size: $font-sm;
  line-height: 1.75;
  word-break: break-word;
}

@keyframes reportTutorialGlow {
  0%,
  100% {
    box-shadow: 0 0 0 6rpx rgba(20, 184, 166, 0.24), 0 0 0 16rpx rgba(20, 184, 166, 0.08), 0 18rpx 42rpx rgba(15, 23, 42, 0.20);
  }
  50% {
    box-shadow: 0 0 0 8rpx rgba(250, 204, 21, 0.52), 0 0 0 20rpx rgba(20, 184, 166, 0.14), 0 24rpx 54rpx rgba(15, 23, 42, 0.24);
  }
}

@keyframes reportTutorialBorder {
  0%,
  100% {
    border-color: rgba(20, 184, 166, 0.72);
    opacity: 0.74;
    transform: scale(1);
  }
  50% {
    border-color: rgba(250, 204, 21, 0.98);
    opacity: 1;
    transform: scale(1.022);
  }
}
</style>
