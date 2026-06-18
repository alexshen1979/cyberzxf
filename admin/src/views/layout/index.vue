<template>
  <el-container class="layout">
    <el-aside width="232px" class="sidebar">
      <!-- Logo -->
      <div class="logo">
        <div class="logo-icon">
          <el-icon :size="24"><School /></el-icon>
        </div>
        <div class="logo-text">
          <span class="logo-title">涨识</span>
          <span class="logo-sub">管理后台</span>
        </div>
      </div>

      <!-- Menu -->
      <div class="menu-wrapper">
        <el-menu
          :default-active="activeMenu"
          router
          background-color="transparent"
        >
          <el-menu-item v-if="store.isFullAdmin" index="/dashboard">
            <template #title>
              <el-icon><DataAnalysis /></el-icon>
              <span>数据大盘</span>
            </template>
          </el-menu-item>
          <el-menu-item v-if="store.canManageUsers" index="/users">
            <template #title>
              <el-icon><User /></el-icon>
              <span class="menu-label">用户管理<i v-if="store.newUsers > 0" class="menu-dot"></i></span>
            </template>
          </el-menu-item>
          <el-menu-item v-if="store.isFullAdmin" index="/points">
            <template #title>
              <el-icon><Coin /></el-icon>
              <span>点数管理</span>
            </template>
          </el-menu-item>
          <el-menu-item v-if="store.isFullAdmin" index="/orders">
            <template #title>
              <el-icon><Tickets /></el-icon>
              <span class="menu-label">订单管理<i v-if="store.newOrders > 0" class="menu-dot"></i></span>
            </template>
          </el-menu-item>
          <el-menu-item v-if="store.isFullAdmin" index="/tencent-ad-conversion">
            <template #title>
              <el-icon><Promotion /></el-icon>
              <span>腾讯广告回传</span>
            </template>
          </el-menu-item>
          <el-sub-menu v-if="store.canManageDistributors" index="distribution">
            <template #title>
              <el-icon><Share /></el-icon>
              <span>推荐合作</span>
            </template>
            <el-menu-item v-if="store.isFullAdmin" index="/distribution/overview">
              <span>总览与规则</span>
            </el-menu-item>
            <el-menu-item index="/distribution/distributors">
              <span class="menu-label">合作人员<i v-if="store.pendingDistributors > 0" class="menu-dot"></i></span>
            </el-menu-item>
            <el-menu-item v-if="store.isFullAdmin" index="/distribution/commissions">
              <span>奖励流水</span>
            </el-menu-item>
            <el-menu-item v-if="store.isFullAdmin" index="/distribution/general-agent-commissions">
              <span>总代佣金</span>
            </el-menu-item>
            <el-menu-item v-if="store.isFullAdmin" index="/distribution/withdrawals">
              <span class="menu-label">提现管理<i v-if="store.pendingWithdrawals > 0" class="menu-dot"></i></span>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-if="store.isFullAdmin" index="/admins">
            <template #title>
              <el-icon><Setting /></el-icon>
              <span>管理员账号</span>
            </template>
          </el-menu-item>

          <el-sub-menu index="content">
            <template #title>
              <el-icon><Document /></el-icon>
              <span>内容管理</span>
            </template>
            <el-menu-item v-if="store.isFullAdmin" index="/content/articles">
              <span>干货文库</span>
            </el-menu-item>
            <el-menu-item index="/content/quick-questions">
              <span>快捷提问</span>
            </el-menu-item>
            <el-menu-item v-if="store.isFullAdmin" index="/content/auto-reply">
              <span>自动回复</span>
            </el-menu-item>
            <el-menu-item index="/content/knowledge">
              <span>知识库</span>
            </el-menu-item>
            <el-menu-item v-if="store.isFullAdmin" index="/content/categories">
              <span>分类管理</span>
            </el-menu-item>
            <el-menu-item v-if="store.isFullAdmin" index="/content/regions">
              <span>省市管理</span>
            </el-menu-item>
            <el-menu-item index="/content/universities">
              <span>院校库</span>
            </el-menu-item>
            <el-menu-item index="/content/majors">
              <span>专业库</span>
            </el-menu-item>
            <el-menu-item v-if="store.isFullAdmin" index="/content/score-ranks">
              <span>一分一段表</span>
            </el-menu-item>
            <el-menu-item v-if="store.isFullAdmin" index="/content/admission-scores">
              <span>录取分数线</span>
            </el-menu-item>
            <el-menu-item v-if="store.isFullAdmin" index="/content/art-admission-rules">
              <span>艺术类规则</span>
            </el-menu-item>
            <el-menu-item v-if="store.isFullAdmin" index="/content/art-admission-scores">
              <span>艺术类投档线</span>
            </el-menu-item>
            <el-menu-item v-if="store.isFullAdmin" index="/content/volunteer-data">
              <span>志愿报告</span>
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item v-if="store.isFullAdmin" index="/ai-config">
            <template #title>
              <el-icon><Cpu /></el-icon>
              <span>AI 配置</span>
            </template>
          </el-menu-item>
          <el-menu-item v-if="store.isFullAdmin" index="/skills">
            <template #title>
              <el-icon><MagicStick /></el-icon>
              <span>Skill 管理</span>
            </template>
          </el-menu-item>
          <el-menu-item index="/wechat">
            <template #title>
              <el-icon><ChatDotRound /></el-icon>
              <span>公众号管理</span>
            </template>
          </el-menu-item>
          <el-menu-item v-if="store.isFullAdmin" index="/notices">
            <template #title>
              <el-icon><Bell /></el-icon>
              <span>系统公告</span>
            </template>
          </el-menu-item>
        </el-menu>
      </div>
    </el-aside>

    <!-- Main -->
    <el-container>
      <el-header class="topbar">
        <span class="topbar-title">{{ currentTitle }}</span>
        <div class="topbar-right">
          <span class="topbar-role">{{ roleLabel }}</span>
          <span class="topbar-user">{{ store.username }}</span>
          <el-button class="logout-btn" @click="handleLogout">退出登录</el-button>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAdminStore } from '@/store/admin';
