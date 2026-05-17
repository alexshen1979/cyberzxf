import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';

const prisma = new PrismaClient();

const YEAR = Number(process.env.YEAR || 2025);
const SOURCE = process.env.SOURCE || 'all';
const FILE_DIR = process.env.FILE_DIR || path.join(process.cwd(), '.cache', 'official-admission');
const REPLACE_SOURCE = process.env.REPLACE_SOURCE !== 'false';

type UniversityRef = {
  id: string;
  name: string;
};

type AdmissionRow = {
  universityId?: string | null;
  universityName: string;
  province: string;
  year: number;
  batch: string;
  subjectType: string;
  majorName?: string | null;
  lineType: string;
  groupCode?: string | null;
  groupName?: string | null;
  subjectRequirement?: string | null;
  minScore?: number | null;
  minRank?: number | null;
  planCount?: number | null;
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  isPartial: boolean;
  dataQuality: string;
  rawData: string;
};

type OfficialSource = {
  key: string;
  province: string;
  subjectType: string;
  batch: string;
  file: string;
  url: string;
  sourceName: string;
  sourceType: string;
  parser: 'shandong_xls' | 'zhejiang_xls' | 'hebei_xls' | 'hunan_xls' | 'hainan_xls' | 'beijing_pdf' | 'jiangsu_pdf' | 'hubei_pdf' | 'jiangxi_pdf' | 'shanghai_pdf' | 'guangdong_pdf' | 'shanxi_pdf' | 'guangxi_pdf' | 'liaoning_pdf' | 'guizhou_pdf' | 'ningxia_pdf';
};

