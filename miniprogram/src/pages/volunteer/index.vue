<template>
  <view class="volunteer-page">
    <view class="hero">
      <view class="hero-top">
        <text class="eyebrow">模拟报志愿</text>
        <view class="points-pill" @click="handlePointsPill">
          <text>{{ pointsPillText }}</text>
        </view>
      </view>
      <text class="title">拉平信息差，拒绝迷茫，多些清晰</text>
      <text class="hero-desc">输入成绩与位次，先把范围和风险看清楚。</text>
      <view class="guide-entry" @click="openTutorial(true)">
        <text class="guide-entry-main">不想自己摸索？跟着 6 步快速上手</text>
        <text class="guide-entry-action">查看教程</text>
      </view>
    </view>

    <view class="intro-overlay" v-if="introOpen" @touchmove.stop.prevent>
      <view class="intro-shell">
        <view class="intro-topbar">
          <view>
            <text class="intro-kicker">先别急着填表</text>
            <text class="intro-subkicker">先用 4 张画面，感受这份报告会怎么帮你把焦虑变清楚。</text>
          </view>
          <text class="intro-skip" @click="finishIntroSlides">跳过</text>
        </view>

        <swiper class="intro-swiper" :current="introCurrent" @change="handleIntroSlideChange">
          <swiper-item>
            <view class="intro-slide hero">
              <text class="intro-slide-eyebrow">第 1 幕</text>
              <text class="intro-slide-title">{{ introProvince }} {{ introSampleScore }} 分，先别被想象吓住</text>
              <text class="intro-slide-desc">{{ introEmotionLead }}</text>
              <view class="intro-score-band">
                <text class="intro-score-value">{{ introSampleScore }}</text>
                <view class="intro-score-copy">
                  <text>{{ introProvince }}考生视角</text>
                  <text>{{ introSubjectType }} · {{ introTargetBatch }}</text>
                </view>
              </view>
              <view class="intro-school-pills" v-if="introSchoolNames.length">
                <text class="intro-pill" v-for="name in introSchoolNames" :key="name">{{ name }}</text>
              </view>
              <view class="intro-empty-note" v-else-if="introLoading">
                正在按你的省份拉取同分段候选学校...
              </view>
              <text class="intro-emotion-line">很多时候压垮人的，不是分数本身，而是不知道这个分数还有没有路。</text>
            </view>
          </swiper-item>

          <swiper-item>
            <view class="intro-slide schools">
              <text class="intro-slide-eyebrow">第 2 幕</text>
              <text class="intro-slide-title">学校不是一团雾，我们会先把它们排成队</text>
              <text class="intro-slide-desc">先拆成冲、稳、保，再把城市、层次和风险一起展开给你看。</text>
              <view class="intro-school-cards" v-if="introSchools.length">
                <view class="intro-school-card" v-for="item in introSchools" :key="`${item.universityName}-${item.bucket}`">
                  <view class="intro-school-head">
                    <text class="intro-school-name">{{ item.universityName }}</text>
                    <text class="intro-school-bucket" :class="item.bucket">{{ introBucketLabel(item.bucket) }}</text>
                  </view>
                  <text class="intro-school-meta">{{ introSchoolMeta(item) }}</text>
                  <text class="intro-school-reason">{{ introSchoolReason(item) }}</text>
                </view>
              </view>
              <view class="intro-empty-note" v-else>
                {{ introLoading ? '正在整理院校候选...' : '系统会先帮你筛出最值得认真看的学校。' }}
              </view>
            </view>
          </swiper-item>

          <swiper-item>
            <view class="intro-slide majors">
              <text class="intro-slide-eyebrow">第 3 幕</text>
              <text class="intro-slide-title">真正决定你以后怎么走的，常常不只是学校名字</text>
              <text class="intro-slide-desc">专业方向、城市机会、调剂风险，都会一起算，不让你只盯着一个校名。</text>
              <view class="intro-major-grid" v-if="introMajorHighlights.length">
                <view class="intro-major-chip" v-for="major in introMajorHighlights" :key="major">
                  <text>{{ major }}</text>
                </view>
              </view>
              <view class="intro-empty-note" v-else>
                {{ introLoading ? '正在整理同分段常见专业方向...' : '报告会把专业、城市和风险放在一起看。' }}
              </view>
              <view class="intro-major-note">
                <text>学校决定起点，专业影响路径，城市会放大你未来的选择空间。</text>
              </view>
            </view>
          </swiper-item>

          <swiper-item>
            <view class="intro-slide report">
              <text class="intro-slide-eyebrow">第 4 幕</text>
              <text class="intro-slide-title">最后给你的，不会是一张冷冰冰的学校名单</text>
              <text class="intro-slide-desc">{{ introReportSummary }}</text>
              <view class="intro-report-stats">
                <view class="intro-stat-card">
                  <text class="intro-stat-label">可冲击</text>
                  <text class="intro-stat-value">{{ introStats.rush }}</text>
                </view>
                <view class="intro-stat-card">
                  <text class="intro-stat-label">较稳妥</text>
                  <text class="intro-stat-value">{{ introStats.stable }}</text>
                </view>
                <view class="intro-stat-card">
                  <text class="intro-stat-label">可保底</text>
                  <text class="intro-stat-value">{{ introStats.safe }}</text>
                </view>
              </view>
              <view class="intro-report-list">
                <text>冲稳保结构一眼看清</text>
                <text>专业和城市建议一起给</text>
                <text>调剂、选科、退档风险提前提醒</text>
                <text>完整报告还能保存、继续追问</text>
              </view>
            </view>
          </swiper-item>
        </swiper>

        <view class="intro-footer">
          <view class="intro-dots">
            <text v-for="index in introSlideCount" :key="index" :class="{ active: introCurrent === index - 1 }"></text>
          </view>
          <view class="intro-primary-btn" @click="nextIntroSlide">
            {{ introCurrent >= introSlideCount - 1 ? '开始填写' : '继续看' }}
          </view>
        </view>
      </view>
    </view>

    <view class="mock-card">
      <view class="form-step">
        <view class="step-row">
          <text class="step-badge">1</text>
          <text class="step-title">选择报考类型</text>
          <view class="step-spacer"></view>
          <view id="guide-category-target" class="category-switch" :class="tutorialTapTargetClass('category')">
            <view class="radio-option" :class="{ active: examCategory === 'normal' }" @click="setExamCategory('normal')">
              <text class="radio-dot"></text>
              <text>普通类</text>
            </view>
            <view class="radio-option" :class="{ active: examCategory === 'art' }" @click="setExamCategory('art')">
              <text class="radio-dot"></text>
              <text>艺术类</text>
            </view>
            <text v-if="tutorialFocusVisible('category')" class="tutorial-hit-label">{{ currentTutorialStep.hint }}</text>
          </view>
        </view>
      </view>

      <view class="form-step">
        <view class="step-row province-step-row" :class="tutorialTargetClass('province')">
          <text class="step-badge">2</text>
          <text class="step-title">确认高考省份</text>
          <view class="step-spacer"></view>
          <view id="guide-province-target" class="meta-pill" :class="tutorialTapTargetClass('province')" @click="provincePanelOpen = !provincePanelOpen">
            <text>{{ form.province || '选择省份' }}</text>
            <text v-if="tutorialFocusVisible('province')" class="tutorial-hit-label">{{ currentTutorialStep.hint }}</text>
          </view>
        </view>
        <text
          v-if="locationStatus"
          class="location-status"
          :class="locationStatusTone"
        >{{ locationStatus }}</text>

        <view class="province-tags" :class="{ 'tutorial-floating-options': tutorialFocusVisible('province') }" v-if="provincePanelOpen">
          <text
            v-for="item in provinceOptions"
            :key="item"
            class="province-tag"
            :class="{ active: form.province === item }"
            @click="selectProvince(item)"
          >{{ item }}</text>
        </view>
      </view>

      <view class="form-step">
        <view class="step-row">
          <text class="step-badge">3</text>
          <text class="step-title">{{ examCategory === 'art' ? '专业类别与科目' : '批次与选科' }}</text>
          <view class="step-spacer"></view>
          <view v-if="examCategory === 'normal'" class="category-switch compact">
            <view class="radio-option" :class="{ active: admissionLevel === '本科' }" @click="setAdmissionLevel('本科')">
              <text class="radio-dot"></text>
              <text>本科</text>
            </view>
            <view class="radio-option" :class="{ active: admissionLevel === '专科' }" @click="setAdmissionLevel('专科')">
              <text class="radio-dot"></text>
              <text>专科</text>
            </view>
          </view>
          <view v-else class="category-switch compact">
            <view class="radio-option" :class="{ active: artLevel === '本科' }" @click="setArtLevel('本科')">
              <text class="radio-dot"></text>
              <text>本科</text>
            </view>
            <view class="radio-option" :class="{ active: artLevel === '专科' }" @click="setArtLevel('专科')">
              <text class="radio-dot"></text>
              <text>专科</text>
            </view>
          </view>
        </view>

        <view v-if="examCategory === 'normal'" class="subject-area" :class="tutorialTargetClass('subjects')">
          <view
            v-if="selectionMode === 'six-three'"
            id="guide-subjects-target"
            class="subject-block"
            :class="tutorialTapTargetClass('subjects')"
          >
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
            <text v-if="tutorialFocusVisible('subjects')" class="tutorial-hit-label">{{ currentTutorialStep.hint }}</text>
          </view>

          <view
            v-else-if="selectionMode === 'two-one-four-two'"
            id="guide-subjects-target"
            class="subject-block split"
            :class="tutorialTapTargetClass('subjects')"
          >
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
            <text v-if="tutorialFocusVisible('subjects')" class="tutorial-hit-label">{{ currentTutorialStep.hint }}</text>
          </view>

          <view
            v-else
            id="guide-subjects-target"
            class="subject-block"
            :class="tutorialTapTargetClass('subjects')"
          >
            <view class="field-label-row">
              <text class="field-hint">按省份规则</text>
            </view>
            <view class="choice-row wrap">
              <view
                v-for="item in subjectOptions"
                :key="item"
                class="choice-chip"
                :class="{ active: form.subjectType === item }"
                @click="selectSubjectType(item)"
              >
                <text>{{ item }}</text>
              </view>
            </view>
            <text v-if="tutorialFocusVisible('subjects')" class="tutorial-hit-label">{{ currentTutorialStep.hint }}</text>
          </view>
        </view>

        <view v-else class="art-area" :class="tutorialTargetClass('subjects')">
          <view
            id="guide-subjects-target"
            class="field-label-row art-category-head"
            :class="tutorialTapTargetClass('subjects')"
          >
            <text class="field-label">专业类别</text>
            <view class="meta-pill art-category-pill" @click="artMajorPanelOpen = !artMajorPanelOpen">
              <text>{{ currentArtCategory }}</text>
            </view>
            <text v-if="tutorialFocusVisible('subjects')" class="tutorial-hit-label">{{ currentTutorialStep.hint }}</text>
          </view>
          <view class="province-tags art-category-tags" :class="{ 'tutorial-floating-options': tutorialFocusVisible('subjects') }" v-if="artMajorPanelOpen">
            <text
              v-for="(item, index) in artMajorOptions"
              :key="item"
              class="province-tag art-category-tag"
              :class="{ active: artMajorIndex === index }"
              @click="selectArtMajorByIndex(index)"
            >{{ item }}</text>
          </view>

          <view class="score-input full">
            <text class="input-mark">分</text>
            <input v-model.number="artScore" type="number" :placeholder="artScorePlaceholder" @input="handleArtScoreInput" />
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
                @click="selectSubjectType(item)"
              >
                <text>{{ item }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view class="form-step">
        <view class="step-row score-step-row">
          <text class="step-badge">4</text>
          <text class="step-title">填写成绩与位次</text>
        </view>
        <view v-if="examCategory === 'normal'" class="score-section" :class="tutorialTargetClass('score')">
          <view id="guide-score-target" class="input-grid" :class="tutorialTapTargetClass('score')">
            <view class="score-input">
              <text class="input-mark">分</text>
              <input v-model.number="form.score" type="number" :placeholder="cultureScorePlaceholder" @input="handleScoreInput" />
            </view>
            <view class="score-input">
              <text class="input-mark">位</text>
              <input v-model.number="form.rank" type="number" :placeholder="rankPlaceholder" @input="handleRankInput" />
            </view>
            <text v-if="tutorialFocusVisible('score')" class="tutorial-hit-label">{{ currentTutorialStep.hint }}</text>
          </view>
          <text class="rank-lookup-tip" :class="rankLookupState">{{ rankLookupMessage }}</text>
        </view>

        <view v-else class="score-section art-score-section" :class="tutorialTargetClass('score')">
          <view id="guide-score-target" class="score-input full" :class="tutorialTapTargetClass('score')">
            <text class="input-mark">分</text>
            <input v-model.number="form.score" type="number" :placeholder="cultureScorePlaceholder" @input="handleScoreInput" />
            <text v-if="tutorialFocusVisible('score')" class="tutorial-hit-label">{{ currentTutorialStep.hint }}</text>
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
            <text class="axis-right">{{ cultureScoreMax }}分</text>
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
      </view>

      <view class="form-step">
        <view
          id="guide-preference-target"
          class="preference-entry"
          @click="openAdvancedPreference"
        >
          <text class="step-badge">5</text>
          <view class="preference-copy">
            <text class="preference-title">设定偏好与风险 <text class="optional-mark">（非必填）</text></text>
            <text class="preference-desc">{{ preferenceSummary }}</text>
          </view>
          <text class="preference-arrow">›</text>
        </view>
      </view>

      <view class="form-step final-step">
        <view
          id="guide-submit-target"
          class="submit-main"
          :class="[{ disabled: loading || !form.score }, tutorialTargetClass('submit'), tutorialTapTargetClass('submit')]"
          @click="submit"
        >
          <text class="step-badge">6</text>
          <text>{{ loading ? '生成中...' : '开启智能推荐大学' }}</text>
          <text
            v-if="tutorialFocusVisible('submit')"
            class="tutorial-hit-label"
          >{{ submitTutorialHint }}</text>
        </view>
      </view>

      <view class="engagement-line" :class="engagementState">
        <text>{{ engagementInline }}</text>
      </view>
    </view>

    <view class="advanced-mask" v-if="advancedOpen" @click="closeAdvancedPreference">
      <view class="advanced-sheet" @click.stop>
        <view class="sheet-head">
          <view>
            <text class="sheet-title">偏好与风险</text>
            <text class="sheet-sub">不确定可以先跳过，报告仍可生成。</text>
          </view>
          <text class="sheet-close" @click="closeAdvancedPreference">完成</text>
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
              <text class="field-title">省份城市</text>
              <view class="tag-input-box" @click="focusPreferenceInput('city')">
                <text
                  v-for="item in selectedPreferenceItems('city')"
                  :key="`city-${item}`"
                  class="selected-chip"
                  @click.stop="removeSelected('city', item)"
                >{{ item }} ×</text>
                <input
                  class="tag-input"
                  v-model="cityKeyword"
                  :focus="focusedPreferenceInput === 'city'"
                  :placeholder="selectedPreferenceItems('city').length ? '' : '输入省份或城市关键字'"
                  @focus="focusedPreferenceInput = 'city'"
                  @input="scheduleRecommendationPreview"
                  @confirm="commitKeyword('city')"
                />
              </view>
              <view class="suggest-row" v-if="citySuggestions.length">
                <text
                  v-for="item in citySuggestions"
                  :key="item"
                  class="suggest-chip"
                  :class="{ active: isPreferenceSelected('city', item) }"
                  @click="chooseSuggestion('city', item)"
                >{{ item }}</text>
              </view>
            </view>

            <view class="suggest-field">
              <text class="field-title">偏好专业</text>
              <view class="tag-input-box" @click="focusPreferenceInput('preferredMajor')">
                <text
                  v-for="item in selectedPreferenceItems('preferredMajor')"
                  :key="`preferred-${item}`"
                  class="selected-chip"
                  @click.stop="removeSelected('preferredMajor', item)"
                >{{ item }} ×</text>
                <input
                  class="tag-input"
                  v-model="preferredMajorKeyword"
                  :focus="focusedPreferenceInput === 'preferredMajor'"
                  :placeholder="selectedPreferenceItems('preferredMajor').length ? '' : '输入专业关键字'"
                  @focus="focusedPreferenceInput = 'preferredMajor'"
                  @input="handleMajorInput('preferred')"
                  @confirm="commitKeyword('preferredMajor')"
                />
              </view>
              <view class="suggest-row" v-if="preferredMajorSuggestions.length">
                <text
                  v-for="item in preferredMajorSuggestions"
                  :key="item.name"
                  class="suggest-chip"
                  :class="{ active: isPreferenceSelected('preferredMajor', item.name) }"
                  @click="chooseSuggestion('preferredMajor', item.name)"
                >{{ item.name }}</text>
              </view>
            </view>

            <view class="suggest-field">
              <text class="field-title">避坑专业</text>
              <view class="tag-input-box" @click="focusPreferenceInput('avoidMajor')">
                <text
                  v-for="item in selectedPreferenceItems('avoidMajor')"
                  :key="`avoid-${item}`"
                  class="selected-chip danger"
                  @click.stop="removeSelected('avoidMajor', item)"
                >{{ item }} ×</text>
                <input
                  class="tag-input"
                  v-model="avoidMajorKeyword"
                  :focus="focusedPreferenceInput === 'avoidMajor'"
                  :placeholder="selectedPreferenceItems('avoidMajor').length ? '' : '输入避坑专业关键字'"
                  @focus="focusedPreferenceInput = 'avoidMajor'"
                  @input="handleMajorInput('avoid')"
                  @confirm="commitKeyword('avoidMajor')"
                />
              </view>
              <view class="suggest-row" v-if="avoidMajorSuggestions.length">
                <text
                  v-for="item in avoidMajorSuggestions"
                  :key="item.name"
                  class="suggest-chip danger"
                  :class="{ active: isPreferenceSelected('avoidMajor', item.name) }"
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
          <text class="report-main">{{ item.title || `${item.province} ${item.subjectType} ${item.score}分` }}</text>
          <text class="report-sub">{{ item.rank ? `位次 ${item.rank}` : '未填位次' }} · {{ formatDate(item.createdAt) }}</text>
          <text class="report-pref" v-if="reportPreferenceText(item)">偏好与风险：{{ reportPreferenceText(item) }}</text>
        </view>
      </view>
      <view v-else class="history-state">暂无近期方案，生成后会自动保存在这里</view>
    </view>

    <view class="tutorial-focus-mask" v-if="tutorialOpen && !advancedOpen" @click.stop></view>

    <view
      class="tutorial-card"
      :class="[tutorialCardPlacement, { 'near-target': currentTutorialStep.key === 'submit' }]"
      :style="tutorialCardStyle"
      v-if="tutorialOpen && !advancedOpen"
      @touchmove.stop
    >
      <view class="tutorial-head">
        <view class="tutorial-step-badge">
          <text>{{ tutorialStep + 1 }}</text>
        </view>
        <view class="tutorial-copy">
          <text class="tutorial-progress">{{ tutorialProgressText }}</text>
          <text class="tutorial-title">{{ currentTutorialStep.title }}</text>
          <text class="tutorial-desc">{{ currentTutorialStep.desc }}</text>
        </view>
        <text class="tutorial-close" @click="finishTutorial">×</text>
      </view>
      <view class="tutorial-dots">
        <text
          v-for="(_, index) in tutorialSteps"
          :key="index"
          :class="{ active: index === tutorialStep }"
        ></text>
      </view>
      <view class="tutorial-actions">
        <text class="tutorial-skip" @click="finishTutorial">跳过</text>
        <text class="tutorial-auto-note">按高亮处操作，将自动继续</text>
      </view>
    </view>

    <view class="analysis-overlay" v-if="loading" @touchmove.stop.prevent>
      <view class="analysis-panel">
        <view class="orbit-loader">
          <view class="orbit-ring ring-one"></view>
          <view class="orbit-ring ring-two"></view>
          <view class="orbit-core">
            <image class="orbit-logo" src="/static/images/brand-logo.png" mode="aspectFit" />
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
import { onShow, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app';
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { api } from '@/api';
import { useUserStore } from '@/store/user';
import { recordShare, withShareRef } from '@/utils/share';

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
const artMajorBackendMap: Record<string, string> = {
  '美术与设计类': '美术与设计类',
  '音乐类': '音乐类',
  '舞蹈类': '舞蹈类',
  '播音与主持类': '播音与主持类',
  '表（导）演类': '表（导）演类',
  '书法类': '书法类',
};
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
const introSlidesStorageKey = 'volunteer_home_intro_seen_v1';
const introScoreExamples: Record<string, number> = {
  北京: 561,
  上海: 501,
  江苏: 518,
  浙江: 592,
  山东: 546,
  广东: 534,
  河北: 531,
  福建: 521,
  湖北: 523,
  湖南: 512,
  河南: 548,
  四川: 531,
  安徽: 522,
  江西: 519,
  辽宁: 517,
  重庆: 512,
  广西: 505,
  贵州: 498,
};
const tutorialStorageKey = 'volunteer_home_tutorial_seen_v1';
const pendingSubmitAfterLoginStorageKey = 'volunteer_pending_submit_after_login';
const tutorialSteps = [
  {
    key: 'category',
    anchor: 'guide-category-target',
    title: '先选报考类型',
    desc: '点普通类或艺术类。大多数考生选普通类，统考生切到艺术类。',
    hint: '选完自动继续',
  },
  {
    key: 'province',
    anchor: 'guide-province-target',
    title: '确认高考省份',
    desc: '点右侧省份按钮确认考生参加高考的省份。定位不准时直接重新选择。',
    hint: '选中省份后继续',
  },
  {
    key: 'subjects',
    anchor: 'guide-subjects-target',
    title: '选本科专科和科目',
    desc: '点本科/专科和真实选科。3+1+2 省份先点物理/历史，再点两门次选。',
    hint: '选完整后继续',
  },
  {
    key: 'score',
    anchor: 'guide-score-target',
    title: '填分数，位次可自动查',
    desc: '点分数输入框，先填预估分也可以。能匹配一分一段时，位次会自动带出来。',
    hint: '填完自动继续',
  },
  {
    key: 'submit',
    anchor: 'guide-submit-target',
    title: '开启智能推荐',
    desc: '信息填好后点这里生成报告。也可以先设定偏好与风险，让推荐更贴近你。',
    hint: '点击开启智能推荐',
  },
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
const cityKeyword = ref('');
const preferredMajorKeyword = ref('');
const avoidMajorKeyword = ref('');
const focusedPreferenceInput = ref<'city' | 'preferredMajor' | 'avoidMajor' | ''>('');
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
const artMajorPanelOpen = ref(false);
const regionTree = ref<any[]>([]);
const locationStatus = ref('');
const locationStatusTone = ref<'muted' | 'success' | 'warning'>('muted');
const rankLookupLoading = ref(false);
const rankAutoFilled = ref(false);
const rankLookupTried = ref(false);
const rankManuallyEdited = ref(false);
const rankLookupMessage = ref('填写分数后自动匹配一分一段位次');
const recommendationPreview = ref<any>(null);
const recommendationPreviewLoading = ref(false);
const introOpen = ref(false);
const introCurrent = ref(0);
const introLoading = ref(false);
const introPreview = ref<any>(null);
const artSupport = ref<Array<{
  province: string;
  year: number;
  artCategory: string;
  batch: string;
  subjectType: string;
  cultureFullScore?: number;
  professionalFullScore?: number;
}>>([]);
const reportCost = ref(38);
const publicFreeGift = ref(100);
const provinceAutoLocated = ref(false);
const provinceLocationTried = ref(false);
const introAutoChecked = ref(false);
const tutorialOpen = ref(false);
const tutorialStep = ref(0);
const tutorialAutoChecked = ref(false);
const tutorialCardPlacement = ref<'top' | 'bottom'>('bottom');
const tutorialCardStyle = ref('');
let rankLookupTimer: ReturnType<typeof setTimeout> | null = null;
let rankLookupSeq = 0;
let recommendationPreviewTimer: ReturnType<typeof setTimeout> | null = null;
let recommendationPreviewSeq = 0;
let introPreviewSeq = 0;
let preferredMajorTimer: ReturnType<typeof setTimeout> | null = null;
let avoidMajorTimer: ReturnType<typeof setTimeout> | null = null;
let tutorialAutoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
let preferredMajorSeq = 0;
let avoidMajorSeq = 0;
let lastSubjectRequiredToastAt = 0;

const engagementState = computed(() => {
  if (!userStore.isLogin) return 'guest';
  return userStore.pointsBalance >= reportCost.value ? 'ready' : 'low-points';
});

const currentTutorialStep = computed(() => tutorialSteps[tutorialStep.value] || tutorialSteps[0]);

const tutorialProgressText = computed(() => `${tutorialStep.value + 1}/${tutorialSteps.length}`);

const submitTutorialHint = computed(() => '点击开启智能推荐');

const pointsPillText = computed(() => userStore.isLogin ? `${userStore.pointsBalance} 点` : `登录即送${publicFreeGift.value}点`);
const introSlideCount = 4;

const introProvince = computed(() => {
  const fromForm = normalizeProvinceName(form.province);
  const fromUser = normalizeProvinceName((userStore.userInfo as any)?.province);
  const fromCache = normalizeProvinceName(uni.getStorageSync(locatedProvinceStorageKey));
  return fromForm || fromUser || fromCache || '江苏';
});

const introSampleScore = computed(() => {
  const currentScore = Number(form.score);
  if (Number.isFinite(currentScore) && currentScore > 0) return currentScore;
  return introScoreExamples[introProvince.value] || 528;
});

const introSubjectType = computed(() => {
  if (comprehensiveProvinces.includes(introProvince.value)) return '综合改革';
  if (legacyProvinces.includes(introProvince.value)) return '理科';
  return '物理类';
});

const introTargetBatch = computed(() => {
  if (legacyProvinces.includes(introProvince.value)) return '本科一批';
  if (['山东', '浙江'].includes(introProvince.value)) return '普通类一段';
  if (introProvince.value === '上海') return '本科普通批';
  return '本科批';
});

const introEmotionLead = computed(() => {
  return `如果你在${introProvince.value}考到 ${introSampleScore.value} 分，最需要的不是更多建议，而是先知道自己大概站在哪一档。`;
});

const introStats = computed(() => {
  const stats = introPreview.value?.recommendationStats || {};
  return {
    rush: Number(stats.rush || 0),
    stable: Number(stats.stable || 0),
    safe: Number(stats.safe || 0),
  };
});

const introSchools = computed(() => {
  const recommendations = introPreview.value?.recommendations || {};
  const orderedBuckets = ['stable', 'rush', 'safe'];
  const seen = new Set<string>();
  const list: Array<any> = [];
  orderedBuckets.forEach((bucket) => {
    ((recommendations[bucket] || []) as any[]).forEach((item) => {
      const key = String(item?.universityId || item?.universityName || '');
      if (!key || seen.has(key) || list.length >= 3) return;
      seen.add(key);
      list.push(Object.assign({}, item, { bucket }));
    });
  });
  return list;
});

const introSchoolNames = computed(() => introSchools.value.map(item => item.universityName).filter(Boolean).slice(0, 3));

const introMajorHighlights = computed(() => {
  const recommendations = introPreview.value?.recommendations || {};
  const result: string[] = [];
  const seen = new Set<string>();
  ['stable', 'rush', 'safe'].forEach((bucket) => {
    ((recommendations[bucket] || []) as any[]).forEach((item) => {
      const candidates = [
        item?.majorName,
        ...((item?.optionLines || []) as any[]).map(line => line?.majorName || line?.title),
      ];
      candidates.forEach((name) => {
        const text = String(name || '').trim();
        if (!text || seen.has(text) || text.includes('录取线') || result.length >= 6) return;
        seen.add(text);
        result.push(text);
      });
    });
  });
  return result;
});

const introReportSummary = computed(() => {
  const summary = String(introPreview.value?.summary || '').trim();
  if (summary) return summary;
  return `系统会先按 ${introProvince.value} 的规则，把你这个分数附近的候选学校拆成冲、稳、保，再补上专业和风险提醒。`;
});

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
  const keyword = cityKeyword.value.trim();
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

const currentArtCategory = computed(() => artMajorBackendMap[artMajorOptions[artMajorIndex.value]] || artMajorOptions[artMajorIndex.value]);

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
  const raw = Math.round(((score - scoreFloor.value) / Math.max(1, cultureScoreMax.value - scoreFloor.value)) * 100);
  return Math.min(96, Math.max(1, raw));
});

const exceedText = computed(() => displayScore.value ? `超过本省${exceedPercent.value}%考生` : '填写分数后自动估算');

const scoreFloor = computed(() => (selectionMode.value === 'six-three' ? 100 : 220));

const minScoreLabel = computed(() => `${scoreFloor.value}分`);

const chartMarkerLeft = computed(() => {
  const floor = scoreFloor.value;
  const max = cultureScoreMax.value;
  const score = Math.min(max, Math.max(floor, Number(form.score) || floor));
  const pct = ((score - floor) / Math.max(1, max - floor)) * 100;
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

const cultureScoreMax = computed(() => {
  const ruleMax = currentArtRule.value?.cultureFullScore;
  if (examCategory.value === 'art' && Number.isFinite(Number(ruleMax))) return Number(ruleMax);
  if (form.province === '上海') return 660;
  if (form.province === '海南') return 900;
  return 750;
});

const artProfessionalScoreMax = computed(() => {
  const ruleMax = currentArtRule.value?.professionalFullScore;
  return Number.isFinite(Number(ruleMax)) ? Number(ruleMax) : 300;
});

const cultureScorePlaceholder = computed(() => `0-${cultureScoreMax.value}`);
const artScorePlaceholder = computed(() => `请输入统考分/预估分，0-${artProfessionalScoreMax.value}`);

const currentArtRule = computed(() => {
  if (examCategory.value !== 'art') return null;
  const province = form.province.trim();
  const category = currentArtCategory.value;
  const batch = artLevel.value;
  if (!province || !category) return null;
  return artSupport.value.find(item =>
    item.province === province &&
    item.artCategory === category &&
    item.batch === batch &&
    (item.subjectType === form.subjectType || item.subjectType === '不限')
  ) || artSupport.value.find(item =>
    item.province === province &&
    item.artCategory === category &&
    item.batch === batch
  ) || null;
});

function splitList(text: string) {
  return text.split(/[,，、\s]+/).map(item => item.trim()).filter(Boolean);
}

function normalizeReportInput(item: any) {
  const input = item?.input || item?.inputSnapshot || {};
  if (typeof input === 'string') {
    try { return JSON.parse(input); } catch { return {}; }
  }
  return input || {};
}

function reportPreferenceText(item: any) {
  const input = normalizeReportInput(item);
  const parts = [
    input.riskPreference ? riskPreferenceLabel(input.riskPreference) : '',
    formatReportList('城市', input.preferredCities),
    formatReportList('专业', input.preferredMajors),
    formatReportList('规避', input.avoidMajors),
  ].filter(Boolean);
  return parts.join(' · ');
}

function formatReportList(label: string, value: unknown) {
  if (!Array.isArray(value) || !value.length) return '';
  const text = value.filter(Boolean).slice(0, 2).join('、');
  if (!text) return '';
  return `${label} ${text}${value.length > 2 ? '等' : ''}`;
}

function riskPreferenceLabel(value?: string) {
  if (value === 'conservative') return '稳妥优先';
  if (value === 'aggressive') return '适度进攻';
  return '稳中带冲';
}

function introBucketLabel(bucket?: string) {
  if (bucket === 'rush') return '可冲';
  if (bucket === 'safe') return '可保';
  return '较稳';
}

function introSchoolMeta(item: any) {
  return [item?.city || item?.province, item?.type, item?.level].filter(Boolean).slice(0, 3).join(' · ') || '同分段候选院校';
}

function introSchoolReason(item: any) {
  const reason = String(item?.reason || '').trim();
  if (reason) return reason;
  return '会结合录取线、城市和专业方向，判断它为什么值得你认真看。';
}

function handleIntroSlideChange(event: any) {
  introCurrent.value = Number(event?.detail?.current || 0);
}

function nextIntroSlide() {
  if (introCurrent.value >= introSlideCount - 1) {
    finishIntroSlides();
    return;
  }
  introCurrent.value += 1;
}

function finishIntroSlides() {
  introOpen.value = false;
  uni.setStorageSync(introSlidesStorageKey, '1');
}

async function maybeOpenIntroSlides() {
  if (introAutoChecked.value) return;
  introAutoChecked.value = true;
  if (uni.getStorageSync(introSlidesStorageKey)) return;

  introOpen.value = true;
  introCurrent.value = 0;
  await loadIntroPreview();
}

async function loadIntroPreview() {
  const seq = ++introPreviewSeq;
  introLoading.value = true;
  try {
    const res = await api.volunteer.preview({
      examCategory: 'normal',
      province: introProvince.value,
      year: form.year || fallbackDataYear,
      subjectType: introSubjectType.value,
      score: introSampleScore.value,
      targetBatch: introTargetBatch.value,
      riskPreference: 'balanced',
      recommendationLimit: 6,
    });
    if (seq === introPreviewSeq) {
      introPreview.value = res.data || null;
    }
  } catch {
    if (seq === introPreviewSeq) {
      introPreview.value = null;
    }
  } finally {
    if (seq === introPreviewSeq) {
      introLoading.value = false;
    }
  }
}

function tutorialTargetClass(key: typeof tutorialSteps[number]['key']) {
  return {
    'tutorial-target': tutorialFocusVisible(key),
  };
}

function tutorialTapTargetClass(key: typeof tutorialSteps[number]['key']) {
  return {
    'tutorial-tap-target': tutorialFocusVisible(key),
  };
}

function tutorialFocusVisible(key: typeof tutorialSteps[number]['key']) {
  if (!tutorialOpen.value) return false;
  return currentTutorialStep.value.key === key;
}

function openTutorial(manual = false) {
  tutorialStep.value = 0;
  tutorialOpen.value = true;
  advancedOpen.value = false;
  tutorialCardStyle.value = '';
  if (manual) tutorialAutoChecked.value = true;
  scrollToCurrentTutorialStep();
}

function maybeOpenTutorial() {
  if (tutorialAutoChecked.value) return;
  tutorialAutoChecked.value = true;
  if (uni.getStorageSync(tutorialStorageKey)) return;
  setTimeout(() => {
    openTutorial();
  }, 420);
}

function finishTutorial() {
  tutorialOpen.value = false;
  tutorialCardStyle.value = '';
  if (tutorialAutoAdvanceTimer) {
    clearTimeout(tutorialAutoAdvanceTimer);
    tutorialAutoAdvanceTimer = null;
  }
  uni.setStorageSync(tutorialStorageKey, '1');
}

function advanceTutorialFrom(key: typeof tutorialSteps[number]['key']) {
  if (!tutorialOpen.value || currentTutorialStep.value.key !== key) return;
  if (tutorialAutoAdvanceTimer) clearTimeout(tutorialAutoAdvanceTimer);
  tutorialAutoAdvanceTimer = setTimeout(() => {
    const shouldAdvance = tutorialOpen.value && currentTutorialStep.value.key === key;
    tutorialAutoAdvanceTimer = null;
    if (!shouldAdvance) return;
    nextTutorialStep();
  }, 180);
}

function scheduleTutorialAdvanceFrom(key: typeof tutorialSteps[number]['key'], delay = 520) {
  if (!tutorialOpen.value || currentTutorialStep.value.key !== key) return;
  if (tutorialAutoAdvanceTimer) clearTimeout(tutorialAutoAdvanceTimer);
  tutorialAutoAdvanceTimer = setTimeout(() => {
    const shouldAdvance = tutorialOpen.value && currentTutorialStep.value.key === key;
    tutorialAutoAdvanceTimer = null;
    if (!shouldAdvance) return;
    nextTutorialStep();
  }, delay);
}

function nextTutorialStep() {
  if (tutorialStep.value >= tutorialSteps.length - 1) {
    finishTutorial();
    return;
  }
  tutorialStep.value += 1;
  scrollToCurrentTutorialStep();
}

function prevTutorialStep() {
  if (tutorialStep.value <= 0) return;
  tutorialStep.value -= 1;
  scrollToCurrentTutorialStep();
}

function scrollToCurrentTutorialStep() {
  nextTick(() => {
    setTimeout(() => {
      const selector = `#${currentTutorialStep.value.anchor}`;
      uni.createSelectorQuery()
        .select(selector)
        .boundingClientRect()
        .select('#guide-submit-target')
        .boundingClientRect()
        .selectViewport()
        .scrollOffset()
        .exec((res: any[]) => {
          const rect = res?.[0];
          const submitRect = res?.[1];
          const viewport = res?.[2];
          if (!rect || !viewport) {
            tutorialCardPlacement.value = preferredTutorialCardPlacement();
            uni.pageScrollTo({ selector, duration: 260 } as any);
            return;
          }

          const windowHeight = uni.getSystemInfoSync().windowHeight || 667;
          const currentScrollTop = Number(viewport.scrollTop || 0);
          const focusRect = tutorialScrollFocusRect(rect, submitRect);
          const placement = resolveTutorialCardPlacement(focusRect, windowHeight);
          tutorialCardPlacement.value = placement;

          const targetTop = currentScrollTop + Number(focusRect.top || 0);
          const targetHeight = Number(focusRect.height || 0);
          const topSafe = placement === 'top' ? 286 : 92;
          const bottomSafe = placement === 'bottom' ? 286 : 116;
          const focusPadding = 68;
          const availableHeight = Math.max(160, windowHeight - topSafe - bottomSafe);
          const paddedHeight = targetHeight + focusPadding;
          const desiredTop = topSafe + Math.max(0, (availableHeight - paddedHeight) / 2);
          const nextScrollTop = Math.max(0, Math.round(targetTop - desiredTop));
          const focusTopAfterScroll = targetTop - nextScrollTop;
          tutorialCardStyle.value = currentTutorialStep.value.key === 'submit'
            ? `top: ${Math.max(16, Math.round(focusTopAfterScroll - 152))}px; bottom: auto;`
            : '';

          uni.pageScrollTo({
            scrollTop: nextScrollTop,
            duration: 260,
          });
        });
    }, 60);
  });
}

function preferredTutorialCardPlacement() {
  return 'bottom';
}

function tutorialScrollFocusRect(rect: any, submitRect: any) {
  return rect;
}

function resolveTutorialCardPlacement(rect: any, windowHeight: number) {
  const preferred = preferredTutorialCardPlacement();
  if (preferred === 'top') return 'top';
  const middle = Number(rect.top || 0) + Number(rect.height || 0) / 2;
  return middle > windowHeight * 0.64 ? 'top' : 'bottom';
}

function setExamCategory(category: ExamCategory) {
  examCategory.value = category;
  scheduleRecommendationPreview();
  advanceTutorialFrom('category');
}

function focusPreferenceInput(type: 'city' | 'preferredMajor' | 'avoidMajor') {
  focusedPreferenceInput.value = '';
  nextTick(() => {
    focusedPreferenceInput.value = type;
  });
}

function chooseSuggestion(type: 'city' | 'preferredMajor' | 'avoidMajor', value: string) {
  if (type === 'city') {
    preferredCitiesText.value = toggleListValue(preferredCitiesText.value, value);
  } else if (type === 'preferredMajor') {
    preferredMajorsText.value = toggleListValue(preferredMajorsText.value, value);
  } else {
    avoidMajorsText.value = toggleListValue(avoidMajorsText.value, value);
  }
  focusPreferenceInput(type);
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
  const keyword = getMajorKeyword(kind);
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
  const keyword = getMajorKeyword(kind);
  const suggestions = keyword ? mergeMajorSuggestions(keyword, []) : [];
  if (kind === 'preferred') preferredMajorSuggestions.value = suggestions;
  else avoidMajorSuggestions.value = suggestions;
}

function getMajorKeyword(kind: 'preferred' | 'avoid') {
  return (kind === 'preferred' ? preferredMajorKeyword.value : avoidMajorKeyword.value).trim();
}

function selectedPreferenceItems(type: 'city' | 'preferredMajor' | 'avoidMajor') {
  if (type === 'city') return splitList(preferredCitiesText.value);
  if (type === 'preferredMajor') return splitList(preferredMajorsText.value);
  return splitList(avoidMajorsText.value);
}

function isPreferenceSelected(type: 'city' | 'preferredMajor' | 'avoidMajor', value: string) {
  return selectedPreferenceItems(type).includes(value);
}

function removeSelected(type: 'city' | 'preferredMajor' | 'avoidMajor', value: string) {
  if (type === 'city') {
    preferredCitiesText.value = removeListValue(preferredCitiesText.value, value);
  } else if (type === 'preferredMajor') {
    preferredMajorsText.value = removeListValue(preferredMajorsText.value, value);
  } else {
    avoidMajorsText.value = removeListValue(avoidMajorsText.value, value);
  }
  focusPreferenceInput(type);
  scheduleRecommendationPreview();
}

function commitKeyword(type: 'city' | 'preferredMajor' | 'avoidMajor') {
  const keyword = type === 'city'
    ? cityKeyword.value.trim()
    : type === 'preferredMajor'
      ? preferredMajorKeyword.value.trim()
      : avoidMajorKeyword.value.trim();
  if (!keyword) return;
  if (type === 'city') {
    preferredCitiesText.value = addListValue(preferredCitiesText.value, keyword);
    cityKeyword.value = '';
  } else if (type === 'preferredMajor') {
    preferredMajorsText.value = addListValue(preferredMajorsText.value, keyword);
    preferredMajorKeyword.value = '';
    preferredMajorSuggestions.value = [];
  } else {
    avoidMajorsText.value = addListValue(avoidMajorsText.value, keyword);
    avoidMajorKeyword.value = '';
    avoidMajorSuggestions.value = [];
  }
  focusPreferenceInput(type);
  scheduleRecommendationPreview();
}

function toggleListValue(text: string, value: string) {
  const items = splitList(text);
  return items.includes(value)
    ? listToText(items.filter(item => item !== value))
    : listToText([...items, value]);
}

function addListValue(text: string, value: string) {
  const items = splitList(text);
  return items.includes(value) ? listToText(items) : listToText([...items, value]);
}

function removeListValue(text: string, value: string) {
  return listToText(splitList(text).filter(item => item !== value));
}

function listToText(items: string[]) {
  return [...new Set(items.map(item => item.trim()).filter(Boolean))].join('，');
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

const locatedProvinceStorageKey = 'volunteer_located_province';
const provinceAliasMap: Record<string, string> = {
  内蒙古自治区: '内蒙古',
  广西壮族自治区: '广西',
  西藏自治区: '西藏',
  宁夏回族自治区: '宁夏',
  新疆维吾尔自治区: '新疆',
  香港特别行政区: '香港',
  澳门特别行政区: '澳门',
};
const provinceCentroids: Record<string, { lat: number; lng: number }> = {
  北京: { lat: 39.9042, lng: 116.4074 },
  天津: { lat: 39.3434, lng: 117.3616 },
  河北: { lat: 38.0428, lng: 114.5149 },
  山西: { lat: 37.8706, lng: 112.5489 },
  内蒙古: { lat: 40.8175, lng: 111.7652 },
  辽宁: { lat: 41.8057, lng: 123.4315 },
  吉林: { lat: 43.8965, lng: 125.3268 },
  黑龙江: { lat: 45.8038, lng: 126.5349 },
  上海: { lat: 31.2304, lng: 121.4737 },
  江苏: { lat: 32.0603, lng: 118.7969 },
  浙江: { lat: 30.2741, lng: 120.1551 },
  安徽: { lat: 31.8612, lng: 117.2857 },
  福建: { lat: 26.0745, lng: 119.2965 },
  江西: { lat: 28.6829, lng: 115.8582 },
  山东: { lat: 36.6512, lng: 117.1201 },
  河南: { lat: 34.7657, lng: 113.7536 },
  湖北: { lat: 30.5928, lng: 114.3055 },
  湖南: { lat: 28.2282, lng: 112.9388 },
  广东: { lat: 23.1291, lng: 113.2644 },
  广西: { lat: 22.817, lng: 108.3669 },
  海南: { lat: 20.044, lng: 110.1999 },
  重庆: { lat: 29.563, lng: 106.5516 },
  四川: { lat: 30.5728, lng: 104.0668 },
  贵州: { lat: 26.647, lng: 106.6302 },
  云南: { lat: 25.0389, lng: 102.7183 },
  西藏: { lat: 29.647, lng: 91.117 },
  陕西: { lat: 34.3416, lng: 108.9398 },
  甘肃: { lat: 36.0611, lng: 103.8343 },
  青海: { lat: 36.6171, lng: 101.7782 },
  宁夏: { lat: 38.4872, lng: 106.2309 },
  新疆: { lat: 43.8256, lng: 87.6168 },
  台湾: { lat: 25.033, lng: 121.5654 },
  香港: { lat: 22.3193, lng: 114.1694 },
  澳门: { lat: 22.1987, lng: 113.5439 },
};
function provinceKey(name: string) {
  return String(name || '')
    .trim()
    .replace(/特别行政区$/, '')
    .replace(/壮族自治区$|回族自治区$|维吾尔自治区$/, '')
    .replace(/自治区$|省$|市$/, '');
}

function normalizeProvinceName(name?: string) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const alias = provinceAliasMap[raw] || raw;
  const key = provinceKey(alias);
  return provinceOptions.value.find(item => provinceKey(item) === key) || '';
}

function resolveProvinceFromText(values: unknown[]) {
  const options = provinceOptions.value;
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text) continue;
    const normalized = normalizeProvinceName(text);
    if (normalized) return normalized;
    const matched = options.find(item => text.includes(item) || text.includes(provinceKey(item)));
    if (matched) return matched;
  }
  return '';
}

function resolveProvinceFromCoordinates(latitude?: number, longitude?: number) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';

  let bestProvince = '';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [province, point] of Object.entries(provinceCentroids)) {
    const normalized = normalizeProvinceName(province);
    if (!normalized) continue;
    const lngWeight = Math.cos((lat * Math.PI) / 180);
    const distance = Math.pow(lat - point.lat, 2) + Math.pow((lng - point.lng) * lngWeight, 2);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestProvince = normalized;
    }
  }
  return bestProvince;
}

