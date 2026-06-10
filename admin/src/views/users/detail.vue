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
        <el-descriptions-item label="省份城市">{{ locationLabel(user) }}</el-descriptions-item>
        <el-descriptions-item label="邀请码">{{ user.shareCode || '--' }}</el-descriptions-item>
        <el-descriptions-item label="合作身份">
          <el-tag v-if="user.distributorProfile" :type="user.distributorProfile.level === 1 ? 'success' : 'info'" size="small">
            {{ distributorIdentityLabel(user.distributorProfile) }}
          </el-tag>
          <span v-else>--</span>
        </el-descriptions-item>
        <el-descriptions-item label="邀请人">{{ inviterLabel(user) }}</el-descriptions-item>
        <el-descriptions-item label="点数余额">{{ user.pointsAccount?.balance || 0 }}</el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ new Date(user.createdAt).toLocaleString() }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <h3 style="margin-top: 24px">招募人员</h3>
    <el-table :data="user?.shareReferrals || []" style="width: 100%; margin-top: 12px" empty-text="暂无招募人员">
      <el-table-column label="用户" min-width="220">
        <template #default="{ row }">
          <div class="main-cell">
            <strong>{{ userLabel(row.user) }}</strong>
            <span>{{ row.user?.id || '--' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="sourceCode" label="来源邀请码" width="130">
        <template #default="{ row }">{{ row.sourceCode || '--' }}</template>
      </el-table-column>
      <el-table-column prop="user.phone" label="手机号" width="130">
        <template #default="{ row }">{{ row.user?.phone || '--' }}</template>
      </el-table-column>
      <el-table-column label="合作身份" width="150">
        <template #default="{ row }">
          <span v-if="!row.user?.distributorProfile">--</span>
          <el-tag v-else :type="row.user.distributorProfile.level === 1 ? 'success' : 'info'" size="small">
            {{ row.user.distributorProfile.level === 1 ? '特邀合作伙伴' : '涨识推荐官' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="小程序绑定" width="100">
        <template #default="{ row }">
          <el-tag :type="row.user?.miniOpenId ? 'success' : 'info'" size="small">{{ row.user?.miniOpenId ? '已绑定' : '未绑定' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="公众号绑定" width="100">
        <template #default="{ row }">
          <el-tag :type="row.user?.mpOpenId ? 'success' : 'info'" size="small">{{ row.user?.mpOpenId ? '已绑定' : '未绑定' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="点数余额" width="100">
        <template #default="{ row }">{{ row.user?.pointsAccount?.balance || 0 }}</template>
      </el-table-column>
      <el-table-column label="注册时间" width="170">
        <template #default="{ row }">{{ formatTime(row.user?.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="招募时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
    </el-table>

    <h3 style="margin-top: 24px">智能推荐记录</h3>
    <el-table :data="user?.volunteerReports || []" style="width: 100%; margin-top: 12px" empty-text="暂无智能推荐记录">
      <el-table-column label="报告" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="main-cell">
            <strong>{{ volunteerReportTitle(row) }}</strong>
            <span>{{ row.id }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="考生信息" width="230">
        <template #default="{ row }">
          <div class="main-cell">
            <strong>{{ row.province }} · {{ row.subjectType }}</strong>
            <span>{{ row.year }} 年 / {{ row.score }} 分 / 位次 {{ row.rank || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="偏好与风险" min-width="260">
        <template #default="{ row }">
          <div class="preference-cell">
            <el-tag size="small" type="success">{{ riskPreferenceLabel(parseReportInput(row).riskPreference) }}</el-tag>
            <span>{{ preferenceSummary(parseReportInput(row)) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="pointsCost" label="消耗点数" width="100" />
      <el-table-column label="生成时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="摘要" min-width="320" show-overflow-tooltip>
        <template #default="{ row }">{{ reportSummary(row) }}</template>
      </el-table-column>
    </el-table>

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

function userLabel(row: any) {
  return row?.nickname || row?.phone || row?.shareCode || row?.miniOpenId || row?.id || '--';
}

function inviterLabel(row: any) {
  const referrer = row?.shareReferralRecord?.referrer;
  if (!referrer) return '系统';
  return userLabel(referrer);
}

function locationLabel(row: any) {
  const parts = [row?.province, row?.city].filter(Boolean);
  const uniqueParts = parts.filter((item, index) => parts.indexOf(item) === index);
  return uniqueParts.join(' · ') || '--';
}

function distributorIdentityLabel(profile: any) {
  if (!profile) return '--';
  const level = profile.level === 1 ? '特邀合作伙伴' : '涨识推荐官';
  const statusMap: Record<string, string> = {
    pending: '待审核',
    active: '启用',
    rejected: '已驳回',
    disabled: '禁用',
  };
  return `${level} / ${statusMap[profile.status] || profile.status || '--'}`;
}

function formatTime(value: any) {
  return value ? new Date(value).toLocaleString() : '--';
}

function volunteerReportTitle(row: any) {
  return row?.title || `${row?.province || ''}${row?.subjectType || ''}${row?.score || ''}分志愿分析报告`;
}

function parseReportInput(row: any) {
  if (row?._parsedInput) return row._parsedInput;
  try {
    row._parsedInput = typeof row?.input === 'string' ? JSON.parse(row.input) : (row?.input || {});
  } catch {
    row._parsedInput = {};
  }
  return row._parsedInput;
}

function riskPreferenceLabel(value?: string) {
  const map: Record<string, string> = {
    conservative: '保守',
    balanced: '均衡',
    aggressive: '冲刺',
  };
  return map[value || ''] || '均衡';
}

function preferenceSummary(input: any) {
  const parts = [
    listSummary('城市', input?.preferredCities),
    listSummary('专业', input?.preferredMajors),
    listSummary('避坑', input?.avoidMajors),
  ].filter(Boolean);
  return parts.length ? parts.join('；') : '未填写偏好';
}

function listSummary(label: string, value: any) {
  const list = Array.isArray(value) ? value.filter(Boolean) : [];
  if (!list.length) return '';
  const shown = list.slice(0, 3).join('、');
  return `${label}：${shown}${list.length > 3 ? ` 等${list.length}项` : ''}`;
}

function reportSummary(row: any) {
  return String(row?.markdownReport || '')
    .replace(/[#>*_`-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140) || '--';
}
</script>

<style lang="scss" scoped>
.info-card { }
.main-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.preference-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  line-height: 1.45;

  span:not(.el-tag) {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}
</style>
