import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { config } from '../config';
import { deductPoints } from './points.service';
import { AppError } from '../middleware/errorHandler';
import { createLogger } from '../utils/logger';
import { redisGet, redisSet } from '../utils/redis';
import { getPointSettings } from './point-config.service';

const logger = createLogger('ai');

// AI 响应缓存 TTL（秒）
const CACHE_TTL_NORMAL = 30 * 60;  // 普通问答 30 分钟
const CACHE_TTL_DEEP = 60 * 60;    // 深度分析 60 分钟

export interface ConsultParams {
  userId: string;
  question: string;
  channel: 'miniprogram' | 'mp_public';
  type?: 'normal' | 'deep';
  sessionId?: string;
  context?: string; // 用户填写的个人资料/背景
  isAnonymous?: boolean; // 未登录用户跳过扣点
}

type ConsultType = 'normal' | 'deep';

interface ConsultResult {
  answer: string;
  pointsCost: number;
  model: string;
  sessionId: string;
}

interface StreamConsultResult {
  stream: ReadableStream;
  pointsCost: number;
  model: string;
  sessionId: string;
}

// 读取后台 AI 配置
async function getAiConfig() {
  let aiConfig = await prisma.aiConfig.findFirst();
  if (!aiConfig) {
    const pointSettings = await getPointSettings();
    // 使用默认配置
    aiConfig = await prisma.aiConfig.create({
      data: {
        model: 'deepseek-chat',
        temperature: 0.7,
        maxTokens: 2000,
        topP: 0.9,
        contextWindow: 10,
        skillEnabled: true,
        skillWeight: 0.6,
        pointsPerQuery: pointSettings.defaultCost,
        pointsPerDeep: pointSettings.deepAnalysisCost,
      },
    });
  }
  return aiConfig;
}

// 解析 API 凭证：DB 配置优先，留空时回退环境变量
function resolveApiCredentials(aiConfig: any) {
  return {
    apiKey: (aiConfig.apiKey && aiConfig.apiKey.trim())
      ? aiConfig.apiKey
      : config.deepseek.apiKey,
    baseUrl: (aiConfig.apiBaseUrl && aiConfig.apiBaseUrl.trim())
      ? aiConfig.apiBaseUrl
      : config.deepseek.baseUrl,
    timeout: aiConfig.timeout || 30000,
  };
}

function normalizeAiTimeout(type: ConsultType, configured?: number | null) {
  const base = Number(configured || 30000);
  return type === 'deep' ? Math.max(base, 90000) : Math.max(base, 45000);
}

