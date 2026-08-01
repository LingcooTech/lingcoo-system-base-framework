import {
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  randomBytes,
} from 'node:crypto';

import { httpError } from '../../../lib/http-error.js';
import type { IntegrationProvider, ProviderTestContext } from '../provider.js';
import {
  assertOrder,
  type PaymentNotificationResult,
  type PaymentOrderInput,
  type PaymentQueryResult,
  type PaymentRefundInput,
  type PaymentRefundResult,
  type PreparedPayment,
} from './payment-types.js';

interface WechatPaySettings {
  appId: string;
  mchId: string;
  merchantSerialNo: string;
  platformSerialNo: string;
  notifyUrl: string;
  apiBaseUrl: string;
  merchantPrivateKey: string;
  platformPublicKey: string;
  apiV3Key: string;
}

export interface WechatPayHeaders {
  timestamp: string;
  nonce: string;
  signature: string;
  serial: string;
}

function pem(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replaceAll('\\n', '\n');
}

function parseSettings(
  config: Record<string, unknown>,
  credentials: Record<string, unknown>,
): WechatPaySettings {
  const settings = {
    appId: String(config.appId ?? '').trim(),
    mchId: String(config.mchId ?? '').trim(),
    merchantSerialNo: String(config.merchantSerialNo ?? '').trim(),
    platformSerialNo: String(config.platformSerialNo ?? '').trim(),
    notifyUrl: String(config.notifyUrl ?? '').trim(),
    apiBaseUrl: String(config.apiBaseUrl ?? 'https://api.mch.weixin.qq.com')
      .trim()
      .replace(/\/+$/, ''),
    merchantPrivateKey: pem(credentials.merchantPrivateKey),
    platformPublicKey: pem(credentials.platformPublicKey),
    apiV3Key: String(credentials.apiV3Key ?? ''),
  };
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(settings.appId))
    throw httpError(422, '微信支付 AppID 格式无效', 'ValidationError');
  if (!/^\d{6,32}$/.test(settings.mchId))
    throw httpError(422, '微信支付商户号格式无效', 'ValidationError');
  if (!/^[A-Fa-f0-9]{16,64}$/.test(settings.merchantSerialNo))
    throw httpError(422, '商户证书序列号格式无效', 'ValidationError');
  if (!/^(?:[A-Fa-f0-9]{16,64}|PUB_KEY_ID_[A-Za-z0-9_]+)$/.test(settings.platformSerialNo))
    throw httpError(422, '微信支付平台证书序列号或公钥 ID 格式无效', 'ValidationError');
  const baseUrl = new URL(settings.apiBaseUrl);
  if (
    baseUrl.protocol !== 'https:' ||
    !['api.mch.weixin.qq.com', 'api2.wechatpay.cn'].includes(baseUrl.hostname)
  )
    throw httpError(422, '微信支付 API 地址必须使用官方 HTTPS 域名', 'ValidationError');
  if (new URL(settings.notifyUrl).protocol !== 'https:')
    throw httpError(422, '微信支付通知地址必须使用 HTTPS', 'ValidationError');
  if (Buffer.byteLength(settings.apiV3Key) !== 32)
    throw httpError(422, '微信支付 API v3 密钥必须为 32 字节', 'ValidationError');
  try {
    createPrivateKey(settings.merchantPrivateKey);
    createPublicKey(settings.platformPublicKey);
  } catch {
    throw httpError(422, '微信支付商户私钥或平台公钥不是有效 PEM', 'ValidationError');
  }
  return settings;
}

function pathWithQuery(url: URL): string {
  return `${url.pathname}${url.search}`;
}

function authorization(
  settings: WechatPaySettings,
  method: string,
  path: string,
  body: string,
): string {
  const nonce = randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signer = createSign('RSA-SHA256');
  signer.update(`${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`);
  signer.end();
  const signature = signer.sign(settings.merchantPrivateKey, 'base64');
  return `WECHATPAY2-SHA256-RSA2048 mchid="${settings.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${settings.merchantSerialNo}"`;
}

function responseHeaders(headers: Headers): WechatPayHeaders {
  const values = {
    timestamp: headers.get('Wechatpay-Timestamp') ?? '',
    nonce: headers.get('Wechatpay-Nonce') ?? '',
    signature: headers.get('Wechatpay-Signature') ?? '',
    serial: headers.get('Wechatpay-Serial') ?? '',
  };
  if (Object.values(values).some((value) => !value)) throw new Error('微信支付响应缺少验签头');
  return values;
}