const SOURCES: OfficialSource[] = [
  {
    key: 'shandong',
    province: '山东',
    subjectType: '综合改革',
    batch: '普通类常规批第1次志愿投档线',
    file: 'shandong-2025.xls',
    url: 'https://www.sdzk.cn/Floadup/file/20250719/6388855130412530367357143.xls',
    sourceName: '山东省教育招生考试院',
    sourceType: 'official_shandong_admission_xls',
    parser: 'shandong_xls',
  },
  {
    key: 'beijing',
    province: '北京',
    subjectType: '综合改革',
    batch: '本科普通批录取投档线',
    file: 'beijing-2025.pdf',
    url: 'https://www.bjeea.cn/uploads/soft/250720/178-250H0201058.pdf',
    sourceName: '北京教育考试院',
    sourceType: 'official_beijing_admission_pdf',
    parser: 'beijing_pdf',
  },
  {
    key: 'jiangsu-physics',
    province: '江苏',
    subjectType: '物理类',
    batch: '普通类本科批次平行志愿投档线',
    file: 'jiangsu-physics-2025.pdf',
    url: 'https://www.jseea.cn/webfile/upload/2025/07-18/09-33-5302461102655621.pdf',
    sourceName: '江苏省教育考试院',
    sourceType: 'official_jiangsu_admission_pdf',
    parser: 'jiangsu_pdf',
  },
  {
    key: 'jiangsu-history',
    province: '江苏',
    subjectType: '历史类',
    batch: '普通类本科批次平行志愿投档线',
    file: 'jiangsu-history-2025.pdf',
    url: 'https://www.jseea.cn/webfile/upload/2025/07-18/09-33-380724-1917118608.pdf',
    sourceName: '江苏省教育考试院',
    sourceType: 'official_jiangsu_admission_pdf',
    parser: 'jiangsu_pdf',
  },
  {
    key: 'zhejiang-first',
    province: '浙江',
    subjectType: '综合改革',
    batch: '普通类第一段平行投档线',
    file: 'zhejiang-first-2025.xls',
    url: 'https://www.zjzs.net/module/download/downfile.jsp?classid=0&showname=%E6%B5%99%E6%B1%9F%E7%9C%812025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E6%A0%A1%E6%8B%9B%E7%94%9F%E6%99%AE%E9%80%9A%E7%B1%BB%E7%AC%AC%E4%B8%80%E6%AE%B5%E5%B9%B3%E8%A1%8C%E6%8A%95%E6%A1%A3%E5%88%86%E6%95%B0%E7%BA%BF%E8%A1%A8.xls&filename=c4110ef9c01a4b6ba1e231c2b5d2462f.xls',
    sourceName: '浙江省教育考试院',
    sourceType: 'official_zhejiang_admission_xls',
    parser: 'zhejiang_xls',
  },
  {
    key: 'zhejiang-second',
    province: '浙江',
    subjectType: '综合改革',
    batch: '普通类第二段平行投档线',
    file: 'zhejiang-second-2025.xls',
    url: 'https://www.zjzs.net/module/download/downfile.jsp?classid=0&showname=%E6%B5%99%E6%B1%9F%E7%9C%812025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E6%A0%A1%E6%8B%9B%E7%94%9F%E6%99%AE%E9%80%9A%E7%B1%BB%E7%AC%AC%E4%BA%8C%E6%AE%B5%E5%B9%B3%E8%A1%8C%E6%8A%95%E6%A1%A3%E5%88%86%E6%95%B0%E7%BA%BF.XLS&filename=ba3d7d5ee3814ed0b2b926715a9d09f8.xls',
    sourceName: '浙江省教育考试院',
    sourceType: 'official_zhejiang_admission_xls',
    parser: 'zhejiang_xls',
  },
  {
    key: 'hebei-history',
    province: '河北',
    subjectType: '历史类',
    batch: '本科批平行志愿投档线',
    file: 'hebei-history-2025.xlsx',
    url: 'https://file.hebeea.edu.cn/files/article/2025/07/20250722214851_332.xlsx',
    sourceName: '河北省教育考试院',
    sourceType: 'official_hebei_admission_xls',
    parser: 'hebei_xls',
  },
  {
    key: 'hebei-physics',
    province: '河北',
    subjectType: '物理类',
    batch: '本科批平行志愿投档线',
    file: 'hebei-physics-2025.xlsx',
    url: 'https://file.hebeea.edu.cn/files/article/2025/07/20250722214852_210.xlsx',
    sourceName: '河北省教育考试院',
    sourceType: 'official_hebei_admission_xls',
    parser: 'hebei_xls',
  },
  {
    key: 'hubei-history',
    province: '湖北',
    subjectType: '历史类',
    batch: '本科普通批平行志愿投档线',
    file: 'hubei-history-2025.pdf',
    url: 'https://www.gkzxw.com/d/file/202507/6951744aafcbe2c6a06fb9b30c67b219.pdf',
    sourceName: '湖北省教育厅招生办公室',
    sourceType: 'official_hubei_admission_pdf',
    parser: 'hubei_pdf',
  },
  {
    key: 'hubei-physics',
    province: '湖北',
    subjectType: '物理类',
    batch: '本科普通批平行志愿投档线',
    file: 'hubei-physics-2025.pdf',
    url: 'https://img.yun.cnhubei.com/a/10001/202507/f95c7a539db06a7f655467cccecca4c3.pdf',
    sourceName: '湖北省教育厅招生办公室',
    sourceType: 'official_hubei_admission_pdf',
    parser: 'hubei_pdf',
  },
  {
    key: 'jiangxi',
    province: '江西',
    subjectType: 'mixed',
    batch: '本科投档情况统计表',
    file: 'jiangxi-2025.pdf',
    url: 'https://cdn.zizzs.com/zixunzhan/17529969754446GtVOODt.pdf',
    sourceName: '江西省教育考试院',
    sourceType: 'official_jiangxi_admission_pdf',
    parser: 'jiangxi_pdf',
  },
  {
    key: 'hunan',
    province: '湖南',
    subjectType: 'mixed',
    batch: '本科批(普通)第一次投档分数线',
    file: 'hunan-2025-vod.xlsx',
    url: 'https://vod.hnedutv.com/218/2025/07/20/f050a299f28908cd1891faa488e99bd0f6fbfd5e1753008129710.xlsx?pid=51190030',
    sourceName: '湖南省教育考试院',
    sourceType: 'official_hunan_admission_xls',
    parser: 'hunan_xls',
  },
  {
    key: 'shanghai-main',
    province: '上海',
    subjectType: '综合改革',
    batch: '本科普通批次平行志愿院校专业组投档分数线',
    file: 'shanghai-main-2025.pdf',
    url: 'https://www.shmeea.edu.cn/download/20250719/186.pdf',
    sourceName: '上海市教育考试院',
    sourceType: 'official_shanghai_admission_pdf_main',
    parser: 'shanghai_pdf',
  },
  {
    key: 'shanghai-q',
    province: '上海',
    subjectType: '综合改革',
    batch: '本科普通批次平行志愿院校Q组及部分中外合作办学院校专业组投档分数线',
    file: 'shanghai-q-2025.pdf',
    url: 'https://www.shmeea.edu.cn/download/20250719/185.pdf',
    sourceName: '上海市教育考试院',
    sourceType: 'official_shanghai_admission_pdf_q',
    parser: 'shanghai_pdf',
  },
  {
    key: 'hainan',
    province: '海南',
    subjectType: '综合改革',
    batch: '本科普通批院校专业组投档分数线',
    file: 'hainan-2025.xlsx',
    url: 'https://cdn.zizzs.com/zixunzhan/17532436953802025%E6%B5%B7%E5%8D%97%E7%9C%81%E6%9C%AC%E7%A7%91%E6%89%B9%E6%8A%95%E6%A1%A3%E7%BA%BF.xlsx',
    sourceName: '海南省考试局（转载附件）',
    sourceType: 'official_hainan_admission_xls',
    parser: 'hainan_xls',
  },
  {
    key: 'guangdong-history',
    province: '广东',
    subjectType: '历史类',
    batch: '本科普通类投档情况',
    file: 'guangdong-history-2025-official.pdf',
    url: 'https://eea.gd.gov.cn/attachment/0/585/585885/4746781.pdf',
    sourceName: '广东省教育考试院',
    sourceType: 'official_guangdong_admission_pdf',
    parser: 'guangdong_pdf',
  },
  {
    key: 'guangdong-physics',
    province: '广东',
    subjectType: '物理类',
    batch: '本科普通类投档情况',
    file: 'guangdong-physics-2025.pdf',
    url: 'https://eea.gd.gov.cn/attachment/0/585/585886/4746786.pdf',
    sourceName: '广东省教育考试院',
    sourceType: 'official_guangdong_admission_pdf',
    parser: 'guangdong_pdf',
  },
  {
    key: 'shanxi-history',
    province: '山西',
    subjectType: '历史类',
    batch: '普通本科批院校专业组投档最低分',
    file: 'shanxi-history-2025.pdf',
    url: 'https://www.sxjyksfw.cn/jyksfw/ptgk/20250801_2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E9%99%A2%E6%A0%A1%E4%B8%93%E4%B8%9A%E7%BB%84%E6%8A%95%E6%A1%A3%E6%9C%80%E4%BD%8E%E5%88%86_1%E5%8E%86%E5%8F%B2%E7%B1%BB.pdf',
    sourceName: '山西招生考试网',
    sourceType: 'official_shanxi_admission_pdf',
    parser: 'shanxi_pdf',
  },
  {
    key: 'shanxi-physics',
    province: '山西',
    subjectType: '物理类',
    batch: '普通本科批院校专业组投档最低分',
    file: 'shanxi-physics-2025.pdf',
    url: 'https://www.sxjyksfw.cn/jyksfw/ptgk/20250801_2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E8%80%83%E9%99%A2%E6%A0%A1%E4%B8%93%E4%B8%9A%E7%BB%84%E6%8A%95%E6%A1%A3%E6%9C%80%E4%BD%8E%E5%88%86_5%E7%89%A9%E7%90%86%E7%B1%BB.pdf',
    sourceName: '山西招生考试网',
    sourceType: 'official_shanxi_admission_pdf',
    parser: 'shanxi_pdf',
  },
  {
    key: 'guangxi-history',
    province: '广西',
    subjectType: '历史类',
    batch: '本科普通批院校专业组投档最低分数线',
    file: 'guangxi-history-2025.pdf',
    url: 'https://cdn.zizzs.com/zixunzhan/1753171216282%E5%B7%A5%E4%BD%9C%E7%B0%BF1.pdf',
    sourceName: '广西招生考试院（转载附件）',
    sourceType: 'official_guangxi_admission_pdf',
    parser: 'guangxi_pdf',
  },
  {
    key: 'guangxi-physics',
    province: '广西',
    subjectType: '物理类',
    batch: '本科普通批院校专业组投档最低分数线',
    file: 'guangxi-combined-2025.pdf',
    url: 'https://cdn.zizzs.com/zixunzhan/1752842143614%E5%B9%BF%E8%A5%BF2025%E5%B9%B4%E9%AB%98%E8%80%83%E6%9C%AC%E7%A7%91%E6%89%B9%E6%AC%A1%E6%8A%95%E6%A1%A3%E7%BA%BF%EF%BC%88%E5%8E%86%E5%8F%B2%E7%B1%BB%EF%BC%89_20250718203503.pdf',
    sourceName: '广西招生考试院（转载附件）',
    sourceType: 'official_guangxi_admission_pdf',
    parser: 'guangxi_pdf',
  },
  {
    key: 'liaoning-history',
    province: '辽宁',
    subjectType: '历史类',
    batch: '普通类本科批投档最低分',
    file: 'liaoning-history-2025.pdf',
    url: 'https://img.gaokaozhitongche.com/uploads/file/2025/0720/1752995883686918.pdf',
    sourceName: '辽宁招生考试之窗（转载附件）',
    sourceType: 'official_liaoning_admission_pdf',
    parser: 'liaoning_pdf',
  },
  {
    key: 'liaoning-physics',
    province: '辽宁',
    subjectType: '物理类',
    batch: '普通类本科批投档最低分',
    file: 'liaoning-physics-2025.pdf',
    url: 'https://img.gaokaozhitongche.com/uploads/file/2025/0720/1752997769489578.pdf',
    sourceName: '辽宁招生考试之窗（转载附件）',
    sourceType: 'official_liaoning_admission_pdf',
    parser: 'liaoning_pdf',
  },
  {
    key: 'guizhou-history',
    province: '贵州',
    subjectType: '历史类',
    batch: '普通类本科批投档情况',
    file: 'guizhou-history-2025.pdf',
    url: 'https://img.gaokaozhitongche.com/uploads/file/2025/0722/1753184450378451.pdf',
    sourceName: '贵州省招生考试院（转载附件）',
    sourceType: 'official_guizhou_admission_pdf',
    parser: 'guizhou_pdf',
  },
  {
    key: 'guizhou-physics',
    province: '贵州',
    subjectType: '物理类',
    batch: '普通类本科批投档情况',
    file: 'guizhou-physics-2025.pdf',
    url: 'https://img.gaokaozhitongche.com/uploads/file/2025/0722/1753184451710001.pdf',
    sourceName: '贵州省招生考试院（转载附件）',
    sourceType: 'official_guizhou_admission_pdf',
    parser: 'guizhou_pdf',
  },
  {
    key: 'ningxia-b',
    province: '宁夏',
    subjectType: 'mixed',
    batch: '本科批B段投档线',
    file: 'ningxia-b-2025.pdf',
    url: 'https://cdn.zizzs.com/zixunzhan/1753002984234%E5%AE%81%E5%A4%8F2025%E5%B9%B4%E6%99%AE%E9%80%9A%E9%AB%98%E6%A0%A1%E6%8B%9B%E7%94%9F%E6%9C%AC%E7%A7%91%E6%89%B9B%E6%AE%B5%E6%8A%95%E6%A1%A3%E7%BA%BF.pdf',
    sourceName: '宁夏教育考试院（转载附件）',
    sourceType: 'official_ningxia_admission_pdf',
    parser: 'ningxia_pdf',
  },
];