function applyProvince(province: string, options: { manual?: boolean; autoLocated?: boolean } = {}) {
  const normalized = normalizeProvinceName(province);
  if (!normalized) return false;
  form.province = normalized;
  syncUserLocation(normalized);
  ensureSubjectOption();
  validateScores({ toast: false, clamp: true });
  provincePanelOpen.value = false;
  if (options.manual) {
    provinceTouched.value = true;
    provinceAutoLocated.value = false;
    locationStatus.value = `已选择 ${normalized}`;
  } else if (options.autoLocated) {
    provinceAutoLocated.value = true;
    locationStatus.value = `已按定位默认选择 ${normalized}，可手动修改`;
  } else {
    locationStatus.value = `已选择 ${normalized}`;
  }
  locationStatusTone.value = 'success';
  return true;
}

function extractProvinceFromLocationResult(result: any) {
  const address = result?.address || result?.addressComponent || result?.address_component || {};
  const candidates = [
    result?.province,
    result?.address,
    result?.name,
    result?.fullAddress,
    result?.formattedAddress,
    address?.province,
    address?.city,
    address?.district,
  ];
  return resolveProvinceFromText(candidates) || resolveProvinceFromCoordinates(result?.latitude, result?.longitude);
}

function locationUnavailableBySystemSetting() {
  try {
    const systemSetting = (uni as any).getSystemSetting?.();
    if (systemSetting && systemSetting.locationEnabled === false) return true;
  } catch { /* ignore */ }
  try {
    const appAuthorizeSetting = (uni as any).getAppAuthorizeSetting?.();
    const locationAuthorized = appAuthorizeSetting?.locationAuthorized;
    return locationAuthorized === false || locationAuthorized === 'denied' || locationAuthorized === 'config error';
  } catch {
    return false;
  }
}

