const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'mkt/pre-score-creatives');
const IMAGE_DIR = path.join(OUT_DIR, 'images/9grid-sentence');
const HTML_DIR = path.join(OUT_DIR, 'editable-html/sentence-grid');

const LOGO_PATH = path.join(ROOT, 'backend/src/assets/brand-logo.png');
const BG_PATH = path.join(ROOT, 'mkt/materials/images/posters/04_parent_user_高三家长AI志愿分析海报_bg.png');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function dataUri(filePath) {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext || 'png'}`;
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const logoData = dataUri(LOGO_PATH);
const bgData = dataUri(BG_PATH);

const tiles = [
  {
    phrase: '出分之前',
    label: '出分前阶段',
    detailTitle: '先做准备，不做最终决定',
    detail: '这一阶段重点是信息整理和方向预案，等分数位次明确后再更新方案。',
    chips: ['信息整理', '方向预案'],
    accent: '#078984',
  },
  {
    phrase: '专业方向',
    label: '专业方向',
    detailTitle: '先筛掉明显不适合的专业',
    detail: '结合兴趣、学科优势、选科要求和就业趋势，先缩小讨论范围。',
    chips: ['兴趣', '优势', '选科'],
    accent: '#0a7e65',
  },
  {
    phrase: '院校城市',
    label: '院校与城市',
    detailTitle: '学校、专业、城市一起看',
    detail: '提前比较本省外省、城市机会、生活成本和家庭可接受范围。',
    chips: ['城市机会', '家庭成本'],
    accent: '#3366a8',
  },
  {
    phrase: '志愿风险',
    label: '志愿风险',
    detailTitle: '别只看学校名字',
    detail: '提前关注专业组、调剂范围、选科限制、体检要求和单科要求。',
    chips: ['专业组', '调剂', '体检'],
    accent: '#0b7e91',
  },
  {
    phrase: '一次理清',
    label: '形成预案',
    detailTitle: '先做一版家庭讨论稿',
    detail: '把备选院校、专业方向、城市偏好和待确认问题先列出来。',
    chips: ['备选范围', '问题清单'],
    accent: '#47684b',
  },
  {
    phrase: '出分之后',
    label: '下一阶段',
    detailTitle: '拿到分数后再更新',
    detail: '分数和位次明确后，再结合实际数据调整院校和专业范围。',
    chips: ['分数', '位次', '更新'],
    accent: '#8b6b18',
  },
  {
    phrase: '再看位次',
    label: '分数位次',
    detailTitle: '出分后重点看位次',
    detail: '同一分数在不同年份含义不同，出分后要结合位次和省控线判断。',
    chips: ['位次', '省控线'],
    accent: '#c75f3b',
  },
  {
    phrase: '定冲稳保',
    label: '正式方案',
    detailTitle: '用位次做冲稳保参考',
    detail: '根据分数位次、招生计划和专业要求，再排列冲刺、稳妥、保底。',
    chips: ['冲刺', '稳妥', '保底'],
    accent: '#d88923',
  },
  {
    phrase: '心里不慌',
    label: '点击进入小程序',
    detailTitle: '现在先做一次志愿预案',
    detail: '用涨识先理清方向和问题，出分后再更新最终参考方案。',
    chips: ['先做准备', '出分更新'],
    accent: '#007f83',
  },
];

function tileHtml(tile, index) {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const bgX = -col * 1080;
  const bgY = -row * 1080;
  const phraseSize = 176;
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1080px; height: 1080px; overflow: hidden; }
    body {
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif;
      color: #0c211d;
      letter-spacing: 0;
    }
    .canvas {
      position: relative;
      width: 1080px;
      height: 1080px;
      overflow: hidden;
      background: #eaf0df;
    }
    .world {
      position: absolute;
      left: ${bgX}px;
      top: ${bgY}px;
      width: 3240px;
      height: 3240px;
      background:
        radial-gradient(circle at 16% 12%, rgba(255, 222, 133, .36), transparent 20%),
        radial-gradient(circle at 83% 8%, rgba(0, 133, 136, .22), transparent 18%),
        linear-gradient(90deg, rgba(248, 242, 214, .95) 0%, rgba(226, 236, 218, .88) 52%, rgba(8, 55, 50, .42) 100%),
        url("${bgData}") center center / 3240px 4320px no-repeat;
    }
    .world::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(180deg, rgba(255,255,255,.1), rgba(255,255,255,0) 42%, rgba(7,23,20,.22) 100%);
    }
    .canvas::after {
      content: "";
      position: absolute;
      inset: 0;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.12);
      pointer-events: none;
    }
    .ring {
      position: absolute;
      right: -135px;
      top: -130px;
      width: 420px;
      height: 420px;
      border-radius: 50%;
      border: 42px solid rgba(0, 133, 136, .14);
    }
    .content {
      position: relative;
      z-index: 2;
      height: 100%;
      padding: 74px 72px 64px;
      display: flex;
      flex-direction: column;
    }
    .phrase-wrap {
      position: relative;
      margin-top: 286px;
      width: 100%;
      text-align: center;
    }
    .phrase {
      margin: 0;
      font-size: ${phraseSize}px;
      line-height: 1.02;
      font-weight: 980;
      letter-spacing: 0;
      color: #071714;
      text-shadow: 0 3px 0 rgba(255,255,255,.34), 0 16px 34px rgba(16,35,31,.08);
    }
    .rule {
      width: 440px;
      height: 16px;
      margin-top: 34px;
      margin-left: auto;
      margin-right: auto;
      border-radius: 999px;
      background: linear-gradient(90deg, #f09e42, #f7d66a);
      box-shadow: 0 8px 18px rgba(223, 133, 31, .22);
    }
    .detail {
      margin-top: auto;
      width: 890px;
      padding-top: 0;
    }
    .detail-title {
      color: ${tile.accent};
      font-size: 21px;
      line-height: 1.24;
      font-weight: 880;
      opacity: .78;
    }
    .detail-body {
      margin-top: 6px;
      color: #20352f;
      font-size: 17px;
      line-height: 1.32;
      font-weight: 680;
      max-width: 850px;
      opacity: .72;
    }
    .chips {
      display: none;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      height: 34px;
      padding: 0 14px;
      border-radius: 999px;
      color: ${tile.accent};
      background: rgba(255,255,255,.72);
      border: 1px solid rgba(0, 127, 131, .12);
      font-size: 17px;
      font-weight: 880;
    }
    .cta {
      margin-top: 7px;
      color: rgba(16,35,31,.66);
      font-size: 13px;
      line-height: 1.35;
      font-weight: 760;
      opacity: .55;
    }
  </style>
</head>
<body>
  <section class="canvas">
    <div class="world"></div>
    <div class="ring"></div>
    <div class="content">
      <div class="phrase-wrap">
        <h1 class="phrase">${esc(tile.phrase)}</h1>
      </div>
      <div class="rule"></div>
      <div class="detail">
        <div class="detail-title">${esc(tile.detailTitle)}</div>
        <div class="detail-body">${esc(tile.detail)}</div>
        <div class="chips">${tile.chips.map((chip) => `<span class="chip">${esc(chip)}</span>`).join('')}</div>
        <div class="cta">涨识 AI 高考志愿分析｜点击进入小程序，先做志愿预案</div>
      </div>
    </div>
  </section>
</body>
</html>`;
}

