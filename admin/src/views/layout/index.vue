<template>
  <el-container class="layout">
    <el-aside width="220px" class="sidebar">
      <div class="logo">
        <h2>赛博张老师</h2>
        <span>管理后台</span>
      </div>
      <el-menu :default-active="activeMenu" router background-color="#0d1129" text-color="#8890b0" active-text-color="#00f5ff">
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>数据大盘</span>
        </el-menu-item>
        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <span>用户管理</span>
        </el-menu-item>
        <el-menu-item index="/points">
          <el-icon><Coin /></el-icon>
          <span>点数管理</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Tickets /></el-icon>
          <span>订单管理</span>
        </el-menu-item>
        <el-sub-menu index="content">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>内容管理</span>
          </template>
          <el-menu-item index="/content/articles">干货文库</el-menu-item>
          <el-menu-item index="/content/quick-questions">快捷提问</el-menu-item>
          <el-menu-item index="/content/auto-reply">自动回复</el-menu-item>
          <el-menu-item index="/content/knowledge">知识库</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/ai-config">
          <el-icon><Cpu /></el-icon>
          <span>AI 配置</span>
        </el-menu-item>
        <el-menu-item index="/skills">
          <el-icon><MagicStick /></el-icon>
          <span>Skill 管理</span>
        </el-menu-item>
        <el-menu-item index="/wechat">
          <el-icon><ChatDotRound /></el-icon>
          <span>公众号管理</span>
        </el-menu-item>
        <el-menu-item index="/notices">
          <el-icon><Bell /></el-icon>
          <span>系统公告</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="topbar">
        <span class="topbar-title">{{ currentTitle }}</span>
        <div class="topbar-right">
          <span>{{ store.username }}</span>
          <el-button type="danger" text @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAdminStore } from '@/store/admin';

const route = useRoute();
const router = useRouter();
const store = useAdminStore();

const activeMenu = computed(() => route.path);
const currentTitle = computed(() => route.meta.title || '管理后台');

function handleLogout() {
  store.logout();
  router.push('/login');
}
</script>

<style lang="scss" scoped>
.layout {
  min-height: 100vh;
}

.sidebar {
  background: #0d1129;
  border-right: 1px solid #1e2550;
  overflow-y: auto;
}

.logo {
  padding: 24px 16px;
  text-align: center;
  border-bottom: 1px solid #1e2550;

  h2 {
    font-size: 18px;
    background: linear-gradient(135deg, #00f5ff, #7c3aed);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0;
  }

  span {
    font-size: 12px;
    color: #5a6080;
  }
}

.el-menu {
  border-right: none;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #111640;
  border-bottom: 1px solid #1e2550;
}

.topbar-title {
  font-size: 16px;
  font-weight: 600;
  color: #e8eaf0;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #8890b0;
  font-size: 14px;
}

.main-content {
  background: #0a0e27;
  min-height: calc(100vh - 60px);
}
</style>