function fallbackProvinceAfterLocationFail(message = '定位未开启，请手动选择高考省份') {
  if (provinceTouched.value || form.province || !provinceOptions.value.length) return;
  const current = userStore.userInfo || {};
  const profileProvince = resolveProvinceFromText([current.province, current.city]);
  if (profileProvince && applyProvince(profileProvince, { autoLocated: true })) {
    locationStatus.value = `定位未开启，已默认使用账号省份 ${profileProvince}`;
    locationStatusTone.value = 'warning';
    return;
  }
  const cached = normalizeProvinceName(uni.getStorageSync(locatedProvinceStorageKey));
  if (cached && applyProvince(cached, { autoLocated: true })) {
    locationStatus.value = `定位未开启，已默认使用上次省份 ${cached}`;
    locationStatusTone.value = 'warning';
    return;
  }
  locationStatus.value = message;
  locationStatusTone.value = 'warning';
}

async function autoSelectProvinceByLocation() {
  if (provinceLocationTried.value || provinceTouched.value || form.province || !provinceOptions.value.length) return;

  provinceLocationTried.value = true;
  locationStatus.value = '正在根据授权定位识别省份...';
  locationStatusTone.value = 'muted';

  if (locationUnavailableBySystemSetting()) {
    fallbackProvinceAfterLocationFail();
    return;
  }

  uni.getLocation({
    type: 'gcj02',
    isHighAccuracy: false,
    success: (result: any) => {
      if (provinceTouched.value || form.province) return;
      const province = extractProvinceFromLocationResult(result);
      if (province && applyProvince(province, { autoLocated: true })) {
        uni.setStorageSync(locatedProvinceStorageKey, province);
      } else {
        fallbackProvinceAfterLocationFail('未能识别当前省份，请手动选择');
      }
    },
    fail: () => {
      fallbackProvinceAfterLocationFail();
    },
  });
}

