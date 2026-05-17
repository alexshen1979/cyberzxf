const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, '..', 'src', 'static', 'icons');
const files = fs.readdirSync(iconDir).filter(f => f.endsWith('.svg'));

// Simple base64 encoder (works in all JS environments including miniprogram)
function toBase64(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const bytes = Buffer.from(str, 'utf-8');
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b3 & 63] : '=';
  }
  return result;
}

const lines = ['// SVG path data extracted from @element-plus/icons-vue'];
lines.push('');
lines.push('const _b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";');
lines.push('function _toBase64(str: string): string {');
lines.push('  let result = "";');
lines.push('  const len = str.length;');
lines.push('  for (let i = 0; i < len; i += 3) {');
lines.push('    const a = str.charCodeAt(i);');
lines.push('    const b = i + 1 < len ? str.charCodeAt(i + 1) : 0;');
lines.push('    const c = i + 2 < len ? str.charCodeAt(i + 2) : 0;');
lines.push('    result += _b64chars[a >> 2];');
lines.push('    result += _b64chars[((a & 3) << 4) | (b >> 4)];');
lines.push('    result += i + 1 < len ? _b64chars[((b & 15) << 2) | (c >> 6)] : "=";');
lines.push('    result += i + 2 < len ? _b64chars[c & 63] : "=";');
lines.push('  }');
lines.push('  return result;');
lines.push('}');
lines.push('');
lines.push('export const ICON_PATHS: Record<string, string> = {');

for (const f of files) {
  const name = f.replace('.svg', '');
  const svg = fs.readFileSync(path.join(iconDir, f), 'utf-8');
  const paths = [];
  const re = /<path[^>]*d="([^"]*)"[^>]*>/g;
  let m;
  while ((m = re.exec(svg)) !== null) {
    paths.push(m[1]);
  }
  if (paths.length === 0) {
    console.warn('WARNING: no paths found for', name);
  }
  lines.push(`  ${name}: "${paths.join(' ')}",`);
}
lines.push('};');
lines.push('');
lines.push('export function buildIconSrc(iconName: string, color: string): string {');
lines.push('  const d = ICON_PATHS[iconName] || ICON_PATHS["Star"] || "";');
lines.push('  const svg = "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 1024 1024\\"><path d=\\"" + d + "\\" fill=\\"" + color + "\\"/></svg>";');
lines.push('  return "data:image/svg+xml;base64," + _toBase64(svg);');
lines.push('}');
lines.push('');
lines.push('export function getIconSrc(iconName: string): string {');
lines.push('  return buildIconSrc(iconName, "#3b82f6");');
lines.push('}');

const outPath = path.join(__dirname, '..', 'src', 'utils', 'iconSvgs.ts');
fs.writeFileSync(outPath, lines.join('\n'));

// Verify
for (const f of files) {
  const name = f.replace('.svg', '');
  const svg = fs.readFileSync(path.join(iconDir, f), 'utf-8');
  const re = /<path[^>]*d="([^"]*)"[^>]*>/g;
  let count = 0;
  while (re.exec(svg) !== null) count++;
  if (count === 0) console.error('MISSING PATHS for', name, ':', svg.substring(0, 80));
}
console.log('Done:', files.length, 'icons');
