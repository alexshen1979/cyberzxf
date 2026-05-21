<template>
  <div class="admins-page">
    <div class="page-header">
      <h2>管理员账号</h2>
      <el-button type="primary" @click="openDialog()">新增账号</el-button>
    </div>

    <el-table :data="admins" v-loading="loading" style="width: 100%">
      <el-table-column prop="username" label="账号" min-width="180" />
      <el-table-column label="角色" width="120">
        <template #default="{ row }">
          <el-tag :type="row.role === 'editor' ? 'info' : 'success'" size="small">{{ roleLabel(row.role) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最近登录" width="180">
        <template #default="{ row }">{{ formatTime(row.lastLogin) }}</template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="190" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="openDialog(row)">编辑</el-button>
          <el-button type="danger" link @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑账号' : '新增账号'" width="520px" destroy-on-close>
      <el-form :model="form" label-width="90px">
        <el-form-item label="账号" required>
          <el-input v-model="form.username" :disabled="!!form.id" placeholder="3-32 位字母、数字、下划线或短横线" />
        </el-form-item>
        <el-form-item :label="form.id ? '新密码' : '密码'" :required="!form.id">
          <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位；编辑时留空表示不修改" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-radio-group v-model="form.role">
            <el-radio-button label="admin">管理员</el-radio-button>
            <el-radio-button label="editor">编辑</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
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
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '@/api';

const admins = ref<any[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const saving = ref(false);
const form = reactive({
  id: '',
  username: '',
  password: '',
  role: 'editor',
  status: 1,
});

async function load() {
  loading.value = true;
  try {
    const res: any = await api.admin.list();
    admins.value = res.data || [];
  } finally {
    loading.value = false;
  }
}

function openDialog(row?: any) {
  Object.assign(form, row ? {
    id: row.id,
    username: row.username,
    password: '',
    role: row.role === 'editor' ? 'editor' : 'admin',
    status: row.status ?? 1,
  } : {
    id: '',
    username: '',
    password: '',
    role: 'editor',
    status: 1,
  });
  dialogVisible.value = true;
}

async function save() {
  if (!form.id && !form.password) {
    ElMessage.warning('请填写密码');
    return;
  }
  saving.value = true;
  try {
    const payload: any = {
      role: form.role,
      status: form.status,
    };
    if (form.password) payload.password = form.password;
    if (form.id) {
      await api.admin.update(form.id, payload);
    } else {
      await api.admin.create({
        username: form.username.trim(),
        password: form.password,
        role: form.role,
      });
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    await load();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function remove(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除账号「${row.username}」吗？`, '删除管理员账号', { type: 'warning' });
    await api.admin.delete(row.id);
    ElMessage.success('已删除');
    await load();
  } catch (e: any) {
    if (e === 'cancel' || e === 'close') return;
    ElMessage.error(e.response?.data?.message || e.message || '删除失败');
  }
}

function roleLabel(role: string) {
  if (role === 'editor') return '编辑';
  return '管理员';
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString() : '--';
}

onMounted(load);
</script>

<style lang="scss" scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

h2 {
  margin: 0;
}
</style>