function selectProvince(province: string) {
  if (applyProvince(province, { manual: true })) {
    advanceTutorialFrom('province');
  }
}

function syncUserLocation(province: string, city = '') {
  if (!userStore.isLogin || !province) return;
  const current = userStore.userInfo || {};
  if (current.province === province && (!city || current.city === city)) return;
  api.auth.updateProfile({ province, ...(city ? { city } : {}) })
    .then((res: any) => {
      userStore.userInfo = Object.assign({}, userStore.userInfo || {}, res.data || { province, city });
    })
    .catch((err: any) => {
      console.warn('[volunteer] sync user location failed', err?.message || err);
    });
}

function openProvincePanel() {
  provincePanelOpen.value = true;
  locationStatus.value = '请选择考生参加高考的省份';
  locationStatusTone.value = 'muted';
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
  maybeAdvanceSubjectTutorial();
}

function setArtLevel(level: '本科' | '专科') {
  artLevel.value = level;
  scheduleRecommendationPreview();
  maybeAdvanceSubjectTutorial();
}

function toggleComprehensiveSubject(subject: string) {
  if (comprehensiveSubjects.value.includes(subject)) {
    comprehensiveSubjects.value = comprehensiveSubjects.value.filter(item => item !== subject);
    return;
  }
  if (comprehensiveSubjects.value.length >= 3) return;
  comprehensiveSubjects.value = [...comprehensiveSubjects.value, subject];
  maybeAdvanceSubjectTutorial();
}

