const pptxgen = require('pptxgenjs');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Zhangshi';
pptx.subject = '合伙人计划推广方案';
pptx.title = '涨识合伙人计划推广方案';
pptx.company = '涨识';
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
  teal2: '14B8A6',
  orange: 'D97706',
  amber: 'F59E0B',
  green: '16A34A',
  red: 'DC2626',
  blue: '2563EB',
  line: 'CBD5E1',
  card: 'FFFFFF',
  softTeal: 'ECFDF5',
  softOrange: 'FFF7ED',
  softBlue: 'EFF6FF',
  softAmber: 'FFFBEB',
};

function addBg(slide) {
  slide.background = { color: C.bg };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: C.bg }, line: { color: C.bg } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.08, fill: { color: C.teal }, line: { color: C.teal } });
}

function addFooter(slide, page) {
  slide.addText('涨识 · 合伙人计划推广方案', {
    x: 0.55, y: 7.1, w: 7.8, h: 0.2,
    fontFace: 'PingFang SC', fontSize: 8.5, color: C.muted,
  });
  slide.addText(String(page).padStart(2, '0'), {
    x: 12.2, y: 7.05, w: 0.55, h: 0.25,
    fontFace: 'Aptos', fontSize: 9, color: C.muted, align: 'right',
  });
}

function title(slide, text, sub) {
  slide.addText(text, {
    x: 0.58, y: 0.48, w: 8.8, h: 0.48,
    fontFace: 'PingFang SC', fontSize: 23, bold: true, color: C.dark,
    breakLine: false, fit: 'shrink',
  });
  if (sub) {
    slide.addText(sub, {
      x: 0.6, y: 1.02, w: 9.6, h: 0.28,
      fontSize: 10.5, color: C.muted,
    });
  }
}

function chip(slide, text, x, y, color = C.teal, fill = C.softTeal, w = 1.35) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.34,
    rectRadius: 0.08,
    fill: { color: fill },
    line: { color: fill },
  });
  slide.addText(text, { x, y: y + 0.07, w, h: 0.14, fontSize: 8.5, bold: true, color, align: 'center' });
}

function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: opts.fill || C.card },
    line: { color: opts.line || 'E2E8F0', transparency: 5 },
    shadow: opts.shadow === false ? undefined : { type: 'outer', color: 'CBD5E1', opacity: 0.12, blur: 1, angle: 45, distance: 1 },
  });
}

function bulletList(slide, items, x, y, w, opts = {}) {
  const runs = [];
  items.forEach((item, idx) => {
    runs.push({
      text: `${idx + 1}. ${item}\n`,
      options: {
        breakLine: false,
        hanging: 4,
      },
    });
  });
  slide.addText(runs, {
    x, y, w, h: opts.h || 2.6,
    fontSize: opts.fontSize || 13,
    color: opts.color || C.text,
    breakLine: false,
    fit: 'shrink',
    valign: 'top',
    paraSpaceAfterPt: opts.spaceAfter || 6,
  });
}

function simpleBullets(slide, items, x, y, w, h, fontSize = 12.5, color = C.text) {
  slide.addText(items.map((t) => ({ text: `• ${t}\n`, options: {} })), {
    x, y, w, h, fontSize, color, fit: 'shrink', breakLine: false, valign: 'top',
    paraSpaceAfterPt: 4,
  });
}

function kpi(slide, label, value, note, x, y, w, color = C.teal) {
  card(slide, x, y, w, 1.1);
  slide.addText(value, { x: x + 0.22, y: y + 0.16, w: w - 0.44, h: 0.32, fontSize: 22, bold: true, color });
  slide.addText(label, { x: x + 0.22, y: y + 0.56, w: w - 0.44, h: 0.2, fontSize: 10.5, bold: true, color: C.dark });
  if (note) slide.addText(note, { x: x + 0.22, y: y + 0.8, w: w - 0.44, h: 0.18, fontSize: 8.5, color: C.muted });
}

