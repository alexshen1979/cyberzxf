import { Context, Next } from 'koa';
import { ZodError } from 'zod';
import { createLogger } from '../utils/logger';

const logger = createLogger('error');

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string = 'UNKNOWN_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export async function errorHandler(ctx: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    logger.error(err);

    if (err instanceof AppError) {
      ctx.status = err.statusCode;
      ctx.body = {
        success: false,
        code: err.code,
        message: err.message,
        details: err.details,
      };
      return;
    }

    if (err instanceof ZodError) {
      ctx.status = 422;
      ctx.body = {
        success: false,
        code: 'VALIDATION_ERROR',
        message: '参数校验失败',
        details: err.errors,
      };
      return;
    }

    ctx.status = 500;
    ctx.body = {
      success: false,
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    };
  }
}
