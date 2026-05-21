<template>
  <div class="distribution-page">
    <h2>分销管理</h2>

    <div class="stat-grid">
      <el-card v-for="item in statsCards" :key="item.label" class="stat-card">
        <span class="stat-label">{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </el-card>
    </div>

    <el-card class="panel-card">
      <template #header>
        <div class="card-head">
          <span>分销规则</span>
          <el-button type="primary" :loading="savingSettings" @click="saveSettings">保存规则</el-button>
        </div>
      </template>
      <el-form :model="settingsForm" inline class="settings-form">
        <el-form-item label="启用分销">
          <el-switch v-model="settingsForm.enabled" />
        </el-form-item>
        <el-form-item label="一级总比例">
          <el-input-number v-model="settingsForm.level1Percent" :min="0" :max="100" :precision="2" :step="1" />
          <span class="hint">%</span>
        </el-form-item>
        <el-form-item label="二级直推比例">
          <el-input-number v-model="settingsForm.level2Percent" :min="0" :max="100" :precision="2" :step="1" />
          <span class="hint">%</span>
        </el-form-item>
        <span class="formula">二级单成单时：二级拿 {{ settingsForm.level2Percent }}%，所属一级拿 {{ Math.max(0, settingsForm.level1Percent - settingsForm.level2Percent).toFixed(2) }}%</span>
      </el-form>
    </el-card>

    <el-card class="panel-card">
      <template #header>
        <div class="card-head">
          <span>分销人员</span>
          <el-button type="primary" @click="openDistributorDialog()">新增/绑定用户</el-button>
        </div>
      </template>
      <div class="toolbar">
        <el-input v-model="filters.keyword" placeholder="搜索昵称/手机号/分销码" clearable style="width: 260px" @change="loadDistributors" />
        <el-select v-model="filters.level" placeholder="层级" clearable style="width: 130px" @change="loadDistributors">
          <el-option label="一级" :value="1" />
          <el-option label="二级" :value="2" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 130px" @change="loadDistributors">
          <el-option label="待审核" value="pending" />
          <el-option label="启用" value="active" />
          <el-option label="已驳回" value="rejected" />
          <el-option label="禁用" value="disabled" />
        </el-select>
        <el-button @click="loadDistributors">刷新</el-button>
      </div>

      <el-table :data="distributors" v-loading="loadingDistributors" row-key="id" style="width: 100%">
        <el-table-column type="expand" width="48">
          <template #default="{ row }">
            <div class="child-table-wrap">
              <div class="child-title">{{ row.name }} 的二级分销员</div>
              <el-table :data="row.children || []" size="small" empty-text="暂无二级分销员">
                <el-table-column label="二级分销员" min-width="180">
                  <template #default="{ row: child }">
                    <div class="main-cell">
                      <strong>{{ child.name }}</strong>
                      <span>{{ child.user?.nickname || child.user?.phone || child.userId || '-' }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="code" label="分销码" width="130" />
                <el-table-column label="直推用户" width="100">
                  <template #default="{ row: child }">{{ child._count?.referrals || 0 }}</template>
                </el-table-column>
                <el-table-column label="佣金单" width="90">
                  <template #default="{ row: child }">{{ child._count?.commissions || 0 }}</template>
                </el-table-column>
                <el-table-column label="状态" width="90">
                  <template #default="{ row: child }">
                    <el-tag :type="statusTagType(child.status)" size="small">{{ statusLabel(child.status) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="创建时间" width="170">
                  <template #default="{ row: child }">{{ formatTime(child.createdAt) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="230" fixed="right">
                  <template #default="{ row: child }">
                    <el-button v-if="child.status === 'pending'" type="success" link @click="reviewDistributor(child, 'active')">通过</el-button>
                    <el-button v-if="child.status === 'pending'" type="danger" link @click="reviewDistributor(child, 'rejected')">驳回</el-button>
                    <el-button type="primary" link @click="openLedgerDialog(child)">流水</el-button>
                    <el-button type="primary" link @click="openDistributorDialog(child)">编辑</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="分销员" min-width="180">
          <template #default="{ row }">
            <div class="main-cell">
              <strong>{{ row.name }}</strong>
              <span>{{ row.isGroup ? '系统分组' : (row.user?.nickname || row.user?.phone || row.userId || '-') }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="code" label="分销码" width="130" />
        <el-table-column label="层级" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isGroup ? 'warning' : 'success'" size="small">{{ row.isGroup ? '分组' : levelLabel(row.level) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="所属一级" min-width="150">
          <template #default>--</template>
        </el-table-column>
        <el-table-column label="直推用户" width="100">
          <template #default="{ row }">{{ row._count?.referrals || 0 }}</template>
        </el-table-column>
        <el-table-column label="下级二级" width="100">
          <template #default="{ row }">{{ row._count?.children || 0 }}</template>
        </el-table-column>
        <el-table-column label="佣金单" width="90">
          <template #default="{ row }">{{ row._count?.commissions || 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag v-if="!row.isGroup" :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
            <span v-else>--</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <template v-if="!row.isGroup">
              <el-button v-if="row.status === 'pending'" type="success" link @click="reviewDistributor(row, 'active')">通过</el-button>
              <el-button v-if="row.status === 'pending'" type="danger" link @click="reviewDistributor(row, 'rejected')">驳回</el-button>
              <el-button type="primary" link @click="openLedgerDialog(row)">流水</el-button>
              <el-button type="primary" link @click="openDistributorDialog(row)">编辑</el-button>
            </template>
            <span v-else>--</span>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        :total="total"
        :page-size="pageSize"
        layout="prev, pager, next"
        @current-change="loadDistributors"
        class="pager"
      />
    </el-card>

    <el-card class="panel-card">
      <template #header>
        <div class="card-head">
          <span>佣金流水</span>
          <el-button @click="loadCommissions">刷新</el-button>
        </div>
      </template>
      <el-table :data="commissions" v-loading="loadingCommissions" style="width: 100%">
        <el-table-column label="分销员" min-width="160">
          <template #default="{ row }">{{ row.distributor?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="角色" width="130">
          <template #default="{ row }">{{ roleLabel(row.role) }}</template>
        </el-table-column>
        <el-table-column label="被推荐用户" min-width="150">
          <template #default="{ row }">{{ row.referralUser?.nickname || row.referralUser?.phone || row.referralUserId }}</template>
        </el-table-column>
        <el-table-column label="订单" min-width="210">
          <template #default="{ row }">
            <div class="main-cell">
              <strong>{{ row.order?.productName || '-' }}</strong>
              <span>{{ row.order?.orderNo || row.orderId }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="订单金额" width="110">
          <template #default="{ row }">{{ formatMoney(row.order?.amount || 0) }}</template>
        </el-table-column>
        <el-table-column label="比例" width="90">
          <template #default="{ row }">{{ (row.rateBps / 100).toFixed(2) }}%</template>
        </el-table-column>
        <el-table-column label="佣金" width="110">
          <template #default="{ row }">
            <strong>{{ formatMoney(row.amount) }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="commissionPage"
        :total="commissionTotal"
        :page-size="commissionPageSize"
        layout="prev, pager, next"
        @current-change="loadCommissions"
        class="pager"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="distributorForm.id ? '编辑分销员' : '新增分销员'" width="620px">
      <el-form :model="distributorForm" label-width="110px">
        <el-form-item label="用户 ID" required>
          <el-input v-model="distributorForm.userId" :disabled="!!distributorForm.id" placeholder="填写用户 ID，系统会绑定为分销员" />
        </el-form-item>
        <el-form-item label="展示名称">
          <el-input v-model="distributorForm.name" placeholder="默认使用用户昵称或手机号" />
        </el-form-item>
        <el-form-item label="层级">
          <el-radio-group v-model="distributorForm.level">
            <el-radio-button :label="1">一级</el-radio-button>
            <el-radio-button :label="2">二级</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="distributorForm.level === 2" label="所属一级">
          <el-select v-model="distributorForm.parentId" placeholder="默认系统" filterable style="width: 100%">
            <el-option v-for="item in levelOneOptions" :key="item.id" :label="`${item.name}（${item.code}）`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="distributorForm.status" style="width: 100%">
            <el-option label="待审核" value="pending" />
            <el-option label="启用" value="active" />
            <el-option label="已驳回" value="rejected" />
            <el-option label="禁用" value="disabled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingDistributor" @click="saveDistributor">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="ledgerDialogVisible" :title="`${ledgerDistributor?.name || ''} 流水`" width="980px">
      <div v-if="ledgerDistributor" class="ledger-summary">
        <div>
          <span>分销码</span>
          <strong>{{ ledgerDistributor.code }}</strong>
        </div>
        <div>
          <span>层级</span>
          <strong>{{ levelLabel(ledgerDistributor.level) }}</strong>
        </div>
        <div>
          <span>用户</span>
          <strong>{{ ledgerDistributor.user?.nickname || ledgerDistributor.user?.phone || ledgerDistributor.userId || '-' }}</strong>
        </div>
      </div>

      <el-tabs v-model="ledgerActiveTab">
        <el-tab-pane label="分销流水" name="commissions">
          <el-table :data="ledgerCommissions" v-loading="loadingLedgerCommissions" style="width: 100%" empty-text="暂无分销流水">
            <el-table-column label="角色" width="120">
              <template #default="{ row }">{{ roleLabel(row.role) }}</template>
            </el-table-column>
            <el-table-column label="被推荐用户" min-width="150">
              <template #default="{ row }">{{ row.referralUser?.nickname || row.referralUser?.phone || row.referralUserId }}</template>
            </el-table-column>
            <el-table-column label="订单" min-width="210">
              <template #default="{ row }">
                <div class="main-cell">
                  <strong>{{ row.order?.productName || '-' }}</strong>
                  <span>{{ row.order?.orderNo || row.orderId }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="订单金额" width="110">
              <template #default="{ row }">{{ formatMoney(row.order?.amount || 0) }}</template>
            </el-table-column>
            <el-table-column label="比例" width="90">
              <template #default="{ row }">{{ (row.rateBps / 100).toFixed(2) }}%</template>
            </el-table-column>
            <el-table-column label="佣金" width="110">
              <template #default="{ row }">
                <strong>{{ formatMoney(row.amount) }}</strong>
              </template>
            </el-table-column>
            <el-table-column label="时间" width="170">
              <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="ledgerCommissionPage"
            :total="ledgerCommissionTotal"
            :page-size="ledgerCommissionPageSize"
            layout="prev, pager, next"
            @current-change="loadLedgerCommissions"
            class="pager"
          />
        </el-tab-pane>
        <el-tab-pane label="提现流水" name="withdrawals">
          <el-table :data="ledgerWithdrawals" style="width: 100%" empty-text="暂无提现流水">
            <el-table-column prop="amount" label="提现金额" width="120">
              <template #default="{ row }">{{ formatMoney(row.amount || 0) }}</template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="120" />
            <el-table-column prop="remark" label="备注" min-width="180" />
            <el-table-column label="时间" width="170">
              <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/api';

const settingsForm = reactive({
  enabled: true,
  level1Percent: 50,
  level2Percent: 20,
});
const savingSettings = ref(false);

const dashboard = ref<any>({});
const filters = reactive({ keyword: '', level: undefined as number | undefined, status: '' });
const distributors = ref<any[]>([]);
const levelOneOptions = ref<any[]>([]);
const loadingDistributors = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);

const commissions = ref<any[]>([]);
const loadingCommissions = ref(false);
const commissionPage = ref(1);
const commissionPageSize = 20;
const commissionTotal = ref(0);

const ledgerDialogVisible = ref(false);
const ledgerDistributor = ref<any>(null);
const ledgerActiveTab = ref('commissions');
const ledgerCommissions = ref<any[]>([]);
const loadingLedgerCommissions = ref(false);
const ledgerCommissionPage = ref(1);
const ledgerCommissionPageSize = 10;
const ledgerCommissionTotal = ref(0);
const ledgerWithdrawals = ref<any[]>([]);

const dialogVisible = ref(false);
const savingDistributor = ref(false);
const distributorForm = reactive({
  id: '',
  userId: '',
  name: '',
  level: 2,
  parentId: '',
  status: 'active',
});

const statsCards = computed(() => [
  { label: '分销员', value: dashboard.value.distributorCount || 0 },
  { label: '一级', value: dashboard.value.level1Count || 0 },
  { label: '二级', value: dashboard.value.level2Count || 0 },
  { label: '推荐用户', value: dashboard.value.referralCount || 0 },
  { label: '佣金总额', value: formatMoney(dashboard.value.commissionAmount || 0) },
]);

async function loadSettings() {
  const res = await api.distribution.settings() as any;
  Object.assign(settingsForm, {
    enabled: res.data.enabled,
    level1Percent: res.data.level1Percent,
    level2Percent: res.data.level2Percent,
  });
}

async function saveSettings() {
  if (settingsForm.level1Percent < settingsForm.level2Percent) {
    ElMessage.warning('一级总比例不能低于二级直推比例');
    return;
  }
  savingSettings.value = true;
  try {
    await api.distribution.updateSettings({
      enabled: settingsForm.enabled,
      level1Rate: Math.round(settingsForm.level1Percent * 100),
      level2Rate: Math.round(settingsForm.level2Percent * 100),
    });
    ElMessage.success('分销规则已保存');
    await loadSettings();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败');
  } finally {
    savingSettings.value = false;
  }
}

async function loadDashboard() {
  const res = await api.distribution.dashboard() as any;
  dashboard.value = res.data;
}

async function loadDistributors() {
  loadingDistributors.value = true;
  try {
    const res = await api.distribution.distributorTree({
      page: page.value,
      pageSize,
      keyword: filters.keyword,
      level: filters.level,
      status: filters.status,
    }) as any;
    distributors.value = res.data.list;
    total.value = res.data.total;
  } finally {
    loadingDistributors.value = false;
  }
}

async function loadLevelOneOptions() {
  const res = await api.distribution.levelOne() as any;
  levelOneOptions.value = res.data;
}

async function loadCommissions() {
  loadingCommissions.value = true;
  try {
    const res = await api.distribution.commissions({
      page: commissionPage.value,
      pageSize: commissionPageSize,
    }) as any;
    commissions.value = res.data.list;
    commissionTotal.value = res.data.total;
  } finally {
    loadingCommissions.value = false;
  }
}

async function openLedgerDialog(row: any) {
  ledgerDistributor.value = row;
  ledgerActiveTab.value = 'commissions';
  ledgerCommissionPage.value = 1;
  ledgerCommissions.value = [];
  ledgerCommissionTotal.value = 0;
  ledgerWithdrawals.value = [];
  ledgerDialogVisible.value = true;
  await loadLedgerCommissions();
}

async function loadLedgerCommissions() {
  if (!ledgerDistributor.value?.id) return;
  loadingLedgerCommissions.value = true;
  try {
    const res = await api.distribution.commissions({
      page: ledgerCommissionPage.value,
      pageSize: ledgerCommissionPageSize,
      distributorId: ledgerDistributor.value.id,
    }) as any;
    ledgerCommissions.value = res.data.list;
    ledgerCommissionTotal.value = res.data.total;
  } finally {
    loadingLedgerCommissions.value = false;
  }
}

function openDistributorDialog(row?: any) {
  Object.assign(distributorForm, row ? {
    id: row.id,
    userId: row.userId || '',
    name: row.name || '',
    level: row.level,
    parentId: row.parentId || '',
    status: row.status || 'active',
  } : {
    id: '',
    userId: '',
    name: '',
    level: 2,
    parentId: '',
    status: 'active',
  });
  dialogVisible.value = true;
}

async function saveDistributor() {
  if (!distributorForm.id && !distributorForm.userId.trim()) {
    ElMessage.warning('请填写用户 ID');
    return;
  }
  savingDistributor.value = true;
  try {
    const payload = {
      userId: distributorForm.userId.trim(),
      name: distributorForm.name.trim(),
      level: distributorForm.level,
      parentId: distributorForm.level === 2 ? distributorForm.parentId : null,
      status: distributorForm.status,
    };
    if (distributorForm.id) {
      await api.distribution.updateDistributor(distributorForm.id, payload);
    } else {
      await api.distribution.createDistributor(payload);
    }
    dialogVisible.value = false;
    ElMessage.success('分销员已保存');
    await Promise.all([loadDashboard(), loadDistributors(), loadLevelOneOptions()]);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败');
  } finally {
    savingDistributor.value = false;
  }
}

async function reviewDistributor(row: any, status: 'active' | 'rejected') {
  try {
    await api.distribution.updateDistributor(row.id, {
      name: row.name,
      level: row.level,
      parentId: row.parentId,
      status,
    });
    ElMessage.success(status === 'active' ? '已审核通过' : '已驳回');
    await Promise.all([loadDashboard(), loadDistributors(), loadLevelOneOptions()]);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败');
  }
}

function levelLabel(level: number) {
  return level === 1 ? '一级' : '二级';
}

function statusLabel(status: string) {
  if (status === 'active') return '启用';
  if (status === 'pending') return '待审核';
  if (status === 'rejected') return '已驳回';
  return '禁用';
}

function statusTagType(status: string) {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'rejected') return 'danger';
  return 'info';
}

function roleLabel(role: string) {
  if (role === 'level1_direct') return '一级直推';
  if (role === 'level2_direct') return '二级直推';
  if (role === 'level1_override') return '一级差额';
  return role;
}

function formatMoney(value: number) {
  return `¥${(Number(value || 0) / 100).toFixed(2)}`;
}

function formatTime(value: string) {
  return value ? new Date(value).toLocaleString() : '-';
}

onMounted(() => {
  loadSettings();
  loadDashboard();
  loadLevelOneOptions();
  loadDistributors();
  loadCommissions();
});
</script>

<style lang="scss" scoped>
h2 {
  margin-bottom: 20px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.stat-card {
  .stat-label {
    display: block;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    margin-bottom: 8px;
  }

  strong {
    font-size: 22px;
  }
}

.panel-card {
  margin-bottom: 18px;
}

.card-head,
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar {
  justify-content: flex-start;
  margin-bottom: 14px;
}

.settings-form {
  align-items: center;
}

.child-table-wrap {
  padding: 12px 18px 16px 54px;
  background: #f8fafc;
}

.child-title {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 10px;
}

.formula,
.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.hint {
  margin-left: 8px;
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

.pager {
  margin-top: 16px;
  justify-content: center;
}
</style>