function addSlide(page, builder) {
  const slide = pptx.addSlide();
  addBg(slide);
  builder(slide);
  addFooter(slide, page);
  return slide;
}

addSlide(1, (s) => {
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: 'F7FBFA' }, line: { color: 'F7FBFA' } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.12, fill: { color: C.teal }, line: { color: C.teal } });
  chip(s, '合伙人计划', 0.72, 0.72, C.teal, C.softTeal, 1.45);
  s.addText('涨识合伙人计划推广方案', { x: 0.7, y: 1.25, w: 8.6, h: 0.75, fontSize: 31, bold: true, color: C.dark, fit: 'shrink' });
  s.addText('面向本地渠道、教育资源方、社群主理人的低成本共赢增长方案', { x: 0.72, y: 2.1, w: 7.4, h: 0.35, fontSize: 15, bold: true, color: C.teal, fit: 'shrink' });
  s.addText('核心路线：招募合伙人 + 合伙人发展推荐官 + 微信私域裂变 + 短视频搜索截流。用小程序报告建立信任，用推荐提成激励持续推广。', {
    x: 0.74, y: 2.72, w: 6.5, h: 0.8, fontSize: 14, color: C.text, breakLine: false, fit: 'shrink',
  });
  card(s, 8.15, 1.0, 3.95, 4.65, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  s.addText('合伙人适合谁', { x: 8.55, y: 1.45, w: 3.1, h: 0.28, fontSize: 13, bold: true, color: C.dark });
  simpleBullets(s, ['教培/复读机构', '本地教育号主', '高三家长群主', '打印店/照相馆', '升学规划老师'], 8.55, 1.95, 3.0, 1.9, 13, C.text);
  s.addShape(pptx.ShapeType.line, { x: 8.55, y: 4.18, w: 2.95, h: 0, line: { color: '99F6E4', width: 1.2 } });
  s.addText('一句话权益', { x: 8.55, y: 4.45, w: 2.8, h: 0.22, fontSize: 11, bold: true, color: C.teal });
  s.addText('合伙人分享小程序并组织推广，用户充值后获得推荐提成和团队推荐收益。', { x: 8.55, y: 4.78, w: 2.95, h: 0.5, fontSize: 12, color: C.dark, fit: 'shrink' });
  s.addText('2026.05', { x: 0.75, y: 6.7, w: 1.2, h: 0.2, fontSize: 10, color: C.muted });
});

