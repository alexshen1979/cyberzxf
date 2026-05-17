<template>
  <div class="majors-page">
    <div class="page-header">
      <div>
        <h2>专业库</h2>
        <span class="sub">维护专业本身，不区分院校</span>
      </div>
      <div class="header-actions">
        <el-button @click="openImport">批量导入</el-button>
        <el-button type="primary" @click="openDialog()">新增专业</el-button>
        <span class="header-info">共 {{ total }} 个专业</span>
      </div>
    </div>

    <el-form class="filters" inline @submit.prevent>
      <el-form-item label="关键词">
        <el-input v-model="filters.keyword" placeholder="专业 / 分类 / 标签" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="分类">
        <el-input v-model="filters.category" placeholder="如 工学 / 医学" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">搜索</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="majors" v-loading="loading" height="calc(100vh - 300px)">
      <el-table-column prop="name" label="专业名称" min-width="190" show-overflow-tooltip />
      <el-table-column prop="category" label="门类/大类" width="150" />
      <el-table-column prop="degreeType" label="层次" width="120" />
      <el-table-column prop="riskLevel" label="风险提示" width="120">
        <template #default="{ row }">{{ row.riskLevel || '-' }}</template>
      </el-table-column>
      <el-table-column prop="employment" label="就业说明" min-width="260" show-overflow-tooltip />
      <el-table-column label="标签" min-width="220">
        <template #default="{ row }">
          <el-tag v-for="tag in row.tags" :key="tag" size="small">{{ tag }}</el-tag>
          <span v-if="!row.tags?.length" class="muted">-</span>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑专业' : '新增专业'" width="720px">
      <el-form :model="form" label-width="96px">
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="专业名称"><el-input v-model="form.name" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="分类"><el-input v-model="form.category" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="层次"><el-input v-model="form.degreeType" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="就业说明"><el-input v-model="form.employment" /></el-form-item>
        <el-form-item label="风险等级"><el-input v-model="form.riskLevel" placeholder="低 / 中 / 高 / 慎选" /></el-form-item>
        <el-form-item label="适合人群"><el-input v-model="form.recommendedFor" /></el-form-item>
        <el-form-item label="规避人群"><el-input v-model="form.avoidFor" /></el-form-item>
        <el-form-item label="标签"><el-input v-model="tagsText" placeholder="逗号分隔" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importVisible" title="批量导入专业库" width="760px">
      <el-alert type="info" :closable="false" show-icon class="import-tip" title="导入专业本身，不填写院校名称。每次最多 2000 条。" />
      <el-input v-model="importText" type="textarea" :rows="16" />
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

const filters = reactive({ keyword: '', category: '' });
const majors = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);

const dialogVisible = ref(false);
const form = reactive<any>({});
const tagsText = ref('');
const importVisible = ref(false);
const importText = ref('[{"name":"计算机科学与技术","category":"工学","degreeType":"本科","employment":"互联网、软件、人工智能、考公岗位均有覆盖","riskLevel":"中","tags":["热门","就业导向"]}]');

async function load() {
  loading.value = true;
  try {
    const res: any = await api.majors.list({ ...filters, page: page.value, pageSize });
    majors.value = res.data.list;
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
  Object.assign(filters, { keyword: '', category: '' });
  search();
}

function openDialog(row?: any) {
  Object.keys(form).forEach(key => delete form[key]);
  Object.assign(form, row || { name: '', category: '', degreeType: '本科', employment: '', riskLevel: '', recommendedFor: '', avoidFor: '', description: '' });
  tagsText.value = Array.isArray(row?.tags) ? row.tags.join(',') : '';
  dialogVisible.value = true;
}

async function save() {
  if (!form.name) {
    ElMessage.warning('专业名称必填');
    return;
  }
  const payload = { ...form, tags: splitTags(tagsText.value) };
  if (form.id) await api.majors.update(form.id, payload);
  else await api.majors.create(payload);
  ElMessage.success('保存成功');
  dialogVisible.value = false;
  load();
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.name}」吗？关联院校专业会保留名称但解除专业库引用。`, '确认删除', { type: 'warning' });
  } catch { return; }
  await api.majors.delete(row.id);
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
  const res: any = await api.majors.import(items);
  ElMessage.success(`导入成功：${res.data.count} 条`);
  importVisible.value = false;
  load();
}

function splitTags(text: string) {
  return text.split(/[,，、\s]+/).map(item => item.trim()).filter(Boolean);
}

onMounted(load);
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
.muted {
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

  :deep(.el-input) {
    width: 200px;
  }
}

.el-tag {
  margin: 2px 4px 2px 0;
}

.pagination {
  margin-top: 12px;
  justify-content: flex-end;
}

.import-tip {
  margin-bottom: 12px;
}
</style>