import {
  School, DataAnalysis, User, Coin, Tickets, Promotion, Document,
  Cpu, MagicStick, ChatDotRound, Bell, Share, Setting,
} from '@element-plus/icons-vue';

const route = useRoute();
const router = useRouter();
const store = useAdminStore();

const activeMenu = computed(() => {
  if (route.path === '/distribution') return store.isEditor ? '/distribution/distributors' : '/distribution/overview';
  return route.path;
});
const currentTitle = computed(() => route.meta.title || '管理后台');
const roleLabel = computed(() => (store.isEditor ? '编辑' : '管理员'));
let pendingTimer: number | undefined;

onMounted(() => {
  store.fetchMenuBadges();
  pendingTimer = window.setInterval(() => {
    store.fetchMenuBadges();
  }, 60000);
  window.addEventListener('distribution-pending-refresh', store.fetchMenuBadges);
});

onBeforeUnmount(() => {
  if (pendingTimer) window.clearInterval(pendingTimer);
  window.removeEventListener('distribution-pending-refresh', store.fetchMenuBadges);
});

watch(
  () => route.path,
  (path) => {
    if (path === '/users') store.markUsersSeen();
    if (path === '/orders') store.markOrdersSeen();
  },
  { immediate: true },
);

watch(
  () => store.isFullAdmin,
  (isFullAdmin) => {
    if (isFullAdmin) store.fetchMenuBadges();
  },
  { immediate: true },
);

function handleLogout() {
  store.logout();
  router.push('/login');
}
</script>

<style lang="scss" scoped>
// ─── Layout ─────────────────────────────────────
.layout {
  min-height: 100vh;
}

// ─── Sidebar ────────────────────────────────────
.sidebar {
  background: var(--sidebar-bg);
  border-right: 1px solid var(--el-border-color);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

// ─── Logo ───────────────────────────────────────
.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.logo-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.logo-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.logo-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  letter-spacing: 0.5px;
}

.logo-sub {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  font-weight: 400;
}

// ─── Menu wrapper ───────────────────────────────
.menu-wrapper {
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
}

// ─── Menu overrides ─────────────────────────────
:deep(.el-menu) {
  border-right: none;

  .el-menu-item,
  .el-sub-menu__title {
    height: 44px;
    line-height: 44px;
    margin: 2px 0;
    border-radius: 8px;
    padding: 0 12px !important;
    font-size: 14px;
    color: var(--el-text-color-secondary);
    transition: all 0.15s ease;

    .el-icon {
      font-size: 18px;
      margin-right: 10px;
      width: 18px;
      text-align: center;
    }

    &:hover {
      background: var(--el-fill-color) !important;
      color: var(--el-text-color-primary) !important;
    }
  }

  .el-menu-item.is-active {
    background: var(--el-color-primary-light-9) !important;
    color: var(--el-color-primary) !important;
    font-weight: 600;
    box-shadow: inset 3px 0 0 var(--el-color-primary);
    padding-left: 9px !important;
    border-radius: 0 8px 8px 0;
  }

  .el-sub-menu {
    .el-menu {
      padding-left: 8px;

      .el-menu-item {
        height: 38px;
        line-height: 38px;
        font-size: 13px;
        padding-left: 40px !important;

        &.is-active {
          padding-left: 37px !important;
        }
      }
    }
  }

  .el-sub-menu.is-opened > .el-sub-menu__title {
    color: var(--el-text-color-primary) !important;
    font-weight: 500;
  }
}

.menu-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.menu-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--el-color-danger);
  box-shadow: 0 0 0 3px rgba(245, 108, 108, 0.14);
}

// ─── Topbar ─────────────────────────────────────
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--topbar-bg);
  border-bottom: 1px solid var(--el-border-color);
  height: 56px;
  padding: 0 28px;
}

.topbar-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.topbar-role {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  font-size: 12px;
}

.topbar-user {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.logout-btn {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 4px 14px;
  background: transparent;
  transition: all 0.15s;

  &:hover {
    color: var(--el-color-danger);
    border-color: var(--el-color-danger-light-5);
    background: var(--el-color-danger-light-9);
  }
}

// ─── Main content ──────────────────────────────
.main-content {
  background: var(--main-content-bg);
  min-height: calc(100vh - 56px);
  padding: 24px 28px;
}
</style>
