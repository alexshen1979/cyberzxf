<template>
  <div class="points-page">
    <h2>点数管理</h2>

    <el-card class="config-card">
      <template #header>
        <div class="card-head">
          <span>点数规则</span>
          <el-button type="primary" :loading="savingSettings" @click="saveSettings">保存规则</el-button>
        </div>
      </template>
      <el-form :model="settingsForm" label-width="140px" class="settings-form">
        <el-form-item label="新用户赠送">
          <el-input-number v-model="settingsForm.freeGift" :min="0" :max="100000" />
          <span class="hint">注册后自动到账</span>
        </el-form-item>
        <el-form-item label="未登录免费次数">
          <el-input-number v-model="settingsForm.freeAskLimit" :min="0" :max="999" />
          <span class="hint">小程序未登录用户免费提问次数</span>
        </el-form-item>
        <el-form-item label="普通问答扣点">
          <el-input-number v-model="settingsForm.defaultCost" :min="0" :max="10000" />
        </el-form-item>
        <el-form-item label="深度分析扣点">
          <el-input-number v-model="settingsForm.deepAnalysisCost" :min="0" :max="10000" />
        </el-form-item>
        <el-form-item label="志愿分析扣点">
          <el-input-number v-model="settingsForm.volunteerAnalysisCost" :min="0" :max="10000" />
        </el-form-item>
        <el-form-item label="PDF报告导出扣点">
          <el-input-number v-model="settingsForm.volunteerReportPdfCost" :min="0" :max="10000" />
          <span class="hint">建议 3 点，同一报告重复导出不重复扣点</span>
        </el-form-item>
        <el-form-item label="长图报告导出扣点">
          <el-input-number v-model="settingsForm.volunteerReportImageCost" :min="0" :max="10000" />
          <span class="hint">建议 5 点，同一报告重复导出不重复扣点</span>
        </el-form-item>
        <el-form-item label="点数有效期">
          <el-input-number v-model="settingsForm.expireDays" :min="1" :max="3650" />
          <span class="hint">天，充值或新赠点时刷新</span>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="products-card">
      <template #header>
        <div class="card-head">
          <span>充值套餐</span>
          <el-button type="primary" @click="openProductDialog()">新增套餐</el-button>
        </div>
      </template>
      <el-table :data="products" v-loading="productsLoading" style="width: 100%">
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="description" label="描述" min-width="220" show-overflow-tooltip />
        <el-table-column label="折扣价" width="110">
          <template #default="{ row }">¥{{ (row.price / 100).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="原价" width="110">
          <template #default="{ row }">
            <span v-if="row.originalPrice">¥{{ (row.originalPrice / 100).toFixed(2) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="points" label="基础点数" width="100" />
        <el-table-column prop="bonus" label="赠送" width="80" />
        <el-table-column prop="sortOrder" label="排序" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '上架' : '下架' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openProductDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" plain @click="removeProduct(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 用户查询 -->
    <el-card class="query-card">
      <h3>查询用户点数</h3>
      <el-form inline @submit.prevent="lookupUser">
        <el-form-item label="用户ID">
          <el-input v-model="lookupId" placeholder="输入用户ID" style="width: 300px" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="lookupUser" :loading="lookingUp">查询</el-button>
        </el-form-item>
      </el-form>

      <div class="balance-result" v-if="userBalance">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="用户ID">{{ userBalance.userId }}</el-descriptions-item>
          <el-descriptions-item label="昵称">{{ userBalance.nickname || '-' }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ userBalance.phone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="可用点数">
            <span class="balance-num">{{ userBalance.balance }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="冻结点数">{{ userBalance.frozen }}</el-descriptions-item>
          <el-descriptions-item label="过期时间">{{ userBalance.expiredAt ? new Date(userBalance.expiredAt).toLocaleDateString() : '无' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>

    <!-- 点数调整 -->
    <el-card class="adjust-card">
      <h3>手动调整点数</h3>
      <el-form :model="adjustForm" inline @submit.prevent="adjustPoints">
        <el-form-item label="用户ID">
          <el-input v-model="adjustForm.userId" placeholder="输入用户ID" style="width: 300px" />
        </el-form-item>
        <el-form-item label="调整数量">
          <el-input-number v-model="adjustForm.amount" :min="-10000" :max="10000" />
          <span class="hint">正数增加，负数扣减</span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="adjustForm.remark" placeholder="调整原因" style="width: 200px" />
        </el-form-item>
        <el-form-item>
          <el-button type="warning" native-type="submit" :loading="adjusting">确认调整</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog v-model="productDialogVisible" :title="editingProductId ? '编辑套餐' : '新增套餐'" width="640px">
      <el-form :model="productForm" label-width="110px">
        <el-form-item label="套餐 ID" required>
          <el-input v-model="productForm.id" :disabled="!!editingProductId" placeholder="pkg_100" />
        </el-form-item>
        <el-form-item label="名称" required>
          <el-input v-model="productForm.name" placeholder="100 咨询点数" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="productForm.description" type="textarea" :rows="2" placeholder="展示在小程序套餐卡片中" />
        </el-form-item>
        <el-form-item label="折扣价">
          <el-input-number v-model="productForm.priceYuan" :min="0.01" :max="999999" :precision="2" :step="1" />
          <span class="hint">元</span>
        </el-form-item>
        <el-form-item label="原价">
          <el-input-number v-model="productForm.originalPriceYuan" :min="0" :max="999999" :precision="2" :step="1" />
          <span class="hint">元，填 0 则不展示划线价</span>
        </el-form-item>
        <el-form-item label="基础点数">
          <el-input-number v-model="productForm.points" :min="0" :max="10000000" />
        </el-form-item>
        <el-form-item label="赠送点数">
          <el-input-number v-model="productForm.bonus" :min="0" :max="10000000" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="productForm.sortOrder" :min="-100000" :max="100000" />
        </el-form-item>
        <el-form-item label="上架">
          <el-switch v-model="productForm.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="productDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingProduct" @click="saveProduct">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue';
import { api } from '@/api';
import { ElMessage, ElMessageBox } from 'element-plus';

const settingsForm = reactive({
  freeGift: 100,
  freeAskLimit: 3,
  defaultCost: 5,
  deepAnalysisCost: 18,
  volunteerAnalysisCost: 38,
  volunteerReportPdfCost: 3,
  volunteerReportImageCost: 5,
  expireDays: 365,
});
const savingSettings = ref(false);

const products = ref<any[]>([]);
const productsLoading = ref(false);
const productDialogVisible = ref(false);
const savingProduct = ref(false);
const editingProductId = ref('');
const productForm = reactive({
  id: '',
  name: '',
  description: '',
  priceYuan: 0,
  originalPriceYuan: 0,
  points: 0,
  bonus: 0,
  sortOrder: 0,
  enabled: true,
});

const lookupId = ref('');
const lookingUp = ref(false);
const userBalance = ref<any>(null);

const adjusting = ref(false);
const adjustForm = reactive({ userId: '', amount: 0, remark: '' });

async function loadSettings() {
  const res = await api.points.settings() as any;
  Object.assign(settingsForm, res.data);
}

async function saveSettings() {
  savingSettings.value = true;
  try {
    await api.points.updateSettings(settingsForm);
    ElMessage.success('点数规则已保存');
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败');
  } finally {
    savingSettings.value = false;
  }
}

async function loadProducts() {
  productsLoading.value = true;
  try {
    const res = await api.points.products({ includeDisabled: true }) as any;
    products.value = res.data;
  } finally {
    productsLoading.value = false;
  }
}

function openProductDialog(row?: any) {
  editingProductId.value = row?.id || '';
  Object.assign(productForm, row ? {
    id: row.id,
    name: row.name,
    description: row.description || '',
    priceYuan: Number((row.price / 100).toFixed(2)),
    originalPriceYuan: row.originalPrice ? Number((row.originalPrice / 100).toFixed(2)) : 0,
    points: row.points,
    bonus: row.bonus,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
  } : {
    id: '',
    name: '',
    description: '',
    priceYuan: 0,
    originalPriceYuan: 0,
    points: 0,
    bonus: 0,
    sortOrder: 0,
    enabled: true,
  });
  productDialogVisible.value = true;
}

async function saveProduct() {
  savingProduct.value = true;
  try {
    const payload = {
      id: productForm.id,
      name: productForm.name,
      description: productForm.description,
      price: Math.round(Number(productForm.priceYuan) * 100),
      originalPrice: Number(productForm.originalPriceYuan) > 0
        ? Math.round(Number(productForm.originalPriceYuan) * 100)
        : null,
      points: productForm.points,
      bonus: productForm.bonus,
      sortOrder: productForm.sortOrder,
      enabled: productForm.enabled,
    };
    if (editingProductId.value) {
      await api.points.updateProduct(editingProductId.value, payload);
    } else {
      await api.points.createProduct(payload);
    }
    productDialogVisible.value = false;
    ElMessage.success('套餐已保存');
    loadProducts();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败');
  } finally {
    savingProduct.value = false;
  }
}

async function removeProduct(row: any) {
  await ElMessageBox.confirm(`确认删除或下架「${row.name}」？`, '提示', { type: 'warning' });
  await api.points.deleteProduct(row.id);
  ElMessage.success('已处理');
  loadProducts();
}

async function lookupUser() {
  if (!lookupId.value.trim()) {
    ElMessage.warning('请输入用户ID');
    return;
  }
  lookingUp.value = true;
  try {
    const ptsRes = await api.points.getUser(lookupId.value.trim()) as any;
    const userRes = await api.users.detail(lookupId.value.trim()) as any;
    userBalance.value = {
      userId: lookupId.value.trim(),
      nickname: userRes.data?.nickname,
      phone: userRes.data?.phone,
      ...ptsRes.data,
    };
    adjustForm.userId = lookupId.value.trim();
  } catch (e: any) {
    userBalance.value = null;
    ElMessage.error(e.response?.data?.message || '用户不存在');
  } finally {
    lookingUp.value = false;
  }
}

async function adjustPoints() {
  if (!adjustForm.userId || adjustForm.amount === 0) {
    ElMessage.warning('请填写用户ID和调整数量');
    return;
  }
  adjusting.value = true;
  try {
    await api.points.adjust(adjustForm);
    ElMessage.success('点数调整成功');
    // 刷新余额显示
    if (userBalance.value?.userId === adjustForm.userId) {
      lookupUser();
    }
    adjustForm.amount = 0;
    adjustForm.remark = '';
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '调整失败');
  } finally {
    adjusting.value = false;
  }
}

onMounted(() => {
  loadSettings();
  loadProducts();
});
</script>

<style lang="scss" scoped>
h2 { margin-bottom: 20px; }
h3 { margin-bottom: 16px; }
.config-card, .products-card, .query-card, .adjust-card { margin-bottom: 20px; }
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.settings-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 24px;
}
.balance-result { margin-top: 16px; }
.balance-num { font-weight: 700; font-size: 18px; color: var(--el-color-primary); }
.hint { font-size: 12px; margin-left: 8px; }
</style>
