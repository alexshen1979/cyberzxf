<template>
  <div class="orders-page">
    <h2>订单管理</h2>
    <el-alert
      v-if="paymentConfig && !paymentConfig.ready"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    >
      <template #title>
        微信支付未配置完整：{{ paymentConfig.missing.join('、') }}
      </template>
    </el-alert>
    <el-card class="payment-config-card" shadow="never">
      <div class="payment-config-head">
        <div>
          <div class="payment-config-title">微信登录与支付参数</div>
          <div class="payment-config-subtitle">
            {{ paymentConfig?.ready ? '配置完整，可以发起真实支付' : '配置未完整，充值接口会阻止真实下单' }}
          </div>
        </div>
        <el-button type="primary" @click="openPaymentConfig">配置参数</el-button>
      </div>
    </el-card>
    <el-card class="settlement-card" shadow="never" v-loading="settlementLoading">
      <div class="settlement-head">
        <div>
          <div class="payment-config-title">虚拟支付结算同步</div>
          <div class="payment-config-subtitle">
            同步微信虚拟支付订单的 Apple IAP / 安卓鸿蒙标识、结算状态、技术服务费和可提现余额。
          </div>
          <div class="payment-config-subtitle">
            自动同步：{{ syncSettings.enabled ? `已开启，每 ${syncSettings.intervalHours} 小时同步最近 ${syncSettings.days} 天，最多 ${syncSettings.limit} 单` : '已关闭' }}
          </div>
        </div>
        <div class="settlement-actions">
          <el-input v-model="syncOrderNo" placeholder="指定订单号，可留空" clearable style="width: 220px" />
          <el-button :loading="syncingSettlements" @click="syncSettlements">同步结算</el-button>
        </div>
      </div>
      <div class="settlement-grid">
        <div class="settlement-item">
          <span>虚拟支付总收入</span>
          <strong>{{ formatMoney(settlementOverview.totalAmount) }}</strong>
          <em>{{ formatNumber(settlementOverview.totalOrders) }} 笔</em>
          <small>{{ deviceBreakdownText(settlementOverview.paymentDeviceBreakdown) }}</small>
        </div>
        <div class="settlement-item">
          <span>已结算</span>
          <strong>{{ formatMoney(settlementOverview.settledAmount) }}</strong>
          <em>{{ formatNumber(settlementOverview.settledOrders) }} 笔</em>
          <small>{{ deviceBreakdownText(settlementOverview.settledDeviceBreakdown) }}</small>
        </div>
        <div class="settlement-item">
          <span>待结算</span>
          <strong>{{ formatMoney(settlementOverview.pendingAmount) }}</strong>
          <em>{{ formatNumber(settlementOverview.pendingOrders) }} 笔</em>
          <small>{{ deviceBreakdownText(settlementOverview.pendingDeviceBreakdown) }}</small>
        </div>
        <div class="settlement-item">
          <span>账户可提现</span>
          <strong>{{ formatMoney(settlementOverview.latestBalance?.availableAmountFen || 0) }}</strong>
          <em>{{ settlementOverview.latestBalance?.createdAt ? formatTime(settlementOverview.latestBalance.createdAt) : '未同步' }}</em>
          <small>微信账户余额，实际可提现以微信虚拟支付资金页为准</small>
        </div>
      </div>
      <div class="sync-settings-panel">
        <div class="sync-settings-main">
          <el-switch
            v-model="syncSettings.enabled"
            active-text="自动同步开启"
            inactive-text="自动同步关闭"
            @change="saveSyncSettings"
          />
          <el-input-number v-model="syncSettings.intervalHours" :min="1" :max="168" :precision="0" controls-position="right" @change="saveSyncSettings" />
          <span>小时一次</span>
          <el-input-number v-model="syncSettings.days" :min="1" :max="180" :precision="0" controls-position="right" @change="saveSyncSettings" />
          <span>天内订单</span>
          <el-input-number v-model="syncSettings.limit" :min="1" :max="200" :precision="0" controls-position="right" @change="saveSyncSettings" />
          <span>单/次</span>
          <el-button size="small" :loading="savingSyncSettings" @click="saveSyncSettings">保存</el-button>
        </div>
        <div class="sync-settings-note">
          最近自动同步：{{ syncSettings.lastSyncedAt ? formatTime(syncSettings.lastSyncedAt) : '暂无' }}
          <template v-if="syncSettings.lastResult">
            · 扫描 {{ syncSettings.lastResult.scanned || 0 }} 笔，同步 {{ syncSettings.lastResult.synced || 0 }} 笔，失败 {{ syncSettings.lastResult.failed || 0 }} 笔
          </template>
        </div>
      </div>
    </el-card>
    <el-card class="analytics-card" shadow="never" v-loading="analyticsLoading">
      <div class="analytics-head">
        <div>
          <div class="analytics-title">充值页面数据</div>
          <div class="analytics-subtitle">记录小程序充值页浏览、点击支付、下单与支付转化</div>
        </div>
        <div class="analytics-actions">
          <el-date-picker
            v-model="analyticsRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            @change="loadAnalytics"
          />
          <el-button @click="loadAnalytics">刷新</el-button>
        </div>
      </div>
      <div class="analytics-grid">
        <div class="analytics-item" v-for="item in analyticsCards" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em>{{ item.tip }}</em>
        </div>
      </div>
    </el-card>
    <el-radio-group v-model="statusFilter" @change="load" style="margin-bottom: 16px">
      <el-radio-button value="">全部</el-radio-button>
      <el-radio-button value="pending">待支付</el-radio-button>
      <el-radio-button value="paid">已支付</el-radio-button>
      <el-radio-button value="refunded">已退款</el-radio-button>
    </el-radio-group>
    <el-radio-group v-model="paymentDeviceFilter" @change="load" style="margin: 0 0 16px 12px">
      <el-radio-button value="">全部支付端</el-radio-button>
      <el-radio-button value="ios">Apple IAP</el-radio-button>
      <el-radio-button value="android">安卓/鸿蒙</el-radio-button>
      <el-radio-button value="wechat_pay">普通微信支付</el-radio-button>
    </el-radio-group>
    <div class="order-device-summary" v-if="orderStats">
      <span>已支付收入 {{ formatMoney(orderStats.revenue || 0) }}</span>
      <span>Apple IAP {{ formatMoney(deviceAmount(orderStats.paymentDeviceBreakdown, 'ios')) }}</span>
      <span>安卓/鸿蒙 {{ formatMoney(deviceAmount(orderStats.paymentDeviceBreakdown, 'android')) }}</span>
      <span>普通微信支付 {{ formatMoney(deviceAmount(orderStats.paymentDeviceBreakdown, 'wechatPay')) }}</span>
    </div>
    <el-table :data="orders" style="width: 100%" v-loading="loading">
      <el-table-column label="订单信息" min-width="280">
        <template #default="{ row }">
          <div class="order-info-cell">
            <div class="order-info-main">
              <strong>{{ row.orderNo || '-' }}</strong>
              <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
            </div>
            <span>微信交易号：{{ row.transactionId || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="充值账户" min-width="240">
        <template #default="{ row }">
          <div class="user-cell">
            <div class="user-main">
              <strong>{{ userDisplayName(row.user) }}</strong>
              <el-tag :type="userRoleTagType(row.user)" size="small">{{ userRoleLabel(row.user) }}</el-tag>
            </div>
            <span>ID：{{ row.user?.id || row.userId || '-' }}</span>
            <span v-if="row.user?.phone">手机号：{{ row.user.phone }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="productName" label="套餐" min-width="200" />
      <el-table-column label="金额" width="100">
        <template #default="{ row }">¥{{ (row.amount / 100).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="支付端" width="120">
        <template #default="{ row }">
          <el-tag :type="paymentDeviceTagType(row.paymentDevice)" size="small">{{ paymentDeviceLabel(row.paymentDevice) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="结算" width="150">
        <template #default="{ row }">
          <div class="settlement-cell">
            <el-tag :type="settlementTagType(row.virtualSettState)" size="small">{{ settlementLabel(row.virtualSettState, row.payChannel) }}</el-tag>
            <span v-if="row.virtualPlatformFee">服务费 {{ formatMoney(row.virtualPlatformFee) }}</span>
            <span v-if="row.virtualSettTime">{{ formatDate(row.virtualSettTime) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="推荐奖励" min-width="260">
        <template #default="{ row }">
          <div v-if="row.distributionCommissions?.length" class="commission-cell">
            <div class="commission-summary">
              <strong>{{ formatMoney(commissionTotal(row)) }}</strong>
              <span>{{ row.distributionCommissions.length }} 笔</span>
            </div>
            <div class="commission-line" v-for="item in row.distributionCommissions" :key="item.id">
              <span>{{ item.distributor?.name || item.distributor?.code || item.distributorId }}</span>
              <em>{{ roleLabel(item.role) }} · {{ formatMoney(item.amount) }}</em>
            </div>
          </div>
          <span v-else class="muted">无</span>
        </template>
      </el-table-column>
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'pending'"
            type="primary"
            link
            :loading="syncingOrderNo === row.orderNo"
            @click="syncPaymentOrder(row)"
          >
            同步支付状态
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="paymentConfigDialogVisible" title="微信登录与支付参数" width="720px">
      <el-form :model="paymentConfigForm" label-width="180px">
        <el-form-item label="小程序 AppID">
          <el-input v-model="paymentConfigForm.miniAppId" placeholder="wx..." />
        </el-form-item>
        <el-form-item label="小程序 Secret">
          <el-input v-model="paymentConfigForm.miniSecret" placeholder="留空或保留脱敏值表示不修改" show-password />
        </el-form-item>
        <el-divider content-position="left">充值支付模式</el-divider>
        <el-form-item label="充值支付模式">
          <el-select v-model="paymentConfigForm.rechargePayMode" style="width: 100%">
            <el-option label="普通微信支付（线上旧版保持可用）" value="wechat_pay" />
            <el-option label="自动切换（新版虚拟支付，旧版普通支付）" value="auto" />
            <el-option label="强制虚拟支付（确认全量新版后使用）" value="wechat_virtual" />
          </el-select>
        </el-form-item>
        <el-form-item label="虚拟支付 OfferID">
          <el-input v-model="paymentConfigForm.virtualOfferId" placeholder="虚拟支付基础配置中的 offerId" />
        </el-form-item>
        <el-form-item label="虚拟支付 AppKey">
          <el-input v-model="paymentConfigForm.virtualAppKey" placeholder="留空或保留脱敏值表示不修改" show-password />
        </el-form-item>
        <el-form-item label="虚拟支付沙箱 AppKey">
          <el-input v-model="paymentConfigForm.virtualSandboxAppKey" placeholder="留空或保留脱敏值表示不修改" show-password />
        </el-form-item>
        <el-form-item label="虚拟支付环境">
          <el-radio-group v-model="paymentConfigForm.virtualEnv">
            <el-radio-button :value="0">正式</el-radio-button>
            <el-radio-button :value="1">沙箱</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="虚拟道具映射">
          <el-input
            v-model="paymentConfigForm.virtualProductMap"
            type="textarea"
            :rows="3"
            placeholder='可留空，默认用套餐ID作为道具ID；或填写 {"pkg_120":"wechat_goods_id"}'
          />
        </el-form-item>
        <el-form-item label="虚拟支付推送地址">
          <el-input v-model="paymentConfigForm.virtualCallbackUrl" disabled />
        </el-form-item>
        <el-divider content-position="left">普通微信支付</el-divider>
        <el-form-item label="商户号 MCHID">
          <el-input v-model="paymentConfigForm.mchId" />
        </el-form-item>
        <el-form-item label="APIv3 Key">
          <el-input v-model="paymentConfigForm.apiV3Key" placeholder="32 位 APIv3 密钥，留空或保留脱敏值表示不修改" show-password />
        </el-form-item>
        <el-form-item label="商户证书序列号">
          <el-input v-model="paymentConfigForm.serialNo" />
        </el-form-item>
        <el-form-item label="商户私钥路径">
          <el-input v-model="paymentConfigForm.privateKeyPath" placeholder="/path/to/apiclient_key.pem" />
        </el-form-item>
        <el-form-item label="微信支付平台公钥路径">
          <el-input v-model="paymentConfigForm.platformPublicKeyPath" placeholder="/path/to/wechatpay_platform_public_key.pem" />
        </el-form-item>
        <el-form-item label="支付回调地址">
          <el-input v-model="paymentConfigForm.notifyUrl" placeholder="https://你的域名/api/v1/payments/callback" />
        </el-form-item>
        <el-form-item label="商家转账回调地址">
          <el-input v-model="paymentConfigForm.transferNotifyUrl" placeholder="https://你的域名/api/v1/distribution/transfer-callback" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="paymentConfigDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingPaymentConfig" @click="savePaymentConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted } from 'vue';
import { api } from '@/api';
import { ElMessage } from 'element-plus';

const orders = ref([]);
const loading = ref(false);
const statusFilter = ref('');
const paymentDeviceFilter = ref('');
const analyticsLoading = ref(false);
const analytics = ref<any>({});
const orderStats = ref<any>(null);
const analyticsRange = ref<[string, string]>(defaultAnalyticsRange());
const paymentConfig = ref<{ ready: boolean; missing: string[] } | null>(null);
const settlementOverview = ref<any>({});
const settlementLoading = ref(false);
const syncingSettlements = ref(false);
const syncingOrderNo = ref('');
const syncOrderNo = ref('');
const savingSyncSettings = ref(false);
const syncSettings = reactive({
  enabled: true,
  intervalHours: 6,
  days: 120,
  limit: 30,
  lastSyncedAt: '',
  lastResult: null as any,
});
const paymentConfigDialogVisible = ref(false);
const savingPaymentConfig = ref(false);
const paymentConfigForm = reactive({
  miniAppId: '',
  miniSecret: '',
  rechargePayMode: 'wechat_pay',
  virtualOfferId: '',
  virtualAppKey: '',
  virtualSandboxAppKey: '',
  virtualEnv: 0,
  virtualProductMap: '',
  virtualCallbackUrl: '',
  mchId: '',
  apiV3Key: '',
  serialNo: '',
  privateKeyPath: '',
  platformPublicKeyPath: '',
  notifyUrl: '',
  transferNotifyUrl: '',
});

const analyticsCards = computed(() => {
  const data = analytics.value || {};
  return [
    { label: '充值页浏览', value: formatNumber(data.views), tip: `去重用户 ${formatNumber(data.uniqueViewUsers)}` },
    { label: '点击支付', value: formatNumber(data.payClicks), tip: `点击率 ${formatPercent(data.clickRate)}` },
    { label: '创建订单', value: formatNumber(data.createdOrders), tip: `浏览到下单 ${formatPercent(data.orderRate)}` },
    { label: '支付成功', value: formatNumber(data.paidOrders), tip: `浏览到支付 ${formatPercent(data.payConversionRate)}` },
    { label: '点击到支付', value: formatPercent(data.clickPayRate), tip: '点击支付后的成功率' },
    { label: '充值收入', value: formatMoney(data.revenue), tip: `iOS ${formatMoney(deviceAmount(data.paymentDeviceBreakdown, 'ios'))} / 安卓 ${formatMoney(deviceAmount(data.paymentDeviceBreakdown, 'android'))}` },
  ];
});

function statusType(s: string) {
  const map: Record<string, string> = { paid: 'success', pending: 'warning', refunded: 'info', closed: 'danger' };
  return map[s] || 'info';
}

function roleLabel(role: string) {
  if (role === 'level1_direct') return '直接推荐奖励';
  if (role === 'level2_direct') return '推荐奖励';
  if (role === 'level1_override') return '合作伙伴奖励';
  if (role === 'level1_recurring_direct') return '复充直接奖励';
  if (role === 'level2_recurring_direct') return '复充推荐奖励';
  if (role === 'level1_recurring_override') return '复充合作伙伴奖励';
  return role || '-';
}

function userDisplayName(user: any) {
  return user?.nickname || user?.phone || user?.shareCode || '未命名用户';
}

function userRoleLabel(user: any) {
  const profile = user?.distributorProfile;
  if (!profile || profile.status !== 'active') return '普通用户';
  return profile.level === 1 ? '合作伙伴' : '推荐官';
}

function userRoleTagType(user: any) {
  const profile = user?.distributorProfile;
  if (!profile || profile.status !== 'active') return 'info';
  return profile.level === 1 ? 'success' : 'warning';
}

function paymentDeviceLabel(value: string) {
  if (value === 'ios') return 'Apple IAP';
  if (value === 'android') return '安卓/鸿蒙';
  if (value === 'wechat_pay') return '普通微信支付';
  return '未识别';
}

function paymentDeviceTagType(value: string) {
  if (value === 'ios') return 'warning';
  if (value === 'android') return 'success';
  if (value === 'wechat_pay') return 'info';
  return 'danger';
}

function settlementLabel(value: any, payChannel?: string) {
  if (payChannel !== 'wechat_virtual') return '普通支付';
  const state = Number(value);
  if (state === 2) return '已结算';
  if (state === 1) return '结算中';
  if (state === 0 || state === 3) return '待结算';
  return '待同步';
}

function settlementTagType(value: any) {
  const state = Number(value);
  if (state === 2) return 'success';
  if (state === 1) return 'warning';
  if (state === 0 || state === 3) return 'info';
  return 'info';
}

function commissionTotal(row: any) {
  return (row.distributionCommissions || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
}

function formatMoney(value: number) {
  return `¥${(Number(value || 0) / 100).toFixed(2)}`;
}

function formatNumber(value: any) {
  return Number(value || 0).toLocaleString('zh-CN');
}

function formatTime(value: string) {
  return value ? new Date(value).toLocaleString() : '-';
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function deviceAmount(summary: any, key: string) {
  return Number(summary?.[key]?.amount || 0);
}

function deviceCount(summary: any, key: string) {
  return Number(summary?.[key]?.count || 0);
}

function deviceBreakdownText(summary: any) {
  return `iOS ${formatMoney(deviceAmount(summary, 'ios'))} / ${deviceCount(summary, 'ios')} 笔 · 安卓/鸿蒙 ${formatMoney(deviceAmount(summary, 'android'))} / ${deviceCount(summary, 'android')} 笔`;
}

function formatPercent(value: any) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function defaultAnalyticsRange(): [string, string] {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return [toDateInput(start), toDateInput(end)];
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function load() {
  loading.value = true;
  try {
    const res = await api.orders.list({ status: statusFilter.value, paymentDevice: paymentDeviceFilter.value }) as any;
    orders.value = res.data.list;
    orderStats.value = res.data.stats || null;
  } finally { loading.value = false; }
}

async function loadAnalytics() {
  analyticsLoading.value = true;
  try {
    const [startDate, endDate] = analyticsRange.value || defaultAnalyticsRange();
    const res = await api.orders.rechargeAnalytics({ startDate, endDate }) as any;
    analytics.value = res.data || {};
  } finally {
    analyticsLoading.value = false;
  }
}

async function loadPaymentConfig() {
  const res = await api.orders.paymentConfigStatus() as any;
  paymentConfig.value = res.data;
}

async function loadSettlementOverview() {
  settlementLoading.value = true;
  try {
    const res = await api.orders.virtualSettlements() as any;
    settlementOverview.value = res.data || {};
  } finally {
    settlementLoading.value = false;
  }
}

async function loadSyncSettings() {
  const res = await api.orders.virtualSettlementSyncSettings() as any;
  Object.assign(syncSettings, normalizeSyncSettings(res.data || {}));
}

function normalizeSyncSettings(data: any) {
  return {
    enabled: data.enabled !== false,
    intervalHours: clampInt(data.intervalHours, 1, 168, 6),
    days: clampInt(data.days, 1, 180, 120),
    limit: clampInt(data.limit, 1, 200, 30),
    lastSyncedAt: data.lastSyncedAt || '',
    lastResult: data.lastResult || null,
  };
}

function clampInt(value: any, min: number, max: number, fallback: number) {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

async function saveSyncSettings() {
  if (savingSyncSettings.value) return;
  Object.assign(syncSettings, normalizeSyncSettings(syncSettings));
  savingSyncSettings.value = true;
  try {
    const res = await api.orders.updateVirtualSettlementSyncSettings({
      enabled: syncSettings.enabled,
      intervalHours: syncSettings.intervalHours,
      days: syncSettings.days,
      limit: syncSettings.limit,
    }) as any;
    Object.assign(syncSettings, normalizeSyncSettings(res.data || {}));
    ElMessage.success('自动同步设置已保存');
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '保存失败');
  } finally {
    savingSyncSettings.value = false;
  }
}

async function syncSettlements() {
  syncingSettlements.value = true;
  try {
    const res = await api.orders.syncVirtualSettlements({
      orderNo: syncOrderNo.value.trim(),
      limit: syncOrderNo.value.trim() ? 1 : 100,
      days: 120,
    }) as any;
    const data = res.data || {};
    ElMessage.success(`同步完成：${data.synced || 0} 笔，已结算 ${data.settled || 0} 笔`);
    await Promise.all([load(), loadSettlementOverview(), loadAnalytics()]);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '同步失败');
  } finally {
    syncingSettlements.value = false;
  }
}

async function syncPaymentOrder(row: any) {
  const orderNo = String(row?.orderNo || '').trim();
  if (!orderNo || syncingOrderNo.value) return;
  syncingOrderNo.value = orderNo;
  try {
    const res = await api.orders.syncPayment(orderNo) as any;
    const order = res.data || {};
    if (order.status === 'paid') {
      ElMessage.success('订单已支付，点数已补到账');
    } else if (order.status === 'failed') {
      ElMessage.warning('微信返回未支付成功，订单已标记失败');
    } else {
      ElMessage.info('订单仍未支付成功');
    }
    await Promise.all([load(), loadSettlementOverview(), loadAnalytics()]);
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '同步失败');
  } finally {
    syncingOrderNo.value = '';
  }
}

async function openPaymentConfig() {
  const res = await api.orders.paymentConfig() as any;
  Object.assign(paymentConfigForm, {
    miniAppId: res.data.miniAppId || '',
    miniSecret: res.data.miniSecret || '',
    rechargePayMode: res.data.rechargePayMode || 'wechat_pay',
    virtualOfferId: res.data.virtualOfferId || '',
    virtualAppKey: res.data.virtualAppKey || '',
    virtualSandboxAppKey: res.data.virtualSandboxAppKey || '',
    virtualEnv: Number(res.data.virtualEnv || 0),
    virtualProductMap: res.data.virtualProductMap || '',
    virtualCallbackUrl: res.data.virtualCallbackUrl || '',
    mchId: res.data.mchId || '',
    apiV3Key: res.data.apiV3Key || '',
    serialNo: res.data.serialNo || '',
    privateKeyPath: res.data.privateKeyPath || '',
    platformPublicKeyPath: res.data.platformPublicKeyPath || '',
    notifyUrl: res.data.notifyUrl || '',
    transferNotifyUrl: res.data.transferNotifyUrl || '',
  });
  paymentConfigDialogVisible.value = true;
}

async function savePaymentConfig() {
  savingPaymentConfig.value = true;
  try {
    const res = await api.orders.updatePaymentConfig(paymentConfigForm) as any;
    paymentConfig.value = res.data.status;
    paymentConfigDialogVisible.value = false;
    ElMessage.success('微信支付配置已保存');
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败');
  } finally {
    savingPaymentConfig.value = false;
  }
}

onMounted(() => {
  load();
  loadAnalytics();
  loadPaymentConfig();
  loadSettlementOverview();
  loadSyncSettings();
});
</script>

<style lang="scss" scoped>
h2 { margin-bottom: 20px; }
.payment-config-card,
.settlement-card,
.analytics-card { margin-bottom: 16px; }
.payment-config-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.payment-config-title { font-weight: 600; color: #1f2937; }
.payment-config-subtitle { margin-top: 4px; font-size: 13px; color: #6b7280; }
.analytics-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.analytics-title {
  font-weight: 600;
  color: #1f2937;
}
.analytics-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: #6b7280;
}
.analytics-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.analytics-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}
.settlement-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.settlement-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.settlement-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.settlement-item {
  min-height: 112px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;

  span,
  em,
  small {
    display: block;
    color: #6b7280;
    font-size: 12px;
    line-height: 1.4;
    font-style: normal;
  }

  strong {
    display: block;
    margin: 8px 0 4px;
    color: #111827;
    font-size: 20px;
  }

  small {
    margin-top: 6px;
    color: #64748b;
  }
}
.sync-settings-panel {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #e5e7eb;
}
.sync-settings-main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  color: #4b5563;
  font-size: 13px;

  :deep(.el-input-number) {
    width: 112px;
  }
}
.sync-settings-note {
  margin-top: 8px;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.5;
}
.order-device-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: -4px 0 14px;
  color: #4b5563;
  font-size: 13px;
}
.settlement-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;

  span {
    color: #6b7280;
    font-size: 12px;
  }
}
.order-info-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;

  span {
    color: #6b7280;
    font-size: 12px;
    line-height: 1.4;
    word-break: break-all;
  }
}
.order-info-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;

  strong {
    min-width: 0;
    color: #111827;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 13px;
    line-height: 1.4;
    word-break: break-all;
  }

  .el-tag {
    flex: 0 0 auto;
  }
}
.analytics-item {
  min-height: 96px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;

  span,
  em {
    display: block;
    color: #6b7280;
    font-size: 12px;
    line-height: 1.4;
  }

  strong {
    display: block;
    margin: 8px 0 6px;
    color: #111827;
    font-size: 24px;
    line-height: 1.1;
  }

  em {
    font-style: normal;
  }
}
.user-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;

  span {
    color: #6b7280;
    font-size: 12px;
  }
}
.user-main {
  display: flex;
  align-items: center;
  gap: 8px;

  strong {
    color: #111827;
  }
}
.commission-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.commission-summary {
  display: flex;
  align-items: center;
  gap: 8px;

  strong {
    color: #0f766e;
  }

  span {
    color: #6b7280;
    font-size: 12px;
  }
}
.commission-line {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #374151;
  font-size: 12px;

  em {
    color: #6b7280;
    font-style: normal;
  }
}
.muted {
  color: #9ca3af;
}
@media (max-width: 1280px) {
  .analytics-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .settlement-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
