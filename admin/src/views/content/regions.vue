<template>
  <div class="regions-page">
    <div class="page-header">
      <div>
        <h2>省市管理</h2>
        <p>维护小程序省市选择器与院校所在地的统一主数据。</p>
      </div>
      <div class="header-actions">
        <el-button @click="syncUniversities" :loading="syncing">从院校库同步</el-button>
        <el-button type="primary" @click="openDialog()">新增区域</el-button>
      </div>
    </div>

    <div class="filter-bar">
      <el-input v-model="filters.keyword" placeholder="搜索省份/城市" clearable @keyup.enter="load" />
      <el-select v-model="filters.level" placeholder="层级" clearable @change="load">
        <el-option label="省份" value="province" />
        <el-option label="城市" value="city" />
        <el-option label="区县" value="district" />
      </el-select>
      <el-select v-model="filters.status" placeholder="状态" clearable @change="load">
        <el-option label="启用" value="enabled" />
        <el-option label="禁用" value="disabled" />
      </el-select>
      <el-button type="primary" @click="load">搜索</el-button>
      <el-button @click="reset">重置</el-button>
    </div>

    <el-table :data="regions" v-loading="loading" row-key="id" default-expand-all>
      <el-table-column prop="name" label="名称" min-width="180" />
      <el-table-column label="层级" width="90">
        <template #default="{ row }">{{ levelLabel(row.level) }}</template>
      </el-table-column>
      <el-table-column label="上级" width="150">
        <template #default="{ row }">{{ row.parent?.name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="code" label="编码" width="140" />
      <el-table-column prop="sortOrder" label="排序" width="80" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small">
            {{ row.status === 'enabled' ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
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

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑区域' : '新增区域'" width="520px" destroy-on-close>
      <el-form :model="form" label-width="90px">
        <el-form-item label="层级" required>
          <el-radio-group v-model="form.level">
            <el-radio value="province">省份</el-radio>
            <el-radio value="city">城市</el-radio>
            <el-radio value="district">区县</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.level !== 'province'" label="上级区域" required>
          <el-cascader
            v-model="parentPath"
            :options="parentOptions"
            :props="{ value: 'id', label: 'name', checkStrictly: true, emitPath: true }"
            clearable
            style="width: 100%"
            placeholder="选择上级省份/城市"
          />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如 江苏 / 南京" />
        </el-form-item>
        <el-form-item label="编码">
          <el-input v-model="form.code" placeholder="可选，行政区划代码" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="enabled">启用</el-radio>
            <el-radio value="disabled">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const regions = ref<any[]>([]);
const tree = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 100;
const loading = ref(false);
const saving = ref(false);
const syncing = ref(false);
const dialogVisible = ref(false);
const editingId = ref('');
const parentPath = ref<string[]>([]);
const filters = reactive({ keyword: '', level: '', status: '' });
const form = reactive({
  name: '',
  code: '',
  level: 'province',
  sortOrder: 0,
  status: 'enabled',
});

const parentOptions = computed(() => {
  if (form.level === 'city') {
    return tree.value.map(({ children, ...province }) => province);
  }
  return tree.value;
});

function levelLabel(level: string) {
  return ({ province: '省份', city: '城市', district: '区县' } as Record<string, string>)[level] || level;
}

async function loadTree() {
  const res: any = await api.regions.tree();
  tree.value = res.data || [];
}

async function load() {
  loading.value = true;
  try {
    const res: any = await api.regions.list({ ...filters, page: page.value, pageSize });
    regions.value = res.data.list;
    total.value = res.data.total;
    await loadTree();
  } finally {
    loading.value = false;
  }
}

function reset() {
  Object.assign(filters, { keyword: '', level: '', status: '' });
  page.value = 1;
  load();
}

function openDialog(row?: any) {
  if (row) {
    editingId.value = row.id;
    Object.assign(form, {
      name: row.name || '',
      code: row.code || '',
      level: row.level || 'province',
      sortOrder: row.sortOrder || 0,
      status: row.status || 'enabled',
    });
    parentPath.value = row.parentId ? [row.parentId] : [];
  } else {
    editingId.value = '';
    Object.assign(form, { name: '', code: '', level: 'province', sortOrder: 0, status: 'enabled' });
    parentPath.value = [];
  }
  dialogVisible.value = true;
}

async function save() {
  if (!form.name.trim()) { ElMessage.warning('请输入名称'); return; }
  const parentId = form.level === 'province' ? null : parentPath.value[parentPath.value.length - 1];
  if (form.level !== 'province' && !parentId) { ElMessage.warning('请选择上级区域'); return; }
  saving.value = true;
  try {
    const data = { ...form, parentId };
    if (editingId.value) await api.regions.update(editingId.value, data);
    else await api.regions.create(data);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function remove(row: any) {
  await ElMessageBox.confirm(`确定删除「${row.name}」吗？`, '提示', { type: 'warning' });
  await api.regions.delete(row.id);
  ElMessage.success('已删除');
  load();
}

async function syncUniversities() {
  syncing.value = true;
  try {
    const res: any = await api.regions.syncUniversities();
    ElMessage.success(`已同步 ${res.data.linkedCount} 所院校`);
    load();
  } finally {
    syncing.value = false;
  }
}

onMounted(load);
</script>

<style lang="scss" scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;

  h2 { margin: 0 0 6px; }
  p { margin: 0; color: var(--el-text-color-secondary); font-size: 13px; }
}
.header-actions,
.filter-bar {
  display: flex;
  gap: 8px;
  align-items: center;
}
.filter-bar {
  margin-bottom: 16px;

  .el-input { width: 220px; }
  .el-select { width: 120px; }
}
.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
