import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SOURCES = [
  {
    url: 'https://www.gk100.com/read_28044029.htm',
    year: 2025,
    province: '河北',
    sections: [
      { marker: '下面是物理类分数排名前30强名单', subjectType: '物理类', batch: '本科批-院校最低投档线（高考100摘录）' },
      { marker: '下面是历史类分数排名前30强名单', subjectType: '历史类', batch: '本科批-院校最低投档线（高考100摘录）' },
    ],
  },
  {
    url: 'https://www.gk100.com/read_80263.htm',
    year: 2025,
    province: '山东',
    sections: [
      { marker: '2025全国大学在山东高考招生录取分数线一览表', subjectType: '综合改革', batch: '一段-院校最低投档线（高考100摘录）' },
    ],
  },
  {
    url: 'https://www.gk100.com/read_67018.htm',
    year: 2025,
    province: '江苏',
    sections: [
      { marker: '下面是江苏省物理类2025年各本科大学高考录取分数线一览表', subjectType: '物理类', batch: '本科批-院校专业组最低投档线（高考100摘录）' },
    ],
  },
  {
    url: 'https://www.gk100.com/read_64235.htm',
    year: 2025,
    province: '湖南',
    sections: [
      { marker: '湖南省分数线最高的50个本科院校专业组', subjectType: '物理类', batch: '本科批-院校专业组最低投档线（高考100摘录）' },
    ],
  },
  {
    url: 'https://www.gk100.com/read_3591621.htm',
    year: 2025,
    province: '重庆',
    sections: [
      { marker: '分数线排名最高的前100所本科学校名单', subjectType: '物理类', batch: '本科批-院校专业组最低投档线（高考100摘录）' },
    ],
  },
  {
    url: 'https://www.gk100.com/read_3788544.htm',
    year: 2025,
    province: '贵州',
    sections: [
      { marker: '分数线排名最高的前100所本科学校名单', subjectType: '物理类', batch: '本科批-院校专业组最低投档线（高考100摘录）' },
    ],
  },
  {
    url: 'https://www.gk100.com/read_68525.htm',
    year: 2025,
    province: '重庆',
    sections: [
      { marker: '全国本科各高校在重庆历史组录取分数线', subjectType: '历史类', batch: '本科批-院校专业组最低投档线（高考100摘录）' },
    ],
  },
  {
    url: 'https://www.gk100.com/read_98906742.htm',
    year: 2025,
    province: '新疆',
    sections: [
      { marker: '下面是全国一本大学录取分数线前100名一览表', subjectType: '理科', batch: '本科一批-院校最低投档线（高考100摘录）' },
    ],
  },
  {
    url: 'https://www.gk100.com/read_81329.htm',
    year: 2025,
    province: '四川',
    sections: [
      { marker: '2025全国大学录取分数线排名Top100<br/>（四川历史类）', subjectType: '历史类', batch: '本科批-院校专业组最低投档线（高考100摘录）' },
      { marker: '2025全国大学录取分数线排名Top100<br/>(四川物理类）', subjectType: '物理类', batch: '本科批-院校专业组最低投档线（高考100摘录）' },
    ],
  },
  {
    url: 'https://www.gk100.com/read_81329.htm',
    year: 2025,
    province: '安徽',
    sections: [
      { marker: '2025全国大学录取分数线排名Top100<br/>(安徽物理类）', subjectType: '物理类', batch: '本科批-院校专业组最低投档线（高考100摘录）' },
      { marker: '2025全国大学录取分数线排名Top100<br/>(安徽历史类）', subjectType: '历史类', batch: '本科批-院校专业组最低投档线（高考100摘录）' },
    ],
  },
  {
    url: 'https://www.gk100.com/read_81329.htm',
    year: 2025,
    province: '广东',
    sections: [
      { marker: '2025全国大学录取分数线排名Top100<br/>(广东物理类）', subjectType: '物理类', batch: '本科批-院校专业组最低投档线（高考100摘录）' },
      { marker: '2025全国大学录取分数线排名Top100<br/>(广东历史类）', subjectType: '历史类', batch: '本科批-院校专业组最低投档线（高考100摘录）' },
    ],
  },
  {
    url: 'https://www.gk100.com/read_23844.htm',
    year: 2025,
    province: '山东',
    sections: [
      { marker: '2025年在山东省各大学在一段的录取分数线', subjectType: '综合改革', batch: '山东省内一段-院校最低投档线（高考100摘录）' },
    ],
  },
  {
    url: 'https://www.gk100.com/read_56867240.htm',
    year: 2024,
    province: '浙江',
    sections: [
      { marker: '下面是2024年一段分数线最高的100所大学名单一览表', subjectType: '综合改革', batch: '一段-院校最低投档线（高考100摘录）' },
    ],
  },
];

