import { Context } from 'koa';
import { prisma } from '../utils/prisma';

function normalizeName(value: any) {
  return String(value || '').trim();
}

function parseSort(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getRegionTree(status?: string) {
  const where: any = {};
  if (status) where.status = status;
  const regions = await prisma.region.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  const provinces = regions.filter(item => item.level === 'province');
  const byParent = new Map<string, any[]>();
  for (const region of regions) {
    if (!region.parentId) continue;
    if (!byParent.has(region.parentId)) byParent.set(region.parentId, []);
    byParent.get(region.parentId)!.push(region);
  }
  return provinces.map(province => ({
    ...province,
    children: byParent.get(province.id) || [],
  }));
}

export async function tree(ctx: Context) {
  const data = await getRegionTree('enabled');
  ctx.body = { success: true, data };
}

export async function adminTree(ctx: Context) {
  const status = ctx.query.status as string | undefined;
  const data = await getRegionTree(status || undefined);
  ctx.body = { success: true, data };
}

export async function adminList(ctx: Context) {
  const { level, parentId, keyword, status, page: p, pageSize: ps } = ctx.query as Record<string, string>;
  const page = Math.max(1, parseInt(p || '1'));
  const pageSize = Math.min(200, Math.max(1, parseInt(ps || '100')));
  const where: any = {};
  if (level) where.level = level;
  if (parentId) where.parentId = parentId;
  if (status) where.status = status;
  if (keyword) where.name = { contains: keyword };
  const [list, total] = await Promise.all([
    prisma.region.findMany({
      where,
      include: { parent: { select: { id: true, name: true, level: true } } },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.region.count({ where }),
  ]);
  ctx.body = { success: true, data: { list, total, page, pageSize } };
}

export async function create(ctx: Context) {
  const body = ctx.request.body as Record<string, any>;
  const name = normalizeName(body.name);
  const level = normalizeName(body.level || 'city');
  if (!name) { ctx.status = 400; ctx.body = { success: false, message: '名称不能为空' }; return; }
  if (!['province', 'city', 'district'].includes(level)) {
    ctx.status = 400; ctx.body = { success: false, message: '层级不正确' }; return;
  }
  if (level !== 'province' && !body.parentId) {
    ctx.status = 400; ctx.body = { success: false, message: '城市/区县必须选择上级区域' }; return;
  }
  const region = await prisma.region.create({
    data: {
      name,
      code: normalizeName(body.code) || null,
      level,
      parentId: body.parentId || null,
      sortOrder: parseSort(body.sortOrder),
      status: body.status === 'disabled' ? 'disabled' : 'enabled',
    },
  });
  ctx.body = { success: true, data: region };
}

export async function update(ctx: Context) {
  const body = ctx.request.body as Record<string, any>;
  const existing = await prisma.region.findUnique({ where: { id: ctx.params.id } });
  if (!existing) { ctx.status = 404; ctx.body = { success: false, message: '区域不存在' }; return; }
  const data: any = {};
  if (body.name !== undefined) data.name = normalizeName(body.name);
  if (body.code !== undefined) data.code = normalizeName(body.code) || null;
  if (body.level !== undefined) data.level = normalizeName(body.level);
  if (body.parentId !== undefined) data.parentId = body.parentId || null;
  if (body.sortOrder !== undefined) data.sortOrder = parseSort(body.sortOrder);
  if (body.status !== undefined) data.status = body.status === 'disabled' ? 'disabled' : 'enabled';
  const region = await prisma.region.update({ where: { id: ctx.params.id }, data });
  ctx.body = { success: true, data: region };
}

export async function remove(ctx: Context) {
  const existing = await prisma.region.findUnique({ where: { id: ctx.params.id } });
  if (!existing) { ctx.status = 404; ctx.body = { success: false, message: '区域不存在' }; return; }
  const childCount = await prisma.region.count({ where: { parentId: existing.id } });
  if (childCount > 0) {
    ctx.status = 400;
    ctx.body = { success: false, message: '请先删除下级区域' };
    return;
  }
  await prisma.region.delete({ where: { id: existing.id } });
  ctx.body = { success: true, message: '已删除' };
}

export async function syncFromUniversities(ctx: Context) {
  const universities = await prisma.university.findMany({
    select: { id: true, province: true, city: true },
    where: { OR: [{ province: { not: null } }, { city: { not: null } }] },
  });
  let provinceCount = 0;
  let cityCount = 0;
  let linkedCount = 0;
  for (const uni of universities) {
    const provinceName = normalizeName(uni.province);
    const cityName = normalizeName(uni.city);
    let provinceRegion: any = null;
    let cityRegion: any = null;
    if (provinceName) {
      provinceRegion = await prisma.region.findFirst({ where: { parentId: null, name: provinceName, level: 'province' } });
      if (!provinceRegion) {
        provinceRegion = await prisma.region.create({ data: { name: provinceName, level: 'province', status: 'enabled' } });
      } else if (provinceRegion.status !== 'enabled') {
        provinceRegion = await prisma.region.update({ where: { id: provinceRegion.id }, data: { status: 'enabled' } });
      }
      provinceCount += 1;
    }
    if (cityName) {
      cityRegion = await prisma.region.findFirst({ where: { parentId: provinceRegion?.id || null, name: cityName, level: 'city' } });
      if (!cityRegion) {
        cityRegion = await prisma.region.create({ data: { name: cityName, level: 'city', parentId: provinceRegion?.id || null, status: 'enabled' } });
      } else if (cityRegion.status !== 'enabled') {
        cityRegion = await prisma.region.update({ where: { id: cityRegion.id }, data: { status: 'enabled' } });
      }
      cityCount += 1;
    }
    await prisma.university.update({
      where: { id: uni.id },
      data: {
        provinceRegionId: provinceRegion?.id || null,
        cityRegionId: cityRegion?.id || null,
      },
    });
    linkedCount += 1;
  }
  ctx.body = { success: true, data: { universityCount: universities.length, provinceCount, cityCount, linkedCount } };
}