const MANUAL_UNIVERSITY_ALIASES: Record<string, string> = {
  上海交大: '上海交通大学',
  华东师大: '华东师范大学',
  华东理工: '华东理工大学',
  上海财大: '上海财经大学',
  上海外大: '上海外国语大学',
  上海海事: '上海海事大学',
  上海理工: '上海理工大学',
  上海杉达: '上海杉达学院',
  华东政法: '华东政法大学',
  上经贸大: '上海对外经贸大学',
  复旦医学: '复旦大学上海医学院',
  交大医学: '上海交通大学医学院',
  上海中医: '上海中医药大学',
  上海海大: '上海海洋大学',
  上应大: '上海应用技术大学',
  上海师大: '上海师范大学',
  上工程: '上海工程技术大学',
  立信金融: '上海立信会计金融学院',
  上海体大: '上海体育大学',
  上海商院: '上海商学院',
  上海政法: '上海政法学院',
  上海电机: '上海电机学院',
  健康医学: '上海健康医学院',
  中侨大学: '上海中侨职业技术大学',
  建桥学院: '上海建桥学院',
  立达学院: '上海立达学院',
  上外贤达: '上海外国语大学贤达经济人文学院',
  上师天华: '上海师范大学天华学院',
  二工大: '上海第二工业大学',
  海关学院: '上海海关学院',
  海医大: '海军军医大学',
  北京交大: '北京交通大学',
  北京科大: '北京科技大学',
  北京化工: '北京化工大学',
  北京邮电: '北京邮电大学',
  中国农大: '中国农业大学',
  北京林大: '北京林业大学',
  外经贸大: '对外经济贸易大学',
  中央财大: '中央财经大学',
  中央民族: '中央民族大学',
  北京航大: '北京航空航天大学',
  北京理工: '北京理工大学',
  中国传媒: '中国传媒大学',
  北京语言: '北京语言大学',
  北京联大: '北京联合大学',
  北京电影: '北京电影学院',
  中国民航: '中国民航大学',
  天津科大: '天津科技大学',
  天津中医: '天津中医药大学',
  天津理工: '天津理工大学',
  天津城建: '天津城建大学',
  津医临床: '天津医科大学临床医学院',
  津商宝德: '天津商业大学宝德学院',
  京科天津: '北京科技大学天津学院',
  河北地质: '河北地质大学',
  河北医科: '河北医科大学',
  华北理工: '华北理工大学',
  河北建工: '河北建筑工程学院',
  石铁大: '石家庄铁道大学',
  石铁四方: '石家庄铁道大学四方学院',
  中国警察: '中国人民警察大学',
  山西医大: '山西医科大学',
  山西财大: '山西财经大学',
  山西中医: '山西中医药大学',
  忻州师院: '忻州师范学院',
  内蒙大学: '内蒙古大学',
  大连海事: '大连海事大学',
  大连海洋: '大连海洋大学',
  大连医科: '大连医科大学',
  辽宁师大: '辽宁师范大学',
  沈阳工大: '沈阳工业大学',
  沈阳理工: '沈阳理工大学',
  沈阳建筑: '沈阳建筑大学',
  锦州医大: '锦州医科大学',
  东北财大: '东北财经大学',
  东北师大: '东北师范大学',
  长春理工: '长春理工大学',
  长春工大: '长春工业大学',
  吉林师大: '吉林师范大学',
  哈工大: '哈尔滨工业大学',
  哈工程: '哈尔滨工程大学',
  哈医大: '哈尔滨医科大学',
  哈师大: '哈尔滨师范大学',
  东北林大: '东北林业大学',
  东北农大: '东北农业大学',
  黑龙江大: '黑龙江大学',
  齐医学院: '齐齐哈尔医学院',
  齐齐哈尔: '齐齐哈尔大学',
  中国药大: '中国药科大学',
  中国矿大: '中国矿业大学',
  江苏科大: '江苏科技大学',
  南京工大: '南京工业大学',
  南京林大: '南京林业大学',
  南京财大: '南京财经大学',
  南京工程: '南京工程学院',
  南京审计: '南京审计大学',
  南京农大: '南京农业大学',
  南京理工: '南京理工大学',
  南京信息: '南京信息工程大学',
  南京医大: '南京医科大学',
  南京中医: '南京中医药大学',
  南京师大: '南京师范大学',
  南京特师: '南京特殊教育师范学院',
  徐州工程: '徐州工程学院',
  南工浦江: '南京工业大学浦江学院',
  南审金审: '南京审计大学金审学院',
  西浦大学: '西交利物浦大学',
  浙江中医: '浙江中医药大学',
  浙江师大: '浙江师范大学',
  浙江工大: '浙江工业大学',
  杭州师大: '杭州师范大学',
  浙江财大: '浙江财经大学',
  浙江传媒: '浙江传媒学院',
  杭州电子: '杭州电子科技大学',
  中国计量: '中国计量大学',
  湖州师范: '湖州师范学院',
  南湖学院: '嘉兴南湖学院',
  上财浙院: '上海财经大学浙江学院',
  安徽建筑: '安徽建筑大学',
  安徽师大: '安徽师范大学',
  安徽科技: '安徽科技学院',
  淮北师大: '淮北师范大学',
  合肥工大: '合肥工业大学',
  合肥城院: '合肥城市学院',
  厦门理工: '厦门理工学院',
  厦大嘉庚: '厦门大学嘉庚学院',
  福州外贸: '福州外语外贸学院',
  江西财大: '江西财经大学',
  江西理工: '江西理工大学',
  江西农大: '江西农业大学',
  江西师大: '江西师范大学',
  江西科师: '江西科技师范大学',
  赣南师大: '赣南师范大学',
  南昌医学: '南昌医学院',
  南昌航大: '南昌航空大学',
  中国海洋: '中国海洋大学',
  山东师大: '山东师范大学',
  山一大: '山东第一医科大学',
  河南理工: '河南理工大学',
  河南工大: '河南工业大学',
  华中师大: '华中师范大学',
  湖南科大: '湖南科技大学',
  湖南文理: '湖南文理学院',
  重庆医大: '重庆医科大学',
  重庆师大: '重庆师范大学',
  成都理工: '成都理工大学',
  成都信息: '成都信息工程大学',
  四川师大: '四川师范大学',
  西南财大: '西南财经大学',
  民航飞院: '中国民用航空飞行学院',
  西北农林: '西北农林科技大学',
  西北民族: '西北民族大学',
  伊犁师大: '伊犁师范大学',
};

