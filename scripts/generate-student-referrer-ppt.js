const path = require('path');
const pptxgen = require('pptxgenjs');

const OUT_FILE = path.join(__dirname, '..', 'mkt', '大学生兼职推广方案.pptx');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Zhangshi';
pptx.company = '涨识';
pptx.subject = '大学生兼职推广方案';
pptx.title = '涨识大学生兼职推广方案';
pptx.lang = 'zh-CN';
pptx.theme = {
  headFontFace: 'PingFang SC',
  bodyFontFace: 'PingFang SC',
  lang: 'zh-CN',
};
pptx.defineLayout({ name: 'LAYOUT_WIDE', width: 13.333, height: 7.5 });

const C = {
  bg: 'F8FAFC',
  dark: '0F172A',
  text: '334155',
  muted: '64748B',
  teal: '0F766E',
  softTeal: 'ECFDF5',
  orange: 'D97706',
  softOrange: 'FFF7ED',
  blue: '2563EB',
  softBlue: 'EFF6FF',
  green: '16A34A',
  softGreen: 'F0FDF4',
  red: 'DC2626',
  softRed: 'FEF2F2',
  amber: 'F59E0B',
  softAmber: 'FFFBEB',
  line: 'CBD5E1',
  card: 'FFFFFF',
};

function addBg(slide) {
  slide.background = { color: C.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 7.5,
    fill: { color: C.bg },
    line: { color: C.bg },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 0.1,
    fill: { color: C.teal },
    line: { color: C.teal },
  });
}

function footer(slide, page) {
  slide.addText('涨识 · 大学生兼职推广方案', {
    x: 0.58, y: 7.08, w: 5.2, h: 0.18,
    fontSize: 8.5,
    color: C.muted,
  });
  slide.addText(String(page).padStart(2, '0'), {
    x: 12.18, y: 7.05, w: 0.55, h: 0.22,
    fontFace: 'Aptos',
    fontSize: 9,
    color: C.muted,
    align: 'right',
  });
}

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: opts.fill || C.card },
    line: { color: opts.line || 'E2E8F0', transparency: 4 },
    shadow: opts.shadow === false ? undefined : {
      type: 'outer',
      color: 'CBD5E1',
      opacity: 0.12,
      blur: 1,
      angle: 45,
      distance: 1,
    },
  });
}

function title(slide, text, sub) {
  slide.addText(text, {
    x: 0.6, y: 0.48, w: 9.5, h: 0.48,
    fontSize: 23,
    bold: true,
    color: C.dark,
    fit: 'shrink',
  });
  if (sub) {
    slide.addText(sub, {
      x: 0.62, y: 1.02, w: 10.8, h: 0.28,
      fontSize: 10.5,
      color: C.muted,
      fit: 'shrink',
    });
  }
}

function chip(slide, text, x, y, w, color = C.teal, fill = C.softTeal) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.34,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: fill },
  });
  slide.addText(text, {
    x, y: y + 0.075, w, h: 0.14,
    fontSize: 8.5,
    bold: true,
    color,
    align: 'center',
  });
}

function bullets(slide, items, x, y, w, h, opts = {}) {
  slide.addText(items.map((item) => ({ text: `• ${item}\n`, options: {} })), {
    x, y, w, h,
    fontSize: opts.fontSize || 12.5,
    color: opts.color || C.text,
    fit: 'shrink',
    breakLine: false,
    valign: 'top',
    paraSpaceAfterPt: opts.spaceAfter || 4,
  });
}

function numbered(slide, items, x, y, w, h, opts = {}) {
  slide.addText(items.map((item, idx) => ({ text: `${idx + 1}. ${item}\n`, options: {} })), {
    x, y, w, h,
    fontSize: opts.fontSize || 13,
    color: opts.color || C.text,
    fit: 'shrink',
    breakLine: false,
    valign: 'top',
    paraSpaceAfterPt: opts.spaceAfter || 5,
  });
}

function kpi(slide, label, value, note, x, y, w, color = C.teal) {
  card(slide, x, y, w, 1.1);
  slide.addText(value, {
    x: x + 0.22, y: y + 0.15, w: w - 0.44, h: 0.34,
    fontSize: 21,
    bold: true,
    color,
    fit: 'shrink',
  });
  slide.addText(label, {
    x: x + 0.22, y: y + 0.57, w: w - 0.44, h: 0.2,
    fontSize: 10.5,
    bold: true,
    color: C.dark,
    fit: 'shrink',
  });
  slide.addText(note, {
    x: x + 0.22, y: y + 0.82, w: w - 0.44, h: 0.18,
    fontSize: 8.5,
    color: C.muted,
    fit: 'shrink',
  });
}

