import { PrismaClient } from '@prisma/client';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { constants as cryptoConstants } from 'node:crypto';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

const prisma = new PrismaClient();

const YEAR = Number(process.env.YEAR || 2025);
const SOURCE = process.env.SOURCE || 'all';
const FILE_DIR = process.env.FILE_DIR || path.join(process.cwd(), '.cache', 'art-admission');

type RuleSeed = {
  province: string;
  year: number;
  artCategory: string;
  batch: string;
  subjectType?: string;
  formulaType: string;
  cultureFullScore?: number;
  professionalFullScore?: number;
  cultureWeight: number;
  professionalWeight: number;
  scaleTo?: number;
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  notes: string;
};

type ScoreRow = {
  universityId?: string | null;
  universityName: string;
  province: string;
  year: number;
  batch: string;
  artCategory: string;
  subjectType?: string;
  majorName?: string | null;
  groupCode?: string | null;
  groupName?: string | null;
  minCompositeScore?: number | null;
  minCultureScore?: number | null;
  minProfessionalScore?: number | null;
  minRank?: number | null;
  planCount?: number | null;
  admissionMethod?: string | null;
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  dataQuality: string;
  rawData: string;
};

type ScoreSource = {
  key: string;
  province: string;
  batch: string;
  subjectType?: string;
  artCategory?: string;
  file: string;
  url: string;
  sourceName: string;
  sourceType: string;
  legacySourceTypes?: string[];
  parser: 'zhejiang_art_xls' | 'shandong_art_xls' | 'jiangsu_art_xlsx' | 'hebei_art_xlsx' | 'hunan_art_xlsx' | 'jiangxi_art_pdf' | 'guangdong_art_pdf' | 'shanxi_art_pdf' | 'shanghai_art_pdf' | 'heilongjiang_art_xlsx' | 'liaoning_art_pdf' | 'beijing_art_pdf' | 'guangxi_art_html' | 'neimenggu_art_json';
};

const ANHUI_RULE_URL = 'https://gaokao.eol.cn/an_hui/dongtai/202409/t20240930_2635577.shtml';
const JIANGSU_RULE_URL = 'https://jyt.jiangsu.gov.cn/art/2023/1/6/art_57827_10737259.html';
const FUJIAN_RULE_URL = 'https://www.eeafj.cn/gkptgkgsgg/20250616/14046.html';
const JILIN_RULE_URL = 'https://www.jleea.com.cn/u/cms/www/2025/06/25/1937709019347066881.pdf';
const HUBEI_RULE_URL = 'https://jyt.hubei.gov.cn/bmdt/ztzl/gxzs/zszy/zsfw/202506/P020250620581412805028.pdf';
const ZHEJIANG_RULE_URL = 'https://www.zjzs.net/art/2025/1/22/art_47_11000.html';
const SHANDONG_RULE_URL = 'https://www.sdzk.cn/NewsInfo.aspx?NewsID=6954';
const GUANGDONG_RULE_URL = 'https://eea.gd.gov.cn/ptgk/content/post_4514884.html';
const HEBEI_RULE_URL = 'https://gaokao.chsi.com.cn/gkxx/zc/ss/202410/20241012/2293343664.html';
const HUNAN_RULE_URL = 'https://jyt.hunan.gov.cn/jyt/xzxx/202507/t20250713_33741643.html';
const JIANGXI_RULE_URL = 'https://edu.nc.gov.cn/ncjyj/pgc/202410/b5db294e180940c2b7259ec679872800/files/%E8%B5%A3%E6%95%99%E8%80%83%E5%AD%97%E3%80%942024%E3%80%9517%E5%8F%B7%E5%85%B3%E4%BA%8E%E5%81%9A%E5%A5%BD%E6%B1%9F%E8%A5%BF%E7%9C%812025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E6%A0%A1%E8%89%BA%E6%9C%AF%E7%B1%BB%E4%B8%93%E4%B8%9A%E8%80%83%E8%AF%95%E6%8B%9B%E7%94%9F%E5%B7%A5%E4%BD%9C%E7%9A%84%E9%80%9A%E7%9F%A5.pdf';
const SHANXI_RULE_URL = 'https://www.sxjyksfw.cn/news/ptgk/20250530/n2025053080626129.html';
const SHANXI_SCORE_PAGE_URL = 'https://oa.sxjyksfw.cn/news/ptgk/20250724/n2025072423452439.html';
const SHANGHAI_RULE_URL = 'https://www.shanghai.gov.cn/cmsres/da/da3db34420404de3b08bfde3bb034b7b/faf2d336546b5b6ef4134bda1675a678.pdf';
const SHANGHAI_SCORE_PAGE_URL = 'https://www.shmeea.edu.cn/page/08000/20250713/19601.html';
const HEILONGJIANG_RULE_URL = 'https://www.hlj.gov.cn/hlj/c107857/202504/c00_31834455.shtml';
const HEILONGJIANG_SCORE_PAGE_URL = 'https://www.hlj.gov.cn/hlj/c107857/202507/c00_31858140.shtml';
const LIAONING_RULE_URL = 'https://jyt.ln.gov.cn/jyt/jyzx/jyyw/2025062010472685884/index.shtml';
const LIAONING_SCORE_PAGE_URL = 'https://www.ms315.com/html/20250714/202507141011121.htm';
const BEIJING_RULE_URL = 'https://www.bjeea.cn/html/gkgz/tzgg/2025/0428/86916.html';
const BEIJING_SCORE_PAGE_URL = 'https://www.bjeea.cn/html/gkgz/tzgg/2025/0718/87250.html';
const GUANGXI_RULE_URL = 'https://www.gxeea.cn/view/content_1013_31721.htm';
const NEIMENGGU_RULE_URL = 'https://www.nmg.gov.cn/zwgk/zdxxgk/shgysyjs/jyfz/gdjy/202502/t20250208_2663466.html';
const NEIMENGGU_SCORE_PAGE_URL = 'https://www.nm.zsks.cn/25gktdlq/zdxlqzgdf-bktqb-dyc-ysty/tj/lqzgzdf.html';

