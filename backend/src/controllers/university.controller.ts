import { Context } from 'koa';
import { prisma } from '../utils/prisma';

function normalizeFeatureTags(value: unknown): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value.map(item => String(item).trim()).filter(Boolean));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '[]';
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return JSON.stringify(parsed.map(item => String(item).trim()).filter(Boolean));
      }
    } catch {
      // Fall through to separator-based parsing.
    }
    return JSON.stringify(trimmed.split(/[,，、\s]+/).map(item => item.trim()).filter(Boolean));
  }
  return '[]';
}

function transformUniversity(item: any) {
  try {
    return { ...item, featureTags: JSON.parse(item.featureTags || '[]') };
  } catch {
    return { ...item, featureTags: [] };
  }
}

// 公开：高校列表（支持筛选）
export async function list(ctx: Context) {
  const { province, type, level, keyword, page: p, pageSize: ps } = ctx.query as Record<string, string>;
  const page = Math.max(1, parseInt(p || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(ps || '50')));

  const where: any = {};
  if (province) where.province = province;
  if (type) where.type = type;
  if (level) where.level = { contains: level };
  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { city: { contains: keyword } },
      { province: { contains: keyword } },
    ];
  }

  const [list, total] = await Promise.all([
    prisma.university.findMany({
      where,
      orderBy: [{ is985: 'desc' }, { is211: 'desc' }, { isDoubleFirst: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.university.count({ where }),
  ]);

  ctx.body = { success: true, data: { list: list.map(transformUniversity), total, page, pageSize } };
}

// 公开：高校详情
export async function detail(ctx: Context) {
  const uni = await prisma.university.findUnique({ where: { id: ctx.params.id } });
  if (!uni) { ctx.status = 404; ctx.body = { success: false, message: '未找到该高校' }; return; }
  ctx.body = { success: true, data: transformUniversity(uni) };
}

// 公开：筛选选项（省份/类型/层次/属性/城市）
export async function filters(ctx: Context) {
  const { province } = ctx.query as Record<string, string>;

  const [regionProvinces, regionCities, provinces, types, levels, properties, cities] = await Promise.all([
    prisma.region.findMany({ where: { level: 'province', status: 'enabled' }, select: { id: true, name: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    province
      ? prisma.region.findMany({
          where: { level: 'city', status: 'enabled', parent: { name: province } },
          select: { name: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })
      : prisma.region.findMany({ where: { level: 'city', status: 'enabled' }, select: { name: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.university.findMany({ select: { province: true }, distinct: ['province'], orderBy: { province: 'asc' } }),
    prisma.university.findMany({ select: { type: true }, distinct: ['type'], orderBy: { type: 'asc' } }),
    prisma.university.findMany({ select: { level: true }, distinct: ['level'], orderBy: { level: 'asc' } }),
    prisma.university.findMany({ select: { properties: true }, distinct: ['properties'], orderBy: { properties: 'asc' } }),
    prisma.university.findMany({
      where: province ? { province } : {},
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    }),
  ]);
  ctx.body = {
    success: true,
    data: {
      provinces: regionProvinces.length ? regionProvinces.map(p => p.name) : provinces.map(p => p.province).filter(Boolean),
      types: types.map(t => t.type).filter(Boolean),
      levels: levels.map(l => l.level).filter(Boolean),
      properties: properties.map(p => p.properties).filter(Boolean),
      cities: regionCities.length ? regionCities.map(c => c.name) : cities.map(c => c.city).filter(Boolean),
    },
  };
}

async function resolveRegions(province?: string | null, city?: string | null) {
  const provinceName = String(province || '').trim();
  const cityName = String(city || '').trim();
  const provinceRegion = provinceName
    ? await prisma.region.findFirst({ where: { level: 'province', name: provinceName } })
    : null;
  const cityRegion = cityName
    ? await prisma.region.findFirst({
        where: {
          level: 'city',
          name: cityName,
          ...(provinceRegion ? { parentId: provinceRegion.id } : {}),
        },
      })
    : null;
  return { provinceRegion, cityRegion };
}

// 管理端：列表（多维度筛选）
export async function adminList(ctx: Context) {
  const {
    keyword, code, name,
    province, city, type, level, properties,
    is985, is211, isDoubleFirst,
    page: p, pageSize: ps,
  } = ctx.query as Record<string, string>;
  const page = Math.max(1, parseInt(p || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(ps || '50')));

  const where: any = {};
  // 名称模糊搜索
  if (name) where.name = { contains: name };
  else if (keyword) where.name = { contains: keyword };
  // 院校代码模糊搜索
  if (code) where.code = { contains: code };
  // 精确匹配
  if (province) where.province = province;
  if (city) where.city = { contains: city };
  if (type) where.type = type;
  if (level) where.level = level;
  if (properties) where.properties = properties;
  // 标签
  if (is985 === 'true') where.is985 = true;
  if (is211 === 'true') where.is211 = true;
  if (isDoubleFirst === 'true') where.isDoubleFirst = true;

  const [list, total] = await Promise.all([
    prisma.university.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.university.count({ where }),
  ]);

  ctx.body = { success: true, data: { list: list.map(transformUniversity), total, page, pageSize } };
}

// 管理端：创建高校
export async function create(ctx: Context) {
  const body = ctx.request.body as Record<string, any>;
  if (!body.name) { ctx.status = 400; ctx.body = { success: false, message: '学校名称不能为空' }; return; }
  const { provinceRegion, cityRegion } = await resolveRegions(body.province, body.city);

  const uni = await prisma.university.create({
    data: {
      name: body.name,
      code: body.code || null,
      type: body.type || null,
      level: body.level || null,
      province: body.province || null,
      city: body.city || null,
      provinceRegionId: provinceRegion?.id || null,
      cityRegionId: cityRegion?.id || null,
      is985: body.is985 === true || body.is985 === 'true',
      is211: body.is211 === true || body.is211 === 'true',
      isDoubleFirst: body.isDoubleFirst === true || body.isDoubleFirst === 'true',
      properties: body.properties || null,
      logo: body.logo || null,
      address: body.address || null,
      website: body.website || null,
      introduction: body.introduction || null,
      featureTags: normalizeFeatureTags(body.featureTags),
    },
  });
  ctx.body = { success: true, data: transformUniversity(uni) };
}

// 管理端：更新高校
export async function update(ctx: Context) {
  const body = ctx.request.body as Record<string, any>;
  const { id } = ctx.params;

  const existing = await prisma.university.findUnique({ where: { id } });
  if (!existing) { ctx.status = 404; ctx.body = { success: false, message: '未找到该高校' }; return; }

  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.code !== undefined) data.code = body.code || null;
  if (body.type !== undefined) data.type = body.type || null;
  if (body.level !== undefined) data.level = body.level || null;
  if (body.province !== undefined || body.city !== undefined) {
    const nextProvince = body.province !== undefined ? body.province : existing.province;
    const nextCity = body.city !== undefined ? body.city : existing.city;
    const { provinceRegion, cityRegion } = await resolveRegions(nextProvince, nextCity);
    data.province = nextProvince || null;
    data.city = nextCity || null;
    data.provinceRegionId = provinceRegion?.id || null;
    data.cityRegionId = cityRegion?.id || null;
  }
  if (body.is985 !== undefined) data.is985 = body.is985 === true || body.is985 === 'true';
  if (body.is211 !== undefined) data.is211 = body.is211 === true || body.is211 === 'true';
  if (body.isDoubleFirst !== undefined) data.isDoubleFirst = body.isDoubleFirst === true || body.isDoubleFirst === 'true';
  if (body.properties !== undefined) data.properties = body.properties || null;
  if (body.logo !== undefined) data.logo = body.logo || null;
  if (body.address !== undefined) data.address = body.address || null;
  if (body.website !== undefined) data.website = body.website || null;
  if (body.introduction !== undefined) data.introduction = body.introduction || null;
  if (body.featureTags !== undefined) data.featureTags = normalizeFeatureTags(body.featureTags);

  const uni = await prisma.university.update({ where: { id }, data });
  ctx.body = { success: true, data: transformUniversity(uni) };
}

// 管理端：删除高校
export async function remove(ctx: Context) {
  const { id } = ctx.params;
  const existing = await prisma.university.findUnique({ where: { id } });
  if (!existing) { ctx.status = 404; ctx.body = { success: false, message: '未找到该高校' }; return; }

  await prisma.university.delete({ where: { id } });
  ctx.body = { success: true, message: '已删除' };
}