function selectFirstSubject(subject: '物理' | '历史') {
  firstSubject.value = subject;
  form.subjectType = subject === '物理' ? '物理类' : '历史类';
  scheduleRecommendationPreview();
  maybeAdvanceSubjectTutorial();
}

function toggleSecondarySubject(subject: string) {
  if (secondarySubjects.value.includes(subject)) {
    secondarySubjects.value = secondarySubjects.value.filter(item => item !== subject);
    return;
  }
  if (secondarySubjects.value.length >= 2) return;
  secondarySubjects.value = [...secondarySubjects.value, subject];
  maybeAdvanceSubjectTutorial();
}

function selectArtMajor(event: any) {
  artMajorIndex.value = Number(event?.detail?.value || 0);
}

function selectArtMajorByIndex(index: number) {
  artMajorIndex.value = index;
  artMajorPanelOpen.value = false;
  scheduleRecommendationPreview();
  maybeAdvanceSubjectTutorial();
}

function selectSubjectType(type: string) {
  form.subjectType = type;
  scheduleRecommendationPreview();
  maybeAdvanceSubjectTutorial();
}

function maybeAdvanceSubjectTutorial() {
  if (examCategory.value === 'art') {
    advanceTutorialFrom('subjects');
    return;
  }
  nextTick(() => {
    if (subjectSelectionValid.value) advanceTutorialFrom('subjects');
  });
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
  if (!validateCultureScore()) return;
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

function handleArtScoreInput() {
  validateArtScore();
  scheduleRecommendationPreview();
}

function validateCultureScore(options: { toast?: boolean; clamp?: boolean } = {}) {
  const toast = options.toast !== false;
  const score = Number(form.score);
  if (!form.score && form.score !== 0) return true;
  if (!Number.isFinite(score)) return true;
  const max = cultureScoreMax.value;
  if (score < 0 || score > max) {
    if (options.clamp) form.score = Math.min(max, Math.max(0, score));
    if (toast) uni.showToast({ title: `文化分不能超过${max}分`, icon: 'none' });
    return false;
  }
  return true;
}

function validateArtScore(options: { toast?: boolean; clamp?: boolean } = {}) {
  const toast = options.toast !== false;
  const score = Number(artScore.value);
  if (!artScore.value && artScore.value !== 0) return true;
  if (!Number.isFinite(score)) return true;
  const max = artProfessionalScoreMax.value;
  if (score < 0 || score > max) {
    if (options.clamp) artScore.value = Math.min(max, Math.max(0, score));
    if (toast) uni.showToast({ title: `统考/专业分不能超过${max}分`, icon: 'none' });
    return false;
  }
  return true;
}

function validateScores(options: { toast?: boolean; clamp?: boolean } = {}) {
  return validateCultureScore(options) && (examCategory.value !== 'art' || validateArtScore(options));
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
  maybeAdvanceScoreTutorial();
}

function maybeAdvanceScoreTutorial() {
  const score = Number(form.score);
  const rank = Number(form.rank);
  if (!Number.isFinite(score) || score <= 0 || !Number.isFinite(rank) || rank <= 0) return;
  if (!validateCultureScore({ toast: false })) return;
  if (rankLookupLoading.value) return;
  if (!rankAutoFilled.value && !rankManuallyEdited.value) return;
  scheduleTutorialAdvanceFrom('score', 620);
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
    await autoSelectProvinceByLocation();
  } catch {
    regionTree.value = [];
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

async function loadArtSupport() {
  try {
    const res = await api.volunteer.artSupport();
    artSupport.value = res.data || [];
  } catch {
    artSupport.value = [];
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

  if (!province || !subjectType || !Number.isInteger(year) || !Number.isInteger(score) || score <= 0) {
    rankLookupLoading.value = false;
    rankLookupTried.value = false;
    rankAutoFilled.value = false;
    if (!rankManuallyEdited.value) rankLookupMessage.value = '填写分数后自动匹配一分一段位次';
    return;
  }
  if (!validateCultureScore({ toast: false })) {
    rankLookupLoading.value = false;
    rankLookupTried.value = true;
    rankAutoFilled.value = false;
    rankLookupMessage.value = `分数需在0-${cultureScoreMax.value}之间`;
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
      rankLookupMessage.value = `${province}${res.data.subjectType}：约第 ${res.data.rank} 名${exactText}`;
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
    if (seq === rankLookupSeq) {
      rankLookupLoading.value = false;
      maybeAdvanceScoreTutorial();
    }
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

  if (!province || !subjectType || !Number.isInteger(year) || !Number.isFinite(score) || score <= 0 || !validateCultureScore({ toast: false })) {
    recommendationPreview.value = null;
    recommendationPreviewLoading.value = false;
    return;
  }
  if (examCategory.value === 'art' && (!artScore.value || Number(artScore.value) <= 0 || !validateArtScore({ toast: false }))) {
    recommendationPreview.value = null;
    recommendationPreviewLoading.value = false;
    return;
  }

  const seq = ++recommendationPreviewSeq;
  recommendationPreviewLoading.value = true;

  try {
    const res = await api.volunteer.preview({
      examCategory: examCategory.value,
      province,
      year,
      subjectType,
      score,
      rank: form.rank ? Number(form.rank) : undefined,
      targetBatch: form.targetBatch,
      artCategory: examCategory.value === 'art' ? currentArtCategory.value : undefined,
      artProfessionalScore: examCategory.value === 'art' ? Number(artScore.value) : undefined,
      artLevel: examCategory.value === 'art' ? artLevel.value : undefined,
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

function openAdvancedPreference() {
  advancedOpen.value = true;
}

function closeAdvancedPreference() {
  advancedOpen.value = false;
  if (tutorialOpen.value && currentTutorialStep.value.key === 'submit') {
    scrollToCurrentTutorialStep();
  }
}

async function submit() {
  if (loading.value) return;
  if (tutorialOpen.value && currentTutorialStep.value.key === 'submit') {
    finishTutorial();
  }
  if (!userStore.isLogin) {
    uni.setStorageSync(pendingSubmitAfterLoginStorageKey, { at: Date.now() });
    await userStore.loginWithWechatProfile();
    return;
  }
  if (!form.province.trim() || !form.score) {
    uni.showToast({ title: '请填写省份和分数', icon: 'none' });
    return;
  }
  if (!validateScores()) return;
  if (examCategory.value === 'art' && (!artScore.value || Number(artScore.value) <= 0)) {
    uni.showToast({ title: '请填写统考/专业分', icon: 'none' });
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
      examCategory: examCategory.value,
      province: form.province.trim(),
      score: Number(form.score),
      rank: form.rank ? Number(form.rank) : undefined,
      artCategory: examCategory.value === 'art' ? currentArtCategory.value : undefined,
      artProfessionalScore: examCategory.value === 'art' ? Number(artScore.value) : undefined,
      artLevel: examCategory.value === 'art' ? artLevel.value : undefined,
      preferredCities: splitList(preferredCitiesText.value),
      preferredMajors: splitList(preferredMajorsText.value),
      avoidMajors: splitList(avoidMajorsText.value),
      familyExpectation: expectation,
    });
    const res = await api.volunteer.analyze(analysisInput);
    const reportId = (res.data as any).reportId;
    uni.setStorageSync('latest_volunteer_report', Object.assign({}, res.data, {
      input: (res.data as any)?.input || analysisInput,
    }));
    if (reportId) {
      uni.setStorageSync('volunteer_report_tutorial_pending', { reportId, at: Date.now() });
    }
    uni.navigateTo({ url: `/pages/volunteer/report?id=${reportId}` });
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
  loadArtSupport();
  loadRegions();
  loadReports();
  maybeOpenIntroSlides();
  continueSubmitAfterLogin();
});

function continueSubmitAfterLogin() {
  const pending = uni.getStorageSync(pendingSubmitAfterLoginStorageKey);
  if (!pending) return;
  const createdAt = Number((pending as any)?.at || 0);
  const expired = createdAt > 0 && Date.now() - createdAt > 10 * 60 * 1000;
  if (!userStore.isLogin || expired) {
    uni.removeStorageSync(pendingSubmitAfterLoginStorageKey);
    return;
  }
  uni.removeStorageSync(pendingSubmitAfterLoginStorageKey);
  setTimeout(() => {
    if (!loading.value && userStore.isLogin) submit();
  }, 520);
}

onPullDownRefresh(async () => {
  try {
    await Promise.all([loadPublicConfig(), loadArtSupport(), loadRegions(), loadReports(), userStore.fetchBalance()]);
    await lookupScoreRank();
  } finally {
    uni.stopPullDownRefresh();
  }
});

onShareAppMessage(() => {
  const path = withShareRef('/pages/volunteer/index');
  recordShare('friend', path);
  return {
    title: '涨识 AI 高考志愿分析',
    path,
  };
});

onShareTimeline(() => {
  const path = withShareRef('/pages/volunteer/index');
  recordShare('timeline', path);
  return {
    title: '涨识 AI 高考志愿分析',
    query: path.split('?')[1] || '',
  };
});

watch(() => form.province, ensureSubjectOption);
watch([() => form.province, examCategory, artLevel, artMajorIndex], () => {
  validateScores({ toast: false, clamp: true });
});
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
watch([examCategory, artLevel, artMajorIndex], scheduleRecommendationPreview);
watch(
  () => [form.province, form.subjectType, form.score],
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

.guide-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 20rpx;
  padding: 16rpx 18rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.76);
  border: 1rpx solid rgba(20, 184, 166, 0.18);
}

.guide-entry-main {
  min-width: 0;
  color: #0f172a;
  font-size: 25rpx;
  font-weight: 800;
  line-height: 1.3;
}

.guide-entry-action {
  flex-shrink: 0;
  color: #0f766e;
  font-size: 24rpx;
  font-weight: 900;
}

.intro-overlay {
  position: fixed;
  inset: 0;
  z-index: 9901;
  padding: calc(26rpx + env(safe-area-inset-top)) 24rpx calc(24rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background:
    radial-gradient(circle at top left, rgba(250, 204, 21, 0.20), transparent 30%),
    radial-gradient(circle at top right, rgba(14, 165, 233, 0.18), transparent 34%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(17, 24, 39, 0.98) 100%);
  backdrop-filter: blur(14rpx);
}

.intro-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 32rpx;
  padding: 28rpx 24rpx 24rpx;
  box-sizing: border-box;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.94) 100%);
  border: 1rpx solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 32rpx 84rpx rgba(15, 23, 42, 0.36);
}

.intro-topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.intro-kicker {
  display: block;
  color: #f8fafc;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.2;
}

.intro-subkicker {
  display: block;
  margin-top: 10rpx;
  color: rgba(226, 232, 240, 0.84);
  font-size: 24rpx;
  line-height: 1.45;
}

.intro-skip {
  flex-shrink: 0;
  color: rgba(226, 232, 240, 0.72);
  font-size: 24rpx;
  font-weight: 800;
}

.intro-swiper {
  flex: 1;
  min-height: 0;
  margin-top: 20rpx;
}

.intro-slide {
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 28rpx;
  padding: 26rpx 24rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.intro-slide.hero {
  background: linear-gradient(160deg, rgba(124, 58, 237, 0.28) 0%, rgba(15, 118, 110, 0.24) 52%, rgba(249, 115, 22, 0.18) 100%);
}

.intro-slide.schools {
  background: linear-gradient(160deg, rgba(14, 165, 233, 0.20) 0%, rgba(30, 64, 175, 0.16) 100%);
}

.intro-slide.majors {
  background: linear-gradient(160deg, rgba(16, 185, 129, 0.22) 0%, rgba(13, 148, 136, 0.12) 100%);
}

.intro-slide.report {
  background: linear-gradient(160deg, rgba(249, 115, 22, 0.20) 0%, rgba(190, 24, 93, 0.16) 100%);
}

.intro-slide-eyebrow {
  display: inline-flex;
  align-self: flex-start;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.12);
  color: #fef3c7;
  font-size: 21rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
}

.intro-slide-title {
  display: block;
  margin-top: 18rpx;
  color: #fff;
  font-size: 44rpx;
  font-weight: 900;
  line-height: 1.18;
}

.intro-slide-desc {
  display: block;
  margin-top: 14rpx;
  color: rgba(241, 245, 249, 0.86);
  font-size: 27rpx;
  line-height: 1.5;
}

.intro-score-band {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 24rpx;
  padding: 20rpx 22rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.10);
}

.intro-score-value {
  color: #fde68a;
  font-size: 72rpx;
  font-weight: 900;
  line-height: 1;
}

.intro-score-copy {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  color: rgba(241, 245, 249, 0.84);
  font-size: 24rpx;
  line-height: 1.35;
}

.intro-school-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 22rpx;
}

.intro-pill {
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.10);
  color: #fff;
  font-size: 24rpx;
  font-weight: 800;
}

