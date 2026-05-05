import { Context } from 'koa';
import { prisma } from '../utils/prisma';

// ─── Tag helpers ─────────────────────────────────────

function parseTags(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}

function serializeTags(tags: string[] | undefined): string {
  if (Array.isArray(tags)) return JSON.stringify(tags);
  return '[]';
}

function transformEntry(entry: any) {
  return { ...entry, tags: parseTags(entry.tags) };
}

// ─── Public API ──────────────────────────────────────

export async function list(ctx: Context) {
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);
  const category = ctx.query.category as string;
  const keyword = ctx.query.keyword as string;

  const where: any = { status: 'published' };
  if (category) where.category = category;
  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { content: { contains: keyword } },
      { tags: { contains: keyword } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.knowledgeEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, title: true, category: true, tags: true,
        sourceName: true, sourceDate: true, viewCount: true, createdAt: true,
      },
    }),
    prisma.knowledgeEntry.count({ where }),
  ]);

  ctx.body = {
    success: true,
    data: { list: items.map(transformEntry), total, page, pageSize },
  };
}

export async function detail(ctx: Context) {
  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: ctx.params.id },
  });

  if (!entry || entry.status !== 'published') {
    ctx.status = 404;
    ctx.body = { success: false, message: '知识条目不存在' };
    return;
  }

  await prisma.knowledgeEntry.update({
    where: { id: entry.id },
    data: { viewCount: { increment: 1 } },
  });

  ctx.body = { success: true, data: transformEntry(entry) };
}

export async function getCategories(ctx: Context) {
  const entries = await prisma.knowledgeEntry.findMany({
    where: { status: 'published' },
    select: { category: true },
    distinct: ['category'],
  });
  ctx.body = {
    success: true,
    data: entries.map(e => e.category),
  };
}

// ─── Admin CRUD ──────────────────────────────────────

export async function adminList(ctx: Context) {
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);
  const category = ctx.query.category as string;
  const status = ctx.query.status as string;

  const where: any = {};
  if (category) where.category = category;
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.knowledgeEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.knowledgeEntry.count({ where }),
  ]);

  ctx.body = {
    success: true,
    data: { list: items.map(transformEntry), total, page, pageSize },
  };
}

export async function adminDetail(ctx: Context) {
  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: ctx.params.id },
  });
  if (!entry) {
    ctx.status = 404;
    ctx.body = { success: false, message: '知识条目不存在' };
    return;
  }
  ctx.body = { success: true, data: transformEntry(entry) };
}

export async function create(ctx: Context) {
  const { title, content, category, tags, sourceName, sourceUrl, sourceDate, status } =
    ctx.request.body as any;

  const entry = await prisma.knowledgeEntry.create({
    data: {
      title,
      content: content || '',
      category: category || '招生简章',
      tags: serializeTags(tags),
      sourceName: sourceName || null,
      sourceUrl: sourceUrl || null,
      sourceDate: sourceDate || null,
      status: status || 'published',
    },
  });
  ctx.body = { success: true, data: transformEntry(entry) };
}

export async function update(ctx: Context) {
  const { title, content, category, tags, sourceName, sourceUrl, sourceDate, status } =
    ctx.request.body as any;

  const data: any = {};
  if (title !== undefined) data.title = title;
  if (content !== undefined) data.content = content;
  if (category !== undefined) data.category = category;
  if (tags !== undefined) data.tags = serializeTags(tags);
  if (sourceName !== undefined) data.sourceName = sourceName;
  if (sourceUrl !== undefined) data.sourceUrl = sourceUrl;
  if (sourceDate !== undefined) data.sourceDate = sourceDate;
  if (status !== undefined) data.status = status;

  try {
    const entry = await prisma.knowledgeEntry.update({
      where: { id: ctx.params.id },
      data,
    });
    ctx.body = { success: true, data: transformEntry(entry) };
  } catch (err: any) {
    if (err?.code === 'P2025') {
      ctx.status = 404;
      ctx.body = { success: false, message: '知识条目不存在' };
      return;
    }
    throw err;
  }
}

export async function remove(ctx: Context) {
  try {
    await prisma.knowledgeEntry.delete({ where: { id: ctx.params.id } });
    ctx.body = { success: true, message: '删除成功' };
  } catch (err: any) {
    if (err?.code === 'P2025') {
      ctx.status = 404;
      ctx.body = { success: false, message: '知识条目不存在' };
      return;
    }
    throw err;
  }
}