function normalizeName(value: string) {
  return value
    .replace(/\s+/g, '')
    .replace(/[（(](?:中外合作办学|中外合办|高校中外学分互认联合培养项目|马来西亚分校招生专业|威海校区)[）)]/g, '')
    .trim();
}

function baseUniversityName(value: string) {
  return normalizeName(value).replace(/[（(].*?[）)]/g, '');
}

function cleanText(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function parseNullableInt(value: unknown) {
  const text = cleanText(value).replace(/,/g, '');
  if (!text || text === '-') return null;
  const match = text.match(/\d+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function stripLeadingCode(value: string) {
  return value.replace(/^[A-Z0-9]+/, '').trim();
}

function stripSchoolMeta(value: string) {
  return value
    .replace(/\[[^\]]*]/g, '')
    .replace(/[（(][^）)]*市[）)]/g, '')
    .replace(/[（(][^）)]*县[）)]/g, '')
    .trim();
}

function resolveUniversity(name: string, byName: Map<string, UniversityRef>) {
  return byName.get(normalizeName(name)) || byName.get(baseUniversityName(name)) || null;
}

function buildUniversityMap(universities: UniversityRef[]) {
  const byName = new Map<string, UniversityRef>();
  for (const university of universities) {
    const normalized = normalizeName(university.name);
    if (!byName.has(normalized)) byName.set(normalized, university);
    const base = baseUniversityName(university.name);
    if (base && !byName.has(base)) byName.set(base, university);
  }
  for (const [alias, fullName] of Object.entries(MANUAL_UNIVERSITY_ALIASES)) {
    const university = byName.get(normalizeName(fullName));
    if (university && !byName.has(normalizeName(alias))) {
      byName.set(normalizeName(alias), university);
    }
  }
  return byName;
}

async function loadRankMap(province: string, subjectType: string) {
  const rows = await prisma.scoreRank.findMany({
    where: { province, subjectType, year: YEAR },
    select: { score: true, rank: true },
    orderBy: { score: 'desc' },
  });
  return new Map(rows.map(row => [row.score, row.rank]));
}

