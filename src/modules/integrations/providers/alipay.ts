import { createPrivateKey, createPublicKey } from 'node:crypto';

import { AlipaySdk } from 'alipay-sdk';

import { httpError } from '../../../lib/http-error.js';
import type { IntegrationProvider, ProviderTestContext } from '../provider.js';
import {
  assertOrder,
  fenFromYuan,
  type PaymentNotificationResult,
  type PaymentOrderInput,
  type PaymentQueryResult,
  type PaymentRefundInput,
  type PaymentRefundResult,
  type PreparedPayment,
  yuanFromFen,
} from './payment-types.js';

interface AlipaySettings {
  appId: string;
  gateway: string;
  notifyUrl: string;
  returnUrl: string;
  keyType: 'PKCS1' | 'PKCS8';
  privateKey: string;
  alipayPublicKey: string;
}

function pem(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replaceAll('\\n', '\n');
}

function parseSettings(
  config: Record<string, unknown>,
  credentials: Record<string, unknown>,
): AlipaySettings {
  const settings = {
    appId: String(config.appId ?? '').trim(),
    gateway: String(config.gateway ?? 'https://openapi.alipay.com/gateway.do').trim(),
    notifyUrl: String(config.notifyUrl ?? '').trim(),
    returnUrl: String(config.returnUrl ?? '').trim(),
    keyType: String(config.keyType ?? 'PKCS8')
      .trim()
      .toUpperCase(),
    privateKey: pem(credentials.appPrivateKey),
    alipayPublicKey: pem(credentials.alipayPublicKey),
  };
  if (settings.keyType !== 'PKCS1' && settings.keyType !== 'PKCS8') {
    throw httpError(422, '支付宝私钥格式只能是 PKCS1 或 PKCS8', 'ValidationError');
  }
  if (!/^\d{16,32}$/.test(settings.appId)) {
    throw httpError(422, '支付宝应用 ID 格式无效', 'ValidationError');
  }
  const gateway = new URL(settings.gateway);
  if (
    gateway.protocol !== 'https:' ||
    !['openapi.alipay.com', 'openapi-sandbox.dl.alipaydev.com'].includes(gateway.hostname)
  ) {
    throw httpError(422, '支付宝网关必须使用官方 HTTPS 地址', 'ValidationError');
  }
  for (const [label, value] of [
    ['异步通知地址', settings.notifyUrl],
    ['支付完成返回地址', settings.returnUrl],
  ] as const) {
    if (value && new URL(value).protocol !== 'https:') {
      throw httpError(422, `${label}必须使用 HTTPS`, 'ValidationError');
    }
  }
  try {
    createPrivateKey(settings.privateKey);
    createPublicKey(settings.alipayPublicKey);
  } catch {
    throw httpError(422, '支付宝应用私钥或支付宝公钥不是有效 PEM', 'ValidationError');
  }
  return settings as AlipaySettings;
}

