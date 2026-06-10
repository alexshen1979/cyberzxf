import { Context } from 'koa';
import axios from 'axios';
import { createLogger } from '../utils/logger';

type IpLocation = {
  ip: string;
  province: string;
  city: string;
  source: string;
};

const logger = createLogger('ip-location');
const cache = new Map<string, { value: IpLocation | null; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function getClientIp(ctx: Context) {
  const candidates = [
    ctx.get('x-real-ip'),
    lastForwardedPublicIp(ctx.get('x-forwarded-for')),
    ctx.ip,
    ctx.request.ip,
    ctx.req.socket.remoteAddress,
  ];

  for (const candidate of candidates) {
    const ip = normalizeIp(candidate);
    if (ip && isPublicIp(ip)) return ip;
  }
  return '';
}

export async function lookupIpLocation(ip?: string | null): Promise<IpLocation | null> {
  const normalizedIp = normalizeIp(ip);
  if (!normalizedIp || !isPublicIp(normalizedIp)) return null;

  const cached = cache.get(normalizedIp);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = await lookupWithFallback(normalizedIp);
  cache.set(normalizedIp, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

async function lookupWithFallback(ip: string) {
  try {
    const pconline = await lookupPconline(ip);
    if (pconline) return pconline;
  } catch (err: any) {
    logger.warn('PConline IP 归属地查询失败: ip=%s message=%s', ip, err?.message || err);
  }

  try {
    return await lookupIpApi(ip);
  } catch (err: any) {
    logger.warn('ip-api IP 归属地查询失败: ip=%s message=%s', ip, err?.message || err);
    return null;
  }
}

async function lookupPconline(ip: string): Promise<IpLocation | null> {
  const response = await axios.get('https://whois.pconline.com.cn/ipJson.jsp', {
    params: { ip, json: true },
    responseType: 'arraybuffer',
    timeout: 1800,
    headers: { 'User-Agent': 'CyberZhang/1.2.1' },
  });
  const text = decodeResponseText(response.data, 'gbk');
  const data = parseLooseJson(text);
  const province = normalizeProvince(data?.pro || data?.province);
  const city = normalizeCity(data?.city);
  if (!province && !city) return null;
  return { ip, province, city, source: 'pconline' };
}

async function lookupIpApi(ip: string): Promise<IpLocation | null> {
  const response = await axios.get(`http://ip-api.com/json/${encodeURIComponent(ip)}`, {
    params: {
      lang: 'zh-CN',
      fields: 'status,country,regionName,city,query',
    },
    timeout: 1800,
  });
  const data = response.data || {};
  if (data.status !== 'success') return null;

  const country = normalizeLocationText(data.country, 40);
  const region = normalizeLocationText(data.regionName, 40);
  const city = normalizeCity(data.city);
  const province = country === '中国' ? normalizeProvince(region) : (region || country);
  if (!province && !city) return null;
  return { ip, province, city, source: 'ip-api' };
}

function lastForwardedPublicIp(value: string) {
  const parts = String(value || '').split(',').map(part => normalizeIp(part)).filter(Boolean);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (isPublicIp(parts[index])) return parts[index];
  }
  return parts[0] || '';
}

function normalizeIp(value: any) {
  let ip = String(value || '').trim();
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') return '127.0.0.1';
  const bracketMatch = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketMatch) ip = bracketMatch[1];
  const ipv4WithPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) ip = ipv4WithPort[1];
  return ip;
}

function isPublicIp(ip: string) {
  if (isPrivateIpv4(ip)) return false;
  if (ip.includes(':')) return !isPrivateIpv6(ip);
  return isValidIpv4(ip);
}

function isValidIpv4(ip: string) {
  const parts = ip.split('.');
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const value = Number(part);
    return value >= 0 && value <= 255;
  });
}

function isPrivateIpv4(ip: string) {
  if (!isValidIpv4(ip)) return false;
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 0
  );
}

function isPrivateIpv6(ip: string) {
  const lower = ip.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
}

function decodeResponseText(buffer: ArrayBuffer, encoding: string) {
  try {
    return new TextDecoder(encoding).decode(Buffer.from(buffer));
  } catch {
    return Buffer.from(buffer).toString('utf8');
  }
}

function parseLooseJson(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return JSON.parse(text.slice(start, end + 1));
}

function normalizeProvince(value: any) {
  return normalizeLocationText(value, 40)
    .replace(/维吾尔自治区$/, '')
    .replace(/壮族自治区$/, '')
    .replace(/回族自治区$/, '')
    .replace(/自治区$/, '')
    .replace(/特别行政区$/, '')
    .replace(/[省市]$/, '');
}

function normalizeCity(value: any) {
  return normalizeLocationText(value, 40)
    .replace(/特别行政区$/, '')
    .replace(/[市]$/, '');
}

function normalizeLocationText(value: any, max: number) {
  return String(value || '')
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, max);
}
