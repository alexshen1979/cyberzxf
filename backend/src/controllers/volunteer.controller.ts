import { Context } from 'koa';
import {
  analyzeVolunteer,
  getVolunteerReport,
  listVolunteerReports,
  previewVolunteer,
  getArtAdmissionSupport,
  updateVolunteerReportTitle,
  VolunteerAnalyzeInput,
} from '../services/volunteer-analysis.service';
import {
  exportVolunteerReport,
  getVolunteerReportExportCosts,
  VolunteerReportExportType,
} from '../services/volunteer-report-export.service';
import { AppError } from '../middleware/errorHandler';
import {
  getAdmissionAutoFillStatus,
  startAdmissionAutoFill,
  stopAdmissionAutoFill,
} from '../services/admission-auto-fill.service';
import { prisma } from '../utils/prisma';
import fs from 'fs';

export async function analyze(ctx: Context) {
  const userId = ctx.state.user.userId;
  const body = ctx.request.body as VolunteerAnalyzeInput;

  const result = await analyzeVolunteer(userId, body);
  ctx.body = { success: true, data: result };
}

export async function preview(ctx: Context) {
  const body = ctx.request.body as VolunteerAnalyzeInput;
  const result = await previewVolunteer(body);
  ctx.body = { success: true, data: result };
}

export async function reports(ctx: Context) {
  const userId = ctx.state.user.userId;
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);

  const result = await listVolunteerReports(userId, page, pageSize);
  ctx.body = { success: true, data: result };
}

export async function reportDetail(ctx: Context) {
  const userId = ctx.state.user.userId;
  const result = await getVolunteerReport(userId, ctx.params.id);
  ctx.body = { success: true, data: result };
}

export async function updateReportTitle(ctx: Context) {
  const userId = ctx.state.user.userId;
  const { title } = ctx.request.body as any;
  const result = await updateVolunteerReportTitle(userId, ctx.params.id, title);
  ctx.body = { success: true, data: result, message: '报告名称已更新' };
}

export async function exportReport(ctx: Context) {
  const userId = ctx.state.user.userId;
  const type = normalizeExportType(String(ctx.query.type || 'pdf'));
  const file = await exportVolunteerReport(userId, ctx.params.id, type);

  ctx.set('Content-Type', file.contentType);
  ctx.set('Content-Disposition', contentDisposition(file.filename));
  ctx.set('Cache-Control', 'private, max-age=3600');
  ctx.body = fs.createReadStream(file.filePath);
}

export async function reportExportCosts(ctx: Context) {
  const costs = await getVolunteerReportExportCosts();
  ctx.body = { success: true, data: costs };
}

export async function artAdmissionSupport(ctx: Context) {
  ctx.body = { success: true, data: await getArtAdmissionSupport() };
}

function normalizeExportType(value: string): VolunteerReportExportType {
  if (value === 'image' || value === 'png') return 'image';
  return 'pdf';
}

function contentDisposition(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7E]+/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename)
    .replace(/['()]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, '%2A');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function scoreRankLookup(ctx: Context) {
  const province = String(ctx.query.province || '').trim();
  const subjectType = String(ctx.query.subjectType || '').trim();
  const year = Number(ctx.query.year);
  const score = Number(ctx.query.score);

  if (!province) throw new AppError(422, '请选择高考省份', 'SCORE_RANK_PROVINCE_REQUIRED');
  if (!subjectType) throw new AppError(422, '请选择科类/选科类型', 'SCORE_RANK_SUBJECT_REQUIRED');
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError(422, '请输入有效年份', 'SCORE_RANK_YEAR_INVALID');
  }
  const scoreMax = scoreRankMaxScore(province);
  if (!Number.isInteger(score) || score < 0 || score > scoreMax) {
    throw new AppError(422, `请输入0-${scoreMax}之间的高考分数`, 'SCORE_RANK_SCORE_INVALID');
  }

  const item = await prisma.scoreRank.findFirst({
    where: {
      province,
      year,
      score,
      subjectType: { in: subjectTypeCandidates(subjectType) },
    },
    orderBy: { subjectType: 'asc' },
  });
  const fallbackItem = item
    ? null
    : await prisma.scoreRank.findFirst({
        where: {
          province,
          year,
          score: { lt: score },
          subjectType: { in: subjectTypeCandidates(subjectType) },
        },
        orderBy: [{ score: 'desc' }, { subjectType: 'asc' }],
      });
  const matchedItem = item || fallbackItem;

  ctx.body = {
    success: true,
    data: matchedItem
      ? {
          available: true,
          exact: Boolean(item),
          province: matchedItem.province,
          year: matchedItem.year,
          subjectType: matchedItem.subjectType,
          score: matchedItem.score,
          requestedScore: score,
          rank: matchedItem.rank,
          sameScoreCount: matchedItem.sameScoreCount,
          sourceName: matchedItem.sourceName,
          sourceUrl: matchedItem.sourceUrl,
          sourceType: matchedItem.sourceType,
          message: item ? undefined : `暂无 ${score} 分精确段，已按 ${matchedItem.score} 分及以上段估算位次。`,
        }
      : {
          available: false,
          exact: false,
          province,
          year,
          subjectType,
          score,
          rank: null,
          message: '暂无该省份/年份/科类的一分一段数据，请手动填写位次。',
        },
  };
}

export async function volunteerDataYears(ctx: Context) {
  const [scoreRankYears, admissionScoreYears] = await Promise.all([
    prisma.scoreRank.groupBy({
      by: ['year'],
      _count: { year: true },
      orderBy: { year: 'desc' },
    }),
    prisma.admissionScore.groupBy({
      by: ['year'],
      _count: { year: true },
      orderBy: { year: 'desc' },
    }),
  ]);
  const years = [...new Set([...scoreRankYears, ...admissionScoreYears].map(item => item.year))]
    .sort((a, b) => b - a);
  const defaultYear = scoreRankYears[0]?.year || years[0] || 2025;

  ctx.body = {
    success: true,
    data: {
      years,
      defaultYear,
      scoreRankYears: scoreRankYears.map(item => ({ year: item.year, count: item._count.year })),
      admissionScoreYears: admissionScoreYears.map(item => ({ year: item.year, count: item._count.year })),
    },
  };
}

