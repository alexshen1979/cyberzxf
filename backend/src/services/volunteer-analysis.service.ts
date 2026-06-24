import axios from 'axios';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { deductPoints } from './points.service';
import { createLogger } from '../utils/logger';
import { getPointSettings } from './point-config.service';
import { sanitizeAiOutput } from './ai.service';
import {
  chatCompletionsUrl,
  DEFAULT_DEEPSEEK_MODEL,
  resolveAiRuntime,
} from './ai-runtime.service';

const logger = createLogger('volunteer');
const RECOMMENDATION_DISPLAY_LIMIT = 12;
const MAX_RECOMMENDATION_DISPLAY_LIMIT = 300;
const VOLUNTEER_REPORT_AI_TIMEOUT_MS = 8000;
const MIN_RECOMMENDATIONS_PER_BUCKET = 12;
const NORMAL_FALLBACK_SUPPRESS_GAP = 40;
const NORMAL_FALLBACK_ELITE_PENALTY_GAP = 15;
const RECOMMENDATION_BUCKETS: RecommendationBucket[] = ['rush', 'stable', 'safe'];
const BUCKET_LABELS: Record<RecommendationBucket, string> = {
  rush: '冲刺',
  stable: '稳妥',
  safe: '保底',
};
const DEFAULT_RANK_BANDS = {
  rushMin: 0.85,
  rushMax: 0.98,
  stableMin: 0.98,
  stableMax: 1.08,
  safeMin: 1.08,
  safeMax: 1.3,
  preferenceMin: 0.82,
  preferenceMax: 1.35,
};
const LOCATION_RANK_BANDS = {
  rushMin: 0.75,
  rushMax: 0.98,
  stableMin: 0.98,
  stableMax: 1.15,
  safeMin: 1.15,
  safeMax: 1.75,
  preferenceMin: 0.72,
  preferenceMax: 1.8,
};
const DEFAULT_SCORE_BANDS = {
  rushAbove: 15,
  stableBelow: 10,
  stableAbove: 5,
  safeBelow: 40,
  preferenceBelow: 45,
  preferenceAbove: 18,
};
const LOCATION_SCORE_BANDS = {
  rushAbove: 25,
  stableBelow: 15,
  stableAbove: 8,
  safeBelow: 75,
  preferenceBelow: 85,
  preferenceAbove: 30,
};
const NORMAL_UNDERGRAD_BATCH_EXCLUDE_KEYWORDS = [
  '提前',
  '艺术',
  '特殊类型',
  '专项',
  '乡村教师',
  '医学定向',
  '民航招飞',
  '公安政法',
  '军队',
  '航海',
];

export interface VolunteerAnalyzeInput {
  examCategory?: 'normal' | 'art';
  province: string;
  year?: number;
  subjectType: string;
  score: number;
  rank?: number;
  targetBatch?: string;
  artCategory?: string;
  artDirection?: string;
  artProfessionalScore?: number;
  artLevel?: '本科' | '专科';
  preferredCities?: string[];
  preferredMajors?: string[];
  avoidMajors?: string[];
  familyExpectation?: string;
  riskPreference?: 'conservative' | 'balanced' | 'aggressive';
  recommendationLimit?: number;
}

interface Candidate {
  universityId: string | null;
  universityName: string;
  province: string | null;
  city: string | null;
  type: string | null;
  level: string | null;
  tags: string[];
  year: number | null;
  batch: string | null;
  subjectType: string | null;
  majorName: string | null;
  minScore: number | null;
  minRank: number | null;
  avgScore: number | null;
  planCount: number | null;
  compositeScore?: number | null;
  cultureScore?: number | null;
  professionalScore?: number | null;
  artCategory?: string | null;
  admissionMethod?: string | null;
  preferenceTags: string[];
  warningTags: string[];
  reason: string;
  optionLines?: CandidateOptionLine[];
}

interface CandidateOptionLine {
  title: string;
  bucket?: RecommendationBucket;
  lineType: string | null;
  groupCode: string | null;
  groupName: string | null;
  subjectRequirement: string | null;
  year: number | null;
  batch: string | null;
  subjectType: string | null;
  majorName: string | null;
  minScore: number | null;
  minRank: number | null;
  avgScore: number | null;
  planCount: number | null;
  compositeScore?: number | null;
  cultureScore?: number | null;
  professionalScore?: number | null;
  artCategory?: string | null;
  admissionMethod?: string | null;
  preferenceTags: string[];
  warningTags: string[];
  reason: string;
}

type RecommendationBucket = 'rush' | 'stable' | 'safe';
type AdmissionBandOrder = 'rank-asc' | 'rank-desc' | 'score-asc' | 'score-desc';
const admissionScoreInclude = { university: true, universityMajor: true };

interface PreferenceMatch {
  locationMatches: string[];
  cityMatches: string[];
  provinceMatches: string[];
  preferredMajorMatches: string[];
  avoidMajorMatches: string[];
  score: number;
  explicitMajorLine: boolean;
  hasMajorDetail: boolean;
}

interface RankedCandidate {
  candidate: Candidate;
  preferenceScore: number;
  distance: number;
  year: number;
  bucket?: RecommendationBucket;
}

interface VolunteerResult {
  summary: string;
  scorePosition: string;
  strategy: string;
  recommendations: {
    rush: Candidate[];
    stable: Candidate[];
    safe: Candidate[];
  };
  recommendationStats: {
    rush: number;
    stable: number;
    safe: number;
    displayLimit: number;
    preferenceMatched: number;
    avoidMajorExcluded: number;
  };
  majorAdvice: string[];
  cityAdvice: string[];
  risks: string[];
  references: Array<{ type: string; title: string; id?: string; source?: string }>;
}

interface RecommendationClassificationResult {
  recommendations: VolunteerResult['recommendations'];
  recommendationStats?: never;
  stats: VolunteerResult['recommendationStats'];
  references: Array<{ type: string; title: string; source?: string }>;
}

type ArtRule = {
  province: string;
  year: number;
  artCategory: string;
  direction?: string | null;
  batch: string;
  subjectType: string;
  formulaType: string;
  cultureFullScore: number;
  professionalFullScore: number;
  cultureWeight: number;
  professionalWeight: number;
  scaleTo: number;
  minCultureScore?: number | null;
  minProfessionalScore?: number | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
};

type NormalBatchBaseline = {
  year: number;
  batch: string | null;
  minScore: number | null;
};

export async function analyzeVolunteer(userId: string, input: VolunteerAnalyzeInput) {
  validateInput(input);

  const normalized = await normalizeVolunteerInput(input);

  const pointSettings = await getPointSettings();
  const pointsCost = pointSettings.volunteerAnalysisCost;
  const reportId = `volunteer_${userId}_${Date.now()}`;
  await deductPoints(userId, pointsCost, {
    source: 'volunteer_analysis',
    sourceId: reportId,
    remark: `高考志愿分析 - ${normalized.province}${normalized.score}分`,
  });

  try {
    const { result, retrieval } = await buildVolunteerResult(normalized);
    const markdownReport = sanitizeAiOutput(
      normalized.examCategory === 'art'
        ? fallbackMarkdown(result)
        : await generateMarkdownReport(normalized, result, retrieval || { knowledge: [] }),
    );

    const report = await prisma.volunteerReport.create({
      data: {
        userId,
        province: normalized.province,
        year: normalized.year!,
        subjectType: normalized.subjectType,
        score: normalized.score,
        rank: normalized.rank || null,
        input: JSON.stringify(normalized),
        result: JSON.stringify(result),
        markdownReport,
        pointsCost,
      },
    });

    return {
      reportId: report.id,
      pointsCost,
      input: normalized,
      ...result,
      markdownReport,
    };
  } catch (err) {
    await refundVolunteerPoints(userId, pointsCost, reportId);
    throw err;
  }
}

export async function previewVolunteer(input: VolunteerAnalyzeInput) {
  validateInput(input);
  const normalized = await normalizeVolunteerInput(input);
  return (await buildVolunteerResult(normalized)).result;
}

async function normalizeVolunteerInput(input: VolunteerAnalyzeInput) {
  const year = input.year || await getDefaultVolunteerDataYear();
  return {
    ...input,
    examCategory: input.examCategory || 'normal',
    year,
    riskPreference: input.riskPreference || 'balanced',
    preferredCities: input.preferredCities || [],
    preferredMajors: input.preferredMajors || [],
    avoidMajors: input.avoidMajors || [],
    province: input.province.trim(),
    subjectType: input.subjectType.trim(),
    score: Number(input.score),
    rank: input.rank ? Number(input.rank) : undefined,
    artCategory: input.artCategory?.trim(),
    artProfessionalScore: input.artProfessionalScore !== undefined ? Number(input.artProfessionalScore) : undefined,
    artLevel: input.artLevel || undefined,
  } as Required<Pick<VolunteerAnalyzeInput, 'province' | 'subjectType' | 'score'>> & VolunteerAnalyzeInput;
}

async function getDefaultVolunteerDataYear() {
  const latest = await prisma.admissionScore.findFirst({
    orderBy: { year: 'desc' },
    select: { year: true },
  });
  return latest?.year || 2025;
}

export async function listVolunteerReports(userId: string, page = 1, pageSize = 20) {
  const [items, total] = await Promise.all([
    prisma.volunteerReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        province: true,
        year: true,
        subjectType: true,
        score: true,
        rank: true,
        input: true,
        pointsCost: true,
        createdAt: true,
      },
    }),
    prisma.volunteerReport.count({ where: { userId } }),
  ]);

  return {
    list: items.map(item => ({
      ...item,
      input: safeJson(item.input, {}),
    })),
    total,
    page,
    pageSize,
  };
}

export async function getVolunteerReport(userId: string, id: string) {
  const report = await prisma.volunteerReport.findFirst({ where: { id, userId } });
  if (!report) {
    throw new AppError(404, '志愿分析报告不存在', 'VOLUNTEER_REPORT_NOT_FOUND');
  }

  return {
    ...report,
    input: safeJson(report.input, {}),
    result: safeJson(report.result, {}),
    markdownReport: sanitizeAiOutput(report.markdownReport || ''),
  };
}