.intro-emotion-line,
.intro-empty-note {
  margin-top: auto;
  color: rgba(226, 232, 240, 0.78);
  font-size: 24rpx;
  line-height: 1.5;
}

.intro-school-cards {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 22rpx;
}

.intro-school-card {
  padding: 18rpx 20rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.08);
  border: 1rpx solid rgba(255, 255, 255, 0.10);
}

.intro-school-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.intro-school-name {
  color: #fff;
  font-size: 29rpx;
  font-weight: 900;
  line-height: 1.24;
}

.intro-school-bucket {
  flex-shrink: 0;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  color: #fff;
  font-size: 20rpx;
  font-weight: 900;
}

.intro-school-bucket.rush {
  background: rgba(245, 158, 11, 0.84);
}

.intro-school-bucket.stable {
  background: rgba(16, 185, 129, 0.82);
}

.intro-school-bucket.safe {
  background: rgba(59, 130, 246, 0.82);
}

.intro-school-meta {
  display: block;
  margin-top: 10rpx;
  color: rgba(226, 232, 240, 0.78);
  font-size: 22rpx;
  line-height: 1.35;
}

.intro-school-reason {
  display: block;
  margin-top: 10rpx;
  color: rgba(248, 250, 252, 0.90);
  font-size: 24rpx;
  line-height: 1.46;
}

