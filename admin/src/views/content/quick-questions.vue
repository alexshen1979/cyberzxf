<template>
  <div class="qq-page">
    <div class="page-header">
      <h2>快捷提问模板</h2>
      <el-button type="primary" @click="openDialog()">添加提问</el-button>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-input v-model="filters.keyword" placeholder="搜索问题" clearable style="width: 240px" @keyup.enter="load" />
      <el-select v-model="filters.category" placeholder="分类" clearable style="width: 140px" @change="load">
        <el-option label="通用" value="general" />
        <el-option v-for="c in categoryOptions" :key="c.key" :label="c.label" :value="c.key" />
      </el-select>
      <el-button type="primary" @click="load">搜索</el-button>
      <el-button @click="resetFilters">重置</el-button>
    </div>

    <el-table :data="questions" style="width: 100%">
      <el-table-column prop="question" label="问题内容" min-width="300" />
      <el-table-column label="分类" width="120">
        <template #default="{ row }">{{ categoryLabel(row.category) }}</template>
      </el-table-column>
      <el-table-column prop="sortOrder" label="排序" width="80" />
      <el-table-column label="启用" width="70" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.enabled" size="small" @change="toggleEnabled(row)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="编辑快捷提问" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="问题内容"><el-input v-model="form.question" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category">
            <el-option label="通用" value="general" />
            <el-option v-for="c in categoryOptions" :key="c.key" :label="c.label" :value="c.key" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sortOrder" :min="0" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const questions = ref([]);
const dialogVisible = ref(false);
const editingId = ref('');
const form = reactive({ question: '', category: 'general', sortOrder: 0, enabled: true });
const categoryOptions = ref<Array<{ key: string; label: string }>>([]);
const filters = reactive({ keyword: '', category: '' });

async function loadCategories() {
  try {
    const res: any = await api.categories.list();
    categoryOptions.value = res.data || [];
  } catch { /* keep empty */ }
}

// 分类 key → label 映射
const categoryMap = computed(() => {
  const map: Record<string, string> = { general: '通用' };
  for (const c of categoryOptions.value) map[c.key] = c.label;
  return map;
});

function categoryLabel(key: string) {
  return categoryMap.value[key] || key;
}

async function load() {
  const params: Record<string, string> = {};
  if (filters.keyword) params.keyword = filters.keyword;
  if (filters.category) params.category = filters.category;
  const res = await api.quickQuestions.list(params) as any;
  questions.value = res.data;
}

function resetFilters() {
  filters.keyword = '';
  filters.category = '';
  load();
}

function openDialog(row?: any) {
  if (row) { editingId.value = row.id; Object.assign(form, row); }
  else { editingId.value = ''; Object.assign(form, { question: '', category: 'general', sortOrder: 0, enabled: true }); }
  dialogVisible.value = true;
}

async function save() {
  try {
    if (editingId.value) await api.quickQuestions.update(editingId.value, form);
    else await api.quickQuestions.create(form);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } catch (e: any) { ElMessage.error(e.message); }
}

async function toggleEnabled(row: any) {
  try {
    await api.quickQuestions.update(row.id, { enabled: row.enabled });
    ElMessage.success(row.enabled ? '已启用' : '已禁用');
  } catch (e: any) {
    ElMessage.error('操作失败');
    row.enabled = !row.enabled; // revert
  }
}

async function remove(id: string) {
  await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' });
  await api.quickQuestions.delete(id);
  ElMessage.success('删除成功');
  load();
}

onMounted(() => {
  loadCategories();
  load();
});
</script>

<style lang="scss" scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
h2 { margin: 0; }
.filter-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
</style>
