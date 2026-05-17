<template>
  <div class="scores-page">
    <div class="page-header">
      <div>
        <h2>录取分数线</h2>
        <span class="sub">按省份、年份、科类管理院校线、专业组线和专业线</span>
      </div>
      <div class="header-actions">
        <el-button @click="openImport">批量导入</el-button>
        <el-button type="primary" @click="openDialog()">新增分数线</el-button>
        <span class="header-info">共 {{ total }} 条</span>
      </div>
    </div>

    <el-card class="auto-fill-card" shadow="never">
      <div class="auto-fill-main">
        <div>
          <div class="auto-fill-title">
            自动补全 gaokao.cn 录取线
            <el-tag :type="autoFillStatus?.running ? 'success' : 'info'" size="small">
              {{ autoFillStatus?.running ? '运行中' : '未运行' }}
            </el-tag>
            <el-tag v-if="autoFillStatus?.running && !autoFillStatus?.managed" type="warning" size="small">外部进程</el-tag>
          </div>
          <div class="auto-fill-sub">
            本科院校覆盖 {{ autoFillStatus?.stats?.undergraduateCovered || 0 }} / {{ autoFillStatus?.stats?.undergraduate || autoFillOptions.targetApiCoverage }} 所，
            全部院校/名称去重 {{ autoFillStatus?.stats?.covered || 0 }} 所，
            gaokao.cn API 已覆盖 {{ autoFillStatus?.stats?.apiCovered || 0 }} 所，
            结构化 API 数据 {{ autoFillStatus?.stats?.api || 0 }} 条，总数据 {{ autoFillStatus?.stats?.total || 0 }} 条，
            异常数据 {{ autoFillStatus?.stats?.bad || 0 }} 条
          </div>
          <div v-if="autoFillStatus?.state?.batch?.length" class="auto-fill-sub">
            当前批次：{{ autoFillStatus.state.batch.map((item: any) => item.name).slice(0, 6).join('、') }}
            <span v-if="autoFillStatus.state.batch.length > 6">等 {{ autoFillStatus.state.batch.length }} 所</span>
            <span v-if="autoFillStatus.state.updatedAt">，更新时间 {{ formatTime(autoFillStatus.state.updatedAt) }}</span>
          </div>
        </div>
        <div class="auto-fill-actions">
          <label class="auto-fill-field">
            年份
            <el-input-number v-model="autoFillOptions.year" :min="2020" :max="2026" controls-position="right" />
          </label>
          <label class="auto-fill-field">
            目标院校
            <el-input-number v-model="autoFillOptions.targetApiCoverage" :min="1" :max="3000" controls-position="right" />
          </label>
          <label class="auto-fill-field">
            批量
            <el-input-number v-model="autoFillOptions.batchSize" :min="5" :max="200" controls-position="right" />
          </label>
          <label class="auto-fill-field">
            并发
            <el-input-number v-model="autoFillOptions.concurrency" :min="1" :max="8" controls-position="right" />
          </label>
          <label class="auto-fill-field">
            间隔ms
            <el-input-number v-model="autoFillOptions.requestDelayMs" :min="200" :max="10000" :step="100" controls-position="right" />
          </label>
          <el-checkbox v-model="autoFillOptions.refreshExisting">刷新已有</el-checkbox>
          <el-button :loading="autoFillLoading" @click="refreshAutoFill">刷新状态</el-button>
          <el-button type="primary" :loading="autoFillLoading" :disabled="autoFillStatus?.running" @click="startAutoFill">启动补全</el-button>
          <el-button type="danger" plain :loading="autoFillLoading" :disabled="!autoFillStatus?.running" @click="stopAutoFill">停止</el-button>
        </div>
      </div>
      <el-collapse v-if="autoFillStatus?.logTail" class="auto-fill-log">
        <el-collapse-item title="最近运行日志" name="log">
          <pre>{{ autoFillStatus.logTail }}</pre>
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <el-form class="filters" inline @submit.prevent>
      <el-form-item label="院校">
        <el-input v-model="filters.universityName" placeholder="如 北京大学" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="省份">
        <el-input v-model="filters.province" placeholder="考生省份" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="科类">
        <el-input v-model="filters.subjectType" placeholder="物理类 / 综合改革" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="年份">
        <el-input v-model="filters.year" placeholder="2023" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="线类型">
        <el-select v-model="filters.lineType" placeholder="全部类型" clearable @change="search">
          <el-option label="院校线" value="university" />
          <el-option label="专业组线" value="major_group" />
          <el-option label="专业线" value="major" />
          <el-option label="批次线" value="batch_control" />
        </el-select>
      </el-form-item>
      <el-form-item label="专业">
        <el-input v-model="filters.majorName" placeholder="仅专业线使用" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="来源">
        <el-select v-model="filters.sourceType" placeholder="全部来源" clearable @change="search">
          <el-option label="gaokao.cn 接口（按学校）" value="gaokao_cn_api_by_school" />
          <el-option label="gaokao.cn 接口（旧）" value="gaokao_cn_api" />
          <el-option label="gaokao.cn 静态数据" value="gaokao_static_schoolprovince" />
          <el-option label="旧静态导入" value="legacy_static" />
          <el-option label="高考100摘录" value="gk100_snippet" />
          <el-option label="德立信 2025 PDF" value="dlx_2025_admission_pdf" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">搜索</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="scores" v-loading="loading" height="calc(100vh - 420px)">
      <el-table-column label="年份/省份/科类" width="180">
        <template #default="{ row }">
          <div class="main-cell">{{ row.year }} · {{ row.province }}</div>
          <div class="cell-sub">{{ row.subjectType }} / {{ row.batch || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="院校" min-width="190" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="main-cell">{{ row.universityName }}</div>
          <div class="cell-sub">
            {{ row.university?.is985 ? '985 ' : '' }}{{ row.university?.is211 ? '211 ' : '' }}{{ row.university?.isDoubleFirst ? '双一流' : '' }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="线类型" width="120">
        <template #default="{ row }">
          <el-tag :type="lineTypeTag(row.lineType)" size="small">{{ lineTypeLabel(row.lineType) }}</el-tag>
          <div v-if="row.isPartial" class="cell-sub">非完整源</div>
        </template>
      </el-table-column>
      <el-table-column label="专业组/专业" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="main-cell">{{ scoreScope(row) }}</div>
          <div class="cell-sub">{{ row.subjectRequirement || row.groupCode || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="minScore" label="最低分" width="90" sortable />
      <el-table-column prop="minRank" label="最低位次" width="120" sortable />
      <el-table-column prop="avgScore" label="平均分" width="90" />
      <el-table-column prop="planCount" label="计划数" width="90" />
      <el-table-column label="数据来源" width="150">
        <template #default="{ row }">
          <div>{{ row.sourceName || '-' }}</div>
          <div class="cell-sub">{{ row.dataQuality || row.sourceType || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑录取分数线' : '新增录取分数线'" width="720px">
      <el-form :model="form" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="年份"><el-input-number v-model="form.year" :min="2000" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="省份"><el-input v-model="form.province" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="科类"><el-input v-model="form.subjectType" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="院校"><el-input v-model="form.universityName" /></el-form-item></el-col>
          <el-col :span="12">
            <el-form-item label="线类型">
              <el-select v-model="form.lineType" style="width:100%">
                <el-option label="院校线" value="university" />
                <el-option label="专业组线" value="major_group" />
                <el-option label="专业线" value="major" />
                <el-option label="批次线" value="batch_control" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="专业组号"><el-input v-model="form.groupCode" placeholder="如 （02）" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="专业组"><el-input v-model="form.groupName" placeholder="专业组（02）" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="选科要求"><el-input v-model="form.subjectRequirement" placeholder="不限 / 物理+化学" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="专业名称"><el-input v-model="form.majorName" placeholder="仅专业线填写" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="来源"><el-input v-model="form.sourceName" placeholder="如 gaokao.cn" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="批次"><el-input v-model="form.batch" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="最低分"><el-input-number v-model="form.minScore" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="最低位次"><el-input-number v-model="form.minRank" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="平均分"><el-input-number v-model="form.avgScore" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="计划数"><el-input-number v-model="form.planCount" style="width:100%" /></el-form-item></el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importVisible" title="批量导入录取分数线" width="760px">
      <el-alert type="info" :closable="false" show-icon class="import-tip" title="至少包含院校、省份、年份、科类和最低分。每次最多 5000 条。" />
      <el-input v-model="importText" type="textarea" :rows="16" />
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" @click="submitImport">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { api } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const filters = reactive({ universityName: '', majorName: '', province: '', subjectType: '', year: '', lineType: '', sourceType: '' });
const scores = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);
const autoFillStatus = ref<any>(null);
const autoFillLoading = ref(false);
const autoFillOptions = reactive({
  year: 2025,
  targetApiCoverage: 1450,
  batchSize: 80,
  maxRounds: 200,
  cooldownMs: 10000,
  requestDelayMs: 800,
  requestTimeout: 15000,
  retries: 4,
  retryDelayMs: 2000,
  rateLimitCooldownMs: 90000,
  dedupeIntervalRounds: 0,
  concurrency: 4,
  refreshExisting: false,
});
let autoFillTimer: number | undefined;

const dialogVisible = ref(false);
const form = reactive<any>({});
const importVisible = ref(false);
const importText = ref('[{"universityName":"山东大学","province":"山东","year":2025,"subjectType":"综合改革","batch":"本科批","lineType":"major_group","groupCode":"（01）","groupName":"专业组（01）","subjectRequirement":"不限","minScore":628,"minRank":8800,"avgScore":635,"planCount":120,"sourceName":"gaokao.cn","sourceType":"gaokao_cn_api"}]');

async function load() {
  loading.value = true;
  try {
    const res: any = await api.admissionScores.list({ ...filters, page: page.value, pageSize });
    scores.value = res.data.list;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

async function refreshAutoFill() {
  autoFillLoading.value = true;
  try {
    const res: any = await api.admissionScores.autoFillStatus();
    autoFillStatus.value = res.data;
  } finally {
    autoFillLoading.value = false;
  }
}

async function startAutoFill() {
  autoFillLoading.value = true;
  try {
    const res: any = await api.admissionScores.startAutoFill(autoFillOptions);
    autoFillStatus.value = res.data.status;
    ElMessage.success(res.data.started ? '自动补全已启动' : '自动补全已经在运行');
  } finally {
    autoFillLoading.value = false;
  }
}

async function stopAutoFill() {
  try {
    await ElMessageBox.confirm('确定停止录取线自动补全任务？当前批次会中断。', '停止任务', { type: 'warning' });
  } catch { return; }

  autoFillLoading.value = true;
  try {
    const res: any = await api.admissionScores.stopAutoFill();
    autoFillStatus.value = res.data.status;
    ElMessage.success(`已发送停止信号：${res.data.stopped} 个进程`);
  } finally {
    autoFillLoading.value = false;
  }
}

function search() {
  page.value = 1;
  load();
}

function reset() {
  Object.assign(filters, { universityName: '', majorName: '', province: '', subjectType: '', year: '', lineType: '', sourceType: '' });
  search();
}

function openDialog(row?: any) {
  Object.keys(form).forEach(key => delete form[key]);
  Object.assign(form, row || {
    year: new Date().getFullYear(),
    province: '',
    subjectType: '',
    batch: '本科批',
    universityName: '',
    lineType: 'major_group',
    groupCode: '',
    groupName: '',
    subjectRequirement: '',
    majorName: '',
    minScore: undefined,
    minRank: undefined,
    avgScore: undefined,
    planCount: undefined,
    sourceName: '',
    sourceType: '',
  });
  dialogVisible.value = true;
}

function lineTypeLabel(value: string) {
  return ({ university: '院校线', major_group: '专业组线', major: '专业线', batch_control: '批次线' } as Record<string, string>)[value] || '未标记';
}

function lineTypeTag(value: string) {
  return ({ university: 'success', major_group: 'warning', major: 'primary', batch_control: 'info' } as Record<string, string>)[value] || 'info';
}

function scoreScope(row: any) {
  if (row.lineType === 'major') return row.majorName || '-';
  if (row.lineType === 'major_group') return row.groupName || row.groupCode || '-';
  if (row.lineType === 'batch_control') return row.batch || '批次线';
  return '院校最低线';
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

async function save() {
  if (!form.universityName || !form.province || !form.year || !form.subjectType) {
    ElMessage.warning('院校、省份、年份、科类必填');
    return;
  }
  if (form.id) await api.admissionScores.update(form.id, form);
  else await api.admissionScores.create(form);
  ElMessage.success('保存成功');
  dialogVisible.value = false;
  load();
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.universityName}」这条录取分数线？`, '确认删除', { type: 'warning' });
  } catch { return; }
  await api.admissionScores.delete(row.id);
  ElMessage.success('已删除');
  load();
}

function openImport() {
  importVisible.value = true;
}

async function submitImport() {
  let items: any[];
  try {
    items = JSON.parse(importText.value);
  } catch {
    ElMessage.error('JSON 格式错误');
    return;
  }
  if (!Array.isArray(items)) {
    ElMessage.error('请粘贴 JSON 数组');
    return;
  }
  const res: any = await api.admissionScores.import(items);
  ElMessage.success(`导入成功：${res.data.count} 条`);
  importVisible.value = false;
  load();
}

onMounted(() => {
  load();
  refreshAutoFill();
  autoFillTimer = window.setInterval(refreshAutoFill, 30000);
});

onUnmounted(() => {
  if (autoFillTimer) window.clearInterval(autoFillTimer);
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

.auto-fill-card {
  margin-bottom: 14px;
  border-radius: 8px;
}

.auto-fill-main {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.auto-fill-title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
  font-weight: 650;
}

.auto-fill-sub {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.auto-fill-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 680px;
}

.auto-fill-field {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--el-text-color-secondary);
  font-size: 12px;

  :deep(.el-input-number) {
    width: 112px;
  }
}

.auto-fill-log {
  margin-top: 8px;

  pre {
    max-height: 260px;
    margin: 0;
    padding: 10px;
    overflow: auto;
    border-radius: 6px;
    background: #0f172a;
    color: #e5e7eb;
    font-size: 12px;
    line-height: 1.6;
  }
}

.filters {
  margin-bottom: 12px;

  :deep(.el-form-item) {
    margin-right: 0;
    margin-bottom: 8px;
  }

  :deep(.el-input) {
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
