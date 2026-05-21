import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api';

export const useAdminStore = defineStore('admin', () => {
  const token = ref(localStorage.getItem('admin_token') || '');
  const username = ref(localStorage.getItem('admin_username') || '');
  const role = ref(localStorage.getItem('admin_role') || '');

  const isLogin = computed(() => !!token.value);
  const isFullAdmin = computed(() => role.value !== 'editor');
  const isEditor = computed(() => role.value === 'editor');

  async function login(loginUsername: string, password: string) {
    const res = await api.admin.login(loginUsername, password);
    token.value = res.data.token;
    username.value = res.data.username;
    role.value = res.data.role;
    localStorage.setItem('admin_token', res.data.token);
    localStorage.setItem('admin_username', res.data.username);
    localStorage.setItem('admin_role', res.data.role);
  }

  function logout() {
    token.value = '';
    username.value = '';
    role.value = '';
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    localStorage.removeItem('admin_role');
  }

  return { token, username, role, isLogin, isFullAdmin, isEditor, login, logout };
});