.intro-major-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 24rpx;
}

.intro-major-chip {
  padding: 14rpx 18rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.10);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  color: #ecfeff;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 1.3;
}

.intro-major-note {
  margin-top: auto;
  padding: 18rpx 20rpx;
  border-radius: 20rpx;
  background: rgba(15, 23, 42, 0.18);
  color: rgba(236, 253, 245, 0.92);
  font-size: 24rpx;
  line-height: 1.48;
}

.intro-report-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 24rpx;
}

.intro-stat-card {
  padding: 18rpx 16rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.09);
  text-align: center;
}

.intro-stat-label {
  display: block;
  color: rgba(254, 242, 242, 0.78);
  font-size: 22rpx;
  font-weight: 700;
}

.intro-stat-value {
  display: block;
  margin-top: 8rpx;
  color: #fff;
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1;
}

.intro-report-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 24rpx;
  padding: 22rpx 20rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 247, 237, 0.94);
  font-size: 24rpx;
  line-height: 1.45;
}

.intro-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 18rpx;
}

.intro-dots {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.intro-dots text {
  width: 18rpx;
  height: 18rpx;
  border-radius: 999rpx;
  background: rgba(148, 163, 184, 0.38);
}

.intro-dots text.active {
  width: 42rpx;
  background: #fde68a;
}

.intro-primary-btn {
  min-width: 188rpx;
  padding: 18rpx 24rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #f59e0b 0%, #fb7185 100%);
  color: #fff;
  font-size: 26rpx;
  font-weight: 900;
  text-align: center;
  box-shadow: 0 18rpx 32rpx rgba(245, 158, 11, 0.28);
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

.form-step {
  position: relative;
  padding: 16rpx 0 18rpx;
}

.form-step::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1rpx;
  background: rgba(226, 232, 240, 0.86);
}

.form-step.final-step::after {
  display: none;
}

.step-row {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 10rpx;
  min-height: 58rpx;
}

.form-step > .step-row {
  margin-bottom: 12rpx;
}

.form-step > .step-row:last-child {
  margin-bottom: 0;
}

.step-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32rpx;
  height: 32rpx;
  box-sizing: border-box;
  border-radius: $radius-full;
  background: #eef4e8;
  color: #60723f;
  border: 1rpx solid rgba(96, 114, 63, 0.16);
  font-size: 20rpx;
  font-weight: 800;
  line-height: 32rpx;
}

.step-copy {
  flex: 1;
  min-width: 0;
}

.step-title {
  display: block;
  flex-shrink: 0;
  color: #64748b;
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.24;
}

.step-spacer {
  flex: 1;
  min-width: 8rpx;
}