function addSlide(page, builder) {
  const slide = pptx.addSlide();
  addBg(slide);
  builder(slide);
  footer(slide, page);
}

function threeCards(slide, items) {
  items.forEach((item, idx) => {
    const x = 0.75 + idx * 4.1;
    const fill = idx === 1 ? C.softOrange : idx === 2 ? C.softBlue : C.softTeal;
    const line = idx === 1 ? 'FED7AA' : idx === 2 ? 'BFDBFE' : 'CCFBF1';
    const color = idx === 1 ? C.orange : idx === 2 ? C.blue : C.teal;
    card(slide, x, 1.65, 3.35, 3.95, { fill, line, shadow: false });
    slide.addText(item.title, {
      x: x + 0.28, y: 1.98, w: 2.75, h: 0.32,
      fontSize: 16,
      bold: true,
      color,
      fit: 'shrink',
    });
    bullets(slide, item.items, x + 0.28, 2.58, 2.72, 1.95, { fontSize: 12.5, color: C.dark });
  });
}

function rows(slide, data) {
  data.forEach((row, idx) => {
    const y = 1.55 + idx * 1.05;
    const fill = idx % 2 ? C.card : C.softTeal;
    const line = idx % 2 ? 'E2E8F0' : 'CCFBF1';
    card(slide, 0.75, y, 11.55, 0.78, { fill, line, shadow: false });
    slide.addText(row[0], {
      x: 1.0, y: y + 0.23, w: 2.05, h: 0.18,
      fontSize: 11.5,
      bold: true,
      color: C.teal,
      fit: 'shrink',
    });
    slide.addText(row[1], {
      x: 3.35, y: y + 0.21, w: 2.2, h: 0.2,
      fontSize: 13,
      bold: true,
      color: C.dark,
      fit: 'shrink',
    });
    slide.addText(row[2], {
      x: 5.85, y: y + 0.22, w: 5.8, h: 0.18,
      fontSize: 11.3,
      color: C.text,
      fit: 'shrink',
    });
  });
}

addSlide(1, (s) => {
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 7.5,
    fill: { color: 'F7FBFA' },
    line: { color: 'F7FBFA' },
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 0.12,
    fill: { color: C.teal },
    line: { color: C.teal },
  });
  chip(s, '大学生兼职', 0.72, 0.72, 1.5);
  s.addText('涨识大学生兼职推广方案', {
    x: 0.7, y: 1.25, w: 8.3, h: 0.72,
    fontSize: 31,
    bold: true,
    color: C.dark,
    fit: 'shrink',
  });
  s.addText('定位：成为涨识推荐官，推广AI高考志愿分析小程序', {
    x: 0.72, y: 2.1, w: 7.6, h: 0.35,
    fontSize: 15,
    bold: true,
    color: C.teal,
    fit: 'shrink',
  });
  s.addText('你不需要替家长填志愿，也不需要做复杂咨询。你要做的是传播工具入口，引导高三家庭先生成一份志愿分析报告。', {
    x: 0.74, y: 2.78, w: 6.7, h: 0.75,
    fontSize: 14,
    color: C.text,
    fit: 'shrink',
  });
  card(s, 8.15, 1.05, 3.95, 4.55, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  s.addText('一页看懂', {
    x: 8.52, y: 1.45, w: 2.2, h: 0.28,
    fontSize: 14,
    bold: true,
    color: C.dark,
  });
  bullets(s, [
    '适合大学生兼职',
    '不要求志愿填报经验',
    '平台提供素材和培训',
    '按邀请码记录转化',
    '用户充值后获得奖励',
  ], 8.52, 1.95, 3.05, 2.55, { fontSize: 13, color: C.text });
  s.addText('2026.06', {
    x: 0.75, y: 6.7, w: 1.2, h: 0.2,
    fontSize: 10,
    color: C.muted,
  });
});

