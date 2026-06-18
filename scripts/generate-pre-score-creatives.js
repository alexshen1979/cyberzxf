const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'mkt/pre-score-creatives');
const IMAGE_DIR = path.join(OUT_DIR, 'images/9grid');
const VIDEO_DIR = path.join(OUT_DIR, 'video');
const HTML_DIR = path.join(OUT_DIR, 'editable-html');

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

const cards = [
  {
    title: '分数出来前\n先做一次志愿预案',
    eyebrow: '出分前阶段',
    body: '先把专业方向、院校层次、城市选择和风险点理清，等出分后再快速更新。',
    chips: ['专业初筛', '院校层次', '风险提醒'],
    accent: '#078984',
  },
  {
    title: '填志愿\n不是出分后才开始',
    eyebrow: '为什么要提前准备',
    body: '出分后时间紧、信息多、选择难。提前准备，能少一点临时慌乱。',
    chips: ['少走弯路', '提前比较', '减少焦虑'],
    accent: '#d88923',
  },
  {
    title: '先把专业方向\n筛一轮',
    eyebrow: '第一步',
    body: '结合兴趣、学科优势、就业趋势和选科要求，先排除明显不适合的方向。',
    chips: ['兴趣偏好', '学科优势', '就业趋势'],
    accent: '#0a7e65',
  },
  {
    title: '先看院校层次\n和城市选择',
    eyebrow: '第二步',
    body: '本省还是外省？大城市还是省会？学校、专业和城市要放在一起看。',
    chips: ['院校层次', '城市机会', '家庭成本'],
    accent: '#3366a8',
  },
  {
    title: '先列一张\n志愿风险清单',
    eyebrow: '第三步',
    body: '提前关注专业组、调剂范围、选科限制、体检要求，别只看学校名字。',
    chips: ['专业组', '调剂范围', '选科限制'],
    accent: '#0b7e91',
  },
  {
    title: '把孩子的偏好\n先问清楚',
    eyebrow: '家长可以先做',
    body: '喜欢什么、排斥什么、能接受哪些城市，这些问题比出分更早就能讨论。',
    chips: ['专业偏好', '城市偏好', '底线条件'],
    accent: '#8b6b18',
  },
  {
    title: '不知道怎么问\n就用 AI 追问',
    eyebrow: '涨识能帮你',
    body: '围绕专业、院校、城市、就业和风险连续追问，把模糊问题拆清楚。',
    chips: ['AI追问', '知识库', '预案讨论'],
    accent: '#47684b',
  },
  {
    title: '出分后\n再更新冲稳保',
    eyebrow: '下一阶段',
    body: '等分数和位次明确后，再结合实际数据生成冲刺、稳妥、保底参考。',
    chips: ['分数位次', '冲稳保', '方案更新'],
    accent: '#c75f3b',
  },
  {
    title: '现在先准备\n出分后不慌',
    eyebrow: '点击进入小程序',
    body: '先做一次志愿预案，把方向和问题列出来，等出分后再定最终方案。',
    chips: ['先做准备', '出分更新', '家长可用'],
    accent: '#007f83',
  },
];