export async function majorSuggestions(ctx: Context) {
  const keyword = String(ctx.query.keyword || '').trim();
  if (!keyword) {
    ctx.body = { success: true, data: [] };
    return;
  }

  const keywords = expandMajorSuggestionKeywords(keyword);
  const majors = await prisma.major.findMany({
    where: {
      OR: keywords.flatMap(item => [
        { name: { contains: item } },
        { category: { contains: item } },
        { tags: { contains: item } },
      ]),
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    take: 20,
    select: { id: true, name: true, category: true },
  });

  ctx.body = { success: true, data: mergeMajorSuggestionFallbacks(keyword, majors) };
}

export async function publicMajors(ctx: Context) {
  const { keyword, category, page: p, pageSize: ps } = ctx.query as Record<string, string>;
  const page = Math.max(1, parseInt(p || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(ps || '20', 10)));

  const where: any = {};
  if (category) where.category = category;
  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { category: { contains: keyword } },
      { description: { contains: keyword } },
      { employment: { contains: keyword } },
      { tags: { contains: keyword } },
    ];
  }

  const [list, total] = await Promise.all([
    prisma.major.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.major.count({ where }),
  ]);

  ctx.body = { success: true, data: { list: list.map(transformMajor), total, page, pageSize } };
}

export async function publicMajorCategories(ctx: Context) {
  const categories = await prisma.major.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  ctx.body = { success: true, data: categories.map(item => item.category).filter((item): item is string => Boolean(item)) };
}

export async function publicMajorDetail(ctx: Context) {
  const major = await prisma.major.findUnique({
    where: { id: ctx.params.id },
    include: {
      universityMajors: {
        where: { status: 'enabled' },
        include: {
          university: {
            select: {
              id: true,
              name: true,
              province: true,
              city: true,
              type: true,
              level: true,
              is985: true,
              is211: true,
              isDoubleFirst: true,
            },
          },
        },
        orderBy: [{ strengthLevel: 'desc' }, { updatedAt: 'desc' }],
        take: 20,
      },
    },
  });

  if (!major) {
    ctx.status = 404;
    ctx.body = { success: false, message: '专业不存在' };
    return;
  }

  const { universityMajors, ...majorData } = major;

  ctx.body = {
    success: true,
    data: {
      ...transformMajor(majorData),
      universityMajors: universityMajors.map(transformUniversityMajor),
    },
  };
}

const COMMON_MAJOR_SUGGESTIONS = [
  '计算机科学与技术', '软件工程', '人工智能', '数据科学与大数据技术', '网络工程', '信息安全', '物联网工程',
  '电子信息工程', '通信工程', '自动化', '电气工程及其自动化', '微电子科学与工程', '集成电路设计与集成系统',
  '机械设计制造及其自动化', '车辆工程', '能源与动力工程', '土木工程', '建筑学', '城乡规划',
  '临床医学', '口腔医学', '医学影像学', '麻醉学', '护理学', '药学', '中医学', '中西医临床医学',
  '法学', '知识产权', '公安学类', '汉语言文学', '新闻学', '传播学', '新闻传播学类', '网络与新媒体',
  '广播电视学', '广告学', '数字媒体技术', '数字媒体艺术', '英语', '翻译',
  '会计学', '财务管理', '金融学', '经济学', '财政学', '国际经济与贸易', '工商管理',
  '师范类', '数学与应用数学', '物理学', '化学', '生物科学', '心理学', '教育学',
  '统计学', '应用统计学', '信息与计算科学', '环境工程', '食品科学与工程', '农学', '动物医学',
];

const MAJOR_SUGGESTION_ALIASES: Record<string, string[]> = {
  传媒: ['传媒', '传播', '新闻', '广告', '新媒体', '广播电视', '数字媒体'],
  媒体: ['媒体', '传播', '新闻', '广告', '新媒体', '广播电视', '数字媒体'],
  新媒体: ['新媒体', '网络与新媒体', '传播', '新闻', '数字媒体'],
  新闻传播: ['新闻传播', '新闻', '传播', '广告', '网络与新媒体'],
};

function expandMajorSuggestionKeywords(keyword: string) {
  return [...new Set([keyword, ...(MAJOR_SUGGESTION_ALIASES[keyword] || [])])];
}

function mergeMajorSuggestionFallbacks(keyword: string, majors: Array<{ id: string; name: string; category: string | null }>) {
  const keywords = expandMajorSuggestionKeywords(keyword);
  const seen = new Set<string>();
  const result: Array<{ id: string; name: string; category: string | null }> = [];
  const push = (item: { id: string; name: string; category: string | null }) => {
    const name = String(item.name || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    result.push(Object.assign({}, item, { name }));
  };

  majors.forEach(push);
  for (const name of COMMON_MAJOR_SUGGESTIONS) {
    if (keywords.some(item => name.includes(item))) {
      push({ id: `common-${name}`, name, category: '常见专业' });
    }
  }
  return result.slice(0, 20);
}

export async function adminReports(ctx: Context) {
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);
  const province = ctx.query.province as string;
  const subjectType = ctx.query.subjectType as string;

  const where: any = {};
  if (province) where.province = province;
  if (subjectType) where.subjectType = subjectType;

  const [list, total] = await Promise.all([
    prisma.volunteerReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, nickname: true, phone: true } } },
    }),
    prisma.volunteerReport.count({ where }),
  ]);

  ctx.body = { success: true, data: { list, total, page, pageSize } };
}