const RULES: RuleSeed[] = [
  ...['音乐类', '舞蹈类', '表（导）演类', '美术与设计类', '书法类'].map(artCategory => ({
    province: '安徽',
    year: YEAR,
    artCategory,
    batch: '本科',
    subjectType: '不限',
    formulaType: 'weighted',
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    sourceName: '安徽省教育招生考试院（中国教育在线转载）',
    sourceUrl: ANHUI_RULE_URL,
    sourceType: 'official_anhui_art_rule_reprint',
    notes: '综合分1=文化课成绩×50%+专业统考成绩×2.5×50%，适用于音乐类、舞蹈类、表（导）演类、美术与设计类、书法类专业。',
  })),
  {
    province: '安徽',
    year: YEAR,
    artCategory: '播音与主持类',
    batch: '本科',
    subjectType: '不限',
    formulaType: 'weighted',
    cultureWeight: 0.7,
    professionalWeight: 0.3,
    sourceName: '安徽省教育招生考试院（中国教育在线转载）',
    sourceUrl: ANHUI_RULE_URL,
    sourceType: 'official_anhui_art_rule_reprint',
    notes: '综合分2=文化课成绩×70%+专业统考成绩×2.5×30%，适用于播音与主持类专业。',
  },
  ...['音乐类', '舞蹈类', '表（导）演类', '美术与设计类', '书法类', '播音与主持类'].map(artCategory => ({
    province: '福建',
    year: YEAR,
    artCategory,
    batch: '本科',
    subjectType: '不限',
    formulaType: 'weighted',
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    sourceName: '福建省教育考试院',
    sourceUrl: FUJIAN_RULE_URL,
    sourceType: 'official_fujian_art_rule',
    notes: '艺术类综合分=（考生文考总分+政策性加分）×50%+考生省级专业统考成绩×2.5×50%。',
  })),
  ...['音乐类', '舞蹈类', '表（导）演类', '美术与设计类', '书法类'].map(artCategory => ({
    province: '吉林',
    year: YEAR,
    artCategory,
    batch: '本科',
    subjectType: '不限',
    formulaType: 'weighted',
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    sourceName: '吉林省教育考试院',
    sourceUrl: JILIN_RULE_URL,
    sourceType: 'official_jilin_art_rule',
    notes: '综合分=〔（高考文化分÷文化满分）×50%+（专业分÷专业满分）×50%〕×750。',
  })),
  {
    province: '吉林',
    year: YEAR,
    artCategory: '播音与主持类',
    batch: '本科',
    subjectType: '不限',
    formulaType: 'weighted',
    cultureWeight: 0.7,
    professionalWeight: 0.3,
    sourceName: '吉林省教育考试院',
    sourceUrl: JILIN_RULE_URL,
    sourceType: 'official_jilin_art_rule',
    notes: '播音与主持类综合分=〔（高考文化分÷文化满分）×70%+（专业分÷专业满分）×30%〕×750。',
  },
  ...[
    ['美术与设计类', 0.4, 0.6, '美术与设计类专业平行志愿综合成绩=（高考文化成绩×40%+省统考专业成绩×60%）×2。'],
    ['音乐类', 0.4, 0.6, '音乐类（含音乐表演、音乐教育招考方向）平行志愿综合成绩=（高考文化成绩×40%+省统考专业成绩×60%）×2。'],
    ['舞蹈类', 0.3, 0.7, '舞蹈类平行志愿综合成绩=（高考文化成绩×30%+省统考专业成绩×70%）×2。'],
  ].map(([artCategory, cultureWeight, professionalWeight, notes]) => ({
    province: '湖北',
    year: YEAR,
    artCategory: String(artCategory),
    batch: '本科',
    subjectType: '不限',
    formulaType: 'hubei_double_2025',
    cultureFullScore: 750,
    professionalFullScore: 300,
    cultureWeight: Number(cultureWeight),
    professionalWeight: Number(professionalWeight),
    scaleTo: 2,
    sourceName: '湖北省教育厅',
    sourceUrl: HUBEI_RULE_URL,
    sourceType: 'official_hubei_art_rule',
    notes: String(notes),
  })),
  ...['播音与主持类', '书法类'].map(artCategory => ({
    province: '湖北',
    year: YEAR,
    artCategory,
    batch: '本科',
    subjectType: '不限',
    formulaType: 'sum',
    cultureFullScore: 750,
    professionalFullScore: 300,
    cultureWeight: 1,
    professionalWeight: 1,
    scaleTo: 1050,
    sourceName: '湖北省教育厅',
    sourceUrl: HUBEI_RULE_URL,
    sourceType: 'official_hubei_art_rule',
    notes: `${artCategory}专业平行志愿综合成绩=高考文化成绩+省统考专业成绩。`,
  })),
  ...['音乐类', '舞蹈类', '表（导）演类'].map(artCategory => ({
    province: '江苏',
    year: YEAR,
    artCategory,
    batch: '本科',
    formulaType: 'weighted',
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    sourceName: '江苏省教育考试院',
    sourceUrl: JIANGSU_RULE_URL,
    sourceType: 'official_jiangsu_art_rule',
    notes: '投档分=〔（高考文化分÷文化满分）×50%+（专业分÷专业满分）×50%〕×750，结果四舍五入取整。',
  })),
  ...['美术与设计类', '书法类'].map(artCategory => ({
    province: '江苏',
    year: YEAR,
    artCategory,
    batch: '本科',
    formulaType: 'weighted',
    cultureWeight: 0.6,
    professionalWeight: 0.4,
    sourceName: '江苏省教育考试院',
    sourceUrl: JIANGSU_RULE_URL,
    sourceType: 'official_jiangsu_art_rule',
    notes: '投档分=〔（高考文化分÷文化满分）×60%+（专业分÷专业满分）×40%〕×750，结果四舍五入取整。',
  })),
  {
    province: '江苏',
    year: YEAR,
    artCategory: '播音与主持类',
    batch: '本科',
    formulaType: 'weighted',
    cultureWeight: 0.7,
    professionalWeight: 0.3,
    sourceName: '江苏省教育考试院',
    sourceUrl: JIANGSU_RULE_URL,
    sourceType: 'official_jiangsu_art_rule',
    notes: '投档分=〔（高考文化分÷文化满分）×70%+（专业分÷专业满分）×30%〕×750，结果四舍五入取整。',
  },
  ...['美术与设计类', '音乐类', '舞蹈类', '表（导）演类', '书法类'].map(artCategory => ({
    province: '浙江',
    year: YEAR,
    artCategory,
    batch: '本科',
    formulaType: 'zhejiang_2025',
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    sourceName: '浙江省教育考试院',
    sourceUrl: ZHEJIANG_RULE_URL,
    sourceType: 'official_zhejiang_art_rule',
    notes: '综合分=高考总分×50%+专业省统考成绩×2.5×50%。',
  })),
  {
    province: '浙江',
    year: YEAR,
    artCategory: '播音与主持类',
    batch: '本科',
    formulaType: 'zhejiang_2025',
    cultureWeight: 0.8,
    professionalWeight: 0.2,
    sourceName: '浙江省教育考试院',
    sourceUrl: ZHEJIANG_RULE_URL,
    sourceType: 'official_zhejiang_art_rule',
    notes: '综合分=高考总分×80%+专业省统考成绩×2.5×20%。',
  },
  ...['美术与设计类', '书法类', '舞蹈类', '音乐类', '播音与主持类', '表（导）演类'].map(artCategory => ({
    province: '山东',
    year: YEAR,
    artCategory,
    batch: '本科',
    formulaType: 'weighted',
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    sourceName: '山东省教育招生考试院',
    sourceUrl: SHANDONG_RULE_URL,
    sourceType: 'official_shandong_art_rule',
    notes: '后台先按综合成绩满分750、专业统考满分300的通用口径维护；投档线导入官方已公布的综合分，实际规则可在后台继续细化。',
  })),
  ...['美术与设计类', '音乐类', '舞蹈类', '表（导）演类', '书法类'].map(artCategory => ({
    province: '河北',
    year: YEAR,
    artCategory,
    batch: '本科',
    formulaType: 'weighted',
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    sourceName: '河北省教育考试院',
    sourceUrl: HEBEI_RULE_URL,
    sourceType: 'official_hebei_art_rule',
    notes: '综合成绩=高考文化总成绩（含政策性加分）×0.5+（专业成绩÷专业满分）×750×0.5，结果四舍五入保留3位小数。',
  })),
  {
    province: '河北',
    year: YEAR,
    artCategory: '播音与主持类',
    batch: '本科',
    formulaType: 'weighted',
    cultureWeight: 0.7,
    professionalWeight: 0.3,
    sourceName: '河北省教育考试院',
    sourceUrl: HEBEI_RULE_URL,
    sourceType: 'official_hebei_art_rule',
    notes: '播音与主持类综合成绩=高考文化总成绩（含政策性加分）×0.7+（专业成绩÷专业满分）×750×0.3，结果四舍五入保留3位小数。',
  },
  ...['美术与设计类', '音乐类', '舞蹈类', '表（导）演类', '书法类'].map(artCategory => ({
    province: '湖南',
    year: YEAR,
    artCategory,
    batch: '本科',
    formulaType: 'hunan_2025',
    cultureWeight: 0.3,
    professionalWeight: 0.7,
    scaleTo: 300,
    sourceName: '湖南省教育考试院',
    sourceUrl: HUNAN_RULE_URL,
    sourceType: 'official_hunan_art_rule',
    notes: '综合成绩=高考文化成绩（含政策性加分）×30%+专业统考成绩×70%。',
  })),
  {
    province: '湖南',
    year: YEAR,
    artCategory: '播音与主持类',
    batch: '本科',
    formulaType: 'hunan_broadcast_2025',
    cultureWeight: 1,
    professionalWeight: 1,
    scaleTo: 750,
    sourceName: '湖南省教育考试院',
    sourceUrl: HUNAN_RULE_URL,
    sourceType: 'official_hunan_art_rule',
    notes: '播音与主持类综合成绩=高考文化成绩（含政策性加分）+专业统考成绩。',
  },
  ...['美术与设计类', '音乐类', '舞蹈类', '表（导）演类', '书法类'].map(artCategory => ({
    province: '江西',
    year: YEAR,
    artCategory,
    batch: '本科',
    formulaType: 'weighted',
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    sourceName: '江西省教育考试院',
    sourceUrl: JIANGXI_RULE_URL,
    sourceType: 'official_jiangxi_art_rule',
    notes: '音乐类、舞蹈类、戏剧影视表演/服装表演方向、美术与设计类、书法类综合成绩=文化总成绩（含政策性加分）×50%+（专业成绩/300）×750×50%，四舍五入保留两位小数。',
  })),
  {
    province: '江西',
    year: YEAR,
    artCategory: '播音与主持类',
    batch: '本科',
    formulaType: 'weighted',
    cultureWeight: 0.7,
    professionalWeight: 0.3,
    sourceName: '江西省教育考试院',
    sourceUrl: JIANGXI_RULE_URL,
    sourceType: 'official_jiangxi_art_rule',
    notes: '播音与主持类及戏剧影视导演方向综合成绩=文化总成绩（含政策性加分）×70%+（专业成绩/300）×750×30%，四舍五入保留两位小数。',
  },
  ...[
    ['美术与设计类', 0.5, 0.5],
    ['音乐类', 0.5, 0.5],
    ['舞蹈类', 0.5, 0.5],
    ['表（导）演类', 0.5, 0.5],
    ['书法类', 0.5, 0.5],
    ['播音与主持类', 0.6, 0.4],
  ].map(([artCategory, cultureWeight, professionalWeight]) => ({
    province: '广东',
    year: YEAR,
    artCategory: String(artCategory),
    batch: '本科',
    formulaType: 'guangdong_2025',
    cultureWeight: Number(cultureWeight),
    professionalWeight: Number(professionalWeight),
    sourceName: '广东省教育考试院',
    sourceUrl: GUANGDONG_RULE_URL,
    sourceType: 'official_guangdong_art_rule',
    notes: '投档总分=文化课成绩×文化权重+省统考成绩×2.5×专业权重。',
  })),
  ...['美术与设计类', '音乐类', '舞蹈类', '播音与主持类', '表（导）演类', '书法类'].map(artCategory => ({
    province: '山西',
    year: YEAR,
    artCategory,
    batch: '本科',
    formulaType: 'weighted',
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    sourceName: '山西省招生考试管理中心',
    sourceUrl: SHANXI_RULE_URL,
    sourceType: 'official_shanxi_art_rule',
    notes: '艺术类综合成绩=高考总成绩×50%+（专业省级统考成绩×2.5）×50%，保留两位小数。',
  })),
  ...['美术与设计类', '音乐类', '舞蹈类', '播音与主持类', '表（导）演类', '书法类'].map(artCategory => ({
    province: '上海',
    year: YEAR,
    artCategory,
    batch: '本科',
    formulaType: 'shanghai_2025',
    cultureFullScore: 660,
    professionalFullScore: 300,
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    scaleTo: 660,
    sourceName: '上海市教育委员会',
    sourceUrl: SHANGHAI_RULE_URL,
    sourceType: 'official_shanghai_art_rule',
    notes: '本科投档成绩=文化成绩×50%+专业统考成绩×660/300×50%，投档成绩四舍五入保留四位小数。',
  })),
  ...[
    ['美术与设计类', 0.6, 0.4],
    ['书法类', 0.6, 0.4],
    ['音乐类', 0.5, 0.5],
    ['舞蹈类', 0.5, 0.5],
    ['表（导）演类', 0.5, 0.5],
  ].map(([artCategory, cultureWeight, professionalWeight]) => ({
    province: '黑龙江',
    year: YEAR,
    artCategory: String(artCategory),
    batch: '本科',
    formulaType: 'weighted',
    cultureWeight: Number(cultureWeight),
    professionalWeight: Number(professionalWeight),
    sourceName: '黑龙江省招生考试院',
    sourceUrl: HEILONGJIANG_RULE_URL,
    sourceType: 'official_heilongjiang_art_rule',
    notes: '综合分=（专业课成绩÷专业课满分×750）×专业权重+文化课成绩（含照顾政策分）×文化权重，四舍五入保留两位小数。',
  })),
  {
    province: '黑龙江',
    year: YEAR,
    artCategory: '播音与主持类',
    batch: '本科',
    formulaType: 'heilongjiang_broadcast_2025',
    cultureWeight: 0.8,
    professionalWeight: 0.2,
    sourceName: '黑龙江省招生考试院',
    sourceUrl: HEILONGJIANG_RULE_URL,
    sourceType: 'official_heilongjiang_art_rule',
    notes: '播音与主持类综合分=专业课成绩×20%+文化课成绩（含照顾政策分）×80%，四舍五入保留两位小数。',
  },
  ...[
    ['美术与设计类', 0.6, 0.4, '美术与设计类、书法类综合分=文化课成绩/文化课总分×100×60%+专业课成绩/专业课总分×100×40%，保留1位小数。'],
    ['书法类', 0.6, 0.4, '美术与设计类、书法类综合分=文化课成绩/文化课总分×100×60%+专业课成绩/专业课总分×100×40%，保留1位小数。'],
    ['音乐类', 0.5, 0.5, '音乐类、舞蹈类、戏剧影视表演、服装表演、播音与主持类综合分=文化课成绩/文化课总分×100×50%+专业课成绩/专业课总分×100×50%，保留1位小数。'],
    ['舞蹈类', 0.5, 0.5, '音乐类、舞蹈类、戏剧影视表演、服装表演、播音与主持类综合分=文化课成绩/文化课总分×100×50%+专业课成绩/专业课总分×100×50%，保留1位小数。'],
    ['表（导）演类', 0.5, 0.5, '表（导）演类中戏剧影视表演、服装表演按50%/50%；戏剧影视导演方向按文化70%/专业30%，当前前端未拆二级方向，后台可进一步细化。'],
    ['播音与主持类', 0.5, 0.5, '音乐类、舞蹈类、戏剧影视表演、服装表演、播音与主持类综合分=文化课成绩/文化课总分×100×50%+专业课成绩/专业课总分×100×50%，保留1位小数。'],
  ].map(([artCategory, cultureWeight, professionalWeight, notes]) => ({
    province: '辽宁',
    year: YEAR,
    artCategory: String(artCategory),
    batch: '本科',
    formulaType: 'liaoning_2025',
    cultureFullScore: 750,
    professionalFullScore: 300,
    cultureWeight: Number(cultureWeight),
    professionalWeight: Number(professionalWeight),
    scaleTo: 100,
    sourceName: '辽宁省招生考试办公室',
    sourceUrl: LIAONING_RULE_URL,
    sourceType: 'official_liaoning_art_rule',
    notes: String(notes),
  })),
  ...['美术与设计类', '音乐类', '舞蹈类', '播音与主持类', '表（导）演类', '书法类'].map(artCategory => ({
    province: '北京',
    year: YEAR,
    artCategory,
    batch: '本科',
    subjectType: '综合改革',
    formulaType: 'weighted',
    cultureFullScore: 750,
    professionalFullScore: 300,
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    scaleTo: 750,
    sourceName: '北京教育考试院',
    sourceUrl: BEIJING_RULE_URL,
    sourceType: 'official_beijing_art_rule',
    notes: '本科综合分=艺术类统考成绩/300×750×50%+高考文化课成绩×50%，结果四舍五入取整数。',
  })),
  ...['美术与设计类', '音乐类', '舞蹈类', '播音与主持类', '表（导）演类', '书法类'].map(artCategory => ({
    province: '广西',
    year: YEAR,
    artCategory,
    batch: '本科',
    formulaType: 'weighted',
    cultureFullScore: 750,
    professionalFullScore: 300,
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    scaleTo: 750,
    sourceName: '广西招生考试院',
    sourceUrl: GUANGXI_RULE_URL,
    sourceType: 'official_guangxi_art_rule',
    notes: '综合分=高考总分×50%+艺术统考成绩×（750/300）×50%。',
  })),
  ...['音乐类', '舞蹈类', '表（导）演类'].map(artCategory => ({
    province: '内蒙古',
    year: YEAR,
    artCategory,
    batch: '本科',
    formulaType: 'weighted',
    cultureFullScore: 750,
    professionalFullScore: 300,
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    scaleTo: 750,
    sourceName: '内蒙古自治区教育考试院',
    sourceUrl: NEIMENGGU_RULE_URL,
    sourceType: 'official_neimenggu_art_rule',
    notes: '投档分=（高考文化分÷文化满分）×50%×750+（专业分÷专业满分）×50%×750。',
  })),
  ...['美术与设计类', '书法类'].map(artCategory => ({
    province: '内蒙古',
    year: YEAR,
    artCategory,
    batch: '本科',
    formulaType: 'weighted',
    cultureFullScore: 750,
    professionalFullScore: 300,
    cultureWeight: 0.6,
    professionalWeight: 0.4,
    scaleTo: 750,
    sourceName: '内蒙古自治区教育考试院',
    sourceUrl: NEIMENGGU_RULE_URL,
    sourceType: 'official_neimenggu_art_rule',
    notes: '投档分=（高考文化分÷文化满分）×60%×750+（专业分÷专业满分）×40%×750。',
  })),
  {
    province: '内蒙古',
    year: YEAR,
    artCategory: '播音与主持类',
    batch: '本科',
    formulaType: 'weighted',
    cultureFullScore: 750,
    professionalFullScore: 300,
    cultureWeight: 0.7,
    professionalWeight: 0.3,
    scaleTo: 750,
    sourceName: '内蒙古自治区教育考试院',
    sourceUrl: NEIMENGGU_RULE_URL,
    sourceType: 'official_neimenggu_art_rule',
    notes: '投档分=（高考文化分÷文化满分）×70%×750+（专业分÷专业满分）×30%×750。',
  },
];

