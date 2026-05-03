<template>
  <div class="qq-page">
    <div class="page-header">
      <h2>快捷提问模板</h2>
      <el-button type="primary" @click="openDialog()">添加提问</el-button>
    </div>
    <el-table :data="questions" style="width: 100%">
      <el-table-column prop="question" label="问题内容" min-width="300" />
      <el-table-column prop="category" label="分类" width="100" />
      <el-table-column prop="sortOrder" label="排序" width="80" />
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
            <el-option label="高考" value="gaokao" />
            <el-option label="考研" value="kaoyan" />
            <el-option label="职业" value="zhiye" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sortOrder" :min="0" /></el-form-item>
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

const questions = ref([]);
const dialogVisible = ref(false);
const editingId = ref('');
const form = reactive({ question: '', category: 'general', sortOrder: 0 });

async function load() {
  const res = await api.quickQuestions.list() as any;
  questions.value = res.data;
}

function openDialog(row?: any) {
  if (row) { editingId.value = row.id; Object.assign(form, row); }
  else { editingId.value = ''; Object.assign(form, { question: '', category: 'general', sortOrder: 0 }); }
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

async function remove(id: string) {
  await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' });
  await api.quickQuestions.delete(id);
  ElMessage.success('删除成功');
  load();
}

onMounted(load);
</script>

<style lang="scss" scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
h2 { color: #e8eaf0; margin: 0; }
</style>