function previewHtml(imageFiles) {
  const imgs = imageFiles.map((file) => dataUri(file));
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 3240px; height: 3240px; background: #e6ece5; }
    .grid {
      width: 3240px;
      height: 3240px;
      display: grid;
      grid-template-columns: repeat(3, 1080px);
      grid-template-rows: repeat(3, 1080px);
    }
    img { display: block; width: 1080px; height: 1080px; object-fit: cover; }
  </style>
</head>
<body>
  <main class="grid">${imgs.map((src) => `<img src="${src}" alt="">`).join('')}</main>
</body>
</html>`;
}

async function renderTile(browser, tile, index) {
  const html = tileHtml(tile, index);
  const baseName = `${String(index + 1).padStart(2, '0')}_${tile.phrase.replace(/[，、。\s]/g, '')}`;
  const htmlPath = path.join(HTML_DIR, `${baseName}.html`);
  const outPath = path.join(IMAGE_DIR, `${baseName}.jpg`);
  fs.writeFileSync(htmlPath, html);

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 84, clip: { x: 0, y: 0, width: 1080, height: 1080 } });
  await page.close();
  return outPath;
}

async function renderPreview(browser, imageFiles) {
  const html = previewHtml(imageFiles);
  const htmlPath = path.join(HTML_DIR, '00_九宫格整体预览.html');
  const outPath = path.join(IMAGE_DIR, '00_九宫格整体预览.jpg');
  fs.writeFileSync(htmlPath, html);

  const page = await browser.newPage();
  await page.setViewport({ width: 3240, height: 3240, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 3240, height: 3240 } });
  await page.close();
  return outPath;
}

function updateReadme(imageFiles, previewFile) {
  const videoPath = 'mkt/pre-score-creatives/video/出分前先做志愿预案_15s_standard.mp4';
  const rows = [
    '# 出分前阶段广告创意素材',
    '',
    '定位：分数出来之前，引导高三家长先做志愿方向准备，而不是直接填报最终方案。',
    '',
    '## 九宫格整体句',
    '',
    '出分之前 专业方向 院校城市 志愿风险 一次理清 出分之后 再看位次 定冲稳保 心里不慌',
    '',
    '## 图片上传顺序',
    '',
    ...imageFiles.map((file, index) => `${index + 1}. ${path.relative(ROOT, file)}`),
    '',
    `九宫格整体预览：${path.relative(ROOT, previewFile)}`,
    '',
    '## 视频',
    '',
    videoPath,
    '',
    '## 平台文案',
    '',
    '```text',
    '出分前，先把志愿方向理清',
    '分数未出，志愿准备先开始',
    '先做专业院校初筛，出分不慌',
    '```',
    '',
    '## 使用提醒',
    '',
    '- 按 01-09 顺序上传，预览时会组成一句完整话。',
    '- 点开单张图时，每张都有不同的准备动作和解释。',
    '- 广告平台可直接点击进入小程序，素材里没有放二维码。',
    '- 文案避免承诺录取，定位为信息整理和初筛参考。',
  ];
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), rows.join('\n'));
}

async function main() {
  [OUT_DIR, IMAGE_DIR, HTML_DIR].forEach(ensureDir);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--lang=zh-CN'],
  });

  try {
    const imageFiles = [];
    for (let i = 0; i < tiles.length; i += 1) {
      imageFiles.push(await renderTile(browser, tiles[i], i));
    }
    const previewFile = await renderPreview(browser, imageFiles);
    updateReadme(imageFiles, previewFile);
    console.log(JSON.stringify({
      images: imageFiles.map((file) => path.relative(ROOT, file)),
      preview: path.relative(ROOT, previewFile),
      readme: path.relative(ROOT, path.join(OUT_DIR, 'README.md')),
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
