<template>
  <div class="user-detail">
    <h2>用户详情</h2>
    <el-card class="info-card" v-if="user">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="用户ID">{{ user.id }}</el-descriptions-item>
        <el-descriptions-item label="昵称">{{ user.nickname }}</el-descriptions-item>
        <el-descriptions-item label="小程序 OpenID">{{ user.miniOpenId || '--' }}</el-descriptions-item>
        <el-descriptions-item label="公众号 OpenID">{{ user.mpOpenId || '--' }}</el-descriptions-item>
        <el-descriptions-item label="UnionID">{{ user.unionId || '--' }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ user.phone || '--' }}</el-descriptions-item>
        <el-descriptions-item label="点数余额">{{ user.pointsAccount?.balance || 0 }}</el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ new Date(user.createdAt).toLocaleString() }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <h3 style="margin-top: 24px">最近咨询记录</h3>
    <el-table :data="user?.consultationRecords || []" style="width: 100%; margin-top: 12px">
      <el-table-column prop="question" label="问题" min-width="200" show-overflow-tooltip />
      <el-table-column prop="type" label="类型" width="100" />
      <el-table-column prop="pointsCost" label="消耗点数" width="100" />
      <el-table-column prop="model" label="模型" width="140" />
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api';

const route = useRoute();
const user = ref<any>(null);

onMounted(async () => {
  const id = route.params.id as string;
  const res = await api.users.detail(id) as any;
  user.value = res.data;
});
</script>

<style lang="scss" scoped>
.info-card { }
</style>
