const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const XLSX = require('../backend/node_modules/xlsx');

const ROOT = path.resolve(__dirname, '..');
const MKT_DIR = path.join(ROOT, 'mkt');
const OUT_DIR = path.join(MKT_DIR, 'materials');
const HTML_DIR = path.join(OUT_DIR, 'editable-html');
const LOGO_PATH = path.join(ROOT, 'backend/src/assets/brand-logo.png');
const MANIFEST = [];

const logoData = `data:image/png;base64,${fs.readFileSync(LOGO_PATH).toString('base64')}`;

const colors = {
  ink: '#18231f',
  moss: '#234236',
  green: '#2f6f58',
  mint: '#d9efe3',
  coral: '#e36f4b',
  amber: '#f0b84d',
  blue: '#3c78d8',
  cream: '#f7f4ec',
  paper: '#fffdf7',
  line: '#d9dfd6',
};

const campaigns = [
  {
    id: '01_operator_partner',
    folder: '运营方招募合伙人',
    owner: '运营方',
    target: '合伙人',
    label: '合伙人计划',
    hero: '招募高考志愿服务合伙人',
    subtitle: '你有本地家长资源，我们提供产品、素材、培训和后台追踪',
    cta: '私信“合伙人”领取合作资料',
    qrLabel: '预约合作说明会',
    accent: colors.coral,
    secondary: colors.green,
    audience: ['教培机构老板', '升学规划师', '志愿填报老师', '本地教育/亲子博主', '高中周边门店'],
    value: ['AI志愿分析小程序已上线', '报告、海报、话术统一提供', '后台记录扫码、注册、充值数据', '适合城市/圈层合作'],
    avoid: '不讲“一级分销、下级、躺赚”，统一讲“合伙人/合作权益”。',
    moments: [
      '今年高考志愿填报需求很集中，我们开放少量城市/圈层合伙人。适合有高三家长资源、教育行业资源或本地内容影响力的人。平台提供AI志愿分析小程序、报告、素材、培训和后台追踪。感兴趣可以私信我“合伙人”。',
      '很多家长不是缺信息，而是缺一个能把信息先整理清楚的工具。涨识AI志愿分析可以先帮家庭生成冲稳保和风险提示报告。现在招募本地合作伙伴，如果你有家长资源或教育资源，可以一起聊聊。',
      '高考季马上进入志愿填报关键期。我们准备招募一批靠谱的本地教育合伙人，提供产品、素材、培训、后台和服务流程。你负责本地资源触达，我们一起把高考家庭服务做扎实。'
    ],
    socialTitle: '高考志愿AI工具开放区域/圈层合作',
    socialBody: '高考志愿填报不是出分后才开始。家长真正焦虑的是：分数能去哪、专业怎么避坑、冲稳保怎么排。涨识用AI先帮家庭做一版清晰报告，再结合官方信息核对。现在招募本地教育合伙人，适合教培机构、升学规划师、本地教育达人和有家长资源的人。',
    dm: '我看你这边有不少家长/教育资源。今年我们在做一个AI高考志愿分析小程序，准备招募少量本地合伙人。不是让你自己做复杂咨询，主要是用工具帮家长先做初筛和报告。我发你一份合作介绍，你看看适不适合聊10分钟？',
    cards: [
      ['高考志愿服务需求集中', ['家长怕滑档、怕专业踩坑', '出分后决策时间短', '本地信任资源很重要']],
      ['我们提供完整工具链', ['AI志愿分析小程序', '冲稳保报告与风险提示', '后台数据追踪']],
      ['合伙人负责什么', ['触达本地家长资源', '组织推荐官团队', '跟进体验和反馈']],
      ['谁最适合加入', ['教培机构/升学老师', '本地教育达人', '高中周边门店/社区资源']],
      ['平台支持什么', ['海报、话术、短视频脚本', '培训和复盘SOP', '合作数据可追踪']],
      ['现在预约沟通', ['适合先做2个城市试点', '小规模跑通再复制', '私信“合伙人”']]
    ],
    videoSlides: [
      ['高考志愿服务', '正在寻找靠谱合伙人'],
      ['家长最焦虑', '信息乱、时间紧、怕滑档'],
      ['涨识提供', '小程序、报告、素材、后台'],
      ['你负责', '本地资源触达与团队组织'],
      ['适合人群', '教培、升学老师、本地达人'],
      ['加入方式', '私信“合伙人”领取资料']
    ],
  },
  {
    id: '02_partner_referrer',
    folder: '合伙人招募推荐官',
    owner: '合伙人',
    target: '推荐官',
    label: '推荐官招募',
    hero: '招募本地高考志愿推荐官',
    subtitle: '不要求专业背景，有高三家长资源即可参与',
    cta: '私信“推荐官”加入说明群',
    qrLabel: '加入推荐官说明群',
    accent: colors.amber,
    secondary: colors.blue,
    audience: ['家长群主', '往届高三家长', '教培老师/课程顾问', '社区团长', '大学生/准大学生'],
    value: ['推荐工具，不替家长做最终决定', '统一海报、话术、培训支持', '复杂问题交给平台和资料', '每日数据复盘，降低试错成本'],
    avoid: '不讲“发展下级”，统一讲“组建本地高考服务推荐队伍”。',
    moments: [
      '身边有高三家长资源的朋友，可以一起做一件有价值的事。我们在招募本地高考志愿推荐官，不要求你会做专业咨询，平台提供AI志愿分析小程序、统一海报、话术和后台记录。你只需要把工具推荐给需要的家庭，帮助他们先理清方向。想了解的私信我“推荐官”。',
      '今年高考志愿填报，很多家长需要先把方向理清。如果你身边有高三家庭，可以加入本地推荐官计划。平台提供工具和素材，你负责把入口推荐给有需要的人。',
      '推荐官不是替家长填志愿，而是帮他们先用工具做一次初筛：看冲稳保、看专业组、看风险点。身边有高三家长的朋友可以私信我了解。'
    ],
    socialTitle: '普通人如何参与高考志愿服务',
    socialBody: '高考志愿填报的信息太多，很多家长需要一个低门槛工具先把方向理清。推荐官的工作不是替家长决定志愿，而是把AI分析工具推荐给有需要的人，让他们先生成一份报告，再结合官方招生章程和专业建议核对。',
    dm: '你身边是不是有一些高三家长？我们现在在招募本地高考志愿推荐官，不需要你做专业咨询，主要是把AI志愿分析工具推荐给有需要的家庭。平台会给海报、话术和培训。你要不要进说明群了解一下？',
    cards: [
      ['身边有高三家长？', ['你就可以成为推荐官', '不用做复杂咨询', '只负责推荐工具入口']],
      ['推荐官做什么', ['发海报、转介绍、私聊提醒', '引导家长生成报告', '反馈真实问题']],
      ['平台给什么', ['统一素材包', '三句话术模板', '群内培训和复盘']],
      ['适合这些人', ['家长群主/社区群主', '往届高三家长', '教培老师/大学生']],
      ['推荐边界要清楚', ['报告用于初筛参考', '最终以考试院和招生章程为准', '复杂问题交给平台']],
      ['加入推荐官群', ['每天10分钟即可启动', '先从熟人资源开始', '私信“推荐官”']]
    ],
    videoSlides: [
      ['身边有高三家长？', '你可以成为推荐官'],
      ['不要求专业背景', '推荐工具，不替人做决定'],
      ['平台提供', '海报、话术、培训、后台记录'],
      ['你只需要', '发入口、做提醒、收反馈'],
      ['适合人群', '群主、老师、往届家长、大学生'],
      ['加入方式', '私信“推荐官”进说明群']
    ],
  },
  {
    id: '03_referrer_user',
    folder: '推荐官转化普通用户',
    owner: '推荐官',
    target: '普通用户',
    label: '家长体验入口',
    hero: '高考志愿先做一次AI分析',
    subtitle: '输入省份、科类、分数，先看冲稳保和风险点',
    cta: '扫码生成你的AI志愿分析报告',
    qrLabel: '小程序码占位',
    accent: colors.green,
    secondary: colors.coral,
    audience: ['高三学生家长', '刚出分的考生', '准备提前研究志愿的家庭', '不确定专业方向的家庭'],
    value: ['先看分数位次定位', '先看冲刺/稳妥/保底参考', '先看专业组和退档风险', '低成本初筛，再做人工核对'],
    avoid: '不承诺录取，不说内部数据，不制造焦虑。',
    moments: [
      '天津600分，志愿到底怎么排冲稳保？我刚用涨识AI志愿分析测了一版，报告里会把院校分成冲刺、稳妥、保底，还会提示专业组和风险点。家里有高三孩子的，可以先扫码测一下，至少先有个讨论方向。',
      '高考结束不是最轻松的时候，志愿填报才是真正考验家长信息整理能力的时候。别只听别人说，也别只看学校名气，先把孩子的分数、位次、专业偏好整理成一份报告，再做决定。需要入口可以找我。',
      '群里有高三家长的话，可以先用这个小程序测一下志愿方向。输入省份、科类、分数，会生成一份AI志愿分析报告，主要看冲稳保和风险提示。仅供参考，最终一定以考试院和学校招生章程为准。'
    ],
    socialTitle: '高考志愿填报前，家长先做这5件事',
    socialBody: '1看位次不只看分数；2看专业组和选科；3冲稳保别失衡；4热门专业别盲冲；5最终核对招生章程。可以先用涨识AI志愿分析生成一份参考报告，把方向和风险点整理清楚。',
    dm: '你家孩子今年是不是要填志愿？我这边有个AI志愿分析工具，可以先根据省份、科类、分数生成一版参考报告。不是替你做最终决定，主要是先把方向理清。如果你愿意，我把入口发你。',
    cards: [
      ['出分后别只问能上哪', ['先看位次和专业组', '再排冲稳保', '别只盯学校名气']],
      ['几分钟生成报告', ['输入省份、科类、分数', '填写城市和专业偏好', '生成结构化参考']],
      ['报告重点看什么', ['冲刺/稳妥/保底建议', '专业组和选科要求', '退档与调剂风险']],
      ['适合这些家庭', ['没时间系统研究', '不知道从哪开始筛', '想先低成本初筛']],
      ['使用边界', ['AI报告用于参考', '最终以考试院和招生章程为准', '重要信息逐项核对']],
      ['现在扫码体验', ['先生成一份讨论稿', '再决定是否深度咨询', '少走信息整理弯路']]
    ],
    videoSlides: [
      ['高考志愿', '不要只问“能上哪”'],
      ['先做一次AI分析', '看冲稳保和风险点'],
      ['输入关键信息', '省份、科类、分数、偏好'],
      ['报告会整理', '院校方向、专业组、风险提示'],
      ['重要提醒', '最终以官方招生章程为准'],
      ['现在扫码', '生成你的志愿分析报告']
    ],
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function rel(filePath) {
  return path.relative(MKT_DIR, filePath).replace(/\\/g, '/');
}

function addManifest(type, role, title, filePath, note = '') {
  MANIFEST.push({
    '素材类型': type,
    '适用层级': role,
    '标题': title,
    '文件路径': rel(filePath),
    '备注': note,
  });
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function baseCss(width, height) {
  return `
    * { box-sizing: border-box; }
    html, body { margin: 0; width: ${width}px; min-height: ${height}px; background: #e9eee8; }
    body {
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif;
      color: ${colors.ink};
      letter-spacing: 0;
    }
    .canvas {
      position: relative;
      width: ${width}px;
      min-height: ${height}px;
      overflow: hidden;
      background:
        radial-gradient(circle at 88% 10%, rgba(227,111,75,.14), transparent 22%),
        radial-gradient(circle at 8% 84%, rgba(60,120,216,.14), transparent 22%),
        linear-gradient(135deg, #fffdf7 0%, #f2f7f0 100%);
    }
    .topbar { display: flex; align-items: center; gap: 16px; }
    .logo { width: 72px; height: 72px; border-radius: 18px; background: #fff; padding: 8px; box-shadow: 0 14px 30px rgba(31,48,42,.12); }
    .brand { font-size: 30px; font-weight: 900; color: ${colors.moss}; }
    .brand-sub { margin-top: 4px; font-size: 18px; font-weight: 700; color: #66746a; }
    .pill { display: inline-flex; align-items: center; border: 2px solid rgba(35,66,54,.18); border-radius: 999px; padding: 10px 18px; font-size: 22px; font-weight: 800; color: ${colors.moss}; background: rgba(255,255,255,.62); }
    .title { margin: 0; color: ${colors.ink}; font-weight: 950; line-height: 1.08; letter-spacing: 0; }
    .subtitle { color: #435148; font-weight: 760; line-height: 1.42; }
    .card { background: rgba(255,255,255,.78); border: 1px solid rgba(39,55,46,.12); border-radius: 8px; box-shadow: 0 18px 44px rgba(31,48,42,.10); }
    .points { display: grid; gap: 14px; margin: 0; padding: 0; list-style: none; }
    .points li { position: relative; padding-left: 34px; line-height: 1.38; font-weight: 780; color: #29362f; }
    .points li::before { content: ""; position: absolute; left: 0; top: .48em; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 6px rgba(227,111,75,.12); }
    .cta { display: flex; align-items: center; justify-content: center; min-height: 72px; border-radius: 8px; background: var(--accent); color: #fff; font-weight: 900; text-align: center; }
    .qr { width: 178px; height: 178px; border-radius: 8px; background: #fff; padding: 14px; display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(7, 1fr); gap: 5px; box-shadow: inset 0 0 0 2px rgba(24,35,31,.12); }
    .qr span { border-radius: 3px; background: #d7ddd7; }
    .qr .on { background: ${colors.ink}; }
    .qr-label { margin-top: 12px; font-size: 20px; font-weight: 850; color: #334039; text-align: center; }
    .footnote { color: #6f7a72; font-size: 18px; line-height: 1.45; font-weight: 650; }
    .strip { position: absolute; width: 420px; height: 420px; border-radius: 50%; border: 56px solid rgba(47,111,88,.08); }
  `;
}

function qrBlock(label) {
  const on = new Set([0,1,2,7,9,14,15,16,4,5,6,12,13,20,24,25,27,31,33,35,36,38,40,42,43,44,48]);
  const cells = Array.from({ length: 49 }, (_, i) => `<span class="${on.has(i) ? 'on' : ''}"></span>`).join('');
  return `<div><div class="qr">${cells}</div><div class="qr-label">${esc(label)}</div></div>`;
}

function frameShell(width, height, body, campaign) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" />
  <style>${baseCss(width, height)} :root { --accent: ${campaign.accent}; --secondary: ${campaign.secondary}; }</style>
  </head><body>${body}</body></html>`;
}

function socialCard(campaign, card, index) {
  const [title, points] = card;
  return frameShell(1080, 1080, `
    <section class="canvas" style="padding:64px;">
      <div class="strip" style="right:-210px; top:-170px;"></div>
      <div class="strip" style="left:-250px; bottom:-250px; border-color:rgba(60,120,216,.08);"></div>
      <div class="topbar">
        <img class="logo" src="${logoData}" />
        <div><div class="brand">涨识</div><div class="brand-sub">AI高考志愿分析</div></div>
        <div style="margin-left:auto" class="pill">${esc(campaign.label)}</div>
      </div>
      <div style="margin-top:82px;">
        <div class="pill" style="background:rgba(255,255,255,.72); color:var(--accent); border-color:rgba(227,111,75,.25);">0${index + 1}</div>
        <h1 class="title" style="margin-top:24px; font-size:72px; max-width:820px;">${esc(title)}</h1>
        <div class="subtitle" style="margin-top:28px; font-size:31px; max-width:820px;">${esc(campaign.subtitle)}</div>
      </div>
      <div class="card" style="position:absolute; left:64px; right:64px; bottom:72px; padding:38px 42px;">
        <ul class="points">
          ${points.map(p => `<li style="font-size:32px;">${esc(p)}</li>`).join('')}
        </ul>
      </div>
    </section>
  `, campaign);
}

function poster(campaign) {
  return frameShell(1080, 1440, `
    <section class="canvas" style="padding:58px 64px 54px;">
      <div class="strip" style="right:-190px; top:-200px;"></div>
      <div class="topbar">
        <img class="logo" src="${logoData}" />
        <div><div class="brand">涨识</div><div class="brand-sub">AI高考志愿分析</div></div>
        <div style="margin-left:auto" class="pill">${esc(campaign.owner)} → ${esc(campaign.target)}</div>
      </div>
      <div style="margin-top:68px;">
        <div class="pill" style="color:var(--accent); border-color:rgba(227,111,75,.26);">2026 高考季推广素材</div>
        <h1 class="title" style="margin-top:26px; font-size:78px;">${esc(campaign.hero)}</h1>
        <div class="subtitle" style="margin-top:24px; font-size:32px;">${esc(campaign.subtitle)}</div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:22px; margin-top:46px;">
        <div class="card" style="padding:30px;">
          <div style="font-size:26px; font-weight:930; color:var(--accent); margin-bottom:20px;">适合人群</div>
          <ul class="points">${campaign.audience.map(p => `<li style="font-size:24px;">${esc(p)}</li>`).join('')}</ul>
        </div>
        <div class="card" style="padding:30px;">
          <div style="font-size:26px; font-weight:930; color:var(--accent); margin-bottom:20px;">核心价值</div>
          <ul class="points">${campaign.value.map(p => `<li style="font-size:24px;">${esc(p)}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="card" style="display:flex; align-items:center; gap:34px; margin-top:34px; padding:34px;">
        ${qrBlock(campaign.qrLabel)}
        <div style="flex:1;">
          <div class="cta" style="font-size:34px; padding:0 28px;">${esc(campaign.cta)}</div>
          <div class="footnote" style="margin-top:18px;">${esc(campaign.avoid)}</div>
        </div>
      </div>
    </section>
  `, campaign);
}

function flyer(campaign, mode = 'png') {
  const isPdf = mode === 'pdf';
  const canvasRule = isPdf
    ? `
    @page { size: A4; margin: 0; }
    ${baseCss(1240, 1754)}
    :root { --accent: ${campaign.accent}; --secondary: ${campaign.secondary}; }
    html, body { width: 210mm; height: 297mm; background: #fff; }
    .canvas { width: 210mm; min-height: 297mm; padding: 15mm 14mm; }
    .flyer-bottom { left: 14mm; right: 14mm; bottom: 15mm; }
  `
    : `
    ${baseCss(1240, 1754)}
    :root { --accent: ${campaign.accent}; --secondary: ${campaign.secondary}; }
    html, body { width: 1240px; height: 1754px; background: #fff; }
    .canvas { width: 1240px; min-height: 1754px; padding: 88px 82px; }
    .flyer-bottom { left: 82px; right: 82px; bottom: 88px; }
  `;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" />
  <style>${canvasRule}</style></head><body>
    <section class="canvas">
      <div class="strip" style="right:-160px; top:-180px;"></div>
      <div class="topbar">
        <img class="logo" src="${logoData}" />
        <div><div class="brand">涨识</div><div class="brand-sub">AI高考志愿分析</div></div>
      </div>
      <div style="margin-top:34px;">
        <div class="pill" style="font-size:20px; color:var(--accent);">线下招募单页</div>
        <h1 class="title" style="margin-top:22px; font-size:58px;">${esc(campaign.hero)}</h1>
        <div class="subtitle" style="margin-top:18px; font-size:26px;">${esc(campaign.subtitle)}</div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:30px;">
        <div class="card" style="padding:24px;">
          <div style="font-size:24px; font-weight:930; color:var(--accent); margin-bottom:15px;">适合对象</div>
          <ul class="points">${campaign.audience.map(p => `<li style="font-size:20px;">${esc(p)}</li>`).join('')}</ul>
        </div>
        <div class="card" style="padding:24px;">
          <div style="font-size:24px; font-weight:930; color:var(--accent); margin-bottom:15px;">我们提供</div>
          <ul class="points">${campaign.value.map(p => `<li style="font-size:20px;">${esc(p)}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="card" style="margin-top:24px; padding:24px;">
        <div style="font-size:24px; font-weight:930; color:var(--accent); margin-bottom:15px;">怎么开始</div>
        <ul class="points">
          <li style="font-size:20px;">扫码预约说明会或加入说明群</li>
          <li style="font-size:20px;">领取统一海报、话术和操作指引</li>
          <li style="font-size:20px;">先从熟人/本地资源做小规模测试</li>
        </ul>
      </div>
      <div class="flyer-bottom" style="position:absolute; display:flex; align-items:center; gap:28px;">
        ${qrBlock(campaign.qrLabel)}
        <div style="flex:1;">
          <div class="cta" style="font-size:28px;">${esc(campaign.cta)}</div>
          <div class="footnote" style="margin-top:14px;">${esc(campaign.avoid)}<br/>报告仅供初筛参考，最终以考试院和高校招生章程为准。</div>
        </div>
      </div>
    </section>
  </body></html>`;
}

function storyboardFrame(campaign, slide, index) {
  return frameShell(1080, 1920, `
    <section class="canvas" style="padding:86px 70px;">
      <div class="strip" style="right:-210px; top:-180px;"></div>
      <div class="strip" style="left:-260px; bottom:-260px; border-color:rgba(60,120,216,.08);"></div>
      <div class="topbar">
        <img class="logo" src="${logoData}" />
        <div><div class="brand">涨识</div><div class="brand-sub">AI高考志愿分析</div></div>
      </div>
      <div style="margin-top:270px;">
        <div class="pill" style="font-size:28px; color:var(--accent);">短视频分镜 0${index + 1}</div>
        <h1 class="title" style="margin-top:40px; font-size:94px;">${esc(slide[0])}</h1>
        <div class="subtitle" style="margin-top:34px; font-size:48px;">${esc(slide[1])}</div>
      </div>
      <div class="card" style="position:absolute; left:70px; right:70px; bottom:120px; padding:42px;">
        <div style="font-size:34px; font-weight:930; color:var(--accent);">${esc(campaign.cta)}</div>
        <div class="footnote" style="margin-top:16px; font-size:24px;">画面建议：真人口播 + 小程序录屏 + 报告页局部截图</div>
      </div>
    </section>
  `, campaign);
}

async function renderHtml(browser, html, outPng, width, height, outPdf) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: outPng, type: 'png', clip: { x: 0, y: 0, width, height } });
  if (outPdf) {
    await page.pdf({
      path: outPdf,
      width: '210mm',
      height: '297mm',
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    });
  }
  await page.close();
}

function writeCopyDocs() {
  const copyDir = path.join(OUT_DIR, 'copy');
  ensureDir(copyDir);

  const moments = [
    '# 朋友圈文案库',
    '',
    '使用方式：把“扫码/私信”的位置替换为当前城市、合伙人或推荐官的邀请码。公开发布时避免夸张收益承诺。',
    '',
  ];
  const social = ['# 社交媒体图文库', ''];
  const dm = ['# 私聊与群话术', ''];
  const flyerText = ['# Flyer 与海报文案', ''];
  const video = ['# 短视频脚本库', ''];

  for (const c of campaigns) {
    moments.push(`## ${c.folder}`, '');
    c.moments.forEach((text, idx) => {
      moments.push(`### 文案 ${idx + 1}`, text, '');
    });

    social.push(`## ${c.folder}`, '', `### ${c.socialTitle}`, c.socialBody, '', `建议配图：${c.cards.map((card, i) => `${i + 1}.${card[0]}`).join('；')}`, '');

    dm.push(`## ${c.folder}`, '', '### 私聊开场', c.dm, '', '### 群公告', `${c.hero}：${c.subtitle}。${c.cta}。请注意，所有报告仅供初筛参考，最终以考试院和高校招生章程为准。`, '');

    flyerText.push(`## ${c.folder}`, '', `标题：${c.hero}`, `副标题：${c.subtitle}`, `核心人群：${c.audience.join('、')}`, `核心价值：${c.value.join('、')}`, `行动口令：${c.cta}`, `合规提醒：${c.avoid}`, '');

    video.push(`## ${c.folder}`, '', '### 15秒竖版短视频脚本', '');
    c.videoSlides.forEach((slide, idx) => {
      video.push(`${idx + 1}. 画面：${slide[0]}。字幕：${slide[1]}。`);
    });
    video.push('', '口播建议：', c.videoSlides.map(s => `${s[0]}，${s[1]}。`).join(''), '');
  }

  const files = [
    ['朋友圈文案库.md', moments.join('\n')],
    ['社交媒体图文库.md', social.join('\n')],
    ['私聊与群话术.md', dm.join('\n')],
    ['Flyer与海报文案.md', flyerText.join('\n')],
    ['短视频脚本库.md', video.join('\n')],
  ];
  for (const [name, content] of files) {
    const filePath = path.join(copyDir, name);
    writeFile(filePath, content);
    addManifest('文案', '全层级', name, filePath, 'Markdown，可直接复制编辑');
  }
}

function srtTime(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mm = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(mm).padStart(3, '0')}`;
}

function writeSrt(campaign, outPath) {
  const duration = 2100;
  const lines = [];
  campaign.videoSlides.forEach((slide, idx) => {
    const start = idx * duration;
    const end = start + duration - 100;
    lines.push(String(idx + 1), `${srtTime(start)} --> ${srtTime(end)}`, `${slide[0]}｜${slide[1]}`, '');
  });
  writeFile(outPath, lines.join('\n'));
}

async function renderVideoDraft(browser, campaign, outPath) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.setContent('<!doctype html><html><body style="margin:0;background:#fff"></body></html>');
  const bytes = await page.evaluate(async ({ campaign, logoData, colors }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const logo = new Image();
    logo.src = logoData;
    await logo.decode();
    await document.fonts.ready;

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function wrapText(text, x, y, maxWidth, lineHeight, font) {
      ctx.font = font;
      const chars = [...text];
      let line = '';
      for (const ch of chars) {
        const next = line + ch;
        if (ctx.measureText(next).width > maxWidth && line) {
          ctx.fillText(line, x, y);
          line = ch;
          y += lineHeight;
        } else {
          line = next;
        }
      }
      if (line) ctx.fillText(line, x, y);
      return y + lineHeight;
    }

    function drawSlide(slideIndex, progress) {
      const slide = campaign.videoSlides[slideIndex];
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const g = ctx.createLinearGradient(0, 0, 1080, 1920);
      g.addColorStop(0, '#fffdf7');
      g.addColorStop(1, '#eef7f1');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1080, 1920);

      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = campaign.accent;
      ctx.lineWidth = 72;
      ctx.beginPath(); ctx.arc(900, 120, 230, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#3c78d8';
      ctx.beginPath(); ctx.arc(60, 1760, 260, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.drawImage(logo, 70, 76, 76, 76);
      ctx.fillStyle = colors.moss;
      ctx.font = '900 34px "PingFang SC", sans-serif';
      ctx.fillText('涨识', 164, 108);
      ctx.fillStyle = '#66746a';
      ctx.font = '700 22px "PingFang SC", sans-serif';
      ctx.fillText('AI高考志愿分析', 164, 144);

      ctx.fillStyle = campaign.accent;
      roundRect(70, 285, 286, 60, 30);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '900 28px "PingFang SC", sans-serif';
      ctx.fillText(campaign.label, 102, 326);

      const ease = 1 - Math.pow(1 - progress, 3);
      const offset = (1 - ease) * 34;
      ctx.fillStyle = colors.ink;
      ctx.font = '950 96px "PingFang SC", sans-serif';
      wrapText(slide[0], 70, 690 + offset, 900, 116, '950 96px "PingFang SC", sans-serif');

      ctx.fillStyle = '#435148';
      wrapText(slide[1], 70, 940 + offset, 900, 66, '780 50px "PingFang SC", sans-serif');

      ctx.fillStyle = 'rgba(255,255,255,.78)';
      ctx.strokeStyle = 'rgba(39,55,46,.12)';
      ctx.lineWidth = 2;
      roundRect(70, 1510, 940, 230, 12);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = campaign.accent;
      ctx.font = '900 36px "PingFang SC", sans-serif';
      wrapText(campaign.cta, 112, 1592, 820, 52, '900 36px "PingFang SC", sans-serif');
      ctx.fillStyle = '#6f7a72';
      wrapText('报告用于初筛参考，最终以考试院和高校招生章程为准。', 112, 1680, 820, 34, '650 24px "PingFang SC", sans-serif');

      ctx.fillStyle = '#dfe7df';
      roundRect(70, 1810, 940, 14, 7); ctx.fill();
      ctx.fillStyle = campaign.accent;
      roundRect(70, 1810, 940 * ((slideIndex + progress) / campaign.videoSlides.length), 14, 7); ctx.fill();
    }

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const stream = canvas.captureStream(24);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data && event.data.size) chunks.push(event.data); };
    const done = new Promise(resolve => recorder.onstop = resolve);
    recorder.start();
    const slideMs = 2100;
    const total = campaign.videoSlides.length * slideMs;
    const start = performance.now();
    while (performance.now() - start < total) {
      const elapsed = performance.now() - start;
      const slideIndex = Math.min(campaign.videoSlides.length - 1, Math.floor(elapsed / slideMs));
      const progress = (elapsed % slideMs) / slideMs;
      drawSlide(slideIndex, progress);
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    drawSlide(campaign.videoSlides.length - 1, 1);
    recorder.stop();
    await done;
    const blob = new Blob(chunks, { type: mime });
    const buffer = await blob.arrayBuffer();
    return Array.from(new Uint8Array(buffer));
  }, { campaign, logoData, colors });
  fs.writeFileSync(outPath, Buffer.from(bytes));
  await page.close();
}

async function main() {
  ensureDir(OUT_DIR);
  ensureDir(HTML_DIR);
  writeCopyDocs();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--lang=zh-CN'],
  });

  try {
    for (const campaign of campaigns) {
      const socialDir = path.join(OUT_DIR, 'images/social-cards', campaign.id);
      const posterDir = path.join(OUT_DIR, 'images/posters');
      const flyerDir = path.join(OUT_DIR, 'images/flyers');
      const storyboardDir = path.join(OUT_DIR, 'videos/storyboards', campaign.id);
      const srtDir = path.join(OUT_DIR, 'videos/subtitles');
      const draftDir = path.join(OUT_DIR, 'videos/drafts');
      [socialDir, posterDir, flyerDir, storyboardDir, srtDir, draftDir].forEach(ensureDir);

      for (let i = 0; i < campaign.cards.length; i++) {
        const html = socialCard(campaign, campaign.cards[i], i);
        const htmlPath = path.join(HTML_DIR, `${campaign.id}_social_${String(i + 1).padStart(2, '0')}.html`);
        const pngPath = path.join(socialDir, `${String(i + 1).padStart(2, '0')}_${campaign.cards[i][0]}.png`);
        writeFile(htmlPath, html);
        await renderHtml(browser, html, pngPath, 1080, 1080);
        addManifest('朋友圈九宫格图片', campaign.folder, campaign.cards[i][0], pngPath, '1080x1080 PNG');
      }

      const posterHtml = poster(campaign);
      const posterHtmlPath = path.join(HTML_DIR, `${campaign.id}_poster.html`);
      const posterPng = path.join(posterDir, `${campaign.id}_${campaign.hero}.png`);
      writeFile(posterHtmlPath, posterHtml);
      await renderHtml(browser, posterHtml, posterPng, 1080, 1440);
      addManifest('社交媒体长图/海报', campaign.folder, campaign.hero, posterPng, '1080x1440 PNG');

      const flyerHtml = flyer(campaign, 'png');
      const flyerPdfHtml = flyer(campaign, 'pdf');
      const flyerHtmlPath = path.join(HTML_DIR, `${campaign.id}_flyer.html`);
      const flyerPdfHtmlPath = path.join(HTML_DIR, `${campaign.id}_flyer_pdf.html`);
      const flyerPng = path.join(flyerDir, `${campaign.id}_${campaign.hero}.png`);
      const flyerPdf = path.join(flyerDir, `${campaign.id}_${campaign.hero}.pdf`);
      writeFile(flyerHtmlPath, flyerHtml);
      writeFile(flyerPdfHtmlPath, flyerPdfHtml);
      await renderHtml(browser, flyerHtml, flyerPng, 1240, 1754);
      await renderHtml(browser, flyerPdfHtml, path.join(flyerDir, `${campaign.id}_${campaign.hero}_pdf-preview.png`), 794, 1123, flyerPdf);
      addManifest('线下Flyer图片', campaign.folder, campaign.hero, flyerPng, 'A4比例 PNG');
      addManifest('线下Flyer PDF', campaign.folder, campaign.hero, flyerPdf, 'A4 PDF，可打印');

      for (let i = 0; i < campaign.videoSlides.length; i++) {
        const html = storyboardFrame(campaign, campaign.videoSlides[i], i);
        const htmlPath = path.join(HTML_DIR, `${campaign.id}_storyboard_${String(i + 1).padStart(2, '0')}.html`);
        const pngPath = path.join(storyboardDir, `${String(i + 1).padStart(2, '0')}_${campaign.videoSlides[i][0]}.png`);
        writeFile(htmlPath, html);
        await renderHtml(browser, html, pngPath, 1080, 1920);
        addManifest('短视频分镜图', campaign.folder, `${campaign.videoSlides[i][0]}｜${campaign.videoSlides[i][1]}`, pngPath, '1080x1920 PNG');
      }

      const srtPath = path.join(srtDir, `${campaign.id}_${campaign.folder}.srt`);
      writeSrt(campaign, srtPath);
      addManifest('短视频字幕', campaign.folder, campaign.hero, srtPath, 'SRT字幕，可导入剪映');

      const webmPath = path.join(draftDir, `${campaign.id}_${campaign.folder}_无配音草稿.webm`);
      try {
        await renderVideoDraft(browser, campaign, webmPath);
        addManifest('短视频草稿', campaign.folder, campaign.hero, webmPath, '竖版WebM，无配音，可预览节奏');
      } catch (err) {
        const fallback = path.join(draftDir, `${campaign.id}_${campaign.folder}_视频草稿生成失败说明.txt`);
        writeFile(fallback, `WebM草稿生成失败：${err.message}\n可使用 videos/storyboards 和 subtitles 在剪映中合成。`);
        addManifest('短视频草稿说明', campaign.folder, campaign.hero, fallback, '本机无视频编码能力时使用');
      }
    }
  } finally {
    await browser.close();
  }

  const readme = `# 涨识三层推广素材包

本目录根据 \`mkt/涨识_三层推广招募方案.xlsx\` 生成，覆盖三层推广链路：

1. 运营方招募合伙人
2. 合伙人招募推荐官
3. 推荐官转化普通用户

## 目录说明

- \`copy/\`：朋友圈、社交媒体、私聊、群公告、Flyer、短视频脚本文案。
- \`images/social-cards/\`：朋友圈九宫格图片，1080x1080。
- \`images/posters/\`：社交媒体长图/海报，1080x1440。
- \`images/flyers/\`：A4 Flyer，包含 PNG 和 PDF。
- \`videos/storyboards/\`：竖版短视频分镜图，1080x1920。
- \`videos/subtitles/\`：SRT 字幕，可导入剪映。
- \`videos/drafts/\`：无配音 WebM 草稿，用于预览节奏。
- \`editable-html/\`：所有图片的可编辑 HTML 源文件。
- \`素材清单.xlsx\`：全部素材路径索引。

## 使用前必须替换

- 海报和 Flyer 中的“小程序码占位/说明会占位”需要替换为正式小程序码、合伙人邀请码或推荐官邀请码。
- 城市、联系人、说明会时间可以在 \`editable-html/\` 中调整后重新截图。
- 对外公开文案避免使用“一级分销、二级分销、下级、拉人头、躺赚”等说法。

## 合规提醒

报告定位为志愿填报初筛和信息整理工具。公开素材不要承诺录取结果，不使用“内部数据”“保证不滑档”等表达，最终核对以考试院和高校招生章程为准。
`;
  writeFile(path.join(OUT_DIR, 'README.md'), readme);
  addManifest('使用说明', '全层级', 'README', path.join(OUT_DIR, 'README.md'), '素材包使用说明');

  const manifestWb = XLSX.utils.book_new();
  const manifestWs = XLSX.utils.json_to_sheet(MANIFEST);
  manifestWs['!cols'] = [
    { wch: 18 }, { wch: 20 }, { wch: 34 }, { wch: 70 }, { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(manifestWb, manifestWs, '素材清单');
  const manifestPath = path.join(OUT_DIR, '素材清单.xlsx');
  XLSX.writeFile(manifestWb, manifestPath);
  writeFile(path.join(OUT_DIR, '素材清单.csv'), XLSX.utils.sheet_to_csv(manifestWs));

  console.log(`Generated ${MANIFEST.length} materials in ${OUT_DIR}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