function verifySignature(
  settings: WechatPaySettings,
  headers: WechatPayHeaders,
  body: string,
): void {
  if (headers.serial !== settings.platformSerialNo)
    throw new Error('微信支付平台证书序列号或公钥 ID 不匹配');
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300)
    throw new Error('微信支付签名时间戳已过期');
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headers.timestamp}\n${headers.nonce}\n${body}\n`);
  verifier.end();
  if (!verifier.verify(settings.platformPublicKey, headers.signature, 'base64'))
    throw new Error('微信支付平台签名无效');
}

async function request<T>(
  settings: WechatPaySettings,
  method: 'GET' | 'POST',
  pathname: string,
  signal: AbortSignal,
  payload?: Record<string, unknown>,
): Promise<T> {
  const url = new URL(pathname, settings.apiBaseUrl);
  const body = payload ? JSON.stringify(payload) : '';
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: authorization(settings, method, pathWithQuery(url), body),
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body } : {}),
    signal,
  });
  const responseBody = await response.text();
  verifySignature(settings, responseHeaders(response.headers), responseBody);
  const result = responseBody
    ? (JSON.parse(responseBody) as T & { message?: string })
    : ({} as T & { message?: string });
  if (!response.ok)
    throw new Error(`微信支付请求失败 (${response.status})：${result.message ?? '未知错误'}`);
  return result;
}

function decryptNotification(
  settings: WechatPaySettings,
  resource: Record<string, unknown>,
): Record<string, unknown> {
  const nonce = String(resource.nonce ?? '');
  const associatedData = String(resource.associated_data ?? '');
  const ciphertext = Buffer.from(String(resource.ciphertext ?? ''), 'base64');
  if (!nonce || ciphertext.length < 17) throw new Error('微信支付通知密文格式无效');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(settings.apiV3Key), nonce);
  decipher.setAAD(Buffer.from(associatedData));
  decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  const plaintext = Buffer.concat([
    decipher.update(ciphertext.subarray(0, -16)),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext) as Record<string, unknown>;
}

export class WechatPayProvider implements IntegrationProvider {
  readonly code = 'wechat-pay';
  readonly name = '微信支付';
  readonly category = 'payment' as const;
  readonly description = '微信支付 API v3 Native 下单、查询、退款及回调验签解密。';
  readonly adapterVersion = '1.0.0';
  readonly capabilities = [
    'payment.native',
    'payment.query',
    'refund.create',
    'webhook.verify',
    'webhook.decrypt',
    'connection.test',
  ];
  readonly configFields = [
    { key: 'appId', label: 'AppID', type: 'text' as const, required: true },
    { key: 'mchId', label: '商户号', type: 'text' as const, required: true },
    { key: 'merchantSerialNo', label: '商户证书序列号', type: 'text' as const, required: true },
    {
      key: 'platformSerialNo',
      label: '平台证书序列号 / 公钥 ID',
      type: 'text' as const,
      required: true,
      description: '平台公钥模式填写 PUB_KEY_ID_…；证书模式填写证书序列号。',
    },
    {
      key: 'notifyUrl',
      label: '支付结果通知地址',
      type: 'url' as const,
      required: true,
      placeholder: 'https://example.com/api/payments/wechat/notify',
    },
    {
      key: 'apiBaseUrl',
      label: '微信支付 API 地址',
      type: 'url' as const,
      required: true,
      defaultValue: 'https://api.mch.weixin.qq.com',
    },
  ];
  readonly credentialFields = [
    {
      key: 'merchantPrivateKey',
      label: '商户 API 私钥（PEM）',
      type: 'secret-textarea' as const,
      required: true,
      description: '支持原始 PEM 多行文本，也可将换行写成 \\n。',
    },
    {
      key: 'platformPublicKey',
      label: '微信支付平台公钥（PEM）',
      type: 'secret-textarea' as const,
      required: true,
      description: '用于验证 API 响应和回调签名。',
    },
    {
      key: 'apiV3Key',
      label: 'API v3 密钥',
      type: 'password' as const,
      required: true,
      description: '必须为 32 字节，用于解密回调资源。',
    },
  ];

  async testConnection({ config, credentials, signal }: ProviderTestContext) {
    const settings = parseSettings(config, credentials);
    const result = await request<{ data?: unknown[] }>(settings, 'GET', '/v3/certificates', signal);
    return {
      message: '微信支付 API v3 签名、认证与响应验签正常',
      metadata: { mchId: settings.mchId, certificateCount: result.data?.length ?? 0 },
    };
  }

  async preparePayment(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    order: PaymentOrderInput,
    signal: AbortSignal,
  ): Promise<PreparedPayment> {
    assertOrder(order);
    const settings = parseSettings(config, credentials);
    const result = await request<{ code_url?: string; prepay_id?: string }>(
      settings,
      'POST',
      '/v3/pay/transactions/native',
      signal,
      {
        appid: settings.appId,
        mchid: settings.mchId,
        description: order.subject,
        out_trade_no: order.orderNo,
        notify_url: settings.notifyUrl,
        amount: { total: order.amount, currency: order.currency },
      },
    );
    if (!result.code_url) throw new Error('微信支付 Native 下单未返回二维码地址');
    return {
      provider: 'wechat-pay',
      orderNo: order.orderNo,
      mode: 'native_qr',
      notifyUrl: settings.notifyUrl,
      payload: { qrCode: result.code_url, prepayId: result.prepay_id ?? null },
    };
  }

  async queryPayment(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    orderNo: string,
    signal: AbortSignal,
  ): Promise<PaymentQueryResult> {
    const settings = parseSettings(config, credentials);
    let result: Record<string, unknown>;
    try {
      result = await request<Record<string, unknown>>(
        settings,
        'GET',
        `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}?mchid=${encodeURIComponent(settings.mchId)}`,
        signal,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('(404)'))
        return { status: 'not_found', orderNo, providerOrderId: null, raw: {} };
      throw error;
    }
    const state = String(result.trade_state ?? '');
    const status =
      state === 'SUCCESS'
        ? 'paid'
        : ['CLOSED', 'REVOKED', 'PAYERROR'].includes(state)
          ? 'closed'
          : 'pending';
    const amount = result.amount as { total?: number; currency?: string } | undefined;
    return {
      status,
      orderNo: String(result.out_trade_no ?? orderNo),
      providerOrderId: result.transaction_id ? String(result.transaction_id) : null,
      ...(amount?.total !== undefined
        ? { amount: amount.total, currency: amount.currency ?? 'CNY' }
        : {}),
      raw: result,
    };
  }

  async refund(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    input: PaymentRefundInput,
    signal: AbortSignal,
  ): Promise<PaymentRefundResult> {
    const settings = parseSettings(config, credentials);
    const result = await request<Record<string, unknown>>(
      settings,
      'POST',
      '/v3/refund/domestic/refunds',
      signal,
      {
        ...(input.providerOrderId
          ? { transaction_id: input.providerOrderId }
          : { out_trade_no: input.orderNo }),
        out_refund_no: input.refundNo,
        ...(input.reason ? { reason: input.reason } : {}),
        amount: { refund: input.amount, total: input.totalAmount, currency: 'CNY' },
      },
    );
    return {
      status: result.status === 'SUCCESS' ? 'success' : 'processing',
      refundNo: input.refundNo,
      providerRefundId: result.refund_id ? String(result.refund_id) : null,
      raw: result,
    };
  }

  verifyNotification(
    config: Record<string, unknown>,
    credentials: Record<string, unknown>,
    headers: WechatPayHeaders,
    rawBody: string,
  ): PaymentNotificationResult {
    const settings = parseSettings(config, credentials);
    verifySignature(settings, headers, rawBody);
    const envelope = JSON.parse(rawBody) as Record<string, unknown>;
    const eventId = String(envelope.id ?? '');
    if (!eventId) throw new Error('微信支付通知缺少事件 ID');
    if (envelope.event_type !== 'TRANSACTION.SUCCESS')
      return { status: 'ignored', eventId, raw: envelope };
    const resource = decryptNotification(
      settings,
      (envelope.resource ?? {}) as Record<string, unknown>,
    );
    if (resource.appid !== settings.appId || resource.mchid !== settings.mchId)
      throw new Error('微信支付通知应用或商户不匹配');
    const amount = resource.amount as { total?: number; currency?: string } | undefined;
    if (!resource.out_trade_no || !resource.transaction_id || amount?.total === undefined)
      throw new Error('微信支付通知字段不完整');
    return {
      status: 'paid',
      eventId,
      orderNo: String(resource.out_trade_no),
      providerOrderId: String(resource.transaction_id),
      amount: amount.total,
      currency: amount.currency ?? 'CNY',
      paidAt: resource.success_time ? new Date(String(resource.success_time)) : new Date(),
      raw: resource,
    };
  }
}
