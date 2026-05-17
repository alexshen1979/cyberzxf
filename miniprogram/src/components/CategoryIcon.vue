<template>
  <view class="cat-icon-wrap" :style="{ background: bg }">
    <image class="cat-icon-img" :src="src" mode="aspectFit" />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { buildIconSrc } from '@/utils/iconSvgs';

const props = defineProps<{ name: string; color: string; bg: string; active?: boolean }>();
const src = computed(() => buildIconSrc(props.name, props.color));
</script>

<style lang="scss" scoped>
.cat-icon-wrap {
  width: 44rpx;
  height: 44rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cat-icon-img {
  width: 28rpx;
  height: 28rpx;
}
</style>
