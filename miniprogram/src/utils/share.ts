import { api } from '@/api';
import { useUserStore } from '@/store/user';

export type ShareChannel = 'friend' | 'timeline' | 'copy' | 'qrcode';

export function withShareRef(path: string) {
  const cleanPath = String(path || '').trim() || '/pages/volunteer/index';
  const userStore = useUserStore();
  const shareCode = String(userStore.userInfo?.shareCode || '').trim().toUpperCase();
  if (!shareCode) return cleanPath;

  const [base, query = ''] = cleanPath.split('?');
  const params = query
    .split('&')
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => !/^ref=/i.test(item));
  params.push(`ref=${encodeURIComponent(shareCode)}`);
  return `${base}?${params.join('&')}`;
}

export function recordShare(channel: ShareChannel, path?: string) {
  const userStore = useUserStore();
  if (!userStore.isLogin || !userStore.userInfo?.shareCode) return;

  api.distribution.recordShare({ channel, path })
    .then((res: any) => {
      const data = res.data || {};
      if (data.awarded) {
        userStore.fetchBalance();
        uni.showToast({ title: `分享成功，+${data.points || 10}点`, icon: 'none' });
      }
    })
    .catch(() => {});
}
