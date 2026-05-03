<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">赛博张老师</h1>
      <p class="login-sub">一体化管理后台</p>
      <el-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="管理员账号" size="large" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" class="login-btn" native-type="submit" :loading="loading">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAdminStore } from '@/store/admin';
import { ElMessage } from 'element-plus';

const router = useRouter();
const store = useAdminStore();
const loading = ref(false);
const form = reactive({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function handleLogin() {
  loading.value = true;
  try {
    await store.login(form.username, form.password);
    router.push('/');
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0a0e27, #111640);
}

.login-card {
  width: 400px;
  padding: 48px 40px;
  background: #1a1f4a;
  border-radius: 16px;
  border: 1px solid #1e2550;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.login-title {
  text-align: center;
  font-size: 28px;
  background: linear-gradient(135deg, #00f5ff, #7c3aed);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 4px;
}

.login-sub {
  text-align: center;
  color: #8890b0;
  margin-bottom: 32px;
  font-size: 14px;
}

.login-btn {
  width: 100%;
  background: linear-gradient(135deg, #00c8d6, #7c3aed) !important;
  border: none !important;
}
</style>
