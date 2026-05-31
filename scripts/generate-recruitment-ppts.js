const path = require('path');
const pptxgen = require('pptxgenjs');

const OUT_DIR = path.join(__dirname, '..', 'mkt');

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
  amber: 'F59E0B',
  softAmber: 'FFFBEB',
  line: 'CBD5E1',
  card: 'FFFFFF',
};

function createPpt(titleText) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Zhangshi';
  pptx.company = '涨识';
  pptx.subject = titleText;
  pptx.title = titleText;
  pptx.lang = 'zh-CN';
  pptx.theme = {
    headFontFace: 'PingFang SC',
    bodyFontFace: 'PingFang SC',
    lang: 'zh-CN',
  };
  pptx.defineLayout({ name: 'LAYOUT_WIDE', width: 13.333, height: 7.5 });
  return pptx;
}

function addBg(pptx, slide) {
  slide.background = { color: C.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 7.5,
    fill: { color: C.bg },
    line: { color: C.bg },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 0.09,
    fill: { color: C.teal },
    line: { color: C.teal },
  });
}

function footer(slide, page) {
  slide.addText('涨识 · 招募与推广资料', {
    x: 0.58, y: 7.08, w: 5.2, h: 0.18,
    fontFace: 'PingFang SC',
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

function card(pptx, slide, x, y, w, h, opts = {}) {
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

function chip(pptx, slide, text, x, y, w, color = C.teal, fill = C.softTeal) {
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

function title(slide, text, sub) {
  slide.addText(text, {
    x: 0.6, y: 0.48, w: 9.2, h: 0.48,
    fontFace: 'PingFang SC',
    fontSize: 23,
    bold: true,
    color: C.dark,
    fit: 'shrink',
  });
  if (sub) {
    slide.addText(sub, {
      x: 0.62, y: 1.02, w: 10.6, h: 0.28,
      fontSize: 10.5,
      color: C.muted,
      fit: 'shrink',
    });
  }
}

function bullets(slide, items, x, y, w, h, opts = {}) {
  slide.addText(items.map((item) => ({ text: `• ${item}\n`, options: {} })), {
    x, y, w, h,
    fontFace: 'PingFang SC',
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

function kpi(pptx, slide, label, value, note, x, y, w, color = C.teal) {
  card(pptx, slide, x, y, w, 1.08);
  slide.addText(value, {
    x: x + 0.22, y: y + 0.15, w: w - 0.44, h: 0.32,
    fontSize: 22,
    bold: true,
    color,
    fit: 'shrink',
  });
  slide.addText(label, {
    x: x + 0.22, y: y + 0.56, w: w - 0.44, h: 0.2,
    fontSize: 10.5,
    bold: true,
    color: C.dark,
    fit: 'shrink',
  });
  slide.addText(note, {
    x: x + 0.22, y: y + 0.8, w: w - 0.44, h: 0.18,
    fontSize: 8.5,
    color: C.muted,
    fit: 'shrink',
  });
}

function addSlide(pptx, page, builder) {
  const slide = pptx.addSlide();
  addBg(pptx, slide);
  builder(slide);
  footer(slide, page);
}

function cover(pptx, slide, tag, titleText, subtitle, sideTitle, sideItems) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 7.5,
    fill: { color: 'F7FBFA' },
    line: { color: 'F7FBFA' },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 0.12,
    fill: { color: C.teal },
    line: { color: C.teal },
  });
  chip(pptx, slide, tag, 0.72, 0.72, 1.65);
  slide.addText(titleText, {
    x: 0.7, y: 1.25, w: 8.1, h: 0.72,
    fontSize: 31,
    bold: true,
    color: C.dark,
    fit: 'shrink',
  });
  slide.addText(subtitle, {
    x: 0.72, y: 2.08, w: 7.3, h: 0.45,
    fontSize: 15,
    bold: true,
    color: C.teal,
    fit: 'shrink',
  });
  slide.addText('用AI志愿分析报告降低沟通门槛，用公开信息和清晰流程帮助家庭先看懂方向。', {
    x: 0.74, y: 2.82, w: 6.35, h: 0.75,
    fontSize: 14,
    color: C.text,
    fit: 'shrink',
  });
  card(pptx, slide, 8.12, 1.05, 3.95, 4.55, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  slide.addText(sideTitle, {
    x: 8.5, y: 1.45, w: 3.0, h: 0.28,
    fontSize: 14,
    bold: true,
    color: C.dark,
  });
  bullets(slide, sideItems, 8.5, 1.95, 3.05, 2.55, { fontSize: 13, color: C.text });
  slide.addText('2026.05', {
    x: 0.75, y: 6.7, w: 1.2, h: 0.2,
    fontSize: 10,
    color: C.muted,
  });
}

function threeCards(pptx, slide, cards) {
  cards.forEach((it, idx) => {
    const x = 0.75 + idx * 4.1;
    const fill = idx === 1 ? C.softOrange : idx === 2 ? C.softBlue : C.softTeal;
    const line = idx === 1 ? 'FED7AA' : idx === 2 ? 'BFDBFE' : 'CCFBF1';
    const color = idx === 1 ? C.orange : idx === 2 ? C.blue : C.teal;
    card(pptx, slide, x, 1.65, 3.35, 3.9, { fill, line, shadow: false });
    slide.addText(it.title, {
      x: x + 0.28, y: 1.98, w: 2.7, h: 0.32,
      fontSize: 16,
      bold: true,
      color,
      fit: 'shrink',
    });
    bullets(slide, it.items, x + 0.28, 2.58, 2.72, 1.9, { fontSize: 12.5, color: C.dark });
  });
}

function flowRows(pptx, slide, rows) {
  rows.forEach((row, idx) => {
    const y = 1.55 + idx * 1.18;
    const fill = idx % 2 ? C.card : C.softTeal;
    const line = idx % 2 ? 'E2E8F0' : 'CCFBF1';
    card(pptx, slide, 0.75, y, 11.45, 0.86, { fill, line, shadow: false });
    slide.addText(row[0], {
      x: 1.0, y: y + 0.26, w: 2.05, h: 0.18,
      fontSize: 11.5,
      bold: true,
      color: C.teal,
      fit: 'shrink',
    });
    slide.addText(row[1], {
      x: 3.35, y: y + 0.24, w: 2.05, h: 0.2,
      fontSize: 13,
      bold: true,
      color: C.dark,
      fit: 'shrink',
    });
    slide.addText(row[2], {
      x: 5.65, y: y + 0.24, w: 5.9, h: 0.2,
      fontSize: 11.5,
      color: C.text,
      fit: 'shrink',
    });
  });
}

async function buildPartnerDeck() {
  const pptx = createPpt('涨识合伙人招募计划');

  addSlide(pptx, 1, (s) => {
    cover(
      pptx,
      s,
      '合作招募',
      '涨识合伙人招募计划',
      '适合有本地家长资源、教育资源、社群触达能力的人',
      '你能获得什么',
      ['AI志愿分析工具', '统一推广素材和培训', '邀请码追踪与收益统计', '首充和复充收益示例', '可持续的本地服务机会'],
    );
  });

  addSlide(pptx, 2, (s) => {
    title(s, '什么是涨识合伙人', '你负责本地信任和资源触达，涨识负责产品、报告、素材、数据追踪与结算。');
    threeCards(pptx, s, [
      { title: '做什么', items: ['把小程序介绍给高三家庭', '组织本地微信群或讲座', '帮助家庭先生成报告', '沉淀可复用的服务流程'] },
      { title: '不做什么', items: ['不替家长做最终决定', '不承诺录取结果', '不冒充官方渠道', '不做恐慌式销售'] },
      { title: '平台支持', items: ['小程序和分析报告', '院校、专业、知识库内容', '推广物料和话术', '后台数据与结算记录'] },
    ]);
  });

  addSlide(pptx, 3, (s) => {
    title(s, '适合哪些人加入', '核心不是头衔，而是你是否能触达需要志愿分析的高三家庭。');
    flowRows(pptx, s, [
      ['教育资源方', '教培/复读/艺考机构', '已有学生和家长沟通场景，可做增值服务入口'],
      ['内容创作者', '本地教育号/短视频号', '用内容获取信任，再用小程序承接咨询需求'],
      ['社群组织者', '家长群主/社区群主', '熟人信任强，适合做低门槛推荐和答疑'],
      ['线下触点', '打印店/照相馆/书店', '高考季自然接触考生家庭，适合放置入口'],
    ]);
  });

  addSlide(pptx, 4, (s) => {
    title(s, '合伙人能得到什么', '收益规则可在后台配置，对外沟通时以当前后台设置为准。');
    kpi(pptx, s, '直属用户首充收益', '示例40%', '通过你的邀请码充值', 0.7, 1.58, 2.65, C.teal);
    kpi(pptx, s, '协作推广差额收益', '示例20%', '团队成交时按规则结算', 3.7, 1.58, 2.65, C.orange);
    kpi(pptx, s, '复充低佣收益', '示例5%', '有效期内复充继续结算', 6.7, 1.58, 2.65, C.blue);
    kpi(pptx, s, '新用户赠点策略', '可配置', '可单独设置额外赠点', 9.7, 1.58, 2.65, C.green);
    card(pptx, s, 0.85, 3.45, 11.1, 1.75, { fill: C.card });
    slideText(s, '一句话价值', '把你已有的本地信任、教育资源和社群触达，变成可追踪、可复盘、可结算的高考志愿服务业务。', 1.15, 3.83, 10.3);
    s.addText('注：比例为示例口径，正式执行以后台配置和合作协议为准。', {
      x: 0.9, y: 5.75, w: 9.8, h: 0.22,
      fontSize: 10.5,
      color: C.muted,
    });
  });

  addSlide(pptx, 5, (s) => {
    title(s, '你如何开始做', '先跑通最小闭环，再扩大本地触点。');
    numbered(s, [
      '领取专属邀请码和小程序入口。',
      '把朋友圈图文、海报、短视频脚本发到自己的私域。',
      '引导高三家庭输入省份、科类、分数、偏好，生成志愿分析报告。',
      '围绕报告中的冲稳保、风险点、专业方向做跟进。',
      '每天看后台数据，复盘扫码、注册、报告生成、充值转化。',
    ], 1.0, 1.65, 10.8, 3.4, { fontSize: 15 });
    card(pptx, s, 1.0, 5.55, 10.8, 0.72, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
    s.addText('建议先用7天验证：20个精准私聊 + 3条朋友圈 + 2个家长群 + 1场小型分享。', {
      x: 1.35, y: 5.79, w: 10.1, h: 0.18,
      fontSize: 12.5,
      bold: true,
      color: C.teal,
      align: 'center',
    });
  });

  addSlide(pptx, 6, (s) => {
    title(s, '合伙人推广工具包', '降低开口难度，让每一次触达都有统一承接。');
    threeCards(pptx, s, [
      { title: '图文素材', items: ['朋友圈文案', '社交媒体长图', '微信群公告', '私聊开场话术'] },
      { title: '线下素材', items: ['扫码海报', 'A4 flyer', '讲座提纲', '家长答疑清单'] },
      { title: '运营素材', items: ['7天启动清单', '每日复盘表', '转化数据看板', '合规表达清单'] },
    ]);
  });

  addSlide(pptx, 7, (s) => {
    title(s, '朋友圈怎么发', '别一上来卖课，先讲家长关心的问题，再给工具入口。');
    card(pptx, s, 0.8, 1.55, 11.2, 3.0, { fill: C.dark, line: C.dark, shadow: false });
    s.addText('今年志愿填报，很多家长最难的不是缺信息，而是信息太多、不知道怎么取舍。可以先用涨识AI志愿分析生成一份参考报告，看看冲稳保、院校方向和风险点。报告仅供参考，最终还要结合考试院和高校招生章程核对。', {
      x: 1.22, y: 2.12, w: 10.3, h: 1.25,
      fontSize: 18,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      fit: 'shrink',
    });
    card(pptx, s, 0.8, 5.05, 11.2, 0.65, { fill: C.softAmber, line: 'FDE68A', shadow: false });
    s.addText('配图建议：产品首页、报告截图、冲稳保示例、风险提示示例、扫码入口。', {
      x: 1.1, y: 5.28, w: 10.4, h: 0.16,
      fontSize: 11.5,
      color: C.dark,
      align: 'center',
    });
  });

  addSlide(pptx, 8, (s) => {
    title(s, '短视频怎么做', '围绕家长搜索的问题做内容，不追求花哨，追求能被理解和转发。');
    flowRows(pptx, s, [
      ['选题1', '500分左右怎么填', '讲位次、冲稳保、专业组，不给绝对结论'],
      ['选题2', '县城家长容易踩的坑', '讲信息差、专业误区、调剂风险'],
      ['选题3', '出分前要准备什么', '讲院校层次、城市偏好、避坑专业清单'],
      ['结尾口径', '先做报告再判断', '引导微信搜索涨识小程序或扫码体验'],
    ]);
  });

  addSlide(pptx, 9, (s) => {
    title(s, '线下怎么启动', '用小型分享会建立信任，现场扫码生成报告。');
    threeCards(pptx, s, [
      { title: '场地', items: ['教培教室', '社区活动室', '书店/茶室', '机构门店'] },
      { title: '流程', items: ['30分钟讲避坑', '10分钟演示报告', '现场扫码体验', '收集后续需求'] },
      { title: '物料', items: ['签到二维码', '报告样例', 'A4单页', 'FAQ问答清单'] },
    ]);
  });

  addSlide(pptx, 10, (s) => {
    title(s, '7天启动计划', '把动作拆小，先验证真实转化。');
    flowRows(pptx, s, [
      ['第1天', '准备入口', '确认邀请码、海报、朋友圈文案、报告截图'],
      ['第2-3天', '私域触达', '发朋友圈，私聊20个精准家长或资源方'],
      ['第4-5天', '建群服务', '发避坑内容，邀请家庭先生成报告'],
      ['第6-7天', '复盘转化', '看扫码、注册、报告、充值数据，优化话术'],
    ]);
  });

  addSlide(pptx, 11, (s) => {
    title(s, '常见问题', '把疑虑讲清楚，成交会更自然。');
    twoColumns(pptx, s, [
      ['需要懂志愿填报吗？', '不需要一开始就做复杂咨询。你主要负责触达和引导体验，专业内容以产品报告和公开信息为基础。'],
      ['用户如何被追踪？', '用户通过你的邀请码或小程序分享入口进入后，系统会记录来源和相关转化。'],
      ['收益什么时候结算？', '订单会先进入待结算状态，满足规则后再进入可提现或可对账状态。'],
    ], [
      ['能承诺录取吗？', '不能。报告用于初筛参考，最终要以考试院和高校招生章程为准。'],
      ['适合哪里推广？', '二三四线城市、县城、城镇家庭、本地教育社群，通常更需要低门槛工具。'],
      ['怎么提高转化？', '让家长先看到自己的报告，再围绕具体问题沟通，少讲概念，多讲结果。'],
    ]);
  });

  addSlide(pptx, 12, (s) => {
    title(s, '合规边界', '稳定长期做，比短期夸张表达更重要。');
    threeCards(pptx, s, [
      { title: '可以讲', items: ['公开信息辅助分析', '报告用于初筛参考', '帮助理解冲稳保', '后台记录清晰可查'] },
      { title: '不要讲', items: ['保证录取', '内部数据', '官方授权', '百分百命中'] },
      { title: '下一步', items: ['领取邀请码', '加入培训群', '拿素材包', '开始7天测试'] },
    ]);
  });

  await pptx.writeFile({ fileName: path.join(OUT_DIR, '总代：涨识_合伙人招募计划.pptx') });
}

async function buildReferrerDeck() {
  const pptx = createPpt('涨识推荐官招募计划');

  addSlide(pptx, 1, (s) => {
    cover(
      pptx,
      s,
      '轻量推荐',
      '涨识推荐官招募计划',
      '适合身边有高三家庭资源、愿意分享实用工具的人',
      '你只需要做什么',
      ['把工具推荐给需要的人', '提醒先生成分析报告', '转发统一素材和入口', '收集问题并反馈', '不替别人做最终决定'],
    );
  });

  addSlide(pptx, 2, (s) => {
    title(s, '什么是推荐官', '你不是复杂咨询师，而是把有用的AI志愿分析工具带给身边需要的家庭。');
    threeCards(pptx, s, [
      { title: '核心动作', items: ['分享小程序入口', '提醒家长先做报告', '转发避坑内容', '把问题反馈给服务群'] },
      { title: '适合人群', items: ['高三家长群群主', '往届高三家长', '老师/课程顾问', '大学生或准大学生'] },
      { title: '平台提供', items: ['统一海报', '朋友圈文案', '基础话术', '邀请码和数据记录'] },
    ]);
  });

  addSlide(pptx, 3, (s) => {
    title(s, '推荐官能得到什么', '把身边真实需求连接到工具，既帮到人，也能获得清晰记录的奖励。');
    kpi(pptx, s, '用户首充收益', '示例20%', '通过你的入口充值', 0.7, 1.58, 2.65, C.teal);
    kpi(pptx, s, '复充低佣收益', '示例5%', '有效期内复充继续结算', 3.7, 1.58, 2.65, C.orange);
    kpi(pptx, s, '每日分享奖励', '10点', '每天有效分享一次', 6.7, 1.58, 2.65, C.blue);
    kpi(pptx, s, '好友注册奖励', '20点', '好友通过分享注册', 9.7, 1.58, 2.65, C.green);
    card(pptx, s, 0.9, 3.55, 10.95, 1.35, { fill: C.card });
    s.addText('重点：奖励规则以后台配置为准；公开表达应强调服务价值，不夸大收益。', {
      x: 1.25, y: 4.05, w: 10.2, h: 0.24,
      fontSize: 14,
      bold: true,
      color: C.dark,
      align: 'center',
      fit: 'shrink',
    });
  });

  addSlide(pptx, 4, (s) => {
    title(s, '推荐官如何推荐', '三句话就够，别把事情讲复杂。');
    card(pptx, s, 0.85, 1.55, 10.95, 3.4, { fill: C.dark, line: C.dark, shadow: false });
    numbered(s, [
      '你家孩子今年高考吗？可以先用这个AI志愿分析看一下大概方向。',
      '它会根据省份、科类、分数和偏好，生成冲稳保、院校专业方向和风险提示。',
      '这个只是先做参考，最终还要结合考试院和学校招生章程核对。',
    ], 1.25, 2.15, 10.15, 1.75, { fontSize: 17, color: 'FFFFFF', spaceAfter: 8 });
    s.addText('推荐时的原则：轻提醒、给入口、让对方先看自己的报告。', {
      x: 1.1, y: 5.58, w: 10.4, h: 0.24,
      fontSize: 14,
      bold: true,
      color: C.teal,
      align: 'center',
    });
  });

  addSlide(pptx, 5, (s) => {
    title(s, '适合发给谁', '优先找已经有明确志愿需求的人，转化会更自然。');
    flowRows(pptx, s, [
      ['精准家庭', '高三考生家长', '正在关注分数、位次、专业和城市选择'],
      ['同城社群', '家长群/社区群', '同省同城问题更集中，容易形成讨论'],
      ['熟人关系', '亲戚朋友同事', '信任成本低，更愿意先扫码体验'],
      ['内容互动', '评论区咨询者', '把泛问题引导到小程序报告里具体看'],
    ]);
  });

  addSlide(pptx, 6, (s) => {
    title(s, '朋友圈模板', '不要像广告，像一次真诚提醒。');
    card(pptx, s, 0.8, 1.55, 11.2, 3.1, { fill: C.dark, line: C.dark, shadow: false });
    s.addText('家里有高三孩子的，可以先做一次AI志愿分析。输入省份、科类、分数和偏好，就能看到一份冲稳保、院校专业方向和风险提示报告。这个不是最终结论，但很适合家长先理清思路，少一点盲目焦虑。', {
      x: 1.25, y: 2.16, w: 10.3, h: 1.16,
      fontSize: 18,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      fit: 'shrink',
    });
    card(pptx, s, 0.8, 5.15, 11.2, 0.62, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
    s.addText('结尾加一句：需要入口可以私信我，或直接扫码体验。', {
      x: 1.1, y: 5.37, w: 10.4, h: 0.16,
      fontSize: 11.5,
      color: C.teal,
      bold: true,
      align: 'center',
    });
  });

  addSlide(pptx, 7, (s) => {
    title(s, '微信群模板', '群内不要刷屏，只发对大家有帮助的内容。');
    twoColumns(pptx, s, [
      ['群公告版', '高考志愿填报信息很多，建议大家先做一份自己的志愿分析报告，看清楚冲稳保和风险点，再进一步核对招生章程。'],
      ['轻提醒版', '不要等出分后才开始慌，现在可以先把城市、专业、风险偏好想清楚。'],
      ['答疑版', '报告只能作为参考，最终以官方志愿系统、考试院和高校招生章程为准。'],
    ], [
      ['适合频率', '每天最多1次，不连续刷屏。'],
      ['配图建议', '报告截图、风险提示、扫码入口，不放夸张收益。'],
      ['互动方式', '有人提问后，再私聊给入口，转化更自然。'],
    ]);
  });

  addSlide(pptx, 8, (s) => {
    title(s, '每天15分钟动作', '轻量执行，比一次性猛发更有效。');
    flowRows(pptx, s, [
      ['第1步', '发1条朋友圈', '围绕一个家长痛点，不要一次讲太多'],
      ['第2步', '私聊3个家庭', '只问是否需要先做一份参考报告'],
      ['第3步', '发1条群内容', '讲避坑、位次、专业风险等通用信息'],
      ['第4步', '记录反馈', '看谁扫码、谁生成报告、谁需要进一步解释'],
    ]);
  });

  addSlide(pptx, 9, (s) => {
    title(s, '如何提高转化', '先让对方看见自己的问题，再谈是否需要深入分析。');
    threeCards(pptx, s, [
      { title: '先问需求', items: ['省份科类', '大概分数', '城市偏好', '专业避坑'] },
      { title: '再给入口', items: ['扫码生成报告', '截图重点页', '看冲稳保', '看风险提示'] },
      { title: '最后跟进', items: ['问报告哪里看不懂', '提醒核对章程', '再决定是否充值'] },
    ]);
  });

  addSlide(pptx, 10, (s) => {
    title(s, '常见问题', '提前准备答案，沟通会更轻松。');
    twoColumns(pptx, s, [
      ['我要懂专业知识吗？', '不需要替别人做最终判断，只需要把工具入口和基础提醒讲清楚。'],
      ['用户不充值怎么办？', '先让对方看到报告价值，别硬推。高考志愿是信任决策。'],
      ['奖励怎么记录？', '通过专属邀请码和分享入口进入后，系统会自动记录来源。'],
    ], [
      ['可以承诺结果吗？', '不能。所有建议都要以官方信息核对。'],
      ['什么时候最好发？', '晚饭后、查分前后、群里有人讨论志愿时。'],
      ['怎么避免打扰？', '只发有用内容，不连续刷屏，熟人私聊要尊重对方意愿。'],
    ]);
  });

  addSlide(pptx, 11, (s) => {
    title(s, '合规表达', '做高考服务，表达越稳，越容易长期被信任。');
    threeCards(pptx, s, [
      { title: '可以说', items: ['公开数据辅助参考', '先生成报告看方向', '帮助理解风险点', '最终以官方信息为准'] },
      { title: '不要说', items: ['保证录取', '内部渠道', '精准预测', '包填包中'] },
      { title: '记住一句', items: ['推荐工具', '不替人决定', '不制造焦虑', '不夸大收益'] },
    ]);
  });

  addSlide(pptx, 12, (s) => {
    title(s, '加入流程', '拿到入口后，当天就可以开始。');
    numbered(s, [
      '提交手机号和微信信息，完成身份确认。',
      '领取专属邀请码、小程序码和素材包。',
      '学习三句话术和合规边界。',
      '发布第一条朋友圈，私聊第一批高三家庭。',
      '每天复盘扫码、注册、报告生成和充值情况。',
    ], 1.05, 1.65, 10.7, 3.4, { fontSize: 15 });
    card(pptx, s, 1.05, 5.58, 10.7, 0.68, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
    s.addText('目标：先完成第一批10个有效触达，跑通从分享入口到生成报告的完整链路。', {
      x: 1.35, y: 5.81, w: 10.1, h: 0.18,
      fontSize: 12.5,
      bold: true,
      color: C.teal,
      align: 'center',
    });
  });

  await pptx.writeFile({ fileName: path.join(OUT_DIR, '合伙人：涨识_推荐官招募计划.pptx') });
}

async function buildUserDeck() {
  const pptx = createPpt('涨识AI志愿分析使用与推广建议');

  addSlide(pptx, 1, (s) => {
    cover(
      pptx,
      s,
      '用户体验',
      '涨识AI志愿分析使用与推广建议',
      '给高三家庭的一份低门槛志愿分析工具介绍',
      '普通用户能得到什么',
      ['生成志愿分析报告', '查看冲稳保方向', '识别院校和专业风险', '继续追问具体问题', '分享还可获得点数奖励'],
    );
  });

  addSlide(pptx, 2, (s) => {
    title(s, '为什么要先做一份报告', '高考志愿不是只看分数，位次、城市、专业、选科和风险偏好都要一起看。');
    threeCards(pptx, s, [
      { title: '信息太多', items: ['院校多', '专业多', '规则复杂', '家长容易无从下手'] },
      { title: '时间太短', items: ['出分后很紧张', '填报窗口有限', '临时决策压力大', '需要提前理清方向'] },
      { title: '先看方向', items: ['冲稳保参考', '专业风险提示', '城市偏好整理', '后续再逐项核对'] },
    ]);
  });

  addSlide(pptx, 3, (s) => {
    title(s, '普通用户能得到什么', '先用较低门槛看清方向，再决定是否继续深入分析。');
    kpi(pptx, s, '新用户赠点', '100点', '默认系统赠送', 0.7, 1.58, 2.65, C.teal);
    kpi(pptx, s, '每日分享', '10点', '每天有效分享一次', 3.7, 1.58, 2.65, C.orange);
    kpi(pptx, s, '好友注册', '20点', '好友通过分享注册', 6.7, 1.58, 2.65, C.blue);
    kpi(pptx, s, '深度追问', '可继续', '围绕报告具体提问', 9.7, 1.58, 2.65, C.green);
    card(pptx, s, 0.9, 3.55, 10.95, 1.35, { fill: C.card });
    s.addText('如果通过特定邀请入口注册，可能还会获得额外点数，具体以小程序内实际到账记录为准。', {
      x: 1.25, y: 4.05, w: 10.2, h: 0.24,
      fontSize: 14,
      bold: true,
      color: C.dark,
      align: 'center',
      fit: 'shrink',
    });
  });

  addSlide(pptx, 4, (s) => {
    title(s, '适合哪些家庭', '不一定要等到出分后才开始准备。');
    flowRows(pptx, s, [
      ['高三家庭', '正在准备志愿填报', '想提前理解院校、专业、城市和风险'],
      ['分数不确定', '需要估方向', '想先看不同分数段的可能选择'],
      ['信息焦虑', '不知道怎么筛学校', '需要一份结构化报告先建立思路'],
      ['预算谨慎', '不想一开始高价咨询', '希望先低门槛体验，再决定是否深入'],
    ]);
  });

  addSlide(pptx, 5, (s) => {
    title(s, '使用流程', '几步完成一次初步分析。');
    numbered(s, [
      '打开涨识小程序，进入AI高考志愿分析。',
      '填写省份、科类、分数或位次、偏好城市、偏好专业和避坑专业。',
      '生成志愿分析报告，先看冲稳保和风险提示。',
      '对看不懂的地方继续追问，比如某个学校、某个专业、调剂风险。',
      '把重点结果和官方招生章程、考试院信息逐项核对。',
    ], 1.05, 1.65, 10.8, 3.65, { fontSize: 15 });
  });

  addSlide(pptx, 6, (s) => {
    title(s, '报告重点看什么', '不要只看学校名字，更要看匹配逻辑和风险点。');
    threeCards(pptx, s, [
      { title: '冲稳保', items: ['冲：有机会但风险高', '稳：匹配度相对较高', '保：用于降低滑档风险', '注意梯度是否合理'] },
      { title: '专业方向', items: ['是否符合兴趣', '是否符合选科', '是否有转专业限制', '是否有就业认知偏差'] },
      { title: '风险提示', items: ['调剂风险', '地域接受度', '学费和学制', '招生章程特殊要求'] },
    ]);
  });

  addSlide(pptx, 7, (s) => {
    title(s, '朋友圈转发文案', '适合家长转给身边同样需要的人。');
    card(pptx, s, 0.8, 1.55, 11.2, 3.1, { fill: C.dark, line: C.dark, shadow: false });
    s.addText('家里有高三孩子的，可以先用涨识做一份AI志愿分析报告。它会根据省份、科类、分数和偏好，整理冲稳保方向、院校专业建议和风险提示。报告仅供参考，最后一定要结合考试院和学校招生章程核对。', {
      x: 1.25, y: 2.16, w: 10.3, h: 1.16,
      fontSize: 18,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      fit: 'shrink',
    });
    card(pptx, s, 0.8, 5.15, 11.2, 0.62, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
    s.addText('配图建议：报告首页、冲稳保页面、风险提示页面、小程序码。', {
      x: 1.1, y: 5.37, w: 10.4, h: 0.16,
      fontSize: 11.5,
      color: C.teal,
      bold: true,
      align: 'center',
    });
  });

  addSlide(pptx, 8, (s) => {
    title(s, '微信群轻推荐文案', '适合发在高三家长群里，语气要克制。');
    twoColumns(pptx, s, [
      ['温和提醒', '志愿填报涉及院校、专业、城市、位次和风险，建议大家先做一份报告，把方向理出来。'],
      ['使用边界', 'AI报告不是最终答案，只适合初步参考，关键选择仍要核对官方信息。'],
      ['适合时机', '群里讨论分数段、专业选择、冲稳保怎么排的时候。'],
    ], [
      ['不要刷屏', '一天发一次就够，有人问再私聊。'],
      ['不要制造焦虑', '不说错过就来不及，不说保证结果。'],
      ['重点表达', '先看自己的报告，再判断是否需要继续追问。'],
    ]);
  });

  addSlide(pptx, 9, (s) => {
    title(s, '短视频选题建议', '普通家庭最关心的是“我家孩子怎么办”。');
    flowRows(pptx, s, [
      ['选题1', '别只问能上哪', '先看位次、专业组、城市偏好和调剂风险'],
      ['选题2', '出分前准备清单', '提前整理城市、专业、预算和不可接受项'],
      ['选题3', '怎么看冲稳保', '不是学校越多越好，梯度和风险更重要'],
      ['选题4', '专业避坑提醒', '不要只看名字，要看课程、就业和限制条件'],
    ]);
  });

  addSlide(pptx, 10, (s) => {
    title(s, '常见问题', '让家长先放心使用，再逐步深入。');
    twoColumns(pptx, s, [
      ['报告准确吗？', '报告基于输入信息和公开资料做辅助分析，不能替代官方志愿系统。'],
      ['没有分数能用吗？', '可以先用估分或目标分数看方向，出分后再重新生成。'],
      ['需要充值吗？', '新用户有默认赠点，是否充值取决于后续深度分析需求。'],
    ], [
      ['可以直接照着填吗？', '不建议。正式填报前必须核对考试院和高校招生章程。'],
      ['能问具体学校吗？', '可以在报告里继续追问某所学校或某个专业。'],
      ['适合低分段吗？', '适合。越是选择受限，越需要提前看清风险和梯度。'],
    ]);
  });

  addSlide(pptx, 11, (s) => {
    title(s, '合规提醒', '志愿填报是重要决策，任何工具都只能做辅助。');
    threeCards(pptx, s, [
      { title: '报告定位', items: ['辅助参考', '结构化初筛', '帮助发现问题', '不能替代官方系统'] },
      { title: '必须核对', items: ['考试院政策', '高校招生章程', '专业组要求', '学费和身体条件'] },
      { title: '不要相信', items: ['保证录取', '内部名额', '精准包中', '不看章程也能填'] },
    ]);
  });

  addSlide(pptx, 12, (s) => {
    title(s, '立即体验', '先生成一份自己的报告，再决定下一步怎么做。');
    card(pptx, s, 1.0, 1.65, 10.95, 2.7, { fill: C.dark, line: C.dark, shadow: false });
    s.addText('打开涨识小程序，进入AI高考志愿分析，填写孩子的省份、科类、分数和偏好，先看一份属于自己的志愿分析报告。', {
      x: 1.45, y: 2.45, w: 10.05, h: 0.62,
      fontSize: 22,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      fit: 'shrink',
    });
    card(pptx, s, 1.0, 5.15, 10.95, 0.72, { fill: C.softAmber, line: 'FDE68A', shadow: false });
    s.addText('提醒：最终志愿填报以各省考试院、招生计划和高校招生章程为准。', {
      x: 1.35, y: 5.39, w: 10.25, h: 0.18,
      fontSize: 12.5,
      bold: true,
      color: C.dark,
      align: 'center',
    });
  });

  await pptx.writeFile({ fileName: path.join(OUT_DIR, '推荐官：涨识_推广方法建议计划.pptx') });
}

function slideText(slide, heading, body, x, y, w) {
  slide.addText(heading, {
    x, y, w: 2.0, h: 0.22,
    fontSize: 14,
    bold: true,
    color: C.teal,
  });
  slide.addText(body, {
    x, y: y + 0.42, w, h: 0.44,
    fontSize: 17,
    bold: true,
    color: C.dark,
    fit: 'shrink',
  });
}

function twoColumns(pptx, slide, left, right) {
  card(pptx, slide, 0.75, 1.55, 5.55, 4.55, { fill: C.card });
  card(pptx, slide, 6.65, 1.55, 5.55, 4.55, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  left.forEach((item, idx) => {
    const y = 1.9 + idx * 1.22;
    slide.addText(item[0], {
      x: 1.08, y, w: 4.65, h: 0.22,
      fontSize: 13.5,
      bold: true,
      color: C.dark,
      fit: 'shrink',
    });
    slide.addText(item[1], {
      x: 1.08, y: y + 0.38, w: 4.7, h: 0.38,
      fontSize: 10.5,
      color: C.text,
      fit: 'shrink',
    });
  });
  right.forEach((item, idx) => {
    const y = 1.9 + idx * 1.22;
    slide.addText(item[0], {
      x: 6.98, y, w: 4.65, h: 0.22,
      fontSize: 13.5,
      bold: true,
      color: C.teal,
      fit: 'shrink',
    });
    slide.addText(item[1], {
      x: 6.98, y: y + 0.38, w: 4.7, h: 0.38,
      fontSize: 10.5,
      color: C.text,
      fit: 'shrink',
    });
  });
}

async function main() {
  await buildPartnerDeck();
  await buildReferrerDeck();
  await buildUserDeck();
  console.log('Generated recruitment PPTs in mkt/.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
