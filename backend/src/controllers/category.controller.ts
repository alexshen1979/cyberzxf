import { Context } from 'koa';
import { prisma } from '../utils/prisma';
import { createLogger } from '../utils/logger';

const logger = createLogger('category-ctrl');

// 公开接口：获取所有启用的分类
export async function list(ctx: Context) {
  const categories = await prisma.category.findMany({
    where: { status: 'enabled' },
    orderBy: { sortOrder: 'asc' },
  });
  ctx.body = { success: true, data: categories };
}

// 管理端：获取全部分类（含禁用）
export async function adminList(ctx: Context) {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  ctx.body = { success: true, data: categories };
}

// 管理端：创建分类
export async function create(ctx: Context) {
  const { key, label, icon, sortOrder, isDefault } = ctx.request.body as any;
  if (!key || !label) {
    ctx.status = 422;
    ctx.body = { success: false, message: 'key 和 label 不能为空' };
    return;
  }
  const exists = await prisma.category.findUnique({ where: { key } });
  if (exists) {
    ctx.status = 409;
    ctx.body = { success: false, message: `分类 key "${key}" 已存在` };
    return;
  }
  // 如果设为默认，先清除其他默认
  if (isDefault) {
    await prisma.category.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }
  const cat = await prisma.category.create({
    data: { key, label, icon: icon || '', sortOrder: sortOrder || 0, isDefault: isDefault || false },
  });
  logger.info('创建分类: %s (%s) default=%s', key, label, isDefault);
  ctx.body = { success: true, data: cat };
}

// 管理端：更新分类
export async function update(ctx: Context) {
  const { id } = ctx.params;
  const { key, label, icon, sortOrder, status, isDefault } = ctx.request.body as any;

  const data: any = {};
  if (key !== undefined) data.key = key;
  if (label !== undefined) data.label = label;
  if (icon !== undefined) data.icon = icon;
  if (sortOrder !== undefined) data.sortOrder = sortOrder;
  if (status !== undefined) data.status = status;
  if (isDefault !== undefined) data.isDefault = isDefault;

  // 如果设为默认，先清除其他默认
  if (isDefault) {
    await prisma.category.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }

  const cat = await prisma.category.update({ where: { id }, data });
  logger.info('更新分类: %s (%s) default=%s', cat.key, cat.label, isDefault);
  ctx.body = { success: true, data: cat };
}

// 管理端：设为默认
export async function setDefault(ctx: Context) {
  const { id } = ctx.params;
  // 清除所有默认
  await prisma.category.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  // 设置新默认
  const cat = await prisma.category.update({ where: { id }, data: { isDefault: true } });
  logger.info('设为默认分类: %s (%s)', cat.key, cat.label);
  ctx.body = { success: true, data: cat };
}

// 管理端：删除分类
export async function remove(ctx: Context) {
  const { id } = ctx.params;
  await prisma.category.delete({ where: { id } });
  logger.info('删除分类: %s', id);
  ctx.body = { success: true, message: '已删除' };
}
