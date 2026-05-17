<template>
  <div class="ar-page">
    <div class="page-header">
      <h2>自动回复规则</h2>
      <el-button type="primary" @click="openDialog()">添加规则</el-button>
    </div>
    <el-table :data="rules" style="width: 100%">
      <el-table-column prop="keyword" label="关键词" width="150" />
      <el-table-column prop="matchMode" label="匹配模式" width="100">
        <template #default="{ row }">
          <el-tag :type="row.matchMode === 'exact' ? '' : 'success'" size="small">
            {{ row.matchMode === 'exact' ? '精确' : '模糊' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="replyType" label="回复类型" width="100">
        <template #default="{ row }">
          {{ replyTypeLabel(row.replyType) }}
        </template>
      </el-table-column>
      <el-table-column prop="replyContent" label="回复内容" min-width="250" show-overflow-tooltip />
      <el-table-column prop="sortOrder" label="排序" width="70" />
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status === 'enabled'"
            @change="(val: boolean) => toggleStatus(row.id, val)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" title="编辑自动回复规则" width="600px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="关键词">
          <el-input v-model="form.keyword" placeholder="用户消息匹配的关键词" />
        </el-form-item>
        <el-form-item label="匹配模式">
          <el-radio-group v-model="form.matchMode">
            <el-radio value="exact">精确匹配</el-radio>
            <el-radio value="contains">模糊匹配（包含）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="回复类型">
          <el-select v-model="form.replyType">
            <el-option label="文本" value="text" />
            <el-option label="图片" value="image" />
            <el-option label="图文" value="news" />
          </el-select>
        </el-form-item>
        <el-form-item label="回复内容">
          <el-input v-model="form.replyContent" type="textarea" :rows="5" placeholder="文本消息内容或 media_id" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" />
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

const rules = ref([]);
const dialogVisible = ref(false);
const editingId = ref('');
const form = reactive({
  keyword: '',
  matchMode: 'exact',
  replyType: 'text',
  replyContent: '',
  sortOrder: 0,
});

function replyTypeLabel(t: string) {
  const map: Record<string, string> = { text: '文本', image: '图片', news: '图文' };
  return map[t] || t;
}

async function load() {
  const res = await api.autoReply.list() as any;
  rules.value = res.data;
}

function openDialog(row?: any) {
  if (row) {
    editingId.value = row.id;
    Object.assign(form, {
      keyword: row.keyword,
      matchMode: row.matchMode,
      replyType: row.replyType,
      replyContent: row.replyContent,
      sortOrder: row.sortOrder,
    });
  } else {
    editingId.value = '';
    Object.assign(form, { keyword: '', matchMode: 'exact', replyType: 'text', replyContent: '', sortOrder: 0 });
  }
  dialogVisible.value = true;
}

async function save() {
  try {
    if (editingId.value) await api.autoReply.update(editingId.value, form);
    else await api.autoReply.create(form);
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } catch (e: any) { ElMessage.error(e.message); }
}

async function toggleStatus(id: string, enabled: boolean) {
  try {
    await api.autoReply.update(id, { status: enabled ? 'enabled' : 'disabled' });
    ElMessage.success(enabled ? '已启用' : '已禁用');
  } catch (e: any) { ElMessage.error(e.message); }
}

async function remove(id: string) {
  await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' });
  await api.autoReply.delete(id);
  ElMessage.success('删除成功');
  load();
}

onMounted(load);
</script>

<style lang="scss" scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
h2 { margin: 0; }
</style>
