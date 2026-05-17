/**
 * 从学校官网概况页 + EOL 结构化详情生成 300-500 字院校简介。
 *
 * 用法：
 *   npx tsx scripts/enrich-university-introductions-from-official.ts --dry-run --limit 20
 *   npx tsx scripts/enrich-university-introductions-from-official.ts --concurrency 8
 */
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DETAIL_URL = 'https://static-data.eol.cn/www/2.0/school/{id}/info.json';
const CACHE_DIR = path.resolve(__dirname, '../.cache');

const INTRO_LINK_KEYWORDS = [
  '学校简介', '学校概况', '学校介绍', '学校概览', '学校概貌', '学校概述',
  '学院简介', '学院概况', '学院介绍', '校情简介', '校情总览', '校情概况',
  '大学简介', '大学概况', '关于学校', '关于我们', '学校概况',
];

const INTRO_PATHS = [
  '/about.html', '/about.htm', '/about/', '/about/index.html', '/about/index.htm',
  '/xxgk/xxjj.htm', '/xxgk/xxjj.html', '/xxgk/xxgk.htm', '/xxgk/xxgk.html',
  '/xxgk/index.htm', '/xxgk/index.html', '/xxgk.htm', '/xxgk.html',
  '/xxjj.htm', '/xxjj.html', '/xxjj/index.htm', '/xxjj/index.html',
  '/xygk/xyjj.htm', '/xygk/xyjj.html', '/xygk/index.htm', '/xygk/index.html',
  '/gk/xxjj.htm', '/gk/xxjj.html', '/gk/index.htm', '/gk/index.html',
  '/school/list.htm', '/school/list.html',
];

type Args = {
  dryRun: boolean;
  skipOfficial: boolean;
  limit: number;
  offset: number;
  concurrency: number;
  delayMs: number;
  timeoutMs: number;
};

type UniversityRecord = {
  id: string;
  name: string;
  code: string | null;
  type: string | null;
  level: string | null;
  province: string | null;
  city: string | null;
  properties: string | null;
  is985: boolean;
  is211: boolean;
  isDoubleFirst: boolean;
  address: string | null;
  website: string | null;
  introduction: string | null;
  featureTags: string;
};

type EolDetail = Record<string, any>;

type OfficialIntro = {
  url: string;
  title: string;
  text: string;
  facts: OfficialFacts;
  score: number;
};

type OfficialFacts = {
  collegeCount?: string;
  majorCount?: string;
  studentCount?: string;
  facultyCount?: string;
  campusArea?: string;
};

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv: string[]): Args {
  const result: Args = {
    dryRun: false,
    skipOfficial: false,
    limit: 0,
    offset: 0,
    concurrency: 6,
    delayMs: 80,
    timeoutMs: 6500,
  };
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    const [key, inlineValue] = item.split('=');
    const nextValue = inlineValue ?? argv[i + 1];
    if (item === '--dry-run') result.dryRun = true;
    else if (item === '--skip-official') result.skipOfficial = true;
    else if (key === '--limit') result.limit = Number(nextValue || 0);
    else if (key === '--offset') result.offset = Number(nextValue || 0);
    else if (key === '--concurrency') result.concurrency = Math.max(1, Number(nextValue || 6));
    else if (key === '--delay') result.delayMs = Math.max(0, Number(nextValue || 0));
    else if (key === '--timeout') result.timeoutMs = Math.max(1500, Number(nextValue || 6500));
    if (inlineValue === undefined && ['--limit', '--offset', '--concurrency', '--delay', '--timeout'].includes(key)) i++;
  }
  return result;
}

function schoolIdFromCode(code?: string | null) {
  const value = String(code || '').replace(/^0+/, '');
  return value || '';
}

