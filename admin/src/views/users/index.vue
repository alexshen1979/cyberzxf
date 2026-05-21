<template>
  <div class="users-page">
    <h2>用户管理</h2>
    <div class="search-bar">
      <el-input v-model="keyword" placeholder="搜索昵称/手机号/OpenID/邀请码/用户ID" style="width: 360px" clearable @change="load" />
    </div>
    <el-table :data="users" style="width: 100%" v-loading="loading">
      <el-table-column label="用户" min-width="220">
        <template #default="{ row }">
          <div class="user-cell">
            <el-avatar :src="row.avatar || ''" :size="38">
              {{ avatarText(row) }}
            </el-avatar>
            <div class="main-cell">
              <strong>{{ userLabel(row) }}</strong>
              <span>{{ row.id }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" min-width="120">
        <template #default="{ row }">{{ row.phone || '--' }}</template>
      </el-table-column>
      <el-table-column prop="shareCode" label="邀请码" width="130">
        <template #default="{ row }">{{ row.shareCode || '--' }}</template>
      </el-table-column>
      <el-table-column label="邀请人" min-width="180">
        <template #default="{ row }">
          <div class="main-cell">
            <strong>{{ inviterLabel(row) }}</strong>
            <span v-if="row.shareReferralRecord?.sourceCode">邀请码：{{ row.shareReferralRecord.sourceCode }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="小程序绑定" width="100">
        <template #default="{ row }">
          <el-tag :type="row.miniOpenId ? 'success' : 'info'" size="small">{{ row.miniOpenId ? '已绑定' : '未绑定' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="公众号绑定" width="100">
        <template #default="{ row }">
          <el-tag :type="row.mpOpenId ? 'success' : 'info'" size="small">{{ row.mpOpenId ? '已绑定' : '未绑定' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="pointsAccount.balance" label="点数余额" width="100" />
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">{{ row.status === 1 ? '正常' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="注册时间" width="170">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="$router.push(`/users/${row.id}`)">详情</el-button>
          <el-button type="primary" link @click="openEditDialog(row)">编辑</el-button>
          <el-button type="danger" link :loading="purgingId === row.id" @click="purgeUser(row)">一键清除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" layout="prev, pager, next" @current-change="load" style="margin-top: 16px; justify-content: center" />

    <el-dialog v-model="editVisible" title="编辑用户" width="520px" destroy-on-close>
      <el-form :model="editForm" label-width="90px">
        <el-form-item label="用户">
          <div class="main-cell">
            <strong>{{ editUser ? userLabel(editUser) : '--' }}</strong>
            <span>{{ editUser?.id || '--' }}</span>
          </div>
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="editForm.nickname" placeholder="可留空" />
        </el-form-item>
        <el-form-item label="邀请码" required>
          <el-input v-model="editForm.shareCode" maxlength="32" placeholder="4-32 位字母、数字、下划线或短横线" />
          <span class="form-hint">保存后新分享使用这个邀请码，历史邀请记录保持原记录。</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editForm.status" style="width: 100%">
            <el-option label="正常" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingUser" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '@/api';

const users = ref([]);
const loading = ref(false);
const page = ref(1);
const total = ref(0);
const pageSize = 20;
const keyword = ref('');
const purgingId = ref('');
const editVisible = ref(false);
const savingUser = ref(false);
const editUser = ref<any>(null);
const editForm = reactive({
  nickname: '',
  shareCode: '',
  status: 1,
});

async function load() {
  loading.value = true;
  try {
    const res = await api.users.list({ page: page.value, pageSize, keyword: keyword.value }) as any;
    users.value = res.data.list;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

function userLabel(row: any) {
  return row.nickname || row.phone || row.shareCode || row.miniOpenId || row.id;
}

function inviterLabel(row: any) {
  const referrer = row.shareReferralRecord?.referrer;
  if (!referrer) return '系统';
  return referrer.nickname || referrer.phone || referrer.shareCode || referrer.id || '系统';
}

function avatarText(row: any) {
  return String(row.nickname || row.phone || row.shareCode || row.id || '用').slice(0, 1).toUpperCase();
}

function openEditDialog(row: any) {
  editUser.value = row;
  Object.assign(editForm, {
    nickname: row.nickname || '',
    shareCode: row.shareCode || '',
    status: row.status ?? 1,
  });
  editVisible.value = true;
}

async function saveUser() {
  if (!editUser.value?.id) return;
  const shareCode = editForm.shareCode.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{4,32}$/.test(shareCode)) {
    ElMessage.warning('邀请码只能包含字母、数字、下划线或短横线，长度 4-32 位');
    return;
  }

  savingUser.value = true;
  try {
    await api.users.update(editUser.value.id, {
      nickname: editForm.nickname.trim(),
      shareCode,
      status: editForm.status,
    });
    ElMessage.success('用户信息已保存');
    editVisible.value = false;
    await load();
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || err?.message || '保存失败');
  } finally {
    savingUser.value = false;
  }
}

async function purgeUser(row: any) {
  try {
    await ElMessageBox.prompt(
      `这会永久删除用户「${userLabel(row)}」以及点数、订单、咨询、收藏、报告、邀请、推荐合作、奖励等测试数据。请输入“清除”确认。`,
      '一键清除测试用户',
      {
        confirmButtonText: '确认清除',
        cancelButtonText: '取消',
        inputPattern: /^清除$/,
        inputErrorMessage: '请输入“清除”',
        type: 'warning',
      },
    );
    purgingId.value = row.id;
    const res = await api.users.purge(row.id) as any;
    const summary = res.data?.summary || {};
    const totalRemoved = Object.values(summary).reduce((sum: number, value: any) => sum + Number(value || 0), 0);
    ElMessage.success(`已清除 ${totalRemoved} 条相关记录`);
    await load();
  } catch (err: any) {
    if (err === 'cancel' || err === 'close') return;
    ElMessage.error(err?.response?.data?.message || err?.message || '清除失败');
  } finally {
    purgingId.value = '';
  }
}

onMounted(load);
</script>

<style lang="scss" scoped>
h2 { margin-bottom: 20px; }
.search-bar { margin-bottom: 16px; }
.form-hint {
  display: block;
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.4;
}
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.main-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}
</style>
