<template>
  <div class="score-ranks-page">
    <div class="page-header">
      <div>
        <h2>一分一段表</h2>
        <span class="sub">管理省份、年份、科类、分数对应位次，用于小程序自动回填位次</span>
      </div>
      <div class="header-actions">
        <el-button @click="openImport">批量导入</el-button>
        <el-button type="primary" @click="openDialog()">新增记录</el-button>
        <span class="header-info">共 {{ total }} 条</span>
      </div>
    </div>

    <el-form class="filters" inline @submit.prevent>
      <el-form-item label="省份">
        <el-select v-model="filters.province" placeholder="全部省份" clearable filterable @change="search">
          <el-option v-for="item in provinceOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="年份">
        <el-select v-model="filters.year" placeholder="全部年份" clearable @change="search">
          <el-option v-for="item in yearOptions" :key="item" :label="`${item}年`" :value="String(item)" />
        </el-select>
      </el-form-item>
      <el-form-item label="科类">
        <el-select v-model="filters.subjectType" placeholder="全部科类" clearable filterable @change="search">
          <el-option label="综合改革" value="综合改革" />
          <el-option label="物理类" value="物理类" />
          <el-option label="历史类" value="历史类" />
          <el-option label="理科" value="理科" />
          <el-option label="文科" value="文科" />
        </el-select>
      </el-form-item>
      <el-form-item label="分数">
        <el-input v-model="filters.score" placeholder="500" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">搜索</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="rows" v-loading="loading" height="calc(100vh - 270px)">
      <el-table-column label="年份/省份/科类" width="190">
        <template #default="{ row }">
          <div class="main-cell">{{ row.year }} · {{ row.province }}</div>
          <div class="cell-sub">{{ row.subjectType }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="score" label="分数" width="100" sortable />
      <el-table-column prop="rank" label="累计位次" width="130" sortable />
      <el-table-column prop="sameScoreCount" label="本段人数" width="120">
        <template #default="{ row }">{{ row.sameScoreCount ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="数据来源" min-width="260" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="main-cell">{{ row.sourceName || '-' }}</div>
          <div class="cell-sub">{{ row.sourceType || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="170">
        <template #default="{ row }">{{ formatDate(row.updatedAt || row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button link type="primary" size="small" :disabled="!row.sourceUrl" @click="openSource(row)">来源</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="total, prev, pager, next"
      class="pagination"
      @current-change="load"
    />

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑一分一段' : '新增一分一段'" width="680px">
      <el-form :model="form" label-width="92px">
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="年份">
              <el-select v-model="form.year" placeholder="选择年份" style="width:100%">
                <el-option v-for="item in yearOptions" :key="item" :label="`${item}年`" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="省份">
              <el-select v-model="form.province" placeholder="选择省份" filterable style="width:100%">
                <el-option v-for="item in provinceOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="科类">
              <el-select v-model="form.subjectType" filterable allow-create default-first-option style="width:100%">
                <el-option label="综合改革" value="综合改革" />
                <el-option label="物理类" value="物理类" />
                <el-option label="历史类" value="历史类" />
                <el-option label="理科" value="理科" />
                <el-option label="文科" value="文科" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="分数"><el-input-number v-model="form.score" :min="0" :max="750" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="累计位次"><el-input-number v-model="form.rank" :min="1" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="本段人数"><el-input-number v-model="form.sameScoreCount" :min="0" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="来源名称"><el-input v-model="form.sourceName" placeholder="中国教育在线/掌上高考" /></el-form-item>
        <el-form-item label="来源类型"><el-input v-model="form.sourceType" placeholder="eol_score_rank_html / score_rank_csv" /></el-form-item>
        <el-form-item label="来源链接"><el-input v-model="form.sourceUrl" placeholder="https://..." /></el-form-item>
        <el-form-item label="原始数据"><el-input v-model="form.rawData" type="textarea" :rows="4" placeholder="可选，JSON 或备注" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importVisible" title="批量导入一分一段" width="780px">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="import-tip"
        title="支持 JSON 数组，也支持 CSV。CSV 表头可用 province,year,subjectType,score,rank,sameScoreCount 或 省份,年份,科类,分数,位次,本段人数。"
      />
      <el-input v-model="importText" type="textarea" :rows="18" />
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" @click="submitImport">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const filters = reactive({ province: '', subjectType: '', year: '', score: '' });
const rows = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const dialogVisible = ref(false);
const importVisible = ref(false);
const form = reactive<any>({});
const importText = ref('省份,年份,科类,分数,位次,本段人数,来源名称,来源链接\n江苏,2025,物理类,500,162612,1351,中国教育在线/掌上高考,https://gaokao.eol.cn/');
const fallbackProvinces = [
  '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南',
  '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州',
  '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
];
const provinceOptions = ref<string[]>(fallbackProvinces);
const yearOptions = ref<number[]>([2026, 2025]);

async function load() {
  loading.value = true;
  try {
    const res: any = await api.scoreRanks.list({ ...filters, page: page.value, pageSize });
    rows.value = res.data.list;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  load();
}

function reset() {
  Object.assign(filters, { province: '', subjectType: '', year: '', score: '' });
  search();
}

function openDialog(row?: any) {
  Object.keys(form).forEach(key => delete form[key]);
  Object.assign(form, row || {
    year: yearOptions.value.includes(2025) ? 2025 : yearOptions.value[0],
    province: '',
    subjectType: '',
    score: undefined,
    rank: undefined,
    sameScoreCount: undefined,
    sourceName: '',
    sourceType: '',
    sourceUrl: '',
    rawData: '',
  });
  dialogVisible.value = true;
}

async function loadOptions() {
  await Promise.all([loadProvinceOptions(), loadYearOptions()]);
}

async function loadProvinceOptions() {
  try {
    const res: any = await api.regions.tree();
    const options = (res.data || []).map((item: any) => item.name).filter(Boolean);
    provinceOptions.value = options.length ? options : fallbackProvinces;
  } catch {
    provinceOptions.value = fallbackProvinces;
  }
}

async function loadYearOptions() {
  try {
    const res: any = await api.scoreRanks.dataYears();
    yearOptions.value = [...new Set([...(res.data?.scoreRankYears || []).map((item: any) => Number(item.year)), 2026, 2025])]
      .filter(item => Number.isInteger(item))
      .sort((a, b) => b - a);
  } catch {
    yearOptions.value = [2026, 2025];
  }
}

async function save() {
  if (!form.province || !form.year || !form.subjectType || form.score === undefined || form.rank === undefined) {
    ElMessage.warning('省份、年份、科类、分数、位次必填');
    return;
  }
  if (form.id) await api.scoreRanks.update(form.id, form);
  else await api.scoreRanks.create(form);
  ElMessage.success('保存成功');
  dialogVisible.value = false;
  load();
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除 ${row.year} ${row.province} ${row.subjectType} ${row.score} 分？`, '确认删除', { type: 'warning' });
  } catch { return; }
  await api.scoreRanks.delete(row.id);
  ElMessage.success('已删除');
  load();
}

function openSource(row: any) {
  if (row.sourceUrl) window.open(row.sourceUrl, '_blank');
}

function openImport() {
  importVisible.value = true;
}

async function submitImport() {
  let items: any[];
  try {
    items = parseImportText(importText.value);
  } catch (err: any) {
    ElMessage.error(err?.message || '导入内容格式错误');
    return;
  }
  if (!Array.isArray(items) || !items.length) {
    ElMessage.error('没有可导入的数据');
    return;
  }
  const res: any = await api.scoreRanks.import(items);
  ElMessage.success(`导入成功：${res.data.count} 条`);
  importVisible.value = false;
  load();
}

function parseImportText(text: string) {
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
  return lines.map(line => ({
    province: line[index.get('province') ?? -1],
    year: toNumber(line[index.get('year') ?? -1]),
    subjectType: line[index.get('subjectType') ?? -1],
    score: toNumber(line[index.get('score') ?? -1]),
    rank: toNumber(line[index.get('rank') ?? -1]),
    sameScoreCount: toNullableNumber(line[index.get('sameScoreCount') ?? -1]),
    sourceName: line[index.get('sourceName') ?? -1] || undefined,
    sourceUrl: line[index.get('sourceUrl') ?? -1] || undefined,
    sourceType: line[index.get('sourceType') ?? -1] || 'score_rank_csv',
  })).filter(item => item.province && item.year && item.subjectType && item.score !== null && item.rank !== null);
}

function normalizeHeader(header: string) {
  const key = header.replace(/^\uFEFF/, '').trim().toLowerCase();
  const map: Record<string, string> = {
    province: 'province',
    '省份': 'province',
    year: 'year',
    '年份': 'year',
    subjecttype: 'subjectType',
    subject_type: 'subjectType',
    '科类': 'subjectType',
    '选科': 'subjectType',
    score: 'score',
    '分数': 'score',
    rank: 'rank',
    '位次': 'rank',
    '累计人数': 'rank',
    samescorecount: 'sameScoreCount',
    same_score_count: 'sameScoreCount',
    count: 'sameScoreCount',
    '本段人数': 'sameScoreCount',
    '同分人数': 'sameScoreCount',
    sourcename: 'sourceName',
    source_name: 'sourceName',
    '来源名称': 'sourceName',
    sourceurl: 'sourceUrl',
    source_url: 'sourceUrl',
    '来源链接': 'sourceUrl',
    sourcetype: 'sourceType',
    source_type: 'sourceType',
    '来源类型': 'sourceType',
  };
  return map[key] || key;
}

function toNumber(value: string | undefined) {
  if (!value) return null;
  const n = Number(value.replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toNullableNumber(value: string | undefined) {
  return value ? toNumber(value) : undefined;
}

function formatDate(value: string) {
  return value ? value.slice(0, 19).replace('T', ' ') : '-';
}

onMounted(() => {
  loadOptions();
  load();
});
</script>

<style scoped lang="scss">
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h2 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: 650;
  }
}

.sub,
.header-info,
.cell-sub {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.header-actions,
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.filters {
  margin-bottom: 12px;

  :deep(.el-form-item) {
    margin-right: 0;
    margin-bottom: 8px;
  }

  :deep(.el-input),
  :deep(.el-select) {
    width: 180px;
  }
}

.main-cell {
  font-weight: 600;
}

.pagination {
  margin-top: 12px;
  justify-content: flex-end;
}

.import-tip {
  margin-bottom: 12px;
}
</style>
