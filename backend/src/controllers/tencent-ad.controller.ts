import { Context } from 'koa';
import {
  getTencentAdConversionConfigForAdmin,
  listTencentAdConversionEvents,
  retryTencentAdConversionEvent,
  updateTencentAdConversionConfig,
} from '../services/tencent-ad-conversion.service';

export async function adminGetTencentAdConfig(ctx: Context) {
  ctx.body = { success: true, data: await getTencentAdConversionConfigForAdmin() };
}

export async function adminUpdateTencentAdConfig(ctx: Context) {
  ctx.body = { success: true, data: await updateTencentAdConversionConfig(ctx.request.body as Record<string, any>) };
}

export async function adminListTencentAdEvents(ctx: Context) {
  ctx.body = { success: true, data: await listTencentAdConversionEvents(ctx.query as Record<string, any>) };
}

export async function adminRetryTencentAdEvent(ctx: Context) {
  ctx.body = { success: true, data: await retryTencentAdConversionEvent(ctx.params.id) };
}
