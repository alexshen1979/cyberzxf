<template>
  <view class="report-page">
    <view class="summary-card">
      <text class="eyebrow">AI 志愿分析报告</text>
      <text class="title">{{ reportTitle }}</text>
      <text class="summary">{{ data?.summary || result?.summary || '正在加载报告...' }}</text>
    </view>

    <view class="decision-card">
      <view class="decision-item">
        <text class="decision-label">定位原则</text>
        <text class="decision-value">位次优先</text>
      </view>
      <view class="decision-item">
        <text class="decision-label">推荐依据</text>
        <text class="decision-value">历年录取线</text>
      </view>
      <view class="decision-item">
        <text class="decision-label">风险检查</text>
        <text class="decision-value">调剂/选科/体检</text>
      </view>
    </view>

    <view class="tabs">
      <text class="tab" :class="{ active: activeTab === 'cards' }" @click="activeTab = 'cards'">冲稳保</text>
      <text class="tab" :class="{ active: activeTab === 'report' }" @click="activeTab = 'report'">完整报告</text>
    </view>

    <view v-if="activeTab === 'cards'">
      <view class="section result-section" :class="group.key" v-for="group in groups" :key="group.key">
        <view class="section-head foldable" @click="toggleGroup(group.key)">
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
              :class="group.key"
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
                <text class="school-arrow">›</text>
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
        <view class="primary-btn" @click="askFollowup">继续追问</view>
      </view>
    </view>

    <view v-else class="report-chat">
      <view class="report-message" v-for="block in reportBlocks" :key="block.title">
        <view class="report-avatar">AI</view>
        <view class="report-bubble">
          <text class="report-block-title">{{ block.title }}</text>
          <text class="report-block-content">{{ block.content }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '@/api';
import { useUserStore } from '@/store/user';

const userStore = useUserStore();
const activeTab = ref<'cards' | 'report'>('cards');
const data = ref<any>(null);
const collapsedGroups = ref<Record<string, boolean>>({});
const groupDisplayLimits = ref<Record<string, number>>({});
const loadingMoreGroup = ref('');
const initialGroupLimit = 12;
const loadMoreStep = 12;
const result = computed(() => data.value?.result || data.value);
const markdownReport = computed(() => data.value?.markdownReport || '');
const PUBLIC_FIGURE_TERM = ['张', '雪', '峰'].join('');
const FIXED_NOTICE_TITLE = ['免', '责', '声', '明'].join('');

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
  return `${source.province} ${source.subjectType || ''} ${source.score || ''}分`;
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

function toggleGroup(key: string) {
  collapsedGroups.value = Object.assign({}, collapsedGroups.value, {
    [key]: !collapsedGroups.value[key],
  });
}

function isGroupCollapsed(key: string) {
  return Boolean(collapsedGroups.value[key]);
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
    if (latest.input || !id) return;
  }
  if (!id) return;

  try {
    const res = await api.volunteer.detail(id);
    data.value = res.data;
    uni.setStorageSync('latest_volunteer_report', res.data);
  } catch (err: any) {
    uni.showToast({ title: err?.message || '报告加载失败', icon: 'none' });
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
报告：${reportTitle.value}
结论：${result.value?.summary || ''}
候选院校：${brief || '暂无足够候选'}
我想继续比较院校、专业组风险、调剂风险和最终排序。`;
  userStore.consultQuestion = text;
  userStore.consultType = 'gaokao';
  userStore.pendingConsult = true;
  uni.switchTab({ url: '/pages/consult/index' });
}

function openUniversity(item: any) {
  if (!item?.universityId) {
    uni.showToast({ title: '该院校暂缺详情', icon: 'none' });
    return;
  }
  uni.navigateTo({ url: `/pages/universities/detail?id=${item.universityId}` });
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
  loadReport(query?.id);
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
  border-color: rgba(111, 125, 74, 0.14);
  background: linear-gradient(135deg, #edf3e8 0%, #ffffff 58%, #fff7eb 100%);
  box-shadow: 0 14rpx 34rpx rgba(15, 23, 42, 0.05);
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
  color: $text-primary;
  font-size: 40rpx;
  font-weight: 800;
  margin-bottom: $spacing-xs;
  line-height: 1.2;
}

.summary {
  color: $text-secondary;
  font-size: $font-sm;
  line-height: 1.6;
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

.report-chat {
  padding-bottom: $spacing-md;
}

.report-message {
  display: flex;
  gap: 14rpx;
  margin-bottom: $spacing-md;
}

.report-avatar {
  width: 54rpx;
  height: 54rpx;
  flex-shrink: 0;
  border-radius: 16rpx;
  background: #ecfdf5;
  color: #0f766e;
  font-size: 20rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.report-bubble {
  flex: 1;
  min-width: 0;
  padding: 22rpx;
  border-radius: 22rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
  background: #fff;
  box-shadow: 0 8rpx 20rpx rgba(15, 23, 42, 0.04);
}

.report-block-title {
  display: block;
  color: $text-primary;
  font-size: $font-md;
  font-weight: 800;
  margin-bottom: 10rpx;
}

.report-block-content {
  display: block;
  white-space: pre-wrap;
  color: $text-secondary;
  font-size: $font-sm;
  line-height: 1.7;
}
</style>