function decodeHtml(text: string) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html: string) {
  return decodeHtml(html.replace(/<br\s*\/?>/gi, '').replace(/<[^>]*>/g, ''));
}

function parseRank(value: string) {
  const match = value.replace(/,/g, '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function baseUniversityName(name: string) {
  return name.replace(/\s/g, '').replace(/[（(].*?[）)]/g, '');
}

function parseSectionTable(html: string, marker: string) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return [];

  const previousTableStart = html.lastIndexOf('<table', markerIndex);
  const previousTableEnd = previousTableStart >= 0 ? html.indexOf('</table>', previousTableStart) : -1;
  const markerInsideTable = previousTableStart >= 0 && previousTableEnd > markerIndex;
  const tableStart = markerInsideTable ? previousTableStart : html.indexOf('<table', markerIndex);
  const tableEnd = markerInsideTable ? previousTableEnd : html.indexOf('</table>', tableStart);
  if (tableStart < 0 || tableEnd < 0) return [];

  const table = html.slice(tableStart, tableEnd + 8);
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  return rows.map((row) => {
    const headers = [...row[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map(cell => stripTags(cell[1]));
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => stripTags(cell[1]));
    if (headers.length || cells.length < 3) return null;

    const nameIndex = /^\d+$/.test(cells[0]) && cells[1] ? 1 : 0;
    const scoreIndex = cells.findIndex((cell, index) =>
      index > nameIndex && /^\d{2,3}$/.test(cell) && Number(cell) >= 100 && Number(cell) <= 750
    );
    if (scoreIndex < 0) return null;

    return {
      universityName: cells[nameIndex],
      groupName: scoreIndex > nameIndex + 1 ? cells.slice(nameIndex + 1, scoreIndex).filter(Boolean).join(' ') : '',
      minScore: Number(cells[scoreIndex]),
      minRank: cells[scoreIndex + 1] ? parseRank(cells[scoreIndex + 1]) : null,
    };
  }).filter((row): row is { universityName: string; groupName: string; minScore: number; minRank: number | null } =>
    Boolean(row && row.universityName && Number.isFinite(row.minScore))
  );
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const universities = await prisma.university.findMany({
    select: { id: true, name: true },
  });
  const byName = new Map(universities.map(item => [item.name, item]));
  const byBaseName = new Map<string, { id: string; name: string }>();
  for (const university of universities) {
    const baseName = baseUniversityName(university.name);
    if (!byBaseName.has(baseName)) byBaseName.set(baseName, university);
  }

  let totalSaved = 0;
  let totalSkipped = 0;

  for (const source of SOURCES) {
    const html = await fetchHtml(source.url);

    for (const section of source.sections) {
      const parsedRows = parseSectionTable(html, section.marker);
      const rows = parsedRows.map((row) => {
        const exact = byName.get(row.universityName);
        const base = byBaseName.get(baseUniversityName(row.universityName));
        const university = exact || base;
        if (!university) return null;

        return {
          universityId: university.id,
          universityName: row.universityName,
          province: source.province,
          year: source.year,
          batch: section.batch,
          subjectType: section.subjectType,
          majorName: [
            row.universityName === university.name ? '院校最低投档线' : `${row.universityName} 院校最低投档线`,
            row.groupName,
          ].filter(Boolean).join(' · '),
          minScore: row.minScore,
          minRank: row.minRank,
          avgScore: null,
          planCount: null,
        };
      }).filter((row): row is NonNullable<typeof row> => Boolean(row));

      totalSkipped += parsedRows.length - rows.length;
      await prisma.admissionScore.deleteMany({
        where: {
          year: source.year,
          province: source.province,
          subjectType: section.subjectType,
          batch: section.batch,
        },
      });
      if (rows.length) await prisma.admissionScore.createMany({ data: rows });
      totalSaved += rows.length;

      console.log(`${source.year} ${source.province} ${section.subjectType}: 解析 ${parsedRows.length} 条，保存 ${rows.length} 条`);
    }
  }

  console.log({ totalSaved, totalSkipped });
}

main()
  .catch((err) => {
    console.error('导入失败:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