const PUBLIC_FIGURE_TERM = ['张', '雪', '峰'].join('');
const PUBLIC_FIGURE_SHORT_TERM = ['雪', '峰'].join('');
const FIXED_NOTICE_TITLE = ['免', '责', '声', '明'].join('');
const OUTPUT_CLEANUP_TERMS = [
  '非本人观点',
  '公开言论',
  '风格启发',
  '复刻',
  '本人观点',
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 加载默认 Skill
async function getDefaultSkill(): Promise<any | null> {
  return prisma.skill.findFirst({
    where: { isDefault: true, status: 'enabled' },
  });
}

// 加载 Skill 知识库（检索相关知识点）
async function retrieveKnowledge(question: string, aiConfig: any, skillKeywords?: string[]): Promise<string> {
  if (!aiConfig.skillEnabled) return '';

  try {
    // TODO: 对接 ChromaDB / 向量数据库进行语义检索
    const keywords = skillKeywords?.length ? skillKeywords : extractKeywords(question);

    // 从知识库检索（结构化参考资料，优先）
    const knowledgeEntries = await prisma.knowledgeEntry.findMany({
      where: {
        status: 'published',
        OR: keywords.map(kw => ({
          OR: [
            { title: { contains: kw } },
            { content: { contains: kw } },
            { tags: { contains: kw } },
          ],
        })),
      },
      take: 5,
      orderBy: { viewCount: 'desc' },
    });

    // 从干货文库检索（补充）
    const articles = await prisma.article.findMany({
      where: {
        status: 'published',
        OR: keywords.map(kw => ({
          OR: [
            { title: { contains: kw } },
            { content: { contains: kw } },
          ],
        })),
      },
      take: 2,
      orderBy: { viewCount: 'desc' },
    });

    if (knowledgeEntries.length === 0 && articles.length === 0) return '';

    let block = '';
    if (knowledgeEntries.length > 0) {
      block += `\n【参考知识库】\n${knowledgeEntries.map(e =>
        `- [${e.category}] ${e.title}: ${e.content.slice(0, 300)}`
      ).join('\n')}`;
    }
    if (articles.length > 0) {
      block += `\n【相关文章】\n${articles.map(a =>
        `- ${a.title}: ${a.content.slice(0, 200)}`
      ).join('\n')}`;
    }
    return block;
  } catch (err) {
    logger.error('知识库检索失败: %s', (err as Error)?.message || String(err));
    return '';
  }
}

// 提取问题关键词
function extractKeywords(question: string): string[] {
  const keywordList = [
    '高考', '志愿', '分数线', '大学', '专业', '211', '985', '双一流',
    '考研', '复试', '调剂', '学硕', '专硕', '院校', '导师',
    '计算机', '金融', '医学', '法学', '土木', '机械', '电气',
    '文科', '理科', '工科', '就业', '考公', '考编', '避坑',
  ];

  return keywordList.filter(kw => question.includes(kw));
}

// 构建 System Prompt
function buildSystemPrompt(knowledge: string, context?: string, type: ConsultType = 'normal'): string {
  const mode = type === 'deep'
    ? `\n\n回答模式：深度分析。请先给结论，再分层拆解依据、风险、可执行步骤。回答要更完整，适合择校、专业取舍、院校对比和志愿风险判断。`
    : `\n\n回答模式：普通问答。请直接回答核心问题，少铺垫，控制篇幅，适合快速解释和方向判断。`;
  const base = `你是赛博张老师，涨识小程序里的高考志愿填报、考研规划、职业规划 AI 咨询专家。
你的回答要直接、接地气、讲依据，用大白话讲清楚复杂的升学问题。

核心原则：
1. 用最直白的话说清楚利弊，不要官方套话
2. 该劝退就劝退，该推荐就推荐，态度鲜明
3. 用具体案例和数据说话，少讲空道理
4. 不要添加固定风险提示段落；如果确实存在不确定数据，只在对应结论里说明需要核验
5. 严禁提及、模仿或暗示任何真实公众人物、教育博主、网红老师及其风格
6. 严禁输出话题标签、营销口号、版权说明或类似开场标题
7. 如果用户提供了背景信息，必须优先使用其中的考生省份、科类/选科、分数、位次、目标城市/省份、偏好专业和规避专业；不要再假设这些信息缺失
8. 注意排版：先给结论，再分段说明；每个要点单独换行，长段落不要挤成一整块

${mode}
${context ? `用户提供的背景信息：${context}` : ''}
${knowledge ? `以下为相关参考知识，请结合回答：${knowledge}` : ''}`;

  return base;
}

function hasUnsafeSkillPrompt(systemPrompt?: string | null) {
  return [PUBLIC_FIGURE_TERM, FIXED_NOTICE_TITLE, ...OUTPUT_CLEANUP_TERMS].some(term =>
    (systemPrompt || '').includes(term)
  );
}

function sanitizeSkillPrompt(systemPrompt = '') {
  return systemPrompt
    .replace(new RegExp(`${escapeRegExp(PUBLIC_FIGURE_TERM)}老师`, 'g'), '真实教育行业案例')
    .replace(new RegExp(escapeRegExp(PUBLIC_FIGURE_TERM), 'g'), '真实教育行业案例')
    .replace(new RegExp(escapeRegExp(PUBLIC_FIGURE_SHORT_TERM), 'g'), '赛博张老师')
    .replace(/(?:基于|受|融合|参考)?[^。\n]*(?:公开言论|风格启发|思维风格研究|非本人观点|本人观点|复刻)[^。\n]*[。\n]?/g, '')
    .replace(new RegExp(escapeRegExp(FIXED_NOTICE_TITLE), 'g'), '内容边界')
    .replace(/[^。\n]{0,20}已于2026年3月24日去世[^。\n]*[。\n]?/g, '')
    .replace(/2026年3月24日[^。\n]*(?:去世|离世|猝死)[^。\n]*[。\n]?/g, '')
    .replace(/以他的精神继续服务更多家庭/g, '持续服务更多家庭')
    .replace(/人物时间线（关键节点）/g, '方法论时间线（关键节点）')
    .replace(/最新动态（2026）/g, '当前更新机制')
    .replace(/智识谱系/g, '方法来源')
    .replace(/调研时间：[^。\n]*[。\n]?/g, '')
    .replace(/一手来源（真实公众人物直接产出）/g, '优先资料')
    .replace(/二手来源（他人分析）/g, '辅助资料')
    .replace(/关键引用[\s\S]*$/g, '输出要求：资料不足时说明缺口；不编造精确数据；不把个案当规律。')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeAiOutput(content = '') {
  const cleaned = content
    .replace(/^[#＃]+\s*[^\n#＃]{0,12}上线[！!。.\s]*$/gm, '')
    .replace(/(?:^|\n)\s*第三方\s*AI\s*服务[^。！？!?；;\n]*(?:异常|不可用|失败)[^。！？!?；;\n]*[。！？!?；;]?\s*/g, '\n')
    .replace(new RegExp(`^[#＃]{1,6}\\s*(?:${escapeRegExp(FIXED_NOTICE_TITLE)}|温馨提醒|重要声明)\\s*$`, 'gm'), '')
    .replace(/📌\s*温馨提醒[:：][\s\S]*?(?=\n{2,}|$)/g, '')
    .replace(new RegExp(`(?:^|\\n)\\s*${escapeRegExp(FIXED_NOTICE_TITLE)}[:：][\\s\\S]*?(?=\\n{2,}|$)`, 'g'), '\n')
    .replace(/(?:^|\n)\s*重要声明[:：][\s\S]*?(?=\n{2,}|$)/g, '\n')
    .replace(new RegExp(`[^。！？!?；;\\n]*${escapeRegExp(PUBLIC_FIGURE_TERM)}[^。！？!?；;\\n]*[。！？!?；;]?`, 'g'), '')
    .replace(/[^。！？!?；;\n]*(?:公开言论启发|风格启发|非本人观点|本人观点|复刻)[^。！？!?；;\n]*[。！？!?；;]?/g, '')
    .replace(/我是AI助手赛博张老师[^。！？!?；;\n]*[。！？!?；;]?/g, '')
    .replace(/本回答内容由AI生成，仅作参考，不构成升学决策唯一依据。?建议结合实际情况，多方查证后做决定。?/g, '')
    .replace(/本回答仅作参考，不构成升学决策唯一依据。?/g, '')
    .replace(/仅供参考，不构成[^。！？!?；;\n]*[。！？!?；;]?/g, '')
    .replace(/\n{3,}/g, '\n\n');
  return normalizeAnswerLayout(cleaned).trim();
}

function normalizeAnswerLayout(content = '') {
  const text = content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/([。！？!?])\s*(\d+[.、]\s*)/g, '$1\n$2')
    .replace(/([。！？!?])\s*([一二三四五六七八九十]+[、.]\s*)/g, '$1\n$2')
    .replace(/([。！？!?])\s*(第[一二三四五六七八九十\d]+[点，、.])/g, '$1\n$2')
    .replace(/([。！？!?])\s*(建议你这样看|建议这样判断|放志愿时的用法|风险点|下一步|最后一句话|第二句话|第三句话)/g, '$1\n$2')
    .replace(/\n{3,}/g, '\n\n');

  return text
    .split('\n')
    .flatMap(line => splitLongAnswerLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

function splitLongAnswerLine(line: string) {
  const raw = line.trim();
  if (raw.length <= 96 || /^#{1,6}\s/.test(raw) || /^[-*]\s/.test(raw) || /^\d+[.、]\s/.test(raw)) {
    return [line];
  }
  const sentences = raw.match(/[^。！？!?]+[。！？!?]?/g);
  if (!sentences || sentences.length < 3) return [line];

  const lines: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const next = `${current}${sentence}`;
    if (current && next.length > 86) {
      lines.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// 将 Skill 的 systemPrompt 与 knowledge/context 拼接
function buildSkillPrompt(systemPrompt: string, knowledge: string, context?: string, type: ConsultType = 'normal'): string {
  let prompt = hasUnsafeSkillPrompt(systemPrompt) ? sanitizeSkillPrompt(systemPrompt) : systemPrompt;
  prompt += type === 'deep'
    ? '\n\n回答模式：深度分析。请先给结论，再分层拆解依据、风险、可执行步骤。回答要更完整。'
    : '\n\n回答模式：普通问答。请直接回答核心问题，少铺垫，控制篇幅。';
  prompt += '\n\n内容安全要求：你是涨识小程序里的赛博张老师；严禁提及、模仿或暗示任何真实公众人物、教育博主、网红老师及其风格；严禁添加固定免责提示、第三方权利说明、话题标签、营销口号或类似开场标题。';
  prompt += '\n\n背景使用要求：如果用户提供了背景信息，必须优先使用其中的考生省份、科类/选科、分数、位次、目标城市/省份、偏好专业和规避专业；不要再假设这些信息缺失。回答开头要点明你正在按这些背景判断。';
  prompt += '\n\n排版要求：先给结论，再分段说明；每个要点单独换行；长段落不要挤成一整块。';
  if (context) prompt += `\n\n用户提供的背景信息：${context}`;
  if (knowledge) prompt += `\n\n以下为相关参考知识，请结合回答：${knowledge}`;
  return prompt;
}

function buildUserMessage(question: string, context?: string) {
  const cleanedContext = String(context || '').trim();
  if (!cleanedContext) return question;
  return [
    '请严格基于以下用户背景回答，不要忽略其中的省份、分数、位次、目标城市/省份、偏好专业和规避专业。',
    '',
    '【用户背景】',
    cleanedContext,
    '',
    '【用户问题】',
    question,
  ].join('\n');
}

function normalizeMaxTokens(type: ConsultType, configured?: number | null) {
  const base = Number(configured || 2000);
  if (type === 'deep') return Math.max(base, 2600);
  return Math.min(base, 1200);
}

function localFallbackAnswer(question: string, context?: string, type: ConsultType = 'normal') {
  const school = extractContextValue(context, '关注院校') || extractSchoolFromQuestion(question);
  const city = extractContextValue(context, '院校城市');
  const schoolType = extractContextValue(context, '院校类型');
  const level = extractContextValue(context, '院校层次');
  const province = extractContextValue(context, '考生省份') || extractContextValue(context, '省份');
  const subject = extractContextValue(context, '选科/科类') || extractContextValue(context, '科类/选科');
  const score = extractContextValue(context, '分数');
  const rank = extractContextValue(context, '位次');
  const preferredMajors = extractContextValue(context, '偏好专业');
  const avoidMajors = extractContextValue(context, '规避专业');
  const targetCities =
    extractContextValue(context, '目标城市或省份') ||
    extractContextValue(context, '目标城市') ||
    extractContextValue(context, '偏好城市');

  if (school) {
    const lines = [
      `先看结论：${school}${city ? `在${city}` : ''}${level ? `，层次是${level}` : ''}${schoolType ? `，偏${schoolType}类` : ''}。是否值得放进志愿，核心看三件事：你的位次是否贴近近年录取线、专业组里有没有你能接受的方向、城市和就业资源是否匹配你的目标。`,
      '',
      '建议这样判断：',
      `1. 先用${rank ? `你的位次 ${rank}` : score ? `你的分数 ${score}` : '你的分数和位次'}对比这所学校近三年的最低录取位次，不要只看某一年分数。`,
      `2. 再看专业组。${preferredMajors ? `如果目标是 ${preferredMajors}，优先找这个方向的专业线或专业组。` : '如果还没有确定专业，先把可接受专业和不能接受专业分开。'}${avoidMajors ? ` 明确包含 ${avoidMajors} 的组要谨慎。` : ''}`,
      `3. 看城市和资源。${targetCities ? `你填过目标城市或省份 ${targetCities}，如果学校所在地不匹配，就要确认它的层次或专业优势是否足以抵消位置差异。` : city ? `${city}的实习、考研信息和就业半径要一起看。` : '城市资源会影响实习、考研信息和第一份工作机会。'}`,
    ];
    if (type === 'deep') {
      lines.push(
        '',
        '放志愿时的用法：',
        '如果近三年最低位次明显高于你，适合放冲刺档；如果与你接近，放稳妥档；如果明显低于你且专业能接受，才算真正保底。保底学校不要只图学校名，一定要保证专业和城市也能接受。',
      );
    }
    return lines.join('\n');
  }

  return [
    `你的问题是：${question}`,
    province || subject || score || rank
      ? `我看到的背景：${[province, subject, score ? `${score}分` : '', rank ? `位次${rank}` : ''].filter(Boolean).join('，')}。`
      : '这类问题最好补充省份、科类/选科、分数和位次，判断会更准。',
    '',
    type === 'deep'
      ? '先按“结论、依据、风险、下一步”来拆：先确定目标层次，再用位次锁定候选范围，最后逐个核对专业组、调剂范围和城市接受度。'
      : '先给简版判断：优先用位次看匹配度，再看专业和城市，不要只按学校名排序。',
    preferredMajors ? `偏好方向：${preferredMajors}。` : '',
    avoidMajors ? `规避方向：${avoidMajors}，明确命中的专业线要尽量避开。` : '',
  ].filter(Boolean).join('\n');
}

function extractContextValue(context = '', label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = context.match(new RegExp(`${escaped}[：:]\\s*([^\\n]+)`));
  return match?.[1]?.trim() || '';
}

function extractSchoolFromQuestion(question: string) {
  const match = question.match(/分析\s*([^：:，,。\n]+?大学|[^：:，,。\n]+?学院|[^：:，,。\n]+?学校)/);
  return match?.[1]?.trim() || '';
}

export async function localFallbackConsult(params: ConsultParams): Promise<ConsultResult> {
  const { userId, question, channel, type = 'normal', context: userContext, isAnonymous } = params;
  const sessionId = params.sessionId || `${userId}_${Date.now()}`;
  const answer = sanitizeAiOutput(localFallbackAnswer(question, userContext, type));

  if (!isAnonymous) {
    await prisma.consultationRecord.create({
      data: {
        userId, sessionId, question, answer,
        model: 'local-fallback', pointsCost: 0, channel, type,
      },
    });
  }

  return { answer, pointsCost: 0, model: 'local-fallback', sessionId };
}

// 生成缓存 key（基于问题内容和类型的哈希）
function cacheKey(question: string, type: string, context?: string): string {
  const normalized = question.trim().toLowerCase();
  const hash = crypto.createHash('md5').update(`${normalized}|${type}|${context || ''}`).digest('hex').slice(0, 16);
  return `ai:cache:${hash}`;
}

// 判断是否适合缓存（含个人具体分数/排名的个性化问题不适合缓存）
function isCacheable(question: string, context?: string): boolean {
  const combined = `${question} ${context || ''}`;
  // 包含具体分数、排名、个人标识的不缓存
  const personalPatterns = [/\d{3}分/, /\d+名/, /省排名/, /一模/, /二模/, /我的/];
  return !personalPatterns.some(p => p.test(combined));
}

// 核心咨询接口
export async function consult(params: ConsultParams): Promise<ConsultResult> {
  const { userId, question, channel, type = 'normal', context: userContext, isAnonymous } = params;
  const sessionId = params.sessionId || `${userId}_${Date.now()}`;

  // 1. 获取 AI 配置
  const aiConfig = await getAiConfig();

  // 2. 解析 API 凭证（DB 优先，留空回退 env）
  const creds = resolveApiCredentials(aiConfig);

  // 3. 确定扣点数（未登录用户免费）
  const pointsCost = isAnonymous ? 0 : (type === 'deep' ? aiConfig.pointsPerDeep : aiConfig.pointsPerQuery);

  // 4. 扣减点数（未登录用户跳过）
  if (!isAnonymous) {
    await deductPoints(userId, pointsCost, {
      source: 'consultation',
      sourceId: sessionId,
      remark: `${type === 'deep' ? '深度分析' : '普通问答'} - "${question.slice(0, 30)}..."`,
    });
  }

  try {
    // 5. 加载默认 Skill
    const skill = await getDefaultSkill();

    // 6. 解析 Skill 参数：skill 有值则覆盖 AiConfig
    const modelName = skill?.model || (aiConfig.model === 'deepseek-flash' ? 'deepseek-flash' : 'deepseek-chat');
    const temperature = skill?.temperature ?? aiConfig.temperature;
    const maxTokens = normalizeMaxTokens(type, skill?.maxTokens ?? aiConfig.maxTokens);
    const topP = skill?.topP ?? aiConfig.topP;

    // 7. 解析 Skill 关键词
    let skillKeywords: string[] | undefined;
    if (skill?.keywords) {
      try { skillKeywords = JSON.parse(skill.keywords); } catch { /* ignore */ }
    }

    // 8. 检查缓存
    const cacheable = isCacheable(question, userContext);
    const ck = cacheKey(question, type, userContext);

    if (cacheable) {
      const cached = await redisGet(ck);
      if (cached) {
        const answer = sanitizeAiOutput(cached);
        logger.info('AI缓存命中: %s', ck);
        await prisma.consultationRecord.create({
          data: {
            userId, sessionId, question, answer,
            model: `${modelName} (cached)`, pointsCost, channel, type,
          },
        });
        return { answer, pointsCost, model: modelName, sessionId };
      }
    }

    // 9. 检索知识库
    const knowledge = await retrieveKnowledge(question, aiConfig, skillKeywords);

    // 10. 构建 System Prompt：优先用 Skill，fallback 硬编码
    const systemPrompt = skill?.systemPrompt
      ? buildSkillPrompt(skill.systemPrompt, knowledge, userContext, type)
      : buildSystemPrompt(knowledge, userContext, type);

    // 11. 调用 DeepSeek 模型
    const response = await axios.post(
      `${creds.baseUrl}/v1/chat/completions`,
      {
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildUserMessage(question, userContext) },
        ],
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
      },
      {
        headers: {
          'Authorization': `Bearer ${creds.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: normalizeAiTimeout(type, creds.timeout),
      }
    );

    const answer = sanitizeAiOutput(response.data.choices[0]?.message?.content || '抱歉，暂时无法回答您的问题，请稍后重试。');

    // 12. 写入缓存
    if (cacheable) {
      const ttl = type === 'deep' ? CACHE_TTL_DEEP : CACHE_TTL_NORMAL;
      redisSet(ck, answer, ttl);
    }

    // 13. 保存咨询记录（匿名用户跳过，因为没有真实 userId）
    if (!isAnonymous) {
      await prisma.consultationRecord.create({
        data: {
          userId, sessionId, question, answer,
          model: modelName, pointsCost, channel, type,
        },
      });
    }

    logger.info('AI咨询完成: userId=%s, model=%s, cost=%dpts, cached=%s', userId, modelName, pointsCost, 'no');

    return { answer, pointsCost, model: modelName, sessionId };

  } catch (err) {
    if (!isAnonymous) {
      await refundPoints(userId, pointsCost, sessionId);
    }
    if (axios.isAxiosError(err)) {
      const detail = err.response?.data || err.code || err.message;
      logger.error('DeepSeek API 调用失败: %s', String(detail));
      return localFallbackConsult({ userId, question, channel, type, sessionId, context: userContext, isAnonymous });
    }
    throw err;
  }
}

// 退还点数
async function refundPoints(userId: string, amount: number, sessionId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.pointsAccount.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });

    const account = await tx.pointsAccount.findUnique({ where: { userId } });

    await tx.pointsTransaction.create({
      data: {
        userId,
        type: 'refund',
        amount,
        balanceAfter: account!.balance,
        source: 'system',
        sourceId: sessionId,
        remark: 'AI服务故障，退还点数',
      },
    });
  });
}

// 流式咨询接口（返回 ReadableStream 供 SSE 管道转发）
export async function streamConsult(params: ConsultParams): Promise<StreamConsultResult> {
  const { userId, question, channel, type = 'normal', context: userContext, isAnonymous } = params;
  const sessionId = params.sessionId || `${userId}_${Date.now()}`;

  // 1. 获取 AI 配置
  const aiConfig = await getAiConfig();
  const creds = resolveApiCredentials(aiConfig);

  // 2. 确定扣点数（未登录用户免费）
  const pointsCost = isAnonymous ? 0 : (type === 'deep' ? aiConfig.pointsPerDeep : aiConfig.pointsPerQuery);

  // 3. 扣减点数（未登录用户跳过）
  if (!isAnonymous) {
    await deductPoints(userId, pointsCost, {
      source: 'consultation',
      sourceId: sessionId,
      remark: `${type === 'deep' ? '深度分析' : '普通问答'} - "${question.slice(0, 30)}..."`,
    });
  }

  try {
    // 4. 加载默认 Skill
    const skill = await getDefaultSkill();

    // 5. 解析模型参数
    const modelName = skill?.model || (aiConfig.model === 'deepseek-flash' ? 'deepseek-flash' : 'deepseek-chat');
    const temperature = skill?.temperature ?? aiConfig.temperature;
    const maxTokens = normalizeMaxTokens(type, skill?.maxTokens ?? aiConfig.maxTokens);
    const topP = skill?.topP ?? aiConfig.topP;

    // 6. 检索知识库
    let skillKeywords: string[] | undefined;
    if (skill?.keywords) {
      try { skillKeywords = JSON.parse(skill.keywords); } catch { /* ignore */ }
    }
    const knowledge = await retrieveKnowledge(question, aiConfig, skillKeywords);

    // 7. 构建 System Prompt
    const systemPrompt = skill?.systemPrompt
      ? buildSkillPrompt(skill.systemPrompt, knowledge, userContext, type)
      : buildSystemPrompt(knowledge, userContext, type);

    // 8. 调用 DeepSeek API（stream 模式）
    const response = await fetch(`${creds.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildUserMessage(question, userContext) },
        ],
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        stream: true,
      }),
      signal: AbortSignal.timeout(normalizeAiTimeout(type, creds.timeout)),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new AppError(502, `DeepSeek API error ${response.status}: ${errText}`, 'AI_API_ERROR');
    }

    if (!response.body) {
      throw new AppError(502, 'DeepSeek API 未返回流式响应', 'AI_NO_STREAM');
    }

    return {
      stream: response.body,
      pointsCost,
      model: modelName,
      sessionId,
    };
  } catch (err) {
    if (!isAnonymous) {
      await refundPoints(userId, pointsCost, sessionId);
    }
    throw err;
  }
}

// 获取会话历史（多轮对话上下文）
export async function getSessionHistory(sessionId: string, limit = 10) {
  const records = await prisma.consultationRecord.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { question: true, answer: true },
  });
  return records.map(record => ({
    ...record,
    answer: sanitizeAiOutput(record.answer || ''),
  }));
}

// 获取用户咨询历史
export async function getUserHistory(userId: string, page = 1, pageSize = 20) {
  const [list, total] = await Promise.all([
    prisma.consultationRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        sessionId: true,
        question: true,
        answer: true,
        pointsCost: true,
        channel: true,
        type: true,
        createdAt: true,
      },
    }),
    prisma.consultationRecord.count({ where: { userId } }),
  ]);

  return {
    list: list.map(item => ({
      ...item,
      answer: sanitizeAiOutput(item.answer || ''),
    })),
    total,
    page,
    pageSize,
  };
}
