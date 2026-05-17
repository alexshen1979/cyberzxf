<template>
  <div class="users-page">
    <h2>用户管理</h2>
    <div class="search-bar">
      <el-input v-model="keyword" placeholder="搜索昵称/OpenID" style="width: 300px" clearable @change="load" />
    </div>
    <el-table :data="users" style="width: 100%" v-loading="loading">
      <el-table-column prop="nickname" label="昵称" min-width="120" />
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
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="$router.push(`/users/${row.id}`)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination v-model:current-page="page" :total="total" :page-size="pageSize" layout="prev, pager, next" @current-change="load" style="margin-top: 16px; justify-content: center" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '@/api';

const users = ref([]);
const loading = ref(false);
const page = ref(1);
const total = ref(0);
const pageSize = 20;
const keyword = ref('');

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

onMounted(load);
</script>

<style lang="scss" scoped>
h2 { margin-bottom: 20px; }
.search-bar { margin-bottom: 16px; }
</style>
