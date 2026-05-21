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
    <el-radio-group v-model="statusFilter" @change="load" style="margin-bottom: 16px">
      <el-radio-button value="">全部</el-radio-button>
      <el-radio-button value="pending">待支付</el-radio-button>
      <el-radio-button value="paid">已支付</el-radio-button>
      <el-radio-button value="refunded">已退款</el-radio-button>
    </el-radio-group>
    <el-table :data="orders" style="width: 100%" v-loading="loading">
      <el-table-column prop="orderNo" label="订单号" width="180" />
      <el-table-column prop="transactionId" label="微信交易号" min-width="220" show-overflow-tooltip />
      <el-table-column prop="productName" label="套餐" min-width="200" />
      <el-table-column label="金额" width="100">
        <template #default="{ row }">¥{{ (row.amount / 100).toFixed(2) }}</template>
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
      <el-table-column label="状态" width="80">
        <template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag></template>
      </el-table-column>
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
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
      </el-form>
      <template #footer>
        <el-button @click="paymentConfigDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingPaymentConfig" @click="savePaymentConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { api } from '@/api';
import { ElMessage } from 'element-plus';

const orders = ref([]);
const loading = ref(false);
const statusFilter = ref('');
const paymentConfig = ref<{ ready: boolean; missing: string[] } | null>(null);
const paymentConfigDialogVisible = ref(false);
const savingPaymentConfig = ref(false);
const paymentConfigForm = reactive({
  miniAppId: '',
  miniSecret: '',
  mchId: '',
  apiV3Key: '',
  serialNo: '',
  privateKeyPath: '',
  platformPublicKeyPath: '',
  notifyUrl: '',
});

function statusType(s: string) {
  const map: Record<string, string> = { paid: 'success', pending: 'warning', refunded: 'info', closed: 'danger' };
  return map[s] || 'info';
}

function roleLabel(role: string) {
  if (role === 'level1_direct') return '直接推荐奖励';
  if (role === 'level2_direct') return '推荐奖励';
  if (role === 'level1_override') return '合作伙伴奖励';
  return role || '-';
}

function commissionTotal(row: any) {
  return (row.distributionCommissions || []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
}

function formatMoney(value: number) {
  return `¥${(Number(value || 0) / 100).toFixed(2)}`;
}

async function load() {
  loading.value = true;
  try {
    const res = await api.orders.list({ status: statusFilter.value }) as any;
    orders.value = res.data.list;
  } finally { loading.value = false; }
}

async function loadPaymentConfig() {
  const res = await api.orders.paymentConfigStatus() as any;
  paymentConfig.value = res.data;
}

async function openPaymentConfig() {
  const res = await api.orders.paymentConfig() as any;
  Object.assign(paymentConfigForm, {
    miniAppId: res.data.miniAppId || '',
    miniSecret: res.data.miniSecret || '',
    mchId: res.data.mchId || '',
    apiV3Key: res.data.apiV3Key || '',
    serialNo: res.data.serialNo || '',
    privateKeyPath: res.data.privateKeyPath || '',
    platformPublicKeyPath: res.data.platformPublicKeyPath || '',
    notifyUrl: res.data.notifyUrl || '',
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
  loadPaymentConfig();
});
</script>

<style lang="scss" scoped>
h2 { margin-bottom: 20px; }
.payment-config-card { margin-bottom: 16px; }
.payment-config-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.payment-config-title { font-weight: 600; color: #1f2937; }
.payment-config-subtitle { margin-top: 4px; font-size: 13px; color: #6b7280; }
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
</style>
