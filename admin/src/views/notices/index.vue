<template>
  <div class="notices-page">
    <div class="page-header">
      <h2>系统公告</h2>
      <el-button type="primary" @click="openDialog()">新建公告</el-button>
    </div>
    <el-table :data="notices" style="width: 100%">
      <el-table-column prop="title" label="标题" min-width="200" />
      <el-table-column prop="type" label="类型" width="80" />
      <el-table-column prop="status" label="状态" width="80" />
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑公告' : '新建公告'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type">
            <el-option label="普通公告" value="notice" />
            <el-option label="弹窗公告" value="popup" />
            <el-option label="紧急提醒" value="alert" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="4" /></el-form-item>
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

const notices = ref([]);
const dialogVisible = ref(false);
const editingId = ref('');
const form = reactive({ title: '', type: 'notice', content: '' });

async function load() {
  const res = await api.notices.list() as any;
  notices.value = res.data;
}

function openDialog(row?: any) {
  if (row) { editingId.value = row.id; Object.assign(form, row); }
  else { editingId.value = ''; Object.assign(form, { title: '', type: 'notice', content: '' }); }
  dialogVisible.value = true;
}

async function save() {
  try {
    if (editingId.value) await api.notices.update(editingId.value, form);
    else await api.notices.create(form);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } catch (e: any) { ElMessage.error(e.message); }
}

async function remove(id: string) {
  await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' });
  await api.notices.delete(id);
  ElMessage.success('删除成功');
  load();
}

onMounted(load);
</script>

<style lang="scss" scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
h2 { color: #e8eaf0; margin: 0; }
</style>
