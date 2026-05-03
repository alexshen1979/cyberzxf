<template>
  <div class="points-page">
    <h2>点数管理</h2>
    <el-card class="adjust-card">
      <h3>手动调整点数</h3>
      <el-form :model="adjustForm" inline @submit.prevent="adjustPoints">
        <el-form-item label="用户ID"><el-input v-model="adjustForm.userId" placeholder="输入用户ID" style="width: 300px" /></el-form-item>
        <el-form-item label="调整数量"><el-input-number v-model="adjustForm.amount" :min="-1000" :max="1000" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="adjustForm.remark" placeholder="调整原因" style="width: 200px" /></el-form-item>
        <el-form-item><el-button type="primary" native-type="submit" :loading="adjusting">确认调整</el-button></el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { api } from '@/api';
import { ElMessage } from 'element-plus';

const adjusting = ref(false);
const adjustForm = reactive({ userId: '', amount: 0, remark: '' });

async function adjustPoints() {
  if (!adjustForm.userId || adjustForm.amount === 0) {
    ElMessage.warning('请填写用户ID和调整数量');
    return;
  }
  adjusting.value = true;
  try {
    await api.points.adjust(adjustForm);
    ElMessage.success('点数调整成功');
    adjustForm.userId = '';
    adjustForm.amount = 0;
    adjustForm.remark = '';
  } catch (e: any) { ElMessage.error(e.message); }
  finally { adjusting.value = false; }
}
</script>

<style lang="scss" scoped>
h2, h3 { color: #e8eaf0; }
.adjust-card { background: #1a1f4a; border-color: #1e2550; }
</style>
