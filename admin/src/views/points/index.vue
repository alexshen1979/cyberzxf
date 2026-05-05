<template>
  <div class="points-page">
    <h2>点数管理</h2>

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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { api } from '@/api';
import { ElMessage } from 'element-plus';

const lookupId = ref('');
const lookingUp = ref(false);
const userBalance = ref<any>(null);

const adjusting = ref(false);
const adjustForm = reactive({ userId: '', amount: 0, remark: '' });

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
</script>

<style lang="scss" scoped>
h2 { color: #e8eaf0; margin-bottom: 20px; }
h3 { color: #e8eaf0; margin-bottom: 16px; }
.query-card, .adjust-card { background: #1a1f4a; border-color: #1e2550; margin-bottom: 20px; }
.balance-result { margin-top: 16px; }
.balance-num { font-weight: 700; font-size: 18px; color: #00f5ff; }
.hint { font-size: 12px; color: #8890b0; margin-left: 8px; }
</style>