addSlide(2, (s) => {
  title(s, '你是什么角色', '大学生推荐官：把有用的AI志愿分析工具推荐给高三家庭。');
  threeCards(s, [
    { title: '你的定位', items: ['涨识推荐官', '内容传播者', '工具入口推荐者', '高三家庭提醒者'] },
    { title: '你不是', items: ['不是志愿填报老师', '不是代填志愿的人', '不是官方招生渠道', '不是承诺结果的人'] },
    { title: '平台提供', items: ['专属邀请码', '小程序码', '海报和朋友圈文案', '基础培训和话术'] },
  ]);
});

addSlide(3, (s) => {
  title(s, '你具体干什么', '动作越简单，越容易坚持。');
  numbered(s, [
    '领取自己的邀请码和小程序入口。',
    '把平台给的海报、朋友圈文案、短视频脚本发出去。',
    '把小程序推荐给高三学生、高三家长、亲戚朋友和同学群。',
    '引导他们先生成AI志愿分析报告，看冲稳保、院校专业方向和风险提示。',
    '有人感兴趣或看不懂时，用标准话术提醒继续在小程序里追问。',
  ], 1.05, 1.65, 10.8, 3.55, { fontSize: 15 });
  card(s, 1.05, 5.62, 10.75, 0.65, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  s.addText('一句话：你负责传播和轻沟通，平台负责产品、报告、追踪和结算。', {
    x: 1.35, y: 5.84, w: 10.1, h: 0.18,
    fontSize: 12.5,
    bold: true,
    color: C.teal,
    align: 'center',
  });
});

addSlide(4, (s) => {
  title(s, '你不干什么', '这几条是底线，不能为了成交乱说。');
  threeCards(s, [
    { title: '不做专业承诺', items: ['不承诺录取结果', '不说包上岸', '不说精准命中', '不替别人最终决定'] },
    { title: '不冒充身份', items: ['不说官方合作', '不说内部数据', '不冒充老师专家', '不私自收高价咨询费'] },
    { title: '不夸大收益', items: ['不说轻松躺赚', '不保证收入', '不刷屏骚扰', '不诱导未成年人付费'] },
  ]);
});

addSlide(5, (s) => {
  title(s, '你能得到多少钱', '以下为当前推荐官常用示例口径，实际以后台配置和结算规则为准。');
  kpi(s, '用户首充奖励', '20%', '用户通过你的邀请码充值', 0.7, 1.55, 2.65, C.teal);
  kpi(s, '复充低佣奖励', '5%', '有效期内后续充值', 3.7, 1.55, 2.65, C.orange);
  kpi(s, '每日分享点数', '10点/天', '每天有效分享一次', 6.7, 1.55, 2.65, C.blue);
  kpi(s, '好友注册点数', '20点/人', '好友通过分享注册', 9.7, 1.55, 2.65, C.green);
  card(s, 0.9, 3.48, 10.95, 1.65, { fill: C.card });
  s.addText('举例说明', {
    x: 1.2, y: 3.82, w: 1.5, h: 0.22,
    fontSize: 14,
    bold: true,
    color: C.teal,
  });
  s.addText('如果用户充值100元，按20%示例，你可获得20元推荐奖励；如果后续按5%复充低佣结算，用户复充100元，你可获得5元。', {
    x: 1.2, y: 4.2, w: 10.2, h: 0.42,
    fontSize: 16,
    bold: true,
    color: C.dark,
    fit: 'shrink',
  });
  s.addText('说明：奖励进入后台记录，满足结算和提现规则后处理；不要对外承诺固定收入。', {
    x: 1.0, y: 5.78, w: 10.7, h: 0.22,
    fontSize: 10.5,
    color: C.muted,
  });
});

addSlide(6, (s) => {
  title(s, '适合你发给谁', '优先找真实有高考志愿需求的人。');
  rows(s, [
    ['第一类', '高三同学', '同学本人正在关注分数、院校、专业和城市选择'],
    ['第二类', '高三家长', '家长更愿意先看报告，再判断是否深入使用'],
    ['第三类', '亲戚朋友', '熟人信任成本低，适合私聊轻推荐'],
    ['第四类', '校园/同乡群', '本地家庭和同省考生更容易形成讨论'],
    ['第五类', '小红书/抖音用户', '用短内容讲一个志愿痛点，引导私信入口'],
  ]);
});

addSlide(7, (s) => {
  title(s, '可以用哪些传播方式', '形式不限，但必须真实、克制、好理解。');
  threeCards(s, [
    { title: '私域传播', items: ['朋友圈', '微信群', 'QQ/同学群', '亲戚朋友私聊'] },
    { title: '内容平台', items: ['小红书图文', '抖音短视频', '视频号口播', '校园墙投稿'] },
    { title: '线下传播', items: ['宿舍同学转介绍', '学校周边海报', '家乡门店二维码', '同乡会轻推荐'] },
  ]);
});

addSlide(8, (s) => {
  title(s, '朋友圈怎么发', '直接复制改一下即可。');
  card(s, 0.8, 1.55, 11.2, 3.25, { fill: C.dark, line: C.dark, shadow: false });
  s.addText('家里有高三孩子的，可以先用涨识做一份AI志愿分析报告。输入省份、科类、分数和偏好，就能看到冲稳保方向、院校专业建议和风险提示。这个不是最终填报结论，但很适合家长先理清思路，最后一定要结合考试院和高校招生章程核对。', {
    x: 1.22, y: 2.15, w: 10.35, h: 1.25,
    fontSize: 18,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    fit: 'shrink',
  });
  card(s, 0.8, 5.18, 11.2, 0.62, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  s.addText('结尾加一句：需要入口可以找我。配图：小程序码 + 报告截图 + 风险提示页。', {
    x: 1.1, y: 5.39, w: 10.4, h: 0.16,
    fontSize: 11.5,
    color: C.teal,
    bold: true,
    align: 'center',
  });
});

addSlide(9, (s) => {
  title(s, '短视频怎么拍', '不需要复杂剪辑，一条视频只讲一个痛点。');
  rows(s, [
    ['开头', '先抓痛点', '高考志愿不要只问“能上哪”，还要看位次和风险'],
    ['中间', '展示工具', '打开涨识小程序，输入省份、科类、分数和偏好'],
    ['结果', '讲报告价值', '报告会整理冲稳保、院校专业方向和风险提示'],
    ['边界', '提醒核对', 'AI报告只做参考，最终以官方信息为准'],
    ['结尾', '引导私信', '需要入口可以私信我，先生成自己的报告'],
  ]);
});

addSlide(10, (s) => {
  title(s, '每天怎么做', '兼职不需要全天在线，但要有稳定动作。');
  rows(s, [
    ['第1步', '发1条内容', '朋友圈、小红书、抖音任选一个渠道'],
    ['第2步', '私聊3个人', '优先找高三同学、家长、亲戚朋友'],
    ['第3步', '发1个群', '只发有用提醒，不要连续刷屏'],
    ['第4步', '记录反馈', '谁扫码、谁注册、谁生成报告、谁想继续问'],
    ['第5步', '复盘优化', '哪个文案有效，第二天就继续用'],
  ]);
});

addSlide(11, (s) => {
  title(s, '加入流程', '当天加入，当天就可以开始推广。');
  numbered(s, [
    '提交姓名、学校、年级、微信和可推广渠道。',
    '加入推荐官说明群，了解产品和规则。',
    '领取自己的邀请码和小程序码。',
    '学习标准话术、禁止话术和结算规则。',
    '发布第一条内容，完成第一批10个有效触达。',
  ], 1.05, 1.65, 10.75, 3.35, { fontSize: 15 });
  card(s, 1.05, 5.52, 10.75, 0.76, { fill: C.softAmber, line: 'FDE68A', shadow: false });
  s.addText('建议目标：第一周完成30个有效触达，争取5-10个用户生成报告。', {
    x: 1.35, y: 5.79, w: 10.1, h: 0.18,
    fontSize: 12.5,
    bold: true,
    color: C.dark,
    align: 'center',
  });
});

addSlide(12, (s) => {
  title(s, '最后记住这句话', '简单、真实、合规，才适合长期做。');
  card(s, 0.95, 1.75, 11.0, 2.4, { fill: C.dark, line: C.dark, shadow: false });
  s.addText('推荐工具，不替人决定；讲清价值，不夸大结果；持续传播，后台记录。', {
    x: 1.38, y: 2.52, w: 10.15, h: 0.45,
    fontSize: 24,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    fit: 'shrink',
  });
  card(s, 1.25, 4.9, 10.35, 0.82, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  s.addText('下一步：进说明群，领取邀请码和素材包，今天先发第一条朋友圈。', {
    x: 1.55, y: 5.18, w: 9.75, h: 0.18,
    fontSize: 13,
    bold: true,
    color: C.teal,
    align: 'center',
  });
});

pptx.writeFile({ fileName: OUT_FILE }).then(() => {
  console.log(`Generated: ${OUT_FILE}`);
});
