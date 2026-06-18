<template>
  <div class="conversion-page">
    <div class="page-header">
      <div>
        <h2>腾讯广告回传</h2>
        <p>管理小程序注册转化 API 自归因配置，查看 REGISTER 回传状态。</p>
      </div>
      <el-button :loading="loading" @click="reload">刷新</el-button>
    </div>

    <el-alert
      v-if="configLoaded && !configForm.ready"
      class="status-alert"
      type="warning"
      :closable="false"
      show-icon
      :title="`配置未完整：${configForm.missing.join('、')}`"
    />
    <el-alert
      v-else-if="configLoaded"
      class="status-alert"
      type="success"
      :closable="false"
      show-icon
      title="腾讯广告回传配置完整，新注册用户会自动回传 REGISTER。"
    />

    <el-card shadow="never" class="config-card">
      <template #header>
        <div class="card-head">
          <span>回传配置</span>
          <el-tag :type="configForm.enabled ? 'success' : 'info'">{{ configForm.enabled ? '已启用' : '已停用' }}</el-tag>
        </div>
      </template>

      <el-form :model="configForm" label-width="160px" class="config-form">
        <el-row :gutter="18">
          <el-col :span="12">
            <el-form-item label="启用回传">
              <el-switch v-model="configForm.enabled" />
            </el-form-item>
            <el-form-item label="上报方式">
              <el-segmented
                v-model="configForm.reportMode"
                :options="[
                  { label: '直接上报 click_id', value: 'click_id' },
                  { label: 'Callback 上报', value: 'callback' },
                ]"
              />
            </el-form-item>
            <el-form-item label="account_id">
              <el-input v-model="configForm.accountId" placeholder="腾讯广告账号 ID" />
            </el-form-item>
            <el-form-item label="user_action_set_id">
              <el-input v-model="configForm.userActionSetId" placeholder="DataNexus 数据源 ID" />
            </el-form-item>
            <el-form-item label="access_token">
              <el-input v-model="configForm.accessToken" type="password" show-password placeholder="腾讯广告 API access_token" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="小程序 AppID">
              <el-input v-model="configForm.miniAppId" placeholder="wxff240cd6f229ec91" />
            </el-form-item>
            <el-form-item label="转化 ID">
              <el-input v-model="configForm.conversionId" placeholder="82945824" />
            </el-form-item>
            <el-form-item label="API 地址">
              <el-input v-model="configForm.apiUrl" placeholder="https://api.e.qq.com/v3.0/user_actions/add" />
            </el-form-item>
            <el-form-item label="归因窗口">
              <el-input-number v-model="configForm.attributionWindowDays" :min="1" :max="90" />
              <span class="inline-tip">天</span>
            </el-form-item>
            <el-form-item label="无 click_id 也上报">
              <el-switch v-model="configForm.reportWithoutClickId" />
              <span class="inline-tip">正式投放建议开启，使用 openid + appid 归因</span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row :gutter="14" class="stats-row">
      <el-col v-for="item in statCards" :key="item.key" :span="4">
        <el-card shadow="never" class="stat-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <template #header>
        <div class="table-toolbar">
          <span>回传日志</span>
          <div class="filters">
            <el-select v-model="filters.status" clearable placeholder="状态" style="width: 150px" @change="loadEvents">
              <el-option label="待配置" value="pending_config" />
              <el-option label="待上报" value="pending" />
              <el-option label="上报中" value="sending" />
              <el-option label="已成功" value="sent" />
              <el-option label="失败" value="failed" />
              <el-option label="已跳过" value="skipped" />
            </el-select>
            <el-input
              v-model="filters.keyword"
              clearable
              placeholder="用户 / click_id / openid"
              style="width: 240px"
              @keyup.enter="loadEvents"
              @clear="loadEvents"
            />
            <el-button :loading="eventsLoading" @click="loadEvents">查询</el-button>
          </div>
        </div>
      </template>

      <el-table :data="events" v-loading="eventsLoading" stripe>
        <el-table-column label="用户" min-width="170">
          <template #default="{ row }">
            <div class="user-cell">
              <strong>{{ row.user?.nickname || '未命名用户' }}</strong>
              <small>{{ row.user?.province || '-' }} {{ row.user?.city || '' }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="事件" width="110">
          <template #default="{ row }">
            <el-tag size="small">{{ row.eventType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="点击标识" min-width="230">
          <template #default="{ row }">
            <div class="mono-cell">
              <span>{{ row.clickId || row.cb || '-' }}</span>
              <small>{{ row.clickIdSource || row.reportMode }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="腾讯配置" min-width="180">
          <template #default="{ row }">
            <div class="mono-cell">
              <span>账号 {{ row.accountId || '-' }}</span>
              <small>数据源 {{ row.userActionSetId || '-' }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="错误" min-width="220">
          <template #default="{ row }">
            <span class="error-text">{{ row.lastError || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="180">
          <template #default="{ row }">
            <div class="time-cell">
              <span>{{ formatTime(row.createdAt) }}</span>
              <small v-if="row.reportedAt">成功 {{ formatTime(row.reportedAt) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canRetry(row)" link type="primary" :loading="retryingId === row.id" @click="retry(row)">重试</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          layout="total, sizes, prev, pager, next"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          @current-change="loadEvents"
          @size-change="loadEvents"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/api';

const loading = ref(false);
const saving = ref(false);
const eventsLoading = ref(false);
const configLoaded = ref(false);
const retryingId = ref('');
const events = ref<any[]>([]);
const stats = ref<Record<string, number>>({});

const configForm = reactive({
  enabled: true,
  reportMode: 'click_id',
  accountId: '',
  userActionSetId: '',
  accessToken: '',
  miniAppId: 'wxff240cd6f229ec91',
  conversionId: '82945824',
  apiUrl: 'https://api.e.qq.com/v3.0/user_actions/add',
  attributionWindowDays: 30,
  reportWithoutClickId: false,
  ready: false,
  missing: [] as string[],
});

const filters = reactive({
  status: '',
  keyword: '',
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
});

const statCards = computed(() => [
  { key: 'total', label: '总记录', value: stats.value.total || 0 },
  { key: 'sent', label: '成功', value: stats.value.sent || 0 },
  { key: 'failed', label: '失败', value: stats.value.failed || 0 },
  { key: 'pending_config', label: '待配置', value: stats.value.pending_config || 0 },
  { key: 'pending', label: '待上报', value: stats.value.pending || 0 },
  { key: 'skipped', label: '跳过', value: stats.value.skipped || 0 },
]);

onMounted(() => {
  reload();
});

async function reload() {
  loading.value = true;
  try {
    await Promise.all([loadConfig(), loadEvents()]);
  } finally {
    loading.value = false;
  }
}

async function loadConfig() {
  const res = await api.tencentAdConversion.config() as any;
  Object.assign(configForm, res.data);
  configLoaded.value = true;
}

async function saveConfig() {
  saving.value = true;
  try {
    const res = await api.tencentAdConversion.updateConfig({
      enabled: configForm.enabled,
      reportMode: configForm.reportMode,
      accountId: configForm.accountId,
      userActionSetId: configForm.userActionSetId,
      accessToken: configForm.accessToken,
      miniAppId: configForm.miniAppId,
      conversionId: configForm.conversionId,
      apiUrl: configForm.apiUrl,
      attributionWindowDays: configForm.attributionWindowDays,
      reportWithoutClickId: configForm.reportWithoutClickId,
    }) as any;
    Object.assign(configForm, res.data);
    ElMessage.success('腾讯广告回传配置已保存');
  } finally {
    saving.value = false;
  }
}

async function loadEvents() {
  eventsLoading.value = true;
  try {
    const res = await api.tencentAdConversion.events({
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: filters.status,
      keyword: filters.keyword,
    }) as any;
    events.value = res.data.items;
    stats.value = res.data.stats || {};
    pagination.total = res.data.total;
  } finally {
    eventsLoading.value = false;
  }
}

async function retry(row: any) {
  retryingId.value = row.id;
  try {
    await api.tencentAdConversion.retry(row.id);
    ElMessage.success('已重新发起回传');
    await loadEvents();
  } finally {
    retryingId.value = '';
  }
}

function canRetry(row: any) {
  return ['failed', 'pending_config', 'pending', 'skipped'].includes(row.status);
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: '待上报',
    pending_config: '待配置',
    sending: '上报中',
    sent: '已成功',
    failed: '失败',
    skipped: '已跳过',
  };
  return map[status] || status;
}

function statusType(status: string) {
  if (status === 'sent') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'pending_config') return 'warning';
  if (status === 'sending') return 'primary';
  return 'info';
}

function formatTime(value: string) {
  return value ? new Date(value).toLocaleString() : '-';
}
</script>

<style scoped>
.conversion-page {
  padding: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0 0 6px;
}

.page-header p {
  margin: 0;
  color: #6b7280;
}

.status-alert {
  margin-bottom: 14px;
}

.config-card {
  margin-bottom: 14px;
}

.card-head,
.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.config-form {
  max-width: 1180px;
}

.inline-tip {
  margin-left: 10px;
  color: #6b7280;
  font-size: 13px;
}

.stats-row {
  margin-bottom: 14px;
}

.stat-card span {
  display: block;
  color: #6b7280;
  font-size: 13px;
}

.stat-card strong {
  display: block;
  margin-top: 8px;
  font-size: 24px;
  color: #1f2937;
}

.filters {
  display: flex;
  gap: 10px;
  align-items: center;
}

.user-cell,
.mono-cell,
.time-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-cell small,
.mono-cell small,
.time-cell small {
  color: #6b7280;
}

.mono-cell span {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  word-break: break-all;
}

.error-text {
  color: #b91c1c;
  word-break: break-word;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
