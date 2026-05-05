import { Context } from 'koa';
import { marked } from 'marked';
import { prisma } from '../utils/prisma';

// ─── 用户端 ─────────────────────────────────────────

export async function list(ctx: Context) {
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);
  const category = ctx.query.category as string;

  const where: any = { status: 'published' };
  if (category) where.category = category;

  const [list, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        cover: true,
        category: true,
        viewCount: true,
        createdAt: true,
      },
    }),
    prisma.article.count({ where }),
  ]);

  ctx.body = { success: true, data: { list, total, page, pageSize } };
}

export async function detail(ctx: Context) {
  const article = await prisma.article.findUnique({
    where: { id: ctx.params.id },
  });

  if (!article) {
    ctx.status = 404;
    ctx.body = { success: false, message: '文章不存在' };
    return;
  }

  // 增加浏览次数
  await prisma.article.update({
    where: { id: article.id },
    data: { viewCount: { increment: 1 } },
  });

  // Markdown → HTML 转换（适配小程序 rich-text 渲染）
  const contentHtml = await marked.parse(article.content, { async: true });

  ctx.body = { success: true, data: { ...article, content: contentHtml } };
}

// ─── 管理端 ─────────────────────────────────────────

export async function adminList(ctx: Context) {
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);

  const [list, total] = await Promise.all([
    prisma.article.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.article.count(),
  ]);

  ctx.body = { success: true, data: { list, total, page, pageSize } };
}

export async function create(ctx: Context) {
  const { title, content, cover, category } = ctx.request.body as any;
  const article = await prisma.article.create({
    data: { title, content, cover, category: category || 'gaokao' },
  });
  ctx.body = { success: true, data: article };
}

export async function update(ctx: Context) {
  const { title, content, cover, category, status } = ctx.request.body as any;
  const article = await prisma.article.update({
    where: { id: ctx.params.id },
    data: { title, content, cover, category, status },
  });
  ctx.body = { success: true, data: article };
}

export async function remove(ctx: Context) {
  await prisma.article.delete({ where: { id: ctx.params.id } });
  ctx.body = { success: true, message: '删除成功' };
}