function cardHtml(card, index) {
  const number = String(index + 1).padStart(2, '0');
  const titleHtml = esc(card.title).replace(/\n/g, '<br>');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 1080px; height: 1080px; overflow: hidden; }
    body {
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif;
      color: #10231f;
      letter-spacing: 0;
    }
    .canvas {
      position: relative;
      width: 1080px;
      height: 1080px;
      padding: 70px;
      overflow: hidden;
      background:
        linear-gradient(90deg, rgba(245, 239, 214, .94) 0%, rgba(226, 234, 213, .86) 45%, rgba(12, 58, 54, .38) 100%),
        url("${bgData}") center center / cover no-repeat;
    }
    .canvas::after {
      content: "";
      position: absolute;
      inset: 0;
      background:
        radial-gradient(circle at 8% 18%, rgba(255, 220, 132, .38), transparent 24%),
        linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.18) 100%);
      pointer-events: none;
    }
    .halo {
      position: absolute;
      right: -130px;
      top: -120px;
      width: 430px;
      height: 430px;
      border-radius: 50%;
      border: 44px solid rgba(0, 133, 136, .2);
    }
    .content { position: relative; z-index: 2; height: 100%; }
    .topbar { display: flex; align-items: center; gap: 18px; }
    .logo {
      width: 74px;
      height: 74px;
      border-radius: 18px;
      background: #fff;
      padding: 9px;
      box-shadow: 0 14px 34px rgba(16, 35, 31, .16);
    }
    .brand { font-size: 34px; font-weight: 950; line-height: 1; }
    .brand-sub { margin-top: 8px; font-size: 20px; font-weight: 700; color: rgba(16, 35, 31, .68); }
    .count {
      margin-left: auto;
      min-width: 94px;
      height: 48px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: ${card.accent};
      font-size: 24px;
      font-weight: 900;
      box-shadow: 0 10px 24px rgba(0,0,0,.12);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      margin-top: 72px;
      height: 52px;
      padding: 0 24px;
      border-radius: 999px;
      background: rgba(255,255,255,.9);
      color: ${card.accent};
      border: 2px solid rgba(0, 127, 131, .22);
      font-size: 24px;
      font-weight: 900;
    }
    h1 {
      margin: 28px 0 0;
      max-width: 790px;
      font-size: 76px;
      line-height: 1.12;
      font-weight: 950;
      letter-spacing: 0;
      color: #071714;
    }
    .rule {
      width: 370px;
      height: 14px;
      margin-top: 30px;
      border-radius: 999px;
      background: linear-gradient(90deg, #f09e42, #f7d66a);
      box-shadow: 0 8px 22px rgba(223, 133, 31, .25);
    }
    .body {
      margin-top: 34px;
      max-width: 760px;
      color: #1e3a35;
      font-size: 33px;
      line-height: 1.45;
      font-weight: 780;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      position: absolute;
      left: 0;
      bottom: 134px;
      max-width: 850px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      height: 52px;
      padding: 0 22px;
      border-radius: 999px;
      background: rgba(255,255,255,.92);
      color: ${card.accent};
      border: 2px solid rgba(0, 127, 131, .18);
      font-size: 24px;
      font-weight: 900;
      box-shadow: 0 12px 24px rgba(16,35,31,.08);
    }
    .chip::before {
      content: "";
      width: 10px;
      height: 10px;
      margin-right: 12px;
      border-radius: 50%;
      background: ${card.accent};
    }
    .cta {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 82px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: ${card.accent};
      font-size: 31px;
      font-weight: 920;
      box-shadow: 0 16px 32px rgba(0, 94, 92, .24);
    }
    .note {
      position: absolute;
      right: 0;
      bottom: 100px;
      width: 292px;
      padding: 18px 20px;
      border-radius: 8px;
      background: rgba(255,255,255,.76);
      color: rgba(16,35,31,.68);
      font-size: 18px;
      line-height: 1.45;
      font-weight: 680;
      text-align: right;
      backdrop-filter: blur(8px);
    }
  </style>
</head>
<body>
  <section class="canvas">
    <div class="halo"></div>
    <div class="content">
      <div class="topbar">
        <img class="logo" src="${logoData}" alt="">
        <div>
          <div class="brand">涨识</div>
          <div class="brand-sub">AI 高考志愿分析</div>
        </div>
        <div class="count">${number}/09</div>
      </div>
      <div class="eyebrow">${esc(card.eyebrow)}</div>
      <h1>${titleHtml}</h1>
      <div class="rule"></div>
      <div class="body">${esc(card.body)}</div>
      <div class="chips">${card.chips.map((chip) => `<span class="chip">${esc(chip)}</span>`).join('')}</div>
      <div class="note">报告用于信息整理和初筛参考，最终以考试院与高校招生章程为准。</div>
      <div class="cta">点击进入小程序，先做志愿预案</div>
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

async function renderCard(browser, card, index) {
  const html = cardHtml(card, index);
  const htmlPath = path.join(HTML_DIR, `pre_score_9grid_${String(index + 1).padStart(2, '0')}.html`);
  const jpgPath = path.join(IMAGE_DIR, `${String(index + 1).padStart(2, '0')}_${card.title.split('\n')[0].replace(/[，、\s]/g, '')}.jpg`);
  fs.writeFileSync(htmlPath, html);

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: 1080, height: 1080 } });
  await page.close();
  return jpgPath;
}

async function renderPreview(browser, imageFiles) {
  const html = previewHtml(imageFiles);
  const htmlPath = path.join(HTML_DIR, 'pre_score_9grid_preview.html');
  const jpgPath = path.join(IMAGE_DIR, '00_九宫格预览.jpg');
  fs.writeFileSync(htmlPath, html);

  const page = await browser.newPage();
  await page.setViewport({ width: 3240, height: 3240, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 78, clip: { x: 0, y: 0, width: 3240, height: 3240 } });
  await page.close();
  return jpgPath;
}