export async function adminScoreRanks(ctx: Context) {
  const {
    province, subjectType, year, score,
    page: p, pageSize: ps,
  } = ctx.query as Record<string, string>;
  const page = Math.max(1, parseInt(p || '1', 10));
  const pageSize = Math.min(500, Math.max(1, parseInt(ps || '20', 10)));

  const where: any = {};
  if (province) where.province = province;
  if (subjectType) where.subjectType = { in: subjectTypeCandidates(subjectType) };
  if (year) where.year = Number(year);
  if (score) where.score = Number(score);

  const [list, total] = await Promise.all([
    prisma.scoreRank.findMany({
      where,
      orderBy: [{ year: 'desc' }, { province: 'asc' }, { subjectType: 'asc' }, { score: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.scoreRank.count({ where }),
  ]);

  ctx.body = { success: true, data: { list, total, page, pageSize } };
}

export async function importScoreRanks(ctx: Context) {
  const { items } = ctx.request.body as any;
  if (!Array.isArray(items) || items.length === 0) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'items 必须是非空数组' };
    return;
  }

  let count = 0;
  for (const item of items.slice(0, 10000)) {
    const data = normalizeScoreRank(item);
    await prisma.scoreRank.upsert({
      where: {
        province_year_subjectType_score: {
          province: data.province,
          year: data.year,
          subjectType: data.subjectType,
          score: data.score,
        },
      },
      update: data,
      create: data,
    });
    count++;
  }

  ctx.body = { success: true, data: { count } };
}

export async function createScoreRank(ctx: Context) {
  const data = normalizeScoreRank(ctx.request.body as any);
  const item = await prisma.scoreRank.upsert({
    where: {
      province_year_subjectType_score: {
        province: data.province,
        year: data.year,
        subjectType: data.subjectType,
        score: data.score,
      },
    },
    update: data,
    create: data,
  });

  ctx.body = { success: true, data: item };
}

export async function updateScoreRank(ctx: Context) {
  const data = normalizeScoreRank(ctx.request.body as any, true);
  const item = await prisma.scoreRank.update({
    where: { id: ctx.params.id },
    data,
  });

  ctx.body = { success: true, data: item };
}

export async function deleteScoreRank(ctx: Context) {
  await prisma.scoreRank.delete({ where: { id: ctx.params.id } });
  ctx.body = { success: true, message: '删除成功' };
}

export async function adminArtScoreRanks(ctx: Context) {
  const {
    province, year, artCategory, subjectType, direction, score,
    page: p, pageSize: ps,
  } = ctx.query as Record<string, string>;
  const page = Math.max(1, parseInt(p || '1', 10));
  const pageSize = Math.min(500, Math.max(1, parseInt(ps || '20', 10)));

  const where: any = {};
  if (province) where.province = province;
  if (year) where.year = Number(year);
  if (artCategory) where.artCategory = artCategory;
  if (subjectType) where.subjectType = subjectType;
  if (direction) where.direction = direction;
  if (score) where.score = Number(score);

  const [list, total] = await Promise.all([
    prisma.artScoreRank.findMany({
      where,
      orderBy: [{ year: 'desc' }, { province: 'asc' }, { artCategory: 'asc' }, { direction: 'asc' }, { score: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.artScoreRank.count({ where }),
  ]);

  ctx.body = { success: true, data: { list, total, page, pageSize } };
}

export async function createArtScoreRank(ctx: Context) {
  const data = normalizeArtScoreRank(ctx.request.body as any);
  const item = await prisma.artScoreRank.upsert({
    where: {
      province_year_artCategory_subjectType_direction_score: {
        province: data.province,
        year: data.year,
        artCategory: data.artCategory,
        subjectType: data.subjectType,
        direction: data.direction ?? '',
        score: data.score,
      },
    },
    update: data,
    create: data,
  });
  ctx.body = { success: true, data: item };
}

export async function updateArtScoreRank(ctx: Context) {
  const data = normalizeArtScoreRank(ctx.request.body as any, true);
  const item = await prisma.artScoreRank.update({ where: { id: ctx.params.id }, data });
  ctx.body = { success: true, data: item };
}

export async function deleteArtScoreRank(ctx: Context) {
  await prisma.artScoreRank.delete({ where: { id: ctx.params.id } });
  ctx.body = { success: true, message: '删除成功' };
}

export async function importArtScoreRanks(ctx: Context) {
  const { items } = ctx.request.body as any;
  if (!Array.isArray(items) || items.length === 0) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'items 必须是非空数组' };
    return;
  }

  let count = 0;
  for (const item of items.slice(0, 20000)) {
    const data = normalizeArtScoreRank(item);
    await prisma.artScoreRank.upsert({
      where: {
        province_year_artCategory_subjectType_direction_score: {
          province: data.province,
          year: data.year,
          artCategory: data.artCategory,
          subjectType: data.subjectType,
          direction: data.direction ?? '',
          score: data.score,
        },
      },
      update: data,
      create: data,
    });
    count++;
  }

  ctx.body = { success: true, data: { count } };
}

export async function adminAdmissionScores(ctx: Context) {
  const {
    province, subjectType, year, universityId, universityName, majorName,
    lineType, sourceType, dataQuality, isPartial,
    page: p, pageSize: ps,
  } = ctx.query as Record<string, string>;
  const page = Math.max(1, parseInt(p || '1'));
  const pageSize = Math.min(500, Math.max(1, parseInt(ps || '20')));

  const where: any = {};
  if (province) where.province = province;
  if (subjectType) where.subjectType = subjectType;
  if (year) where.year = parseInt(year);
  if (universityId) where.universityId = universityId;
  if (universityName) where.universityName = { contains: universityName };
  if (majorName) where.majorName = { contains: majorName };
  if (lineType) where.lineType = lineType;
  if (sourceType) where.sourceType = sourceType;
  if (dataQuality) where.dataQuality = dataQuality;
  if (isPartial !== undefined && isPartial !== '') where.isPartial = isPartial === 'true';

  const [list, total] = await Promise.all([
    prisma.admissionScore.findMany({
      where,
      include: { university: { select: { name: true, province: true, city: true, is985: true, is211: true, isDoubleFirst: true } } },
      orderBy: [{ year: 'desc' }, { minRank: 'asc' }, { minScore: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.admissionScore.count({ where }),
  ]);

  ctx.body = { success: true, data: { list, total, page, pageSize } };
}

export async function createAdmissionScore(ctx: Context) {
  const body = ctx.request.body as any;
  const data = await normalizeAdmissionScore(body);
  const score = await prisma.admissionScore.create({ data });
  ctx.body = { success: true, data: score };
}

export async function updateAdmissionScore(ctx: Context) {
  const body = ctx.request.body as any;
  const data = await normalizeAdmissionScore(body, true);
  const score = await prisma.admissionScore.update({ where: { id: ctx.params.id }, data });
  ctx.body = { success: true, data: score };
}

export async function deleteAdmissionScore(ctx: Context) {
  await prisma.admissionScore.delete({ where: { id: ctx.params.id } });
  ctx.body = { success: true, message: '删除成功' };
}

export async function importAdmissionScores(ctx: Context) {
  const { items } = ctx.request.body as any;
  if (!Array.isArray(items) || items.length === 0) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'items 必须是非空数组' };
    return;
  }

  const data = [];
  for (const item of items.slice(0, 5000)) {
    data.push(await normalizeAdmissionScore(item));
  }
  const result = await prisma.admissionScore.createMany({ data });
  ctx.body = { success: true, data: { count: result.count } };
}

export async function adminArtAdmissionRules(ctx: Context) {
  const {
    province, year, artCategory, batch, subjectType, formulaType,
    page: p, pageSize: ps,
  } = ctx.query as Record<string, string>;
  const page = Math.max(1, parseInt(p || '1', 10));
  const pageSize = Math.min(500, Math.max(1, parseInt(ps || '20', 10)));

  const where: any = {};
  if (province) where.province = province;
  if (year) where.year = Number(year);
  if (artCategory) where.artCategory = artCategory;
  if (batch) where.batch = batch;
  if (subjectType) where.subjectType = subjectType;
  if (formulaType) where.formulaType = formulaType;

  const [list, total] = await Promise.all([
    prisma.artAdmissionRule.findMany({
      where,
      orderBy: [{ year: 'desc' }, { province: 'asc' }, { artCategory: 'asc' }, { batch: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.artAdmissionRule.count({ where }),
  ]);

  ctx.body = { success: true, data: { list, total, page, pageSize } };
}

export async function createArtAdmissionRule(ctx: Context) {
  const data = normalizeArtAdmissionRule(ctx.request.body as any);
  const item = await prisma.artAdmissionRule.upsert({
    where: {
      province_year_artCategory_batch_subjectType_direction: {
        province: data.province,
        year: data.year,
        artCategory: data.artCategory,
        batch: data.batch,
        subjectType: data.subjectType,
        direction: data.direction ?? null,
      },
    },
    update: data,
    create: data,
  });
  ctx.body = { success: true, data: item };
}

export async function updateArtAdmissionRule(ctx: Context) {
  const data = normalizeArtAdmissionRule(ctx.request.body as any, true);
  const item = await prisma.artAdmissionRule.update({ where: { id: ctx.params.id }, data });
  ctx.body = { success: true, data: item };
}

export async function deleteArtAdmissionRule(ctx: Context) {
  await prisma.artAdmissionRule.delete({ where: { id: ctx.params.id } });
  ctx.body = { success: true, message: '删除成功' };
}

export async function importArtAdmissionRules(ctx: Context) {
  const { items } = ctx.request.body as any;
  if (!Array.isArray(items) || items.length === 0) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'items 必须是非空数组' };
    return;
  }

  let count = 0;
  for (const item of items.slice(0, 1000)) {
    const data = normalizeArtAdmissionRule(item);
    await prisma.artAdmissionRule.upsert({
      where: {
        province_year_artCategory_batch_subjectType_direction: {
          province: data.province,
          year: data.year,
          artCategory: data.artCategory,
          batch: data.batch,
          subjectType: data.subjectType,
          direction: data.direction ?? '',
        },
      },
      update: data,
      create: data,
    });
    count++;
  }

  ctx.body = { success: true, data: { count } };
}

export async function adminArtAdmissionScores(ctx: Context) {
  const {
    province, year, artCategory, batch, subjectType, universityName, majorName,
    sourceType, dataQuality,
    page: p, pageSize: ps,
  } = ctx.query as Record<string, string>;
  const page = Math.max(1, parseInt(p || '1', 10));
  const pageSize = Math.min(500, Math.max(1, parseInt(ps || '20', 10)));

  const where: any = {};
  if (province) where.province = province;
  if (year) where.year = Number(year);
  if (artCategory) where.artCategory = artCategory;
  if (batch) where.batch = batch;
  if (subjectType) where.subjectType = subjectType;
  if (universityName) where.universityName = { contains: universityName };
  if (majorName) where.majorName = { contains: majorName };
  if (sourceType) where.sourceType = sourceType;
  if (dataQuality) where.dataQuality = dataQuality;

  const [list, total] = await Promise.all([
    prisma.artAdmissionScore.findMany({
      where,
      include: { university: { select: { name: true, province: true, city: true, is985: true, is211: true, isDoubleFirst: true } } },
      orderBy: [{ year: 'desc' }, { minRank: 'asc' }, { minCompositeScore: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.artAdmissionScore.count({ where }),
  ]);

  ctx.body = { success: true, data: { list, total, page, pageSize } };
}

export async function createArtAdmissionScore(ctx: Context) {
  const data = await normalizeArtAdmissionScore(ctx.request.body as any);
  const item = await prisma.artAdmissionScore.create({ data });
  ctx.body = { success: true, data: item };
}

export async function updateArtAdmissionScore(ctx: Context) {
  const data = await normalizeArtAdmissionScore(ctx.request.body as any, true);
  const item = await prisma.artAdmissionScore.update({ where: { id: ctx.params.id }, data });
  ctx.body = { success: true, data: item };
}

export async function deleteArtAdmissionScore(ctx: Context) {
  await prisma.artAdmissionScore.delete({ where: { id: ctx.params.id } });
  ctx.body = { success: true, message: '删除成功' };
}

export async function importArtAdmissionScores(ctx: Context) {
  const { items } = ctx.request.body as any;
  if (!Array.isArray(items) || items.length === 0) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'items 必须是非空数组' };
    return;
  }

  const data = [];
  for (const item of items.slice(0, 10000)) {
    data.push(await normalizeArtAdmissionScore(item));
  }
  const result = await prisma.artAdmissionScore.createMany({ data });
  ctx.body = { success: true, data: { count: result.count } };
}

export async function admissionAutoFillStatus(ctx: Context) {
  ctx.body = { success: true, data: await getAdmissionAutoFillStatus() };
}

export async function startAdmissionAutoFillTask(ctx: Context) {
  const body = (ctx.request.body || {}) as any;
  ctx.body = {
    success: true,
    data: await startAdmissionAutoFill({
      year: Number(body.year) || undefined,
      targetApiCoverage: Number(body.targetApiCoverage) || undefined,
      batchSize: Number(body.batchSize) || undefined,
      maxRounds: Number(body.maxRounds) || undefined,
      cooldownMs: Number(body.cooldownMs) || undefined,
      requestDelayMs: Number(body.requestDelayMs) || undefined,
      requestTimeout: Number(body.requestTimeout) || undefined,
      retries: Number(body.retries) || undefined,
      retryDelayMs: Number(body.retryDelayMs) || undefined,
      rateLimitCooldownMs: Number(body.rateLimitCooldownMs) || undefined,
      dedupeIntervalRounds: Number(body.dedupeIntervalRounds) || undefined,
      concurrency: Number(body.concurrency) || undefined,
      priorityOnly: body.priorityOnly === true,
      useJinaProxy: body.useJinaProxy === true,
      useCurl: body.useCurl === true,
      resetAttempted: body.resetAttempted === true,
      refreshExisting: body.refreshExisting === true,
    }),
  };
}

export async function stopAdmissionAutoFillTask(ctx: Context) {
  ctx.body = { success: true, data: await stopAdmissionAutoFill() };
}

export async function adminMajors(ctx: Context) {
  const { keyword, category, page: p, pageSize: ps } = ctx.query as Record<string, string>;
  const page = Math.max(1, parseInt(p || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(ps || '20')));

  const where: any = {};
  if (category) where.category = category;
  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { category: { contains: keyword } },
      { tags: { contains: keyword } },
    ];
  }

  const [list, total] = await Promise.all([
    prisma.major.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.major.count({ where }),
  ]);
  ctx.body = { success: true, data: { list: list.map(transformMajor), total, page, pageSize } };
}

export async function createMajor(ctx: Context) {
  const major = await prisma.major.create({ data: normalizeMajor(ctx.request.body as any) });
  ctx.body = { success: true, data: transformMajor(major) };
}

export async function updateMajor(ctx: Context) {
  const major = await prisma.major.update({
    where: { id: ctx.params.id },
    data: normalizeMajor(ctx.request.body as any, true),
  });
  ctx.body = { success: true, data: transformMajor(major) };
}

export async function deleteMajor(ctx: Context) {
  await prisma.major.delete({ where: { id: ctx.params.id } });
  ctx.body = { success: true, message: '删除成功' };
}

export async function importMajors(ctx: Context) {
  const { items } = ctx.request.body as any;
  if (!Array.isArray(items) || items.length === 0) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'items 必须是非空数组' };
    return;
  }

  let count = 0;
  for (const item of items.slice(0, 2000)) {
    const data = normalizeMajor(item);
    await prisma.major.upsert({
      where: { name: data.name },
      update: data,
      create: data,
    });
    count++;
  }
  ctx.body = { success: true, data: { count } };
}

export async function adminUniversityMajors(ctx: Context) {
  const {
    universityId, universityName, majorName, status,
    page: p, pageSize: ps,
  } = ctx.query as Record<string, string>;
  const page = Math.max(1, parseInt(p || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(ps || '20')));

  const where: any = {};
  if (universityId) where.universityId = universityId;
  if (majorName) where.majorName = { contains: majorName };
  if (status) where.status = status;
  if (universityName) where.university = { name: { contains: universityName } };

  const [list, total] = await Promise.all([
    prisma.universityMajor.findMany({
      where,
      include: {
        university: { select: { id: true, name: true, province: true, city: true, is985: true, is211: true, isDoubleFirst: true } },
        major: { select: { id: true, name: true, category: true, riskLevel: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.universityMajor.count({ where }),
  ]);

  ctx.body = { success: true, data: { list: list.map(transformUniversityMajor), total, page, pageSize } };
}

export async function createUniversityMajor(ctx: Context) {
  const data = await normalizeUniversityMajor(ctx.request.body as any);
  const item = await prisma.universityMajor.create({ data });
  ctx.body = { success: true, data: transformUniversityMajor(item) };
}

export async function updateUniversityMajor(ctx: Context) {
  const data = await normalizeUniversityMajor(ctx.request.body as any, true);
  const item = await prisma.universityMajor.update({ where: { id: ctx.params.id }, data });
  ctx.body = { success: true, data: transformUniversityMajor(item) };
}

export async function deleteUniversityMajor(ctx: Context) {
  await prisma.universityMajor.delete({ where: { id: ctx.params.id } });
  ctx.body = { success: true, message: '删除成功' };
}

export async function importUniversityMajors(ctx: Context) {
  const { items } = ctx.request.body as any;
  if (!Array.isArray(items) || items.length === 0) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'items 必须是非空数组' };
    return;
  }

  let count = 0;
  for (const item of items.slice(0, 5000)) {
    const data = await normalizeUniversityMajor(item);
    await prisma.universityMajor.upsert({
      where: {
        universityId_majorName: {
          universityId: data.universityId,
          majorName: data.majorName,
        },
      },
      update: data,
      create: data,
    });
    count++;
  }
  ctx.body = { success: true, data: { count } };
}

async function normalizeAdmissionScore(body: any, partial = false) {
  const data: any = {};
  const required = ['universityName', 'province', 'year', 'subjectType'];
  if (!partial) {
    for (const key of required) {
      if (body[key] === undefined || body[key] === '') {
        throw new Error(`缺少字段 ${key}`);
      }
    }
  }

  if (body.universityId !== undefined) data.universityId = body.universityId || null;
  if (body.universityMajorId !== undefined) data.universityMajorId = body.universityMajorId || null;
  if (body.universityName !== undefined) data.universityName = String(body.universityName).trim();
  if (body.province !== undefined) data.province = String(body.province).trim();
  if (body.year !== undefined) data.year = Number(body.year);
  if (body.batch !== undefined) data.batch = body.batch || null;
  if (body.subjectType !== undefined) data.subjectType = String(body.subjectType).trim();
  if (body.majorName !== undefined) data.majorName = body.majorName || null;
  if (body.lineType !== undefined) data.lineType = body.lineType || 'unknown';
  if (body.groupCode !== undefined) data.groupCode = body.groupCode || null;
  if (body.groupName !== undefined) data.groupName = body.groupName || null;
  if (body.subjectRequirement !== undefined) data.subjectRequirement = body.subjectRequirement || null;
  if (body.minScore !== undefined) data.minScore = nullableNumber(body.minScore);
  if (body.minRank !== undefined) data.minRank = nullableNumber(body.minRank);
  if (body.avgScore !== undefined) data.avgScore = nullableNumber(body.avgScore);
  if (body.planCount !== undefined) data.planCount = nullableNumber(body.planCount);
  if (body.sourceName !== undefined) data.sourceName = body.sourceName || null;
  if (body.sourceUrl !== undefined) data.sourceUrl = body.sourceUrl || null;
  if (body.sourceType !== undefined) data.sourceType = body.sourceType || null;
  if (body.isPartial !== undefined) data.isPartial = Boolean(body.isPartial);
  if (body.dataQuality !== undefined) data.dataQuality = body.dataQuality || 'unknown';
  if (body.rawData !== undefined) data.rawData = typeof body.rawData === 'string' ? body.rawData : JSON.stringify(body.rawData);

  if (!data.universityId && data.universityName) {
    const uni = await prisma.university.findFirst({ where: { name: data.universityName }, select: { id: true } });
    if (uni) data.universityId = uni.id;
  }
  if (!data.universityMajorId && data.universityId && data.majorName) {
    const universityMajor = await prisma.universityMajor.findFirst({
      where: { universityId: data.universityId, majorName: data.majorName },
      select: { id: true },
    });
    if (universityMajor) data.universityMajorId = universityMajor.id;
  }
  return data;
}

function normalizeArtAdmissionRule(body: any, partial = false) {
  const required = ['province', 'year', 'artCategory', 'batch', 'cultureWeight', 'professionalWeight'];
  if (!partial) {
    for (const key of required) {
      if (body[key] === undefined || body[key] === '') {
        throw new Error(`缺少字段 ${key}`);
      }
    }
  }

  const data: any = {};
  if (body.province !== undefined) data.province = String(body.province).trim();
  if (body.year !== undefined) data.year = Number(body.year);
  if (body.artCategory !== undefined) data.artCategory = String(body.artCategory).trim();
  if (body.direction !== undefined) data.direction = body.direction ? String(body.direction).trim() : '';
  if (body.batch !== undefined) data.batch = String(body.batch || '本科').trim();
  if (body.subjectType !== undefined) data.subjectType = String(body.subjectType || '不限').trim();
  if (body.subjectType === undefined && !partial) data.subjectType = '不限';
  if (body.formulaType !== undefined) data.formulaType = String(body.formulaType || 'weighted').trim();
  if (body.formulaType === undefined && !partial) data.formulaType = 'weighted';
  if (body.cultureFullScore !== undefined) data.cultureFullScore = numberWithDefault(body.cultureFullScore, 750);
  if (body.cultureFullScore === undefined && !partial) data.cultureFullScore = 750;
  if (body.professionalFullScore !== undefined) data.professionalFullScore = numberWithDefault(body.professionalFullScore, 300);
  if (body.professionalFullScore === undefined && !partial) data.professionalFullScore = 300;
  if (body.cultureWeight !== undefined) data.cultureWeight = Number(body.cultureWeight);
  if (body.professionalWeight !== undefined) data.professionalWeight = Number(body.professionalWeight);
  if (body.scaleTo !== undefined) data.scaleTo = numberWithDefault(body.scaleTo, 750);
  if (body.scaleTo === undefined && !partial) data.scaleTo = 750;
  if (body.minCultureScore !== undefined) data.minCultureScore = nullableNumber(body.minCultureScore);
  if (body.minProfessionalScore !== undefined) data.minProfessionalScore = nullableNumber(body.minProfessionalScore);
  if (body.sourceName !== undefined) data.sourceName = body.sourceName || null;
  if (body.sourceUrl !== undefined) data.sourceUrl = body.sourceUrl || null;
  if (body.sourceType !== undefined) data.sourceType = body.sourceType || null;
  if (body.notes !== undefined) data.notes = body.notes || null;

  if (data.year !== undefined && (!Number.isInteger(data.year) || data.year < 2000 || data.year > 2100)) throw new Error('年份无效');
  if (data.cultureWeight !== undefined && !Number.isFinite(data.cultureWeight)) throw new Error('文化权重无效');
  if (data.professionalWeight !== undefined && !Number.isFinite(data.professionalWeight)) throw new Error('专业权重无效');
  return data;
}

async function normalizeArtAdmissionScore(body: any, partial = false) {
  const required = ['universityName', 'province', 'year', 'artCategory', 'batch'];
  if (!partial) {
    for (const key of required) {
      if (body[key] === undefined || body[key] === '') {
        throw new Error(`缺少字段 ${key}`);
      }
    }
  }

  const data: any = {};
  if (body.universityId !== undefined) data.universityId = body.universityId || null;
  if (body.universityName !== undefined) data.universityName = String(body.universityName).trim();
  if (body.province !== undefined) data.province = String(body.province).trim();
  if (body.year !== undefined) data.year = Number(body.year);
  if (body.batch !== undefined) data.batch = String(body.batch || '本科').trim();
  if (body.artCategory !== undefined) data.artCategory = String(body.artCategory).trim();
  if (body.subjectType !== undefined) data.subjectType = String(body.subjectType || '不限').trim();
  if (body.subjectType === undefined && !partial) data.subjectType = '不限';
  if (body.majorName !== undefined) data.majorName = body.majorName || null;
  if (body.groupCode !== undefined) data.groupCode = body.groupCode || null;
  if (body.groupName !== undefined) data.groupName = body.groupName || null;
  if (body.minCompositeScore !== undefined) data.minCompositeScore = nullableNumber(body.minCompositeScore);
  if (body.minCultureScore !== undefined) data.minCultureScore = nullableNumber(body.minCultureScore);
  if (body.minProfessionalScore !== undefined) data.minProfessionalScore = nullableNumber(body.minProfessionalScore);
  if (body.minRank !== undefined) data.minRank = nullableInteger(body.minRank);
  if (body.planCount !== undefined) data.planCount = nullableInteger(body.planCount);
  if (body.admissionMethod !== undefined) data.admissionMethod = body.admissionMethod || null;
  if (body.sourceName !== undefined) data.sourceName = body.sourceName || null;
  if (body.sourceUrl !== undefined) data.sourceUrl = body.sourceUrl || null;
  if (body.sourceType !== undefined) data.sourceType = body.sourceType || null;
  if (body.dataQuality !== undefined) data.dataQuality = body.dataQuality || 'unknown';
  if (body.dataQuality === undefined && !partial) data.dataQuality = 'unknown';
  if (body.rawData !== undefined) data.rawData = typeof body.rawData === 'string' ? body.rawData : JSON.stringify(body.rawData);

  if (!data.universityId && data.universityName) {
    const uni = await prisma.university.findFirst({ where: { name: data.universityName }, select: { id: true } });
    if (uni) data.universityId = uni.id;
  }
  if (data.year !== undefined && (!Number.isInteger(data.year) || data.year < 2000 || data.year > 2100)) throw new Error('年份无效');
  return data;
}

async function normalizeUniversityMajor(body: any, partial = false) {
  if (!partial && !body.universityId && !body.universityName) throw new Error('院校 ID 或院校名称必填');
  if (!partial && !body.majorName && !body.majorId) throw new Error('专业名称或专业 ID 必填');

  const data: any = {};
  if (body.universityId !== undefined) data.universityId = body.universityId;
  if (!data.universityId && body.universityName) {
    const uni = await prisma.university.findFirst({ where: { name: String(body.universityName).trim() }, select: { id: true } });
    if (!uni) throw new Error(`院校不存在：${body.universityName}`);
    data.universityId = uni.id;
  }

  if (body.majorId !== undefined) data.majorId = body.majorId || null;
  if (!data.majorId && body.majorName) {
    const major = await prisma.major.findFirst({ where: { name: String(body.majorName).trim() }, select: { id: true, name: true } });
    if (major) data.majorId = major.id;
  }
  if (body.majorName !== undefined) data.majorName = String(body.majorName).trim();
  if (!data.majorName && data.majorId) {
    const major = await prisma.major.findUnique({ where: { id: data.majorId }, select: { name: true } });
    if (major) data.majorName = major.name;
  }

  if (body.majorCode !== undefined) data.majorCode = body.majorCode || null;
  if (body.collegeName !== undefined) data.collegeName = body.collegeName || null;
  if (body.degreeType !== undefined) data.degreeType = body.degreeType || null;
  if (body.duration !== undefined) data.duration = body.duration || null;
  if (body.tuition !== undefined) data.tuition = nullableNumber(body.tuition);
  if (body.subjectLimit !== undefined) data.subjectLimit = body.subjectLimit || null;
  if (body.featureTags !== undefined) data.featureTags = JSON.stringify(Array.isArray(body.featureTags) ? body.featureTags : String(body.featureTags).split(/[,，、\s]+/).filter(Boolean));
  if (body.strengthLevel !== undefined) data.strengthLevel = body.strengthLevel || null;
  if (body.employmentNote !== undefined) data.employmentNote = body.employmentNote || null;
  if (body.status !== undefined) data.status = body.status || 'enabled';
  return data;
}

function normalizeMajor(body: any, partial = false) {
  if (!partial && !body.name) throw new Error('专业名称不能为空');
  const data: any = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.category !== undefined) data.category = body.category || null;
  if (body.degreeType !== undefined) data.degreeType = body.degreeType || null;
  if (body.description !== undefined) data.description = body.description || null;
  if (body.employment !== undefined) data.employment = body.employment || null;
  if (body.riskLevel !== undefined) data.riskLevel = body.riskLevel || null;
  if (body.recommendedFor !== undefined) data.recommendedFor = body.recommendedFor || null;
  if (body.avoidFor !== undefined) data.avoidFor = body.avoidFor || null;
  if (body.tags !== undefined) data.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : String(body.tags).split(/[,，、\s]+/).filter(Boolean));
  return data;
}

function transformMajor(major: any) {
  try {
    return { ...major, tags: JSON.parse(major.tags || '[]') };
  } catch {
    return { ...major, tags: [] };
  }
}

function transformUniversityMajor(item: any) {
  try {
    return { ...item, featureTags: JSON.parse(item.featureTags || '[]') };
  } catch {
    return { ...item, featureTags: [] };
  }
}

function normalizeScoreRank(body: any, partial = false) {
  const required = ['province', 'year', 'subjectType', 'score', 'rank'];
  if (!partial) {
    for (const key of required) {
      if (body[key] === undefined || body[key] === '') {
        throw new Error(`缺少字段 ${key}`);
      }
    }
  }

  const data: any = {};
  if (body.province !== undefined) data.province = String(body.province).trim();
  if (body.year !== undefined) data.year = Number(body.year);
  if (body.subjectType !== undefined) data.subjectType = String(body.subjectType).trim();
  if (body.score !== undefined) data.score = Number(body.score);
  if (body.rank !== undefined) data.rank = Number(body.rank);
  if (body.sameScoreCount !== undefined || body.sameCount !== undefined || body.count !== undefined) {
    data.sameScoreCount = nullableNumber(body.sameScoreCount ?? body.sameCount ?? body.count);
  }
  if (body.sourceName !== undefined) data.sourceName = body.sourceName || null;
  if (body.sourceUrl !== undefined) data.sourceUrl = body.sourceUrl || null;
  if (body.sourceType !== undefined) data.sourceType = body.sourceType || null;
  if (body.rawData !== undefined) data.rawData = typeof body.rawData === 'string' ? body.rawData : JSON.stringify(body.rawData);

  if (data.year !== undefined && (!Number.isInteger(data.year) || data.year < 2000 || data.year > 2100)) throw new Error('年份无效');
  if (data.score !== undefined && (!Number.isInteger(data.score) || data.score < 0 || data.score > 750)) throw new Error('分数无效');
  if (data.rank !== undefined && (!Number.isInteger(data.rank) || data.rank <= 0)) throw new Error('位次无效');

  return data;
}

function normalizeArtScoreRank(body: any, partial = false) {
  const required = ['province', 'year', 'artCategory', 'score', 'cumulativeCount'];
  if (!partial) {
    for (const key of required) {
      if (body[key] === undefined || body[key] === '') {
        throw new Error(`缺少字段 ${key}`);
      }
    }
  }

  const data: any = {};
  if (body.province !== undefined) data.province = String(body.province).trim();
  if (body.year !== undefined) data.year = Number(body.year);
  if (body.artCategory !== undefined) data.artCategory = String(body.artCategory).trim();
  if (body.score !== undefined) data.score = Number(body.score);
  if (body.sameScoreCount !== undefined || body.sameCount !== undefined || body.count !== undefined) {
    data.sameScoreCount = nullableInteger(body.sameScoreCount ?? body.sameCount ?? body.count);
  }
  if (body.cumulativeCount !== undefined || body.rank !== undefined || body.total !== undefined) {
    data.cumulativeCount = Number(body.cumulativeCount ?? body.rank ?? body.total);
  }
  if (body.batch !== undefined) data.batch = body.batch ? String(body.batch).trim() : null;
  if (body.subjectType !== undefined) data.subjectType = String(body.subjectType || '不限').trim();
  if (body.subjectType === undefined && !partial) data.subjectType = '不限';
  if (body.direction !== undefined) data.direction = body.direction ? String(body.direction).trim() : '';
  if (body.sourceName !== undefined) data.sourceName = body.sourceName || null;
  if (body.sourceUrl !== undefined) data.sourceUrl = body.sourceUrl || null;
  if (body.sourceType !== undefined) data.sourceType = body.sourceType || null;
  if (body.rawData !== undefined) data.rawData = typeof body.rawData === 'string' ? body.rawData : JSON.stringify(body.rawData);

  if (data.year !== undefined && (!Number.isInteger(data.year) || data.year < 2000 || data.year > 2100)) throw new Error('年份无效');
  if (data.score !== undefined && (!Number.isInteger(data.score) || data.score < 0 || data.score > 300)) throw new Error('专业分无效');
  if (data.cumulativeCount !== undefined && (!Number.isInteger(data.cumulativeCount) || data.cumulativeCount <= 0)) throw new Error('累计人数无效');

  return data;
}

function subjectTypeCandidates(subjectType: string) {
  const normalized = subjectType.trim();
  const set = new Set([normalized]);
  if (/物理/.test(normalized)) {
    set.add('物理类');
    set.add('物理');
  }
  if (/历史/.test(normalized)) {
    set.add('历史类');
    set.add('历史');
  }
  if (/理科/.test(normalized)) {
    set.add('理科');
  }
  if (/文科/.test(normalized)) {
    set.add('文科');
  }
  if (/综合|普通/.test(normalized)) {
    set.add('综合改革');
    set.add('综合');
    set.add('普通类');
  }
  return [...set];
}

function nullableNumber(value: any) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function scoreRankMaxScore(province: string) {
  if (province === '上海') return 660;
  if (province === '海南') return 900;
  return 750;
}

function nullableInteger(value: any) {
  const n = nullableNumber(value);
  return n === null ? null : Math.round(n);
}

function numberWithDefault(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
