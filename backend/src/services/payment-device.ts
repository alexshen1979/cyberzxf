export type PaymentDevice = 'ios' | 'android' | 'wechat_pay' | 'unknown';

export function normalizePaymentDevice(value?: any): PaymentDevice {
  const text = String(value || '').trim();
  if (text === 'ios' || text === 'apple_iap' || text === 'iap') return 'ios';
  if (text === 'android' || text === 'harmony' || text === 'windows' || text === 'wechat_virtual') return 'android';
  if (text === 'wechat_pay' || text === 'legacy_wechat_pay') return 'wechat_pay';
  return 'unknown';
}

export function paymentDeviceFromVirtualOrderType(orderType?: any): PaymentDevice {
  const type = Number(orderType);
  if (type === 7 || type === 8) return 'ios';
  if (type === 0 || type === 1) return 'android';
  return 'unknown';
}

export function paymentDeviceFromOrder(order: any): PaymentDevice {
  const explicit = normalizePaymentDevice(order?.paymentDevice);
  if (explicit !== 'unknown') return explicit;
  if (order?.payChannel === 'wechat_pay') return 'wechat_pay';
  if (order?.payChannel === 'wechat_virtual') {
    const fromType = paymentDeviceFromVirtualOrderType(order?.virtualOrderType);
    return fromType === 'unknown' ? 'android' : fromType;
  }
  return 'unknown';
}

export function paymentDeviceLabel(value?: any) {
  const device = normalizePaymentDevice(value);
  if (device === 'ios') return 'Apple IAP';
  if (device === 'android') return '安卓/鸿蒙';
  if (device === 'wechat_pay') return '普通微信支付';
  return '未识别';
}

export function emptyPaymentDeviceBreakdown() {
  return {
    ios: { amount: 0, count: 0 },
    android: { amount: 0, count: 0 },
    wechatPay: { amount: 0, count: 0 },
    unknown: { amount: 0, count: 0 },
  };
}

export function summarizePaymentDevices(items: any[], amountGetter: (item: any) => number = (item) => Number(item?.amount || 0)) {
  const summary = emptyPaymentDeviceBreakdown();
  for (const item of items || []) {
    const amount = Math.max(0, Math.round(Number(amountGetter(item) || 0)));
    const device = paymentDeviceFromOrder(item?.order || item);
    if (device === 'ios') {
      summary.ios.amount += amount;
      summary.ios.count += 1;
    } else if (device === 'android') {
      summary.android.amount += amount;
      summary.android.count += 1;
    } else if (device === 'wechat_pay') {
      summary.wechatPay.amount += amount;
      summary.wechatPay.count += 1;
    } else {
      summary.unknown.amount += amount;
      summary.unknown.count += 1;
    }
  }
  return summary;
}
