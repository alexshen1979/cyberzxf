import { prisma } from '../utils/prisma';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';

type RechargeProductInput = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  originalPrice?: number | null;
  points: number;
  bonus: number;
  isDefault: boolean;
  badgeType?: string | null;
  sortOrder: number;
  enabled: boolean;
};

const DEFAULT_RECHARGE_PRODUCTS = [
  { id: 'pkg_120', name: '120 咨询点数', description: '首充体验，适合生成报告后继续追问', price: 1990, originalPrice: 2990, points: 120, bonus: 0, isDefault: false, badgeType: null, sortOrder: 10, enabled: true },
  { id: 'pkg_280', name: '240 咨询点数 + 赠40点', description: '推荐套餐，适合志愿季集中使用', price: 3990, originalPrice: 5990, points: 240, bonus: 40, isDefault: false, badgeType: null, sortOrder: 20, enabled: true },
  { id: 'pkg_560', name: '480 咨询点数 + 赠80点', description: '适合多省市、多院校反复对比', price: 6990, originalPrice: 9990, points: 480, bonus: 80, isDefault: true, badgeType: 'hot', sortOrder: 30, enabled: true },
  { id: 'pkg_1000', name: '800 咨询点数 + 赠200点', description: '家庭规划包，适合长期升学咨询', price: 9990, originalPrice: 14990, points: 800, bonus: 200, isDefault: false, badgeType: 'best_value', sortOrder: 40, enabled: true },
];

export async function ensurePointSettings() {
  const current = await prisma.pointSetting.findUnique({ where: { id: 'default' } });
  if (current) return current;
  return prisma.pointSetting.create({
    data: {
      id: 'default',
      freeGift: config.points.freeGift,
      defaultCost: config.points.defaultCost,
      deepAnalysisCost: config.points.deepAnalysisCost,
      volunteerAnalysisCost: config.points.volunteerAnalysisCost,
      volunteerReportPdfCost: config.points.volunteerReportPdfCost,
      volunteerReportImageCost: config.points.volunteerReportImageCost,
      expireDays: config.points.expireDays,
    },
  });
}

export async function getPointSettings() {
  return ensurePointSettings();
}

export async function updatePointSettings(input: Record<string, any>) {
  const data = normalizePointSettings(input);
  return prisma.pointSetting.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data },
    update: data,
  });
}

export async function seedDefaultRechargeProducts() {
  const count = await prisma.rechargeProduct.count();
  if (count === 0) {
    await prisma.rechargeProduct.createMany({ data: DEFAULT_RECHARGE_PRODUCTS });
    return;
  }
  await ensureRechargeProductDisplayDefaults();
}

export async function listRechargeProducts(options: { includeDisabled?: boolean } = {}) {
  await seedDefaultRechargeProducts();
  return prisma.rechargeProduct.findMany({
    where: options.includeDisabled ? undefined : { enabled: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

async function ensureRechargeProductDisplayDefaults() {
  const hasDisplayConfig = await prisma.rechargeProduct.count({
    where: {
      OR: [
        { isDefault: true },
        { badgeType: { not: null } },
      ],
    },
  });
  if (hasDisplayConfig > 0) return;

  await prisma.$transaction([
    prisma.rechargeProduct.updateMany({
      where: { id: 'pkg_560' },
      data: { isDefault: true, badgeType: 'hot' },
    }),
    prisma.rechargeProduct.updateMany({
      where: { id: 'pkg_1000' },
      data: { badgeType: 'best_value' },
    }),
  ]);
}

export async function getRechargeProductById(id: string, options: { includeDisabled?: boolean } = {}) {
  await seedDefaultRechargeProducts();
  const product = await prisma.rechargeProduct.findUnique({ where: { id } });
  if (!product || (!options.includeDisabled && !product.enabled)) return null;
  return product;
}

export async function createRechargeProduct(input: Record<string, any>) {
  const data = normalizeRechargeProduct(input, false) as RechargeProductInput;
  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.rechargeProduct.updateMany({ data: { isDefault: false } });
    }
    return tx.rechargeProduct.create({ data });
  });
}

export async function updateRechargeProduct(id: string, input: Record<string, any>) {
  const data = normalizeRechargeProduct(input, true);
  return prisma.$transaction(async (tx) => {
    if (data.isDefault === true) {
      await tx.rechargeProduct.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false },
      });
    }
    return tx.rechargeProduct.update({ where: { id }, data });
  });
}