async function parsePdf(filePath: string) {
  const parser = new PDFParse({ data: await readFile(filePath) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function parseShandongXls(source: OfficialSource, byName: Map<string, UniversityRef>): AdmissionRow[] {
  const workbook = XLSX.readFile(path.join(FILE_DIR, source.file));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  const output: AdmissionRow[] = [];

  for (const row of rows.slice(2)) {
    const majorText = cleanText(row[0]);
    const schoolText = cleanText(row[1]);
    const planCount = parseNullableInt(row[2]);
    const minRank = parseNullableInt(row[3]);
    if (!majorText || !schoolText || minRank === null) continue;

    const universityName = stripLeadingCode(schoolText);
    const university = resolveUniversity(universityName, byName);
    const majorName = stripLeadingCode(majorText);
    output.push({
      universityId: university?.id || null,
      universityName,
      province: source.province,
      year: YEAR,
      batch: source.batch,
      subjectType: source.subjectType,
      majorName,
      lineType: 'major',
      minScore: null,
      minRank,
      planCount,
      sourceName: source.sourceName,
      sourceUrl: source.url,
      sourceType: source.sourceType,
      isPartial: false,
      dataQuality: university ? 'official_structured' : 'official_structured_unmatched_school',
      rawData: JSON.stringify({ majorText, schoolText, planCount, minRank }),
    });
  }

  return output;
}

function parseZhejiangXls(source: OfficialSource, byName: Map<string, UniversityRef>): AdmissionRow[] {
  const workbook = XLSX.readFile(path.join(FILE_DIR, source.file));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  const output: AdmissionRow[] = [];

  for (const row of rows.slice(1)) {
    const schoolCode = cleanText(row[0]);
    const universityName = cleanText(row[1]);
    const majorCode = cleanText(row[2]);
    const majorName = cleanText(row[3]);
    const planCount = parseNullableInt(row[4]);
    const minScore = parseNullableInt(row[5]);
    const minRank = parseNullableInt(row[6]);
    if (!schoolCode || !universityName || !majorCode || !majorName || minScore === null) continue;

    const university = resolveUniversity(universityName, byName);
    output.push({
      universityId: university?.id || null,
      universityName,
      province: source.province,
      year: YEAR,
      batch: source.batch,
      subjectType: source.subjectType,
      majorName,
      lineType: 'major',
      groupCode: majorCode,
      groupName: `${majorCode} ${majorName}`,
      minScore,
      minRank,
      planCount,
      sourceName: source.sourceName,
      sourceUrl: source.url,
      sourceType: source.sourceType,
      isPartial: false,
      dataQuality: university ? 'official_structured' : 'official_structured_unmatched_school',
      rawData: JSON.stringify({ schoolCode, universityName, majorCode, majorName, planCount, minScore, minRank }),
    });
  }

  return output;
}

async function parseHebeiXls(source: OfficialSource, byName: Map<string, UniversityRef>): Promise<AdmissionRow[]> {
  const workbook = XLSX.readFile(path.join(FILE_DIR, source.file));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  const rankMap = await loadRankMap(source.province, source.subjectType);
  const output: AdmissionRow[] = [];

  for (const row of rows.slice(5)) {
    const schoolCode = cleanText(row[0]);
    const rawUniversityName = cleanText(row[1]);
    const majorCode = cleanText(row[2]);
    const majorName = cleanText(row[3]);
    const minScore = parseNullableInt(row[4]);
    if (!schoolCode || !rawUniversityName || !majorCode || !majorName || minScore === null) continue;

    const universityName = stripSchoolMeta(rawUniversityName);
    const university = resolveUniversity(universityName, byName);
    output.push({
      universityId: university?.id || null,
      universityName,
      province: source.province,
      year: YEAR,
      batch: source.batch,
      subjectType: source.subjectType,
      majorName,
      lineType: 'major',
      groupCode: majorCode,
      groupName: `${majorCode} ${majorName}`,
      minScore,
      minRank: rankMap.get(minScore) || null,
      sourceName: source.sourceName,
      sourceUrl: source.url,
      sourceType: source.sourceType,
      isPartial: false,
      dataQuality: university ? 'official_structured' : 'official_structured_unmatched_school',
      rawData: JSON.stringify({ schoolCode, rawUniversityName, universityName, majorCode, majorName, minScore }),
    });
  }

  return output;
}

async function parseHunanXls(source: OfficialSource, byName: Map<string, UniversityRef>): Promise<AdmissionRow[]> {
  const workbook = XLSX.readFile(path.join(FILE_DIR, source.file));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  const historyRankMap = await loadRankMap(source.province, '历史类');
  const physicsRankMap = await loadRankMap(source.province, '物理类');
  const output: AdmissionRow[] = [];

  for (const row of rows.slice(3)) {
    const batch = cleanText(row[0]) || source.batch;
    const planCategory = cleanText(row[1]);
    const rawSubjectType = cleanText(row[2]);
    const schoolCode = cleanText(row[3]);
    const universityName = cleanText(row[4]);
    const groupCode = cleanText(row[5]);
    const groupName = cleanText(row[6]);
    const minScore = parseNullableInt(row[7]);
    const remark = cleanText(row[15]);
    if (!schoolCode || !universityName || !groupCode || !groupName || minScore === null) continue;

    const subjectType = rawSubjectType.includes('历史') ? '历史类' : rawSubjectType.includes('物理') ? '物理类' : '';
    if (!subjectType) continue;
    const university = resolveUniversity(universityName, byName);
    const rankMap = subjectType === '历史类' ? historyRankMap : physicsRankMap;
    output.push({
      universityId: university?.id || null,
      universityName,
      province: source.province,
      year: YEAR,
      batch,
      subjectType,
      lineType: 'major_group',
      groupCode,
      groupName,
      minScore,
      minRank: rankMap.get(minScore) || null,
      sourceName: source.sourceName,
      sourceUrl: source.url,
      sourceType: source.sourceType,
      isPartial: false,
      dataQuality: university ? 'official_structured' : 'official_structured_unmatched_school',
      rawData: JSON.stringify({
        planCategory,
        rawSubjectType,
        schoolCode,
        universityName,
        groupCode,
        groupName,
        minScore,
        sameScoreSort: {
          chineseMathTotal: cleanText(row[8]),
          chineseMathHighest: cleanText(row[9]),
          foreignLanguage: cleanText(row[10]),
          firstChoiceSubject: cleanText(row[11]),
          secondChoiceHighest: cleanText(row[12]),
          secondChoiceSecondHighest: cleanText(row[13]),
          preferenceOrder: cleanText(row[14]),
        },
        remark,
      }),
    });
  }

  return output;
}

async function parseHainanXls(source: OfficialSource, byName: Map<string, UniversityRef>): Promise<AdmissionRow[]> {
  const workbook = XLSX.readFile(path.join(FILE_DIR, source.file));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
  const rankMap = await loadRankMap(source.province, source.subjectType);
  const output: AdmissionRow[] = [];

  for (const row of rows.slice(1)) {
    const groupCode = cleanText(row[0]);
    const groupName = cleanText(row[1]);
    const subjectRequirement = cleanText(row[2]);
    const minScore = parseNullableInt(row[3]);
    if (!groupCode || !groupName || minScore === null) continue;

    const universityName = groupName.replace(/[（(]\d{2}[）)]$/, '').trim();
    const university = resolveUniversity(universityName, byName);
    output.push({
      universityId: university?.id || null,
      universityName,
      province: source.province,
      year: YEAR,
      batch: source.batch,
      subjectType: source.subjectType,
      lineType: 'major_group',
      groupCode,
      groupName,
      subjectRequirement: subjectRequirement || null,
      minScore,
      minRank: rankMap.get(minScore) || null,
      sourceName: source.sourceName,
      sourceUrl: source.url,
      sourceType: source.sourceType,
      isPartial: false,
      dataQuality: university ? 'official_structured' : 'official_structured_unmatched_school',
      rawData: JSON.stringify({ groupCode, groupName, subjectRequirement, minScore }),
    });
  }

  return output;
}

function parseBeijingPdfRows(text: string) {
  const rows: Array<{
    universityName: string;
    groupCode: string;
    subjectRequirement: string;
    minScore: number;
    raw: string;
  }> = [];
  const linePattern = /^\s*\d+\s+(\d{4})\s+(.+?)\s+(\d{2})\s+(.+?)\s+(\d{3})(?:\s|$)/;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    rows.push({
      universityName: match[2].trim(),
      groupCode: match[3].trim(),
      subjectRequirement: match[4].trim(),
      minScore: Number(match[5]),
      raw: line,
    });
  }
  return rows;
}

function parseJiangsuPdfRows(text: string) {
  const rows: Array<{
    universityName: string;
    groupCode: string;
    subjectRequirement: string;
    minScore: number;
    raw: string;
  }> = [];
  const linePattern = /^\s*(\d{4})\s+(.+?)(\d{2})专业组\((.+?)\)\s+(\d{3})(?:\s|$)/;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    rows.push({
      universityName: match[2].trim(),
      groupCode: match[3].trim(),
      subjectRequirement: match[4].trim(),
      minScore: Number(match[5]),
      raw: line,
    });
  }
  return rows;
}

function parseHubeiPdfRows(text: string) {
  const rows: Array<{
    universityName: string;
    groupCode: string;
    subjectRequirement: string;
    minScore: number;
    raw: string;
  }> = [];
  const linePattern = /^\s*([A-Z0-9]{6})\s+(.+?)第(\d{2})组\s+(.+?)\s+(\d{3})(?:\s|$)/;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    rows.push({
      universityName: match[2].trim(),
      groupCode: match[3].trim(),
      subjectRequirement: match[4].trim(),
      minScore: Number(match[5]),
      raw: line,
    });
  }
  return rows;
}

