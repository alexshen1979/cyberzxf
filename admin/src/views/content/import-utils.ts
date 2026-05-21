export function parseImportText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) return JSON.parse(trimmed);
  return parseCsv(trimmed);
}

function parseCsv(text: string) {
  const table: string[][] = [];
  let cell = '';
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      table.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }

  if (cell || row.length) {
    row.push(cell.trim());
    table.push(row);
  }

  const [headers, ...lines] = table.filter(item => item.some(Boolean));
  if (!headers) return [];
  const index = new Map(headers.map((header, i) => [normalizeHeader(header), i]));

  return lines.map(line => {
    const item: Record<string, any> = {};
    index.forEach((column, key) => {
      const raw = line[column];
      if (raw !== undefined && raw !== '') item[key] = raw;
    });
    return coerceNumbers(item);
  }).filter(item => Object.keys(item).length);
}

function normalizeHeader(header: string) {
  const key = header.replace(/^\uFEFF/, '').trim().toLowerCase();
  const map: Record<string, string> = {
    province: 'province',
    '省份': 'province',
    year: 'year',
    '年份': 'year',
    artcategory: 'artCategory',
    art_category: 'artCategory',
    '艺术类别': 'artCategory',
    '艺术类': 'artCategory',
    batch: 'batch',
    '批次': 'batch',
    subjecttype: 'subjectType',
    subject_type: 'subjectType',
    '科类': 'subjectType',
    formulatype: 'formulaType',
    formula_type: 'formulaType',
    '公式类型': 'formulaType',
    culturefullscore: 'cultureFullScore',
    culture_full_score: 'cultureFullScore',
    '文化满分': 'cultureFullScore',
    professionalfullscore: 'professionalFullScore',
    professional_full_score: 'professionalFullScore',
    '专业满分': 'professionalFullScore',
    cultureweight: 'cultureWeight',
    culture_weight: 'cultureWeight',
    '文化权重': 'cultureWeight',
    professionalweight: 'professionalWeight',
    professional_weight: 'professionalWeight',
    '专业权重': 'professionalWeight',
    scaleto: 'scaleTo',
    scale_to: 'scaleTo',
    '折算满分': 'scaleTo',
    minculturescore: 'minCultureScore',
    min_culture_score: 'minCultureScore',
    '文化控制线': 'minCultureScore',
    minprofessionalscore: 'minProfessionalScore',
    min_professional_score: 'minProfessionalScore',
    '专业控制线': 'minProfessionalScore',
    universityname: 'universityName',
    university_name: 'universityName',
    '院校': 'universityName',
    '院校名称': 'universityName',
    majorname: 'majorName',
    major_name: 'majorName',
    '专业': 'majorName',
    groupcode: 'groupCode',
    group_code: 'groupCode',
    '专业组代码': 'groupCode',
    groupname: 'groupName',
    group_name: 'groupName',
    '专业组': 'groupName',
    mincompositescore: 'minCompositeScore',
    min_composite_score: 'minCompositeScore',
    '最低综合分': 'minCompositeScore',
    minrank: 'minRank',
    min_rank: 'minRank',
    '最低位次': 'minRank',
    '位次': 'minRank',
    plancount: 'planCount',
    plan_count: 'planCount',
    '计划数': 'planCount',
    admissionmethod: 'admissionMethod',
    admission_method: 'admissionMethod',
    '投档方式': 'admissionMethod',
    sourcename: 'sourceName',
    source_name: 'sourceName',
    '来源名称': 'sourceName',
    sourceurl: 'sourceUrl',
    source_url: 'sourceUrl',
    '来源链接': 'sourceUrl',
    sourcetype: 'sourceType',
    source_type: 'sourceType',
    '来源类型': 'sourceType',
    dataquality: 'dataQuality',
    data_quality: 'dataQuality',
    '数据质量': 'dataQuality',
    notes: 'notes',
    '备注': 'notes',
  };
  return map[key] || key;
}

function coerceNumbers(item: Record<string, any>) {
  const numericKeys = [
    'year',
    'cultureFullScore',
    'professionalFullScore',
    'cultureWeight',
    'professionalWeight',
    'scaleTo',
    'minCultureScore',
    'minProfessionalScore',
    'minCompositeScore',
    'minRank',
    'planCount',
  ];
  for (const key of numericKeys) {
    if (item[key] === undefined) continue;
    const n = Number(String(item[key]).replace(/[,\s]/g, ''));
    if (Number.isFinite(n)) item[key] = n;
  }
  return item;
}