addSlide(2, (s) => {
  title(s, '什么是合伙人计划', '系统内部对应原“特邀合作伙伴”身份，面向有本地教育资源和社群触达能力的人。');
  card(s, 0.7, 1.55, 3.55, 3.95, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  s.addText('合伙人做什么', { x: 1.0, y: 1.9, w: 1.8, h: 0.24, fontSize: 15, bold: true, color: C.teal });
  simpleBullets(s, ['分享小程序给高三家长', '组织微信群/讲座/本地触点', '发展推荐官一起推广', '帮助家长先生成志愿分析报告'], 1.0, 2.42, 2.75, 1.65, 12.5);
  card(s, 4.75, 1.55, 3.55, 3.95, { fill: C.card });
  s.addText('合伙人不是做什么', { x: 5.05, y: 1.9, w: 2.1, h: 0.24, fontSize: 15, bold: true, color: C.red });
  simpleBullets(s, ['不承诺录取结果', '不说内部数据', '不冒充官方渠道', '不做高价恐吓式成交'], 5.05, 2.42, 2.75, 1.65, 12.5);
  card(s, 8.8, 1.55, 3.55, 3.95, { fill: C.softOrange, line: 'FED7AA', shadow: false });
  s.addText('平台提供什么', { x: 9.1, y: 1.9, w: 1.8, h: 0.24, fontSize: 15, bold: true, color: C.orange });
  simpleBullets(s, ['小程序工具和报告能力', '邀请码追踪', '佣金统计和提现', '后台可配置奖励规则'], 9.1, 2.42, 2.75, 1.65, 12.5);
  s.addText('一句话：合伙人负责本地信任和流量，涨识负责工具、内容承接、订单追踪和佣金结算。', { x: 0.9, y: 6.0, w: 10.9, h: 0.25, fontSize: 14, bold: true, color: C.dark });
});

addSlide(3, (s) => {
  title(s, '合伙人能得到什么好处', '重点不是一次性卖货，而是把本地教育资源变成可持续收益。');
  kpi(s, '直属用户首充提成', '40%', '用户通过合伙人邀请码充值', 0.7, 1.55, 2.65, C.teal);
  kpi(s, '团队首充差额收益', '20%', '推荐官成交时合伙人拿差额', 3.7, 1.55, 2.65, C.orange);
  kpi(s, '复充差额收益', '5%', '180天内复充，当前已开启', 6.7, 1.55, 2.65, C.blue);
  kpi(s, '提现方式', '微信零钱', '后台审核后商家转账', 9.7, 1.55, 2.65, C.green);
  card(s, 0.85, 3.35, 5.3, 2.15, { fill: C.card });
  s.addText('为什么适合合伙人', { x: 1.15, y: 3.68, w: 2.3, h: 0.25, fontSize: 15, bold: true, color: C.dark });
  simpleBullets(s, ['不需要开发产品', '不需要囤货和交付复杂服务', '只要有家长触达和本地信任', '收益可通过邀请码自动追踪'], 1.15, 4.12, 4.35, 1.0, 12);
  card(s, 6.65, 3.35, 5.3, 2.15, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  s.addText('后台可配置', { x: 6.95, y: 3.68, w: 1.6, h: 0.25, fontSize: 15, bold: true, color: C.teal });
  simpleBullets(s, ['首充比例、复充比例、有效期可调整', '不同合伙人可配置新用户赠点策略', '佣金流水、提现记录后台可查'], 6.95, 4.12, 4.35, 0.9, 12);
});

addSlide(4, (s) => {
  title(s, '合伙人收益怎么产生', '当前规则示例：合伙人总比例40%，推荐官比例20%，复充180天内继续低佣结算。');
  const flows = [
    ['A. 合伙人直接推荐家长', '家长通过合伙人邀请码进入小程序并充值', '合伙人获得该笔首充40%推荐提成'],
    ['B. 推荐官推荐家长', '推荐官归属于某个合伙人，家长充值', '推荐官拿20%，合伙人拿差额20%'],
    ['C. 家长后续复充', '180天内再次充值，按复充比例结算', '推荐官拿5%，合伙人拿差额5%'],
  ];
  flows.forEach((f, i) => {
    const y = 1.55 + i * 1.55;
    card(s, 0.75, y, 11.25, 1.08, { fill: i === 1 ? C.softOrange : C.card, line: i === 1 ? 'FED7AA' : 'E2E8F0', shadow: false });
    s.addText(f[0], { x: 1.05, y: y + 0.18, w: 2.7, h: 0.22, fontSize: 13.5, bold: true, color: i === 1 ? C.orange : C.teal });
    s.addText(f[1], { x: 3.95, y: y + 0.22, w: 4.2, h: 0.18, fontSize: 11.2, color: C.text, fit: 'shrink' });
    s.addText(f[2], { x: 8.35, y: y + 0.18, w: 3.05, h: 0.22, fontSize: 12.2, bold: true, color: C.dark, fit: 'shrink' });
  });
  s.addText('注意：具体比例以后台配置为准；以上为当前服务器配置，适合对外招商时作为示例展示。', { x: 0.9, y: 6.25, w: 10.4, h: 0.22, fontSize: 11, color: C.muted });
});

addSlide(5, (s) => {
  title(s, '为什么合伙人更容易推广涨识', '高考志愿是强需求、短窗口、高焦虑场景，家长天然愿意先试一份报告。');
  card(s, 0.75, 1.6, 3.4, 3.7, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  s.addText('低决策门槛', { x: 1.05, y: 1.95, w: 1.8, h: 0.24, fontSize: 16, bold: true, color: C.teal });
  simpleBullets(s, ['不是一上来卖高价咨询', '先让家长生成报告', '看得见内容再付费'], 1.05, 2.5, 2.55, 1.1, 13);
  card(s, 4.95, 1.6, 3.4, 3.7, { fill: C.softOrange, line: 'FED7AA', shadow: false });
  s.addText('强本地信任', { x: 5.25, y: 1.95, w: 1.8, h: 0.24, fontSize: 16, bold: true, color: C.orange });
  simpleBullets(s, ['家长更信熟人推荐', '微信群传播效率高', '线下触点容易成交'], 5.25, 2.5, 2.55, 1.1, 13);
  card(s, 9.15, 1.6, 3.4, 3.7, { fill: C.softBlue, line: 'BFDBFE', shadow: false });
  s.addText('可持续收益', { x: 9.45, y: 1.95, w: 1.8, h: 0.24, fontSize: 16, bold: true, color: C.blue });
  simpleBullets(s, ['首充有提成', '复充有低佣', '团队推荐官可扩张'], 9.45, 2.5, 2.55, 1.1, 13);
});

addSlide(6, (s) => {
  title(s, '合伙人招募话术', '给潜在合伙人的表达要简单、直接、利益清晰。');
  card(s, 0.85, 1.55, 10.8, 1.5, { fill: C.dark, line: C.dark, shadow: false });
  s.addText('你有本地高三家长资源，我们提供小程序工具、志愿分析报告和佣金结算。家长通过你的邀请码充值后，你可以获得推荐提成；你发展推荐官，也可以获得团队差额收益。', {
    x: 1.2, y: 2.0, w: 10.1, h: 0.45, fontSize: 16, bold: true, color: 'FFFFFF', align: 'center', fit: 'shrink',
  });
  card(s, 0.9, 3.75, 5.05, 1.8, { fill: C.card });
  s.addText('适合邀请谁', { x: 1.2, y: 4.05, w: 1.5, h: 0.22, fontSize: 14, bold: true, color: C.dark });
  simpleBullets(s, ['教育机构负责人', '本地教育公众号/视频号', '高三家长群群主', '复读学校/艺考机构资源方'], 1.2, 4.45, 4.0, 0.8, 11.5);
  card(s, 6.45, 3.75, 5.05, 1.8, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  s.addText('招商承诺边界', { x: 6.75, y: 4.05, w: 1.8, h: 0.22, fontSize: 14, bold: true, color: C.teal });
  simpleBullets(s, ['讲收益规则，不夸大收益', '讲辅助参考，不承诺录取', '讲公开数据，不说内部渠道'], 6.75, 4.45, 4.0, 0.8, 11.5);
});

addSlide(7, (s) => {
  title(s, '为什么现在必须开始蓄水', '高考前后流量窗口很短，信任需要提前建立。');
  kpi(s, '全国统考', '6月7-8日', '考前蓄水，考后转化', 0.62, 1.65, 2.2, C.teal);
  kpi(s, '爆发窗口', '出分前后', '估分、查分、填报焦虑集中释放', 3.08, 1.65, 2.55, C.orange);
  kpi(s, '核心人群', '下沉家长', '二三四线、县城、城镇', 5.9, 1.65, 2.5, C.blue);
  kpi(s, '最优路径', '信任转化', '熟人推荐优先于冷广告', 8.65, 1.65, 2.5, C.green);
  card(s, 0.62, 3.25, 10.55, 2.3, { fill: C.card });
  s.addText('阶段判断', { x: 0.95, y: 3.55, w: 1.4, h: 0.24, fontSize: 14, bold: true, color: C.dark });
  simpleBullets(s, [
    '现在到考前：主要任务不是成交，而是进入家长微信群、朋友圈和本地信任网络。',
    '考后到出分：家长开始焦虑，内容重点从政策避坑转向估分和方向选择。',
    '出分到填报：转化效率最高，必须让家长快速扫码、快速生成报告、快速咨询。',
  ], 0.95, 3.95, 9.8, 1.25, 13, C.text);
});

addSlide(8, (s) => {
  title(s, '目标用户画像', '不要按一线城市高客单打法做，先击中普通家庭的真实焦虑。');
  const xs = [0.7, 3.55, 6.4, 9.25];
  const heads = ['地域', '心理', '决策', '支付'];
  const lines = [
    ['二三四线城市', '县城/城镇家庭', '信息差明显'],
    ['怕填错志愿', '怕浪费分数', '怕被高价机构割'],
    ['信熟人', '信群主/老师', '需要看见结果'],
    ['愿意小额试用', '先看报告', '再决定深度服务'],
  ];
  xs.forEach((x, i) => {
    card(s, x, 1.65, 2.45, 3.5, { fill: i % 2 ? C.softOrange : C.softTeal, line: i % 2 ? 'FED7AA' : 'CCFBF1', shadow: false });
    s.addText(heads[i], { x: x + 0.25, y: 1.95, w: 1.8, h: 0.3, fontSize: 18, bold: true, color: i % 2 ? C.orange : C.teal });
    simpleBullets(s, lines[i], x + 0.25, 2.55, 1.9, 1.6, 12.5, C.dark);
  });
  s.addText('关键词：普通家长、低门槛、先体验、看得懂、能转发。', { x: 0.75, y: 5.75, w: 8, h: 0.3, fontSize: 15, bold: true, color: C.dark });
});

addSlide(9, (s) => {
  title(s, '一句话卖点', '不要先卖“AI系统”，先卖“看得懂的志愿参考”。');
  card(s, 0.7, 1.55, 11.8, 1.25, { fill: C.dark, line: C.dark, shadow: false });
  s.addText('先免费/低成本生成一份孩子的志愿分析参考，看看分数大概能冲哪些、稳哪些、保哪些。', {
    x: 1.0, y: 1.95, w: 10.9, h: 0.32, fontSize: 18, bold: true, color: 'FFFFFF', align: 'center', fit: 'shrink',
  });
  card(s, 0.7, 3.25, 5.65, 2.15, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  card(s, 6.85, 3.25, 5.65, 2.15, { fill: C.softAmber, line: 'FDE68A', shadow: false });
  s.addText('应该说', { x: 1.05, y: 3.58, w: 1.2, h: 0.24, fontSize: 14, bold: true, color: C.green });
  simpleBullets(s, ['公开数据辅助参考', '先看初版分析', '冲稳保思路', '适合家长先做判断'], 1.05, 3.98, 4.7, 1.0, 12.5);
  s.addText('不要说', { x: 7.2, y: 3.58, w: 1.2, h: 0.24, fontSize: 14, bold: true, color: C.red });
  simpleBullets(s, ['保录取', '内部数据', '官方合作', '精准包中'], 7.2, 3.98, 4.7, 1.0, 12.5);
});

addSlide(10, (s) => {
  title(s, '增长飞轮', '用内容获信任，用合作人扩散，用报告完成转化。');
  const steps = [
    ['内容种草', '短视频/朋友圈讲一个痛点'],
    ['私域沉淀', '扫码进群/关注/收藏小程序'],
    ['报告体验', '输入省份、分数、位次生成分析'],
    ['付费转化', '充值点数/深度分析'],
    ['推荐裂变', '家长分享，合作人拿奖励'],
  ];
  steps.forEach((it, idx) => {
    const x = 0.7 + idx * 2.45;
    card(s, x, 2.0, 1.95, 1.55, { fill: idx % 2 ? C.softOrange : C.softTeal, line: idx % 2 ? 'FED7AA' : 'CCFBF1', shadow: false });
    s.addText(String(idx + 1), { x: x + 0.2, y: 2.18, w: 0.35, h: 0.25, fontSize: 13, bold: true, color: idx % 2 ? C.orange : C.teal });
    s.addText(it[0], { x: x + 0.2, y: 2.55, w: 1.5, h: 0.28, fontSize: 14, bold: true, color: C.dark });
    s.addText(it[1], { x: x + 0.2, y: 2.95, w: 1.48, h: 0.34, fontSize: 9.5, color: C.text, fit: 'shrink' });
    if (idx < steps.length - 1) {
      s.addShape(pptx.ShapeType.chevron, { x: x + 1.98, y: 2.52, w: 0.33, h: 0.44, fill: { color: C.line }, line: { color: C.line } });
    }
  });
  card(s, 0.85, 4.8, 10.6, 0.65, { fill: C.card });
  s.addText('飞轮关键：每个合作人都有邀请码，每个家长都有可转发的报告或小程序入口。', { x: 1.12, y: 5.02, w: 9.9, h: 0.18, fontSize: 12.5, bold: true, color: C.dark });
});

addSlide(11, (s) => {
  title(s, '渠道一：本地合作人', '最低成本、最高信任的第一增长渠道。');
  const people = [
    ['高三家长群群主', '负责拉群和转发'],
    ['教培/复读老师', '有精准学生和家长'],
    ['打印店/照相馆', '高考季天然触点'],
    ['本地教育号主', '有本地家长信任'],
    ['升学规划小机构', '缺工具但有客户'],
  ];
  people.forEach((p, i) => {
    const x = i < 3 ? 0.7 + i * 4.05 : 2.72 + (i - 3) * 4.05;
    const y = i < 3 ? 1.55 : 3.65;
    card(s, x, y, 3.4, 1.35, { fill: C.card });
    s.addText(p[0], { x: x + 0.25, y: y + 0.25, w: 2.75, h: 0.22, fontSize: 13, bold: true, color: C.dark });
    s.addText(p[1], { x: x + 0.25, y: y + 0.72, w: 2.75, h: 0.2, fontSize: 10.5, color: C.muted });
  });
  s.addText('合作话术：你不用懂系统，只要把小程序分享给高三家长，家长充值后你有推荐奖励。', { x: 0.78, y: 5.85, w: 10.9, h: 0.25, fontSize: 14, bold: true, color: C.teal });
});

addSlide(12, (s) => {
  title(s, '渠道二：短视频搜索截流', '不追求爆款，追求高频覆盖家长正在搜的问题。');
  card(s, 0.7, 1.55, 5.7, 4.35, { fill: C.card });
  s.addText('标题模板', { x: 1.0, y: 1.88, w: 2.0, h: 0.25, fontSize: 15, bold: true, color: C.dark });
  simpleBullets(s, [
    '2026高考，500分左右怎么填志愿？',
    '县城家长最容易踩的3个志愿坑',
    '不要只看分数，一定要看位次',
    '低分想上公办本科，先看这几个思路',
    '分数尴尬，冲稳保怎么排？',
  ], 1.0, 2.35, 4.85, 2.4, 12.5);
  card(s, 6.85, 1.55, 5.3, 4.35, { fill: C.softBlue, line: 'BFDBFE', shadow: false });
  s.addText('发布节奏', { x: 7.18, y: 1.88, w: 2.0, h: 0.25, fontSize: 15, bold: true, color: C.blue });
  simpleBullets(s, ['每天3条，连续30天', '视频号、抖音、小红书同步发', '每条只讲一个痛点，不讲大而全', '结尾统一引导：微信搜“涨识”小程序'], 7.18, 2.35, 4.3, 2.0, 12.5);
});

addSlide(13, (s) => {
  title(s, '渠道三：微信群私域', '微信群不是卖货群，是持续降低家长决策成本的地方。');
  const names = ['2026高考志愿填报避坑群', '某某省2026高考家长交流群', '500-550分志愿参考群', '艺术生志愿填报交流群'];
  names.forEach((n, i) => {
    card(s, 0.75 + (i % 2) * 5.65, 1.62 + Math.floor(i / 2) * 1.18, 5.0, 0.78, { fill: i % 2 ? C.softOrange : C.softTeal, line: i % 2 ? 'FED7AA' : 'CCFBF1', shadow: false });
    s.addText(n, { x: 1.05 + (i % 2) * 5.65, y: 1.86 + Math.floor(i / 2) * 1.18, w: 4.2, h: 0.18, fontSize: 13, bold: true, color: C.dark });
  });
  card(s, 0.75, 4.45, 11.0, 1.2, { fill: C.card });
  s.addText('群运营日课：每天发1条高价值内容 + 1次温和引导', { x: 1.05, y: 4.78, w: 7.0, h: 0.24, fontSize: 14, bold: true, color: C.dark });
  s.addText('案例截图 / 专业避坑 / 院校误区 / 政策提醒 / 报告样例', { x: 1.05, y: 5.15, w: 8.0, h: 0.18, fontSize: 11, color: C.muted });
});

addSlide(14, (s) => {
  title(s, '渠道四：线下小讲座', '低成本制造信任，现场扫码完成初步转化。');
  card(s, 0.7, 1.5, 3.45, 3.9, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  s.addText('主题', { x: 1.0, y: 1.85, w: 0.8, h: 0.22, fontSize: 13, bold: true, color: C.teal });
  s.addText('2026高考志愿填报，家长最容易踩的10个坑', { x: 1.0, y: 2.28, w: 2.7, h: 0.78, fontSize: 18, bold: true, color: C.dark, fit: 'shrink' });
  simpleBullets(s, ['打印店', '教培教室', '社区会议室', '茶室/书店'], 1.0, 3.45, 2.4, 1.1, 12);
  card(s, 4.55, 1.5, 6.95, 3.9, { fill: C.card });
  s.addText('现场流程', { x: 4.92, y: 1.85, w: 1.2, h: 0.22, fontSize: 13, bold: true, color: C.dark });
  bulletList(s, ['30分钟讲志愿避坑', '现场扫码进小程序', '每个家长生成初步报告', '需要深入分析再充值'], 4.92, 2.32, 5.6, { h: 2.2, fontSize: 14 });
});

addSlide(15, (s) => {
  title(s, '时间表', '按高考节奏推进，不同阶段只做最该做的事。');
  const rows = [
    ['5月23日-6月6日', '蓄水期', '找合作人、建群、发避坑内容、铺小程序入口'],
    ['6月7日-6月15日', '焦虑升温', '估分方向、专业选择、城市选择、准备材料'],
    ['出分前后', '集中转化', '分数段案例、冲稳保、报告生成、付费分析'],
    ['填报期间', '强服务期', '群答疑、直播、提醒确认、提高复购和转介绍'],
  ];
  rows.forEach((r, i) => {
    const y = 1.55 + i * 1.15;
    card(s, 0.7, y, 11.2, 0.85, { fill: i % 2 ? C.card : C.softTeal, line: i % 2 ? 'E2E8F0' : 'CCFBF1', shadow: false });
    s.addText(r[0], { x: 1.0, y: y + 0.26, w: 2.1, h: 0.18, fontSize: 11, bold: true, color: C.teal });
    s.addText(r[1], { x: 3.35, y: y + 0.24, w: 1.25, h: 0.2, fontSize: 13, bold: true, color: C.dark });
    s.addText(r[2], { x: 4.85, y: y + 0.25, w: 6.45, h: 0.18, fontSize: 11.5, color: C.text, fit: 'shrink' });
  });
});

addSlide(16, (s) => {
  title(s, '7天启动清单', '不用等完美，先把最低成本动作跑起来。');
  const left = ['做1张扫码海报', '准备10条朋友圈文案', '准备15条短视频脚本', '建立2个家长群', '联系20个本地合作人'];
  const right = ['给合作人分邀请码', '每天发3条短视频', '每天群内发1条干货', '收集10个报告截图案例', '记录每个渠道转化'];
  card(s, 0.75, 1.52, 5.15, 4.55, { fill: C.card });
  card(s, 6.25, 1.52, 5.15, 4.55, { fill: C.card });
  s.addText('第1-3天', { x: 1.08, y: 1.86, w: 1.3, h: 0.24, fontSize: 15, bold: true, color: C.orange });
  simpleBullets(s, left, 1.08, 2.35, 4.25, 2.6, 13);
  s.addText('第4-7天', { x: 6.58, y: 1.86, w: 1.3, h: 0.24, fontSize: 15, bold: true, color: C.teal });
  simpleBullets(s, right, 6.58, 2.35, 4.25, 2.6, 13);
});

addSlide(17, (s) => {
  title(s, '风险边界与合规话术', '教育类推广要稳，避免虚假承诺和高风险表达。');
  card(s, 0.75, 1.5, 5.2, 4.3, { fill: C.softAmber, line: 'FDE68A', shadow: false });
  s.addText('禁用表达', { x: 1.05, y: 1.84, w: 1.4, h: 0.24, fontSize: 15, bold: true, color: C.red });
  simpleBullets(s, ['保录取/包上岸', '内部数据/官方合作', '精准预测/必中', '制造恐慌式高价转化'], 1.05, 2.35, 4.2, 1.9, 13);
  card(s, 6.3, 1.5, 5.2, 4.3, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  s.addText('推荐表达', { x: 6.6, y: 1.84, w: 1.4, h: 0.24, fontSize: 15, bold: true, color: C.green });
  simpleBullets(s, ['公开数据辅助参考', '帮助家长理解位次和冲稳保', '最终以官方志愿系统为准', '先体验，再选择是否深入分析'], 6.6, 2.35, 4.2, 1.9, 13);
});

addSlide(18, (s) => {
  title(s, '衡量指标', '低成本推广一定要看数据，否则很容易忙但没结果。');
  const metrics = [
    ['合作人', '新增合作人数/有效分享人数'],
    ['私域', '进群人数/活跃提问人数'],
    ['内容', '视频搜索曝光/私信/扫码'],
    ['产品', '报告生成数/充值转化率'],
    ['收益', '单个合作人成交额/佣金成本'],
  ];
  metrics.forEach((m, i) => {
    const x = 0.75 + (i % 3) * 3.75;
    const y = i < 3 ? 1.7 : 3.65;
    card(s, x, y, 3.25, 1.25, { fill: C.card });
    s.addText(m[0], { x: x + 0.25, y: y + 0.25, w: 1.5, h: 0.24, fontSize: 15, bold: true, color: C.teal });
    s.addText(m[1], { x: x + 0.25, y: y + 0.72, w: 2.55, h: 0.2, fontSize: 10.5, color: C.muted, fit: 'shrink' });
  });
  s.addText('每晚复盘：哪个渠道带来的报告最多，哪个渠道带来的充值最多，第二天就加倍投入。', { x: 0.8, y: 5.72, w: 10.3, h: 0.25, fontSize: 13.5, bold: true, color: C.dark });
});

addSlide(19, (s) => {
  title(s, '最终结论', '先跑最短闭环，再扩大投入。');
  card(s, 0.9, 1.7, 10.9, 2.25, { fill: C.dark, line: C.dark, shadow: false });
  s.addText('内容让家长知道你，熟人让家长信你，小程序报告让家长转化。', {
    x: 1.35, y: 2.42, w: 9.9, h: 0.42, fontSize: 24, bold: true, color: 'FFFFFF', align: 'center', fit: 'shrink',
  });
  card(s, 2.0, 4.7, 8.8, 0.72, { fill: C.softTeal, line: 'CCFBF1', shadow: false });
  s.addText('先用7天验证：20个合作人 + 30条内容 + 2个家长群 + 100份报告生成。', {
    x: 2.35, y: 4.94, w: 8.1, h: 0.18, fontSize: 12.5, bold: true, color: C.teal, align: 'center',
  });
});

pptx.writeFile({ fileName: '涨识_合伙人计划推广方案.pptx' });