function parseJiangxiPdfRows(text: string) {
  const rows: Array<{
    universityName: string;
    subjectType: string;
    groupCode: string;
    groupName: string;
    minScore: number;
    minRank: number;
    raw: string;
  }> = [];
  const linePattern = /^\s*\d+\s+(历史类|物理类)\s+(\d{4})\s+(.+?)\s+([0-9A-Z]{3})\s+(.+?)\s+(\d{3})\s+(\d+)(?:\s|$)/;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    rows.push({
      subjectType: match[1].trim(),
      universityName: match[3].trim(),
      groupCode: match[4].trim(),
      groupName: match[5].trim(),
      minScore: Number(match[6]),
      minRank: Number(match[7]),
      raw: line,
    });
  }
  return rows;
}

function parseShanghaiPdfRows(text: string) {
  const rows: Array<{
    universityName: string;
    groupCode: string;
    groupName: string;
    minScore: number | null;
    rawScore: string;
    raw: string;
  }> = [];
  const linePattern = /^\s*([0-9A-Z]{5})\s+(.+?)\(([0-9A-Z]{2})\)\s+(580分及以上|\d{3})(?:\s|$)/;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    const rawScore = match[4].trim();
    rows.push({
      universityName: match[2].trim(),
      groupCode: match[3].trim(),
      groupName: `${match[2].trim()}(${match[3].trim()})`,
      minScore: rawScore.includes('及以上') ? 580 : Number(rawScore),
      rawScore,
      raw: line,
    });
  }
  return rows;
}

function parseGuangdongPdfRows(text: string) {
  const rows: Array<{
    universityCode: string;
    universityName: string;
    groupCode: string;
    planCount: number | null;
    submittedCount: number | null;
    minScore: number;
    minRank: number;
    raw: string;
  }> = [];
  const linePattern = /^\s*(\d{5})\s+(.+?)\s+(\d{3})\s+(\d+)\s+(\d+)\s+(\d{3})\s+(\d+)(?:\s|$)/;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    rows.push({
      universityCode: match[1],
      universityName: match[2].trim(),
      groupCode: match[3],
      planCount: Number(match[4]),
      submittedCount: Number(match[5]),
      minScore: Number(match[6]),
      minRank: Number(match[7]),
      raw: line,
    });
  }
  return rows;
}

function parseShanxiPdfRows(text: string, subjectType: string) {
  const rows: Array<{
    universityCode: string;
    universityName: string;
    groupCode: string;
    groupName: string;
    minScore: number;
    rawScore: string;
    raw: string;
  }> = [];
  const firstLinePattern = new RegExp(`^\\s*(\\d{4})\\s+(.+?)\\s+${subjectType}\\s+(.+?)\\s+(\\d{3}\\.\\d+)(?:\\s|$)`);
  const continuedLinePattern = new RegExp(`^\\s*${subjectType}\\s+(.+?)\\s+(\\d{3}\\.\\d+)(?:\\s|$)`);
  let currentUniversityCode = '';
  let currentUniversityName = '';

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    let match = line.match(firstLinePattern);
    if (match) {
      currentUniversityCode = match[1];
      currentUniversityName = match[2].trim();
      rows.push({
        universityCode: currentUniversityCode,
        universityName: currentUniversityName,
        groupCode: match[3].trim(),
        groupName: match[3].trim(),
        minScore: Math.trunc(Number(match[4])),
        rawScore: match[4],
        raw: line,
      });
      continue;
    }
    match = line.match(continuedLinePattern);
    if (!match || !currentUniversityName) continue;
    rows.push({
      universityCode: currentUniversityCode,
      universityName: currentUniversityName,
      groupCode: match[1].trim(),
      groupName: match[1].trim(),
      minScore: Math.trunc(Number(match[2])),
      rawScore: match[2],
      raw: line,
    });
  }
  return rows;
}

function parseGuangxiPdfRows(text: string) {
  const rows: Array<{
    universityCode: string;
    universityName: string;
    groupCode: string;
    minScore: number;
    remark: string;
    raw: string;
  }> = [];
  const linePattern = /^\s*(\d{5})\s+(.+?)\s+(\d{3})\s+(\d{3})(?:\s+(.*))?$/;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    const match = line.match(linePattern);
    if (!match) continue;
    rows.push({
      universityCode: match[1],
      universityName: match[2].trim(),
      groupCode: match[3],
      minScore: Number(match[4]),
      remark: (match[5] || '').trim(),
      raw: line,
    });
  }
  return rows;
}

function parseLiaoningPdfRows(text: string) {
  const rows: Array<{
    universityCode: string;
    universityName: string;
    majorCode: string;
    majorName: string;
    minScore: number;
    raw: string;
  }> = [];
  const lines = text.split(/\r?\n/).map(line => line.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim());
  const linePattern = /^(\d{4})\s+(.+?)\s+([0-9A-Z]{2})\s+(.+)\s+(\d{3})\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+$/;
  const continuationNoisePattern = /^(?:第 \d+ 页|-- \d+ of|院校|编号|招生院校|专业|投档|最低分|成绩|语数|最高|外语|首选|科目|再选|次高|愿|号|（|表中|投档后|取的考生|相同则全部投档)/;

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index];
    if (!line || continuationNoisePattern.test(line)) continue;
    let match = line.match(linePattern);
    if (!match) {
      const nextLine = lines[index + 1];
      if (!nextLine || continuationNoisePattern.test(nextLine)) continue;
      const combined = `${line}${nextLine}`;
      match = combined.match(linePattern);
      if (!match) continue;
      line = combined;
      index += 1;
    }
    rows.push({
      universityCode: match[1],
      universityName: match[2].trim(),
      majorCode: match[3],
      majorName: match[4].trim(),
      minScore: Number(match[5]),
      raw: line,
    });
  }

  return rows;
}

