<template>
  <div class="articles-page">
    <div class="page-header">
      <h2>干货文库</h2>
      <el-button type="primary" @click="openDialog()">新建文章</el-button>
    </div>
    <el-table :data="articles" style="width: 100%" v-loading="loading">
      <el-table-column prop="title" label="标题" min-width="200" />
      <el-table-column prop="category" label="分类" width="100" />
      <el-table-column prop="viewCount" label="阅读量" width="80" />
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }"><el-tag size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑文章' : '新建文章'" width="600px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category">
            <el-option label="高考志愿" value="gaokao" />
            <el-option label="考研规划" value="kaoyan" />
            <el-option label="职业发展" value="zhiye" />
            <el-option label="专业避坑" value="bimian" />
          </el-select>
        </el-form-item>
        <el-form-item label="封面URL"><el-input v-model="form.cover" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="8" /></el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="published">发布</el-radio>
            <el-radio value="draft">草稿</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { api } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const articles = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editingId = ref('');
const form = reactive({ title: '', category: 'gaokao', cover: '', content: '', status: 'published' });

async function load() {
  loading.value = true;
  try {
    const res = await api.articles.list() as any;
    articles.value = res.data.list;
  } finally { loading.value = false; }
}

function openDialog(row?: any) {
  if (row) {
    editingId.value = row.id;
    Object.assign(form, row);
  } else {
    editingId.value = '';
    Object.assign(form, { title: '', category: 'gaokao', cover: '', content: '', status: 'published' });
  }
  dialogVisible.value = true;
}

async function save() {
  try {
    if (editingId.value) {
      await api.articles.update(editingId.value, form);
    } else {
      await api.articles.create(form);
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } catch (e: any) { ElMessage.error(e.message); }
}

async function remove(id: string) {
  await ElMessageBox.confirm('确定删除该文章？', '提示', { type: 'warning' });
  await api.articles.delete(id);
  ElMessage.success('删除成功');
  load();
}

onMounted(load);
</script>

<style lang="scss" scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
h2 { color: #e8eaf0; margin: 0; }
</style>