function sdk(settings: AlipaySettings): AlipaySdk {
  return new AlipaySdk({
    appId: settings.appId,
    privateKey: settings.privateKey,
    alipayPublicKey: settings.alipayPublicKey,
    gateway: settings.gateway,
    keyType: settings.keyType,
    timeout: 10_000,
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export class AlipayProvider implements IntegrationProvider {
  readonly code = 'alipay';
  readonly name = '支付宝';
  readonly category = 'payment' as const;
  readonly description = '支付宝电脑网站与当面付、交易查询、退款和异步通知验签。';
  readonly adapterVersion = '1.0.0';
  readonly capabilities = [
    'payment.page',
    'payment.native',
    'payment.query',
    'refund.create',
    'webhook.verify',
    'connection.test',
  ];
  readonly configFields = [
    { key: 'appId', label: '支付宝应用 ID', type: 'text' as const, required: true },
    {
      key: 'gateway',
      label: '支付宝网关',
      type: 'url' as const,
      required: true,
      defaultValue: 'https://openapi.alipay.com/gateway.do',
      description: '正式环境使用默认地址；沙箱可使用支付宝官方沙箱网关。',
    },
    {
      key: 'notifyUrl',
      label: '异步通知地址',
      type: 'url' as const,
      required: true,
      placeholder: 'https://example.com/api/payments/alipay/notify',
    },
    {
      key: 'returnUrl',
      label: '支付完成返回地址',
      type: 'url' as const,
      placeholder: 'https://example.com/payment/result',
    },
    {
      key: 'keyType',
      label: '应用私钥格式',
      type: 'text' as const,
      required: true,
      defaultValue: 'PKCS8',
      description: '支付宝密钥工具默认通常为 PKCS8；仅支持 PKCS1 或 PKCS8。',
    },
  ];
  readonly credentialFields = [
    {
      key: 'appPrivateKey',
      label: '应用私钥（PKCS8 PEM）',
      type: 'secret-textarea' as const,
      required: true,
      description: '可将换行写成 \\n，保存后加密且不回传。',
    },
    {
      key: 'alipayPublicKey',
      label: '支付宝公钥（PEM）',
      type: 'secret-textarea' as const,
      required: true,
      description: '不是应用公钥；用于响应与异步通知验签。',
    },
  ];

  async testConnection({ config, credentials }: ProviderTestContext) {
    const settings = parseSettings(config, credentials);
    const result = await sdk(settings).exec('alipay.trade.query', {
      bizContent: { outTradeNo: `FRAME_TEST_${Date.now()}` },
    });
    const code = text(result.code);
    if (code !== '10000' && code !== '40004') {
      throw new Error(
        `支付宝配置验证失败：${code || '未知代码'} ${text(result.subMsg) || text(result.msg)}`,
      );
    }
    return { message: '支付宝 RSA2 签名与网关认证正常', metadata: { appId: settings.appId } };
  }

  async preparePayment(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    order: PaymentOrderInput,
    mode: 'page_redirect' | 'native_qr' = 'page_redirect',
  ): Promise<PreparedPayment> {
    assertOrder(order);
    const settings = parseSettings(config, credentials);
    if (mode === 'native_qr') {
      const result = await sdk(settings).exec('alipay.trade.precreate', {
        notifyUrl: settings.notifyUrl,
        bizContent: {
          outTradeNo: order.orderNo,
          subject: order.subject,
          totalAmount: yuanFromFen(order.amount),
        },
      });
      const qrCode = text(result.qrCode) || text(result.qr_code);
      if (text(result.code) !== '10000' || !qrCode)
        throw new Error(`支付宝预创建失败：${text(result.subMsg) || text(result.msg)}`);
      return {
        provider: 'alipay',
        orderNo: order.orderNo,
        mode,
        notifyUrl: settings.notifyUrl,
        payload: { qrCode },
      };
    }
    const checkoutUrl = sdk(settings).pageExecute('alipay.trade.page.pay', 'GET', {
      notifyUrl: settings.notifyUrl,
      ...(settings.returnUrl ? { returnUrl: settings.returnUrl } : {}),
      bizContent: {
        outTradeNo: order.orderNo,
        productCode: 'FAST_INSTANT_TRADE_PAY',
        subject: order.subject,
        totalAmount: yuanFromFen(order.amount),
      },
    });
    return {
      provider: 'alipay',
      orderNo: order.orderNo,
      mode,
      notifyUrl: settings.notifyUrl,
      payload: { checkoutUrl },
    };
  }

  async queryPayment(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    orderNo: string,
  ): Promise<PaymentQueryResult> {
    const settings = parseSettings(config, credentials);
    const result = (await sdk(settings).exec('alipay.trade.query', {
      bizContent: { outTradeNo: orderNo },
    })) as Record<string, unknown>;
    const code = text(result.code);
    const tradeStatus = text(result.tradeStatus) || text(result.trade_status);
    if (code === '40004')
      return { status: 'not_found', orderNo, providerOrderId: null, raw: result };
    if (code !== '10000')
      throw new Error(`支付宝查询失败：${text(result.subMsg) || text(result.msg)}`);
    const status =
      tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED'
        ? 'paid'
        : tradeStatus === 'TRADE_CLOSED'
          ? 'closed'
          : 'pending';
    return {
      status,
      orderNo: text(result.outTradeNo) || text(result.out_trade_no) || orderNo,
      providerOrderId: text(result.tradeNo) || text(result.trade_no) || null,
      ...(result.totalAmount || result.total_amount
        ? { amount: fenFromYuan(result.totalAmount ?? result.total_amount), currency: 'CNY' }
        : {}),
      raw: result,
    };
  }

  async refund(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    input: PaymentRefundInput,
  ): Promise<PaymentRefundResult> {
    const settings = parseSettings(config, credentials);
    const result = (await sdk(settings).exec('alipay.trade.refund', {
      bizContent: {
        outTradeNo: input.orderNo,
        ...(input.providerOrderId ? { tradeNo: input.providerOrderId } : {}),
        refundAmount: yuanFromFen(input.amount),
        outRequestNo: input.refundNo,
        ...(input.reason ? { refundReason: input.reason } : {}),
      },
    })) as Record<string, unknown>;
    if (text(result.code) !== '10000')
      throw new Error(`支付宝退款失败：${text(result.subMsg) || text(result.msg)}`);
    return {
      status: 'success',
      refundNo: input.refundNo,
      providerRefundId: text(result.tradeNo) || text(result.trade_no) || null,
      raw: result,
    };
  }

  verifyNotification(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    form: Record<string, string>,
  ): PaymentNotificationResult {
    const settings = parseSettings(config, credentials);
    if (!sdk(settings).checkNotifySignV2(form)) throw new Error('支付宝异步通知签名无效');
    if (form.app_id && form.app_id !== settings.appId)
      throw new Error('支付宝异步通知应用 ID 不匹配');
    const eventId = form.notify_id || form.trade_no || form.out_trade_no;
    if (!eventId) throw new Error('支付宝异步通知缺少事件标识');
    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(form.trade_status)) {
      return { status: 'ignored', eventId, raw: form };
    }
    if (!form.out_trade_no || !form.trade_no || !form.total_amount)
      throw new Error('支付宝异步通知字段不完整');
    return {
      status: 'paid',
      eventId,
      orderNo: form.out_trade_no,
      providerOrderId: form.trade_no,
      amount: fenFromYuan(form.total_amount),
      currency: 'CNY',
      paidAt: form.gmt_payment
        ? new Date(form.gmt_payment.replace(' ', 'T') + '+08:00')
        : new Date(),
      raw: form,
    };
  }
}
