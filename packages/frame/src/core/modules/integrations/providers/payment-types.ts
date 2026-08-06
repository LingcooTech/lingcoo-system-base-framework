export interface PaymentOrderInput {
  orderNo: string;
  subject: string;
  amount: number;
  currency: 'CNY';
}

export interface PreparedPayment {
  provider: 'alipay' | 'wechat-pay';
  orderNo: string;
  mode: 'page_redirect' | 'native_qr';
  notifyUrl: string;
  payload: Record<string, unknown>;
}

export interface PaymentQueryResult {
  status: 'paid' | 'pending' | 'closed' | 'not_found';
  orderNo: string;
  providerOrderId: string | null;
  amount?: number;
  currency?: string;
  raw: Record<string, unknown>;
}

export interface PaymentRefundInput {
  orderNo: string;
  providerOrderId?: string;
  refundNo: string;
  amount: number;
  totalAmount: number;
  reason?: string;
}

export interface PaymentRefundResult {
  status: 'success' | 'processing';
  refundNo: string;
  providerRefundId: string | null;
  raw: Record<string, unknown>;
}

export interface PaymentNotificationResult {
  status: 'paid' | 'ignored';
  eventId: string;
  orderNo?: string;
  providerOrderId?: string;
  amount?: number;
  currency?: string;
  paidAt?: Date;
  raw: Record<string, unknown>;
}

export function assertOrder(order: PaymentOrderInput): void {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(order.orderNo)) throw new Error('支付订单号格式无效');
  if (!order.subject.trim() || order.subject.length > 120) throw new Error('支付标题格式无效');
  if (!Number.isSafeInteger(order.amount) || order.amount < 1)
    throw new Error('支付金额必须为正整数分');
  if (order.currency !== 'CNY') throw new Error('当前支付适配器仅支持 CNY');
}

export function yuanFromFen(amount: number): string {
  return (amount / 100).toFixed(2);
}

export function fenFromYuan(amount: unknown): number {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) throw new Error('支付金额格式无效');
  return Math.round(value * 100);
}
