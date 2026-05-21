const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function patchProjectConfig(dir, { urlCheck }) {
  for (const name of ['project.config.json', 'project.private.config.json']) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) continue;
    const config = readJson(file);
    config.setting = Object.assign({}, config.setting, {
      urlCheck,
      bigPackageSizeSupport: true,
    });
    writeJson(file, config);
  }
}

function stripUniConsoleSocket(dir) {
  const vendor = path.join(dir, 'common', 'vendor.js');
  if (!fs.existsSync(vendor)) return false;
  const code = fs.readFileSync(vendor, 'utf8');
  const patched = code.replace(/\n?initRuntimeSocketService\(\);\n?/, '\n');
  if (patched === code) return false;
  fs.writeFileSync(vendor, patched);
  return true;
}

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

module.exports = {
  root,
  copyDir,
  patchProjectConfig,
  stripUniConsoleSocket,
};
