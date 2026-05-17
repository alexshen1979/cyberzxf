import axios from 'axios';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { deductPoints } from './points.service';
import { createLogger } from '../utils/logger';
import { getPointSettings } from './point-config.service';
import { sanitizeAiOutput } from './ai.service';

const logger = createLogger('volunteer');
const RECOMMENDATION_DISPLAY_LIMIT = 12;
const MAX_RECOMMENDATION_DISPLAY_LIMIT = 300;
const VOLUNTEER_REPORT_AI_TIMEOUT_MS = 8000;

export interface VolunteerAnalyzeInput {
  province: string;
  year?: number;
  subjectType: string;
  score: number;
  rank?: number;
  targetBatch?: string;
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
  const retrieval = await retrieveVolunteerContext(normalized);
    const result = buildStructuredResult(normalized, retrieval);
    const markdownReport = sanitizeAiOutput(await generateMarkdownReport(normalized, result, retrieval));

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
  const retrieval = await retrieveVolunteerContext(normalized);
  return buildStructuredResult(normalized, retrieval);
}

async function normalizeVolunteerInput(input: VolunteerAnalyzeInput) {
  const year = input.year || await getDefaultVolunteerDataYear();
  return {
    ...input,
    year,
    riskPreference: input.riskPreference || 'balanced',
    preferredCities: input.preferredCities || [],
    preferredMajors: input.preferredMajors || [],
    avoidMajors: input.avoidMajors || [],
    province: input.province.trim(),
    subjectType: input.subjectType.trim(),
    score: Number(input.score),
    rank: input.rank ? Number(input.rank) : undefined,
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
        province: true,
        year: true,
        subjectType: true,
        score: true,
        rank: true,
        pointsCost: true,
        createdAt: true,
      },
    }),
    prisma.volunteerReport.count({ where: { userId } }),
  ]);

  return { list: items, total, page, pageSize };
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