const SCORE_SOURCES: ScoreSource[] = [
  {
    key: 'zhejiang-art-first',
    province: '浙江',
    batch: '本科',
    file: 'zhejiang-art-first-2025.xls',
    url: 'https://www.zjzs.net/module/download/downfile.jsp?classid=0&showname=%E6%B5%99%E6%B1%9F%E7%9C%812025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E6%A0%A1%E6%8B%9B%E7%94%9F%E8%89%BA%E6%9C%AF%E7%B1%BB%E7%BB%9F%E8%80%83%E6%89%B9%E7%AC%AC%E4%B8%80%E6%AE%B5%E5%B9%B3%E8%A1%8C%E6%8A%95%E6%A1%A3%E5%88%86%E6%95%B0%E7%BA%BF.XLS&filename=caa6ded871724ea6b28ff8ce14621300.xls',
    sourceName: '浙江省教育考试院',
    sourceType: 'official_zhejiang_art_first_xls',
    parser: 'zhejiang_art_xls',
  },
  {
    key: 'shandong-art-design',
    province: '山东',
    batch: '本科',
    artCategory: '美术与设计类',
    file: 'sd-art-design-2025.xls',
    url: 'https://www.sdzk.cn/Floadup/file/20250717/6388837640785942719917138.xls',
    sourceName: '山东省教育招生考试院',
    sourceType: 'official_shandong_art_design_xls',
    parser: 'shandong_art_xls',
  },
  {
    key: 'shandong-calligraphy',
    province: '山东',
    batch: '本科',
    artCategory: '书法类',
    file: 'sd-calligraphy-2025.xls',
    url: 'https://www.sdzk.cn/Floadup/file/20250717/6388837642571858185562141.xls',
    sourceName: '山东省教育招生考试院',
    sourceType: 'official_shandong_calligraphy_xls',
    parser: 'shandong_art_xls',
  },
  {
    key: 'shandong-dance',
    province: '山东',
    batch: '本科',
    artCategory: '舞蹈类',
    file: 'sd-dance-2025.xls',
    url: 'https://www.sdzk.cn/Floadup/file/20250717/6388837643068557179242789.xls',
    sourceName: '山东省教育招生考试院',
    sourceType: 'official_shandong_dance_xls',
    parser: 'shandong_art_xls',
  },
  {
    key: 'shandong-music',
    province: '山东',
    batch: '本科',
    artCategory: '音乐类',
    file: 'sd-music-2025.xls',
    url: 'https://www.sdzk.cn/Floadup/file/20250717/6388837643674932504424908.xls',
    sourceName: '山东省教育招生考试院',
    sourceType: 'official_shandong_music_xls',
    parser: 'shandong_art_xls',
  },
  {
    key: 'shandong-music-supplement',
    province: '山东',
    batch: '本科',
    artCategory: '音乐类',
    file: 'sd-music-supplement-2025.xls',
    url: 'https://www.sdzk.cn/Floadup/file/20250718/6388845230396829291929485.xls',
    sourceName: '山东省教育招生考试院',
    sourceType: 'official_shandong_music_supplement_xls',
    parser: 'shandong_art_xls',
  },
  {
    key: 'shandong-broadcast',
    province: '山东',
    batch: '本科',
    artCategory: '播音与主持类',
    file: 'sd-broadcast-2025.xls',
    url: 'https://www.sdzk.cn/Floadup/file/20250717/6388837645732787098637947.xls',
    sourceName: '山东省教育招生考试院',
    sourceType: 'official_shandong_broadcast_xls',
    parser: 'shandong_art_xls',
  },
  {
    key: 'shandong-performance-directing',
    province: '山东',
    batch: '本科',
    artCategory: '表（导）演类',
    file: 'sd-performance-directing-2025.xls',
    url: 'https://www.sdzk.cn/Floadup/file/20250717/6388837646352899125075962.xls',
    sourceName: '山东省教育招生考试院',
    sourceType: 'official_shandong_performance_directing_xls',
    parser: 'shandong_art_xls',
  },
  ...[
    ['hebei-music-vocal', '音乐类', 'hebei-music-vocal-2025.xlsx', 'http://file.hebeea.edu.cn/files/article/2025/07/20250714102004_698.xlsx'],
    ['hebei-music-instrumental', '音乐类', 'hebei-music-instrumental-2025.xlsx', 'http://file.hebeea.edu.cn/files/article/2025/07/20250714102004_142.xlsx'],
    ['hebei-dance', '舞蹈类', 'hebei-dance-2025.xlsx', 'http://file.hebeea.edu.cn/files/article/2025/07/20250714101955_678.xlsx'],
    ['hebei-art-design', '美术与设计类', 'hebei-art-design-2025.xlsx', 'http://file.hebeea.edu.cn/files/article/2025/07/20250714101955_937.xlsx'],
    ['hebei-performance-acting', '表（导）演类', 'hebei-performance-acting-2025.xlsx', 'http://file.hebeea.edu.cn/files/article/2025/07/20250714102004_484.xlsx'],
    ['hebei-performance-directing', '表（导）演类', 'hebei-performance-directing-2025.xlsx', 'http://file.hebeea.edu.cn/files/article/2025/07/20250714102004_411.xlsx'],
    ['hebei-calligraphy', '书法类', 'hebei-calligraphy-2025.xlsx', 'http://file.hebeea.edu.cn/files/article/2025/07/20250714101955_628.xlsx'],
    ['hebei-broadcast', '播音与主持类', 'hebei-broadcast-2025.xlsx', 'http://file.hebeea.edu.cn/files/article/2025/07/20250714101955_227.xlsx'],
    ['hebei-costume-performance', '表（导）演类', 'hebei-costume-performance-2025.xlsx', 'http://file.hebeea.edu.cn/files/article/2025/07/20250714101955_980.xlsx'],
  ].map(([key, artCategory, file, url]) => ({
    key,
    province: '河北',
    batch: '本科',
    subjectType: '不限',
    artCategory,
    file,
    url,
    sourceName: '河北省教育考试院',
    sourceType: `official_${key.replaceAll('-', '_')}_xlsx`,
    parser: 'hebei_art_xlsx' as const,
  })),
  ...[
    ['jiangsu-history-vocal', '历史类', '音乐类', 'js-art-history-voice-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-5306471824414854.xlsx'],
    ['jiangsu-history-instrumental', '历史类', '音乐类', 'js-art-history-instrumental-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-530650551242232.xlsx'],
    ['jiangsu-physics-vocal', '物理类', '音乐类', 'js-art-physics-voice-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-530645-1799721337.xlsx'],
    ['jiangsu-physics-instrumental', '物理类', '音乐类', 'js-art-physics-instrumental-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-530725252156288.xlsx'],
    ['jiangsu-history-dance', '历史类', '舞蹈类', 'js-art-history-dance-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-530727-705460362.xlsx'],
    ['jiangsu-physics-dance', '物理类', '舞蹈类', 'js-art-physics-dance-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-5307311910931328.xlsx'],
    ['jiangsu-history-performance', '历史类', '表（导）演类', 'js-art-history-performance-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-5307601287283151.xlsx'],
    ['jiangsu-physics-performance', '物理类', '表（导）演类', 'js-art-physics-performance-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-530763100771847.xlsx'],
    ['jiangsu-history-broadcast', '历史类', '播音与主持类', 'js-art-history-broadcast-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-5307661037202435.xlsx'],
    ['jiangsu-physics-broadcast', '物理类', '播音与主持类', 'js-art-physics-broadcast-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-5307921358109281.xlsx'],
    ['jiangsu-history-art-design', '历史类', '美术与设计类', 'js-art-history-art-design-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-530801854660881.xlsx'],
    ['jiangsu-physics-art-design', '物理类', '美术与设计类', 'js-art-physics-art-design-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-530801739888155.xlsx'],
    ['jiangsu-history-calligraphy', '历史类', '书法类', 'js-art-history-calligraphy-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-53082349786484.xlsx'],
    ['jiangsu-physics-calligraphy', '物理类', '书法类', 'js-art-physics-calligraphy-2025.xlsx', 'https://www.jseea.cn/webfile/upload/2025/07-13/09-17-530834385186169.xlsx'],
  ].map(([key, subjectType, artCategory, file, url]) => ({
    key,
    province: '江苏',
    batch: '本科',
    subjectType,
    artCategory,
    file,
    url,
    sourceName: '江苏省教育考试院',
    sourceType: `official_${key.replaceAll('-', '_')}_xlsx`,
    parser: 'jiangsu_art_xlsx' as const,
  })),
  {
    key: 'hunan-art-first',
    province: '湖南',
    batch: '本科',
    subjectType: '不限',
    file: 'hunan-art-first-2025.xlsx',
    url: 'https://www.hneeb.cn/hnxxg/741/742/2025071301.xlsx',
    sourceName: '湖南省教育考试院',
    sourceType: 'official_hunan_art_first_xlsx',
    parser: 'hunan_art_xlsx',
  },
  {
    key: 'jiangxi-art',
    province: '江西',
    batch: '本科',
    subjectType: '不限',
    file: 'jiangxi-art-2025.pdf',
    url: 'https://www.jxzjsx.com/dom/Download.php?id=61&type=1&username=zhurenjiaoyu',
    sourceName: '江西省教育考试院（主任教育转载附件）',
    sourceType: 'official_jiangxi_art_pdf',
    parser: 'jiangxi_art_pdf',
  },
  ...[
    ['guangdong-music', '音乐类', 'gd-art-music-2025.pdf', 'https://eea.gd.gov.cn/attachment/0/585/585888/4746781.pdf', ['official_guangdong_art_music_pdf']],
    ['guangdong-dance', '舞蹈类', 'gd-art-dance-2025.pdf', 'https://eea.gd.gov.cn/attachment/0/585/585889/4746781.pdf', ['official_guangdong_art_dance_pdf']],
    ['guangdong-art-design', '美术与设计类', 'gd-art-design-2025.pdf', 'https://eea.gd.gov.cn/attachment/0/585/585890/4746781.pdf', ['official_guangdong_art_art-design_pdf']],
    ['guangdong-calligraphy', '书法类', 'gd-art-calligraphy-2025.pdf', 'https://eea.gd.gov.cn/attachment/0/585/585891/4746781.pdf', []],
    ['guangdong-broadcast', '播音与主持类', 'gd-art-broadcast-2025.pdf', 'https://eea.gd.gov.cn/attachment/0/585/585892/4746781.pdf', ['official_guangdong_art_broadcast_pdf']],
    ['guangdong-performance-directing', '表（导）演类', 'gd-art-performance-2025.pdf', 'https://eea.gd.gov.cn/attachment/0/585/585893/4746781.pdf', ['official_guangdong_art_performance-directing_pdf']],
  ].map(([key, artCategory, file, url, legacySourceTypes]) => ({
    key: String(key),
    province: '广东',
    batch: '本科',
    artCategory: String(artCategory),
    file: String(file),
    url: String(url),
    sourceName: '广东省教育考试院',
    sourceType: `official_${String(key).replaceAll('-', '_')}_pdf`,
    legacySourceTypes: legacySourceTypes as string[],
    parser: 'guangdong_art_pdf' as const,
  })),
  ...[
    ['shanxi-music-vocal-performance', '音乐类', '山西-音乐表演-声乐-2025.pdf', 'http://www.sxkszx.cn/files/content2025/2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E9%99%A2%E6%A0%A1%E4%B8%93%E4%B8%9A%E7%BB%84%E6%8A%95%E6%A1%A3%E6%9C%80%E4%BD%8E%E5%88%86_D%E9%9F%B3%E4%B9%90%E8%A1%A8%E6%BC%94%EF%BC%88%E5%A3%B0%E4%B9%90%EF%BC%89.pdf'],
    ['shanxi-music-instrumental-performance', '音乐类', '山西-音乐表演-器乐-2025.pdf', 'http://www.sxkszx.cn/files/content2025/2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E9%99%A2%E6%A0%A1%E4%B8%93%E4%B8%9A%E7%BB%84%E6%8A%95%E6%A1%A3%E6%9C%80%E4%BD%8E%E5%88%86_E%E9%9F%B3%E4%B9%90%E8%A1%A8%E6%BC%94%EF%BC%88%E5%99%A8%E4%B9%90%EF%BC%89.pdf'],
    ['shanxi-music-vocal-education', '音乐类', '山西-音乐教育-声乐-2025.pdf', 'http://www.sxkszx.cn/files/content2025/2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E9%99%A2%E6%A0%A1%E4%B8%93%E4%B8%9A%E7%BB%84%E6%8A%95%E6%A1%A3%E6%9C%80%E4%BD%8E%E5%88%86_F%E9%9F%B3%E4%B9%90%E6%95%99%E8%82%B2%EF%BC%88%E5%A3%B0%E4%B9%90%EF%BC%89.pdf'],
    ['shanxi-music-instrumental-education', '音乐类', '山西-音乐教育-器乐-2025.pdf', 'http://www.sxkszx.cn/files/content2025/2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E9%99%A2%E6%A0%A1%E4%B8%93%E4%B8%9A%E7%BB%84%E6%8A%95%E6%A1%A3%E6%9C%80%E4%BD%8E%E5%88%86_G%E9%9F%B3%E4%B9%90%E6%95%99%E8%82%B2%EF%BC%88%E5%99%A8%E4%B9%90%EF%BC%89.pdf'],
    ['shanxi-dance', '舞蹈类', '山西-舞蹈类-2025.pdf', 'http://www.sxkszx.cn/files/content2025/2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E9%99%A2%E6%A0%A1%E4%B8%93%E4%B8%9A%E7%BB%84%E6%8A%95%E6%A1%A3%E6%9C%80%E4%BD%8E%E5%88%86_H%E8%88%9E%E8%B9%88%E7%B1%BB.pdf'],
    ['shanxi-broadcast', '播音与主持类', '山西-播音与主持类-2025.pdf', 'http://www.sxkszx.cn/files/content2025/2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E9%99%A2%E6%A0%A1%E4%B8%93%E4%B8%9A%E7%BB%84%E6%8A%95%E6%A1%A3%E6%9C%80%E4%BD%8E%E5%88%86_J%E6%92%AD%E9%9F%B3%E4%B8%8E%E4%B8%BB%E6%8C%81%E7%B1%BB.pdf'],
    ['shanxi-art-design', '美术与设计类', '山西-美术与设计类-2025.pdf', 'http://www.sxkszx.cn/files/content2025/2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E9%99%A2%E6%A0%A1%E4%B8%93%E4%B8%9A%E7%BB%84%E6%8A%95%E6%A1%A3%E6%9C%80%E4%BD%8E%E5%88%86_K%E7%BE%8E%E6%9C%AF%E4%B8%8E%E8%AE%BE%E8%AE%A1%E7%B1%BB.pdf'],
    ['shanxi-calligraphy', '书法类', '山西-书法类-2025.pdf', 'http://www.sxkszx.cn/files/content2025/2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E9%99%A2%E6%A0%A1%E4%B8%93%E4%B8%9A%E7%BB%84%E6%8A%95%E6%A1%A3%E6%9C%80%E4%BD%8E%E5%88%86_L%E4%B9%A6%E6%B3%95%E7%B1%BB.pdf'],
    ['shanxi-costume-performance', '表（导）演类', '山西-服装表演-2025.pdf', 'http://www.sxkszx.cn/files/content2025/2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E9%99%A2%E6%A0%A1%E4%B8%93%E4%B8%9A%E7%BB%84%E6%8A%95%E6%A1%A3%E6%9C%80%E4%BD%8E%E5%88%86_M%E6%9C%8D%E8%A3%85%E8%A1%A8%E6%BC%94.pdf'],
    ['shanxi-acting', '表（导）演类', '山西-戏剧影视表演-2025.pdf', 'http://www.sxkszx.cn/files/content2025/2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E9%99%A2%E6%A0%A1%E4%B8%93%E4%B8%9A%E7%BB%84%E6%8A%95%E6%A1%A3%E6%9C%80%E4%BD%8E%E5%88%86_N%E6%88%8F%E5%89%A7%E5%BD%B1%E8%A7%86%E8%A1%A8%E6%BC%94.pdf'],
    ['shanxi-directing', '表（导）演类', '山西-戏剧影视导演-2025.pdf', 'http://www.sxkszx.cn/files/content2025/2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E9%99%A2%E6%A0%A1%E4%B8%93%E4%B8%9A%E7%BB%84%E6%8A%95%E6%A1%A3%E6%9C%80%E4%BD%8E%E5%88%86_P%E6%88%8F%E5%89%A7%E5%BD%B1%E8%A7%86%E5%AF%BC%E6%BC%94.pdf'],
  ].map(([key, artCategory, file, url]) => ({
    key,
    province: '山西',
    batch: '本科',
    subjectType: '不限',
    artCategory,
    file,
    url,
    sourceName: '山西省招生考试管理中心',
    sourceType: `official_${key.replaceAll('-', '_')}_pdf`,
    parser: 'shanxi_art_pdf' as const,
  })),
  ...[
    ['shanghai-art-design', '美术与设计类', '上海-美术与设计类-2025.pdf', 'https://www.shmeea.edu.cn/download/20250713/01.pdf'],
    ['shanghai-acting', '表（导）演类', '上海-戏剧影视表演-2025.pdf', 'https://www.shmeea.edu.cn/download/20250713/02.pdf'],
    ['shanghai-directing', '表（导）演类', '上海-戏剧影视导演-2025.pdf', 'https://www.shmeea.edu.cn/download/20250713/03.pdf'],
    ['shanghai-costume-performance', '表（导）演类', '上海-服装表演-2025.pdf', 'https://www.shmeea.edu.cn/download/20250713/04.pdf'],
    ['shanghai-broadcast', '播音与主持类', '上海-播音与主持类-2025.pdf', 'https://www.shmeea.edu.cn/download/20250713/05.pdf'],
    ['shanghai-music-education', '音乐类', '上海-音乐教育-2025.pdf', 'https://www.shmeea.edu.cn/download/20250713/06.pdf'],
    ['shanghai-music-vocal-performance', '音乐类', '上海-音乐表演-声乐-2025.pdf', 'https://www.shmeea.edu.cn/download/20250713/07.pdf'],
    ['shanghai-music-instrumental-performance', '音乐类', '上海-音乐表演-器乐-2025.pdf', 'https://www.shmeea.edu.cn/download/20250713/08.pdf'],
    ['shanghai-calligraphy', '书法类', '上海-书法类-2025.pdf', 'https://www.shmeea.edu.cn/download/20250713/09.pdf'],
    ['shanghai-dance', '舞蹈类', '上海-舞蹈类-2025.pdf', 'https://www.shmeea.edu.cn/download/20250713/10.pdf'],
  ].map(([key, artCategory, file, url]) => ({
    key,
    province: '上海',
    batch: '本科',
    subjectType: '综合改革',
    artCategory,
    file,
    url,
    sourceName: '上海市教育考试院',
    sourceType: `official_${key.replaceAll('-', '_')}_pdf`,
    parser: 'shanghai_art_pdf' as const,
  })),
  ...[
    ['heilongjiang-art-design', '美术与设计类', '黑龙江-美术与设计类-2025.xlsx', 'https://www.lzk.hl.cn/gkpd/cjfb/202507/W020250717622083006458.xlsx'],
    ['heilongjiang-music', '音乐类', '黑龙江-音乐类-2025.xlsx', 'https://www.lzk.hl.cn/gkpd/cjfb/202507/W020250717622083071154.xlsx'],
    ['heilongjiang-dance', '舞蹈类', '黑龙江-舞蹈类-2025.xlsx', 'https://www.lzk.hl.cn/gkpd/cjfb/202507/W020250717622083126786.xlsx'],
    ['heilongjiang-broadcast', '播音与主持类', '黑龙江-播音与主持类-2025.xlsx', 'https://www.lzk.hl.cn/gkpd/cjfb/202507/W020250717622083174408.xlsx'],
    ['heilongjiang-performance', '表（导）演类', '黑龙江-表导演类-2025.xlsx', 'https://www.lzk.hl.cn/gkpd/cjfb/202507/W020250717622083229592.xlsx'],
    ['heilongjiang-calligraphy', '书法类', '黑龙江-书法类-2025.xlsx', 'https://www.lzk.hl.cn/gkpd/cjfb/202507/W020250717622083282483.xlsx'],
  ].map(([key, artCategory, file, url]) => ({
    key,
    province: '黑龙江',
    batch: '本科',
    subjectType: '不限',
    artCategory,
    file,
    url,
    sourceName: '黑龙江省招生考试院',
    sourceType: `official_${key.replaceAll('-', '_')}_xlsx`,
    parser: 'heilongjiang_art_xlsx' as const,
  })),
  {
    key: 'liaoning-history',
    province: '辽宁',
    batch: '本科',
    subjectType: '历史类',
    file: '辽宁-艺术本科批-历史-2025.pdf',
    url: 'https://www.lnzsks.com/lnzkbfiles/2025/2025yslbkfsx0713w01.pdf',
    sourceName: '辽宁省招生考试办公室',
    sourceType: 'official_liaoning_history_pdf',
    parser: 'liaoning_art_pdf',
  },
  {
    key: 'liaoning-physics',
    province: '辽宁',
    batch: '本科',
    subjectType: '物理类',
    file: '辽宁-艺术本科批-物理-2025.pdf',
    url: 'https://www.lnzsks.com/lnzkbfiles/2025/2025yslbkfsx0713l.pdf',
    sourceName: '辽宁省招生考试办公室',
    sourceType: 'official_liaoning_physics_pdf',
    parser: 'liaoning_art_pdf',
  },
  {
    key: 'beijing-art-b',
    province: '北京',
    batch: '本科',
    subjectType: '综合改革',
    file: '北京-本科提前批艺术类B段-2025.pdf',
    url: 'https://www.bjeea.cn/uploads/soft/250718/178-250GR01225.pdf',
    sourceName: '北京教育考试院',
    sourceType: 'official_beijing_art_b_pdf',
    parser: 'beijing_art_pdf',
  },
  {
    key: 'guangxi-art-physics',
    province: '广西',
    batch: '本科',
    subjectType: '物理类',
    file: '广西-艺术本科第二批-物理-2025.html',
    url: 'https://www.gxeea.cn/view/content_1013_31721.htm',
    sourceName: '广西招生考试院',
    sourceType: 'official_guangxi_art_physics_html',
    parser: 'guangxi_art_html',
  },
  {
    key: 'guangxi-art-history',
    province: '广西',
    batch: '本科',
    subjectType: '历史类',
    file: '广西-艺术本科第二批-历史-2025.html',
    url: 'https://www.gxeea.cn/view/content_624_31732.htm',
    sourceName: '广西招生考试院',
    sourceType: 'official_guangxi_art_history_html',
    parser: 'guangxi_art_html',
  },
  {
    key: 'neimenggu-art-first',
    province: '内蒙古',
    batch: '本科',
    subjectType: '不限',
    file: '内蒙古-本科提前批B段艺术类第一次-2025.json',
    url: 'http://www.nm.zsks.cn/25gktdlq/zdxlqzgdf-bktqb-dyc-ysty/data/lq2.json',
    sourceName: '内蒙古自治区教育考试院',
    sourceType: 'official_neimenggu_art_first_json',
    parser: 'neimenggu_art_json',
  },
];

