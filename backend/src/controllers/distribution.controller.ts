import { Context } from 'koa';
import {
  applyDistributor,
  applyDistributionWithdrawal,
  bindShareReferral,
  createDistributorForAdmin,
  getDistributionDashboardForAdmin,
  getDistributionPendingCountsForAdmin,
  getDistributionSettingsForAdmin,
  getMyDistribution,
  getMyDistributionCommissions,
  getMyDistributionQrCode,
  getMyDistributionWithdrawals,
  getGeneralAgentStatsForAdmin,
  getWithdrawalTransferPackage,
  handleWechatTransferCallbackForDistribution,
  listCommissionsForAdmin,
  listDistributorsForAdmin,
  listDistributorTreeForAdmin,
  listGeneralAgentCommissionsForAdmin,
  listGeneralAgentsForAdmin,
  listLevelOneDistributorsForAdmin,
  markGeneralAgentCommissionForAdmin,
  listWithdrawalsForAdmin,
  recordUserShare,
  reviewWithdrawalForAdmin,
  queryWechatTransferForAdmin,
  startWechatTransferForAdmin,
  syncMyWechatWithdrawal,
  updateDistributionSettingsForAdmin,
  updateDistributorForAdmin,
} from '../services/distribution.service';

export async function me(ctx: Context) {
  const userId = ctx.state.user.userId;
  ctx.body = { success: true, data: await getMyDistribution(userId) };
}

export async function apply(ctx: Context) {
  const userId = ctx.state.user.userId;
  ctx.body = { success: true, data: await applyDistributor(userId) };
}

export async function qrcode(ctx: Context) {
  const userId = ctx.state.user.userId;
  ctx.body = { success: true, data: await getMyDistributionQrCode(userId) };
}

export async function recordShare(ctx: Context) {
  const userId = ctx.state.user.userId;
  ctx.body = { success: true, data: await recordUserShare(userId, ctx.request.body as Record<string, any>) };
}

export async function bindReferral(ctx: Context) {
  const userId = ctx.state.user.userId;
  const { referralCode } = ctx.request.body as any;
  ctx.body = { success: true, data: await bindShareReferral(userId, referralCode) };
}

export async function commissions(ctx: Context) {
  const userId = ctx.state.user.userId;
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);
  ctx.body = { success: true, data: await getMyDistributionCommissions(userId, page, pageSize) };
}

export async function withdrawals(ctx: Context) {
  const userId = ctx.state.user.userId;
  const page = parseInt((ctx.query.page as string) || '1', 10);
  const pageSize = parseInt((ctx.query.pageSize as string) || '20', 10);
  ctx.body = { success: true, data: await getMyDistributionWithdrawals(userId, page, pageSize) };
}

export async function applyWithdrawal(ctx: Context) {
  const userId = ctx.state.user.userId;
  ctx.body = { success: true, data: await applyDistributionWithdrawal(userId, ctx.request.body as Record<string, any>) };
}

export async function withdrawalTransferPackage(ctx: Context) {
  const userId = ctx.state.user.userId;
  ctx.body = { success: true, data: await getWithdrawalTransferPackage(userId, ctx.params.id) };
}

export async function syncWithdrawalTransfer(ctx: Context) {
  const userId = ctx.state.user.userId;
  ctx.body = { success: true, data: await syncMyWechatWithdrawal(userId, ctx.params.id) };
}

export async function adminSettings(ctx: Context) {
  ctx.body = { success: true, data: await getDistributionSettingsForAdmin() };
}

export async function adminUpdateSettings(ctx: Context) {
  ctx.body = { success: true, data: await updateDistributionSettingsForAdmin(ctx.request.body as Record<string, any>) };
}

export async function adminDashboard(ctx: Context) {
  ctx.body = { success: true, data: await getDistributionDashboardForAdmin() };
}

export async function adminPendingCounts(ctx: Context) {
  ctx.body = { success: true, data: await getDistributionPendingCountsForAdmin() };
}

export async function adminDistributors(ctx: Context) {
  ctx.body = { success: true, data: await listDistributorsForAdmin(ctx.query as Record<string, any>) };
}

export async function adminDistributorTree(ctx: Context) {
  ctx.body = { success: true, data: await listDistributorTreeForAdmin(ctx.query as Record<string, any>) };
}

export async function adminLevelOneDistributors(ctx: Context) {
  ctx.body = { success: true, data: await listLevelOneDistributorsForAdmin() };
}

export async function adminGeneralAgents(ctx: Context) {
  ctx.body = { success: true, data: await listGeneralAgentsForAdmin() };
}

export async function adminCreateDistributor(ctx: Context) {
  ctx.body = { success: true, data: await createDistributorForAdmin(sanitizeDistributorAdminInput(ctx, ctx.request.body as Record<string, any>)) };
}

export async function adminUpdateDistributor(ctx: Context) {
  ctx.body = { success: true, data: await updateDistributorForAdmin(ctx.params.id, sanitizeDistributorAdminInput(ctx, ctx.request.body as Record<string, any>)) };
}

export async function adminCommissions(ctx: Context) {
  ctx.body = { success: true, data: await listCommissionsForAdmin(ctx.query as Record<string, any>) };
}

export async function adminGeneralAgentCommissions(ctx: Context) {
  ctx.body = { success: true, data: await listGeneralAgentCommissionsForAdmin(ctx.query as Record<string, any>) };
}

export async function adminGeneralAgentStats(ctx: Context) {
  ctx.body = { success: true, data: await getGeneralAgentStatsForAdmin(ctx.params.id) };
}

export async function adminMarkGeneralAgentCommission(ctx: Context) {
  ctx.body = { success: true, data: await markGeneralAgentCommissionForAdmin(ctx.params.id, ctx.request.body as Record<string, any>) };
}

export async function adminWithdrawals(ctx: Context) {
  ctx.body = { success: true, data: await listWithdrawalsForAdmin(ctx.query as Record<string, any>) };
}

export async function adminReviewWithdrawal(ctx: Context) {
  ctx.body = { success: true, data: await reviewWithdrawalForAdmin(ctx.params.id, ctx.request.body as Record<string, any>) };
}

export async function adminStartWechatTransfer(ctx: Context) {
  ctx.body = { success: true, data: await startWechatTransferForAdmin(ctx.params.id, ctx.request.body as Record<string, any>) };
}

export async function adminQueryWechatTransfer(ctx: Context) {
  ctx.body = { success: true, data: await queryWechatTransferForAdmin(ctx.params.id) };
}

export async function transferCallback(ctx: Context) {
  await handleWechatTransferCallbackForDistribution(ctx.request.body as Record<string, any>, ctx.headers, (ctx.request as any).rawBody);
  ctx.body = { code: 'SUCCESS', message: 'OK' };
}

function sanitizeDistributorAdminInput(ctx: Context, input: Record<string, any>) {
  const role = ctx.state.user?.role;
  if (role === 'admin' || role === 'super_admin') return input;

  const data = { ...input };
  delete data.isGeneralAgent;
  delete data.generalAgentRate;
  delete data.generalAgentParentId;
  return data;
}