function parseGuizhouPdfRows(text: string) {
  const rows: Array<{
    sequence: number;
    universityCode: string;
    universityName: string;
    majorCode: string;
    majorName: string;
    admissionType: string;
    planCount: number | null;
    submittedCount: number | null;
    minScore: number | null;
    minRank: number | null;
    raw: string;
  }> = [];
  const lines = text.split(/\r?\n/).map(line => line.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim());
  const linePattern = /^(\d+)\s+(\d{4})\s+(.+?)\s+(\d{3})\s+(.+?)\s+(一般统考生|民族班|预科|国家专项计划|地方专项计划)\s+(\d+)\s+(\d+)(?:\s+(\d{3})\s+(\d+))?$/;
  const noisePattern = /^(?:第 \d+ 页|-- \d+ of|序号|代码|院校|专业|划数|投档|人数|最低分|低位次|贵州省|（首选|$)/;

  for (let index = 0; index < lines.length; index += 1) {
    let line = lines[index];
    if (!line || noisePattern.test(line)) continue;
    let match = line.match(linePattern);
    if (!match) {
      const nextLine = lines[index + 1];
      if (!nextLine || noisePattern.test(nextLine)) continue;
      const combined = `${line}${nextLine}`;
      match = combined.match(linePattern);
      if (!match) continue;
      line = combined;
      index += 1;
    }
    rows.push({
      sequence: Number(match[1]),
      universityCode: match[2],
      universityName: match[3].trim(),
      majorCode: match[4],
      majorName: match[5].trim(),
      admissionType: match[6],
      planCount: Number(match[7]),
      submittedCount: Number(match[8]),
      minScore: match[9] ? Number(match[9]) : null,
      minRank: match[10] ? Number(match[10]) : null,
      raw: line,
    });
  }

  return rows;
}

function parseNingxiaPdfRows(text: string) {
  const rows: Array<{
    subjectType: string;
    universityCode: string;
    universityName: string;
    groupCode: string;
    groupName: string;
    subjectRequirement: string;
    planCategory: string;
    minScore: number;
    raw: string;
  }> = [];
  const lines = text.split(/\r?\n/).map(line => line.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim());
  const linePattern = /^(\d{4})\s+(.+?)\s+([0-9A-Za-z]{3})专业组\((.+?)\)\s*(.*?)\s+(\d{3})\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+$/;
  let subjectType = '';

  for (const line of lines) {
    if (line.includes('普通类 （历史）')) {
      subjectType = '历史类';
      continue;
    }
    if (line.includes('普通类 （物理）')) {
      subjectType = '物理类';
      continue;
    }
    const match = line.match(linePattern);
    if (!match || !subjectType) continue;
    const subjectRequirement = match[4].trim();
    const planCategory = match[5].trim();
    rows.push({
      subjectType,
      universityCode: match[1],
      universityName: match[2].trim(),
      groupCode: match[3],
      groupName: `${match[3]}专业组(${subjectRequirement})${planCategory}`,
      subjectRequirement,
      planCategory,
      minScore: Number(match[6]),
      raw: line,
    });
  }

  return rows;
}

function toGroupRows(
  parsedRows: ReturnType<typeof parseBeijingPdfRows>,
  source: OfficialSource,
  byName: Map<string, UniversityRef>,
  rankMap: Map<number, number>,
) {
  return parsedRows.map((row): AdmissionRow => {
    const university = resolveUniversity(row.universityName, byName);
    const groupName = `专业组${row.groupCode}${row.subjectRequirement ? ` ${row.subjectRequirement}` : ''}`;
    return {
      universityId: university?.id || null,
      universityName: row.universityName,
      province: source.province,
      year: YEAR,
      batch: source.batch,
      subjectType: source.subjectType,
      lineType: 'major_group',
      groupCode: row.groupCode,
      groupName,
      subjectRequirement: row.subjectRequirement,
      minScore: row.minScore,
      minRank: rankMap.get(row.minScore) || null,
      sourceName: source.sourceName,
      sourceUrl: source.url,
      sourceType: source.sourceType,
      isPartial: false,
      dataQuality: university ? 'official_pdf' : 'official_pdf_unmatched_school',
      rawData: JSON.stringify(row),
    };
  });
}

