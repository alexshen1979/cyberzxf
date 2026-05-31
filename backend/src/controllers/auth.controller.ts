import { Context } from 'koa';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as authService from '../services/auth.service';
import { prisma } from '../utils/prisma';
import { ensureUserShareCode } from '../services/distribution.service';
import { AppError } from '../middleware/errorHandler';

const AVATAR_OUTPUT_DIR = path.resolve(process.cwd(), 'uploads', 'avatars');
const AVATAR_BASE_URL = process.env.PUBLIC_UPLOAD_BASE_URL || 'https://zhangshi-api.digitsecho.com';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function miniProgramLogin(ctx: Context) {
  const { code, userInfo, referralCode } = ctx.request.body as any;
  if (!code) {
    ctx.status = 422;
    ctx.body = { success: false, message: '缺少登录凭证 code' };
    return;
  }

  const result = await authService.loginByMiniProgram(code, userInfo, referralCode);
  ctx.body = { success: true, data: result };
}

export async function mpOAuthLogin(ctx: Context) {
  const { code } = ctx.request.body as any;
  if (!code) {
    ctx.status = 422;
    ctx.body = { success: false, message: '缺少授权 code' };
    return;
  }

  const result = await authService.loginByMpOAuth(code);
  ctx.body = { success: true, data: result };
}

export async function getProfile(ctx: Context) {
  const userId = ctx.state.user.userId;
  const user = await ensureUserShareCode(userId);

  ctx.body = { success: true, data: user };
}

export async function updateProfile(ctx: Context) {
  const userId = ctx.state.user.userId;
  const { nickname, avatar, phone } = ctx.request.body as any;

  const data: any = {};
  if (Object.prototype.hasOwnProperty.call(ctx.request.body as any, 'nickname')) {
    data.nickname = typeof nickname === 'string' ? nickname.trim().slice(0, 40) || null : null;
  }
  if (Object.prototype.hasOwnProperty.call(ctx.request.body as any, 'avatar')) {
    data.avatar = normalizeAvatarUrl(avatar);
  }
  if (Object.prototype.hasOwnProperty.call(ctx.request.body as any, 'phone')) {
    data.phone = phone;
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data,
      select: { id: true, nickname: true, avatar: true, phone: true, shareCode: true, createdAt: true },
    });

    if (Object.prototype.hasOwnProperty.call(data, 'nickname')) {
      await tx.distributor.updateMany({
        where: { userId },
        data: { name: updated.nickname || updated.phone || `分销员${userId.slice(0, 6)}` },
      });
    }

    return updated;
  });

  ctx.body = { success: true, data: user };
}

export async function uploadAvatar(ctx: Context) {
  const userId = ctx.state.user.userId;
  const { image } = ctx.request.body as any;
  const parsed = parseAvatarDataUrl(String(image || ''));
  const extension = AVATAR_MIME_EXTENSIONS[parsed.mime];
  if (!extension) {
    throw new AppError(422, '头像格式仅支持 JPG、PNG、WebP', 'AVATAR_TYPE_INVALID');
  }
  if (parsed.buffer.length > MAX_AVATAR_BYTES) {
    throw new AppError(422, '头像图片不能超过 2MB', 'AVATAR_TOO_LARGE');
  }

  await fs.promises.mkdir(AVATAR_OUTPUT_DIR, { recursive: true });
  const filename = `${safePathSegment(userId)}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
  const filePath = path.join(AVATAR_OUTPUT_DIR, filename);
  await fs.promises.writeFile(filePath, parsed.buffer);

  const avatar = `${AVATAR_BASE_URL.replace(/\/$/, '')}/api/v1/uploads/avatars/${filename}`;
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatar },
    select: { id: true, nickname: true, avatar: true, phone: true, shareCode: true, createdAt: true },
  });

  ctx.body = { success: true, data: { avatar, user } };
}

export async function getUploadedAvatar(ctx: Context) {
  const filename = safePathSegment(ctx.params.filename || '');
  if (!filename) {
    ctx.status = 404;
    return;
  }
  const filePath = path.join(AVATAR_OUTPUT_DIR, filename);
  if (!filePath.startsWith(`${AVATAR_OUTPUT_DIR}${path.sep}`) || !fs.existsSync(filePath)) {
    ctx.status = 404;
    return;
  }

  ctx.set('Cache-Control', 'public, max-age=31536000, immutable');
  ctx.set('Content-Type', contentTypeFromFilename(filename));
  ctx.body = fs.createReadStream(filePath);
}

function normalizeAvatarUrl(value: any) {
  const avatar = typeof value === 'string' ? value.trim() : '';
  if (!avatar) return null;
  if (/^(wxfile|http:\/\/tmp|https?:\/\/tmp|file):/i.test(avatar)) {
    throw new AppError(422, '头像需要先上传后再保存', 'AVATAR_UPLOAD_REQUIRED');
  }
  if (!/^https?:\/\//i.test(avatar) && !avatar.startsWith('/api/v1/uploads/avatars/')) {
    throw new AppError(422, '头像地址格式不正确', 'AVATAR_URL_INVALID');
  }
  return avatar.slice(0, 1000);
}

function parseAvatarDataUrl(value: string) {
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw new AppError(422, '头像图片数据格式不正确', 'AVATAR_DATA_INVALID');
  }
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length) {
    throw new AppError(422, '头像图片不能为空', 'AVATAR_EMPTY');
  }
  return { mime: match[1], buffer };
}

function safePathSegment(value: string) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 120);
}

function contentTypeFromFilename(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}