function writeReadme(imageFiles, previewFile, videoFile) {
  const rows = [
    '# 出分前阶段广告创意素材',
    '',
    '定位：分数出来之前，引导高三家长先做志愿方向准备，而不是直接填报最终方案。',
    '',
    '## 图片上传顺序',
    '',
    ...imageFiles.map((file, index) => `${index + 1}. ${path.relative(ROOT, file)}`),
    '',
    `九宫格预览：${path.relative(ROOT, previewFile)}`,
    '',
    '## 视频',
    '',
    `${path.relative(ROOT, videoFile)}`,
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
    '- 广告平台可直接点击进入小程序，素材里没有放二维码。',
    '- 图片按 01-09 顺序上传，形成九宫格叙事；单张投放也能独立看懂。',
    '- 文案避免承诺录取，定位为信息整理和初筛参考。',
  ];
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), rows.join('\n'));
}

async function renderVideo(browser) {
  const videoFile = path.join(VIDEO_DIR, '出分前先做志愿预案_15s.mp4');
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.setContent('<!doctype html><html><body style="margin:0;background:#fff"></body></html>');

  const bytes = await page.evaluate(async ({ bgData, logoData }) => {
    const slides = [
      { eyebrow: '出分前阶段', title: '分数出来前', sub: '先做一次志愿预案', chips: ['专业方向', '院校层次', '风险提醒'], accent: '#078984' },
      { eyebrow: '为什么现在准备', title: '填志愿', sub: '不是出分后才开始', chips: ['时间紧', '信息多', '选择难'], accent: '#d88923' },
      { eyebrow: '先做第一步', title: '专业方向', sub: '提前筛一轮', chips: ['兴趣', '优势', '就业'], accent: '#0a7e65' },
      { eyebrow: '先看第二步', title: '院校城市', sub: '提前列范围', chips: ['本省外省', '学校层次', '家庭成本'], accent: '#3366a8' },
      { eyebrow: '先列第三步', title: '风险清单', sub: '提前看清楚', chips: ['专业组', '调剂', '选科'], accent: '#0b7e91' },
      { eyebrow: '点击进入涨识', title: '现在先准备', sub: '出分后不慌', chips: ['AI追问', '知识库', '出分更新'], accent: '#007f83' },
    ];

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const bg = new Image();
    bg.src = bgData;
    const logo = new Image();
    logo.src = logoData;
    await Promise.all([bg.decode(), logo.decode(), document.fonts.ready]);

    function coverImage(img, dx, dy, dw, dh) {
      const scale = Math.max(dw / img.naturalWidth, dh / img.naturalHeight);
      const sw = dw / scale;
      const sh = dh / scale;
      const sx = (img.naturalWidth - sw) / 2;
      const sy = (img.naturalHeight - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawPill(text, x, y, color, fill = 'rgba(255,255,255,.92)') {
      ctx.font = '900 30px "PingFang SC", "Microsoft YaHei", sans-serif';
      const w = ctx.measureText(text).width + 56;
      roundRect(x, y, w, 64, 32);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 127, 131, .2)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillText(text, x + 28, y + 42);
      return w;
    }

    function drawTextLines(text, x, y, maxWidth, font, lineHeight) {
      ctx.font = font;
      const chars = [...text];
      let line = '';
      for (const ch of chars) {
        const next = line + ch;
        if (ctx.measureText(next).width > maxWidth && line) {
          ctx.fillText(line, x, y);
          y += lineHeight;
          line = ch;
        } else {
          line = next;
        }
      }
      if (line) ctx.fillText(line, x, y);
      return y + lineHeight;
    }

    function drawFrame(slideIndex, progress) {
      const slide = slides[slideIndex];
      ctx.clearRect(0, 0, 1080, 1920);
      coverImage(bg, 0, 0, 1080, 1920);

      const grd = ctx.createLinearGradient(0, 0, 1080, 0);
      grd.addColorStop(0, 'rgba(245, 239, 214, .94)');
      grd.addColorStop(.58, 'rgba(229, 238, 220, .86)');
      grd.addColorStop(1, 'rgba(6, 44, 42, .45)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 1080, 1920);

      ctx.globalAlpha = .22;
      ctx.strokeStyle = '#008588';
      ctx.lineWidth = 54;
      ctx.beginPath();
      ctx.arc(930, 150, 220 + progress * 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.drawImage(logo, 72, 78, 78, 78);
      ctx.fillStyle = '#10231f';
      ctx.font = '950 38px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('涨识', 170, 113);
      ctx.fillStyle = 'rgba(16,35,31,.68)';
      ctx.font = '700 24px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('AI 高考志愿分析', 170, 151);

      const ease = 1 - Math.pow(1 - progress, 3);
      const yOffset = (1 - ease) * 42;
      drawPill(slide.eyebrow, 72, 300 + yOffset, slide.accent);

      ctx.fillStyle = '#071714';
      drawTextLines(slide.title, 72, 620 + yOffset, 900, '950 104px "PingFang SC", "Microsoft YaHei", sans-serif', 122);
      ctx.fillStyle = slide.accent;
      drawTextLines(slide.sub, 72, 760 + yOffset, 900, '950 92px "PingFang SC", "Microsoft YaHei", sans-serif', 108);

      const rule = ctx.createLinearGradient(72, 910, 485, 910);
      rule.addColorStop(0, '#f09e42');
      rule.addColorStop(1, '#f7d66a');
      ctx.fillStyle = rule;
      roundRect(72, 938 + yOffset, 415, 16, 8);
      ctx.fill();

      let chipX = 72;
      slide.chips.forEach((chip) => {
        const w = drawPill(chip, chipX, 1028 + yOffset, slide.accent);
        chipX += w + 18;
      });

      ctx.fillStyle = 'rgba(255,255,255,.84)';
      roundRect(72, 1430, 936, 272, 12);
      ctx.fill();
      ctx.fillStyle = slide.accent;
      ctx.font = '920 44px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('点击进入小程序', 126, 1520);
      ctx.fillStyle = '#10231f';
      ctx.font = '900 52px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('先做志愿预案', 126, 1590);
      ctx.fillStyle = 'rgba(16,35,31,.62)';
      ctx.font = '650 26px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('出分前先理清方向，出分后再更新冲稳保。', 126, 1648);

      ctx.fillStyle = 'rgba(255,255,255,.5)';
      roundRect(72, 1802, 936, 14, 7);
      ctx.fill();
      ctx.fillStyle = slide.accent;
      roundRect(72, 1802, 936 * ((slideIndex + progress) / slides.length), 14, 7);
      ctx.fill();
    }

    const mime = MediaRecorder.isTypeSupported('video/mp4;codecs="avc1.42E01E"')
      ? 'video/mp4;codecs="avc1.42E01E"'
      : (MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm;codecs=vp9');
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4200000 });
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size) chunks.push(event.data);
    };
    const done = new Promise((resolve) => {
      recorder.onstop = resolve;
    });

    const slideMs = 2500;
    const totalMs = slideMs * slides.length;
    const startedAt = performance.now();
    recorder.start(100);
    while (performance.now() - startedAt < totalMs) {
      const elapsed = performance.now() - startedAt;
      const slideIndex = Math.min(slides.length - 1, Math.floor(elapsed / slideMs));
      const progress = (elapsed % slideMs) / slideMs;
      drawFrame(slideIndex, progress);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    drawFrame(slides.length - 1, 1);
    recorder.stop();
    await done;

    const blob = new Blob(chunks, { type: mime });
    const buffer = await blob.arrayBuffer();
    return Array.from(new Uint8Array(buffer));
  }, { bgData, logoData });

  fs.writeFileSync(videoFile, Buffer.from(bytes));
  await page.close();
  return videoFile;
}

async function main() {
  [OUT_DIR, IMAGE_DIR, VIDEO_DIR, HTML_DIR].forEach(ensureDir);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--lang=zh-CN'],
  });

  try {
    const imageFiles = [];
    for (let i = 0; i < cards.length; i += 1) {
      imageFiles.push(await renderCard(browser, cards[i], i));
    }
    const previewFile = await renderPreview(browser, imageFiles);
    const videoFile = await renderVideo(browser);
    writeReadme(imageFiles, previewFile, videoFile);
    console.log(JSON.stringify({
      images: imageFiles.map((file) => path.relative(ROOT, file)),
      preview: path.relative(ROOT, previewFile),
      video: path.relative(ROOT, videoFile),
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