async function parseSource(source: OfficialSource, byName: Map<string, UniversityRef>) {
  if (source.parser === 'shandong_xls') {
    return parseShandongXls(source, byName);
  }
  if (source.parser === 'zhejiang_xls') {
    return parseZhejiangXls(source, byName);
  }
  if (source.parser === 'hebei_xls') {
    return parseHebeiXls(source, byName);
  }
  if (source.parser === 'hunan_xls') {
    return parseHunanXls(source, byName);
  }
  if (source.parser === 'hainan_xls') {
    return parseHainanXls(source, byName);
  }
  if (source.parser === 'jiangxi_pdf') {
    const text = await parsePdf(path.join(FILE_DIR, source.file));
    return parseJiangxiPdfRows(text).map((row): AdmissionRow => {
      const university = resolveUniversity(row.universityName, byName);
      return {
        universityId: university?.id || null,
        universityName: row.universityName,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        subjectType: row.subjectType,
        lineType: 'major_group',
        groupCode: row.groupCode,
        groupName: row.groupName,
        minScore: row.minScore,
        minRank: row.minRank,
        sourceName: source.sourceName,
        sourceUrl: source.url,
        sourceType: source.sourceType,
        isPartial: false,
        dataQuality: university ? 'official_pdf' : 'official_pdf_unmatched_school',
        rawData: JSON.stringify(row),
      };
    });
  }
  if (source.parser === 'shanghai_pdf') {
    const rankMap = await loadRankMap(source.province, source.subjectType);
    const text = await parsePdf(path.join(FILE_DIR, source.file));
    return parseShanghaiPdfRows(text).map((row): AdmissionRow => {
      const university = resolveUniversity(row.universityName, byName);
      return {
        universityId: university?.id || null,
        universityName: row.universityName,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        subjectType: source.subjectType,
        lineType: 'major_group',
        groupCode: row.groupCode,
        groupName: row.groupName,
        minScore: row.minScore,
        minRank: row.minScore ? rankMap.get(row.minScore) || null : null,
        sourceName: source.sourceName,
        sourceUrl: source.url,
        sourceType: source.sourceType,
        isPartial: false,
        dataQuality: university ? 'official_pdf' : 'official_pdf_unmatched_school',
        rawData: JSON.stringify(row),
      };
    });
  }
  if (source.parser === 'guangdong_pdf') {
    const text = await parsePdf(path.join(FILE_DIR, source.file));
    return parseGuangdongPdfRows(text).map((row): AdmissionRow => {
      const university = resolveUniversity(row.universityName, byName);
      return {
        universityId: university?.id || null,
        universityName: row.universityName,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        subjectType: source.subjectType,
        lineType: 'major_group',
        groupCode: row.groupCode,
        groupName: `专业组${row.groupCode}`,
        minScore: row.minScore,
        minRank: row.minRank,
        planCount: row.planCount,
        sourceName: source.sourceName,
        sourceUrl: source.url,
        sourceType: source.sourceType,
        isPartial: false,
        dataQuality: university ? 'official_pdf' : 'official_pdf_unmatched_school',
        rawData: JSON.stringify(row),
      };
    });
  }
  if (source.parser === 'shanxi_pdf') {
    const rankMap = await loadRankMap(source.province, source.subjectType);
    const text = await parsePdf(path.join(FILE_DIR, source.file));
    return parseShanxiPdfRows(text, source.subjectType).map((row): AdmissionRow => {
      const university = resolveUniversity(row.universityName, byName);
      return {
        universityId: university?.id || null,
        universityName: row.universityName,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        subjectType: source.subjectType,
        lineType: 'major_group',
        groupCode: row.groupCode,
        groupName: row.groupName,
        minScore: row.minScore,
        minRank: rankMap.get(row.minScore) || null,
        sourceName: source.sourceName,
        sourceUrl: source.url,
        sourceType: source.sourceType,
        isPartial: false,
        dataQuality: university ? 'official_pdf' : 'official_pdf_unmatched_school',
        rawData: JSON.stringify(row),
      };
    });
  }
  if (source.parser === 'guangxi_pdf') {
    const rankMap = await loadRankMap(source.province, source.subjectType);
    const text = await parsePdf(path.join(FILE_DIR, source.file));
    return parseGuangxiPdfRows(text).map((row): AdmissionRow => {
      const university = resolveUniversity(row.universityName, byName);
      return {
        universityId: university?.id || null,
        universityName: row.universityName,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        subjectType: source.subjectType,
        lineType: 'major_group',
        groupCode: row.groupCode,
        groupName: `专业组${row.groupCode}`,
        minScore: row.minScore,
        minRank: rankMap.get(row.minScore) || null,
        sourceName: source.sourceName,
        sourceUrl: source.url,
        sourceType: source.sourceType,
        isPartial: false,
        dataQuality: university ? 'official_pdf' : 'official_pdf_unmatched_school',
        rawData: JSON.stringify(row),
      };
    });
  }
  if (source.parser === 'liaoning_pdf') {
    const rankMap = await loadRankMap(source.province, source.subjectType);
    const text = await parsePdf(path.join(FILE_DIR, source.file));
    return parseLiaoningPdfRows(text).map((row): AdmissionRow => {
      const university = resolveUniversity(row.universityName, byName);
      return {
        universityId: university?.id || null,
        universityName: row.universityName,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        subjectType: source.subjectType,
        majorName: row.majorName,
        lineType: 'major',
        groupCode: row.majorCode,
        groupName: `${row.majorCode} ${row.majorName}`,
        minScore: row.minScore,
        minRank: rankMap.get(row.minScore) || null,
        sourceName: source.sourceName,
        sourceUrl: source.url,
        sourceType: source.sourceType,
        isPartial: false,
        dataQuality: university ? 'official_pdf' : 'official_pdf_unmatched_school',
        rawData: JSON.stringify(row),
      };
    });
  }
  if (source.parser === 'guizhou_pdf') {
    const text = await parsePdf(path.join(FILE_DIR, source.file));
    return parseGuizhouPdfRows(text).map((row): AdmissionRow => {
      const university = resolveUniversity(row.universityName, byName);
      return {
        universityId: university?.id || null,
        universityName: row.universityName,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        subjectType: source.subjectType,
        majorName: row.majorName,
        lineType: 'major',
        groupCode: row.majorCode,
        groupName: `${row.majorCode} ${row.majorName}`,
        minScore: row.minScore,
        minRank: row.minRank,
        planCount: row.planCount,
        sourceName: source.sourceName,
        sourceUrl: source.url,
        sourceType: source.sourceType,
        isPartial: false,
        dataQuality: university ? 'official_pdf' : 'official_pdf_unmatched_school',
        rawData: JSON.stringify(row),
      };
    });
  }
  if (source.parser === 'ningxia_pdf') {
    const historyRankMap = await loadRankMap(source.province, '历史类');
    const physicsRankMap = await loadRankMap(source.province, '物理类');
    const text = await parsePdf(path.join(FILE_DIR, source.file));
    return parseNingxiaPdfRows(text).map((row): AdmissionRow => {
      const university = resolveUniversity(row.universityName, byName);
      const rankMap = row.subjectType === '历史类' ? historyRankMap : physicsRankMap;
      return {
        universityId: university?.id || null,
        universityName: row.universityName,
        province: source.province,
        year: YEAR,
        batch: source.batch,
        subjectType: row.subjectType,
        lineType: 'major_group',
        groupCode: row.groupCode,
        groupName: row.groupName,
        subjectRequirement: row.subjectRequirement,
        minScore: row.minScore,
        minRank: rankMap.get(row.minScore) || null,
        sourceName: source.sourceName,
        sourceUrl: source.url,
        sourceType: source.sourceType,
        isPartial: false,
        dataQuality: university ? 'official_pdf' : 'official_pdf_unmatched_school',
        rawData: JSON.stringify(row),
      };
    });
  }

  const rankMap = await loadRankMap(source.province, source.subjectType);
  const text = await parsePdf(path.join(FILE_DIR, source.file));
  const parsedRows = source.parser === 'beijing_pdf'
    ? parseBeijingPdfRows(text)
    : source.parser === 'hubei_pdf'
      ? parseHubeiPdfRows(text)
      : parseJiangsuPdfRows(text);
  return toGroupRows(parsedRows, source, byName, rankMap);
}

async function importSource(source: OfficialSource, byName: Map<string, UniversityRef>) {
  const rows = await parseSource(source, byName);
  if (REPLACE_SOURCE) {
    const deleteWhere = source.subjectType === 'mixed'
      ? {
          year: YEAR,
          province: source.province,
          sourceType: source.sourceType,
        }
      : {
          year: YEAR,
          province: source.province,
          subjectType: source.subjectType,
          sourceType: source.sourceType,
        };
    const deleted = await prisma.admissionScore.deleteMany({
      where: deleteWhere,
    });
    if (deleted.count) {
      console.log(`${source.key}: 已删除旧数据 ${deleted.count} 条`);
    }
  }
  if (rows.length) {
    await prisma.admissionScore.createMany({ data: rows });
  }

  const matched = rows.filter(row => row.universityId).length;
  const withRank = rows.filter(row => row.minRank).length;
  console.log(`${source.key}: 导入 ${rows.length} 条，匹配院校 ${matched} 条，带位次 ${withRank} 条`);
  return rows.length;
}

async function main() {
  const universities = await prisma.university.findMany({
    select: { id: true, name: true },
  });
  const byName = buildUniversityMap(universities);
  const selectedSources = SOURCES.filter(source => SOURCE === 'all' || source.key === SOURCE);
  if (!selectedSources.length) {
    throw new Error(`未知 SOURCE=${SOURCE}，可选：${SOURCES.map(item => item.key).join(', ')}, all`);
  }

  let total = 0;
  for (const source of selectedSources) {
    total += await importSource(source, byName);
  }
  console.log({ year: YEAR, total });
}

main()
  .catch((err) => {
    console.error('导入失败:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