function cleanText(value: unknown) {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&ldquo;|&#8220;/gi, '“')
    .replace(/&rdquo;|&#8221;/gi, '”')
    .replace(/&mdash;|&#8212;/gi, '—')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function normalizeUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^(https?:)?\/\//i.test(raw)) return raw.startsWith('//') ? `https:${raw}` : raw;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(raw)) return `https://${raw}`;
  return null;
}

function normalizeCity(city?: string | null) {
  const value = String(city || '').trim();
  return value.replace(/(市|地区|盟|自治州|特别行政区)$/, '') || value || '';
}

function buildLocation(uni: UniversityRecord, detail: EolDetail) {
  const province = String(detail.province_name || uni.province || '').trim();
  const city = normalizeCity(detail.city_name || uni.city);
  if (!province) return city;
  if (!city || province === city || province.startsWith(city) || city.startsWith(province)) return province;
  return `${province}${city}`;
}

function parseJsonArray(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.map(item => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function unique(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function compact(values: string[], maxLength: number) {
  const result: string[] = [];
  let size = 0;
  for (const value of values) {
    if (size + value.length > maxLength) break;
    result.push(value);
    size += value.length + 1;
  }
  return result;
}

function ensureSentenceEnd(value: string) {
  if (!value) return value;
  return /[。！？!?]$/.test(value) ? value : `${value}。`;
}

function hashText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pick<T>(seed: string, variants: T[]) {
  return variants[hashText(seed) % variants.length];
}

function sentenceTrim(value: string, maxLength: number) {
  const cleaned = ensureSentenceEnd(cleanText(value).replace(/\s*\n\s*/g, ''));
  if (cleaned.length <= maxLength) return cleaned;
  const sentences = cleaned.match(/[^。！？!?]+[。！？!?]/g) || [];
  let result = '';
  for (const sentence of sentences) {
    if ((result + sentence).length > maxLength) break;
    result += sentence;
  }
  return result.length >= 260 ? ensureSentenceEnd(result) : ensureSentenceEnd(cleaned.slice(0, maxLength - 1));
}

function decodeHtml(buffer: ArrayBuffer, contentType?: string | null) {
  const bytes = new Uint8Array(buffer);
  const head = Buffer.from(bytes.slice(0, 2048)).toString('ascii');
  const charset = (contentType?.match(/charset=([^;]+)/i)?.[1] || head.match(/charset=["']?([^"'\s>]+)/i)?.[1] || '').toLowerCase();
  const label = /gb2312|gbk|gb18030/.test(charset) ? 'gb18030' : 'utf-8';
  try {
    return new TextDecoder(label as any).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; CyberZhang university profile enrichment/1.0)',
        'accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type');
    if (contentType && !/html|text|xml/i.test(contentType)) throw new Error(`非 HTML 内容：${contentType}`);
    return { html: decodeHtml(await res.arrayBuffer(), contentType), finalUrl: res.url };
  } finally {
    clearTimeout(timer);
  }
}

function extractVisibleText(html: string) {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, svg, nav, header, footer, .nav, .menu, .footer, .header, .breadcrumb, .bread, .sidebar, .side').remove();
  const title = cleanText($('title').first().text());
  const mainText = cleanText($('article, main, .content, .main, .article, .v_news_content, #vsb_content, #vsb_content_2').text());
  const bodyText = cleanText($('body').text());
  return {
    title,
    text: mainText.length > 300 ? mainText : bodyText,
  };
}

function sameSite(base: URL, candidate: URL) {
  const baseHost = base.hostname.replace(/^www\./, '');
  const host = candidate.hostname.replace(/^www\./, '');
  return host === baseHost || host.endsWith(`.${baseHost}`) || baseHost.endsWith(`.${host}`);
}

function collectCandidateLinks(homepageUrl: string, html: string) {
  const base = new URL(homepageUrl);
  const $ = cheerio.load(html);
  const candidates: Array<{ url: string; hint: string }> = [];
  $('a[href]').each((_, el) => {
    const href = String($(el).attr('href') || '').trim();
    const text = cleanText($(el).text());
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) return;
    const combined = `${text} ${href}`;
    if (!INTRO_LINK_KEYWORDS.some(keyword => combined.includes(keyword)) && !/xxjj|xxgk|about|survey|profile|intro/i.test(combined)) return;
    try {
      const url = new URL(href, base);
      if (!['http:', 'https:'].includes(url.protocol) || !sameSite(base, url)) return;
      candidates.push({ url: url.toString(), hint: text || href });
    } catch {
      // Ignore malformed URLs.
    }
  });
  for (const pathItem of INTRO_PATHS) {
    candidates.push({ url: new URL(pathItem, base.origin).toString(), hint: pathItem });
  }
  return unique(candidates.map(item => `${item.url}\t${item.hint}`))
    .map(item => {
      const [url, hint] = item.split('\t');
      return { url, hint };
    })
    .slice(0, 18);
}

function scoreIntroPage(uni: UniversityRecord, url: string, hint: string, title: string, text: string) {
  let score = 0;
  const combined = `${hint} ${title} ${url}`;
  if (INTRO_LINK_KEYWORDS.some(keyword => combined.includes(keyword))) score += 40;
  if (/xxjj|xxgk|about|profile|intro|survey/i.test(combined)) score += 16;
  if (text.includes(uni.name)) score += 18;
  if (/学校|学院|大学|办学|学科|专业|师资|校区|创建|创办/.test(text)) score += 18;
  if (text.length > 800) score += 18;
  else if (text.length > 400) score += 8;
  if (/招生章程|录取规则|新闻|通知|公告|采购|招标|就业信息|联系我们/.test(title)) score -= 30;
  if (text.length < 260) score -= 25;
  return score;
}

function extractOfficialFacts(text: string): OfficialFacts {
  return {
    collegeCount: matchFact(text, /(?:设有|现有|下设)([0-9０-９]{1,3})个(?:学院|二级学院|教学单位|教学科研单位)/),
    majorCount: matchFact(text, /(?:开设|设有|现有)([0-9０-９]{1,3})个本科专业/),
    studentCount: matchFact(text, /(?:全日制)?在校(?:学生|生)(?:总数)?(?:约|近|达|超过|逾)?([0-9０-９.]+万?余?)(?:人|名)/),
    facultyCount: matchFact(text, /(?:教职工|专任教师)(?:总数)?(?:约|近|达|超过|逾|现有)?([0-9０-９.]+万?余?)(?:人|名)/),
    campusArea: matchFact(text, /(?:校园)?占地(?:面积)?(?:约|达|超过|逾)?([0-9０-９.]+万?平方米|[0-9０-９.]+亩)/),
  };
}

function matchFact(text: string, regex: RegExp) {
  const match = text.match(regex);
  return match?.[1]?.replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

async function crawlOfficialIntro(uni: UniversityRecord): Promise<OfficialIntro | null> {
  if (args.skipOfficial) return null;
  const normalized = normalizeUrl(uni.website);
  if (!normalized) return null;

  let homepage;
  try {
    homepage = await fetchHtml(normalized);
  } catch {
    return null;
  }

  const candidates = collectCandidateLinks(homepage.finalUrl || normalized, homepage.html);
  const homepageText = extractVisibleText(homepage.html);
  let best: OfficialIntro | null = {
    url: homepage.finalUrl || normalized,
    title: homepageText.title,
    text: homepageText.text,
    facts: extractOfficialFacts(homepageText.text),
    score: scoreIntroPage(uni, homepage.finalUrl || normalized, '首页', homepageText.title, homepageText.text) - 20,
  };

  for (const candidate of candidates) {
    try {
      const page = await fetchHtml(candidate.url);
      const extracted = extractVisibleText(page.html);
      const score = scoreIntroPage(uni, page.finalUrl || candidate.url, candidate.hint, extracted.title, extracted.text);
      if (!best || score > best.score) {
        best = {
          url: page.finalUrl || candidate.url,
          title: extracted.title,
          text: extracted.text,
          facts: extractOfficialFacts(extracted.text),
          score,
        };
      }
      if (score >= 82) break;
    } catch {
      // Try the next likely page.
    }
  }

  return best && best.score >= 45 ? best : null;
}

async function fetchEolDetail(uni: UniversityRecord) {
  const schoolId = schoolIdFromCode(uni.code);
  if (!schoolId) return {};
  try {
    const res = await fetch(DETAIL_URL.replace('{id}', schoolId), {
      headers: { 'user-agent': 'CyberZhang university profile enrichment/1.0' },
    });
    if (!res.ok) return {};
    const json: any = await res.json();
    return json.data || {};
  } catch {
    return {};
  }
}

function formatAcademicItems(detail: EolDetail) {
  const items: string[] = [];
  for (const item of [...(detail.doctor_arr || []), ...(detail.master_arr || []), ...(detail.subject_arr || [])]) {
    if (!item?.name || !Number(item.num || 0)) continue;
    items.push(`${item.name}${item.num}个`);
  }
  return compact(items, 120);
}

function representativeMajors(detail: EolDetail) {
  const specials = Array.isArray(detail.special) ? detail.special : [];
  const featured = specials
    .filter((item: any) => item?.special_name && (String(item.nation_feature) === '1' || String(item.nation_first_class) === '1' || item.xueke_rank_score))
    .map((item: any) => String(item.special_name));
  const fallback = specials.map((item: any) => String(item?.special_name || ''));
  return compact(unique([...featured, ...fallback]), 80);
}

function dualClassSubjects(detail: EolDetail) {
  const subjects = Array.isArray(detail.dualclass) ? detail.dualclass.map((item: any) => String(item?.class || '')) : [];
  return compact(unique(subjects), 70);
}

function typeFocus(type?: string | null) {
  const value = String(type || '');
  if (value.includes('理工')) return '学校整体更偏工程技术、产业应用和实践训练，适合重点关注实验平台、专业方向与城市产业匹配度。';
  if (value.includes('财经')) return '学校培养特色多与经济、金融、管理和商科实践相关，适合结合城市产业资源和实习机会一起判断。';
  if (value.includes('师范')) return '学校在教师教育和基础学科培养上更有辨识度，适合关注师范认证、实习基地和升学深造路径。';
  if (value.includes('医药')) return '学校专业学习周期和实践要求通常较高，适合重点了解附属医院、实训条件和执业资格路径。';
  if (value.includes('农林')) return '学校常围绕农业、生命、生态和食品等方向布局，适合结合区域产业和科研平台判断专业价值。';
  if (value.includes('政法')) return '学校多围绕法学、治理、公安司法或公共管理形成特色，适合关注学科平台、实务训练和就业系统。';
  if (value.includes('语言')) return '学校通常强调语言能力、国际交流和复合型培养，适合结合语种实力、地区资源和行业出口选择。';
  if (value.includes('艺术')) return '学校专业培养更看重作品、实践平台和行业资源，适合结合招生要求、师资方向和城市文化生态判断。';
  if (value.includes('体育')) return '学校培养更强调运动训练、健康服务和赛事实践，适合关注专项方向、训练条件和就业场景。';
  if (value.includes('军事')) return '学校培养目标和管理方式具有鲜明军事属性，报考时要同时关注招生对象、体检政审和培养去向。';
  return '学校学科覆盖面和培养路径需要结合具体专业判断，适合继续查看招生章程、专业组设置和近年录取位次。';
}

function formatOfficialFacts(seed: string, facts?: OfficialFacts) {
  if (!facts) return '';
  const parts = [
    facts.collegeCount ? `设有${facts.collegeCount}个学院或教学单位` : '',
    facts.majorCount ? `开设${facts.majorCount}个本科专业` : '',
    facts.studentCount ? `在校生规模约${facts.studentCount}人` : '',
    facts.facultyCount ? `拥有教职工或专任教师约${facts.facultyCount}人` : '',
    facts.campusArea ? `校园占地约${facts.campusArea}` : '',
  ].filter(Boolean);
  if (!parts.length) return '';
  return pick(seed, [
    `办学资源方面，学校${parts.join('，')}。`,
    `从官网概况页可见，学校${parts.join('，')}，整体办学规模较清晰。`,
    `官网资料显示，学校${parts.join('，')}，这些信息有助于判断教学承载和校园资源。`,
  ]);
}

function buildProjectSentence(uni: UniversityRecord, detail: EolDetail, seed: string) {
  const projects = [
    uni.is985 ? '985工程' : '',
    uni.is211 ? '211工程' : '',
    uni.isDoubleFirst ? '双一流建设高校' : '',
  ].filter(Boolean);
  const tags = parseJsonArray(uni.featureTags);
  const highlights = compact(tags.filter(tag => !['教育部直属'].includes(tag)), 80);
  const parts = [];
  if (projects.length) parts.push(`入选${projects.join('、')}`);
  if (highlights.length) parts.push(`特色标签包括${highlights.join('、')}`);
  if (detail.belong) parts.push(`主管或归属单位为${cleanText(detail.belong)}`);
  if (!parts.length) return '';
  return pick(seed, [
    `${parts.join('；')}。`,
    `院校层次和标签方面，${parts.join('；')}。`,
    `从办学定位看，${parts.join('；')}。`,
  ]);
}

function buildRichIntroduction(uni: UniversityRecord, detail: EolDetail, official: OfficialIntro | null) {
  const name = uni.name;
  const seed = `${uni.code || ''}${name}`;
  const location = buildLocation(uni, detail) || '中国';
  const nature = detail.nature_name || uni.properties || '';
  const type = (detail.type_name || uni.type || '').replace(/类$/, '');
  const level = uni.level || detail.level_name || detail.school_type_name || '';
  const createYear = Number(detail.create_date || 0);
  const schoolKind = [nature, type ? `${type}类` : '', level].filter(Boolean).join('') || '高等院校';
  const sentences = [
    pick(`${seed}-open`, [
      `${name}位于${location}，是一所${schoolKind}。`,
      `${name}坐落在${location}，办学属性和类型可概括为${schoolKind}。`,
      `从院校库和官网资料看，${name}是一所位于${location}的${schoolKind}。`,
      `${name}的主要办学地点在${location}，院校类型为${schoolKind}。`,
    ]),
    buildProjectSentence(uni, detail, `${seed}-project`),
  ].filter(Boolean);

  if (createYear >= 1800 && createYear <= new Date().getFullYear()) {
    sentences.push(pick(`${seed}-history`, [
      `学校办学时间可追溯至${createYear}年，历史沿革与所在地教育、产业和公共服务需求联系紧密。`,
      `其办学源流可追溯到${createYear}年，长期发展中逐步形成了现在的学科结构和培养体系。`,
      `学校自${createYear}年前后开启办学历程，后续在院系调整、学科建设和人才培养中持续积累。`,
      `从历史沿革看，学校的办学基础可追溯至${createYear}年，这也是理解其学科传统的重要线索。`,
    ]));
  }

  const dualSubjects = dualClassSubjects(detail);
  if (dualSubjects.length) {
    sentences.push(pick(`${seed}-dual`, [
      `双一流建设学科或重点方向包括${dualSubjects.join('、')}等。`,
      `在国家重点建设方向上，${dualSubjects.join('、')}等学科具有较高辨识度。`,
      `学科名片主要集中在${dualSubjects.join('、')}等方向。`,
    ]));
  }

  const academic = formatAcademicItems(detail);
  if (academic.length) {
    sentences.push(pick(`${seed}-academic`, [
      `学科建设方面，学校拥有${academic.join('、')}，能够支撑本科到研究生阶段的培养。`,
      `培养层次上，学校已形成${academic.join('、')}等授权和重点学科基础。`,
      `从学位点和重点学科看，学校具备${academic.join('、')}等办学支撑。`,
    ]));
  }

  const majors = representativeMajors(detail);
  if (majors.length) {
    sentences.push(pick(`${seed}-majors`, [
      `专业与培养方向上，较有代表性的专业包括${majors.join('、')}等。`,
      `本科专业中，${majors.join('、')}等方向更容易体现学校办学特色。`,
      `如果从专业选择角度观察，${majors.join('、')}等可以作为了解学校优势方向的入口。`,
    ]));
  }

  const officialFacts = formatOfficialFacts(`${seed}-official`, official?.facts);
  if (officialFacts) sentences.push(officialFacts);

  const address = cleanText(uni.address || detail.address || '').replace(/,/g, '，');
  if (address) {
    const shortAddress = address.length > 90 ? `${address.slice(0, 88).replace(/[，,、：:；;\s]+$/, '')}……` : address;
    sentences.push(pick(`${seed}-address`, [
      `校区和地址信息显示，学校主要办学地点包括${shortAddress}。`,
      `从校区分布看，学校主要办学地点包括${shortAddress}。`,
      `地理位置上，考生可重点关注${shortAddress}等办学地点对学习生活和实习资源的影响。`,
    ]));
  }

  sentences.push(pick(`${seed}-focus`, [
    typeFocus(type || uni.type),
    `${typeFocus(type || uni.type)}填报时还要结合招生章程、专业组设置和近年录取位次做交叉判断。`,
    `择校时，建议把学校层次、专业实力、所在城市、校区安排和自己的分数位次放在一起比较。`,
  ]));

  let intro = sentenceTrim(sentences.join(''), 500);
  if (intro.length < 300) {
    intro = sentenceTrim(`${intro}${name}的院校定位、专业结构和培养资源，是考生判断学校层次、专业适配度和未来发展空间的重要依据。了解这所学校时，可以把学校官网概况、招生章程、专业目录和近年录取数据结合起来看，重点比较专业实力、校区安排、培养模式、就业升学方向以及与自身分数位次的匹配程度。`, 500);
  }
  if (intro.length < 300) {
    intro = sentenceTrim(`${intro}${name}的简介信息后续仍可结合官网最新发布内容继续补充，包括院系设置、师资队伍、科研平台、实习实践基地、国际交流和毕业去向等维度。`, 500);
  }
  return intro;
}

async function runWorker<T>(items: T[], worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(args.concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
      if (args.delayMs) await new Promise(resolve => setTimeout(resolve, args.delayMs));
    }
  });
  await Promise.all(workers);
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  const auditFile = path.join(CACHE_DIR, `university-introduction-official-${new Date().toISOString().slice(0, 10)}.jsonl`);
  const all = await prisma.university.findMany({
    orderBy: [{ is985: 'desc' }, { is211: 'desc' }, { isDoubleFirst: 'desc' }, { code: 'asc' }],
  }) as UniversityRecord[];
  const universities = all.slice(args.offset, args.limit ? args.offset + args.limit : undefined);
  const stats = {
    selected: universities.length,
    updated: 0,
    officialFound: 0,
    officialMissed: 0,
    failed: 0,
    tooShort: 0,
  };

  console.log(`准备生成 300-500 字院校简介 ${universities.length} 所，并发 ${args.concurrency}${args.dryRun ? '（dry-run）' : ''}`);

  await runWorker(universities, async (uni, index) => {
    try {
      const [detail, official] = await Promise.all([
        fetchEolDetail(uni),
        crawlOfficialIntro(uni),
      ]);
      if (official) stats.officialFound++;
      else stats.officialMissed++;

      const introduction = buildRichIntroduction(uni, detail, official);
      if (introduction.length < 300) stats.tooShort++;
      if (introduction !== uni.introduction) {
        if (!args.dryRun) {
          await prisma.university.update({ where: { id: uni.id }, data: { introduction } });
        }
        stats.updated++;
      }
      await appendFile(auditFile, JSON.stringify({
        code: uni.code,
        name: uni.name,
        dryRun: args.dryRun,
        introLength: introduction.length,
        officialUrl: official?.url || null,
        officialTitle: official?.title || null,
        officialScore: official?.score || null,
      }) + '\n');
      if ((index + 1) % 100 === 0) {
        console.log(`  已处理 ${index + 1}/${universities.length}，更新 ${stats.updated}，官网概况 ${stats.officialFound}，失败 ${stats.failed}`);
      }
    } catch (error: any) {
      stats.failed++;
      await appendFile(auditFile, JSON.stringify({ code: uni.code, name: uni.name, error: error.message }) + '\n');
      if (stats.failed <= 10) console.warn(`  ${uni.name} 失败：${error.message}`);
    }
  });

  console.log('\n完成：');
  console.log(JSON.stringify(stats, null, 2));
  console.log(`审计日志：${auditFile}`);
}

main()
  .catch(error => {
    console.error('简介富化失败：', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