export async function deleteRechargeProduct(id: string) {
  const orderCount = await prisma.order.count({ where: { productId: id } });
  if (orderCount > 0) {
    return prisma.rechargeProduct.update({ where: { id }, data: { enabled: false } });
  }
  await prisma.rechargeProduct.delete({ where: { id } });
  return null;
}

function normalizePointSettings(input: Record<string, any>) {
  return {
    freeGift: intInRange(input.freeGift, 0, 100000, '新用户赠送点数'),
    defaultCost: intInRange(input.defaultCost, 0, 10000, '普通问答扣点'),
    deepAnalysisCost: intInRange(input.deepAnalysisCost, 0, 10000, '深度分析扣点'),
    volunteerAnalysisCost: intInRange(input.volunteerAnalysisCost, 0, 10000, '志愿分析扣点'),
    volunteerReportPdfCost: intInRange(input.volunteerReportPdfCost, 0, 10000, 'PDF报告导出扣点'),
    volunteerReportImageCost: intInRange(input.volunteerReportImageCost, 0, 10000, '长图报告导出扣点'),
    expireDays: intInRange(input.expireDays, 1, 3650, '点数有效期'),
  };
}

function normalizeRechargeProduct(input: Record<string, any>, partial: boolean) {
  const data: Record<string, any> = {};
  if (!partial || input.id !== undefined) {
    const id = String(input.id || '').trim();
    if (!/^[a-zA-Z0-9_-]{2,64}$/.test(id)) {
      throw new AppError(422, '套餐 ID 只能包含字母、数字、下划线和中横线，长度 2-64', 'PRODUCT_ID_INVALID');
    }
    data.id = id;
  }
  if (!partial || input.name !== undefined) {
    const name = String(input.name || '').trim();
    if (!name) throw new AppError(422, '请填写套餐名称', 'PRODUCT_NAME_REQUIRED');
    data.name = name;
  }
  if (!partial || input.description !== undefined) {
    const description = String(input.description || '').trim();
    data.description = description || null;
  }
  if (!partial || input.price !== undefined) data.price = intInRange(input.price, 1, 100000000, '套餐价格');
  if (!partial || input.originalPrice !== undefined) {
    data.originalPrice = input.originalPrice === null || input.originalPrice === ''
      ? null
      : intInRange(input.originalPrice, 1, 100000000, '套餐原价');
  }
  if (!partial || input.points !== undefined) data.points = intInRange(input.points, 0, 10000000, '基础点数');
  if (!partial || input.bonus !== undefined) data.bonus = intInRange(input.bonus || 0, 0, 10000000, '赠送点数');
  if (!partial || input.isDefault !== undefined) data.isDefault = input.isDefault === true;
  if (!partial || input.badgeType !== undefined) data.badgeType = normalizeBadgeType(input.badgeType);
  if (!partial || input.sortOrder !== undefined) data.sortOrder = intInRange(input.sortOrder || 0, -100000, 100000, '排序');
  if (!partial || input.enabled !== undefined) data.enabled = input.enabled !== false;
  return data;
}

function normalizeBadgeType(value: any) {
  const badgeType = String(value || '').trim();
  if (!badgeType) return null;
  if (!['hot', 'best_value'].includes(badgeType)) {
    throw new AppError(422, '套餐角标只能选择热门或最划算', 'PRODUCT_BADGE_INVALID');
  }
  return badgeType;
}

function intInRange(value: any, min: number, max: number, label: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new AppError(422, `${label}必须是 ${min}-${max} 之间的整数`, 'POINT_CONFIG_INVALID');
  }
  return n;
}
