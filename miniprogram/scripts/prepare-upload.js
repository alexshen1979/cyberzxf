const fs = require('fs');
const path = require('path');
const { patchProjectConfig } = require('./mp-weixin-output');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'dist', 'build', 'mp-weixin');
const uploadDir = path.join(root, 'dist', 'upload', 'mp-weixin');
const mediaExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp3', '.wav', '.aac', '.m4a']);
const limit = 200 * 1024;

function copyDir(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Build output not found: ${sourceDir}`);
}

copyDir(sourceDir, uploadDir);
patchProjectConfig(uploadDir, { urlCheck: true });

const oversized = walk(uploadDir)
  .filter((file) => mediaExtensions.has(path.extname(file).toLowerCase()))
  .map((file) => ({ file, size: fs.statSync(file).size }))
  .filter((item) => item.size > limit);

if (oversized.length) {
  console.error('Oversized media files found:');
  for (const item of oversized) {
    console.error(`${item.size} ${path.relative(uploadDir, item.file)}`);
  }
  process.exit(1);
}

console.log(`Upload package ready: ${uploadDir}`);
