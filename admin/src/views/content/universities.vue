<template>
  <div class="uni-page">
    <div class="page-header">
      <h2>院校库</h2>
      <div class="header-actions">
        <el-button type="primary" @click="openDialog()">添加院校</el-button>
        <span class="header-info">共 {{ total }} 所高校</span>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-input v-model="filters.name" placeholder="学校名称" clearable style="width: 160px" @keyup.enter="search" />
      <el-input v-model="filters.code" placeholder="院校代码" clearable style="width: 110px" @keyup.enter="search" />
      <el-select v-model="filters.province" placeholder="省份" clearable style="width: 110px" @change="onProvinceChange">
        <el-option v-for="p in regionTree" :key="p.id" :label="p.name" :value="p.name" />
      </el-select>
      <el-select v-model="filters.city" placeholder="城市" clearable style="width: 110px" @change="search">
        <el-option v-for="c in cityOptions" :key="c" :label="c" :value="c" />
      </el-select>
      <el-select v-model="filters.type" placeholder="类型" clearable style="width: 100px" @change="search">
        <el-option v-for="t in filterOptions.types" :key="t" :label="t" :value="t" />
      </el-select>
      <el-select v-model="filters.level" placeholder="层次" clearable style="width: 110px" @change="search">
        <el-option v-for="l in filterOptions.levels" :key="l" :label="l" :value="l" />
      </el-select>
      <el-select v-model="filters.properties" placeholder="属性" clearable style="width: 120px" @change="search">
        <el-option v-for="p in filterOptions.properties" :key="p" :label="p" :value="p" />
      </el-select>
      <el-checkbox v-model="filters.is985" @change="search">985</el-checkbox>
      <el-checkbox v-model="filters.is211" @change="search">211</el-checkbox>
      <el-checkbox v-model="filters.isDoubleFirst" @change="search">双一流</el-checkbox>
      <el-button type="primary" @click="search">搜索</el-button>
      <el-button @click="reset">重置</el-button>
    </div>

    <el-table :data="universities" style="width: 100%" v-loading="loading" max-height="calc(100vh - 320px)" row-key="id">
      <el-table-column label="学校名称" min-width="260" fixed show-overflow-tooltip>
        <template #default="{ row }">
          <div class="cell-name">
            <div class="cell-name-row">
              <img v-if="row.logo" :src="row.logo" class="cell-logo" />
              <span class="cell-name-text">{{ row.name }}</span>
            </div>
            <div class="cell-meta">
              <span v-if="row.code" class="cell-code">{{ row.code }}</span>
              <a v-if="row.website" :href="row.website" target="_blank" class="cell-website" @click.stop>{{ row.website }}</a>
              <span class="cell-tags">
                <el-tag v-if="row.is985" type="danger" size="small" effect="dark">985</el-tag>
                <el-tag v-if="row.is211" type="warning" size="small" effect="dark">211</el-tag>
                <el-tag v-if="row.isDoubleFirst" type="success" size="small" effect="dark">双一流</el-tag>
                <el-tag v-for="tag in row.featureTags || []" :key="tag" size="small">{{ tag }}</el-tag>
              </span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="省份 / 城市 / 地址" min-width="170">
        <template #default="{ row }">
          <div class="cell-stack">
            <div>{{ row.province }} {{ row.city }}</div>
            <div v-if="row.address" class="text-muted small">{{ row.address }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="类型 / 层次 / 属性" min-width="130">
        <template #default="{ row }">
          <div class="cell-stack">
            <div>{{ row.type || '—' }}</div>
            <div class="text-muted">{{ row.level || '' }}</div>
            <div class="text-muted">{{ row.properties || '' }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="190" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openMajorsDrawer(row)">查看专业及历史录取线</el-button>
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap" v-if="total > pageSize">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="load"
      />
    </div>

    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑院校' : '添加院校'" width="700px" destroy-on-close>
      <el-form :model="form" label-width="80px" label-position="right">
        <el-row :gutter="16">
          <el-col :span="14">
            <el-form-item label="学校名称" required>
              <el-input v-model="form.name" placeholder="请输入学校名称" />
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="院校代码">
              <el-input v-model="form.code" placeholder="如 10001" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="16">
            <el-form-item label="省份城市">
              <el-cascader
                v-model="formRegionPath"
                :options="regionTree"
                :props="{ value: 'id', label: 'name', emitPath: true }"
                clearable
                filterable
                style="width:100%"
                placeholder="请选择省份/城市"
                @change="onFormRegionChange"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="类型">
              <el-select v-model="form.type" placeholder="类型" clearable style="width:100%">
                <el-option v-for="t in filterOptions.types" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="层次">
              <el-select v-model="form.level" placeholder="层次" clearable style="width:100%">
                <el-option v-for="l in filterOptions.levels" :key="l" :label="l" :value="l" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="属性">
              <el-select v-model="form.properties" placeholder="属性" clearable style="width:100%">
                <el-option v-for="p in filterOptions.properties" :key="p" :label="p" :value="p" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="标签">
              <el-checkbox v-model="form.is985">985</el-checkbox>
              <el-checkbox v-model="form.is211">211</el-checkbox>
              <el-checkbox v-model="form.isDoubleFirst">双一流</el-checkbox>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="Logo URL">
          <el-input v-model="form.logo" placeholder="校徽图片链接" />
        </el-form-item>
        <el-form-item label="官网">
          <el-input v-model="form.website" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="form.address" placeholder="详细地址" />
        </el-form-item>
        <el-form-item label="特色标签">
          <el-input v-model="form.featureTagsText" placeholder="强基、101计划、C9 等，用逗号或空格分隔" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.introduction" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="学校简介，500字以内" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="majorsDrawerVisible" :title="`${currentUniversity?.name || ''} · 专业及历史录取线`" size="min(1520px, 92vw)">
      <div class="score-summary">
        <div v-for="year in [2025, 2024, 2023]" :key="year" class="summary-block">
          <div class="summary-year">{{ year }} 院校/专业组线</div>
          <div v-if="schoolScoreLines[year]?.length" class="summary-lines">
            <el-tag v-for="score in schoolScoreLines[year]" :key="score.id" type="info" effect="plain">
              {{ lineTypeLabel(score.lineType) }} · {{ score.province }} {{ score.subjectType }} {{ scoreScope(score) }} {{ formatScoreLine(score) }}
            </el-tag>
          </div>
          <div v-else class="text-muted">暂无结构化院校/专业组线</div>
        </div>
      </div>

      <div class="drawer-toolbar">
        <span class="section-title inline-title">开设专业</span>
        <el-input v-model="majorFilters.majorName" placeholder="搜索专业名称" clearable @keyup.enter="loadUniversityMajors" />
        <el-select v-model="majorFilters.status" placeholder="状态" clearable @change="loadUniversityMajors">
          <el-option label="启用" value="enabled" />
          <el-option label="禁用" value="disabled" />
        </el-select>
        <el-button type="primary" @click="loadUniversityMajors">搜索</el-button>
      </div>

      <el-table :data="universityMajors" v-loading="majorsLoading" height="calc(100vh - 285px)">
        <el-table-column label="专业" min-width="190" fixed show-overflow-tooltip>
          <template #default="{ row }">
            <div class="major-name">{{ row.majorName }}</div>
            <div class="text-muted small">{{ row.majorCode || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="degreeType" label="层次" width="110" />
        <el-table-column prop="duration" label="学制" width="80" />
        <el-table-column prop="subjectLimit" label="选科要求" min-width="130" show-overflow-tooltip />
        <el-table-column prop="strengthLevel" label="优势" width="140" show-overflow-tooltip />
        <el-table-column label="2025年录取线" width="160">
          <template #default="{ row }">
            <div class="score-cell">{{ formatScoreLine(row.scoreLines?.[2025]) }}</div>
            <div class="text-muted small">{{ formatScoreMeta(row.scoreLines?.[2025]) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="2024年录取线" width="160">
          <template #default="{ row }">
            <div class="score-cell">{{ formatScoreLine(row.scoreLines?.[2024]) }}</div>
            <div class="text-muted small">{{ formatScoreMeta(row.scoreLines?.[2024]) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="2023年录取线" width="160">
          <template #default="{ row }">
            <div class="score-cell">{{ formatScoreLine(row.scoreLines?.[2023]) }}</div>
            <div class="text-muted small">{{ formatScoreMeta(row.scoreLines?.[2023]) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="标签" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag v-for="tag in row.featureTags" :key="tag" size="small">{{ tag }}</el-tag>
            <span v-if="!row.featureTags?.length" class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small">
              {{ row.status === 'enabled' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap" v-if="majorTotal > majorPageSize">
        <el-pagination
          v-model:current-page="majorPage"
          :page-size="majorPageSize"
          :total="majorTotal"
          layout="total, prev, pager, next"
          @current-change="loadUniversityMajors"
        />
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { api } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const universities = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 50;
const total = ref(0);

const filters = reactive({
  name: '', code: '', province: '', city: '', type: '', level: '', properties: '',
  is985: false, is211: false, isDoubleFirst: false,
});

const filterOptions = reactive({
  provinces: [] as string[],
  types: [] as string[],
  levels: [] as string[],
  properties: [] as string[],
});

const allCities = ref<string[]>([]);
const cityOptions = ref<string[]>([]);
const regionTree = ref<any[]>([]);
const formRegionPath = ref<string[]>([]);

// 编辑对话框
const dialogVisible = ref(false);
const saving = ref(false);
const isEdit = ref(false);
const editingId = ref('');
const form = reactive({
  name: '', code: '', province: '', city: '', type: '', level: '', properties: '',
  is985: false, is211: false, isDoubleFirst: false,
  logo: '', website: '', address: '', introduction: '', featureTagsText: '',
});

const majorsDrawerVisible = ref(false);
const currentUniversity = ref<any>(null);
const universityMajors = ref<any[]>([]);
const universityScores = ref<any[]>([]);
const schoolScoreLines = ref<Record<number, any[]>>({});
const majorsLoading = ref(false);
const majorPage = ref(1);
const majorPageSize = 20;
const majorTotal = ref(0);
const majorFilters = reactive({ majorName: '', status: '' });

function resetForm() {
  Object.assign(form, {
    name: '', code: '', province: '', city: '', type: '', level: '', properties: '',
    is985: false, is211: false, isDoubleFirst: false,
    logo: '', website: '', address: '', introduction: '', featureTagsText: '',
  });
}

function openDialog(row?: any) {
  resetForm();
  if (row) {
    isEdit.value = true;
    editingId.value = row.id;
    Object.assign(form, {
      name: row.name || '',
      code: row.code || '',
      province: row.province || '',
      city: row.city || '',
      type: row.type || '',
      level: row.level || '',
      properties: row.properties || '',
      is985: row.is985,
      is211: row.is211,
      isDoubleFirst: row.isDoubleFirst,
      logo: row.logo || '',
      website: row.website || '',
      address: row.address || '',
      introduction: row.introduction || '',
      featureTagsText: normalizeFeatureTags(row.featureTags).join('、'),
    });
    formRegionPath.value = findRegionPath(row.province, row.city);
  } else {
    isEdit.value = false;
    editingId.value = '';
    formRegionPath.value = [];
  }
  dialogVisible.value = true;
}

function findRegionPath(province?: string, city?: string) {
  if (!province) return [];
  const provinceNode = regionTree.value.find(item => item.name === province);
  if (!provinceNode) return [];
  const cityNode = (provinceNode.children || []).find((item: any) => item.name === city);
  return cityNode ? [provinceNode.id, cityNode.id] : [provinceNode.id];
}

function onFormRegionChange(value: string[]) {
  const provinceNode = regionTree.value.find(item => item.id === value?.[0]);
  const cityNode = (provinceNode?.children || []).find((item: any) => item.id === value?.[1]);
  form.province = provinceNode?.name || '';
  form.city = cityNode?.name || '';
}

async function save() {
  if (!form.name) { ElMessage.warning('请输入学校名称'); return; }
  saving.value = true;
  try {
    const payload = { ...form, featureTags: normalizeFeatureTags(form.featureTagsText) };
    delete (payload as any).featureTagsText;
    if (isEdit.value) {
      await api.universities.update(editingId.value, payload);
      ElMessage.success('更新成功');
    } else {
      await api.universities.create(payload);
      ElMessage.success('添加成功');
    }
    dialogVisible.value = false;
    load();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败');
  } finally {
    saving.value = false;
  }
}

function normalizeFeatureTags(value: any) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (!value) return [];
  return String(value).split(/[,，、\s]+/).map(item => item.trim()).filter(Boolean);
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.name}」吗？此操作不可撤销。`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch { return; }
  try {
    await api.universities.delete(row.id);
    ElMessage.success('已删除');
    load();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '删除失败');
  }
}

async function openMajorsDrawer(row: any) {
  currentUniversity.value = row;
  majorsDrawerVisible.value = true;
  majorPage.value = 1;
  Object.assign(majorFilters, { majorName: '', status: '' });
  await loadUniversityMajors();
}

async function loadUniversityMajors() {
  if (!currentUniversity.value?.id) return;
  majorsLoading.value = true;
  try {
    const [majorRes, scoreRes]: any[] = await Promise.all([
      api.universityMajors.list({
        universityId: currentUniversity.value.id,
        majorName: majorFilters.majorName,
        status: majorFilters.status,
        page: majorPage.value,
        pageSize: majorPageSize,
      }),
      api.admissionScores.list({
        universityId: currentUniversity.value.id,
        universityName: currentUniversity.value.name,
        page: 1,
        pageSize: 500,
      }),
    ]);
    universityScores.value = scoreRes.data.list || [];
    schoolScoreLines.value = buildSchoolScoreLines();
    universityMajors.value = (majorRes.data.list || []).map((item: any) => ({
      ...item,
      scoreLines: buildScoreLines(item),
    }));
    majorTotal.value = majorRes.data.total;
  } finally {
    majorsLoading.value = false;
  }
}

function buildScoreLines(major: any) {
  const lines: Record<number, any> = {};
  for (const year of [2025, 2024, 2023]) {
    const exact = universityScores.value.find(score =>
      score.year === year &&
      score.lineType === 'major' &&
      score.majorName &&
      (score.majorName.includes(major.majorName) || major.majorName.includes(score.majorName))
    );
    if (exact) lines[year] = { ...exact, matchedMajor: true };
  }
  return lines;
}

function buildSchoolScoreLines() {
  const result: Record<number, any[]> = {};
  for (const year of [2025, 2024, 2023]) {
    result[year] = universityScores.value
      .filter(score => score.year === year && ['university', 'major_group'].includes(score.lineType))
      .sort((a, b) => {
        if (a.lineType !== b.lineType) return a.lineType === 'university' ? -1 : 1;
        if (a.minRank && b.minRank) return a.minRank - b.minRank;
        return (b.minScore || 0) - (a.minScore || 0);
      })
      .slice(0, 6);
  }
  return result;
}

function formatScoreLine(score: any) {
  if (!score) return '暂无';
  const parts = [];
  if (score.minScore !== null && score.minScore !== undefined) parts.push(`${score.minScore}分`);
  if (score.minRank) parts.push(`${score.minRank}位`);
  return parts.length ? parts.join(' / ') : '暂无';
}

function formatScoreMeta(score: any) {
  if (!score) return '';
  return `${lineTypeLabel(score.lineType)}${score.province ? ` · ${score.province}` : ''}${score.subjectType ? ` · ${score.subjectType}` : ''}`;
}

function lineTypeLabel(value: string) {
  return ({ university: '院校线', major_group: '专业组线', major: '专业线', batch_control: '批次线' } as Record<string, string>)[value] || '未标记';
}

function scoreScope(score: any) {
  if (!score) return '';
  if (score.lineType === 'major_group') return score.groupName || score.groupCode || '';
  if (score.lineType === 'major') return score.majorName || '';
  return '';
}

// ─── 筛选逻辑 ──────────────────────────────────────
function getFiltersParam() {
  const p: Record<string, string | undefined> = {};
  if (filters.name) p.name = filters.name;
  if (filters.code) p.code = filters.code;
  if (filters.province) p.province = filters.province;
  if (filters.city) p.city = filters.city;
  if (filters.type) p.type = filters.type;
  if (filters.level) p.level = filters.level;
  if (filters.properties) p.properties = filters.properties;
  if (filters.is985) p.is985 = 'true';
  if (filters.is211) p.is211 = 'true';
  if (filters.isDoubleFirst) p.isDoubleFirst = 'true';
  return p;
}

async function load() {
  loading.value = true;
  try {
    const res: any = await api.universities.list({ page: page.value, pageSize, ...getFiltersParam() });
    universities.value = res.data.list;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

function search() { page.value = 1; load(); }

function reset() {
  Object.assign(filters, {
    name: '', code: '', province: '', city: '', type: '', level: '', properties: '',
    is985: false, is211: false, isDoubleFirst: false,
  });
  cityOptions.value = allCities.value;
  page.value = 1;
  load();
}

async function onProvinceChange() {
  filters.city = '';
  const provinceNode = regionTree.value.find(item => item.name === filters.province);
  cityOptions.value = provinceNode ? (provinceNode.children || []).map((item: any) => item.name) : allCities.value;
  search();
}

async function loadFilterOptions() {
  try {
    const [filterRes, regionRes]: any[] = await Promise.all([
      fetch('/api/v1/university-filters').then(res => res.json()),
      api.regions.tree(),
    ]);
    regionTree.value = regionRes.data || [];
    allCities.value = regionTree.value.flatMap((province: any) => (province.children || []).map((city: any) => city.name));
    cityOptions.value = allCities.value;
    if (filterRes?.success) {
      filterOptions.provinces = filterRes.data.provinces;
      filterOptions.types = filterRes.data.types;
      filterOptions.levels = filterRes.data.levels;
      filterOptions.properties = filterRes.data.properties;
      if (!allCities.value.length) {
        allCities.value = filterRes.data.cities;
        cityOptions.value = filterRes.data.cities;
      }
    }
  } catch { /* ignore */ }
}

onMounted(() => { loadFilterOptions(); load(); });
</script>

<style lang="scss" scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.header-info { font-size: 13px; color: var(--el-text-color-secondary); }
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  .el-checkbox { height: 32px; line-height: 32px; }
}
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }
.text-muted { color: var(--el-text-color-placeholder); font-size: 12px; }
.small { font-size: 12px; }
.cell-name-row { display: flex; align-items: center; gap: 6px; }
.cell-logo { width: 24px; height: 24px; border-radius: 4px; object-fit: contain; flex-shrink: 0; }
.cell-name-text { font-weight: 500; }
.cell-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 4px; font-size: 12px; }
.cell-code { color: var(--el-text-color-secondary); }
.cell-website { color: var(--el-color-primary); text-decoration: none; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-website:hover { text-decoration: underline; }
.cell-tags { display: flex; gap: 3px; }
.cell-stack { line-height: 1.6; }
.drawer-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  margin-top: 14px;
  align-items: center;

  .el-input { width: 220px; }
  .el-select { width: 120px; }
}
.score-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.summary-block {
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  padding: 10px;
  min-height: 82px;
}
.summary-year { font-weight: 600; margin-bottom: 8px; }
.summary-lines { display: flex; flex-wrap: wrap; gap: 6px; }
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 12px 0 8px;
}
.inline-title {
  margin: 0 8px 0 0;
  white-space: nowrap;
}
.major-name { font-weight: 600; }
.score-cell { font-weight: 600; color: var(--el-text-color-primary); }
.el-tag { margin: 2px 4px 2px 0; }
</style>
