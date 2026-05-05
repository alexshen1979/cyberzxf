import { Context } from 'koa';
import { prisma } from '../utils/prisma';

// 添加收藏（已收藏则取消，实现 toggle）
export async function toggle(ctx: Context) {
  const userId = ctx.state.user.userId;
  const { targetType, targetId } = ctx.request.body as any;

  if (!targetType || !targetId) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'targetType 和 targetId 为必填项' };
    return;
  }

  if (!['article', 'consultation'].includes(targetType)) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'targetType 只能为 article 或 consultation' };
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
    let title = '';
    let summary = '';
    if (fav.targetType === 'article') {
      const article = await prisma.article.findUnique({ where: { id: fav.targetId } });
      title = article?.title || '已删除';
      summary = article?.content?.slice(0, 100) || '';
    } else if (fav.targetType === 'consultation') {
      const record = await prisma.consultationRecord.findUnique({ where: { id: fav.targetId } });
      title = record?.question?.slice(0, 50) || '已删除';
      summary = record?.answer?.slice(0, 100) || '';
    }
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