function validateInput(input: VolunteerAnalyzeInput) {
  if (!input.province?.trim()) {
    throw new AppError(422, '请选择高考省份', 'VOLUNTEER_PROVINCE_REQUIRED');
  }
  if (!input.subjectType?.trim()) {
    throw new AppError(422, '请选择科类/选科类型', 'VOLUNTEER_SUBJECT_REQUIRED');
  }
  if (!Number.isFinite(Number(input.score)) || Number(input.score) < 0 || Number(input.score) > 750) {
    throw new AppError(422, '请输入有效高考分数', 'VOLUNTEER_SCORE_INVALID');
  }
  if (input.rank !== undefined && (!Number.isFinite(Number(input.rank)) || Number(input.rank) <= 0)) {
    throw new AppError(422, '请输入有效位次', 'VOLUNTEER_RANK_INVALID');
  }
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
  const admissionScores = await retrieveCandidateAdmissionScores(
    input,
    baseWhere,
    buildBatchFilter(input.targetBatch),
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

  let fallbackUniversities: any[] = [];
  if (admissionScores.length === 0) {
    const preferredLocationWhere = buildUniversityLocationPreferenceWhere(input);
    fallbackUniversities = await prisma.university.findMany({
      where: {
        OR: [
          { province: input.province },
          ...preferredLocationWhere,
        ],
      },
      orderBy: [{ is985: 'desc' }, { is211: 'desc' }, { isDoubleFirst: 'desc' }, { name: 'asc' }],
      take: 36,
    });
  }

  return { admissionScores, knowledge, majors, universityMajors, fallbackUniversities };
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
  const whereBase = batchFilter ? { AND: [baseWhere, batchFilter] } : baseWhere;
  const score = Number(input.score);
  const queries: Array<Promise<any[]>> = [];
  const preferenceWhere = buildAdmissionPreferenceWhere(input);

  if (input.rank) {
    const rank = Number(input.rank);
    queries.push(
      findAdmissionScoreBand(whereBase, { minRank: { gte: Math.floor(rank * 0.85), lt: Math.ceil(rank * 0.98) } }, 'rank-desc', 180),
      findAdmissionScoreBand(whereBase, { minRank: { gte: Math.floor(rank * 0.98), lte: Math.ceil(rank * 1.08) } }, 'rank-asc', 180),
      findAdmissionScoreBand(whereBase, { minRank: { gt: Math.floor(rank * 1.08), lte: Math.ceil(rank * 1.3) } }, 'rank-asc', 180),
    );

    if (preferenceWhere) {
      queries.push(
        findAdmissionScoreBand(
          whereBase,
          { AND: [preferenceWhere, { minRank: { gte: Math.floor(rank * 0.82), lte: Math.ceil(rank * 1.35) } }] },
          'rank-asc',
          240,
        ),
      );
    }
  }

  queries.push(
    findAdmissionScoreBand(whereBase, { minScore: { gt: score, lte: score + 15 } }, 'score-asc', 100),
    findAdmissionScoreBand(whereBase, { minScore: { gte: score - 10, lte: score + 5 } }, 'score-desc', 100),
    findAdmissionScoreBand(whereBase, { minScore: { gte: score - 40, lt: score - 10 } }, 'score-desc', 100),
  );

  if (preferenceWhere) {
    queries.push(
      findAdmissionScoreBand(
        whereBase,
        { AND: [preferenceWhere, { minScore: { gte: score - 45, lte: score + 18 } }] },
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

function buildBatchFilter(targetBatch?: string) {
  const batch = targetBatch?.trim();
  if (!batch) return null;

  if (['本科', '本科批', '本科普通批'].includes(batch)) {
    return {
      OR: [
        { batch: { contains: batch } },
        { batch: '本科' },
        { batch: { contains: '普通类本科' } },
        { batch: { contains: '本科批' } },
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
  const candidates = classified.recommendations;
  const recommendationStats = classified.stats;
  const usedFallback = retrieval.admissionScores.length === 0;

  if (usedFallback) {
    const fallback = retrieval.fallbackUniversities
      .map((u: any): RankedCandidate => {
        const preference = matchScorePreferences(input, { universityName: u.name, university: u });
        return {
          preferenceScore: preference.score,
          distance: 0,
          year: 0,
          candidate: {
            universityId: u.id,
            universityName: u.name,
            province: u.province,
            city: u.city,
            type: u.type,
            level: u.level,
            tags: buildUniversityTags(u),
            year: null,
            batch: null,
            subjectType: null,
            majorName: null,
            minScore: null,
            minRank: null,
            avgScore: null,
            planCount: null,
            preferenceTags: buildPreferenceTags(preference),
            warningTags: buildWarningTags(input, preference),
            reason: buildFallbackCandidateReason(input, preference),
          },
        };
      })
      .sort(sortRankedCandidates)
      .map((item: RankedCandidate) => item.candidate);
    candidates.stable = fallback.slice(0, 8);
    recommendationStats.stable = fallback.length;
    recommendationStats.preferenceMatched = fallback.filter((item: Candidate) => item.preferenceTags.length > 0).length;
  }

  const rankText = input.rank ? `，位次约 ${input.rank}` : '，暂未提供位次';
  const dataText = usedFallback ? '当前匹配录取数据不足，建议先补充位次和历年录取数据。' : '已结合历年录取数据做初步分档。';
  const preferenceText = buildPreferenceExecutionSummary(input, recommendationStats);

  return {
    summary: `${input.province}${input.subjectType}${input.score}分${rankText}，适合采用${strategyLabel(input.riskPreference)}。${dataText}${preferenceText}`,
    scorePosition: input.rank
      ? `以位次 ${input.rank} 为核心参考，优先看近三年最低位次波动。`
      : '未提供位次时只能用分差粗筛，准确度会明显下降，建议补充一分一段位次。',
    strategy: strategyLabel(input.riskPreference),
    recommendations: candidates,
    recommendationStats,
    majorAdvice: buildMajorAdvice(input, retrieval.majors, retrieval.universityMajors),
    cityAdvice: buildCityAdvice(input),
    risks: buildRisks(input, usedFallback),
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
      ...(usedFallback ? [{ type: 'university', title: '院校库基础信息' }] : [{ type: 'admission_score', title: '历年录取分数/位次数据' }]),
    ],
  };
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
    if (ratio >= 0.85 && ratio < 0.98) return 'rush';
    if (ratio >= 0.98 && ratio <= 1.08) return 'stable';
    if (ratio > 1.08 && ratio <= 1.3) return 'safe';
    return null;
  }

  if (score.minScore) {
    const diff = score.minScore - input.score;
    if (diff > 0 && diff <= 15) return 'rush';
    if (diff >= -10 && diff <= 5) return 'stable';
    if (diff >= -40 && diff < -10) return 'safe';
  }

  return null;
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

function buildRisks(input: VolunteerAnalyzeInput, usedFallback: boolean): string[] {
  const risks = [
    '平行志愿不是完全没有风险，专业组、调剂范围和体检限制都要逐项核对。',
    '冲刺档不要堆太多热门专业，稳妥档要保证专业接受度，保底档要真的能接受去读。',
    '最终填报前必须以本省考试院和高校当年招生章程为准。',
  ];
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
  const apiKey = (aiConfig.apiKey && aiConfig.apiKey.trim()) ? aiConfig.apiKey : config.deepseek.apiKey;
  const baseUrl = (aiConfig.apiBaseUrl && aiConfig.apiBaseUrl.trim()) ? aiConfig.apiBaseUrl : config.deepseek.baseUrl;

  if (!apiKey) {
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
      `${baseUrl}/v1/chat/completions`,
      {
        model: aiConfig.model || 'deepseek-chat',
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
          Authorization: `Bearer ${apiKey}`,
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
        model: 'deepseek-chat',
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
