<template>
  <div class="distribution-page">
    <h2>{{ pageTitle }}</h2>

    <div v-if="activeSection === 'overview'" class="stat-overview">
      <el-card class="stat-card people-stat-card">
        <div class="stat-card-head">
          <span class="stat-label">合作人员</span>
          <span class="stat-note">特邀合作伙伴 + 涨识推荐官</span>
        </div>
        <strong>{{ dashboard.distributorCount || 0 }}</strong>
        <div class="people-breakdown">
          <div>
            <span>特邀合作伙伴</span>
            <strong>{{ dashboard.level1Count || 0 }}</strong>
          </div>
          <span class="people-plus">+</span>
          <div>
            <span>涨识推荐官</span>
            <strong>{{ dashboard.level2Count || 0 }}</strong>
          </div>
        </div>
        <div class="people-breakdown compact">
          <div>
            <span>总代</span>
            <strong>{{ dashboard.generalAgentCount || 0 }}</strong>
          </div>
          <span class="people-plus">/</span>
          <div>
            <span>总代佣金</span>
            <strong>{{ formatMoney(dashboard.generalAgentCommissionAmount || 0) }}</strong>
          </div>
        </div>
      </el-card>
      <el-card v-for="item in metricCards" :key="item.label" class="stat-card">
        <div class="stat-card-head">
          <span class="stat-label">{{ item.label }}</span>
          <el-tooltip v-if="item.tip" :content="item.tip" placement="top">
            <el-icon class="stat-help"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
        <strong>{{ item.value }}</strong>
        <span v-if="item.note" class="stat-note">{{ item.note }}</span>
      </el-card>
    </div>

    <el-card v-if="activeSection === 'overview'" class="panel-card">
      <template #header>
        <div class="card-head">
          <span>推荐奖励规则</span>
          <el-button type="primary" :loading="savingSettings" @click="saveSettings">保存规则</el-button>
        </div>
      </template>
      <el-form :model="settingsForm" inline class="settings-form">
        <el-form-item label="启用推荐合作">
          <el-switch v-model="settingsForm.enabled" />
        </el-form-item>
        <el-form-item label="特邀总比例">
          <el-input-number v-model="settingsForm.level1Percent" :min="0" :max="100" :precision="2" :step="1" />
          <span class="hint">%</span>
        </el-form-item>
        <el-form-item label="推荐官比例">
          <el-input-number v-model="settingsForm.level2Percent" :min="0" :max="100" :precision="2" :step="1" />
          <span class="hint">%</span>
        </el-form-item>
        <el-form-item label="启用复充奖励">
          <el-switch v-model="settingsForm.recurringCommissionEnabled" />
        </el-form-item>
        <el-form-item label="复充特邀总比例">
          <el-input-number v-model="settingsForm.recurringLevel1Percent" :min="0" :max="100" :precision="2" :step="0.5" />
          <span class="hint">%</span>
        </el-form-item>
        <el-form-item label="复充推荐官比例">
          <el-input-number v-model="settingsForm.recurringLevel2Percent" :min="0" :max="100" :precision="2" :step="0.5" />
          <span class="hint">%</span>
        </el-form-item>
        <el-form-item label="复充有效期">
          <el-input-number v-model="settingsForm.recurringCommissionDays" :min="0" :max="730" :precision="0" :step="30" />
          <span class="hint">天</span>
        </el-form-item>
        <el-form-item label="每日分享赠点">
          <el-input-number v-model="settingsForm.dailyShareReward" :min="0" :max="100000" :precision="0" :step="1" />
          <span class="hint">点，每人每天最多一次</span>
        </el-form-item>
        <el-form-item label="好友注册奖励">
          <el-input-number v-model="settingsForm.referralReward" :min="0" :max="100000" :precision="0" :step="1" />
          <span class="hint">点，好友通过邀请码注册后赠送给邀请人</span>
        </el-form-item>
        <el-form-item label="最低提现">
          <el-input-number v-model="settingsForm.minWithdrawalYuan" :min="1" :max="10000" :precision="2" :step="1" />
          <span class="hint">元</span>
        </el-form-item>
        <el-form-item label="冻结天数">
          <el-input-number v-model="settingsForm.withdrawalFreezeDays" :min="0" :max="90" :precision="0" :step="1" />
          <span class="hint">天</span>
        </el-form-item>
        <div class="transfer-rule-box">
          <div class="transfer-rule-head">
            <span>商家转账规则</span>
            <span>按微信支付商家转账场景限制提现额度</span>
          </div>
          <div class="transfer-rule-form">
            <el-form-item label="转账场景">
              <el-input v-model="settingsForm.transferSceneName" style="width: 120px" />
              <span class="hint">ID</span>
              <el-input v-model="settingsForm.transferSceneId" style="width: 92px" />
            </el-form-item>
            <el-form-item label="单日转账额度">
              <el-input-number v-model="settingsForm.transferDailyLimitYuan" :min="0.1" :max="50000" :precision="2" :step="1000" />
              <span class="hint">元</span>
            </el-form-item>
            <el-form-item label="单笔转账额度">
              <el-input-number v-model="settingsForm.transferSingleMinYuan" :min="0.1" :max="200" :precision="2" :step="0.1" />
              <span class="hint">至</span>
              <el-input-number v-model="settingsForm.transferSingleMaxYuan" :min="0.1" :max="200" :precision="2" :step="10" />
              <span class="hint">元</span>
            </el-form-item>
            <el-form-item label="单日单用户额度">
              <el-input-number v-model="settingsForm.transferUserDailyLimitYuan" :min="0.1" :max="2000" :precision="2" :step="100" />
              <span class="hint">元</span>
            </el-form-item>
            <el-form-item label="用户确认收款">
              <el-switch v-model="settingsForm.transferUserConfirm" />
              <span class="hint">开启后小程序需调起微信确认收款</span>
            </el-form-item>
            <el-form-item label="岗位类型">
              <el-input v-model="settingsForm.transferReportJobType" style="width: 180px" />
            </el-form-item>
            <el-form-item label="报酬说明">
              <el-input v-model="settingsForm.transferReportRewardDesc" style="width: 260px" />
            </el-form-item>
            <el-form-item label="转账回调地址">
              <el-input v-model="settingsForm.transferNotifyUrl" style="width: 420px" placeholder="留空则使用支付配置里的商家转账回调地址" />
            </el-form-item>
          </div>
          <span class="hint">当前官方规则：佣金报酬(ID=1005)，单笔 ¥0.10 ~ ¥200.00，单日 ¥50,000.00，单日向单用户 ¥2,000.00。</span>
        </div>
        <span class="formula">首充：推荐官拿 {{ settingsForm.level2Percent }}%，所属特邀合作伙伴拿 {{ Math.max(0, settingsForm.level1Percent - settingsForm.level2Percent).toFixed(2) }}%。复充：{{ settingsForm.recurringCommissionEnabled ? `推荐官拿 ${settingsForm.recurringLevel2Percent}%，所属特邀合作伙伴拿 ${Math.max(0, settingsForm.recurringLevel1Percent - settingsForm.recurringLevel2Percent).toFixed(2)}%，限 ${settingsForm.recurringCommissionDays} 天内` : '未启用' }}</span>
      </el-form>
    </el-card>

    <el-card v-if="activeSection === 'distributors'" class="panel-card">
      <template #header>
        <div class="card-head">
          <span>合作人员</span>
          <el-button type="primary" @click="openDistributorDialog()">新增/绑定用户</el-button>
        </div>
      </template>
      <div class="toolbar">
        <el-input v-model="filters.keyword" placeholder="搜索昵称/手机号/邀请码" clearable style="width: 260px" @change="loadDistributors" />
        <el-select v-model="filters.level" placeholder="身份类型" clearable style="width: 150px" @change="loadDistributors">
          <el-option label="特邀合作伙伴" :value="1" />
          <el-option label="涨识推荐官" :value="2" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 130px" @change="loadDistributors">
          <el-option label="待审核" value="pending" />
          <el-option label="启用" value="active" />
          <el-option label="已驳回" value="rejected" />
          <el-option label="禁用" value="disabled" />
        </el-select>
        <el-select v-if="store.isFullAdmin" v-model="filters.generalAgent" placeholder="总代关系" clearable style="width: 130px" @change="loadDistributors">
          <el-option label="总代" value="agent" />
          <el-option label="归属总代" value="child" />
        </el-select>
        <el-button @click="loadDistributors">刷新</el-button>
      </div>

      <el-table :data="distributors" v-loading="loadingDistributors" row-key="id" style="width: 100%">
        <el-table-column type="expand" width="48">
          <template #default="{ row }">
            <div v-if="store.isFullAdmin && row.isGeneralAgent" class="child-table-wrap">
              <div class="child-title">{{ row.name }} 招募的合伙人</div>
              <el-table :data="row.generalAgentChildren || []" size="small" empty-text="暂无下级合伙人">
                <el-table-column label="合伙人" min-width="180">
                  <template #default="{ row: child }">
                    <div class="main-cell">
                      <strong>{{ child.name }}</strong>
                      <span>{{ child.user?.nickname || child.user?.phone || child.userId || '-' }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="code" label="邀请码" width="130" />
                <el-table-column label="推荐官" width="100">
                  <template #default="{ row: child }">{{ child._count?.children || 0 }}</template>
                </el-table-column>
                <el-table-column label="合作推荐用户" width="120">
                  <template #default="{ row: child }">{{ child._count?.referrals || 0 }}</template>
                </el-table-column>
                <el-table-column label="状态" width="90">
                  <template #default="{ row: child }">
                    <el-tag :type="statusTagType(child.status)" size="small">{{ statusLabel(child.status) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="130" fixed="right">
                  <template #default="{ row: child }">
                    <el-button type="primary" link @click="openDistributorDialog(child)">编辑</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div class="child-table-wrap">
              <div class="child-title">{{ row.name }} 的推荐官</div>
              <el-table :data="row.children || []" size="small" empty-text="暂无推荐官">
                <el-table-column label="推荐官" min-width="180">
                  <template #default="{ row: child }">
                    <div class="main-cell">
                      <strong>{{ child.name }}</strong>
                      <span>{{ child.user?.nickname || child.user?.phone || child.userId || '-' }}</span>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="code" label="邀请码" width="130" />
                <el-table-column label="合作推荐用户" width="120">
                  <template #default="{ row: child }">{{ child._count?.referrals || 0 }}</template>
                </el-table-column>
                <el-table-column label="奖励单" width="90">
                  <template #default="{ row: child }">{{ child._count?.commissions || 0 }}</template>
                </el-table-column>
                <el-table-column label="状态" width="90">
                  <template #default="{ row: child }">
                    <el-tag :type="statusTagType(child.status)" size="small">{{ statusLabel(child.status) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="创建时间" width="170">
                  <template #default="{ row: child }">{{ formatTime(child.createdAt) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="230" fixed="right">
                  <template #default="{ row: child }">
                    <el-button v-if="child.status === 'pending'" type="success" link @click="reviewDistributor(child, 'active')">通过</el-button>
                    <el-button v-if="child.status === 'pending'" type="danger" link @click="reviewDistributor(child, 'rejected')">驳回</el-button>
                    <el-button v-if="store.isFullAdmin" type="primary" link @click="openLedgerDialog(child)">流水</el-button>
                    <el-button type="primary" link @click="openDistributorDialog(child)">编辑</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="合作人员" min-width="180">
          <template #default="{ row }">
            <div class="main-cell">
              <strong>{{ row.name }}</strong>
              <span>{{ row.isGroup ? '系统分组' : (row.user?.nickname || row.user?.phone || row.userId || '-') }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="code" label="邀请码" width="130" />
        <el-table-column label="身份类型" width="140">
          <template #default="{ row }">
            <div class="tag-stack">
              <el-tag :type="row.isGroup ? 'warning' : 'success'" size="small">{{ row.isGroup ? '分组' : levelLabel(row.level) }}</el-tag>
              <el-tag v-if="store.isFullAdmin && row.isGeneralAgent" type="danger" size="small">总代 {{ percentLabel(row.generalAgentRate) }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="所属关系" min-width="180">
          <template #default="{ row }">
            <div class="main-cell">
              <span v-if="row.parent">{{ row.parent.name }}（合伙人）</span>
              <span v-if="store.isFullAdmin && row.generalAgentParent">{{ row.generalAgentParent.name }}（总代）</span>
              <span v-if="!row.parent && (!store.isFullAdmin || !row.generalAgentParent)">--</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="合作推荐用户" width="120">
          <template #default="{ row }">{{ row._count?.referrals || 0 }}</template>
        </el-table-column>
        <el-table-column label="推荐官" width="100">
          <template #default="{ row }">{{ row._count?.children || 0 }}</template>
        </el-table-column>
        <el-table-column label="奖励单" width="90">
          <template #default="{ row }">{{ row._count?.commissions || 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag v-if="!row.isGroup" :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
            <span v-else>--</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <template v-if="!row.isGroup">
              <el-button v-if="row.status === 'pending'" type="success" link @click="reviewDistributor(row, 'active')">通过</el-button>
              <el-button v-if="row.status === 'pending'" type="danger" link @click="reviewDistributor(row, 'rejected')">驳回</el-button>
              <el-button v-if="store.isFullAdmin" type="primary" link @click="openLedgerDialog(row)">流水</el-button>
              <el-button type="primary" link @click="openDistributorDialog(row)">编辑</el-button>
            </template>
            <span v-else>--</span>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        :total="total"
        :page-size="pageSize"
        layout="prev, pager, next"
        @current-change="loadDistributors"
        class="pager"
      />
    </el-card>

    <el-card v-if="activeSection === 'generalAgentCommissions'" class="panel-card">
      <template #header>
        <div class="card-head">
          <span>总代佣金</span>
          <div class="head-actions">
            <el-select v-model="generalAgentFilter" placeholder="总代" clearable filterable style="width: 220px" @change="loadGeneralAgentCommissions">
              <el-option v-for="item in generalAgentOptions" :key="item.id" :label="`${item.name}（${item.code}）`" :value="item.id" />
            </el-select>
            <el-select v-model="generalAgentStatusFilter" placeholder="状态" clearable style="width: 130px" @change="loadGeneralAgentCommissions">
              <el-option label="待线下结算" value="pending" />
              <el-option label="已线下结算" value="paid" />
            </el-select>
            <el-button @click="loadGeneralAgentCommissions">刷新</el-button>
          </div>
        </div>
      </template>
      <div class="agent-summary" v-if="generalAgentSummary">
        <div><span>下级合伙人</span><strong>{{ generalAgentSummary.childPartnerCount || 0 }}</strong></div>
        <div><span>下级推荐官</span><strong>{{ generalAgentSummary.childReferralOfficerCount || 0 }}</strong></div>
        <div><span>佣金总额</span><strong>{{ formatMoney(generalAgentSummary.commissionAmount || 0) }}</strong></div>
        <div><span>待线下结算</span><strong>{{ formatMoney(generalAgentSummary.pendingAmount || 0) }}</strong></div>
        <div><span>已线下结算</span><strong>{{ formatMoney(generalAgentSummary.paidAmount || 0) }}</strong></div>
      </div>
      <el-table :data="generalAgentCommissions" v-loading="loadingGeneralAgentCommissions" style="width: 100%" empty-text="暂无总代佣金">
        <el-table-column label="总代" min-width="150">
          <template #default="{ row }">{{ row.generalAgent?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="来源合伙人" min-width="150">
          <template #default="{ row }">{{ row.sourceDistributor?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="直接来源" min-width="150">
          <template #default="{ row }">{{ row.directDistributor?.name || row.sourceDistributor?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="充值用户" min-width="150">
          <template #default="{ row }">{{ row.referralUser?.nickname || row.referralUser?.phone || row.referralUserId }}</template>
        </el-table-column>
        <el-table-column label="订单" min-width="210">
          <template #default="{ row }">
            <div class="main-cell">
              <strong>{{ row.order?.productName || '-' }}</strong>
              <span>{{ row.order?.orderNo || row.orderId }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="订单金额" width="110">
          <template #default="{ row }">{{ formatMoney(row.order?.amount || 0) }}</template>
        </el-table-column>
        <el-table-column label="比例" width="90">
          <template #default="{ row }">{{ percentLabel(row.rateBps) }}</template>
        </el-table-column>
        <el-table-column label="总代佣金" width="110">
          <template #default="{ row }"><strong>{{ formatMoney(row.amount) }}</strong></template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'paid' ? 'success' : 'warning'" size="small">{{ row.status === 'paid' ? '已线下结算' : '待线下结算' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status !== 'paid'" type="success" link @click="markGeneralAgentCommission(row, 'paid')">标记已结算</el-button>
            <el-button v-else type="warning" link @click="markGeneralAgentCommission(row, 'pending')">撤回结算</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="generalAgentCommissionPage"
        :total="generalAgentCommissionTotal"
        :page-size="generalAgentCommissionPageSize"
        layout="prev, pager, next"
        @current-change="loadGeneralAgentCommissions"
        class="pager"
      />
    </el-card>

    <el-card v-if="activeSection === 'commissions'" class="panel-card">
      <template #header>
        <div class="card-head">
          <span>推荐奖励流水</span>
          <div class="head-actions">
            <el-button @click="loadCommissions">刷新</el-button>
          </div>
        </div>
      </template>
      <el-table :data="commissions" v-loading="loadingCommissions" style="width: 100%">
        <el-table-column label="合作人员" min-width="160">
          <template #default="{ row }">{{ row.distributor?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="奖励类型" width="130">
          <template #default="{ row }">{{ roleLabel(row.role) }}</template>
        </el-table-column>
        <el-table-column label="被推荐用户" min-width="150">
          <template #default="{ row }">{{ row.referralUser?.nickname || row.referralUser?.phone || row.referralUserId }}</template>
        </el-table-column>
        <el-table-column label="订单" min-width="210">
          <template #default="{ row }">
            <div class="main-cell">
              <strong>{{ row.order?.productName || '-' }}</strong>
              <span>{{ row.order?.orderNo || row.orderId }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="订单金额" width="110">
          <template #default="{ row }">{{ formatMoney(row.order?.amount || 0) }}</template>
        </el-table-column>
        <el-table-column label="比例" width="90">
          <template #default="{ row }">{{ (row.rateBps / 100).toFixed(2) }}%</template>
        </el-table-column>
        <el-table-column label="奖励金额" width="110">
          <template #default="{ row }">
            <strong>{{ formatMoney(row.amount) }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="commissionPage"
        :total="commissionTotal"
        :page-size="commissionPageSize"
        layout="prev, pager, next"
        @current-change="loadCommissions"
        class="pager"
      />
    </el-card>

    <el-card v-if="activeSection === 'withdrawals'" class="panel-card">
      <template #header>
        <div class="card-head">
          <span>提现申请</span>
          <div class="head-actions">
            <el-select v-model="withdrawalStatusFilter" placeholder="状态" clearable style="width: 140px" @change="loadWithdrawals">
              <el-option label="待审核" value="pending" />
              <el-option label="已通过" value="approved" />
              <el-option label="转账中" value="transferring" />
              <el-option label="待用户确认" value="wait_user_confirm" />
              <el-option label="已打款" value="paid" />
              <el-option label="已驳回" value="rejected" />
              <el-option label="打款失败" value="failed" />
            </el-select>
            <el-button @click="loadWithdrawals">刷新</el-button>
          </div>
        </div>
      </template>
      <el-table :data="withdrawals" v-loading="loadingWithdrawals" style="width: 100%" empty-text="暂无提现申请">
        <el-table-column prop="withdrawalNo" label="提现单号" width="170" />
        <el-table-column label="合作人员" min-width="160">
          <template #default="{ row }">
            <div class="main-cell">
              <strong>{{ row.distributor?.name || '-' }}</strong>
              <span>{{ row.distributor?.code || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="110">
          <template #default="{ row }">
            <strong>{{ formatMoney(row.amount) }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="withdrawalTagType(row.status)" size="small">{{ withdrawalStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="adminRemark" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column label="微信转账" min-width="210">
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.transferState || '-' }}</span>
              <span v-if="row.outBillNo">商户单号：{{ row.outBillNo }}</span>
              <span v-if="row.wechatTransferBillNo">微信单号：{{ row.wechatTransferBillNo }}</span>
              <span v-if="row.transferFailReason">失败：{{ row.transferFailReason }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="170">
          <template #default="{ row }">{{ formatTime(row.requestedAt || row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'pending'" type="success" link @click="reviewWithdrawal(row, 'approved')">通过</el-button>
            <el-button v-if="row.status === 'pending'" type="danger" link @click="reviewWithdrawal(row, 'rejected')">驳回</el-button>
            <el-button v-if="canStartWechatTransfer(row)" type="primary" link @click="startWechatTransfer(row)">微信转账</el-button>
            <el-button v-if="row.outBillNo" type="info" link @click="queryWechatTransfer(row)">查询</el-button>
            <el-button v-if="row.status === 'approved' || row.status === 'pending' || row.status === 'failed'" type="primary" link @click="reviewWithdrawal(row, 'paid')">人工已打款</el-button>
            <el-button v-if="row.status === 'approved' || row.status === 'transferring' || row.status === 'wait_user_confirm'" type="warning" link @click="reviewWithdrawal(row, 'failed')">打款失败</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="withdrawalPage"
        :total="withdrawalTotal"
        :page-size="withdrawalPageSize"
        layout="prev, pager, next"
        @current-change="loadWithdrawals"
        class="pager"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :title="distributorForm.id ? '编辑合作人员' : '新增合作人员'" width="620px">
      <el-form :model="distributorForm" label-width="110px">
        <el-form-item label="用户 ID" required>
          <el-input v-model="distributorForm.userId" :disabled="!!distributorForm.id" placeholder="填写用户 ID，系统会绑定为合作人员" />
        </el-form-item>
        <el-form-item label="展示名称">
          <el-input v-model="distributorForm.name" placeholder="默认使用用户昵称或手机号" />
        </el-form-item>
        <el-form-item label="身份类型">
          <el-radio-group v-model="distributorForm.level">
            <el-radio-button :label="1">特邀合作伙伴</el-radio-button>
            <el-radio-button :label="2">涨识推荐官</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="distributorForm.level === 2" label="所属特邀伙伴">
          <el-select v-model="distributorForm.parentId" placeholder="默认系统" filterable style="width: 100%">
            <el-option v-for="item in levelOneOptions" :key="item.id" :label="`${item.name}（${item.code}）`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="distributorForm.level === 1" label="新用户额外赠点">
          <el-input-number v-model="distributorForm.newUserGiftOverride" :min="0" :max="100000" :precision="0" :step="1" />
          <span class="hint">留空或 0 表示不额外赠送；设置后，通过该特邀伙伴及其推荐官注册或绑定邀请码的新用户，会在系统默认赠点之外再获得该点数</span>
        </el-form-item>
        <template v-if="distributorForm.level === 1 && store.isFullAdmin">
          <el-form-item label="总代">
            <el-switch v-model="distributorForm.isGeneralAgent" />
            <span class="hint">只有合伙人可设为总代；小程序端不会展示总代概念</span>
          </el-form-item>
          <el-form-item v-if="distributorForm.isGeneralAgent" label="总代提成比例">
            <el-input-number v-model="distributorForm.generalAgentPercent" :min="0" :max="100" :precision="2" :step="1" />
            <span class="hint">%，默认 20%，按下级相关订单总额额外计算</span>
          </el-form-item>
          <el-form-item v-if="!distributorForm.isGeneralAgent" label="所属总代">
            <el-select v-model="distributorForm.generalAgentParentId" placeholder="不归属总代" clearable filterable style="width: 100%">
              <el-option v-for="item in generalAgentOptions" :key="item.id" :label="`${item.name}（${item.code}，${percentLabel(item.generalAgentRate)}）`" :value="item.id" />
            </el-select>
          </el-form-item>
        </template>
        <el-form-item label="状态">
          <el-select v-model="distributorForm.status" style="width: 100%">
            <el-option label="待审核" value="pending" />
            <el-option label="启用" value="active" />
            <el-option label="已驳回" value="rejected" />
            <el-option label="禁用" value="disabled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingDistributor" @click="saveDistributor">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="ledgerDialogVisible" :title="`${ledgerDistributor?.name || ''} 流水`" width="980px">
      <div v-if="ledgerDistributor" class="ledger-summary">
        <div>
          <span>邀请码</span>
          <strong>{{ ledgerDistributor.code }}</strong>
        </div>
        <div>
          <span>身份类型</span>
          <strong>{{ levelLabel(ledgerDistributor.level) }}</strong>
        </div>
        <div>
          <span>用户</span>
          <strong>{{ ledgerDistributor.user?.nickname || ledgerDistributor.user?.phone || ledgerDistributor.userId || '-' }}</strong>
        </div>
      </div>

      <el-tabs v-model="ledgerActiveTab">
        <el-tab-pane label="奖励流水" name="commissions">
          <el-table :data="ledgerCommissions" v-loading="loadingLedgerCommissions" style="width: 100%" empty-text="暂无奖励流水">
            <el-table-column label="奖励类型" width="120">
              <template #default="{ row }">{{ roleLabel(row.role) }}</template>
            </el-table-column>
            <el-table-column label="被推荐用户" min-width="150">
              <template #default="{ row }">{{ row.referralUser?.nickname || row.referralUser?.phone || row.referralUserId }}</template>
            </el-table-column>
            <el-table-column label="订单" min-width="210">
              <template #default="{ row }">
                <div class="main-cell">
                  <strong>{{ row.order?.productName || '-' }}</strong>
                  <span>{{ row.order?.orderNo || row.orderId }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="订单金额" width="110">
              <template #default="{ row }">{{ formatMoney(row.order?.amount || 0) }}</template>
            </el-table-column>
            <el-table-column label="比例" width="90">
              <template #default="{ row }">{{ (row.rateBps / 100).toFixed(2) }}%</template>
            </el-table-column>
            <el-table-column label="奖励金额" width="110">
              <template #default="{ row }">
                <strong>{{ formatMoney(row.amount) }}</strong>
              </template>
            </el-table-column>
            <el-table-column label="时间" width="170">
              <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="ledgerCommissionPage"
            :total="ledgerCommissionTotal"
            :page-size="ledgerCommissionPageSize"
            layout="prev, pager, next"
            @current-change="loadLedgerCommissions"
            class="pager"
          />
        </el-tab-pane>
        <el-tab-pane label="提现流水" name="withdrawals">
          <el-table :data="ledgerWithdrawals" v-loading="loadingLedgerWithdrawals" style="width: 100%" empty-text="暂无提现流水">
            <el-table-column prop="withdrawalNo" label="提现单号" width="170" />
            <el-table-column prop="amount" label="提现金额" width="120">
              <template #default="{ row }">{{ formatMoney(row.amount || 0) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="withdrawalTagType(row.status)" size="small">{{ withdrawalStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="adminRemark" label="备注" min-width="180" />
            <el-table-column label="时间" width="170">
              <template #default="{ row }">{{ formatTime(row.requestedAt || row.createdAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane v-if="ledgerDistributor?.isGeneralAgent" label="总代佣金" name="generalAgent">
          <div class="agent-summary" v-if="ledgerGeneralAgentSummary">
            <div><span>下级合伙人</span><strong>{{ ledgerGeneralAgentSummary.childPartnerCount || 0 }}</strong></div>
            <div><span>佣金总额</span><strong>{{ formatMoney(ledgerGeneralAgentSummary.commissionAmount || 0) }}</strong></div>
            <div><span>待线下结算</span><strong>{{ formatMoney(ledgerGeneralAgentSummary.pendingAmount || 0) }}</strong></div>
            <div><span>已线下结算</span><strong>{{ formatMoney(ledgerGeneralAgentSummary.paidAmount || 0) }}</strong></div>
          </div>
          <el-table :data="ledgerGeneralAgentCommissions" v-loading="loadingLedgerGeneralAgentCommissions" style="width: 100%" empty-text="暂无总代佣金">
            <el-table-column label="来源合伙人" min-width="150">
              <template #default="{ row }">{{ row.sourceDistributor?.name || '-' }}</template>
            </el-table-column>
            <el-table-column label="直接来源" min-width="150">
              <template #default="{ row }">{{ row.directDistributor?.name || row.sourceDistributor?.name || '-' }}</template>
            </el-table-column>
            <el-table-column label="充值用户" min-width="150">
              <template #default="{ row }">{{ row.referralUser?.nickname || row.referralUser?.phone || row.referralUserId }}</template>
            </el-table-column>
            <el-table-column label="订单金额" width="110">
              <template #default="{ row }">{{ formatMoney(row.order?.amount || 0) }}</template>
            </el-table-column>
            <el-table-column label="比例" width="90">
              <template #default="{ row }">{{ percentLabel(row.rateBps) }}</template>
            </el-table-column>
            <el-table-column label="佣金" width="110">
              <template #default="{ row }"><strong>{{ formatMoney(row.amount) }}</strong></template>
            </el-table-column>
            <el-table-column label="状态" width="120">
              <template #default="{ row }">{{ row.status === 'paid' ? '已线下结算' : '待线下结算' }}</template>
            </el-table-column>
            <el-table-column label="时间" width="170">
              <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { QuestionFilled } from '@element-plus/icons-vue';
import { api } from '@/api';
import { useAdminStore } from '@/store/admin';

const route = useRoute();
const store = useAdminStore();
const validSections = ['overview', 'distributors', 'commissions', 'generalAgentCommissions', 'withdrawals'];
const activeSection = computed(() => {
  const section = String(route.meta.distributionSection || route.params.section || 'overview');
  return validSections.includes(section) ? section : 'overview';
});
const pageTitle = computed(() => {
  if (activeSection.value === 'distributors') return '合作人员';
  if (activeSection.value === 'commissions') return '奖励流水';
  if (activeSection.value === 'generalAgentCommissions') return '总代佣金';
  if (activeSection.value === 'withdrawals') return '提现管理';
  return '推荐合作';
});

const settingsForm = reactive({
  enabled: true,
  level1Percent: 50,
  level2Percent: 20,
  recurringCommissionEnabled: false,
  recurringLevel1Percent: 10,
  recurringLevel2Percent: 5,
  recurringCommissionDays: 180,
  dailyShareReward: 10,
  referralReward: 20,
  minWithdrawalYuan: 10,
  withdrawalFreezeDays: 7,
  transferSceneId: '1005',
  transferSceneName: '佣金报酬',
  transferDailyLimitYuan: 50000,
  transferSingleMinYuan: 0.1,
  transferSingleMaxYuan: 200,
  transferUserDailyLimitYuan: 2000,
  transferNotifyUrl: '',
  transferUserConfirm: true,
  transferReportJobType: '推广服务',
  transferReportRewardDesc: '涨识推荐合作佣金报酬',
});
const savingSettings = ref(false);

const dashboard = ref<any>({});
const filters = reactive({ keyword: '', level: undefined as number | undefined, status: '', generalAgent: '' });
const distributors = ref<any[]>([]);
const levelOneOptions = ref<any[]>([]);
const generalAgentOptions = ref<any[]>([]);
const loadingDistributors = ref(false);
const page = ref(1);
const pageSize = 20;
const total = ref(0);

const commissions = ref<any[]>([]);
const loadingCommissions = ref(false);
const commissionPage = ref(1);
const commissionPageSize = 20;
const commissionTotal = ref(0);
const withdrawals = ref<any[]>([]);
const loadingWithdrawals = ref(false);
const withdrawalPage = ref(1);
const withdrawalPageSize = 20;
const withdrawalTotal = ref(0);
const withdrawalStatusFilter = ref('');
const generalAgentCommissions = ref<any[]>([]);
const loadingGeneralAgentCommissions = ref(false);
const generalAgentCommissionPage = ref(1);
const generalAgentCommissionPageSize = 20;
const generalAgentCommissionTotal = ref(0);
const generalAgentFilter = ref('');
const generalAgentStatusFilter = ref('');
const generalAgentSummary = ref<any>(null);

const ledgerDialogVisible = ref(false);
const ledgerDistributor = ref<any>(null);
const ledgerActiveTab = ref('commissions');
const ledgerCommissions = ref<any[]>([]);
const loadingLedgerCommissions = ref(false);
const ledgerCommissionPage = ref(1);
const ledgerCommissionPageSize = 10;
const ledgerCommissionTotal = ref(0);
const ledgerWithdrawals = ref<any[]>([]);
const loadingLedgerWithdrawals = ref(false);
const ledgerGeneralAgentCommissions = ref<any[]>([]);
const loadingLedgerGeneralAgentCommissions = ref(false);
const ledgerGeneralAgentSummary = ref<any>(null);

const dialogVisible = ref(false);
const savingDistributor = ref(false);
const distributorForm = reactive({
  id: '',
  userId: '',
  name: '',
  level: 2,
  parentId: '',
  status: 'active',
  newUserGiftOverride: null as number | null,
  isGeneralAgent: false,
  generalAgentPercent: 20,
  generalAgentParentId: '',
});

const metricCards = computed(() => [
  {
    label: '合作推荐用户',
    value: dashboard.value.referralCount || 0,
    tip: '通过特邀合作伙伴或涨识推荐官邀请码建立推荐合作关系的用户，不包含普通邀请注册。',
  },
  { label: '奖励总额', value: formatMoney(dashboard.value.commissionAmount || 0) },
  {
    label: '待结算',
    value: formatMoney(dashboard.value.frozenCommissionAmount || 0),
    note: `未满 ${dashboard.value.withdrawalFreezeDays ?? settingsForm.withdrawalFreezeDays} 天冻结期`,
  },
  { label: '提现中', value: formatMoney(dashboard.value.pendingWithdrawalAmount || 0) },
  { label: '已提现', value: formatMoney(dashboard.value.paidWithdrawalAmount || 0) },
  { label: '总代待结算', value: formatMoney(dashboard.value.generalAgentPendingAmount || 0) },
  { label: '总代已结算', value: formatMoney(dashboard.value.generalAgentPaidAmount || 0) },
]);

async function loadActiveSection(section = activeSection.value) {
  if (!store.isFullAdmin && section !== 'distributors') return;
  if (section === 'overview') {
    await Promise.all([loadSettings(), loadDashboard()]);
    return;
  }
  if (section === 'distributors') {
    const tasks = [loadLevelOneOptions(), loadGeneralAgentOptions(), loadDistributors()];
    if (store.isFullAdmin) tasks.push(loadDashboard());
    await Promise.all(tasks);
    return;
  }
  if (section === 'commissions') {
    await loadCommissions();
    return;
  }
  if (section === 'generalAgentCommissions') {
    await Promise.all([loadDashboard(), loadGeneralAgentOptions()]);
    await loadGeneralAgentCommissions();
    return;
  }
  if (section === 'withdrawals') {
    await Promise.all([loadDashboard(), loadWithdrawals()]);
  }
}

async function loadSettings() {
  const res = await api.distribution.settings() as any;
  Object.assign(settingsForm, {
    enabled: res.data.enabled,
    level1Percent: res.data.level1Percent,
    level2Percent: res.data.level2Percent,
    recurringCommissionEnabled: res.data.recurringCommissionEnabled ?? false,
    recurringLevel1Percent: res.data.recurringLevel1Percent ?? 10,
    recurringLevel2Percent: res.data.recurringLevel2Percent ?? 5,
    recurringCommissionDays: res.data.recurringCommissionDays ?? 180,
    dailyShareReward: res.data.dailyShareReward ?? 10,
    referralReward: res.data.referralReward ?? 20,
    minWithdrawalYuan: res.data.minWithdrawalYuan ?? ((res.data.minWithdrawalAmount || 1000) / 100),
    withdrawalFreezeDays: res.data.withdrawalFreezeDays ?? 7,
    transferSceneId: res.data.transferSceneId ?? '1005',
    transferSceneName: res.data.transferSceneName ?? '佣金报酬',
    transferDailyLimitYuan: toYuan(res.data.transferDailyLimit, 50000),
    transferSingleMinYuan: toYuan(res.data.transferSingleMin, 0.1),
    transferSingleMaxYuan: toYuan(res.data.transferSingleMax, 200),
    transferUserDailyLimitYuan: toYuan(res.data.transferUserDailyLimit, 2000),
    transferNotifyUrl: res.data.transferNotifyUrl || '',
    transferUserConfirm: res.data.transferUserConfirm ?? true,
    transferReportJobType: res.data.transferReportJobType || '推广服务',
    transferReportRewardDesc: res.data.transferReportRewardDesc || '涨识推荐合作佣金报酬',
  });
}

async function saveSettings() {
  if (settingsForm.level1Percent < settingsForm.level2Percent) {
    ElMessage.warning('特邀总比例不能低于推荐官比例');
    return;
  }
  if (settingsForm.recurringLevel1Percent < settingsForm.recurringLevel2Percent) {
    ElMessage.warning('复充特邀总比例不能低于复充推荐官比例');
    return;
  }
  if (settingsForm.recurringLevel1Percent > settingsForm.level1Percent || settingsForm.recurringLevel2Percent > settingsForm.level2Percent) {
    ElMessage.warning('复充比例不能高于首充比例');
    return;
  }
  savingSettings.value = true;
  try {
    await api.distribution.updateSettings({
      enabled: settingsForm.enabled,
      level1Rate: Math.round(settingsForm.level1Percent * 100),
      level2Rate: Math.round(settingsForm.level2Percent * 100),
      recurringCommissionEnabled: settingsForm.recurringCommissionEnabled,
      recurringLevel1Rate: Math.round(settingsForm.recurringLevel1Percent * 100),
      recurringLevel2Rate: Math.round(settingsForm.recurringLevel2Percent * 100),
      recurringCommissionDays: Math.round(settingsForm.recurringCommissionDays),
      dailyShareReward: Math.round(Number(settingsForm.dailyShareReward || 0)),
      referralReward: Math.round(Number(settingsForm.referralReward || 0)),
      minWithdrawalAmount: Math.round(settingsForm.minWithdrawalYuan * 100),
      withdrawalFreezeDays: Math.round(settingsForm.withdrawalFreezeDays),
      transferSceneId: String(settingsForm.transferSceneId || '').trim(),
      transferSceneName: String(settingsForm.transferSceneName || '').trim(),
      transferDailyLimit: Math.round(settingsForm.transferDailyLimitYuan * 100),
      transferSingleMin: Math.round(settingsForm.transferSingleMinYuan * 100),
      transferSingleMax: Math.round(settingsForm.transferSingleMaxYuan * 100),
      transferUserDailyLimit: Math.round(settingsForm.transferUserDailyLimitYuan * 100),
      transferNotifyUrl: String(settingsForm.transferNotifyUrl || '').trim(),
      transferUserConfirm: settingsForm.transferUserConfirm,
      transferReportJobType: String(settingsForm.transferReportJobType || '').trim(),
      transferReportRewardDesc: String(settingsForm.transferReportRewardDesc || '').trim(),
    });
    ElMessage.success('推荐合作规则已保存');
    await loadSettings();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败');
  } finally {
    savingSettings.value = false;
  }
}

async function loadDashboard() {
  const res = await api.distribution.dashboard() as any;
  dashboard.value = res.data;
}

async function loadDistributors() {
  loadingDistributors.value = true;
  try {
    const res = await api.distribution.distributorTree({
      page: page.value,
      pageSize,
      keyword: filters.keyword,
      level: filters.level,
      status: filters.status,
      generalAgent: filters.generalAgent,
    }) as any;
    distributors.value = res.data.list;
    total.value = res.data.total;
  } finally {
    loadingDistributors.value = false;
  }
}

async function loadLevelOneOptions() {
  const res = await api.distribution.levelOne() as any;
  levelOneOptions.value = res.data;
}

async function loadGeneralAgentOptions() {
  if (!store.isFullAdmin) {
    generalAgentOptions.value = [];
    return;
  }
  const res = await api.distribution.generalAgents() as any;
  generalAgentOptions.value = res.data;
}

async function loadCommissions() {
  loadingCommissions.value = true;
  try {
    const res = await api.distribution.commissions({
      page: commissionPage.value,
      pageSize: commissionPageSize,
    }) as any;
    commissions.value = res.data.list;
    commissionTotal.value = res.data.total;
  } finally {
    loadingCommissions.value = false;
  }
}

async function loadGeneralAgentCommissions() {
  loadingGeneralAgentCommissions.value = true;
  try {
    const res = await api.distribution.generalAgentCommissions({
      page: generalAgentCommissionPage.value,
      pageSize: generalAgentCommissionPageSize,
      generalAgentId: generalAgentFilter.value,
      status: generalAgentStatusFilter.value,
    }) as any;
    generalAgentCommissions.value = res.data.list;
    generalAgentCommissionTotal.value = res.data.total;
    if (generalAgentFilter.value) {
      const statsRes = await api.distribution.generalAgentStats(generalAgentFilter.value) as any;
      generalAgentSummary.value = statsRes.data;
    } else {
      generalAgentSummary.value = {
        childPartnerCount: null,
        childReferralOfficerCount: null,
        commissionAmount: dashboard.value.generalAgentCommissionAmount || 0,
        pendingAmount: dashboard.value.generalAgentPendingAmount || 0,
        paidAmount: dashboard.value.generalAgentPaidAmount || 0,
      };
    }
  } finally {
    loadingGeneralAgentCommissions.value = false;
  }
}

async function loadWithdrawals() {
  loadingWithdrawals.value = true;
  try {
    const res = await api.distribution.withdrawals({
      page: withdrawalPage.value,
      pageSize: withdrawalPageSize,
      status: withdrawalStatusFilter.value,
    }) as any;
    withdrawals.value = res.data.list;
    withdrawalTotal.value = res.data.total;
  } finally {
    loadingWithdrawals.value = false;
  }
}

async function openLedgerDialog(row: any) {
  ledgerDistributor.value = row;
  ledgerActiveTab.value = 'commissions';
  ledgerCommissionPage.value = 1;
  ledgerCommissions.value = [];
  ledgerCommissionTotal.value = 0;
  ledgerWithdrawals.value = [];
  ledgerGeneralAgentCommissions.value = [];
  ledgerGeneralAgentSummary.value = null;
  ledgerDialogVisible.value = true;
  await Promise.all([
    loadLedgerCommissions(),
    loadLedgerWithdrawals(),
    row.isGeneralAgent ? loadLedgerGeneralAgentCommissions() : Promise.resolve(),
    row.isGeneralAgent ? loadLedgerGeneralAgentSummary() : Promise.resolve(),
  ]);
}

async function loadLedgerCommissions() {
  if (!ledgerDistributor.value?.id) return;
  loadingLedgerCommissions.value = true;
  try {
    const res = await api.distribution.commissions({
      page: ledgerCommissionPage.value,
      pageSize: ledgerCommissionPageSize,
      distributorId: ledgerDistributor.value.id,
    }) as any;
    ledgerCommissions.value = res.data.list;
    ledgerCommissionTotal.value = res.data.total;
  } finally {
    loadingLedgerCommissions.value = false;
  }
}

async function loadLedgerWithdrawals() {
  if (!ledgerDistributor.value?.id) return;
  loadingLedgerWithdrawals.value = true;
  try {
    const res = await api.distribution.withdrawals({
      page: 1,
      pageSize: 50,
      distributorId: ledgerDistributor.value.id,
    }) as any;
    ledgerWithdrawals.value = res.data.list;
  } finally {
    loadingLedgerWithdrawals.value = false;
  }
}

async function loadLedgerGeneralAgentCommissions() {
  if (!ledgerDistributor.value?.id) return;
  loadingLedgerGeneralAgentCommissions.value = true;
  try {
    const res = await api.distribution.generalAgentCommissions({
      page: 1,
      pageSize: 50,
      generalAgentId: ledgerDistributor.value.id,
    }) as any;
    ledgerGeneralAgentCommissions.value = res.data.list;
  } finally {
    loadingLedgerGeneralAgentCommissions.value = false;
  }
}

async function loadLedgerGeneralAgentSummary() {
  if (!ledgerDistributor.value?.id) return;
  const res = await api.distribution.generalAgentStats(ledgerDistributor.value.id) as any;
  ledgerGeneralAgentSummary.value = res.data;
}

function openDistributorDialog(row?: any) {
  Object.assign(distributorForm, row ? {
    id: row.id,
    userId: row.userId || '',
    name: row.name || '',
    level: row.level,
    parentId: row.parentId || '',
    status: row.status || 'active',
    newUserGiftOverride: row.newUserGiftOverride ?? null,
    isGeneralAgent: row.isGeneralAgent ?? false,
    generalAgentPercent: Number(row.generalAgentRate ?? 2000) / 100,
    generalAgentParentId: row.generalAgentParentId || '',
  } : {
    id: '',
    userId: '',
    name: '',
    level: 2,
    parentId: '',
    status: 'active',
    newUserGiftOverride: null,
    isGeneralAgent: false,
    generalAgentPercent: 20,
    generalAgentParentId: '',
  });
  dialogVisible.value = true;
}

async function saveDistributor() {
  if (!distributorForm.id && !distributorForm.userId.trim()) {
    ElMessage.warning('请填写用户 ID');
    return;
  }
  savingDistributor.value = true;
  try {
    const payload: any = {
      userId: distributorForm.userId.trim(),
      name: distributorForm.name.trim(),
      level: distributorForm.level,
      parentId: distributorForm.level === 2 ? distributorForm.parentId : null,
      status: distributorForm.status,
      newUserGiftOverride: distributorForm.level === 1 ? (distributorForm.newUserGiftOverride ?? null) : null,
    };
    if (store.isFullAdmin) {
      payload.isGeneralAgent = distributorForm.level === 1 ? distributorForm.isGeneralAgent : false;
      payload.generalAgentRate = distributorForm.level === 1 ? Math.round(Number(distributorForm.generalAgentPercent || 0) * 100) : 2000;
      payload.generalAgentParentId = distributorForm.level === 1 && !distributorForm.isGeneralAgent ? distributorForm.generalAgentParentId : null;
    }
    if (distributorForm.id) {
      await api.distribution.updateDistributor(distributorForm.id, payload);
    } else {
      await api.distribution.createDistributor(payload);
    }
    dialogVisible.value = false;
    ElMessage.success('合作人员已保存');
    await reloadDistributorSection();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '保存失败');
  } finally {
    savingDistributor.value = false;
  }
}

async function reviewDistributor(row: any, status: 'active' | 'rejected') {
  try {
    const payload: any = {
      name: row.name,
      level: row.level,
      parentId: row.parentId,
      newUserGiftOverride: row.newUserGiftOverride,
      status,
    };
    if (store.isFullAdmin) {
      payload.generalAgentParentId = row.generalAgentParentId;
      payload.isGeneralAgent = row.isGeneralAgent;
      payload.generalAgentRate = row.generalAgentRate;
    }
    await api.distribution.updateDistributor(row.id, payload);
    ElMessage.success(status === 'active' ? '已审核通过' : '已驳回');
    await reloadDistributorSection();
    refreshPendingBadges();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败');
  }
}

async function markGeneralAgentCommission(row: any, status: 'pending' | 'paid') {
  let adminRemark = '';
  if (status === 'paid') {
    try {
      const result = await ElMessageBox.prompt('请填写线下结算备注，可留空', '标记总代佣金已线下结算', {
        confirmButtonText: '确认',
        cancelButtonText: '取消',
        inputPlaceholder: '如：银行转账流水号',
      });
      adminRemark = result.value || '';
    } catch {
      return;
    }
  }
  try {
    await api.distribution.updateGeneralAgentCommission(row.id, { status, adminRemark });
    ElMessage.success(status === 'paid' ? '已标记线下结算' : '已撤回结算状态');
    await loadGeneralAgentCommissions();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败');
  }
}

async function reviewWithdrawal(row: any, status: 'approved' | 'rejected' | 'paid' | 'failed') {
  const label = withdrawalStatusLabel(status);
  let adminRemark = '';
  try {
    const result = await ElMessageBox.prompt(`请填写${label}备注，可留空`, '处理提现申请', {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputPlaceholder: '备注',
    });
    adminRemark = result.value || '';
  } catch {
    return;
  }

  try {
    await api.distribution.reviewWithdrawal(row.id, { status, adminRemark });
    ElMessage.success(`已${label}`);
    await Promise.all([loadWithdrawals(), loadDashboard()]);
    refreshPendingBadges();
    if (ledgerDialogVisible.value) await loadLedgerWithdrawals();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '处理失败');
  }
}

async function startWechatTransfer(row: any) {
  try {
    const result = await ElMessageBox.prompt('请填写转账备注，可留空使用默认备注', '发起微信商家转账', {
      confirmButtonText: '发起转账',
      cancelButtonText: '取消',
      inputPlaceholder: '涨识佣金报酬',
    });
    await api.distribution.startWechatTransfer(row.id, { remark: result.value || '' });
    ElMessage.success('已发起微信转账');
    await Promise.all([loadWithdrawals(), loadDashboard()]);
    refreshPendingBadges();
    if (ledgerDialogVisible.value) await loadLedgerWithdrawals();
  } catch (e: any) {
    if (e === 'cancel' || e === 'close') return;
    ElMessage.error(e.response?.data?.message || e.message || '发起转账失败');
  }
}

async function queryWechatTransfer(row: any) {
  try {
    await api.distribution.queryWechatTransfer(row.id);
    ElMessage.success('转账状态已同步');
    await Promise.all([loadWithdrawals(), loadDashboard()]);
    refreshPendingBadges();
    if (ledgerDialogVisible.value) await loadLedgerWithdrawals();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || e.message || '查询失败');
  }
}

function canStartWechatTransfer(row: any) {
  return ['approved', 'failed'].includes(row.status) || (row.status === 'transferring' && !row.outBillNo);
}

function refreshPendingBadges() {
  window.dispatchEvent(new Event('distribution-pending-refresh'));
}

async function reloadDistributorSection() {
  const tasks = [loadDistributors(), loadLevelOneOptions(), loadGeneralAgentOptions()];
  if (store.isFullAdmin) tasks.push(loadDashboard());
  await Promise.all(tasks);
}

function levelLabel(level: number) {
  return level === 1 ? '特邀合作伙伴' : '涨识推荐官';
}

function statusLabel(status: string) {
  if (status === 'active') return '启用';
  if (status === 'pending') return '待审核';
  if (status === 'rejected') return '已驳回';
  return '禁用';
}

function statusTagType(status: string) {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'rejected') return 'danger';
  return 'info';
}

function roleLabel(role: string) {
  if (role === 'level1_direct') return '直接推荐奖励';
  if (role === 'level2_direct') return '推荐奖励';
  if (role === 'level1_override') return '合作伙伴奖励';
  if (role === 'level1_recurring_direct') return '复充直接奖励';
  if (role === 'level2_recurring_direct') return '复充推荐奖励';
  if (role === 'level1_recurring_override') return '复充合作伙伴奖励';
  return role;
}

function percentLabel(rateBps: number) {
  return `${(Number(rateBps || 0) / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}%`;
}

function withdrawalStatusLabel(status: string) {
  if (status === 'pending') return '待审核';
  if (status === 'approved') return '已通过';
  if (status === 'transferring') return '转账中';
  if (status === 'wait_user_confirm') return '待用户确认';
  if (status === 'paid') return '已打款';
  if (status === 'rejected') return '已驳回';
  if (status === 'failed') return '打款失败';
  return status || '-';
}

function withdrawalTagType(status: string) {
  if (status === 'paid') return 'success';
  if (status === 'pending' || status === 'approved' || status === 'transferring' || status === 'wait_user_confirm') return 'warning';
  if (status === 'rejected' || status === 'failed') return 'danger';
  return 'info';
}

function formatMoney(value: number) {
  return `¥${(Number(value || 0) / 100).toFixed(2)}`;
}

function toYuan(value: number | undefined, fallback: number) {
  return value === undefined || value === null ? fallback : Number(value || 0) / 100;
}

function formatTime(value: string) {
  return value ? new Date(value).toLocaleString() : '-';
}

onMounted(() => {
  loadActiveSection();
});

watch(activeSection, (section) => {
  loadActiveSection(section);
});
</script>

<style lang="scss" scoped>
h2 {
  margin-bottom: 20px;
}

.stat-overview {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.stat-card {
  min-width: 0;
  min-height: 118px;

  .stat-label {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  strong {
    font-size: 22px;
  }
}

.people-stat-card {
  grid-column: span 2;
}

.stat-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.stat-note {
  display: block;
  margin-top: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.stat-help {
  color: var(--el-text-color-secondary);
  cursor: help;
}

.people-breakdown {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);

  div {
    flex: 1;
    min-width: 0;
  }

  span {
    display: block;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 4px;
    font-size: 18px;
  }
}

.people-plus {
  flex: none;
  color: var(--el-text-color-placeholder);
}

.compact {
  margin-top: 10px;
}

@media (max-width: 1280px) {
  .stat-overview {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .stat-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .people-stat-card {
    grid-column: span 2;
  }
}

.panel-card {
  margin-bottom: 18px;
}

.transfer-rule-box {
  display: block;
  flex-basis: 100%;
  margin-top: 4px;
  padding: 14px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.transfer-rule-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
  font-weight: 700;

  span:last-child {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-weight: 400;
  }
}

.transfer-rule-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0 12px;
}

.card-head,
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar {
  justify-content: flex-start;
  margin-bottom: 14px;
}

.settings-form {
  align-items: center;
}

.child-table-wrap {
  padding: 12px 18px 16px 54px;
  background: #f8fafc;
}

.child-title {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 10px;
}

.formula,
.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.hint {
  margin-left: 8px;
}

.main-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;

  span {
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }
}

.tag-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.agent-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;

  div {
    min-width: 0;
    padding: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-fill-color-light);
  }

  span {
    display: block;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.4;
  }

  strong {
    display: block;
    margin-top: 5px;
    font-size: 18px;
  }
}

.pager {
  margin-top: 16px;
  justify-content: center;
}

@media (max-width: 1200px) {
  .agent-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
