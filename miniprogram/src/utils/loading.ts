let loadingCount = 0;

export function showAppLoading(title = '正在分析') {
  loadingCount += 1;
  uni.$emit('app-loading:show', { title });
}

export function hideAppLoading() {
  loadingCount = Math.max(0, loadingCount - 1);
  if (loadingCount === 0) {
    uni.$emit('app-loading:hide');
  }
}

export function resetAppLoading() {
  loadingCount = 0;
  uni.$emit('app-loading:hide');
}
