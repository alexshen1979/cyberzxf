<template>
  <div class="volunteer-report-page">
    <div class="page-header">
      <div>
        <h2>志愿报告</h2>
        <span class="sub">查看用户生成的 AI 高考志愿分析报告</span>
      </div>
      <span class="header-info">共 {{ total }} 份报告</span>
    </div>

    <el-form class="filters" inline @submit.prevent>
      <el-form-item label="省份">
        <el-input v-model="filters.province" placeholder="如 北京" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="科类">
        <el-input v-model="filters.subjectType" placeholder="如 综合改革" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="search">搜索</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="reports" v-loading="loading" height="calc(100vh - 300px)">
      <el-table-column prop="createdAt" label="生成时间" width="170">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="用户" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.user?.nickname || row.user?.phone || row.userId }}</template>
      </el-table-column>
      <el-table-column label="考生信息" width="210">
        <template #default="{ row }">
          <div class="main-cell">{{ row.province }} · {{ row.subjectType }}</div>
          <div class="cell-sub">{{ row.year }} 年 / {{ row.score }} 分 / 位次 {{ row.rank || '-' }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="pointsCost" label="点数" width="80" />
      <el-table-column prop="markdownReport" label="报告摘要" min-width="420" show-overflow-tooltip />
    </el-table>

    <el-pagination
      v-model:current-page="page"
      :page-size="pageSize"
      :total="total"
      layout="total, prev, pager, next"
      class="pagination"
      @current-change="load"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api } from '@/api';

const filters = reactive({ province: '', subjectType: '' });
const reports = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);

async function load() {
  loading.value = true;
  try {
    const res: any = await api.volunteerReports.list({ ...filters, page: page.value, pageSize });
    reports.value = res.data.list;
    total.value = res.data.total;
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  load();
}

function reset() {
  Object.assign(filters, { province: '', subjectType: '' });
  search();
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString() : '';
}

onMounted(load);
</script>

<style scoped lang="scss">
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h2 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: 650;
  }
}

.sub,
.header-info,
.cell-sub {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;

  :deep(.el-form-item) {
    margin-right: 0;
    margin-bottom: 8px;
  }

  :deep(.el-input) {
    width: 180px;
  }
}

.main-cell {
  font-weight: 600;
}

.pagination {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
