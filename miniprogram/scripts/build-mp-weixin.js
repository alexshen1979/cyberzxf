const { spawnSync } = require('child_process');
const path = require('path');
const { copyDir, patchProjectConfig, root, stripUniConsoleSocket } = require('./mp-weixin-output');

const mode = process.argv[2] || 'dev';
const isDev = mode === 'dev';
const buildDir = path.join(root, 'dist', 'build', 'mp-weixin');
const outDir = path.join(root, 'dist', isDev ? 'dev' : 'build', 'mp-weixin');

const env = Object.assign({}, process.env, {
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL || 'https://zhangshi-api.digitsecho.com/api/v1',
});

if (isDev) {
  delete env.UNI_SOCKET_HOSTS;
  delete env.UNI_SOCKET_PORT;
  delete env.UNI_SOCKET_ID;
}

const args = ['build', '-p', 'mp-weixin'];
const result = spawnSync('uni', args, {
  cwd: root,
  env,
  stdio: 'inherit',
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}

if (isDev) {
  copyDir(buildDir, outDir);
}
patchProjectConfig(outDir, { urlCheck: !isDev });
if (isDev && stripUniConsoleSocket(outDir)) {
  console.log('Disabled uni dev console socket for WeChat DevTools.');
}
console.log(`${isDev ? 'Dev' : 'Build'} package ready: ${outDir}`);
