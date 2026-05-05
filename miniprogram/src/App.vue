<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';
import { useUserStore } from '@/store/user';

onLaunch(async () => {
  // 静默登录
  const userStore = useUserStore();
  try {
    await userStore.silentLogin();
  } catch (e) {
    console.error('登录失败:', e);
  }

  // 检查系统公告
  await userStore.checkNotices();
});
</script>

<style lang="scss">
@use '@/styles/global.scss';
</style>
