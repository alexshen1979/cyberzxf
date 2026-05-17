<template>
  <div class="articles-page">
    <div class="page-header">
      <h2>干货文库</h2>
      <div class="header-actions">
        <el-button type="primary" @click="openDialog()">新建文章</el-button>
      </div>
    </div>
    <el-table :data="articles" style="width: 100%" v-loading="loading">
      <el-table-column prop="title" label="标题" min-width="200" />
      <el-table-column prop="category" label="分类" width="100">
        <template #default="{ row }">{{ categoryLabel(row.category) }}</template>
      </el-table-column>
      <el-table-column prop="viewCount" label="阅读量" width="80" />
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 'published' ? 'success' : 'info'" size="small">
            {{ row.status === 'published' ? '已发布' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="210" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="success" @click="exportArticle(row)">导出</el-button>
          <el-button link type="danger" @click="remove(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      v-if="total > pageSize"
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="total, prev, pager, next"
      style="margin-top: 20px; justify-content: center"
      @current-change="load"
    />

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑文章' : '新建文章'" width="1000px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" placeholder="文章标题" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="分类">
              <el-select v-model="form.category" style="width: 100%">
                <el-option v-for="c in categoryOptions" :key="c.key" :label="c.label" :value="c.key" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio value="published">发布</el-radio>
                <el-radio value="draft">草稿</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="封面URL">
          <el-input v-model="form.cover" placeholder="文章封面图片链接（可选）" />
        </el-form-item>
        <el-form-item label="内容" required>
          <MdEditor v-model="form.content" :theme="'light'" :toolbars="toolbars" style="height: 480px" />
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
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';

const articles = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editingId = ref('');
const page = ref(1);
const pageSize = 20;
const total = ref(0);

const categoryOptions = ref<Array<{ key: string; label: string }>>([]);

const form = reactive({
  title: '',
  category: '',
  cover: '',
  content: '',
  status: 'published' as string,
});

const toolbars: any[] = [
  'bold', 'italic', 'strikethrough', 'title', '|',
  'quote', 'unordered-list', 'ordered-list', 'code', '|',
  'link', 'image', 'table', '|',
  'preview', 'fullscreen',
];

function categoryLabel(cat: string) {
  const item = categoryOptions.value.find(c => c.key === cat);
  return item?.label || cat;
}

async function loadCategories() {
  try {
    const res: any = await api.categories.list();
    categoryOptions.value = res.data || [];
  } catch { /* keep empty */ }
}

async function load() {
  loading.value = true;
  try {
    const res = await api.articles.list({ page: page.value, pageSize }) as any;
    articles.value = res.data.list;
    total.value = res.data.total;
  } finally { loading.value = false; }
}

function openDialog(row?: any) {
  if (row) {
    editingId.value = row.id;
    Object.assign(form, {
      title: row.title,
      category: row.category,
      cover: row.cover || '',
      content: row.content || '',
      status: row.status,
    });
  } else {
    editingId.value = '';
    Object.assign(form, {
      title: '',
      category: categoryOptions.value[0]?.key || '',
      cover: '',
      content: '',
      status: 'published',
    });
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
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '保存失败');
  }
}

async function remove(id: string) {
  await ElMessageBox.confirm('确定删除该文章？', '提示', { type: 'warning' });
  await api.articles.delete(id);
  ElMessage.success('删除成功');
  load();
}

function exportArticle(row: any) {
  const blob = new Blob([row.content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${row.title.replace(/[/\\?%*:|"<>]/g, '_')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  ElMessage.success('导出成功');
}

onMounted(() => {
  loadCategories();
  load();
});
</script>

<style lang="scss" scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.header-actions { display: flex; gap: 12px; }
h2 { margin: 0; }
</style>
