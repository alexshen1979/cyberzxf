import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api';

export const useAdminStore = defineStore('admin', () => {
  const USER_SEEN_KEY = 'admin_users_last_seen_at';
  const ORDER_SEEN_KEY = 'admin_orders_last_seen_at';
  const token = ref(localStorage.getItem('admin_token') || '');
  const username = ref(localStorage.getItem('admin_username') || '');
  const role = ref(localStorage.getItem('admin_role') || '');
  const newUsers = ref(0);
  const newOrders = ref(0);
  const pendingDistributors = ref(0);
  const pendingWithdrawals = ref(0);

  const isLogin = computed(() => !!token.value);
  const isFullAdmin = computed(() => role.value !== 'editor');
  const isEditor = computed(() => role.value === 'editor');
  const canManageDistributors = computed(() => isFullAdmin.value || isEditor.value);

  async function login(loginUsername: string, password: string) {
    const res = await api.admin.login(loginUsername, password);
    token.value = res.data.token;
    username.value = res.data.username;
    role.value = res.data.role;
    localStorage.setItem('admin_token', res.data.token);
    localStorage.setItem('admin_username', res.data.username);
    localStorage.setItem('admin_role', res.data.role);
  }

  async function fetchMenuBadges() {
    if (!token.value) {
      newUsers.value = 0;
      newOrders.value = 0;
      pendingDistributors.value = 0;
      pendingWithdrawals.value = 0;
      return;
    }
    try {
      if (isFullAdmin.value) {
        const [userRes, orderRes, distributionRes] = await Promise.all([
          api.users.menuStats({ lastSeen: localStorage.getItem(USER_SEEN_KEY) || '' }),
          api.orders.menuStats({ lastSeen: localStorage.getItem(ORDER_SEEN_KEY) || '' }),
          api.distribution.pendingCounts(),
        ]) as any[];

        newUsers.value = resolveNewCount(userRes, USER_SEEN_KEY);
        newOrders.value = resolveNewCount(orderRes, ORDER_SEEN_KEY);
        pendingDistributors.value = Number(distributionRes.data?.pendingDistributors || 0);
        pendingWithdrawals.value = Number(distributionRes.data?.pendingWithdrawals || 0);
        return;
      }

      if (canManageDistributors.value) {
        const distributionRes = await api.distribution.pendingCounts() as any;
        newUsers.value = 0;
        newOrders.value = 0;
        pendingDistributors.value = Number(distributionRes.data?.pendingDistributors || 0);
        pendingWithdrawals.value = 0;
      }
    } catch {
      // Menu badges are best-effort. Avoid interrupting normal admin work.
    }
  }

  const fetchPendingCounts = fetchMenuBadges;

  function resolveNewCount(res: any, storageKey: string) {
    const latest = res.data?.latestCreatedAt ? new Date(res.data.latestCreatedAt).toISOString() : '';
    if (!localStorage.getItem(storageKey) && latest) {
      localStorage.setItem(storageKey, latest);
      return 0;
    }
    return Number(res.data?.newCount || 0);
  }

  async function markUsersSeen() {
    await markSeen(USER_SEEN_KEY, api.users.menuStats);
    newUsers.value = 0;
  }

  async function markOrdersSeen() {
    await markSeen(ORDER_SEEN_KEY, api.orders.menuStats);
    newOrders.value = 0;
  }

  async function markSeen(storageKey: string, loader: (params?: any) => Promise<any>) {
    if (!token.value || !isFullAdmin.value) return;
    try {
      const res = await loader();
      const latest = res.data?.latestCreatedAt ? new Date(res.data.latestCreatedAt).toISOString() : new Date().toISOString();
      localStorage.setItem(storageKey, latest);
    } catch {
      localStorage.setItem(storageKey, new Date().toISOString());
    }
  }

  function logout() {
    token.value = '';
    username.value = '';
    role.value = '';
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    localStorage.removeItem('admin_role');
    newUsers.value = 0;
    newOrders.value = 0;
    pendingDistributors.value = 0;
    pendingWithdrawals.value = 0;
  }

  return {
    token,
    username,
    role,
    newUsers,
    newOrders,
    pendingDistributors,
    pendingWithdrawals,
    isLogin,
    isFullAdmin,
    isEditor,
    canManageDistributors,
    login,
    logout,
    fetchPendingCounts,
    fetchMenuBadges,
    markUsersSeen,
    markOrdersSeen,
  };
});