.category-switch {
  display: flex;
  align-items: center;
  flex-shrink: 0;
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

.province-step-row {
  gap: 12rpx;
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

.location-status {
  display: block;
  margin: -8rpx 0 18rpx;
  color: #64748b;
  font-size: 23rpx;
  line-height: 1.45;
  text-align: right;
}

.location-status.success {
  color: #047857;
}

.location-status.warning {
  color: #b45309;
}

.province-tags {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10rpx;
  margin-bottom: 18rpx;
  padding: 16rpx;
  border-radius: 22rpx;
  background: #f8fafc;
  border: 1rpx solid rgba(148, 163, 184, 0.14);
}

.province-tags.tutorial-floating-options {
  position: relative;
  z-index: 8891;
  box-shadow: 0 18rpx 46rpx rgba(15, 23, 42, 0.20);
}

.province-tag {
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

.province-tag.active {
  background: #ecfeff;
  border-color: #67e8f9;
  color: #0891b2;
}

.art-category-head {
  justify-content: space-between;
  gap: 16rpx;
}

.art-category-pill {
  max-width: 360rpx;
  background: #f5f3ff;
  border-color: #ddd6fe;
  color: #7c3aed;
}

.art-category-tags {
  grid-template-columns: repeat(2, 1fr);
  margin-top: -4rpx;
  margin-bottom: 20rpx;
}

.art-category-tag {
  height: 64rpx;
  padding: 0 12rpx;
  box-sizing: border-box;
  font-size: 25rpx;
  line-height: 1.18;
  text-align: center;
  white-space: normal;
}

.subject-area,
.art-area {
  margin-top: 0;
}

.tutorial-target {
  position: relative;
  z-index: 8890;
  border-radius: 20rpx;
}

.meta-row.tutorial-target,
.subject-area.tutorial-target,
.art-area.tutorial-target,
.score-section.tutorial-target,
.preference-entry.tutorial-target,
.submit-main.tutorial-target {
  padding: 10rpx;
  margin-left: -10rpx;
  margin-right: -10rpx;
}

.score-section {
  border-radius: 20rpx;
}

.tutorial-tap-target {
  position: relative;
  z-index: 8891;
  border-radius: 18rpx;
  background: #fff;
  box-shadow: 0 0 0 6rpx rgba(20, 184, 166, 0.28), 0 0 0 16rpx rgba(20, 184, 166, 0.10), 0 24rpx 48rpx rgba(15, 23, 42, 0.24);
  animation: tutorialGlowFlash 1.05s ease-in-out infinite;
}

.tutorial-tap-target::before {
  content: '';
  position: absolute;
  inset: -10rpx;
  border: 3rpx solid rgba(20, 184, 166, 0.82);
  border-radius: 22rpx;
  box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.46);
  animation: tutorialBorderFlash 1.05s ease-in-out infinite;
  pointer-events: none;
}

.tutorial-hit-label {
  position: absolute;
  right: 0;
  bottom: -54rpx;
  min-width: 112rpx;
  height: 42rpx;
  padding: 0 18rpx;
  box-sizing: border-box;
  border-radius: 999rpx;
  background: #0f766e;
  color: #fff;
  font-size: 23rpx;
  font-weight: 900;
  line-height: 42rpx;
  text-align: center;
  box-shadow: 0 12rpx 24rpx rgba(15, 118, 110, 0.24);
  pointer-events: none;
  white-space: nowrap;
}

.input-grid.tutorial-tap-target,
.field-label-row.tutorial-tap-target,
.subject-block.tutorial-tap-target {
  padding: 12rpx;
  margin: -12rpx;
}

.score-input.tutorial-tap-target {
  margin-left: -10rpx;
  margin-right: -10rpx;
}

.submit-main .tutorial-hit-label {
  bottom: auto;
  top: -58rpx;
}

.subject-block {
  margin-bottom: 28rpx;
}

.subject-block.split {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.subject-line {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 14rpx;
  box-sizing: border-box;
  border-radius: 16rpx;
  background: #f8fafc;
  border: 1rpx solid rgba(148, 163, 184, 0.18);
}

.field-label-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.field-label-row.compact {
  flex-shrink: 0;
  justify-content: space-between;
  gap: 8rpx;
  width: 144rpx;
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

.field-label-row.compact .field-label {
  font-size: 26rpx;
  font-weight: 900;
}

.field-label-row.compact .field-hint {
  padding: 4rpx 8rpx;
  border-radius: $radius-full;
  background: #eef2ff;
  color: #7c3aed;
  font-size: 19rpx;
  font-weight: 900;
  line-height: 1.1;
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
  justify-content: flex-end;
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
  min-width: 96rpx;
  height: 62rpx;
  padding: 0 16rpx;
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
  margin: 0 0 16rpx;
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
  margin-top: 0;
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
  margin-top: 22rpx;
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
  margin-top: 0;
  padding: 18rpx 20rpx;
  border-radius: 16rpx;
  background: #fdf2f8;
  border: 1rpx solid #fbcfe8;
}

.preference-copy {
  flex: 1;
  min-width: 0;
}

.preference-title {
  display: block;
  color: $text-primary;
  font-size: $font-sm;
  font-weight: 800;
}

.optional-mark {
  margin-left: 8rpx;
  color: #0f766e;
  font-size: 22rpx;
  font-weight: 900;
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
  gap: 12rpx;
  height: 88rpx;
  margin-top: 0;
  border-radius: 16rpx;
  background: linear-gradient(135deg, #7c3aed 0%, #0f766e 54%, #d97706 100%);
  color: #fff;
  font-size: $font-md;
  font-weight: 800;
  box-shadow: 0 12rpx 24rpx rgba(20, 184, 166, 0.16);
}

.submit-main .step-badge {
  box-shadow: 0 0 0 2rpx rgba(255, 255, 255, 0.72);
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

.field-title {
  display: block;
  margin: 0 0 10rpx;
  color: $text-primary;
  font-size: 24rpx;
  font-weight: 800;
}

.suggest-field .sheet-input {
  margin-top: 0;
}

.tag-input-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10rpx;
  min-height: 76rpx;
  padding: 10rpx 12rpx;
  box-sizing: border-box;
  border-radius: 18rpx;
  background: #fff;
  border: 1rpx solid rgba(148, 163, 184, 0.24);
}

.tag-input {
  flex: 1 1 180rpx;
  min-width: 160rpx;
  height: 48rpx;
  line-height: 48rpx;
  padding: 0 4rpx;
  color: $text-primary;
  font-size: $font-sm;
}

.selected-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-bottom: 12rpx;
  padding: 12rpx;
  border-radius: 16rpx;
  background: #f8fafc;
  border: 1rpx solid rgba(148, 163, 184, 0.18);
}

.selected-chip {
  max-width: 100%;
  box-sizing: border-box;
  padding: 9rpx 16rpx;
  border-radius: $radius-full;
  background: #eef4e8;
  border: 1rpx solid rgba(111, 125, 74, 0.24);
  color: #60723f;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 1.25;
  word-break: break-all;
}

.selected-chip.danger {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
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
  max-width: 100%;
  box-sizing: border-box;
  padding: 9rpx 16rpx;
  border-radius: $radius-full;
  background: #fff;
  border: 1rpx solid #bae6fd;
  color: #0369a1;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.25;
  word-break: break-all;
}

.suggest-chip.active {
  background: #ecfdf5;
  border-color: #6ee7b7;
  color: #047857;
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

.report-pref {
  color: #60723f;
  font-size: $font-xs;
  line-height: 1.45;
  word-break: break-all;
}

.tutorial-focus-mask {
  position: fixed;
  inset: 0;
  z-index: 8888;
  background: rgba(15, 23, 42, 0.46);
}

.tutorial-card {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  z-index: 8892;
  box-sizing: border-box;
  max-height: 238rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.98);
  border: 1rpx solid rgba(15, 118, 110, 0.18);
  box-shadow: 0 28rpx 72rpx rgba(15, 23, 42, 0.22);
  overflow: hidden;
}

.tutorial-card.top {
  top: calc(24rpx + env(safe-area-inset-top));
  bottom: auto;
}

.tutorial-card.bottom {
  top: auto;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
}

.tutorial-card.near-target {
  max-height: none;
  padding: 20rpx 22rpx;
}

.tutorial-head {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}

.tutorial-step-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 56rpx;
  height: 56rpx;
  border-radius: $radius-full;
  background: #0f766e;
  color: #fff;
  font-size: 28rpx;
  font-weight: 900;
}

.tutorial-copy {
  flex: 1;
  min-width: 0;
}

.tutorial-progress {
  display: block;
  color: #0f766e;
  font-size: 21rpx;
  font-weight: 900;
  line-height: 1.2;
}

.tutorial-title {
  display: block;
  margin-top: 4rpx;
  color: $text-primary;
  font-size: 32rpx;
  font-weight: 900;
  line-height: 1.24;
}

.tutorial-desc {
  display: block;
  margin-top: 8rpx;
  color: $text-secondary;
  font-size: 25rpx;
  line-height: 1.38;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tutorial-close {
  flex-shrink: 0;
  width: 48rpx;
  height: 48rpx;
  color: #94a3b8;
  font-size: 44rpx;
  line-height: 42rpx;
  text-align: center;
}

.tutorial-dots {
  display: flex;
  gap: 8rpx;
  margin-top: 14rpx;
}

.tutorial-dots text {
  width: 32rpx;
  height: 7rpx;
  border-radius: $radius-full;
  background: #e2e8f0;
}

.tutorial-dots text.active {
  width: 54rpx;
  background: #0f766e;
}

.tutorial-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 14rpx;
}

.tutorial-skip {
  flex-shrink: 0;
  color: #64748b;
  font-size: 25rpx;
  font-weight: 800;
}

.tutorial-auto-note {
  min-width: 0;
  color: #0f766e;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 1.35;
  text-align: right;
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
  overflow: hidden;
  background: #101010;
  border: 4rpx solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 16rpx 34rpx rgba(124, 58, 237, 0.28);
  animation: corePulse 1.2s ease-in-out infinite;
}

.orbit-logo {
  width: 78rpx;
  height: 78rpx;
  display: block;
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

@keyframes tutorialGlowFlash {
  0%,
  100% {
    box-shadow: 0 0 0 5rpx rgba(20, 184, 166, 0.22), 0 0 0 14rpx rgba(20, 184, 166, 0.08), 0 24rpx 48rpx rgba(15, 23, 42, 0.22);
  }
  50% {
    box-shadow: 0 0 0 8rpx rgba(250, 204, 21, 0.52), 0 0 0 20rpx rgba(20, 184, 166, 0.16), 0 28rpx 54rpx rgba(15, 23, 42, 0.28);
  }
}

@keyframes tutorialBorderFlash {
  0%,
  100% {
    border-color: rgba(20, 184, 166, 0.70);
    box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.22);
    opacity: 0.72;
    transform: scale(1);
  }
  50% {
    border-color: rgba(250, 204, 21, 0.98);
    box-shadow: 0 0 0 10rpx rgba(250, 204, 21, 0.22);
    opacity: 1;
    transform: scale(1.025);
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
