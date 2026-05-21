<template>
  <div class="art-rules-page">
    <div class="page-header">
      <div>
        <h2>艺术类规则</h2>
        <span class="sub">维护各省艺术类综合分换算公式、权重和控制线</span>
      </div>
      <div class="header-actions">
        <el-button @click="openImport">批量导入</el-button>
        <el-button type="primary" @click="openDialog()">新增规则</el-button>
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
        <el-input v-model="filters.year" placeholder="2025" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="艺术类别">
        <el-select v-model="filters.artCategory" placeholder="全部类别" clearable filterable allow-create @change="search">
          <el-option v-for="item in artCategoryOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="批次">
        <el-input v-model="filters.batch" placeholder="本科" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="科类">
        <el-input v-model="filters.subjectType" placeholder="不限" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">搜索</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="rows" v-loading="loading" height="calc(100vh - 270px)">
      <el-table-column label="地区/类别" min-width="210">
        <template #default="{ row }">
          <div class="main-cell">{{ row.year }} · {{ row.province }}</div>
          <div class="cell-sub">{{ row.artCategory }} / {{ row.batch }} / {{ row.subjectType }}</div>
        </template>
      </el-table-column>
      <el-table-column label="公式" min-width="260">
        <template #default="{ row }">
          <div class="main-cell">{{ formulaLabel(row.formulaType) }}</div>
          <div class="cell-sub">文化 {{ percent(row.cultureWeight) }} · 专业 {{ percent(row.professionalWeight) }} · 折算 {{ row.scaleTo }}</div>
        </template>
      </el-table-column>
      <el-table-column label="满分" width="150">
        <template #default="{ row }">
          <div>文化 {{ row.cultureFullScore }}</div>
          <div class="cell-sub">专业 {{ row.professionalFullScore }}</div>
        </template>
      </el-table-column>
      <el-table-column label="控制线" width="150">
        <template #default="{ row }">
          <div>文化 {{ row.minCultureScore ?? '-' }}</div>
          <div class="cell-sub">专业 {{ row.minProfessionalScore ?? '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="来源" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <div>{{ row.sourceName || '-' }}</div>
          <div class="cell-sub">{{ row.sourceType || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="170">
        <template #default="{ row }">{{ formatDate(row.updatedAt || row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑艺术类规则' : '新增艺术类规则'" width="760px">
      <el-form :model="form" label-width="104px">
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="年份"><el-input-number v-model="form.year" :min="2000" :max="2100" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8">
            <el-form-item label="省份">
              <el-select v-model="form.province" filterable allow-create default-first-option style="width:100%">
                <el-option v-for="item in provinceOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="艺术类别">
              <el-select v-model="form.artCategory" filterable allow-create default-first-option style="width:100%">
                <el-option v-for="item in artCategoryOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="批次"><el-input v-model="form.batch" placeholder="本科" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="科类"><el-input v-model="form.subjectType" placeholder="不限" /></el-form-item></el-col>
          <el-col :span="8">
            <el-form-item label="公式类型">
              <el-select v-model="form.formulaType" filterable allow-create default-first-option style="width:100%">
                <el-option label="通用加权" value="weighted" />
                <el-option label="广东 2025" value="guangdong_2025" />
                <el-option label="江苏 2025" value="jiangsu_2025" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="文化满分"><el-input-number v-model="form.cultureFullScore" :min="1" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="专业满分"><el-input-number v-model="form.professionalFullScore" :min="1" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="折算满分"><el-input-number v-model="form.scaleTo" :min="1" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="文化权重"><el-input-number v-model="form.cultureWeight" :min="0" :max="1" :step="0.05" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="专业权重"><el-input-number v-model="form.professionalWeight" :min="0" :max="1" :step="0.05" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="权重预览"><span class="weight-preview">{{ percent(form.cultureWeight) }} / {{ percent(form.professionalWeight) }}</span></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="文化控制线"><el-input-number v-model="form.minCultureScore" :min="0" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="专业控制线"><el-input-number v-model="form.minProfessionalScore" :min="0" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="来源名称"><el-input v-model="form.sourceName" placeholder="省教育考试院" /></el-form-item>
        <el-form-item label="来源类型"><el-input v-model="form.sourceType" placeholder="official_art_rule" /></el-form-item>
        <el-form-item label="来源链接"><el-input v-model="form.sourceUrl" placeholder="https://..." /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.notes" type="textarea" :rows="3" placeholder="说明综合分公式、特殊规则或适用范围" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importVisible" title="批量导入艺术类规则" width="780px">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="import-tip"
        title="支持 JSON 数组或 CSV。规则会按省份、年份、艺术类别、批次、科类自动覆盖更新。"
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
import { parseImportText } from './import-utils';

const filters = reactive({ province: '', year: '', artCategory: '', batch: '', subjectType: '' });
const rows = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const dialogVisible = ref(false);
const importVisible = ref(false);
const form = reactive<any>({});
const importText = ref('省份,年份,艺术类别,批次,科类,公式类型,文化满分,专业满分,文化权重,专业权重,折算满分,文化控制线,专业控制线,来源名称,来源链接\n广东,2025,美术与设计类,本科,不限,guangdong_2025,750,300,0.5,0.5,750,,,广东省教育考试院,https://eea.gd.gov.cn/');

const fallbackProvinces = [
  '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
  '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南',
  '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州',
  '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆',
];
const provinceOptions = ref<string[]>(fallbackProvinces);
const artCategoryOptions = ['美术与设计类', '音乐类', '舞蹈类', '播音与主持类', '表（导）演类', '书法类', '戏曲类'];

async function load() {
  loading.value = true;
  try {
    const res: any = await api.artAdmissionRules.list({ ...filters, page: page.value, pageSize });
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
  Object.assign(filters, { province: '', year: '', artCategory: '', batch: '', subjectType: '' });
  search();
}

function openDialog(row?: any) {
  Object.keys(form).forEach(key => delete form[key]);
  Object.assign(form, row || {
    year: 2025,
    province: '',
    artCategory: '美术与设计类',
    batch: '本科',
    subjectType: '不限',
    formulaType: 'weighted',
    cultureFullScore: 750,
    professionalFullScore: 300,
    cultureWeight: 0.5,
    professionalWeight: 0.5,
    scaleTo: 750,
    minCultureScore: undefined,
    minProfessionalScore: undefined,
    sourceName: '',
    sourceUrl: '',
    sourceType: '',
    notes: '',
  });
  dialogVisible.value = true;
}

async function save() {
  if (!form.province || !form.year || !form.artCategory || !form.batch) {
    ElMessage.warning('省份、年份、艺术类别、批次必填');
    return;
  }
  if (form.cultureWeight === undefined || form.professionalWeight === undefined) {
    ElMessage.warning('文化权重和专业权重必填');
    return;
  }
  if (form.id) await api.artAdmissionRules.update(form.id, form);
  else await api.artAdmissionRules.create(form);
  ElMessage.success('保存成功');
  dialogVisible.value = false;
  load();
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除 ${row.year} ${row.province} ${row.artCategory} 的规则？`, '确认删除', { type: 'warning' });
  } catch { return; }
  await api.artAdmissionRules.delete(row.id);
  ElMessage.success('已删除');
  load();
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
  const res: any = await api.artAdmissionRules.import(items);
  ElMessage.success(`导入成功：${res.data.count} 条`);
  importVisible.value = false;
  load();
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

function formulaLabel(value: string) {
  return ({
    weighted: '通用加权',
    guangdong_2025: '广东 2025',
    jiangsu_2025: '江苏 2025',
  } as Record<string, string>)[value] || value || '通用加权';
}

function percent(value: number | string | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${Math.round(n * 100)}%`;
}

function openSource(row: any) {
  if (row.sourceUrl) window.open(row.sourceUrl, '_blank');
}

function formatDate(value: string) {
  return value ? value.slice(0, 19).replace('T', ' ') : '-';
}

onMounted(() => {
  loadProvinceOptions();
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

.weight-preview {
  color: var(--el-text-color-regular);
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
