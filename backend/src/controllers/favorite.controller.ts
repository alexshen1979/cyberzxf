import { Context } from 'koa';
import { prisma } from '../utils/prisma';

const FAVORITE_TARGET_TYPES = ['article', 'consultation', 'knowledge', 'university', 'major', 'volunteer_report'];

function safeJson(raw?: string | null, fallback: any = {}) {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function listText(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean).slice(0, 3).join('、') : '';
}

function riskPreferenceLabel(value?: string) {
  if (value === 'conservative') return '稳妥优先';
  if (value === 'aggressive') return '适度进攻';
  return '稳中带冲';
}

async function assertFavoriteTargetExists(targetType: string, targetId: string, userId?: string) {
  if (targetType === 'article') {
    return prisma.article.findUnique({ where: { id: targetId }, select: { id: true } });
  }
  if (targetType === 'consultation') {
    return prisma.consultationRecord.findUnique({ where: { id: targetId }, select: { id: true } });
  }
  if (targetType === 'knowledge') {
    return prisma.knowledgeEntry.findUnique({ where: { id: targetId }, select: { id: true } });
  }
  if (targetType === 'university') {
    return prisma.university.findUnique({ where: { id: targetId }, select: { id: true } });
  }
  if (targetType === 'major') {
    return prisma.major.findUnique({ where: { id: targetId }, select: { id: true } });
  }
  if (targetType === 'volunteer_report') {
    return prisma.volunteerReport.findFirst({
      where: { id: targetId, ...(userId ? { userId } : {}) },
      select: { id: true },
    });
  }
  return null;
}

async function buildFavoriteDisplay(fav: { targetType: string; targetId: string }) {
  let title = '';
  let summary = '';
  if (fav.targetType === 'article') {
    const article = await prisma.article.findUnique({ where: { id: fav.targetId } });
    title = article?.title || '已删除';
    summary = article?.content?.replace(/<[^>]+>/g, '').slice(0, 100) || '';
  } else if (fav.targetType === 'consultation') {
    const record = await prisma.consultationRecord.findUnique({ where: { id: fav.targetId } });
    title = record?.question?.slice(0, 50) || '已删除';
    summary = record?.answer?.slice(0, 100) || '';
  } else if (fav.targetType === 'knowledge') {
    const entry = await prisma.knowledgeEntry.findUnique({ where: { id: fav.targetId } });
    title = entry?.title || '已删除';
    summary = entry?.content?.replace(/<[^>]+>/g, '').slice(0, 100) || '';
  } else if (fav.targetType === 'university') {
    const university = await prisma.university.findUnique({ where: { id: fav.targetId } });
    title = university?.name || '已删除';
    summary = [university?.province, university?.city, university?.level, university?.type].filter(Boolean).join(' · ');
  } else if (fav.targetType === 'major') {
    const major = await prisma.major.findUnique({ where: { id: fav.targetId } });
    title = major?.name || '已删除';
    summary = major?.employment || major?.description || [major?.category, major?.degreeType, major?.riskLevel].filter(Boolean).join(' · ');
  } else if (fav.targetType === 'volunteer_report') {
    const report = await prisma.volunteerReport.findUnique({ where: { id: fav.targetId } });
    const input = safeJson(report?.input, {});
    title = report?.title || (report
      ? `${report.province} ${report.subjectType} ${report.score}分志愿分析报告`
      : '已删除');
    summary = report
      ? [
        report.rank ? `位次 ${report.rank}` : '',
        input.riskPreference ? riskPreferenceLabel(input.riskPreference) : '',
        listText(input.preferredCities) ? `城市 ${listText(input.preferredCities)}` : '',
        listText(input.preferredMajors) ? `专业 ${listText(input.preferredMajors)}` : '',
        listText(input.avoidMajors) ? `规避 ${listText(input.avoidMajors)}` : '',
      ].filter(Boolean).join(' · ')
      : '';
  }
  return { title, summary };
}

// 添加收藏（已收藏则取消，实现 toggle）
export async function toggle(ctx: Context) {
  const userId = ctx.state.user.userId;
  const { targetType, targetId } = ctx.request.body as any;

  if (!targetType || !targetId) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'targetType 和 targetId 为必填项' };
    return;
  }

  if (!FAVORITE_TARGET_TYPES.includes(targetType)) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'targetType 只能为 article、consultation、knowledge、university、major 或 volunteer_report' };
    return;
  }

  const existing = await prisma.favorite.findUnique({
    where: {
      userId_targetType_targetId: { userId, targetType, targetId },
    },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    ctx.body = { success: true, data: { favorited: false }, message: '已取消收藏' };
    return;
  }

  const target = await assertFavoriteTargetExists(targetType, targetId, userId);
  if (!target) {
    ctx.status = 404;
    ctx.body = { success: false, message: '收藏目标不存在' };
    return;
  }

  await prisma.favorite.create({
    data: { userId, targetType, targetId },
  });

  ctx.body = { success: true, data: { favorited: true }, message: '收藏成功' };
}

// 检查收藏状态
export async function check(ctx: Context) {
  const userId = ctx.state.user.userId;
  const { targetType, targetId } = ctx.query as any;

  if (!targetType || !targetId) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'targetType 和 targetId 为必填项' };
    return;
  }

  if (!FAVORITE_TARGET_TYPES.includes(targetType)) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'targetType 不支持' };
    return;
  }

  const fav = await prisma.favorite.findUnique({
    where: {
      userId_targetType_targetId: { userId, targetType, targetId },
    },
  });

  ctx.body = { success: true, data: { favorited: !!fav } };
}

// 获取收藏列表
export async function list(ctx: Context) {
  const userId = ctx.state.user.userId;
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);

  const [items, total] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.favorite.count({ where: { userId } }),
  ]);

  // 加载关联内容
  const enriched = await Promise.all(items.map(async (fav) => {
    const { title, summary } = await buildFavoriteDisplay(fav);
    return { ...fav, title, summary };
  }));

  ctx.body = { success: true, data: { list: enriched, total, page, pageSize } };
}

// 删除收藏
export async function remove(ctx: Context) {
  const userId = ctx.state.user.userId;
  const favId = ctx.params.id;

  const fav = await prisma.favorite.findUnique({ where: { id: favId } });
  if (!fav || fav.userId !== userId) {
    ctx.status = 404;
    ctx.body = { success: false, message: '收藏不存在' };
    return;
  }

  await prisma.favorite.delete({ where: { id: favId } });
  ctx.body = { success: true, message: '已取消收藏' };
}
