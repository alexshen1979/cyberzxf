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
      <el-table-column label="省份城市" min-width="130">
        <template #default="{ row }">{{ locationLabel(row) }}</template>
      </el-table-column>
      <el-table-column prop="shareCode" label="邀请码" width="130">
        <template #default="{ row }">{{ row.shareCode || '--' }}</template>
      </el-table-column>
      <el-table-column label="合作身份" width="150">
        <template #default="{ row }">
          <el-tag v-if="row.distributorProfile" :type="distributorTagType(row.distributorProfile)" size="small">
            {{ distributorIdentityLabel(row.distributorProfile) }}
          </el-tag>
          <span v-else>普通用户</span>
        </template>
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
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="$router.push(`/users/${row.id}`)">详情</el-button>
          <el-button type="primary" link @click="openEditDialog(row)">编辑</el-button>
          <el-button type="primary" link @click="openRoleDialog(row)">改身份</el-button>
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

    <el-dialog v-model="roleVisible" title="修改合作身份" width="600px" destroy-on-close>
      <el-form :model="roleForm" label-width="120px">
        <el-form-item label="用户">
          <div class="main-cell">
            <strong>{{ roleUser ? userLabel(roleUser) : '--' }}</strong>
            <span>{{ roleUser?.id || '--' }}</span>
          </div>
        </el-form-item>
        <el-form-item label="当前身份">
          <el-tag v-if="roleUser?.distributorProfile" :type="distributorTagType(roleUser.distributorProfile)" size="small">
            {{ distributorIdentityLabel(roleUser.distributorProfile) }}
          </el-tag>
          <span v-else>普通用户</span>
        </el-form-item>
        <el-form-item label="修改为">
          <el-radio-group v-model="roleForm.role">
            <el-radio-button label="normal">普通用户</el-radio-button>
            <el-radio-button :label="1">特邀合作伙伴</el-radio-button>
            <el-radio-button :label="2">涨识推荐官</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="roleForm.role !== 'normal'" label="合作名称">
          <el-input v-model="roleForm.name" placeholder="默认使用用户昵称或手机号" />
        </el-form-item>
        <el-form-item v-if="roleForm.role === 2" label="所属特邀伙伴">
          <el-select v-model="roleForm.parentId" placeholder="默认系统" clearable filterable style="width: 100%">
            <el-option v-for="item in selectableLevelOneOptions" :key="item.id" :label="`${item.name}（${item.code}）`" :value="item.id" />
          </el-select>
          <span class="form-hint">不选择时，如果该用户本身是被特邀伙伴邀请来的，会优先归属邀请人；否则归属系统。</span>
        </el-form-item>
        <el-form-item v-if="roleForm.role === 1" label="新用户额外赠点">
          <el-input-number v-model="roleForm.newUserGiftOverride" :min="0" :max="100000" :precision="0" :step="1" />
          <span class="form-hint">留空或 0 表示不额外赠送；这是系统默认新用户赠点之外的额外点数。</span>
        </el-form-item>
        <el-form-item v-if="roleForm.role !== 'normal'" label="状态">
          <el-select v-model="roleForm.status" style="width: 100%">
            <el-option label="启用" value="active" />
            <el-option label="待审核" value="pending" />
            <el-option label="已驳回" value="rejected" />
            <el-option label="禁用" value="disabled" />
          </el-select>
        </el-form-item>
        <el-alert
          v-if="roleForm.role === 'normal' && roleUser?.distributorProfile"
          title="改为普通用户会禁用该用户现有合作身份，小程序端不再展示合作内容，历史流水保留。"
          type="warning"
          :closable="false"
          show-icon
        />
      </el-form>
      <template #footer>
        <el-button @click="roleVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingRole" @click="saveDistributorRole">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted } from 'vue';
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
const roleVisible = ref(false);
const savingRole = ref(false);
const roleUser = ref<any>(null);
const levelOneOptions = ref<any[]>([]);
const editForm = reactive({
  nickname: '',
  shareCode: '',
  status: 1,
});
const roleForm = reactive({
  role: 'normal' as 'normal' | 1 | 2,
  name: '',
  parentId: '',
  status: 'active',
  newUserGiftOverride: null as number | null,
});
const selectableLevelOneOptions = computed(() => {
  const ownDistributorId = roleUser.value?.distributorProfile?.id;
  return levelOneOptions.value.filter(item => item.id !== ownDistributorId);
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

function locationLabel(row: any) {
  const parts = [row.province, row.city].filter(Boolean);
  const uniqueParts = parts.filter((item, index) => parts.indexOf(item) === index);
  return uniqueParts.join(' · ') || '--';
}

function avatarText(row: any) {
  return String(row.nickname || row.phone || row.shareCode || row.id || '用').slice(0, 1).toUpperCase();
}

function distributorIdentityLabel(profile: any) {
  if (!profile) return '普通用户';
  const level = profile.level === 1 ? '特邀合作伙伴' : '涨识推荐官';
  const statusMap: Record<string, string> = {
    pending: '待审核',
    active: '启用',
    rejected: '已驳回',
    disabled: '禁用',
  };
  return `${level}/${statusMap[profile.status] || profile.status || '--'}`;
}

function distributorTagType(profile: any) {
  if (!profile || profile.status === 'disabled' || profile.status === 'rejected') return 'info';
  if (profile.status === 'pending') return 'warning';
  return profile.level === 1 ? 'success' : 'primary';
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

async function openRoleDialog(row: any) {
  roleUser.value = row;
  const profile = row.distributorProfile;
  Object.assign(roleForm, {
    role: profile?.status && profile.status !== 'disabled' ? profile.level : 'normal',
    name: profile?.name || row.nickname || row.phone || '',
    parentId: profile?.parentId || '',
    status: profile?.status && profile.status !== 'disabled' ? profile.status : 'active',
    newUserGiftOverride: profile?.newUserGiftOverride ?? null,
  });
  roleVisible.value = true;
  if (!levelOneOptions.value.length) {
    await loadLevelOneOptions();
  }
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

async function loadLevelOneOptions() {
  const res = await api.distribution.levelOne() as any;
  levelOneOptions.value = res.data || [];
}

async function saveDistributorRole() {
  if (!roleUser.value?.id) return;
  const profile = roleUser.value.distributorProfile;
  savingRole.value = true;
  try {
    if (roleForm.role === 'normal') {
      if (profile?.id) {
        await api.distribution.updateDistributor(profile.id, {
          name: profile.name || roleUser.value.nickname || roleUser.value.phone || `用户${roleUser.value.id.slice(0, 6)}`,
          level: profile.level || 2,
          parentId: profile.parentId || '',
          status: 'disabled',
          newUserGiftOverride: profile.level === 1 ? (profile.newUserGiftOverride ?? null) : null,
          isGeneralAgent: false,
          generalAgentRate: 2000,
          generalAgentParentId: null,
        });
      }
      ElMessage.success('已改为普通用户');
    } else {
      const payload: any = {
        userId: roleUser.value.id,
        name: roleForm.name.trim(),
        level: roleForm.role,
        parentId: roleForm.role === 2 ? roleForm.parentId : null,
        status: roleForm.status,
        newUserGiftOverride: roleForm.role === 1 ? (roleForm.newUserGiftOverride ?? null) : null,
      };
      if (roleForm.role === 1) {
        payload.isGeneralAgent = profile?.isGeneralAgent ?? false;
        payload.generalAgentRate = profile?.generalAgentRate ?? 2000;
        payload.generalAgentParentId = profile?.generalAgentParentId || null;
      } else {
        payload.isGeneralAgent = false;
        payload.generalAgentRate = 2000;
        payload.generalAgentParentId = null;
      }
      if (profile?.id) {
        await api.distribution.updateDistributor(profile.id, payload);
      } else {
        await api.distribution.createDistributor(payload);
      }
      ElMessage.success('合作身份已保存');
    }
    roleVisible.value = false;
    await load();
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || err?.message || '保存失败');
  } finally {
    savingRole.value = false;
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