export async function updateVolunteerReportTitle(userId: string, id: string, rawTitle: string) {
  const title = String(rawTitle || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  if (!title) {
    throw new AppError(422, '报告名称不能为空', 'VOLUNTEER_REPORT_TITLE_REQUIRED');
  }

  const report = await prisma.volunteerReport.findFirst({ where: { id, userId }, select: { id: true } });
  if (!report) {
    throw new AppError(404, '志愿分析报告不存在', 'VOLUNTEER_REPORT_NOT_FOUND');
  }

  return prisma.volunteerReport.update({
    where: { id },
    data: { title },
    select: { id: true, title: true },
  });
}

function validateInput(input: VolunteerAnalyzeInput) {
  if (!input.province?.trim()) {
    throw new AppError(422, '请选择高考省份', 'VOLUNTEER_PROVINCE_REQUIRED');
  }
  if (!input.subjectType?.trim()) {
    throw new AppError(422, '请选择科类/选科类型', 'VOLUNTEER_SUBJECT_REQUIRED');
  }
  const score = Number(input.score);
  const cultureMax = getCultureScoreMax(input.province);
  if (!Number.isFinite(score) || score < 0 || score > cultureMax) {
    throw new AppError(422, `请输入0-${cultureMax}之间的高考文化分`, 'VOLUNTEER_SCORE_INVALID');
  }
  if (input.rank !== undefined && (!Number.isFinite(Number(input.rank)) || Number(input.rank) <= 0)) {
    throw new AppError(422, '请输入有效位次', 'VOLUNTEER_RANK_INVALID');
  }
  if (input.examCategory === 'art') {
    if (!input.artCategory?.trim()) {
      throw new AppError(422, '请选择艺术专业类别', 'VOLUNTEER_ART_CATEGORY_REQUIRED');
    }
    const professionalScore = Number(input.artProfessionalScore);
    const professionalMax = getArtProfessionalScoreMax();
    if (!Number.isFinite(professionalScore) || professionalScore < 0 || professionalScore > professionalMax) {
      throw new AppError(422, `请输入0-${professionalMax}之间的统考/专业分`, 'VOLUNTEER_ART_SCORE_INVALID');
    }
  }
}

function getCultureScoreMax(province?: string) {
  const normalized = String(province || '').trim();
  if (normalized === '上海') return 660;
  if (normalized === '海南') return 900;
  return 750;
}

function getArtProfessionalScoreMax() {
  return 300;
}

async function buildVolunteerResult(input: VolunteerAnalyzeInput): Promise<{ result: VolunteerResult; retrieval?: any }> {
  if (input.examCategory === 'art') {
    return { result: await buildArtStructuredResult(input) };
  }
  const retrieval = await retrieveVolunteerContext(input);
  return { result: buildStructuredResult(input, retrieval), retrieval };
}

function subjectTypeAliases(subjectType: string) {
  const normalized = subjectType.trim();
  if (['综合', '综合改革'].includes(normalized)) return ['综合', '综合改革'];
  return [normalized];
}

async function retrieveVolunteerContext(input: VolunteerAnalyzeInput) {
  const years = [input.year!, input.year! - 1, input.year! - 2, input.year! - 3].filter(y => y > 2000);
  const baseWhere: any = {
    province: input.province,
    subjectType: { in: subjectTypeAliases(input.subjectType) },
    year: { in: years },
  };
  const batchFilter = buildBatchFilter(input.targetBatch);
  const admissionScores = await retrieveCandidateAdmissionScores(
    input,
    baseWhere,
    batchFilter,
  );

  const keywords = [
    '报考志愿',
    '平行志愿',
    '冲稳保',
    '退档',
    '专业调剂',
    ...(input.preferredMajors || []),
  ];
  const [knowledge, majors] = await Promise.all([
    prisma.knowledgeEntry.findMany({
    where: {
      status: 'published',
      OR: [
        { category: { contains: '报考志愿' } },
        ...keywords.map(kw => ({ title: { contains: kw } })),
        ...keywords.map(kw => ({ tags: { contains: kw } })),
      ],
    },
    take: 8,
    orderBy: { viewCount: 'desc' },
    select: { id: true, title: true, category: true, sourceName: true, content: true },
    }),
    prisma.major.findMany({
      where: buildMajorWhere(input),
      take: 12,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
  ]);

  const universityIds = [...new Set(admissionScores.map(s => s.universityId).filter(Boolean))] as string[];
  const universityMajors = universityIds.length
    ? await prisma.universityMajor.findMany({
        where: {
          universityId: { in: universityIds },
          status: 'enabled',
          ...buildUniversityMajorPreferenceWhere(input),
        },
        include: { major: true, university: { select: { name: true, province: true, city: true } } },
        take: 80,
        orderBy: [{ updatedAt: 'desc' }],
      })
    : [];

  const fallbackUniversities = await retrieveNormalFallbackUniversities(input);
  const normalBatchBaseline = await findNormalBatchBaseline(input, years);

  return { admissionScores, knowledge, majors, universityMajors, fallbackUniversities, normalBatchBaseline };
}

function buildUniversityLocationPreferenceWhere(input: VolunteerAnalyzeInput) {
  const OR: any[] = [];
  for (const location of normalizeKeywords(input.preferredCities)) {
    for (const variant of keywordVariants(location)) {
      OR.push(
        { city: { contains: variant } },
        { province: { contains: variant } },
      );
    }
  }
  return OR;
}

async function retrieveCandidateAdmissionScores(input: VolunteerAnalyzeInput, baseWhere: any, batchFilter: any) {
  const locationFilter = buildAdmissionLocationFilter(input);
  const filters = [baseWhere, batchFilter, locationFilter].filter(Boolean);
  const whereBase = filters.length > 1 ? { AND: filters } : filters[0];
  const rankBands = rankBandsFor(input);
  const scoreBands = scoreBandsFor(input);
  const score = Number(input.score);
  const queries: Array<Promise<any[]>> = [];
  const preferenceWhere = buildAdmissionPreferenceWhere(input);

  if (input.rank) {
    const rank = Number(input.rank);
    queries.push(
      findAdmissionScoreBand(whereBase, { minRank: { gte: Math.floor(rank * rankBands.rushMin), lt: Math.ceil(rank * rankBands.rushMax) } }, 'rank-desc', 180),
      findAdmissionScoreBand(whereBase, { minRank: { gte: Math.floor(rank * rankBands.stableMin), lte: Math.ceil(rank * rankBands.stableMax) } }, 'rank-asc', 180),
      findAdmissionScoreBand(whereBase, { minRank: { gt: Math.floor(rank * rankBands.safeMin), lte: Math.ceil(rank * rankBands.safeMax) } }, 'rank-asc', 180),
    );

    if (preferenceWhere) {
      queries.push(
        findAdmissionScoreBand(
          whereBase,
          { AND: [preferenceWhere, { minRank: { gte: Math.floor(rank * rankBands.preferenceMin), lte: Math.ceil(rank * rankBands.preferenceMax) } }] },
          'rank-asc',
          240,
        ),
      );
    }
  }

  queries.push(
    findAdmissionScoreBand(whereBase, { minScore: { gt: score, lte: score + scoreBands.rushAbove } }, 'score-asc', 100),
    findAdmissionScoreBand(whereBase, { minScore: { gte: score - scoreBands.stableBelow, lte: score + scoreBands.stableAbove } }, 'score-desc', 100),
    findAdmissionScoreBand(whereBase, { minScore: { gte: score - scoreBands.safeBelow, lt: score - scoreBands.stableBelow } }, 'score-desc', 100),
  );

  if (preferenceWhere) {
    queries.push(
      findAdmissionScoreBand(
        whereBase,
        { AND: [preferenceWhere, { minScore: { gte: score - scoreBands.preferenceBelow, lte: score + scoreBands.preferenceAbove } }] },
        'score-desc',
        240,
      ),
    );
  }

  const groups = await Promise.all(queries);
  const merged = uniqueAdmissionScores(groups.flat());

  if (merged.length > 0) return merged;

  return prisma.admissionScore.findMany({
    where: whereBase,
    include: admissionScoreInclude,
    take: 360,
    orderBy: input.rank ? [{ year: 'desc' }, { minRank: 'asc' }] : [{ year: 'desc' }, { minScore: 'desc' }],
  });
}

function findAdmissionScoreBand(whereBase: any, bandWhere: any, order: AdmissionBandOrder, take: number) {
  const orderBy = order === 'rank-asc'
    ? [{ year: 'desc' as const }, { minRank: 'asc' as const }]
    : order === 'rank-desc'
      ? [{ year: 'desc' as const }, { minRank: 'desc' as const }]
      : order === 'score-asc'
        ? [{ year: 'desc' as const }, { minScore: 'asc' as const }]
        : [{ year: 'desc' as const }, { minScore: 'desc' as const }];

  return prisma.admissionScore.findMany({
    where: { AND: [whereBase, bandWhere] },
    include: admissionScoreInclude,
    take,
    orderBy,
  });
}

function buildAdmissionPreferenceWhere(input: VolunteerAnalyzeInput) {
  const preferredLocations = normalizeKeywords(input.preferredCities);
  const preferredMajors = normalizeKeywords(input.preferredMajors);
  const OR: any[] = [];

  for (const location of preferredLocations) {
    for (const variant of keywordVariants(location)) {
      OR.push(
        { universityName: { contains: variant } },
        { university: { is: { city: { contains: variant } } } },
        { university: { is: { province: { contains: variant } } } },
      );
    }
  }

  for (const major of preferredMajors) {
    for (const variant of keywordVariants(major)) {
      OR.push(
        { majorName: { contains: variant } },
        { groupName: { contains: variant } },
        { subjectRequirement: { contains: variant } },
        { rawData: { contains: variant } },
        { universityMajor: { is: { majorName: { contains: variant } } } },
        { universityMajor: { is: { featureTags: { contains: variant } } } },
        { universityMajor: { is: { employmentNote: { contains: variant } } } },
      );
    }
  }

  return OR.length ? { OR } : null;
}

function buildAdmissionLocationFilter(input: VolunteerAnalyzeInput) {
  const preferredLocations = normalizeKeywords(input.preferredCities);
  if (!preferredLocations.length) return null;

  const OR: any[] = [];
  for (const location of preferredLocations) {
    for (const variant of keywordVariants(location)) {
      OR.push(
        { university: { is: { city: { contains: variant } } } },
        { university: { is: { province: { contains: variant } } } },
      );
    }
  }
  return OR.length ? { OR } : null;
}

function buildBatchFilter(targetBatch?: string) {
  const batch = targetBatch?.trim();
  if (!batch) return null;

  if (['本科', '本科批', '本科普通批'].includes(batch)) {
    return {
      AND: [
        {
          OR: [
            { batch: { contains: batch } },
            { batch: '本科' },
            { batch: { contains: '普通类本科' } },
            { batch: { contains: '本科批' } },
            { batch: { contains: '平行志愿' } },
          ],
        },
        {
          NOT: NORMAL_UNDERGRAD_BATCH_EXCLUDE_KEYWORDS.map(keyword => ({ batch: { contains: keyword } })),
        },
      ],
    };
  }

  if (batch.includes('专科')) {
    return {
      OR: [
        { batch: { contains: batch } },
        { batch: { contains: '专科' } },
      ],
    };
  }

  return { batch: { contains: batch } };
}

function uniqueAdmissionScores(scores: any[]) {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const score of scores) {
    if (seen.has(score.id)) continue;
    seen.add(score.id);
    result.push(score);
  }
  return result;
}

function buildStructuredResult(input: VolunteerAnalyzeInput, retrieval: any): VolunteerResult {
  const classified = classifyCandidates(input, retrieval.admissionScores);
  const initialTotal = countRecommendations(classified.recommendations);
  const fallbackSuppressed = shouldSuppressNormalFallback(input, retrieval.normalBatchBaseline);
  const completed = fallbackSuppressed
    ? {
        recommendations: classified.recommendations,
        stats: classified.stats,
        references: [] as Array<{ type: string; title: string; source?: string }>,
      }
    : completeNormalClassificationWithFallback(
        input,
        { ...classified, references: [] },
        retrieval.fallbackUniversities || [],
        retrieval.normalBatchBaseline || null,
      );
  const candidates = completed.recommendations;
  const recommendationStats = completed.stats;
  const usedFallback = !fallbackSuppressed && hasFallbackRecommendation(candidates);
  const baselineWarning = buildNormalBatchBaselineWarning(input, retrieval.normalBatchBaseline);

  const rankText = input.rank ? `，位次约 ${input.rank}` : '，暂未提供位次';
  const dataText = fallbackSuppressed
    ? `${baselineWarning || '当前分数明显低于本科主数据带。'} 为避免把名校资料误当成“冲刺”，本次不再强行补本科冲稳保候选。`
    : initialTotal && usedFallback
      ? '已结合历年录取数据做初步分档，并用院校库补足数据不足的档位。'
      : initialTotal
        ? '已结合历年录取数据做初步分档。'
        : '当前匹配录取数据不足，已先用院校库生成冲稳保方向候选。';
  const preferenceText = buildPreferenceExecutionSummary(input, recommendationStats);
  const scorePosition = fallbackSuppressed
    ? `${baselineWarning || '当前分数与本科参考线存在明显差距。'} 建议先切换到专科/高职批次，或重新评估本科目标。`
    : input.rank
      ? `以位次 ${input.rank} 为核心参考，优先看近三年最低位次波动。`
      : '未提供位次时只能用分差粗筛，准确度会明显下降，建议补充一分一段位次。';

  return {
    summary: `${input.province}${input.subjectType}${input.score}分${rankText}，适合采用${strategyLabel(input.riskPreference)}。${dataText}${preferenceText}`,
    scorePosition,
    strategy: strategyLabel(input.riskPreference),
    recommendations: candidates,
    recommendationStats,
    majorAdvice: buildMajorAdvice(input, retrieval.majors, retrieval.universityMajors),
    cityAdvice: buildCityAdvice(input),
    risks: buildRisks(input, usedFallback, baselineWarning),
    references: [
      ...retrieval.knowledge.map((k: any) => ({
        type: 'knowledge',
        id: k.id,
        title: k.title,
        source: k.sourceName || k.category,
      })),
      ...retrieval.majors.slice(0, 5).map((m: any) => ({
        type: 'major',
        id: m.id,
        title: m.name,
        source: m.category || '专业库',
      })),
      ...retrieval.universityMajors.slice(0, 5).map((um: any) => ({
        type: 'university_major',
        id: um.id,
        title: `${um.university?.name || '院校'} - ${um.majorName}`,
        source: '院校专业库',
      })),
      ...(initialTotal ? [{ type: 'admission_score', title: '历年录取分数/位次数据' }] : []),
      ...(usedFallback ? [{ type: 'university', title: '院校库方向候选', source: '院校库' }] : []),
    ],
  };
}

function completeNormalClassificationWithFallback(
  input: VolunteerAnalyzeInput,
  classified: RecommendationClassificationResult,
  fallbackUniversities: any[],
  baseline: NormalBatchBaseline | null,
): RecommendationClassificationResult {
  const displayLimit = normalizeRecommendationLimit(input.recommendationLimit);
  const minimum = MIN_RECOMMENDATIONS_PER_BUCKET;
  if (RECOMMENDATION_BUCKETS.every(bucket => classified.recommendations[bucket].length >= minimum)) {
    return classified;
  }

  const recommendations = cloneRecommendationGroups(classified.recommendations);
  const existingKeys = new Set(
    RECOMMENDATION_BUCKETS
      .flatMap(bucket => recommendations[bucket])
      .map(item => item.universityId || item.universityName)
      .filter(Boolean),
  );
  const fallback = buildNormalFallbackClassification(input, fallbackUniversities, existingKeys, baseline);

  for (const bucket of RECOMMENDATION_BUCKETS) {
    const needed = Math.max(0, minimum - recommendations[bucket].length);
    if (!needed) continue;
    const additions: Candidate[] = [];
    const usedKeys = new Set(
      recommendations[bucket]
        .map(item => item.universityId || item.universityName)
        .filter(Boolean),
    );
    for (const item of fallback.recommendations[bucket]) {
      if (additions.length >= needed) break;
      const key = item.universityId || item.universityName;
      if (!key || usedKeys.has(key)) continue;
      usedKeys.add(key);
      additions.push(item);
    }
    recommendations[bucket].push(...additions);
  }

  const allItems = RECOMMENDATION_BUCKETS.flatMap(bucket => recommendations[bucket]);
  return {
    recommendations,
    stats: {
      rush: recommendations.rush.length,
      stable: recommendations.stable.length,
      safe: recommendations.safe.length,
      displayLimit,
      preferenceMatched: allItems.filter(item => hasPreferenceMatch(item)).length,
      avoidMajorExcluded: classified.stats.avoidMajorExcluded + fallback.stats.avoidMajorExcluded,
    },
    references: mergeReferences(classified.references || [], fallback.references || []),
  };
}

function buildNormalFallbackClassification(
  input: VolunteerAnalyzeInput,
  universities: any[],
  existingKeys: Set<string>,
  baseline: NormalBatchBaseline | null,
): RecommendationClassificationResult {
  const displayLimit = Math.max(normalizeRecommendationLimit(input.recommendationLimit), MIN_RECOMMENDATIONS_PER_BUCKET);
  const targetPerBucket = displayLimit;
  const buckets = distributeNormalFallbackUniversities(input, universities, existingKeys, targetPerBucket, baseline);
  const recommendations = Object.fromEntries(
    RECOMMENDATION_BUCKETS.map(bucket => [
      bucket,
      buckets[bucket].slice(0, displayLimit).map((university, index) => (
        buildNormalFallbackCandidate(input, university, bucket, index)
      )),
    ]),
  ) as VolunteerResult['recommendations'];
  const allItems = RECOMMENDATION_BUCKETS.flatMap(bucket => recommendations[bucket]);

  return {
    recommendations,
    stats: {
      rush: recommendations.rush.length,
      stable: recommendations.stable.length,
      safe: recommendations.safe.length,
      displayLimit,
      preferenceMatched: allItems.filter(item => hasPreferenceMatch(item)).length,
      avoidMajorExcluded: 0,
    },
    references: allItems.length ? [{ type: 'university', title: '院校库方向候选', source: '院校库' }] : [],
  };
}

async function retrieveNormalFallbackUniversities(input: VolunteerAnalyzeInput) {
  const preferredLocationWhere = buildUniversityLocationPreferenceWhere(input);
  const levelWhere = buildNormalUniversityLevelWhere(input);
  const preferredMajors = normalizeKeywords(input.preferredMajors);
  const majorWhere = preferredMajors.length
    ? {
        status: 'enabled',
        university: { is: levelWhere },
        OR: preferredMajors.flatMap(major => keywordVariants(major).flatMap(variant => [
          { majorName: { contains: variant } },
          { featureTags: { contains: variant } },
          { employmentNote: { contains: variant } },
          { major: { is: { name: { contains: variant } } } },
          { major: { is: { category: { contains: variant } } } },
        ])),
      }
    : null;

  const [majorMatches, preferredSchools, localSchools, broadSchools] = await Promise.all([
    majorWhere
      ? prisma.universityMajor.findMany({
          where: majorWhere,
          include: { university: true },
          take: 220,
          orderBy: [{ updatedAt: 'desc' }],
        })
      : Promise.resolve([]),
    preferredLocationWhere.length
      ? prisma.university.findMany({
          where: { AND: [levelWhere, { OR: preferredLocationWhere }] },
          take: 100,
          orderBy: [{ is985: 'desc' }, { is211: 'desc' }, { isDoubleFirst: 'desc' }, { name: 'asc' }],
        })
      : Promise.resolve([]),
    prisma.university.findMany({
      where: { AND: [levelWhere, { province: input.province }] },
      take: 100,
      orderBy: [{ is985: 'desc' }, { is211: 'desc' }, { isDoubleFirst: 'desc' }, { name: 'asc' }],
    }),
    prisma.university.findMany({
      where: levelWhere,
      take: 160,
      orderBy: [{ is985: 'desc' }, { is211: 'desc' }, { isDoubleFirst: 'desc' }, { name: 'asc' }],
    }),
  ]);

  return uniqueUniversities([
    ...buildMajorMatchUniversities(majorMatches),
    ...preferredSchools,
    ...localSchools,
    ...broadSchools,
    ...staticNormalFallbackUniversities(input),
  ]);
}

async function findNormalBatchBaseline(input: VolunteerAnalyzeInput, years: number[]): Promise<NormalBatchBaseline | null> {
  if (normalFallbackBatch(input) !== '本科') return null;
  const rows = await prisma.admissionScore.findMany({
    where: {
      province: input.province,
      year: { in: years },
      subjectType: { in: subjectTypeAliases(input.subjectType) },
      minScore: { not: null },
      ...buildBatchFilter('本科'),
    },
    select: {
      year: true,
      batch: true,
      minScore: true,
    },
    orderBy: [{ year: 'desc' }, { minScore: 'asc' }],
    take: 12,
  });
  const first = rows.find(row => Number.isFinite(Number(row.minScore)));
  if (!first) return null;
  return {
    year: first.year,
    batch: first.batch,
    minScore: Number(first.minScore),
  };
}

function normalBatchFloorGap(input: VolunteerAnalyzeInput, baseline: NormalBatchBaseline | null) {
  if (!baseline || !Number.isFinite(Number(baseline.minScore))) return 0;
  return Number(baseline.minScore) - Number(input.score || 0);
}

function shouldSuppressNormalFallback(input: VolunteerAnalyzeInput, baseline: NormalBatchBaseline | null) {
  if (normalFallbackBatch(input) !== '本科') return false;
  return normalBatchFloorGap(input, baseline) >= NORMAL_FALLBACK_SUPPRESS_GAP;
}

function buildNormalBatchBaselineWarning(input: VolunteerAnalyzeInput, baseline: NormalBatchBaseline | null) {
  const gap = normalBatchFloorGap(input, baseline);
  if (!baseline || gap <= 0) return '';
  const batchLabel = baseline.batch || '本科参考批次';
  return `参考 ${input.province}${baseline.year} 年 ${batchLabel} 主数据，最低分约 ${baseline.minScore}，当前分数低了 ${gap} 分。`;
}

function normalFallbackElitePenalty(gap: number, university: any) {
  if (gap < NORMAL_FALLBACK_ELITE_PENALTY_GAP) return 0;
  let penalty = 0;
  if (university?.is985) penalty += 3600;
  if (university?.is211) penalty += 2400;
  if (university?.isDoubleFirst) penalty += 1800;
  return penalty;
}

function staticNormalFallbackUniversities(input: VolunteerAnalyzeInput) {
  const isVocational = normalFallbackBatch(input) === '专科';
  const items = isVocational
    ? [
        ['南京信息职业技术学院', '江苏', '南京', '理工', '高职专科', '信息技术 智能制造'],
        ['无锡职业技术大学', '江苏', '无锡', '理工', '本科', '智能制造 装备制造'],
        ['江苏农林职业技术学院', '江苏', '镇江', '农林', '高职专科', '现代农业 生态技术'],
        ['常州信息职业技术学院', '江苏', '常州', '理工', '高职专科', '软件 信息技术'],
        ['江苏经贸职业技术学院', '江苏', '南京', '财经', '高职专科', '财经 商贸'],
        ['苏州工艺美术职业技术学院', '江苏', '苏州', '艺术', '高职专科', '艺术 设计'],
        ['金华职业技术大学', '浙江', '金华', '综合', '本科', '综合应用技术'],
        ['浙江金融职业学院', '浙江', '杭州', '财经', '高职专科', '金融 财经'],
        ['宁波职业技术大学', '浙江', '宁波', '综合', '本科', '港口 制造 商贸'],
        ['杭州职业技术大学', '浙江', '杭州', '综合', '本科', '智能制造 商贸'],
        ['北京科技职业大学', '北京', '北京', '理工', '本科', '电子 信息技术'],
        ['天津职业大学', '天津', '天津', '综合', '本科', '综合应用技术'],
        ['山东商业职业技术学院', '山东', '济南', '财经', '高职专科', '商贸 财经'],
        ['淄博职业技术大学', '山东', '淄博', '综合', '本科', '智能制造 医护'],
        ['青岛职业技术学院', '山东', '青岛', '综合', '高职专科', '商贸 旅游'],
        ['广州职业技术大学', '广东', '广州', '综合', '本科', '商贸 设计'],
        ['广东轻工职业技术大学', '广东', '广州', '理工', '本科', '轻工 设计'],
        ['顺德职业技术大学', '广东', '佛山', '综合', '本科', '智能制造 商贸'],
        ['深圳信息职业技术大学', '广东', '深圳', '理工', '本科', '软件 信息技术'],
        ['重庆电子科技职业大学', '重庆', '重庆', '理工', '本科', '电子 信息技术'],
        ['成都航空职业技术大学', '四川', '成都', '理工', '本科', '航空 装备制造'],
        ['四川工程职业技术大学', '四川', '德阳', '理工', '本科', '智能制造 机械'],
        ['陕西工业职业技术大学', '陕西', '咸阳', '理工', '本科', '装备制造'],
        ['黄河水利职业技术大学', '河南', '开封', '理工', '本科', '水利 土木'],
        ['武汉职业技术大学', '湖北', '武汉', '综合', '本科', '电子 商贸'],
        ['长沙民政职业技术学院', '湖南', '长沙', '综合', '高职专科', '民政 服务管理'],
        ['湖南铁道职业技术学院', '湖南', '株洲', '理工', '高职专科', '轨道交通'],
        ['福建船政交通职业学院', '福建', '福州', '理工', '高职专科', '交通 船舶'],
        ['厦门海洋职业技术学院', '福建', '厦门', '农林', '高职专科', '海洋 食品'],
        ['安徽职业技术大学', '安徽', '合肥', '综合', '本科', '智能制造 商贸'],
        ['芜湖职业技术大学', '安徽', '芜湖', '理工', '本科', '装备制造'],
        ['江西应用技术职业学院', '江西', '赣州', '理工', '高职专科', '资源 环境'],
        ['南宁职业技术大学', '广西', '南宁', '综合', '本科', '商贸 信息技术'],
        ['海南经贸职业技术学院', '海南', '海口', '财经', '高职专科', '经贸 旅游'],
        ['昆明冶金职业大学', '云南', '昆明', '理工', '本科', '冶金 建筑'],
        ['贵州交通职业大学', '贵州', '贵阳', '理工', '本科', '交通 土木'],
        ['新疆农业职业技术大学', '新疆', '昌吉', '农林', '本科', '现代农业'],
      ]
    : [
        ['南京大学', '江苏', '南京', '综合', '本科', '综合研究型', true, true, true],
        ['东南大学', '江苏', '南京', '综合', '本科', '工科 建筑 信息', true, true, true],
        ['南京师范大学', '江苏', '南京', '师范', '本科', '师范 文科 教育', false, true, true],
        ['苏州大学', '江苏', '苏州', '综合', '本科', '综合 医学 材料', false, true, true],
        ['南京航空航天大学', '江苏', '南京', '理工', '本科', '航空航天 工科', false, true, true],
        ['南京理工大学', '江苏', '南京', '理工', '本科', '工科 智能制造', false, true, true],
        ['河海大学', '江苏', '南京', '理工', '本科', '水利 土木 环境', false, true, true],
        ['江南大学', '江苏', '无锡', '综合', '本科', '食品 设计 轻工', false, true, true],
        ['南京邮电大学', '江苏', '南京', '理工', '本科', '通信 计算机'],
        ['南京信息工程大学', '江苏', '南京', '理工', '本科', '气象 计算机'],
        ['南京工业大学', '江苏', '南京', '理工', '本科', '化工 材料'],
        ['南京财经大学', '江苏', '南京', '财经', '本科', '财经 管理'],
        ['江苏大学', '江苏', '镇江', '综合', '本科', '机械 医学 农机'],
        ['扬州大学', '江苏', '扬州', '综合', '本科', '综合 师范 农学'],
        ['南通大学', '江苏', '南通', '综合', '本科', '医学 师范 工科'],
        ['常州大学', '江苏', '常州', '理工', '本科', '化工 材料'],
        ['江苏师范大学', '江苏', '徐州', '师范', '本科', '师范 文科'],
        ['南京工程学院', '江苏', '南京', '理工', '本科', '电力 机械'],
        ['南京晓庄学院', '江苏', '南京', '师范', '本科', '师范 应用'],
        ['金陵科技学院', '江苏', '南京', '理工', '本科', '应用技术'],
        ['盐城工学院', '江苏', '盐城', '理工', '本科', '工科 应用'],
        ['淮阴师范学院', '江苏', '淮安', '师范', '本科', '师范 应用'],
        ['江苏海洋大学', '江苏', '连云港', '综合', '本科', '海洋 工科'],
        ['宿迁学院', '江苏', '宿迁', '综合', '本科', '应用型本科'],
        ['上海大学', '上海', '上海', '综合', '本科', '综合 工科', false, true, true],
        ['华东理工大学', '上海', '上海', '理工', '本科', '化工 材料', false, true, true],
        ['浙江工业大学', '浙江', '杭州', '理工', '本科', '工科 计算机'],
        ['杭州电子科技大学', '浙江', '杭州', '理工', '本科', '电子 信息'],
        ['宁波大学', '浙江', '宁波', '综合', '本科', '综合 海洋', false, false, true],
        ['安徽大学', '安徽', '合肥', '综合', '本科', '综合 文科', false, true, true],
        ['合肥工业大学', '安徽', '合肥', '理工', '本科', '车辆 机械', false, true, true],
        ['山东大学', '山东', '济南', '综合', '本科', '综合 医学', true, true, true],
        ['青岛大学', '山东', '青岛', '综合', '本科', '医学 纺织'],
        ['河南大学', '河南', '开封', '综合', '本科', '综合 师范', false, false, true],
        ['武汉科技大学', '湖北', '武汉', '理工', '本科', '材料 工科'],
        ['湖北大学', '湖北', '武汉', '综合', '本科', '综合 师范'],
        ['湖南师范大学', '湖南', '长沙', '师范', '本科', '师范 文科', false, true, true],
        ['深圳大学', '广东', '深圳', '综合', '本科', '计算机 建筑'],
        ['广东工业大学', '广东', '广州', '理工', '本科', '工科 设计'],
        ['成都理工大学', '四川', '成都', '理工', '本科', '地质 工科'],
        ['西南石油大学', '四川', '成都', '理工', '本科', '石油 工科', false, false, true],
        ['重庆邮电大学', '重庆', '重庆', '理工', '本科', '通信 计算机'],
        ['西安理工大学', '陕西', '西安', '理工', '本科', '水利 工科'],
        ['西北大学', '陕西', '西安', '综合', '本科', '综合 文理', false, true, true],
      ];

  return items.map(([name, province, city, type, level, featureTags, is985, is211, isDoubleFirst]) => ({
    id: null,
    name,
    province,
    city,
    type,
    level,
    featureTags,
    properties: featureTags,
    is985: Boolean(is985),
    is211: Boolean(is211),
    isDoubleFirst: Boolean(isDoubleFirst),
  }));
}

function distributeNormalFallbackUniversities(
  input: VolunteerAnalyzeInput,
  universities: any[],
  excluded: Set<string>,
  targetPerBucket: number,
  baseline: NormalBatchBaseline | null,
) {
  const floorGap = normalBatchFloorGap(input, baseline);
  const available = universities.filter((university: any) => {
    const key = university?.id || university?.name;
    return key && !excluded.has(key) && normalLevelFitsUniversity(input, university);
  });
  const ranked = available
    .map((university: any) => ({
      university,
      preferenceScore: matchScorePreferences(input, normalFallbackPreferenceSource(input, university)).score,
      majorScore: normalMajorRelevanceScore(input, university),
      qualityScore: universityQualityScore(university),
      elitePenalty: normalFallbackElitePenalty(floorGap, university),
    }))
    .sort((a, b) =>
      (b.preferenceScore + b.majorScore + b.qualityScore - b.elitePenalty) -
      (a.preferenceScore + a.majorScore + a.qualityScore - a.elitePenalty) ||
      String(a.university.name || '').localeCompare(String(b.university.name || ''), 'zh-Hans-CN')
    );

  const result: Record<RecommendationBucket, any[]> = { rush: [], stable: [], safe: [] };
  const used = new Set<string>();
  const takeFor = (bucket: RecommendationBucket, sorted: typeof ranked) => {
    for (const item of sorted) {
      if (result[bucket].length >= targetPerBucket) break;
      const key = item.university.id || item.university.name;
      if (!key || used.has(key)) continue;
      used.add(key);
      result[bucket].push(item.university);
    }
  };

  takeFor('rush', [...ranked].sort((a, b) =>
    (b.qualityScore + b.preferenceScore * 0.8 + b.majorScore * 0.7 - b.elitePenalty) -
    (a.qualityScore + a.preferenceScore * 0.8 + a.majorScore * 0.7 - a.elitePenalty)
  ));
  takeFor('stable', [...ranked].sort((a, b) =>
    (b.preferenceScore + b.majorScore + b.qualityScore * 0.75 - b.elitePenalty) -
    (a.preferenceScore + a.majorScore + a.qualityScore * 0.75 - a.elitePenalty)
  ));
  takeFor('safe', [...ranked].sort((a, b) =>
    (normalSafetyScore(input, b.university) + b.preferenceScore * 0.8 + b.majorScore * 0.7) -
    (normalSafetyScore(input, a.university) + a.preferenceScore * 0.8 + a.majorScore * 0.7)
  ));

  for (const bucket of RECOMMENDATION_BUCKETS) {
    takeFor(bucket, ranked);
  }
  return result;
}

function buildNormalFallbackCandidate(
  input: VolunteerAnalyzeInput,
  university: any,
  bucket: RecommendationBucket,
  index: number,
): Candidate {
  const preference = matchScorePreferences(input, normalFallbackPreferenceSource(input, university));
  const preferenceTags = buildPreferenceTags(preference);
  const warningTags = ['资料候选', '需核对录取线', ...buildWarningTags(input, preference)];
  const relatedMajorNames = Array.isArray(university.__majorNames) ? university.__majorNames.slice(0, 3) : [];
  const majorName = relatedMajorNames[0] || null;
  const reason = buildNormalFallbackCandidateReason(input, university, bucket);

  return {
    universityId: university.id,
    universityName: university.name,
    province: university.province || null,
    city: university.city || null,
    type: university.type || null,
    level: university.level || null,
    tags: buildUniversityTags(university),
    year: input.year || null,
    batch: input.targetBatch || normalFallbackBatch(input),
    subjectType: input.subjectType,
    majorName,
    minScore: null,
    minRank: null,
    avgScore: null,
    planCount: null,
    preferenceTags,
    warningTags: [...new Set(warningTags)],
    reason,
    optionLines: [{
      title: relatedMajorNames.length ? `相关方向：${relatedMajorNames.join('、')}` : `院校库资料候选 ${index + 1}`,
      bucket,
      lineType: 'normal_fallback',
      groupCode: null,
      groupName: null,
      subjectRequirement: input.subjectType,
      year: input.year || null,
      batch: input.targetBatch || normalFallbackBatch(input),
      subjectType: input.subjectType,
      majorName,
      minScore: null,
      minRank: null,
      avgScore: null,
      planCount: null,
      preferenceTags,
      warningTags: [...new Set(warningTags)],
      reason,
    }],
  };
}

async function buildArtStructuredResult(input: VolunteerAnalyzeInput): Promise<VolunteerResult> {
  const rule = await findArtAdmissionRule(input);
  const cultureScore = Number(input.score);
  const professionalScore = Number(input.artProfessionalScore);
  const artCategory = input.artCategory || '';
  const level = input.artLevel || (input.targetBatch?.includes('专科') ? '专科' : '本科');

  if (!rule) {
    const fallback = await buildArtFallbackClassification(input);
    return buildUnsupportedArtResult(input, '暂未配置该省份/类别的官方艺术类折算规则。', fallback);
  }

  const compositeScore = calculateArtCompositeScore(rule, cultureScore, professionalScore);
  const lineIssues = [
    rule.minCultureScore !== null && rule.minCultureScore !== undefined && cultureScore < Number(rule.minCultureScore)
      ? `文化分低于参考控制线 ${rule.minCultureScore} 分`
      : '',
    rule.minProfessionalScore !== null && rule.minProfessionalScore !== undefined && professionalScore < Number(rule.minProfessionalScore)
      ? `专业分低于参考控制线 ${rule.minProfessionalScore} 分`
      : '',
  ].filter(Boolean);

  const scores = await retrieveArtAdmissionScores(input, rule, compositeScore);
  const initialClassified = classifyArtCandidates(input, scores, compositeScore);
  const initialTotal = countRecommendations(initialClassified.recommendations);
  const classified = await completeArtClassificationWithFallback(input, initialClassified, rule, compositeScore);
  const total = countRecommendations(classified.recommendations);
  const usedFallback = hasFallbackRecommendation(classified.recommendations);
  const sourceText = rule.sourceName ? `规则来源：${rule.sourceName}。` : '';
  const supportText = initialTotal && usedFallback
    ? `已按${input.province}${rule.year}年${artCategory}${level}艺术类投档线做初步分档，并用院校库补足数据不足的档位。`
    : initialTotal
    ? `已按${input.province}${rule.year}年${artCategory}${level}艺术类投档线做初步分档。`
    : total
      ? `当前已能计算综合分，但${input.province}${artCategory}${level}的院校投档线还未补齐，已先用院校库生成冲稳保方向候选。`
      : `当前已能计算综合分，但${input.province}${artCategory}${level}的院校投档线和院校库候选都不足，请先补充基础数据。`;

  return {
    summary: `${input.province}${artCategory}${level}，文化 ${cultureScore} 分、专业 ${professionalScore} 分，折算综合分约 ${formatScore(compositeScore)}。${supportText}${sourceText}`,
    scorePosition: lineIssues.length
      ? `需要先处理门槛问题：${lineIssues.join('；')}。`
      : `艺术类以本省投档规则折算后的综合分为主，普通类位次不能直接套用。`,
    strategy: strategyLabel(input.riskPreference),
    recommendations: classified.recommendations,
    recommendationStats: classified.stats,
    majorAdvice: [
      `当前艺术类别为 ${artCategory}。优先核对目标院校是否承认省统考成绩，以及是否有校考、单科、身高、器乐方向等附加要求。`,
      `你的折算综合分约 ${formatScore(compositeScore)}，后续应主要对比同省同类别同批次的综合投档线，不要只看文化分。`,
      lineIssues.length ? `门槛提醒：${lineIssues.join('；')}。` : '文化分和专业分都需要过本省对应批次控制线，过线后才谈冲稳保。',
    ],
    cityAdvice: buildCityAdvice(input),
    risks: [
      '艺术类各省折算公式不同，且同一省不同类别也可能不同，不能跨省直接比较综合分。',
      '校考、顺序志愿和特殊章程专业不适合用平行志愿投档线直接预测。',
      usedFallback
        ? '带“资料候选”的院校用于避免空报告，只代表可进一步核对的方向，不能当作投档概率结论。'
        : '当前艺术类功能优先支持省统考平行志愿，缺官方投档线的省份会明确提示，不会强行编造投档结论。',
    ],
    references: [
      {
        type: 'art_rule',
        title: `${rule.province}${rule.year}年${rule.artCategory}${rule.direction ? `-${rule.direction}` : ''}艺术类折算规则`,
        source: rule.sourceName || '官方规则',
      },
      ...classified.references,
    ],
  };
}

async function findArtAdmissionRule(input: VolunteerAnalyzeInput): Promise<ArtRule | null> {
  const category = input.artCategory || '';
  const direction = String(input.artDirection || '').trim();
  const batch = artBatch(input);
  const subjectType = normalizeArtSubjectType(input.subjectType);
  const dbRule = await prisma.artAdmissionRule.findFirst({
    where: {
      province: input.province,
      year: input.year!,
      artCategory: category,
      batch,
      OR: [
        { subjectType, direction },
        { subjectType, direction: '' },
        { subjectType: '不限', direction },
        { subjectType: '不限', direction: '' },
      ],
    },
    orderBy: [{ direction: 'desc' }, { subjectType: 'desc' }],
  }).catch(() => null);
  if (dbRule) return dbRule as ArtRule;

  return builtinArtRules().find(rule =>
    rule.province === input.province &&
    rule.year === input.year &&
    rule.artCategory === category &&
    rule.batch === batch &&
    (rule.subjectType === subjectType || rule.subjectType === '不限') &&
    (String(rule.direction || '') === direction || !rule.direction)
  ) || null;
}

function builtinArtRules(): ArtRule[] {
  const gd = (artCategory: string, cultureWeight: number, professionalWeight: number): ArtRule => ({
    province: '广东',
    year: 2025,
    artCategory,
    batch: '本科',
    subjectType: '不限',
    formulaType: 'guangdong_2025',
    cultureFullScore: 750,
    professionalFullScore: 300,
    cultureWeight,
    professionalWeight,
    scaleTo: 750,
    sourceName: '广东省教育考试院',
    sourceUrl: 'https://eea.gd.gov.cn/ptgk/content/post_4514884.html',
    notes: '投档总分=文化课成绩×文化权重+省统考成绩×2.5×专业权重。',
  });
  const js = (artCategory: string, batch: '本科' | '专科'): ArtRule => ({
    province: '江苏',
    year: 2025,
    artCategory,
    batch,
    subjectType: '不限',
    formulaType: 'jiangsu_2025',
    cultureFullScore: 750,
    professionalFullScore: 300,
    cultureWeight: 0.6,
    professionalWeight: 0.4,
    scaleTo: 750,
    sourceName: '江苏省教育考试院',
    sourceUrl: 'https://www.jseea.cn/',
    notes: '投档分=[(高考文化分÷文化满分)×0.6+(专业分÷专业满分)×0.4]×750。',
  });
  return [
    gd('美术与设计类', 0.5, 0.5),
    gd('音乐类', 0.5, 0.5),
    gd('舞蹈类', 0.5, 0.5),
    gd('表（导）演类', 0.5, 0.5),
    gd('书法类', 0.5, 0.5),
    gd('播音与主持类', 0.6, 0.4),
    js('美术与设计类', '本科'),
    js('美术与设计类', '专科'),
  ];
}

function calculateArtCompositeScore(rule: ArtRule, cultureScore: number, professionalScore: number) {
  if (rule.formulaType === 'guangdong_2025') {
    return cultureScore * rule.cultureWeight + professionalScore * 2.5 * rule.professionalWeight;
  }
  if (rule.formulaType === 'hunan_2025') {
    return cultureScore * rule.cultureWeight + professionalScore * rule.professionalWeight;
  }
  if (rule.formulaType === 'hunan_broadcast_2025') {
    return cultureScore + professionalScore;
  }
  if (rule.formulaType === 'shanghai_2025') {
    return cultureScore * rule.cultureWeight + professionalScore * (rule.scaleTo / rule.professionalFullScore) * rule.professionalWeight;
  }
  if (rule.formulaType === 'heilongjiang_broadcast_2025') {
    return cultureScore * rule.cultureWeight + professionalScore * rule.professionalWeight;
  }
  if (rule.formulaType === 'liaoning_2025') {
    return (
      (cultureScore / rule.cultureFullScore) * 100 * rule.cultureWeight +
      (professionalScore / rule.professionalFullScore) * 100 * rule.professionalWeight
    );
  }
  if (rule.formulaType === 'hubei_double_2025') {
    return (cultureScore * rule.cultureWeight + professionalScore * rule.professionalWeight) * rule.scaleTo;
  }
  if (rule.formulaType === 'sum') {
    return cultureScore * rule.cultureWeight + professionalScore * rule.professionalWeight;
  }
  return (
    (cultureScore / rule.cultureFullScore) * rule.cultureWeight +
    (professionalScore / rule.professionalFullScore) * rule.professionalWeight
  ) * rule.scaleTo;
}

async function retrieveArtAdmissionScores(input: VolunteerAnalyzeInput, rule: ArtRule, compositeScore: number) {
  const locationFilter = buildArtLocationFilter(input);
  const preferredMajorFilter = buildArtMajorPreferenceWhere(input);
  const where: any = {
    province: input.province,
    year: { in: [input.year!, input.year! - 1, input.year! - 2].filter(y => y > 2000) },
    artCategory: input.artCategory,
    batch: artBatch(input),
    OR: [{ subjectType: normalizeArtSubjectType(input.subjectType) }, { subjectType: '不限' }],
  };
  const filters = [where, locationFilter].filter(Boolean);
  const whereBase = filters.length > 1 ? { AND: filters } : filters[0];
  const windows = [
    { minCompositeScore: { gt: compositeScore, lte: compositeScore + 22 } },
    { minCompositeScore: { gte: compositeScore - 12, lte: compositeScore + 8 } },
    { minCompositeScore: { gte: compositeScore - 60, lt: compositeScore - 12 } },
  ];
  const queries = windows.map(window => prisma.artAdmissionScore.findMany({
    where: { AND: [whereBase, window] },
    include: { university: true },
    take: 180,
    orderBy: [{ year: 'desc' }, { minCompositeScore: 'desc' }],
  }));
  if (preferredMajorFilter) {
    queries.push(prisma.artAdmissionScore.findMany({
      where: { AND: [whereBase, preferredMajorFilter, { minCompositeScore: { gte: compositeScore - 70, lte: compositeScore + 26 } }] },
      include: { university: true },
      take: 220,
      orderBy: [{ year: 'desc' }, { minCompositeScore: 'desc' }],
    }));
  }
  const rows = uniqueArtAdmissionScores((await Promise.all(queries)).flat());
  return rows;
}

function classifyArtCandidates(input: VolunteerAnalyzeInput, rows: any[], compositeScore: number) {
  const all: Record<RecommendationBucket, Candidate[]> = { rush: [], stable: [], safe: [] };
  const references: Array<{ type: string; title: string; source?: string }> = [];
  const seen = new Set<string>();
  let avoidMajorExcluded = 0;
  for (const row of rows) {
    const minScore = Number(row.minCompositeScore);
    if (!Number.isFinite(minScore)) continue;
    const diff = minScore - compositeScore;
    const bucket: RecommendationBucket | null = diff > 8 && diff <= 22
      ? 'rush'
      : diff >= -12 && diff <= 8
        ? 'stable'
        : diff >= -60 && diff < -12
          ? 'safe'
          : null;
    if (!bucket) continue;
    const preference = matchArtPreferences(input, row);
    if (preference.avoidMajorMatches.length && row.majorName) {
      avoidMajorExcluded += 1;
      continue;
    }
    const key = [row.universityId || row.universityName, row.majorName || row.groupCode || row.groupName || ''].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const reason = buildArtCandidateReason(input, row, compositeScore, bucket, preference);
    const candidate: Candidate = {
      universityId: row.universityId,
      universityName: row.universityName,
      province: row.university?.province || null,
      city: row.university?.city || null,
      type: row.university?.type || null,
      level: row.university?.level || null,
      tags: buildUniversityTags(row.university),
      year: row.year,
      batch: row.batch,
      subjectType: row.subjectType,
      majorName: row.majorName || row.groupName || null,
      minScore: Math.round(minScore),
      minRank: row.minRank,
      avgScore: null,
      planCount: row.planCount,
      compositeScore: minScore,
      cultureScore: row.minCultureScore,
      professionalScore: row.minProfessionalScore,
      artCategory: row.artCategory,
      admissionMethod: row.admissionMethod,
      preferenceTags: buildPreferenceTags(preference),
      warningTags: buildWarningTags(input, preference),
      reason,
      optionLines: [{
        title: row.majorName || row.groupName || '艺术类投档线',
        bucket,
        lineType: 'art',
        groupCode: row.groupCode,
        groupName: row.groupName,
        subjectRequirement: row.subjectType,
        year: row.year,
        batch: row.batch,
        subjectType: row.subjectType,
        majorName: row.majorName || row.groupName || null,
        minScore: Math.round(minScore),
        minRank: row.minRank,
        avgScore: null,
        planCount: row.planCount,
        compositeScore: minScore,
        cultureScore: row.minCultureScore,
        professionalScore: row.minProfessionalScore,
        artCategory: row.artCategory,
        admissionMethod: row.admissionMethod,
        preferenceTags: buildPreferenceTags(preference),
        warningTags: buildWarningTags(input, preference),
        reason,
      }],
    };
    all[bucket].push(candidate);
    if (row.sourceName) references.push({ type: 'art_admission_score', title: `${row.year}${row.universityName}${row.majorName || ''}投档线`, source: row.sourceName });
  }
  for (const key of ['rush', 'stable', 'safe'] as RecommendationBucket[]) {
    all[key].sort((a, b) => Number(b.compositeScore || 0) - Number(a.compositeScore || 0));
  }
  return {
    recommendations: {
      rush: all.rush.slice(0, normalizeRecommendationLimit(input.recommendationLimit)),
      stable: all.stable.slice(0, normalizeRecommendationLimit(input.recommendationLimit)),
      safe: all.safe.slice(0, normalizeRecommendationLimit(input.recommendationLimit)),
    },
    stats: {
      rush: all.rush.length,
      stable: all.stable.length,
      safe: all.safe.length,
      displayLimit: normalizeRecommendationLimit(input.recommendationLimit),
      preferenceMatched: [...all.rush, ...all.stable, ...all.safe].filter(item => hasPreferenceMatch(item)).length,
      avoidMajorExcluded,
    },
    references: references.slice(0, 8),
  };
}

async function completeArtClassificationWithFallback(
  input: VolunteerAnalyzeInput,
  classified: RecommendationClassificationResult,
  rule: ArtRule,
  compositeScore: number,
): Promise<RecommendationClassificationResult> {
  const displayLimit = normalizeRecommendationLimit(input.recommendationLimit);
  const minimum = MIN_RECOMMENDATIONS_PER_BUCKET;
  if (RECOMMENDATION_BUCKETS.every(bucket => classified.recommendations[bucket].length >= minimum)) {
    return classified;
  }

  const fallback = await buildArtFallbackClassification(input, {
    existing: classified.recommendations,
    rule,
    compositeScore,
  });
  const recommendations = cloneRecommendationGroups(classified.recommendations);
  const usedNames = new Set(
    RECOMMENDATION_BUCKETS
      .flatMap(bucket => recommendations[bucket])
      .map(item => item.universityId || item.universityName)
      .filter(Boolean),
  );

  for (const bucket of RECOMMENDATION_BUCKETS) {
    const needed = Math.max(0, minimum - recommendations[bucket].length);
    if (!needed) continue;
    const additions: Candidate[] = [];
    for (const item of fallback.recommendations[bucket]) {
      if (additions.length >= needed) break;
      const key = item.universityId || item.universityName;
      if (!key || usedNames.has(key)) continue;
      usedNames.add(key);
      additions.push(item);
    }
    recommendations[bucket].push(...additions);
  }

  const allItems = RECOMMENDATION_BUCKETS.flatMap(bucket => recommendations[bucket]);
  return {
    recommendations,
    stats: {
      rush: recommendations.rush.length,
      stable: recommendations.stable.length,
      safe: recommendations.safe.length,
      displayLimit,
      preferenceMatched: allItems.filter(item => hasPreferenceMatch(item)).length,
      avoidMajorExcluded: classified.stats.avoidMajorExcluded + fallback.stats.avoidMajorExcluded,
    },
    references: mergeReferences(classified.references, fallback.references),
  };
}

async function buildArtFallbackClassification(
  input: VolunteerAnalyzeInput,
  options: {
    existing?: VolunteerResult['recommendations'];
    rule?: ArtRule;
    compositeScore?: number;
  } = {},
): Promise<RecommendationClassificationResult> {
  const displayLimit = Math.max(normalizeRecommendationLimit(input.recommendationLimit), MIN_RECOMMENDATIONS_PER_BUCKET);
  const targetPerBucket = displayLimit;
  const excluded = new Set(
    RECOMMENDATION_BUCKETS
      .flatMap(bucket => options.existing?.[bucket] || [])
      .map(item => item.universityId || item.universityName)
      .filter(Boolean),
  );
  const universities = await retrieveArtFallbackUniversities(input);
  const buckets = distributeArtFallbackUniversities(input, universities, excluded, targetPerBucket);
  const recommendations = Object.fromEntries(
    RECOMMENDATION_BUCKETS.map(bucket => [
      bucket,
      buckets[bucket].slice(0, displayLimit).map((university, index) => (
        buildArtFallbackCandidate(input, university, bucket, index, options)
      )),
    ]),
  ) as VolunteerResult['recommendations'];
  const allItems = RECOMMENDATION_BUCKETS.flatMap(bucket => recommendations[bucket]);

  return {
    recommendations,
    stats: {
      rush: recommendations.rush.length,
      stable: recommendations.stable.length,
      safe: recommendations.safe.length,
      displayLimit,
      preferenceMatched: allItems.filter(item => hasPreferenceMatch(item)).length,
      avoidMajorExcluded: 0,
    },
    references: allItems.length ? [{ type: 'university', title: '院校库艺术类方向候选', source: '院校库' }] : [],
  };
}

async function retrieveArtFallbackUniversities(input: VolunteerAnalyzeInput) {
  const artKeywords = artCategoryKeywords(input);
  const preferredLocationWhere = buildUniversityLocationPreferenceWhere(input);
  const levelWhere = buildUniversityLevelWhere(input);
  const artSchoolWhere = {
    OR: [
      { type: { contains: '艺术' } },
      { name: { contains: '艺术' } },
      { name: { contains: '美术' } },
      { name: { contains: '音乐' } },
      { name: { contains: '戏剧' } },
      { name: { contains: '电影' } },
      { name: { contains: '传媒' } },
      { featureTags: { contains: '艺术' } },
    ],
  };
  const majorWhere = artKeywords.length
    ? {
        status: 'enabled',
        university: { is: levelWhere },
        OR: artKeywords.flatMap(keyword => [
          { majorName: { contains: keyword } },
          { featureTags: { contains: keyword } },
          { employmentNote: { contains: keyword } },
        ]),
      }
    : { status: 'enabled', university: { is: levelWhere } };

  const [majorMatches, preferredArtSchools, artSchools, localSchools, broadSchools] = await Promise.all([
    prisma.universityMajor.findMany({
      where: majorWhere,
      include: { university: true },
      take: 240,
      orderBy: [{ updatedAt: 'desc' }],
    }),
    preferredLocationWhere.length
      ? prisma.university.findMany({
          where: { AND: [levelWhere, artSchoolWhere, { OR: preferredLocationWhere }] },
          take: 80,
          orderBy: [{ is985: 'desc' }, { is211: 'desc' }, { isDoubleFirst: 'desc' }, { name: 'asc' }],
        })
      : Promise.resolve([]),
    prisma.university.findMany({
      where: { AND: [levelWhere, artSchoolWhere] },
      take: 120,
      orderBy: [{ is985: 'desc' }, { is211: 'desc' }, { isDoubleFirst: 'desc' }, { name: 'asc' }],
    }),
    prisma.university.findMany({
      where: { AND: [levelWhere, { province: input.province }] },
      take: 80,
      orderBy: [{ is985: 'desc' }, { is211: 'desc' }, { isDoubleFirst: 'desc' }, { name: 'asc' }],
    }),
    prisma.university.findMany({
      where: levelWhere,
      take: 120,
      orderBy: [{ is985: 'desc' }, { is211: 'desc' }, { isDoubleFirst: 'desc' }, { name: 'asc' }],
    }),
  ]);

  const staticFallback = await resolveStaticArtFallbackUniversities(input, staticArtFallbackUniversities(input));

  return uniqueUniversities([
    ...buildArtMajorMatchUniversities(majorMatches),
    ...preferredArtSchools,
    ...artSchools,
    ...localSchools,
    ...broadSchools,
    ...staticFallback,
  ]);
}

async function resolveStaticArtFallbackUniversities(input: VolunteerAnalyzeInput, items: any[]) {
  if (!items.length) return [];
  const names = items.map(item => item?.name).filter(Boolean);
  const matched = await prisma.university.findMany({
    where: { name: { in: names } },
  });
  const byName = new Map(matched.map(item => [item.name, item]));
  return items
    .map(item => {
      const university = byName.get(item.name);
      if (!university) return item;
      return {
        ...university,
        __artMajorNames: item.__artMajorNames,
        __staticArtFallback: true,
      };
    })
    .filter(item => artLevelFitsUniversity(input, item));
}

function staticArtFallbackUniversities(input: VolunteerAnalyzeInput) {
  const level = artBatch(input);
  const base =
    level === '专科'
      ? [
          ['苏州工艺美术职业技术学院', '江苏', '苏州', '艺术', '高职专科', '视觉传达 环境艺术 产品艺术'],
          ['南京视觉艺术职业学院', '江苏', '南京', '艺术', '高职专科', '视觉传达 影视动画'],
          ['上海工艺美术职业学院', '上海', '上海', '艺术', '高职专科', '工艺美术 视觉设计'],
          ['浙江艺术职业学院', '浙江', '杭州', '艺术', '高职专科', '表演 音乐 舞蹈'],
          ['浙江横店影视职业学院', '浙江', '金华', '艺术', '高职专科', '表演 影视 编导'],
          ['安徽广播影视职业技术学院', '安徽', '合肥', '艺术', '高职专科', '播音 编导 影视'],
          ['山东传媒职业学院', '山东', '济南', '艺术', '高职专科', '播音 影视 编导'],
          ['山东艺术设计职业学院', '山东', '济南', '艺术', '高职专科', '艺术设计 视觉传达'],
          ['北京戏曲艺术职业学院', '北京', '北京', '艺术', '高职专科', '戏曲 表演 音乐'],
          ['天津艺术职业学院', '天津', '天津', '艺术', '高职专科', '表演 音乐 舞蹈'],
          ['河北艺术职业学院', '河北', '石家庄', '艺术', '高职专科', '表演 音乐 舞蹈'],
          ['山西文化旅游职业大学', '山西', '太原', '综合', '本科', '表演 音乐 舞蹈 旅游'],
          ['内蒙古艺术学院', '内蒙古', '呼和浩特', '艺术', '本科', '音乐 舞蹈 表演'],
          ['辽宁广告职业学院', '辽宁', '沈阳', '艺术', '高职专科', '广告 视觉传达'],
          ['黑龙江艺术职业学院', '黑龙江', '哈尔滨', '艺术', '高职专科', '音乐 舞蹈 表演'],
          ['江西陶瓷工艺美术职业技术学院', '江西', '景德镇', '艺术', '高职专科', '陶瓷 设计 美术'],
          ['湖南大众传媒职业技术学院', '湖南', '长沙', '艺术', '高职专科', '播音 影视 编导'],
          ['广东文艺职业学院', '广东', '广州', '艺术', '高职专科', '音乐 舞蹈 艺术设计'],
          ['广东艺术职业学院', '广东', '广州', '艺术', '高职专科', '舞蹈 戏剧 表演'],
          ['珠海艺术职业学院', '广东', '珠海', '艺术', '高职专科', '艺术设计 表演'],
          ['广西演艺职业学院', '广西', '南宁', '艺术', '高职专科', '表演 音乐 舞蹈'],
          ['四川艺术职业学院', '四川', '成都', '艺术', '高职专科', '表演 音乐 舞蹈'],
          ['四川文化传媒职业学院', '四川', '成都', '艺术', '高职专科', '播音 表演 影视'],
          ['云南文化艺术职业学院', '云南', '昆明', '艺术', '高职专科', '音乐 舞蹈 表演'],
          ['陕西艺术职业学院', '陕西', '西安', '艺术', '高职专科', '表演 音乐 舞蹈'],
        ]
      : [
          ['南京艺术学院', '江苏', '南京', '艺术', '本科', '美术 音乐 表演 设计'],
          ['上海戏剧学院', '上海', '上海', '艺术', '本科', '表演 导演 戏剧 影视'],
          ['上海音乐学院', '上海', '上海', '艺术', '本科', '音乐 声乐 器乐', false, false, true],
          ['中国传媒大学', '北京', '北京', '艺术', '本科', '播音 编导 表演 影视', false, true, true],
          ['北京电影学院', '北京', '北京', '艺术', '本科', '电影 表演 导演 影视'],
          ['中央戏剧学院', '北京', '北京', '艺术', '本科', '戏剧 表演 导演', false, false, true],
          ['中央音乐学院', '北京', '北京', '艺术', '本科', '音乐 作曲 声乐 器乐', false, true, true],
          ['中国音乐学院', '北京', '北京', '艺术', '本科', '音乐 声乐 器乐', false, false, true],
          ['北京舞蹈学院', '北京', '北京', '艺术', '本科', '舞蹈 表演 编导'],
          ['鲁迅美术学院', '辽宁', '沈阳', '艺术', '本科', '美术 设计'],
          ['沈阳音乐学院', '辽宁', '沈阳', '艺术', '本科', '音乐 舞蹈 表演'],
          ['吉林艺术学院', '吉林', '长春', '艺术', '本科', '美术 音乐 表演 设计'],
          ['哈尔滨音乐学院', '黑龙江', '哈尔滨', '艺术', '本科', '音乐 声乐 器乐'],
          ['天津美术学院', '天津', '天津', '艺术', '本科', '美术 设计'],
          ['天津音乐学院', '天津', '天津', '艺术', '本科', '音乐 表演 舞蹈'],
          ['河北传媒学院', '河北', '石家庄', '艺术', '本科', '播音 编导 表演 影视'],
          ['山东艺术学院', '山东', '济南', '艺术', '本科', '美术 音乐 表演 设计'],
          ['山东工艺美术学院', '山东', '济南', '艺术', '本科', '美术 设计 工艺'],
          ['景德镇陶瓷大学', '江西', '景德镇', '艺术', '本科', '陶瓷 美术 设计'],
          ['广州美术学院', '广东', '广州', '艺术', '本科', '美术 设计'],
          ['星海音乐学院', '广东', '广州', '艺术', '本科', '音乐 表演 作曲'],
          ['广西艺术学院', '广西', '南宁', '艺术', '本科', '美术 音乐 舞蹈 表演'],
          ['四川美术学院', '重庆', '重庆', '艺术', '本科', '美术 设计'],
          ['四川音乐学院', '四川', '成都', '艺术', '本科', '音乐 舞蹈 表演'],
          ['云南艺术学院', '云南', '昆明', '艺术', '本科', '美术 音乐 舞蹈 表演'],
          ['西安美术学院', '陕西', '西安', '艺术', '本科', '美术 设计'],
          ['西安音乐学院', '陕西', '西安', '艺术', '本科', '音乐 舞蹈 表演'],
          ['新疆艺术学院', '新疆', '乌鲁木齐', '艺术', '本科', '美术 音乐 舞蹈 表演'],
          ['内蒙古艺术学院', '内蒙古', '呼和浩特', '艺术', '本科', '音乐 舞蹈 表演 美术'],
          ['浙江传媒学院', '浙江', '杭州', '艺术', '本科', '播音 编导 影视 表演'],
          ['山西传媒学院', '山西', '太原', '艺术', '本科', '播音 编导 影视'],
          ['四川传媒学院', '四川', '成都', '艺术', '本科', '播音 编导 表演 影视'],
          ['武汉传媒学院', '湖北', '武汉', '艺术', '本科', '播音 编导 影视 表演'],
          ['成都文理学院', '四川', '成都', '综合', '本科', '广播电视编导 播音'],
          ['南京传媒学院', '江苏', '南京', '艺术', '本科', '播音 编导 表演 影视'],
          ['首都师范大学科德学院', '北京', '北京', '艺术', '本科', '表演 播音 设计'],
          ['大连艺术学院', '辽宁', '大连', '艺术', '本科', '音乐 舞蹈 表演 美术'],
        ];

  const keywords = artCategoryKeywords(input);
  return base.map(([name, province, city, type, universityLevel, featureTags, is985, is211, isDoubleFirst]) => ({
    id: null,
    name,
    province,
    city,
    type,
    level: universityLevel,
    featureTags,
    properties: featureTags,
    is985: Boolean(is985),
    is211: Boolean(is211),
    isDoubleFirst: Boolean(isDoubleFirst),
    __staticArtFallback: true,
    __artMajorNames: pickRelatedStaticArtMajors(String(featureTags || ''), keywords),
  }));
}

function pickRelatedStaticArtMajors(featureTags: string, keywords: string[]) {
  const majors = [
    ['表演', '表演'],
    ['导演', '戏剧影视导演'],
    ['戏剧', '戏剧影视文学'],
    ['影视', '广播电视编导'],
    ['播音', '播音与主持艺术'],
    ['主持', '播音与主持艺术'],
    ['音乐', '音乐表演'],
    ['声乐', '音乐表演'],
    ['器乐', '音乐表演'],
    ['舞蹈', '舞蹈表演'],
    ['美术', '美术学'],
    ['设计', '视觉传达设计'],
    ['动画', '动画'],
    ['书法', '书法学'],
  ];
  const featureText = joinSearchText(featureTags);
  const categoryText = joinSearchText(...keywords);
  const picked = majors
    .filter(([keyword]) => featureText.includes(keyword) && (!categoryText || categoryText.includes(keyword)))
    .map(([, major]) => major);
  return [...new Set(picked)];
}

function buildArtMajorMatchUniversities(majorMatches: any[]) {
  const map = new Map<string, any>();
  for (const item of majorMatches || []) {
    const university = item?.university;
    const key = university?.id || university?.name;
    if (!key) continue;
    const existing = map.get(key) || {
      ...university,
      __artMajorNames: [],
      __artMajorMatchCount: 0,
    };
    const majorName = String(item.majorName || '').trim();
    if (majorName && !existing.__artMajorNames.includes(majorName)) {
      existing.__artMajorNames.push(majorName);
    }
    existing.__artMajorMatchCount += 1;
    map.set(key, existing);
  }
  return [...map.values()];
}

function distributeArtFallbackUniversities(
  input: VolunteerAnalyzeInput,
  universities: any[],
  excluded: Set<string>,
  targetPerBucket: number,
) {
  const filtered = universities.filter((university: any) => {
    const key = university?.id || university?.name;
    return key && !excluded.has(key) && artLevelFitsUniversity(input, university) && isPlausibleArtFallbackUniversity(input, university);
  });
  const available = filtered.length ? filtered : universities.filter((university: any) => {
    const key = university?.id || university?.name;
    return key && !excluded.has(key) && artLevelFitsUniversity(input, university);
  });
  const ranked = available
    .map((university: any) => ({
      university,
      preferenceScore: matchScorePreferences(input, artFallbackPreferenceSource(input, university)).score,
      relevanceScore: artUniversityRelevanceScore(input, university),
      qualityScore: universityQualityScore(university),
      detailScore: university.id ? 2400 : 0,
      staticPenalty: university.__staticArtFallback ? 450 : 0,
      specialPenalty: specialArtFallbackPenalty(input, university),
      localScore: university.province === input.province ? 600 : 0,
    }))
    .sort((a, b) =>
      artFallbackRankScore(b, 'stable') -
      artFallbackRankScore(a, 'stable') ||
      String(a.university.name || '').localeCompare(String(b.university.name || ''), 'zh-Hans-CN')
    );
  const relevantRanked = ranked.filter(item => item.relevanceScore > 0 || item.preferenceScore > 0);
  const primaryRanked = relevantRanked.length ? relevantRanked : ranked;

  const result: Record<RecommendationBucket, any[]> = { rush: [], stable: [], safe: [] };
  const used = new Set<string>();
  const takeFor = (bucket: RecommendationBucket, sorted: typeof ranked) => {
    for (const item of sorted) {
      if (result[bucket].length >= targetPerBucket) break;
      const key = item.university.id || item.university.name;
      if (!key || used.has(key)) continue;
      used.add(key);
      result[bucket].push(item.university);
    }
  };

  takeFor('rush', [...primaryRanked].sort((a, b) =>
    artFallbackRankScore(b, 'rush') - artFallbackRankScore(a, 'rush')
  ));
  takeFor('stable', [...primaryRanked].sort((a, b) =>
    artFallbackRankScore(b, 'stable') - artFallbackRankScore(a, 'stable')
  ));
  takeFor('safe', [...primaryRanked].sort((a, b) =>
    artFallbackRankScore(b, 'safe', input) - artFallbackRankScore(a, 'safe', input)
  ));

  for (const bucket of RECOMMENDATION_BUCKETS) {
    takeFor(bucket, ranked);
  }
  return result;
}

function artFallbackRankScore(
  item: {
    university: any;
    preferenceScore: number;
    relevanceScore: number;
    qualityScore: number;
    detailScore: number;
    staticPenalty: number;
    specialPenalty: number;
    localScore: number;
  },
  bucket: RecommendationBucket,
  input?: VolunteerAnalyzeInput,
) {
  const safeScore = input ? artSafetyScore(input, item.university) : 0;
  const qualityWeight = bucket === 'rush' ? 0.35 : bucket === 'stable' ? 0.25 : 0.1;
  const safetyWeight = bucket === 'safe' ? 1 : 0;
  return (
    item.detailScore +
    item.relevanceScore * 3.2 +
    item.preferenceScore * 0.9 +
    item.localScore +
    item.qualityScore * qualityWeight +
    safeScore * safetyWeight -
    item.staticPenalty -
    item.specialPenalty
  );
}

function specialArtFallbackPenalty(input: VolunteerAnalyzeInput, university: any) {
  const name = String(university?.name || '');
  const category = String(input.artCategory || '');
  let penalty = 0;
  if (/清华大学美术学院|清华大学|中央美术学院|中国美术学院/u.test(name) && !category.includes('美术') && !category.includes('设计')) {
    penalty += 5000;
  }
  if (/美术学院/u.test(name) && !category.includes('美术') && !category.includes('设计')) {
    penalty += 2600;
  }
  if (/音乐学院/u.test(name) && !category.includes('音乐')) {
    penalty += 1800;
  }
  if (/舞蹈学院/u.test(name) && !category.includes('舞蹈')) {
    penalty += 1800;
  }
  return penalty;
}

function buildArtFallbackCandidate(
  input: VolunteerAnalyzeInput,
  university: any,
  bucket: RecommendationBucket,
  index: number,
  options: {
    rule?: ArtRule;
    compositeScore?: number;
  } = {},
): Candidate {
  const preference = matchScorePreferences(input, artFallbackPreferenceSource(input, university));
  const preferenceTags = buildPreferenceTags(preference);
  const warningTags = ['资料候选', '需核对投档线', ...buildWarningTags(input, preference)];
  const reason = buildArtFallbackCandidateReason(input, university, bucket, options);
  const year = options.rule?.year || input.year || null;
  const relatedMajorNames = Array.isArray(university.__artMajorNames) ? university.__artMajorNames.slice(0, 3) : [];
  const majorName = relatedMajorNames[0] || null;

  return {
    universityId: university.id,
    universityName: university.name,
    province: university.province || null,
    city: university.city || null,
    type: university.type || null,
    level: university.level || null,
    tags: buildUniversityTags(university),
    year,
    batch: artBatch(input),
    subjectType: normalizeArtSubjectType(input.subjectType),
    majorName,
    minScore: null,
    minRank: null,
    avgScore: null,
    planCount: null,
    compositeScore: null,
    cultureScore: null,
    professionalScore: null,
    artCategory: input.artCategory || null,
    admissionMethod: null,
    preferenceTags,
    warningTags: [...new Set(warningTags)],
    reason,
    optionLines: [{
      title: relatedMajorNames.length ? `相关方向：${relatedMajorNames.join('、')}` : `${input.artCategory || '艺术类'}资料候选 ${index + 1}`,
      bucket,
      lineType: 'art_fallback',
      groupCode: null,
      groupName: null,
      subjectRequirement: normalizeArtSubjectType(input.subjectType),
      year,
      batch: artBatch(input),
      subjectType: normalizeArtSubjectType(input.subjectType),
      majorName,
      minScore: null,
      minRank: null,
      avgScore: null,
      planCount: null,
      compositeScore: null,
      cultureScore: null,
      professionalScore: null,
      artCategory: input.artCategory || null,
      admissionMethod: null,
      preferenceTags,
      warningTags: [...new Set(warningTags)],
      reason,
    }],
  };
}

function buildArtFallbackCandidateReason(
  input: VolunteerAnalyzeInput,
  university: any,
  bucket: RecommendationBucket,
  options: {
    rule?: ArtRule;
    compositeScore?: number;
  } = {},
) {
  const category = input.artCategory || '艺术类';
  const location = [university.city, university.province].filter(Boolean).join(' · ');
  const basis = options.rule && Number.isFinite(Number(options.compositeScore))
    ? `你的折算综合分约 ${formatScore(options.compositeScore)}，但该档可用投档线不足。`
    : '当前缺少可直接折算比较的官方艺术类规则或投档线。';
  const tags = [university.type, university.level, ...(buildUniversityTags(university) || [])]
    .filter(Boolean)
    .slice(0, 3)
    .join('、');
  return `${basis}先把${university.name}${location ? `（${location}）` : ''}作为${BUCKET_LABELS[bucket]}方向的${category}资料候选；${tags ? `院校属性：${tags}。` : ''}填报前必须核对本省艺术类招生计划、承认统考/校考要求、专业方向和近年投档线。`;
}

function artFallbackPreferenceSource(input: VolunteerAnalyzeInput, university: any) {
  return {
    universityName: university.name,
    university,
    rawData: [
      university.type,
      university.level,
      university.properties,
      university.featureTags,
      ...(Array.isArray(university.__artMajorNames) ? university.__artMajorNames : []),
      input.artCategory,
      ...artCategoryKeywords(input),
    ].filter(Boolean).join(' '),
  };
}

function buildUniversityLevelWhere(input: VolunteerAnalyzeInput) {
  const level = artBatch(input);
  if (level === '专科') {
    return {
      OR: [
        { level: { contains: '专科' } },
        { level: { contains: '高职' } },
      ],
    };
  }
  return {
    OR: [
      { level: { contains: '本科' } },
      { level: null },
    ],
  };
}

function artCategoryKeywords(input: VolunteerAnalyzeInput) {
  const category = String(input.artCategory || '').trim();
  const keywords = new Set<string>([
    category,
    category.replace(/[（）()]/g, ''),
    ...normalizeKeywords(input.preferredMajors),
  ].filter(Boolean));
  if (category.includes('美术') || category.includes('设计')) {
    ['美术', '设计', '绘画', '视觉传达', '环境设计', '产品设计', '动画', '数字媒体艺术'].forEach(item => keywords.add(item));
  }
  if (category.includes('音乐')) {
    ['音乐', '声乐', '器乐', '作曲', '音乐表演', '音乐学'].forEach(item => keywords.add(item));
  }
  if (category.includes('舞蹈')) {
    ['舞蹈', '舞蹈表演', '舞蹈学', '舞蹈编导'].forEach(item => keywords.add(item));
  }
  if (category.includes('表') || category.includes('导') || category.includes('演')) {
    ['表演', '导演', '戏剧', '影视', '戏剧影视导演', '戏剧影视文学'].forEach(item => keywords.add(item));
  }
  if (category.includes('播音') || category.includes('主持')) {
    ['播音', '主持', '播音与主持艺术'].forEach(item => keywords.add(item));
  }
  if (category.includes('书法')) {
    ['书法', '书法学'].forEach(item => keywords.add(item));
  }
  return [...keywords].filter(Boolean);
}

function artUniversityRelevanceScore(input: VolunteerAnalyzeInput, university: any) {
  const majorNames = Array.isArray(university.__artMajorNames) ? university.__artMajorNames : [];
  const text = joinSearchText(university.name, university.type, university.featureTags, university.properties, ...majorNames);
  let score = 0;
  if (majorNames.length) score += 1400 + Math.min(majorNames.length, 6) * 120;
  if (text.includes('艺术')) score += 900;
  if (text.includes('美术') || text.includes('音乐') || text.includes('戏剧') || text.includes('电影') || text.includes('传媒')) score += 700;
  for (const keyword of artCategoryKeywords(input)) {
    if (keyword && text.includes(keyword)) score += 260;
  }
  return score;
}

function isPlausibleArtFallbackUniversity(input: VolunteerAnalyzeInput, university: any) {
  if (artUniversityRelevanceScore(input, university) > 0) return true;
  const text = joinSearchText(university.name, university.type, university.properties);
  if (/医药|医学|中医|药科|公安|警察|司法|军事|军医|海关|消防/u.test(text)) return false;
  if (/艺术|传媒|戏剧|电影|美术|音乐|舞蹈|体育|师范|综合|语言|民族/u.test(text)) return true;
  return false;
}

function artLevelFitsUniversity(input: VolunteerAnalyzeInput, university: any) {
  const level = String(university?.level || '');
  if (!level) return true;
  if (artBatch(input) === '专科') return level.includes('专科') || level.includes('高职');
  return level.includes('本科') || (!level.includes('专科') && !level.includes('高职'));
}

function universityQualityScore(university: any) {
  return (
    (university?.is985 ? 1800 : 0) +
    (university?.is211 ? 1200 : 0) +
    (university?.isDoubleFirst ? 900 : 0) +
    (String(university?.level || '').includes('本科') ? 260 : 0) +
    (String(university?.type || '').includes('艺术') ? 220 : 0)
  );
}

function artSafetyScore(input: VolunteerAnalyzeInput, university: any) {
  const sameProvince = university?.province && university.province === input.province ? 900 : 0;
  const nonElite = university?.is985 || university?.is211 || university?.isDoubleFirst ? 0 : 320;
  const level = String(university?.level || '');
  const levelFit = artBatch(input) === '专科'
    ? (level.includes('专科') || level.includes('高职') ? 500 : 0)
    : (level.includes('本科') ? 260 : 0);
  return sameProvince + nonElite + levelFit + artUniversityRelevanceScore(input, university);
}

function uniqueUniversities(items: any[]) {
  const result: any[] = [];
  const byKey = new Map<string, any>();
  for (const item of items || []) {
    const key = universityMergeKey(item);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      mergeUniversityCandidateMetadata(existing, item);
      if (!existing.id && item.id) {
        Object.assign(existing, item, {
          __artMajorNames: existing.__artMajorNames,
          __majorNames: existing.__majorNames,
          __artMajorMatchCount: existing.__artMajorMatchCount,
          __majorMatchCount: existing.__majorMatchCount,
        });
      }
      continue;
    }
    byKey.set(key, item);
    result.push(item);
  }
  return result;
}

function universityMergeKey(item: any) {
  const name = String(item?.name || '').trim().replace(/\s+/g, '');
  if (name) return `name:${name}`;
  return item?.id ? `id:${item.id}` : '';
}

function mergeUniversityCandidateMetadata(target: any, source: any) {
  const artMajors = [
    ...(Array.isArray(target.__artMajorNames) ? target.__artMajorNames : []),
    ...(Array.isArray(source.__artMajorNames) ? source.__artMajorNames : []),
  ];
  target.__artMajorNames = [...new Set(artMajors)];
  const normalMajors = [
    ...(Array.isArray(target.__majorNames) ? target.__majorNames : []),
    ...(Array.isArray(source.__majorNames) ? source.__majorNames : []),
  ];
  target.__majorNames = [...new Set(normalMajors)];
  target.__artMajorMatchCount = Math.max(
    Number(target.__artMajorMatchCount || 0),
    Number(source.__artMajorMatchCount || 0),
  );
  target.__majorMatchCount = Math.max(
    Number(target.__majorMatchCount || 0),
    Number(source.__majorMatchCount || 0),
  );
}

function cloneRecommendationGroups(groups: VolunteerResult['recommendations']) {
  return {
    rush: [...(groups.rush || [])],
    stable: [...(groups.stable || [])],
    safe: [...(groups.safe || [])],
  };
}

function countRecommendations(groups: VolunteerResult['recommendations']) {
  return RECOMMENDATION_BUCKETS.reduce((total, bucket) => total + (groups[bucket]?.length || 0), 0);
}

function hasFallbackRecommendation(groups: VolunteerResult['recommendations']) {
  return RECOMMENDATION_BUCKETS.some(bucket =>
    groups[bucket]?.some(item => item.optionLines?.some(line => ['art_fallback', 'normal_fallback'].includes(String(line.lineType || '')))),
  );
}

function mergeReferences(
  left: Array<{ type: string; title: string; source?: string }>,
  right: Array<{ type: string; title: string; source?: string }>,
) {
  const seen = new Set<string>();
  const result: Array<{ type: string; title: string; source?: string }> = [];
  for (const item of [...left, ...right]) {
    const key = [item.type, item.title, item.source].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result.slice(0, 10);
}

function buildUnsupportedArtResult(
  input: VolunteerAnalyzeInput,
  message: string,
  fallback?: RecommendationClassificationResult,
): VolunteerResult {
  const category = input.artCategory || '艺术类';
  const recommendations = fallback?.recommendations || { rush: [], stable: [], safe: [] };
  const total = countRecommendations(recommendations);
  return {
    summary: total
      ? `${input.province}${category}暂未配置可直接折算的官方规则，已先按院校库生成冲稳保方向候选。${message}`
      : `${input.province}${category}暂不能生成院校推荐：${message}`,
    scorePosition: total
      ? '当前缺少可直接套用的官方艺术类折算规则，以下院校只作为资料候选，不能当作录取概率结论。'
      : '艺术类必须按本省当年官方折算规则和同类别投档线判断，普通类分数/位次不能直接套用。',
    strategy: strategyLabel(input.riskPreference),
    recommendations,
    recommendationStats: fallback?.stats || {
      rush: 0,
      stable: 0,
      safe: 0,
      displayLimit: normalizeRecommendationLimit(input.recommendationLimit),
      preferenceMatched: 0,
      avoidMajorExcluded: 0,
    },
    majorAdvice: [
      '建议先确认所在省份艺术类综合分公式、文化控制线和专业统考合格线。',
      total
        ? '当前列表中的“资料候选”用于先把方向列出来，后续必须逐所核对招生章程、承认统考/校考和近年投档线。'
        : '涨识会优先补齐官方省统考平行志愿投档线；缺数据时不会强行给院校清单。',
    ],
    cityAdvice: buildCityAdvice(input),
    risks: [
      '艺术类规则省份差异很大，不能拿其他省公式套用。',
      '校考和顺序志愿通常需要单独看院校章程，不适合直接用平行志愿模型预测。',
      ...(total ? ['带“资料候选”的学校不能替代官方投档线，正式填报前必须回到考试院和院校招生章程核对。'] : []),
    ],
    references: fallback?.references || [],
  };
}

function buildArtCandidateReason(input: VolunteerAnalyzeInput, row: any, compositeScore: number, bucket: RecommendationBucket, preference: PreferenceMatch) {
  const diff = Number(row.minCompositeScore) - compositeScore;
  const base = `${row.year}年艺术类投档综合分约 ${formatScore(row.minCompositeScore)}，与你的折算分差 ${diff > 0 ? '+' : ''}${formatScore(diff)}，归为${BUCKET_LABELS[bucket]}档。`;
  return [base, ...buildPreferenceReasonParts(input, preference)].join('');
}

function matchArtPreferences(input: VolunteerAnalyzeInput, row: any): PreferenceMatch {
  return matchScorePreferences(input, {
    universityName: row.universityName,
    university: row.university,
    majorName: row.majorName,
    groupName: row.groupName,
    groupCode: row.groupCode,
    rawData: row.rawData,
    lineType: 'major',
  });
}

function uniqueArtAdmissionScores(scores: any[]) {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const score of scores) {
    if (seen.has(score.id)) continue;
    seen.add(score.id);
    result.push(score);
  }
  return result;
}

function buildArtLocationFilter(input: VolunteerAnalyzeInput) {
  const preferredLocations = normalizeKeywords(input.preferredCities);
  if (!preferredLocations.length) return null;
  const OR: any[] = [];
  for (const location of preferredLocations) {
    for (const variant of keywordVariants(location)) {
      OR.push(
        { university: { is: { city: { contains: variant } } } },
        { university: { is: { province: { contains: variant } } } },
      );
    }
  }
  return OR.length ? { OR } : null;
}

function buildArtMajorPreferenceWhere(input: VolunteerAnalyzeInput) {
  const preferredMajors = normalizeKeywords(input.preferredMajors);
  if (!preferredMajors.length) return null;
  return {
    OR: preferredMajors.flatMap(major => keywordVariants(major).flatMap(variant => [
      { majorName: { contains: variant } },
      { groupName: { contains: variant } },
      { rawData: { contains: variant } },
    ])),
  };
}

function artBatch(input: VolunteerAnalyzeInput) {
  if (input.artLevel) return input.artLevel;
  if (input.targetBatch?.includes('专科')) return '专科';
  return '本科';
}

function normalizeArtSubjectType(subjectType: string) {
  if (['物理类', '历史类'].includes(subjectType)) return subjectType;
  if (['综合', '综合改革'].includes(subjectType)) return '综合改革';
  return '不限';
}

function formatScore(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '未知';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export async function getArtAdmissionSupport() {
  const dbRules = await prisma.artAdmissionRule.findMany({
    select: {
      province: true,
      year: true,
      artCategory: true,
      batch: true,
      subjectType: true,
      cultureFullScore: true,
      professionalFullScore: true,
      sourceName: true,
      sourceUrl: true,
    },
    orderBy: [{ year: 'desc' }, { province: 'asc' }, { artCategory: 'asc' }],
  }).catch(() => []);
  const builtin = builtinArtRules().map(rule => ({
    province: rule.province,
    year: rule.year,
    artCategory: rule.artCategory,
    batch: rule.batch,
    subjectType: rule.subjectType,
    cultureFullScore: rule.cultureFullScore,
    professionalFullScore: rule.professionalFullScore,
    sourceName: rule.sourceName,
    sourceUrl: rule.sourceUrl,
  }));
  const map = new Map<string, any>();
  for (const item of [...builtin, ...dbRules]) {
    map.set([item.province, item.year, item.artCategory, item.batch, item.subjectType].join('|'), item);
  }
  return [...map.values()];
}

function classifyCandidates(input: VolunteerAnalyzeInput, scores: any[]) {
  const all: Record<RecommendationBucket, RankedCandidate[]> = { rush: [], stable: [], safe: [] };
  const seen = new Set<string>();
  const displayLimit = normalizeRecommendationLimit(input.recommendationLimit);
  let avoidMajorExcluded = 0;

  for (const score of scores) {
    const bucket = classifyOne(input, score);
    if (!bucket) continue;

    const preference = matchScorePreferences(input, score);
    if (preference.avoidMajorMatches.length && preference.explicitMajorLine) {
      avoidMajorExcluded += 1;
      continue;
    }

    const key = [
      score.universityName,
      score.majorName || score.universityMajor?.majorName || score.groupName || score.groupCode || score.lineType || '',
    ].join(':');
    if (seen.has(key)) continue;
    seen.add(key);

    const reason = buildCandidateReason(input, score, bucket, preference);
    const warningTags = buildWarningTags(input, preference);
    const preferenceTags = buildPreferenceTags(preference);

    all[bucket].push({
      preferenceScore: preference.score,
      distance: candidateDistance(input, score),
      year: Number(score.year || 0),
      bucket,
      candidate: {
        universityId: score.universityId,
        universityName: score.universityName,
        province: score.university?.province || null,
        city: score.university?.city || null,
        type: score.university?.type || null,
        level: score.university?.level || null,
        tags: buildUniversityTags(score.university),
        year: score.year,
        batch: score.batch,
        subjectType: score.subjectType,
        majorName: score.majorName || score.universityMajor?.majorName || score.groupName || null,
        minScore: score.minScore,
        minRank: score.minRank,
        avgScore: score.avgScore,
        planCount: score.planCount,
        preferenceTags,
        warningTags,
        reason,
        optionLines: [buildCandidateOptionLine(score, bucket, preferenceTags, warningTags, reason)],
      },
    });
  }

  all.rush.sort(sortRankedCandidates);
  all.stable.sort(sortRankedCandidates);
  all.safe.sort(sortRankedCandidates);

  const groupedAll = groupRankedCandidates([
    ...all.rush,
    ...all.stable,
    ...all.safe,
  ]).sort(sortRankedCandidates);
  const grouped = splitGroupedCandidates(groupedAll);

  return {
    recommendations: {
      rush: grouped.rush.slice(0, displayLimit).map(item => item.candidate),
      stable: grouped.stable.slice(0, displayLimit).map(item => item.candidate),
      safe: grouped.safe.slice(0, displayLimit).map(item => item.candidate),
    },
    stats: {
      rush: grouped.rush.length,
      stable: grouped.stable.length,
      safe: grouped.safe.length,
      displayLimit,
      preferenceMatched: groupedAll.filter(item => hasPreferenceMatch(item.candidate)).length,
      avoidMajorExcluded,
    },
  };
}

function splitGroupedCandidates(items: RankedCandidate[]) {
  const result: Record<RecommendationBucket, RankedCandidate[]> = { rush: [], stable: [], safe: [] };
  for (const item of items) {
    const bucket = chooseCandidateBucket(item.candidate.optionLines || [], item.bucket);
    result[bucket].push(item);
  }
  return result;
}

function chooseCandidateBucket(lines: CandidateOptionLine[], fallback?: RecommendationBucket): RecommendationBucket {
  const order: RecommendationBucket[] = ['stable', 'safe', 'rush'];
  const counts: Record<RecommendationBucket, number> = { rush: 0, stable: 0, safe: 0 };
  for (const line of lines) {
    if (line.bucket) counts[line.bucket] += 1;
  }
  const best = order
    .map(bucket => ({ bucket, count: counts[bucket] }))
    .sort((a, b) => b.count - a.count)[0];
  return best?.count ? best.bucket : fallback || 'stable';
}

function groupRankedCandidates(items: RankedCandidate[]) {
  const grouped = new Map<string, RankedCandidate>();
  for (const item of items) {
    const key = item.candidate.universityId || item.candidate.universityName;
    const existing = grouped.get(key);
    if (!existing) {
      item.candidate.optionLines = normalizeCandidateOptionLines(item.candidate);
      grouped.set(key, item);
      continue;
    }

    existing.preferenceScore = Math.max(existing.preferenceScore, item.preferenceScore);
    existing.distance = Math.min(existing.distance, item.distance);
    existing.year = Math.max(existing.year, item.year);
    existing.bucket = chooseCandidateBucket(
      [
        ...normalizeCandidateOptionLines(existing.candidate),
        ...normalizeCandidateOptionLines(item.candidate),
      ],
      existing.bucket,
    );
    existing.candidate.preferenceTags = mergeTags(existing.candidate.preferenceTags, item.candidate.preferenceTags);
    existing.candidate.warningTags = mergeTags(existing.candidate.warningTags, item.candidate.warningTags);
    existing.candidate.optionLines = mergeCandidateOptionLines(
      normalizeCandidateOptionLines(existing.candidate),
      normalizeCandidateOptionLines(item.candidate),
    );
  }
  return [...grouped.values()];
}

function normalizeCandidateOptionLines(candidate: Candidate) {
  return candidate.optionLines?.length
    ? candidate.optionLines
    : [candidateToOptionLine(candidate)];
}

function mergeCandidateOptionLines(current: CandidateOptionLine[], incoming: CandidateOptionLine[]) {
  const seen = new Set<string>();
  const result: CandidateOptionLine[] = [];
  for (const line of [...current, ...incoming]) {
    const key = [
      line.title,
      line.year,
      line.batch,
      line.minScore,
      line.minRank,
      line.subjectRequirement,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result.slice(0, 8);
}

function candidateToOptionLine(candidate: Candidate): CandidateOptionLine {
  return {
    title: candidate.majorName || '院校录取线',
    bucket: undefined,
    lineType: null,
    groupCode: null,
    groupName: null,
    subjectRequirement: null,
    year: candidate.year,
    batch: candidate.batch,
    subjectType: candidate.subjectType,
    majorName: candidate.majorName,
    minScore: candidate.minScore,
    minRank: candidate.minRank,
    avgScore: candidate.avgScore,
    planCount: candidate.planCount,
    preferenceTags: candidate.preferenceTags,
    warningTags: candidate.warningTags,
    reason: candidate.reason,
  };
}

function buildCandidateOptionLine(score: any, bucket: RecommendationBucket, preferenceTags: string[], warningTags: string[], reason: string): CandidateOptionLine {
  const title =
    score.majorName ||
    score.universityMajor?.majorName ||
    score.groupName ||
    (score.groupCode ? `专业组${score.groupCode}` : '') ||
    '院校录取线';
  return {
    title,
    bucket,
    lineType: score.lineType || null,
    groupCode: score.groupCode || null,
    groupName: score.groupName || null,
    subjectRequirement: score.subjectRequirement || null,
    year: score.year,
    batch: score.batch,
    subjectType: score.subjectType,
    majorName: score.majorName || score.universityMajor?.majorName || score.groupName || null,
    minScore: score.minScore,
    minRank: score.minRank,
    avgScore: score.avgScore,
    planCount: score.planCount,
    preferenceTags,
    warningTags,
    reason,
  };
}

function mergeTags(left: string[] = [], right: string[] = []) {
  return [...new Set([...(left || []), ...(right || [])].filter(Boolean))];
}

function hasPreferenceMatch(candidate: Candidate) {
  return Boolean(
    candidate.preferenceTags?.length ||
    candidate.optionLines?.some(line => line.preferenceTags?.length),
  );
}

function normalizeRecommendationLimit(limit?: number) {
  const value = Number(limit);
  if (!Number.isFinite(value) || value <= 0) return RECOMMENDATION_DISPLAY_LIMIT;
  return Math.min(MAX_RECOMMENDATION_DISPLAY_LIMIT, Math.max(1, Math.floor(value)));
}

function classifyOne(input: VolunteerAnalyzeInput, score: any): RecommendationBucket | null {
  if (input.rank && score.minRank) {
    const ratio = score.minRank / input.rank;
    const bands = rankBandsFor(input);
    if (ratio >= bands.rushMin && ratio < bands.rushMax) return 'rush';
    if (ratio >= bands.stableMin && ratio <= bands.stableMax) return 'stable';
    if (ratio > bands.safeMin && ratio <= bands.safeMax) return 'safe';
    return null;
  }

  if (score.minScore) {
    const diff = score.minScore - input.score;
    const bands = scoreBandsFor(input);
    if (diff > 0 && diff <= bands.rushAbove) return 'rush';
    if (diff >= -bands.stableBelow && diff <= bands.stableAbove) return 'stable';
    if (diff >= -bands.safeBelow && diff < -bands.stableBelow) return 'safe';
  }

  return null;
}

function rankBandsFor(input: VolunteerAnalyzeInput) {
  return hasLocationPreference(input) ? LOCATION_RANK_BANDS : DEFAULT_RANK_BANDS;
}

function scoreBandsFor(input: VolunteerAnalyzeInput) {
  return hasLocationPreference(input) ? LOCATION_SCORE_BANDS : DEFAULT_SCORE_BANDS;
}

function hasLocationPreference(input: VolunteerAnalyzeInput) {
  return normalizeKeywords(input.preferredCities).length > 0;
}

function buildCandidateReason(input: VolunteerAnalyzeInput, score: any, bucket: RecommendationBucket, preference: PreferenceMatch) {
  const bucketText: Record<string, string> = { rush: '冲刺', stable: '稳妥', safe: '保底' };
  let base = '';
  if (input.rank && score.minRank) {
    base = `${score.year}年最低位次 ${score.minRank}，相对你的位次 ${input.rank} 属于${bucketText[bucket]}档。`;
  } else if (score.minScore) {
    const diff = score.minScore - input.score;
    base = `${score.year}年最低分 ${score.minScore}，与你的分数差 ${diff > 0 ? '+' : ''}${diff} 分，属于${bucketText[bucket]}档。`;
  } else {
    base = `根据现有录取数据初步归为${bucketText[bucket]}档。`;
  }

  const extra = buildPreferenceReasonParts(input, preference);
  return [base, ...extra].join('');
}

function buildFallbackCandidateReason(input: VolunteerAnalyzeInput, preference: PreferenceMatch) {
  const base = '当前缺少匹配的历年录取数据，仅基于院校库和偏好做资料候选。';
  return [base, ...buildPreferenceReasonParts(input, preference)].join('');
}

function buildNormalFallbackCandidateReason(input: VolunteerAnalyzeInput, university: any, bucket: RecommendationBucket) {
  const location = [university.city, university.province].filter(Boolean).join(' · ');
  const relatedMajors = Array.isArray(university.__majorNames) && university.__majorNames.length
    ? `相关方向：${university.__majorNames.slice(0, 3).join('、')}。`
    : '';
  const base = `当前该档可用录取线不足，先把${university.name}${location ? `（${location}）` : ''}作为${BUCKET_LABELS[bucket]}方向的资料候选。`;
  return `${base}${relatedMajors}填报前必须核对近三年录取分/位次、专业组、选科要求和招生计划。`;
}

function buildMajorMatchUniversities(majorMatches: any[]) {
  const map = new Map<string, any>();
  for (const item of majorMatches || []) {
    const university = item?.university;
    const key = university?.id || university?.name;
    if (!key) continue;
    const existing = map.get(key) || {
      ...university,
      __majorNames: [],
      __majorMatchCount: 0,
    };
    const majorName = String(item.majorName || '').trim();
    if (majorName && !existing.__majorNames.includes(majorName)) {
      existing.__majorNames.push(majorName);
    }
    existing.__majorMatchCount += 1;
    map.set(key, existing);
  }
  return [...map.values()];
}

function normalFallbackPreferenceSource(input: VolunteerAnalyzeInput, university: any) {
  return {
    universityName: university.name,
    university,
    rawData: [
      university.type,
      university.level,
      university.properties,
      university.featureTags,
      ...(Array.isArray(university.__majorNames) ? university.__majorNames : []),
      ...normalizeKeywords(input.preferredMajors),
    ].filter(Boolean).join(' '),
  };
}

function normalMajorRelevanceScore(input: VolunteerAnalyzeInput, university: any) {
  const majorNames = Array.isArray(university.__majorNames) ? university.__majorNames : [];
  let score = majorNames.length ? 1000 + Math.min(majorNames.length, 8) * 100 : 0;
  const text = joinSearchText(university.name, university.type, university.featureTags, ...majorNames);
  for (const keyword of normalizeKeywords(input.preferredMajors)) {
    if (keyword && text.includes(keyword)) score += 260;
  }
  return score;
}

function normalSafetyScore(input: VolunteerAnalyzeInput, university: any) {
  const sameProvince = university?.province && university.province === input.province ? 900 : 0;
  const nonElite = university?.is985 || university?.is211 || university?.isDoubleFirst ? 0 : 300;
  const levelFit = normalLevelFitsUniversity(input, university) ? 260 : 0;
  return sameProvince + nonElite + levelFit + normalMajorRelevanceScore(input, university);
}

function buildNormalUniversityLevelWhere(input: VolunteerAnalyzeInput) {
  const batch = input.targetBatch || '';
  if (batch.includes('专科')) {
    return {
      OR: [
        { level: { contains: '专科' } },
        { level: { contains: '高职' } },
      ],
    };
  }
  return {
    OR: [
      { level: { contains: '本科' } },
      { level: null },
    ],
  };
}

function normalLevelFitsUniversity(input: VolunteerAnalyzeInput, university: any) {
  const level = String(university?.level || '');
  if (!level) return true;
  if ((input.targetBatch || '').includes('专科')) return level.includes('专科') || level.includes('高职');
  return level.includes('本科') || (!level.includes('专科') && !level.includes('高职'));
}

function normalFallbackBatch(input: VolunteerAnalyzeInput) {
  return (input.targetBatch || '').includes('专科') ? '专科' : '本科';
}

function buildPreferenceReasonParts(input: VolunteerAnalyzeInput, preference: PreferenceMatch) {
  const parts: string[] = [];
  if (preference.locationMatches.length) {
    parts.push(`匹配目标城市或省份：${preference.locationMatches.join('、')}。`);
  }
  if (preference.preferredMajorMatches.length) {
    parts.push(`匹配偏好方向：${preference.preferredMajorMatches.join('、')}。`);
  }
  if (preference.avoidMajorMatches.length) {
    parts.push(`出现规避关键词：${preference.avoidMajorMatches.join('、')}，需谨慎核对。`);
  } else if (normalizeKeywords(input.avoidMajors).length && !preference.hasMajorDetail) {
    parts.push('该条不是精确专业线，仍需核对专业组内是否混有规避方向。');
  }
  return parts;
}

function matchScorePreferences(input: VolunteerAnalyzeInput, score: any): PreferenceMatch {
  const preferredLocations = normalizeKeywords(input.preferredCities);
  const preferredMajors = normalizeKeywords(input.preferredMajors);
  const avoidMajors = normalizeKeywords(input.avoidMajors);

  const cityText = joinSearchText(
    score.university?.city,
    score.university?.province,
    score.city,
    score.province,
    score.universityName,
  );
  const provinceText = joinSearchText(score.university?.province, score.province);
  const majorText = joinSearchText(
    score.majorName,
    score.universityMajor?.majorName,
    score.universityMajor?.featureTags,
    score.universityMajor?.employmentNote,
    score.universityMajor?.subjectLimit,
    score.groupName,
    score.groupCode,
    score.subjectRequirement,
    score.rawData,
  );
  const hasMajorDetail = Boolean(
    score.majorName ||
    score.universityMajor?.majorName ||
    score.groupName ||
    score.groupCode ||
    ['major', 'major_group'].includes(score.lineType),
  );
  const explicitMajorLine = Boolean(
    score.majorName ||
    score.universityMajor?.majorName ||
    score.groupName ||
    ['major', 'major_group'].includes(score.lineType),
  );
  const cityMatches = matchKeywords(cityText, preferredLocations);
  const provinceMatches = matchKeywords(provinceText, preferredLocations);
  const locationMatches = [...new Set([...provinceMatches, ...cityMatches])];
  const preferredMajorMatches = matchKeywords(majorText, preferredMajors);
  const avoidMajorMatches = matchKeywords(majorText, avoidMajors);
  const preferenceScore =
    cityMatches.length * 700 +
    provinceMatches.length * 1200 +
    preferredMajorMatches.length * 700 +
    (locationMatches.length && preferredMajorMatches.length ? 300 : 0) -
    avoidMajorMatches.length * (explicitMajorLine ? 3000 : 600);

  return {
    locationMatches,
    cityMatches,
    provinceMatches,
    preferredMajorMatches,
    avoidMajorMatches,
    score: preferenceScore,
    explicitMajorLine,
    hasMajorDetail,
  };
}

function normalizeKeywords(items?: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items || []) {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function keywordVariants(keyword: string) {
  const variants = new Set<string>([keyword]);
  const trimmed = keyword.replace(/[省市区县]$/u, '');
  if (trimmed) variants.add(trimmed);
  return [...variants];
}

function joinSearchText(...parts: unknown[]) {
  return parts
    .map(part => typeof part === 'string' ? part : part === null || part === undefined ? '' : JSON.stringify(part))
    .filter(Boolean)
    .join(' ');
}

function matchKeywords(text: string, keywords: string[]) {
  if (!text || !keywords.length) return [];
  return keywords.filter(keyword => keywordVariants(keyword).some(variant => variant && text.includes(variant)));
}

function buildPreferenceTags(preference: PreferenceMatch) {
  return [
    ...preference.provinceMatches.map(province => `目标省份：${province}`),
    ...preference.cityMatches
      .filter(city => !preference.provinceMatches.includes(city))
      .map(city => `目标城市：${city}`),
    ...preference.preferredMajorMatches.map(major => `偏好方向：${major}`),
  ];
}

function buildWarningTags(input: VolunteerAnalyzeInput, preference: PreferenceMatch) {
  const warnings = preference.avoidMajorMatches.map(major => `规避方向：${major}`);
  if (normalizeKeywords(input.avoidMajors).length && !preference.hasMajorDetail) {
    warnings.push('需核对专业组');
  }
  return warnings;
}

function candidateDistance(input: VolunteerAnalyzeInput, score: any) {
  const preference = matchScorePreferences(input, score);
  if (preference.locationMatches.length || preference.preferredMajorMatches.length) {
    return 0;
  }
  if (input.rank && score.minRank) {
    return Math.abs(Number(score.minRank) - Number(input.rank)) / Number(input.rank);
  }
  if (score.minScore) {
    return Math.abs(Number(score.minScore) - Number(input.score));
  }
  return Number.MAX_SAFE_INTEGER;
}

function sortRankedCandidates(a: RankedCandidate, b: RankedCandidate) {
  if (b.preferenceScore !== a.preferenceScore) return b.preferenceScore - a.preferenceScore;
  if (b.year !== a.year) return b.year - a.year;
  if (a.distance !== b.distance) return a.distance - b.distance;
  return a.candidate.universityName.localeCompare(b.candidate.universityName, 'zh-Hans-CN');
}

function buildPreferenceExecutionSummary(input: VolunteerAnalyzeInput, stats: VolunteerResult['recommendationStats']) {
  const locations = normalizeKeywords(input.preferredCities);
  const preferred = normalizeKeywords(input.preferredMajors);
  const avoid = normalizeKeywords(input.avoidMajors);
  const parts = [
    locations.length ? `目标城市或省份 ${locations.join('、')}` : '',
    preferred.length ? `偏好方向 ${preferred.join('、')}` : '',
    avoid.length ? `规避方向 ${avoid.join('、')}` : '',
  ].filter(Boolean);
  if (!parts.length) return '';

  const matchedText = stats.preferenceMatched > 0
    ? `偏好命中 ${stats.preferenceMatched} 条候选。`
    : '当前录取数据里没有足够命中偏好的候选，结果不会假装满足，会保留分数/位次接近的备选。';
  const avoidText = stats.avoidMajorExcluded > 0
    ? `已剔除 ${stats.avoidMajorExcluded} 条明确命中规避方向的专业线。`
    : '';
  return `已按${parts.join('、')}调整排序。${matchedText}${avoidText}`;
}

function buildUniversityTags(university: any): string[] {
  if (!university) return [];
  return [
    university.is985 ? '985' : '',
    university.is211 ? '211' : '',
    university.isDoubleFirst ? '双一流' : '',
    university.type || '',
  ].filter(Boolean);
}

function buildMajorWhere(input: VolunteerAnalyzeInput) {
  const majors = [...(input.preferredMajors || []), ...(input.avoidMajors || [])].filter(Boolean);
  if (!majors.length) return {};
  return {
    OR: majors.flatMap(name => [
      { name: { contains: name } },
      { category: { contains: name } },
      { tags: { contains: name } },
    ]),
  };
}

function buildUniversityMajorPreferenceWhere(input: VolunteerAnalyzeInput) {
  const preferred = input.preferredMajors || [];
  const avoid = input.avoidMajors || [];
  const names = [...preferred, ...avoid].filter(Boolean);
  if (!names.length) return {};
  return {
    OR: names.flatMap(name => [
      { majorName: { contains: name } },
      { featureTags: { contains: name } },
      { employmentNote: { contains: name } },
    ]),
  };
}

function buildMajorAdvice(input: VolunteerAnalyzeInput, majors: any[] = [], universityMajors: any[] = []): string[] {
  const preferred = normalizeKeywords(input.preferredMajors);
  const avoid = normalizeKeywords(input.avoidMajors);
  const advice = preferred.length
    ? [`本次推荐已优先围绕 ${preferred.join('、')} 做排序；看结果时仍要确认具体专业线或专业组，不要只看学校名。`]
    : ['先确定就业导向、考研导向还是兴趣导向，再反推专业选择。'];
  for (const major of majors.slice(0, 4)) {
    const parts = [
      major.category ? `方向：${major.category}` : '',
      major.riskLevel ? `风险：${major.riskLevel}` : '',
      major.employment ? `就业：${major.employment}` : '',
    ].filter(Boolean);
    advice.push(`${major.name}：${parts.join('；') || major.description || '建议结合院校层次和专业组录取位次判断。'}`);
  }
  const matchedUniversityMajors = universityMajors.slice(0, 6).map((um: any) => `${um.university?.name || ''}${um.majorName}${um.subjectLimit ? `（选科：${um.subjectLimit}）` : ''}`).filter(Boolean);
  if (matchedUniversityMajors.length) {
    advice.push(`已匹配到候选院校中的相关专业：${matchedUniversityMajors.join('、')}。`);
  }
  if (avoid.length) advice.push(`明确专业线命中 ${avoid.join('、')} 的候选会被剔除；专业组/院校线没有细分专业时，需要再查招生专业组明细。`);
  advice.push('热门专业要重点看专业录取位次，不要只看院校最低位次。');
  return advice;
}

function buildCityAdvice(input: VolunteerAnalyzeInput): string[] {
  const locations = normalizeKeywords(input.preferredCities);
  if (locations.length) {
    return [
      `本次候选已优先展示命中 ${locations.join('、')} 的院校；如果填的是省份，会优先看该省内各城市院校。`,
      '同档院校里，城市资源往往会影响实习、考研信息和第一份工作机会。',
    ];
  }
  return ['城市/省份偏好未明确时，建议按省会/强产业城市/家庭可接受距离做三档筛选。'];
}

function buildRisks(input: VolunteerAnalyzeInput, usedFallback: boolean, baselineWarning = ''): string[] {
  const risks = [
    '平行志愿不是完全没有风险，专业组、调剂范围和体检限制都要逐项核对。',
    '冲刺档不要堆太多热门专业，稳妥档要保证专业接受度，保底档要真的能接受去读。',
    '最终填报前必须以本省考试院和高校当年招生章程为准。',
  ];
  if (baselineWarning) risks.unshift(`${baselineWarning} 当前更适合先评估专科/高职方案，或把本科目标改成明确的试探志愿，而不是按正常本科池理解“冲稳保”。`);
  if (normalizeKeywords(input.avoidMajors).length) risks.unshift('规避专业只会剔除明确命中的专业线；遇到院校线或专业组线，必须再核对组内专业构成。');
  if (!input.rank) risks.unshift('未提供位次会降低判断准确度，分数在不同年份之间不能直接硬比。');
  if (usedFallback) risks.unshift('当前缺少匹配录取数据，报告只能作为方向性参考，不能直接作为填报清单。');
  return risks;
}

function strategyLabel(riskPreference?: string) {
  if (riskPreference === 'conservative') return '稳妥优先，降低滑档风险';
  if (riskPreference === 'aggressive') return '适度进攻，多给冲刺档空间';
  return '稳中带冲，冲稳保均衡配置';
}

async function generateMarkdownReport(input: VolunteerAnalyzeInput, result: VolunteerResult, retrieval: any) {
  const aiConfig = await getAiConfig();
  const runtime = resolveAiRuntime(aiConfig);

  if (!runtime.apiKey) {
    return fallbackMarkdown(result);
  }

  const prompt = `你是涨识小程序里的赛博张老师，请基于结构化数据生成一份中文高考志愿分析报告。
要求：
1. 先讲结论，再讲冲稳保，再讲专业和城市，最后讲风险。
2. 不要编造不存在的数据；缺数据要明确提示。
3. 语气接地气、直接，但不要羞辱用户。
4. 不要添加固定风险提示段落；如果某条建议数据不足，只在该条里说明缺口。
5. 必须围绕用户的目标城市或省份、偏好专业/方向、规避专业/方向解释推荐排序；如果目标填的是省份，要优先解释该省内各城市院校的命中情况。不要推荐已明确命中规避专业的专业线，除非只是作为风险提醒。

用户输入：
${JSON.stringify(input, null, 2)}

结构化分析：
${JSON.stringify(result, null, 2)}

可参考知识：
${retrieval.knowledge.map((k: any) => `- ${k.title}: ${k.content.slice(0, 260)}`).join('\n')}`;

  try {
    const response = await axios.post(
      chatCompletionsUrl(runtime.baseUrl),
      {
        model: runtime.model,
        messages: [
          { role: 'system', content: '你负责生成高考志愿分析报告，必须严谨、可追溯、避免编造录取结论。' },
          { role: 'user', content: prompt },
        ],
        temperature: Math.min(aiConfig.temperature ?? 0.7, 0.8),
        max_tokens: aiConfig.maxTokens || 2200,
        top_p: aiConfig.topP || 0.9,
      },
      {
        headers: {
          Authorization: `Bearer ${runtime.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: Math.min(aiConfig.timeout || VOLUNTEER_REPORT_AI_TIMEOUT_MS, VOLUNTEER_REPORT_AI_TIMEOUT_MS),
      }
    );
    return sanitizeAiOutput(response.data.choices[0]?.message?.content || fallbackMarkdown(result));
  } catch (err) {
    logger.warn('志愿报告 AI 生成失败，使用本地报告: %s', (err as Error).message);
    return fallbackMarkdown(result);
  }
}

async function getAiConfig() {
  let aiConfig = await prisma.aiConfig.findFirst();
  if (!aiConfig) {
    const pointSettings = await getPointSettings();
    aiConfig = await prisma.aiConfig.create({
      data: {
        model: DEFAULT_DEEPSEEK_MODEL,
        provider: 'deepseek',
        temperature: 0.7,
        maxTokens: 2200,
        topP: 0.9,
        contextWindow: 10,
        skillEnabled: true,
        skillWeight: 0.6,
        pointsPerQuery: pointSettings.defaultCost,
        pointsPerDeep: pointSettings.deepAnalysisCost,
      },
    });
  }
  return aiConfig;
}

function fallbackMarkdown(result: VolunteerResult) {
  const section = (title: string, items: Candidate[]) => {
    if (!items.length) return `\n## ${title}\n暂无足够匹配数据。`;
    return `\n## ${title}\n${items.slice(0, 6).map(item => `- ${item.universityName}${item.majorName ? ` / ${item.majorName}` : ''}：${item.reason}`).join('\n')}`;
  };

  return `# AI 高考志愿分析报告

${result.summary}

## 分数定位
${result.scorePosition}

${section('冲刺建议', result.recommendations.rush)}
${section('稳妥建议', result.recommendations.stable)}
${section('保底建议', result.recommendations.safe)}

## 专业建议
${result.majorAdvice.map(item => `- ${item}`).join('\n')}

## 城市建议
${result.cityAdvice.map(item => `- ${item}`).join('\n')}

## 风险提示
${result.risks.map(item => `- ${item}`).join('\n')}`;
}

async function refundVolunteerPoints(userId: string, amount: number, sourceId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.pointsAccount.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });
    const account = await tx.pointsAccount.findUnique({ where: { userId } });
    await tx.pointsTransaction.create({
      data: {
        userId,
        type: 'refund',
        amount,
        balanceAfter: account!.balance,
        source: 'volunteer_analysis',
        sourceId,
        remark: '志愿分析失败，退还点数',
      },
    });
  });
}

function safeJson(raw: string, fallback: unknown) {
  try { return JSON.parse(raw); } catch { return fallback; }
}