async function download(url: string, filePath: string) {
  let buffer: Buffer;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`下载失败 ${response.status}: ${url}`);
    buffer = Buffer.from(await response.arrayBuffer());
  } catch (err) {
    if (!url.includes('jxzjsx.com') && !url.includes('gxeea.cn') && !url.includes('nm.zsks.cn')) throw err;
    buffer = await downloadUnsafeHttps(url);
  }
  if (buffer.length < 1024) throw new Error(`下载文件过小，疑似失败: ${url}`);
  await writeFile(filePath, buffer);
}

function downloadUnsafeHttps(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('http:') ? httpGet : httpsGet;
    const options = url.startsWith('http:') ? undefined : {
      rejectUnauthorized: false,
      secureOptions: cryptoConstants.SSL_OP_LEGACY_SERVER_CONNECT,
    };
    get(url, options as any, response => {
      const status = response.statusCode || 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        response.resume();
        downloadUnsafeHttps(new URL(location, url).href).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`下载失败 ${status}: ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function ensureFile(source: ScoreSource) {
  await mkdir(FILE_DIR, { recursive: true });
  const filePath = path.join(FILE_DIR, source.file);
  try {
    const buffer = await readFile(filePath);
    if (buffer.length >= 1024) return filePath;
  } catch {
    // download below
  }
  await download(source.url, filePath);
  return filePath;
}

function normalizeUniversityName(value: string) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[（(](?:中外合作办学|中外合作|中外合办|较高收费|单列专业)[）)]/g, '')
    .trim();
}

async function universityMap() {
  const rows = await prisma.university.findMany({ select: { id: true, name: true } });
  return new Map(rows.map(row => [normalizeUniversityName(row.name), row.id]));
}

function universityId(name: string, byName: Map<string, string>) {
  const normalized = normalizeUniversityName(name);
  const base = normalizeUniversityName(String(name).replace(/[（(].*?[）)]/g, ''));
  return byName.get(normalized) || byName.get(base) || null;
}

function readSheet(filePath: string) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' }) as any[][];
}

function firstNumber(value: unknown) {
  const match = String(value ?? '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function cleanCodeAndName(value: string) {
  const text = String(value || '').trim();
  const match = text.match(/^([A-Z0-9]{1,5})(.+)$/i);
  if (!match) return { code: null, name: text };
  return { code: match[1], name: match[2].trim() };
}

function normalizeArtCategory(value: string) {
  const text = String(value || '').trim();
  if (text.includes('美术')) return '美术与设计类';
  if (text.includes('播音')) return '播音与主持类';
  if (text.includes('书法')) return '书法类';
  if (text.includes('舞蹈')) return '舞蹈类';
  if (text.includes('音乐')) return '音乐类';
  if (text.includes('表') || text.includes('导') || text.includes('演')) return '表（导）演类';
  return text;
}

function normalizeNeimengguArtCategory(value: string) {
  const text = String(value || '').trim();
  if (text.includes('音乐')) return '音乐类';
  return normalizeArtCategory(text);
}

function artCategoryFromText(value: string) {
  return normalizeArtCategory(value);
}

function artCategoryFromGuangxiGroupCode(groupCode: string) {
  const first = String(groupCode || '').trim().charAt(0);
  if (first === '2') return '美术与设计类';
  if (first === '3') return '音乐类';
  if (first === '4') return '舞蹈类';
  if (first === '5') return '播音与主持类';
  if (first === '6') return '表（导）演类';
  if (first === '7') return '书法类';
  return '美术与设计类';
}

const SHANGHAI_UNIVERSITY_ALIASES: Record<string, string> = {
  上外贤达: '上海外国语大学贤达经济人文学院',
  上工程: '上海工程技术大学',
  上师天华: '上海师范大学天华学院',
  上应大: '上海应用技术大学',
  上海交大: '上海交通大学',
  上海体大: '上海体育大学',
  上海商院: '上海商学院',
  上海师大: '上海师范大学',
  上海戏剧: '上海戏剧学院',
  上海杉达: '上海杉达学院',
  上海海事: '上海海事大学',
  上海理工: '上海理工大学',
  上海电机: '上海电机学院',
  上海视觉: '上海视觉艺术学院',
  中侨大学: '上海中侨职业技术大学',
  中国美院: '中国美术学院',
  中国计量: '中国计量大学',
  二工大: '上海第二工业大学',
  东湖学院: '武汉东湖学院',
  丽江文旅: '丽江文化旅游学院',
  井冈山大: '井冈山大学',
  京工耿丹: '北京工业大学耿丹学院',
  兰州交大: '兰州交通大学',
  北京体育: '北京体育大学',
  北京印刷: '北京印刷学院',
  北京城市: '北京城市学院',
  北京林大: '北京林业大学',
  北京联大: '北京联合大学',
  北京语言: '北京语言大学',
  北金科院: '北京金融科技学院',
  北海艺术: '北海艺术设计学院',
  华东师大: '华东师范大学',
  华东理工: '华东理工大学',
  华中师大: '华中师范大学',
  南师泰州: '南京师范大学泰州学院',
  南京传媒: '南京传媒学院',
  南京信息: '南京信息工程大学',
  南京工程: '南京工程学院',
  南京师大: '南京师范大学',
  南京特师: '南京特殊教育师范学院',
  南京艺术: '南京艺术学院',
  南宁师大: '南宁师范大学',
  南昌师院: '南昌师范学院',
  南昌理工: '南昌理工学院',
  南昌航大: '南昌航空大学',
  南航科技: '南京航空航天大学金城学院',
  厦大嘉庚: '厦门大学嘉庚学院',
  合肥工大: '合肥工业大学',
  同济大学: '同济大学',
  哈工大: '哈尔滨工业大学',
  吉林动画: '吉林动画学院',
  吉林艺术: '吉林艺术学院',
  四川传媒: '四川传媒学院',
  四川工商: '四川工商学院',
  四川师大: '四川师范大学',
  四川影视: '四川电影电视学院',
  四川文艺: '四川文化艺术学院',
  四川美院: '四川美术学院',
  四川音乐: '四川音乐学院',
  地大北京: '中国地质大学（北京）',
  地大武汉: '中国地质大学（武汉）',
  大连工大: '大连工业大学',
  大连民族: '大连民族大学',
  大连艺术: '大连艺术学院',
  天津工大: '天津工业大学',
  天津师大: '天津师范大学',
  天津科大: '天津科技大学',
  太湖学院: '无锡太湖学院',
  山东师大: '山东师范大学',
  山西传媒: '山西传媒学院',
  平顶学院: '平顶山学院',
  广州体院: '广州体育学院',
  广州商院: '广州商学院',
  广西师大: '广西师范大学',
  广西艺术: '广西艺术学院',
  建桥学院: '上海建桥学院',
  成都东软: '成都东软学院',
  成都信息: '成都信息工程大学',
  成都文理: '成都文理学院',
  成都艺职: '成都艺术职业大学',
  景德学院: '景德镇学院',
  景德陶瓷: '景德镇陶瓷大学',
  景艺职大: '景德镇艺术职业大学',
  杭州师大: '杭州师范大学',
  昆明传媒: '昆明传媒学院',
  桂林理工: '桂林理工大学',
  桂林电子: '桂林电子科技大学',
  武昌理工: '武昌理工学院',
  武昌首义: '武昌首义学院',
  武汉传媒: '武汉传媒学院',
  武汉华夏: '武汉华夏理工学院',
  武汉城院: '武汉城市学院',
  武汉大学: '武汉大学',
  武汉工科: '武汉工程科技学院',
  武汉晴川: '武汉晴川学院',
  武汉理工: '武汉理工大学',
  武汉纺大: '武汉纺织大学',
  武汉轻工: '武汉轻工大学',
  江南大学: '江南大学',
  江西工程: '江西工程学院',
  江西服装: '江西服装学院',
  江西理工: '江西理工大学',
  江师科技: '江西师范大学科学技术学院',
  江西科技: '江西科技学院',
  江西科师: '江西科技师范大学',
  江西财大: '江西财经大学',
  河北传媒: '河北传媒学院',
  河南大学: '河南大学',
  河南工大: '河南工业大学',
  津商宝德: '天津商业大学宝德学院',
  浙江传媒: '浙江传媒学院',
  浙江师大: '浙江师范大学',
  浙江理工: '浙江理工大学',
  海口经院: '海口经济学院',
  淮北师大: '淮北师范大学',
  港中深圳: '香港中文大学（深圳）',
  湖北大学: '湖北大学',
  湖北工大: '湖北工业大学',
  湖北美院: '湖北美术学院',
  湖南工大: '湖南工业大学',
  湖南师大: '湖南师范大学',
  湖南理工: '湖南理工大学',
  湖南科技: '湖南科技大学',
  湖州师范: '湖州师范学院',
  理大城市: '大连理工大学城市学院',
  燕京理工: '燕京理工学院',
  立达学院: '上海立达学院',
  盐城师范: '盐城师范学院',
  福州外贸: '福州外语外贸学院',
  福建理工: '福建理工大学',
  西南交大: '西南交通大学',
  西南林大: '西南林业大学',
  西安工程: '西安工程大学',
  苏州科大: '苏州科技大学',
  西安美院: '西安美术学院',
  西安音乐: '西安音乐学院',
  赣应科院: '江西应用科技学院',
  赣南师大: '赣南师范大学',
  郑州大学: '郑州大学',
  郑州航空: '郑州航空工业管理学院',
  辽宁工程: '辽宁工程技术大学',
  重庆城科: '重庆城市科技学院',
  重庆外事: '重庆外语外事学院',
  重庆大学: '重庆大学',
  陕西科大: '陕西科技大学',
  集美大学: '集美大学',
  青岛电影: '青岛电影学院',
  中央戏剧: '中央戏剧学院',
  首师科德: '首都师范大学科德学院',
};

function normalizeShanghaiUniversityName(value: string) {
  const raw = String(value || '').trim();
  return SHANGHAI_UNIVERSITY_ALIASES[raw] || raw;
}

function parseRank(value: unknown) {
  const text = String(value ?? '');
  const match = text.match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function parseZhejiangArt(source: ScoreSource, filePath: string, byName: Map<string, string>): ScoreRow[] {
  const rows = readSheet(filePath).slice(1);
  return rows
    .filter(row => row[3] && row[5] && firstNumber(row[7]) !== null)
    .map(row => {
      const artCategory = normalizeArtCategory(row[1]);
      const universityName = String(row[3]).trim();
      const majorName = String(row[5]).trim();
      return {
        universityId: universityId(universityName, byName),
        universityName,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        artCategory,
        subjectType: '综合改革',
        majorName,
        groupCode: String(row[4] || '').trim() || null,
        minCompositeScore: firstNumber(row[7]),
        minRank: parseRank(row[8]),
        planCount: firstNumber(row[6]),
        admissionMethod: '艺术类统考批专业平行志愿',
        sourceName: source.sourceName,
        sourceUrl: source.url,
        sourceType: source.sourceType,
        dataQuality: 'official_structured',
        rawData: JSON.stringify({ categoryCode: row[0], artCategory: row[1], universityCode: row[2], universityName, majorCode: row[4], majorName, planCount: row[6], compositeScore: row[7], rank: row[8] }),
      };
    });
}

function parseShandongArt(source: ScoreSource, filePath: string, byName: Map<string, string>): ScoreRow[] {
  const rows = readSheet(filePath).slice(2);
  return rows
    .filter(row => row[0] && row[1] && firstNumber(row[3]) !== null)
    .map(row => {
      const major = cleanCodeAndName(String(row[0]));
      const university = cleanCodeAndName(String(row[1]));
      return {
        universityId: universityId(university.name, byName),
        universityName: university.name,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        artCategory: source.artCategory!,
        subjectType: '综合改革',
        majorName: major.name,
        groupCode: major.code,
        minCompositeScore: firstNumber(row[3]),
        planCount: firstNumber(row[2]),
        admissionMethod: '艺术类本科批第1次志愿',
        sourceName: source.sourceName,
        sourceUrl: source.url,
        sourceType: source.sourceType,
        dataQuality: 'official_structured',
        rawData: JSON.stringify({ majorCode: major.code, majorName: major.name, universityCode: university.code, universityName: university.name, planCount: row[2], compositeScore: row[3] }),
      };
    });
}

function parseJiangsuGroupName(value: string) {
  const text = String(value || '').replace(/\s+/g, '');
  const match = text.match(/^(.+?)(\d{2,3})专业组(?:\((.*?)\))?(?:\((.*?)\))?/);
  const universityName = match ? match[1] : text;
  const groupCode = match ? match[2] : null;
  const requirement = match?.[3] || null;
  const direction = match?.[4] || null;
  return { universityName, groupCode, requirement, direction };
}

function parseJiangsuArt(source: ScoreSource, filePath: string, byName: Map<string, string>): ScoreRow[] {
  const rows = readSheet(filePath).slice(5);
  return rows
    .filter(row => row[0] && row[1] && firstNumber(row[3]) !== null)
    .map(row => {
      const group = parseJiangsuGroupName(String(row[1]));
      const majorName = group.direction || source.artCategory!;
      return {
        universityId: universityId(group.universityName, byName),
        universityName: group.universityName,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        artCategory: source.artCategory!,
        subjectType: source.subjectType || '不限',
        majorName,
        groupCode: group.groupCode,
        groupName: group.groupCode ? `专业组${group.groupCode}` : null,
        minCompositeScore: firstNumber(row[3]),
        minCultureScore: firstNumber(row[4]),
        admissionMethod: '艺术类本科提前批次第2小批平行志愿',
        sourceName: source.sourceName,
        sourceUrl: source.url,
        sourceType: source.sourceType,
        dataQuality: 'official_structured',
        rawData: JSON.stringify({ universityCode: row[0], originalGroup: row[1], region: row[2], compositeScore: row[3], cultureScore: row[4], requirement: group.requirement, direction: group.direction }),
      };
    });
}

function cleanHebeiUniversityName(value: string) {
  return String(value || '')
    .replace(/\[[^\]]*]/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
}

function parseHebeiArt(source: ScoreSource, filePath: string, byName: Map<string, string>): ScoreRow[] {
  const rows = readSheet(filePath).slice(5);
  return rows
    .filter(row => row[0] && row[1] && row[3] && firstNumber(row[4]) !== null)
    .map(row => {
      const universityName = cleanHebeiUniversityName(String(row[1]));
      const majorName = String(row[3]).trim();
      return {
        universityId: universityId(universityName, byName),
        universityName,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        artCategory: source.artCategory!,
        subjectType: source.subjectType || '不限',
        majorName,
        groupCode: String(row[2] || '').trim() || null,
        minCompositeScore: firstNumber(row[4]),
        minCultureScore: firstNumber(row[5]),
        admissionMethod: '本科提前批B段平行志愿',
        sourceName: source.sourceName,
        sourceUrl: source.url,
        sourceType: source.sourceType,
        dataQuality: 'official_structured',
        rawData: JSON.stringify({ universityCode: row[0], originalUniversityName: row[1], majorCode: row[2], majorName, compositeScore: row[4], cultureScore: row[5], remark: row[13] }),
      };
    });
}

function parseHunanArt(source: ScoreSource, filePath: string, byName: Map<string, string>): ScoreRow[] {
  const rows = readSheet(filePath).slice(3);
  return rows
    .filter(row => row[2] && row[3] && row[4] && row[5] && firstNumber(row[6]) !== null)
    .map(row => {
      const universityName = String(row[3]).trim();
      const groupName = String(row[5]).trim();
      const artCategory = artCategoryFromText(groupName);
      return {
        universityId: universityId(universityName, byName),
        universityName,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        artCategory,
        subjectType: source.subjectType || '不限',
        majorName: groupName,
        groupCode: String(row[4] || '').trim() || null,
        groupName,
        minCompositeScore: firstNumber(row[6]),
        minCultureScore: firstNumber(row[7]),
        admissionMethod: '本科提前批艺术类平行组第一次投档',
        sourceName: source.sourceName,
        sourceUrl: source.url,
        sourceType: source.sourceType,
        dataQuality: 'official_structured',
        rawData: JSON.stringify({ planCategory: row[0], subject: row[1], universityCode: row[2], universityName, groupCode: row[4], groupName, compositeScore: row[6], cultureScore: row[7], remark: row[15] }),
      };
    });
}

async function parseGuangdongArt(source: ScoreSource, filePath: string, byName: Map<string, string>): Promise<ScoreRow[]> {
  const parser = new PDFParse({ data: await readFile(filePath) });
  const data = await parser.getText();
  const linePattern = /^(\d{5})\s+(.+?)\s+(\d{3})\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+)$/;
  const rows: ScoreRow[] = [];
  for (const rawLine of data.text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    const [, schoolCode, universityName, groupCode, planCount, admittedCount, minCompositeScore, minRank] = match;
    rows.push({
      universityId: universityId(universityName, byName),
      universityName: universityName.trim(),
      province: source.province,
      year: YEAR,
      batch: source.batch,
      artCategory: source.artCategory!,
      subjectType: '不限',
      groupCode,
      groupName: `专业组${groupCode}`,
      minCompositeScore: Number(minCompositeScore),
      minRank: Number(minRank),
      planCount: Number(planCount),
      admissionMethod: '艺术类统考本科批',
      sourceName: source.sourceName,
      sourceUrl: source.url,
      sourceType: source.sourceType,
      dataQuality: 'official_pdf',
      rawData: JSON.stringify({ schoolCode, universityName, groupCode, planCount: Number(planCount), admittedCount: Number(admittedCount), minCompositeScore: Number(minCompositeScore), minRank: Number(minRank) }),
    });
  }
  return rows;
}

function liaoningArtCategoryFromMajor(majorName: string) {
  const text = String(majorName || '');
  if (text.includes('播音')) return '播音与主持类';
  if (text.includes('书法')) return '书法类';
  if (text.includes('舞蹈')) return '舞蹈类';
  if (text.includes('音乐') || text.includes('作曲') || text.includes('录音')) return '音乐类';
  if (text.includes('表演') || text.includes('戏剧影视导演') || text.includes('航空服务')) return '表（导）演类';
  return '美术与设计类';
}

async function parseLiaoningArt(source: ScoreSource, filePath: string, byName: Map<string, string>): Promise<ScoreRow[]> {
  const parser = new PDFParse({ data: await readFile(filePath) });
  const data = await parser.getText();
  const rows: ScoreRow[] = [];
  const linePattern = /^(\d{4})\s+(.+?)\s+([A-Z0-9]{2})\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/;

  for (const rawLine of data.text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    const [, universityCode, universityName, majorCode, majorName, minCompositeScore, cultureScore, chineseMathTotal, chineseMathBest, foreignScore, firstSubjectScore, secondSubjectBest, secondSubjectSecond, preferenceNo] = match;
    rows.push({
      universityId: universityId(universityName, byName),
      universityName,
      province: source.province,
      year: YEAR,
      batch: source.batch,
      artCategory: liaoningArtCategoryFromMajor(majorName),
      subjectType: source.subjectType || '不限',
      majorName,
      groupCode: majorCode,
      groupName: majorName,
      minCompositeScore: Number(minCompositeScore),
      minCultureScore: Number(cultureScore),
      admissionMethod: '艺术类本科批平行志愿',
      sourceName: source.sourceName,
      sourceUrl: LIAONING_SCORE_PAGE_URL,
      sourceType: source.sourceType,
      dataQuality: 'official_pdf',
      rawData: JSON.stringify({ universityCode, universityName, majorCode, majorName, minCompositeScore: Number(minCompositeScore), cultureScore: Number(cultureScore), chineseMathTotal: Number(chineseMathTotal), chineseMathBest: Number(chineseMathBest), foreignScore: Number(foreignScore), firstSubjectScore: Number(firstSubjectScore), secondSubjectBest: Number(secondSubjectBest), secondSubjectSecond: Number(secondSubjectSecond), preferenceNo: Number(preferenceNo), sourcePdf: source.url }),
    });
  }
  return rows;
}

function beijingArtCategoryFromGroup(groupName: string) {
  const text = String(groupName || '');
  if (text.includes('美术')) return '美术与设计类';
  if (text.includes('书法')) return '书法类';
  if (text.includes('舞蹈')) return '舞蹈类';
  if (text.includes('播主')) return '播音与主持类';
  if (text.includes('音表') || text.includes('音教')) return '音乐类';
  if (text.includes('表演') || text.includes('服表') || text.includes('导演')) return '表（导）演类';
  return normalizeArtCategory(text);
}

async function parseBeijingArt(source: ScoreSource, filePath: string, byName: Map<string, string>): Promise<ScoreRow[]> {
  const parser = new PDFParse({ data: await readFile(filePath) });
  const data = await parser.getText();
  const rows: ScoreRow[] = [];
  const linePattern = /^(\d+)\s+(\d{4})\s+(.+?)\s+(\d{2})\s+(.+?)\s+(\d{3})(?:\s+(\d{3}))?(?:\s+(\d{2,3}))?(?:\s+(\d{2,3}))?(?:\s+(\d{2,3}))?(?:\s+(\d{3}))?(?:\s+(.+))?$/;

  for (const rawLine of data.text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    const [, serialNo, universityCode, universityName, groupCode, groupName, minCompositeScore, professionalScore, chineseScore, mathScore, foreignScore, electiveScore, remark] = match;
    const artCategory = beijingArtCategoryFromGroup(groupName);
    if (!artCategory || !['美术与设计类', '音乐类', '舞蹈类', '播音与主持类', '表（导）演类', '书法类'].includes(artCategory)) continue;
    rows.push({
      universityId: universityId(universityName, byName),
      universityName,
      province: source.province,
      year: YEAR,
      batch: source.batch,
      artCategory,
      subjectType: source.subjectType || '综合改革',
      majorName: groupName,
      groupCode,
      groupName,
      minCompositeScore: Number(minCompositeScore),
      minProfessionalScore: professionalScore ? Number(professionalScore) : null,
      admissionMethod: '本科提前批艺术类B段',
      sourceName: source.sourceName,
      sourceUrl: BEIJING_SCORE_PAGE_URL,
      sourceType: source.sourceType,
      dataQuality: 'official_pdf',
      rawData: JSON.stringify({
        serialNo: Number(serialNo),
        universityCode,
        universityName,
        groupCode,
        groupName,
        minCompositeScore: Number(minCompositeScore),
        professionalScore: professionalScore ? Number(professionalScore) : null,
        chineseScore: chineseScore ? Number(chineseScore) : null,
        mathScore: mathScore ? Number(mathScore) : null,
        foreignScore: foreignScore ? Number(foreignScore) : null,
        electiveScore: electiveScore ? Number(electiveScore) : null,
        remark: remark || null,
        sourcePdf: source.url,
      }),
    });
  }
  return rows;
}

function parseGuangxiArt(source: ScoreSource, filePath: string, byName: Map<string, string>): ScoreRow[] {
  const html = iconv.decode(require('node:fs').readFileSync(filePath), 'gbk');
  const $ = cheerio.load(html);
  const rows: ScoreRow[] = [];
  $('tr').each((_, tr) => {
    const cells = $(tr).find('td').map((__, td) => $(td).text().replace(/\s+/g, ' ').trim()).get();
    if (cells.length !== 5 || !/^\d{5}$/.test(cells[0]) || !/^\d{3}$/.test(cells[2])) return;
    const [universityCode, universityName, groupCode, minCompositeScoreText, remark] = cells;
    const minCompositeScore = firstNumber(minCompositeScoreText);
    if (minCompositeScore === null) return;
    const artCategory = artCategoryFromGuangxiGroupCode(groupCode);
    rows.push({
      universityId: universityId(universityName, byName),
      universityName,
      province: source.province,
      year: YEAR,
      batch: source.batch,
      artCategory,
      subjectType: source.subjectType || '不限',
      majorName: artCategory,
      groupCode,
      groupName: `专业组${groupCode}`,
      minCompositeScore,
      admissionMethod: '本科提前批艺术类本科第二批',
      sourceName: source.sourceName,
      sourceUrl: source.url,
      sourceType: source.sourceType,
      dataQuality: 'official_html',
      rawData: JSON.stringify({ universityCode, universityName, groupCode, minCompositeScore, remark: remark || null }),
    });
  });
  return rows;
}

async function parseNeimengguArt(source: ScoreSource, filePath: string, byName: Map<string, string>): Promise<ScoreRow[]> {
  const data = JSON.parse(await readFile(filePath, 'utf8')) as any[];
  const rows: ScoreRow[] = [];
  for (const item of data) {
    const subjectText = String(item.KLMC || '');
    if (!subjectText.includes('艺术')) continue;
    const universityName = String(item.YXMC || '').trim();
    const groupCode = String(item.ZYZDH || '').trim();
    const minCompositeScore = firstNumber(item.ZYZZDF);
    if (!universityName || !groupCode || minCompositeScore === null) continue;
    const artCategory = normalizeNeimengguArtCategory(item.YSZKLMC);
    rows.push({
      universityId: universityId(universityName, byName),
      universityName,
      province: source.province,
      year: YEAR,
      batch: source.batch,
      artCategory,
      subjectType: source.subjectType || '不限',
      majorName: String(item.YSZKLMC || artCategory).trim(),
      groupCode,
      groupName: `专业组${groupCode}`,
      minCompositeScore,
      planCount: firstNumber(item.ZYZLQRS),
      admissionMethod: '本科提前批B段第一次填报志愿',
      sourceName: source.sourceName,
      sourceUrl: NEIMENGGU_SCORE_PAGE_URL,
      sourceType: source.sourceType,
      dataQuality: 'official_json',
      rawData: JSON.stringify({
        universityCode: String(item.YXDH || '').trim(),
        universityName,
        groupCode,
        rawCategory: item.YSZKLMC,
        planType: item.JHLBMC,
        subjectText,
        maxCompositeScore: firstNumber(item.ZYZZGF),
        minCompositeScore,
        admittedCount: firstNumber(item.ZYZLQRS),
      }),
    });
  }
  return rows;
}

async function parseJiangxiArt(source: ScoreSource, filePath: string, byName: Map<string, string>): Promise<ScoreRow[]> {
  const parser = new PDFParse({ data: await readFile(filePath) });
  const data = await parser.getText();
  const rows: ScoreRow[] = [];
  const linePattern = /^(\d+)\s+(.+?类)\s+(\d{4})\s+(.+?)\s+([A-Z]\d{2})\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+)$/;
  for (const rawLine of data.text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    const [, serialNo, rawCategory, universityCode, universityName, groupCode, groupName, minCompositeScore, minRank] = match;
    const artCategory = normalizeArtCategory(rawCategory);
    rows.push({
      universityId: universityId(universityName, byName),
      universityName,
      province: source.province,
      year: YEAR,
      batch: source.batch,
      artCategory,
      subjectType: source.subjectType || '不限',
      groupCode,
      groupName,
      minCompositeScore: Number(minCompositeScore),
      minRank: Number(minRank),
      admissionMethod: '本科批艺术类平行志愿',
      sourceName: source.sourceName,
      sourceUrl: source.url,
      sourceType: source.sourceType,
      dataQuality: 'official_pdf',
      rawData: JSON.stringify({ serialNo, rawCategory, universityCode, universityName, groupCode, groupName, minCompositeScore: Number(minCompositeScore), minRank: Number(minRank) }),
    });
  }
  return rows;
}

async function parseShanxiArt(source: ScoreSource, filePath: string, byName: Map<string, string>): Promise<ScoreRow[]> {
  const parser = new PDFParse({ data: await readFile(filePath) });
  const data = await parser.getText();
  const rows: ScoreRow[] = [];
  const linePattern = /^(?:(\d{4})\s+(.+?)\s+)?(.+?)\s+第(\d{3})组(?:\((.+?)\))?\s*(\d+(?:\.\d+)?)?$/;
  let currentUniversityCode: string | null = null;
  let currentUniversityName: string | null = null;

  for (const rawLine of data.text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    const [, universityCode, universityName, rawCategory, groupCode, groupRemark, minCompositeScore] = match;
    if (universityCode && universityName) {
      currentUniversityCode = universityCode;
      currentUniversityName = universityName.trim();
    }
    if (!currentUniversityName || !minCompositeScore) continue;

    const majorName = String(rawCategory || '').trim();
    rows.push({
      universityId: universityId(currentUniversityName, byName),
      universityName: currentUniversityName,
      province: source.province,
      year: YEAR,
      batch: source.batch,
      artCategory: source.artCategory!,
      subjectType: source.subjectType || '不限',
      majorName,
      groupCode,
      groupName: groupRemark ? `第${groupCode}组（${groupRemark}）` : `第${groupCode}组`,
      minCompositeScore: Number(minCompositeScore),
      admissionMethod: '艺术本科批平行志愿',
      sourceName: source.sourceName,
      sourceUrl: SHANXI_SCORE_PAGE_URL,
      sourceType: source.sourceType,
      dataQuality: 'official_pdf',
      rawData: JSON.stringify({ universityCode: currentUniversityCode, universityName: currentUniversityName, rawCategory, groupCode, groupRemark: groupRemark || null, minCompositeScore: Number(minCompositeScore), sourcePdf: source.url }),
    });
  }
  return rows;
}

async function parseShanghaiArt(source: ScoreSource, filePath: string, byName: Map<string, string>): Promise<ScoreRow[]> {
  const parser = new PDFParse({ data: await readFile(filePath) });
  const data = await parser.getText();
  const rows: ScoreRow[] = [];
  const linePattern = /^([A-Z]\d{2}[A-Z]\d)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/;

  for (const rawLine of data.text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    const [, groupCode, rawGroupName, minCompositeScore, professionalScore, chineseMathTotal, chineseOrMathBest, foreignScore, electiveHighest, electiveSecond, electiveLowest, bonusScore] = match;
    const groupMatch = rawGroupName.match(/^(.+?)\((.+)\)$/);
    const universityName = normalizeShanghaiUniversityName(groupMatch?.[1] || rawGroupName);
    const groupSuffix = groupMatch?.[2] || null;
    rows.push({
      universityId: universityId(universityName, byName),
      universityName,
      province: source.province,
      year: YEAR,
      batch: source.batch,
      artCategory: source.artCategory!,
      subjectType: source.subjectType || '综合改革',
      majorName: source.artCategory!,
      groupCode,
      groupName: groupSuffix ? `${universityName}（${groupSuffix}）` : rawGroupName,
      minCompositeScore: Number(minCompositeScore),
      minProfessionalScore: Number(professionalScore),
      admissionMethod: '本科艺术甲批次平行段',
      sourceName: source.sourceName,
      sourceUrl: SHANGHAI_SCORE_PAGE_URL,
      sourceType: source.sourceType,
      dataQuality: 'official_pdf',
      rawData: JSON.stringify({ groupCode, rawGroupName, groupSuffix, minCompositeScore: Number(minCompositeScore), professionalScore: Number(professionalScore), chineseMathTotal: Number(chineseMathTotal), chineseOrMathBest: Number(chineseOrMathBest), foreignScore: Number(foreignScore), electiveHighest: Number(electiveHighest), electiveSecond: Number(electiveSecond), electiveLowest: Number(electiveLowest), bonusScore: Number(bonusScore), sourcePdf: source.url }),
    });
  }
  return rows;
}

function parseHeilongjiangArt(source: ScoreSource, filePath: string, byName: Map<string, string>): ScoreRow[] {
  const rows = readSheet(filePath).slice(2);
  return rows
    .filter(row => row[0] && row[1] && row[2] && firstNumber(row[4]) !== null)
    .map(row => {
      const universityName = String(row[1]).trim();
      const groupCode = String(row[2] || '').trim();
      const groupName = String(row[3] || '').trim();
      return {
        universityId: universityId(universityName, byName),
        universityName,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        artCategory: source.artCategory!,
        subjectType: source.subjectType || '不限',
        majorName: groupName || source.artCategory!,
        groupCode,
        groupName: groupName || (groupCode ? `第${groupCode}组` : null),
        minCompositeScore: firstNumber(row[4]),
        minCultureScore: firstNumber(row[5]),
        admissionMethod: '艺术类本科批平行志愿',
        sourceName: source.sourceName,
        sourceUrl: HEILONGJIANG_SCORE_PAGE_URL,
        sourceType: source.sourceType,
        dataQuality: 'official_structured',
        rawData: JSON.stringify({ universityCode: row[0], universityName, groupCode, groupName, compositeScore: row[4], cultureScore: row[5], chineseMathTotal: row[6], chineseMathBest: row[7], foreignScore: row[8], firstSubject: row[9], secondSubjectBest: row[10], sourceFile: source.url }),
      };
    });
}

async function upsertRules() {
  let count = 0;
  for (const rule of RULES) {
    await prisma.artAdmissionRule.upsert({
      where: {
        province_year_artCategory_batch_subjectType: {
          province: rule.province,
          year: rule.year,
          artCategory: rule.artCategory,
          batch: rule.batch,
          subjectType: rule.subjectType || '不限',
        },
      },
      update: {
        formulaType: rule.formulaType,
        cultureFullScore: rule.cultureFullScore || 750,
        professionalFullScore: rule.professionalFullScore || 300,
        cultureWeight: rule.cultureWeight,
        professionalWeight: rule.professionalWeight,
        scaleTo: rule.scaleTo || 750,
        sourceName: rule.sourceName,
        sourceUrl: rule.sourceUrl,
        sourceType: rule.sourceType,
        notes: rule.notes,
      },
      create: {
        province: rule.province,
        year: rule.year,
        artCategory: rule.artCategory,
        batch: rule.batch,
        subjectType: rule.subjectType || '不限',
        formulaType: rule.formulaType,
        cultureFullScore: rule.cultureFullScore || 750,
        professionalFullScore: rule.professionalFullScore || 300,
        cultureWeight: rule.cultureWeight,
        professionalWeight: rule.professionalWeight,
        scaleTo: rule.scaleTo || 750,
        sourceName: rule.sourceName,
        sourceUrl: rule.sourceUrl,
        sourceType: rule.sourceType,
        notes: rule.notes,
      },
    });
    count += 1;
  }
  console.log(`艺术类规则：${count} 条`);
}

async function parseSource(source: ScoreSource, filePath: string, byName: Map<string, string>) {
  if (source.parser === 'zhejiang_art_xls') return parseZhejiangArt(source, filePath, byName);
  if (source.parser === 'shandong_art_xls') return parseShandongArt(source, filePath, byName);
  if (source.parser === 'jiangsu_art_xlsx') return parseJiangsuArt(source, filePath, byName);
  if (source.parser === 'hebei_art_xlsx') return parseHebeiArt(source, filePath, byName);
  if (source.parser === 'hunan_art_xlsx') return parseHunanArt(source, filePath, byName);
  if (source.parser === 'jiangxi_art_pdf') return parseJiangxiArt(source, filePath, byName);
  if (source.parser === 'shanxi_art_pdf') return parseShanxiArt(source, filePath, byName);
  if (source.parser === 'shanghai_art_pdf') return parseShanghaiArt(source, filePath, byName);
  if (source.parser === 'heilongjiang_art_xlsx') return parseHeilongjiangArt(source, filePath, byName);
  if (source.parser === 'liaoning_art_pdf') return parseLiaoningArt(source, filePath, byName);
  if (source.parser === 'beijing_art_pdf') return parseBeijingArt(source, filePath, byName);
  if (source.parser === 'guangxi_art_html') return parseGuangxiArt(source, filePath, byName);
  if (source.parser === 'neimenggu_art_json') return parseNeimengguArt(source, filePath, byName);
  return parseGuangdongArt(source, filePath, byName);
}

async function importScores() {
  const byName = await universityMap();
  const sources = SCORE_SOURCES.filter(source => SOURCE === 'all' || source.key === SOURCE || source.province === SOURCE);
  let total = 0;
  for (const source of sources) {
    const filePath = await ensureFile(source);
    const rows = await parseSource(source, filePath, byName);
    await prisma.artAdmissionScore.deleteMany({
      where: {
        year: YEAR,
        sourceType: { in: [source.sourceType, ...(source.legacySourceTypes || [])] },
      },
    });
    for (let i = 0; i < rows.length; i += 500) {
      await prisma.artAdmissionScore.createMany({ data: rows.slice(i, i + 500) });
    }
    total += rows.length;
    console.log(`${source.key}: ${rows.length} 条`);
  }
  console.log(`艺术类投档线：${total} 条`);
}

async function main() {
  await upsertRules();
  await importScores();
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
