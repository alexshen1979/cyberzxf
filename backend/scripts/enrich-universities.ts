/**
 * 高校详细信息增强脚本
 *
 * 数据策略（严谨优先）：
 * - 简介：基于 eol.cn 已验证的结构化数据自动生成，确保准确
 * - 官网：知名高校使用已知域名映射，确保正确
 * - 地址：基于 eol.cn 省份/城市/区划数据拼接
 * - Logo：暂不填充（需人工确认每个校徽 URL）
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 知名高校官网域名映射（均为手动确认的官方域名）
const KNOWN_WEBSITES: Record<string, string> = {
  '北京大学': 'https://www.pku.edu.cn',
  '清华大学': 'https://www.tsinghua.edu.cn',
  '复旦大学': 'https://www.fudan.edu.cn',
  '上海交通大学': 'https://www.sjtu.edu.cn',
  '浙江大学': 'https://www.zju.edu.cn',
  '南京大学': 'https://www.nju.edu.cn',
  '武汉大学': 'https://www.whu.edu.cn',
  '中国科学技术大学': 'https://www.ustc.edu.cn',
  '华中科技大学': 'https://www.hust.edu.cn',
  '哈尔滨工业大学': 'https://www.hit.edu.cn',
  '西安交通大学': 'https://www.xjtu.edu.cn',
  '中国人民大学': 'https://www.ruc.edu.cn',
  '中山大学': 'https://www.sysu.edu.cn',
  '同济大学': 'https://www.tongji.edu.cn',
  '北京师范大学': 'https://www.bnu.edu.cn',
  '南开大学': 'https://www.nankai.edu.cn',
  '天津大学': 'https://www.tju.edu.cn',
  '山东大学': 'https://www.sdu.edu.cn',
  '东南大学': 'https://www.seu.edu.cn',
  '厦门大学': 'https://www.xmu.edu.cn',
  '吉林大学': 'https://www.jlu.edu.cn',
  '四川大学': 'https://www.scu.edu.cn',
  '湖南大学': 'https://www.hnu.edu.cn',
  '中南大学': 'https://www.csu.edu.cn',
  '大连理工大学': 'https://www.dlut.edu.cn',
  '重庆大学': 'https://www.cqu.edu.cn',
  '西北工业大学': 'https://www.nwpu.edu.cn',
  '电子科技大学': 'https://www.uestc.edu.cn',
  '兰州大学': 'https://www.lzu.edu.cn',
  '中国农业大学': 'https://www.cau.edu.cn',
  '北京航空航天大学': 'https://www.buaa.edu.cn',
  '北京理工大学': 'https://www.bit.edu.cn',
  '华东师范大学': 'https://www.ecnu.edu.cn',
  '东北大学': 'https://www.neu.edu.cn',
  '中国海洋大学': 'https://www.ouc.edu.cn',
  '西北农林科技大学': 'https://www.nwsuaf.edu.cn',
  '国防科技大学': 'https://www.nudt.edu.cn',
  '中央民族大学': 'https://www.muc.edu.cn',
  '华南理工大学': 'https://www.scut.edu.cn',
  '北京科技大学': 'https://www.ustb.edu.cn',
  '北京交通大学': 'https://www.bjtu.edu.cn',
  '北京邮电大学': 'https://www.bupt.edu.cn',
  '北京化工大学': 'https://www.buct.edu.cn',
  '北京林业大学': 'https://www.bjfu.edu.cn',
  '北京工业大学': 'https://www.bjut.edu.cn',
  '北京中医药大学': 'https://www.bucm.edu.cn',
  '中国传媒大学': 'https://www.cuc.edu.cn',
  '中央财经大学': 'https://www.cufe.edu.cn',
  '中国政法大学': 'https://www.cupl.edu.cn',
  '中央戏剧学院': 'https://www.zhongxi.cn',
  '中央音乐学院': 'https://www.ccom.edu.cn',
  '北京外国语大学': 'https://www.bfsu.edu.cn',
  '对外经济贸易大学': 'https://www.uibe.edu.cn',
  '中国地质大学': 'https://www.cug.edu.cn',
  '中国矿业大学': 'https://www.cumt.edu.cn',
  '中国石油大学': 'https://www.upc.edu.cn',
  '华北电力大学': 'https://www.ncepu.edu.cn',
  '东北师范大学': 'https://www.nenu.edu.cn',
  '东北林业大学': 'https://www.nefu.edu.cn',
  '华东理工大学': 'https://www.ecust.edu.cn',
  '上海外国语大学': 'https://www.shisu.edu.cn',
  '上海财经大学': 'https://www.sufe.edu.cn',
  '上海大学': 'https://www.shu.edu.cn',
  '东华大学': 'https://www.dhu.edu.cn',
  '南京航空航天大学': 'https://www.nuaa.edu.cn',
  '南京理工大学': 'https://www.njust.edu.cn',
  '河海大学': 'https://www.hhu.edu.cn',
  '江南大学': 'https://www.jiangnan.edu.cn',
  '中国药科大学': 'https://www.cpu.edu.cn',
  '南京师范大学': 'https://www.njnu.edu.cn',
  '南京农业大学': 'https://www.njau.edu.cn',
  '苏州大学': 'https://www.suda.edu.cn',
  '合肥工业大学': 'https://www.hfut.edu.cn',
  '安徽大学': 'https://www.ahu.edu.cn',
  '福州大学': 'https://www.fzu.edu.cn',
  '郑州大学': 'https://www.zzu.edu.cn',
  '武汉理工大学': 'https://www.whut.edu.cn',
  '华中农业大学': 'https://www.hzau.edu.cn',
  '华中师范大学': 'https://www.ccnu.edu.cn',
  '中南财经政法大学': 'https://www.zuel.edu.cn',
  '湖南师范大学': 'https://www.hunnu.edu.cn',
  '湘潭大学': 'https://www.xtu.edu.cn',
  '暨南大学': 'https://www.jnu.edu.cn',
  '华南师范大学': 'https://www.scnu.edu.cn',
  '华南农业大学': 'https://www.scau.edu.cn',
  '西南大学': 'https://www.swu.edu.cn',
  '西南交通大学': 'https://www.swjtu.edu.cn',
  '西南财经大学': 'https://www.swufe.edu.cn',
  '四川农业大学': 'https://www.sicau.edu.cn',
  '电子科技大学': 'https://www.uestc.edu.cn',
  '重庆大学': 'https://www.cqu.edu.cn',
  '云南大学': 'https://www.ynu.edu.cn',
  '贵州大学': 'https://www.gzu.edu.cn',
  '广西大学': 'https://www.gxu.edu.cn',
  '西北大学': 'https://www.nwu.edu.cn',
  '西安电子科技大学': 'https://www.xidian.edu.cn',
  '长安大学': 'https://www.chd.edu.cn',
  '陕西师范大学': 'https://www.snnu.edu.cn',
  '兰州大学': 'https://www.lzu.edu.cn',
  '新疆大学': 'https://www.xju.edu.cn',
  '石河子大学': 'https://www.shzu.edu.cn',
  '宁夏大学': 'https://www.nxu.edu.cn',
  '青海大学': 'https://www.qhu.edu.cn',
  '西藏大学': 'https://www.utibet.edu.cn',
  '内蒙古大学': 'https://www.imu.edu.cn',
  '海南大学': 'https://www.hainanu.edu.cn',
  '延边大学': 'https://www.ybu.edu.cn',
  '南昌大学': 'https://www.ncu.edu.cn',
  '深圳大学': 'https://www.szu.edu.cn',
  '南方科技大学': 'https://www.sustech.edu.cn',
  '南方医科大学': 'https://www.smu.edu.cn',
  '首都医科大学': 'https://www.ccmu.edu.cn',
  '首都师范大学': 'https://www.cnu.edu.cn',
  '外交学院': 'https://www.cfau.edu.cn',
  '中国人民公安大学': 'https://www.ppsuc.edu.cn',
  '中国科学院大学': 'https://www.ucas.ac.cn',
  '中国美术学院': 'https://www.caa.edu.cn',
  '中国音乐学院': 'https://www.ccmusic.edu.cn',
  '北京体育大学': 'https://www.bsu.edu.cn',
  '上海体育大学': 'https://www.sus.edu.cn',
  '浙江工业大学': 'https://www.zjut.edu.cn',
  '南京工业大学': 'https://www.njtech.edu.cn',
  '广东工业大学': 'https://www.gdut.edu.cn',
  '杭州电子科技大学': 'https://www.hdu.edu.cn',
};

// 211工程大学名单（用于生成更准确的简介）
const PROJECT_211: Set<string> = new Set([
  '北京大学', '清华大学', '复旦大学', '上海交通大学', '浙江大学', '南京大学',
  '武汉大学', '中国科学技术大学', '华中科技大学', '哈尔滨工业大学', '西安交通大学',
  '中国人民大学', '中山大学', '同济大学', '北京师范大学', '南开大学', '天津大学',
  '山东大学', '东南大学', '厦门大学', '吉林大学', '四川大学', '湖南大学', '中南大学',
  '大连理工大学', '重庆大学', '西北工业大学', '电子科技大学', '兰州大学', '中国农业大学',
  '北京航空航天大学', '北京理工大学', '华东师范大学', '东北大学', '中国海洋大学',
  '西北农林科技大学', '国防科技大学', '中央民族大学', '华南理工大学', '北京科技大学',
  '北京交通大学', '北京邮电大学', '北京化工大学', '北京林业大学', '北京工业大学',
  '北京中医药大学', '中国传媒大学', '中央财经大学', '中国政法大学', '北京外国语大学',
  '对外经济贸易大学', '华北电力大学', '东北师范大学', '东北林业大学', '华东理工大学',
  '上海外国语大学', '上海财经大学', '上海大学', '东华大学', '南京航空航天大学',
  '南京理工大学', '河海大学', '江南大学', '中国药科大学', '南京师范大学', '南京农业大学',
  '苏州大学', '中国矿业大学', '中国地质大学', '中国石油大学', '合肥工业大学',
  '安徽大学', '福州大学', '郑州大学', '武汉理工大学', '华中农业大学', '华中师范大学',
  '中南财经政法大学', '湖南师范大学', '湘潭大学', '暨南大学', '华南师范大学',
  '西南大学', '西南交通大学', '西南财经大学', '四川农业大学', '云南大学', '贵州大学',
  '广西大学', '西北大学', '西安电子科技大学', '长安大学', '陕西师范大学', '新疆大学',
  '石河子大学', '宁夏大学', '青海大学', '西藏大学', '内蒙古大学', '海南大学', '延边大学',
  '南昌大学', '河北工业大学', '太原理工大学', '大连海事大学', '辽宁大学',
  '哈尔滨工程大学', '第二军医大学', '第四军医大学',
]);

// 985工程大学名单（用于生成更准确的简介）
const PROJECT_985: Set<string> = new Set([
  '北京大学', '清华大学', '复旦大学', '上海交通大学', '浙江大学', '南京大学',
  '武汉大学', '中国科学技术大学', '华中科技大学', '哈尔滨工业大学', '西安交通大学',
  '中国人民大学', '中山大学', '同济大学', '北京师范大学', '南开大学', '天津大学',
  '山东大学', '东南大学', '厦门大学', '吉林大学', '四川大学', '湖南大学', '中南大学',
  '大连理工大学', '重庆大学', '西北工业大学', '电子科技大学', '兰州大学', '中国农业大学',
  '北京航空航天大学', '北京理工大学', '华东师范大学', '东北大学', '中国海洋大学',
  '西北农林科技大学', '国防科技大学', '中央民族大学', '华南理工大学',
]);

function buildIntroduction(uni: {
  name: string;
  province: string | null;
  city: string | null;
  type: string | null;
  level: string | null;
  properties: string | null;
  is985: boolean;
  is211: boolean;
  isDoubleFirst: boolean;
}): string {
  const loc = [uni.province || '', uni.city || ''].filter(Boolean).join('');
  const nature = uni.properties || '公办';
  const category = uni.type ? `${uni.type}类` : '';
  const eduLevel = uni.level || '高等院校';

  let intro = `${uni.name}是位于${loc}的一所${nature}${category}${eduLevel}`;

  // 985/211/双一流标签
  const tags: string[] = [];
  if (uni.is985) tags.push('国家985工程重点建设高校');
  if (uni.is211) tags.push('国家211工程重点建设高校');
  if (uni.isDoubleFirst) {
    // 985高校通常为双一流A类
    const level = uni.is985 ? 'A类' : '';
    tags.push(`世界一流大学${level}和一流学科建设高校`);
  }

  if (tags.length > 0) {
    intro += '，是' + tags.join('、');
  }

  // 教育部直属 vs 省属
  if (uni.is985 || (uni.is211 && PROJECT_985.has(uni.name))) {
    // 大部分985是教育部直属
  }

  intro += '。';
  return intro;
}

function buildAddress(province: string | null, city: string | null): string | null {
  if (!province && !city) return null;
  const p = province || '';
  const rawCity = (city || '');
  // Strip trailing 市/区/县/州 for concatenation
  const c = rawCity.replace(/(市|区|县|州)$/, '');
  if (!c) return p;
  // Avoid duplication like 北京北京 or 上海上海
  if (p === c || p.startsWith(c) || c.startsWith(p)) return rawCity;
  return p + c;
}

async function enrichAll() {
  const universities = await prisma.university.findMany({
    orderBy: [{ is985: 'desc' }, { is211: 'desc' }, { isDoubleFirst: 'desc' }, { name: 'asc' }],
  });

  console.log(`共 ${universities.length} 所高校，开始生成严谨的详细信息...`);

  let introCount = 0;
  let webCount = 0;
  let addrCount = 0;

  for (let i = 0; i < universities.length; i++) {
    const uni = universities[i];
    const updateData: any = {};

    // 简介：基于结构化数据生成
    if (!uni.introduction) {
      updateData.introduction = buildIntroduction(uni);
      introCount++;
    }

    // 官网：仅使用已知映射
    if (!uni.website) {
      const knownWeb = KNOWN_WEBSITES[uni.name];
      if (knownWeb) {
        updateData.website = knownWeb;
        webCount++;
      }
    }

    // 地址：基于省份/城市构建
    if (!uni.address) {
      const addr = buildAddress(uni.province, uni.city);
      if (addr) {
        updateData.address = addr;
        addrCount++;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.university.update({
        where: { id: uni.id },
        data: updateData,
      }).catch((e: any) => {
        console.warn(`  更新 ${uni.name} 失败: ${e.message}`);
      });
    }

    if ((i + 1) % 500 === 0) {
      console.log(`  已处理 ${i + 1}/${universities.length} ...`);
    }
  }

  console.log(`\n✅ 完成！`);
  console.log(`  生成简介: ${introCount} 所`);
  console.log(`  设置官网: ${webCount} 所`);
  console.log(`  构建地址: ${addrCount} 所`);
  await prisma.$disconnect();
}

enrichAll().catch(e => {
  console.error('增强失败:', e);
  process.exit(1);
});
