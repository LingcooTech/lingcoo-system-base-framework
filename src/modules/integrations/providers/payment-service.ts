import { httpError } from '../../../lib/http-error.js';
import type { IntegrationService } from '../service.js';
import { AlipayProvider } from './alipay.js';
import type { PaymentOrderInput, PaymentRefundInput } from './payment-types.js';
import { WechatPayProvider, type WechatPayHeaders } from './wechat-pay.js';

export class PaymentService {
  constructor(private readonly integrations: IntegrationService) {}

  prepare(
    connectionId: string,
    providerCode: 'alipay' | 'wechat-pay',
    order: PaymentOrderInput,
    options: { mode?: 'page_redirect' | 'native_qr'; actorId?: string } = {},
  ) {
    return this.integrations.executeConnection({
      connectionId,
      providerCode,
      operation: 'payment.prepare',
      actorId: options.actorId,
      execute: async ({ provider, config, credentials, signal }) => {
        const value =
          provider instanceof AlipayProvider
            ? await provider.preparePayment(config, credentials, order, options.mode)
            : provider instanceof WechatPayProvider
              ? await provider.preparePayment(config, credentials, order, signal)
              : (() => {
                  throw httpError(500, '支付 Provider 注册无效', 'ConfigurationError');
                })();
        return {
          value,
          message: `${provider.name}已创建支付请求`,
          metadata: { orderNo: order.orderNo, amount: order.amount, mode: value.mode },
        };
      },
    });
  }

  query(connectionId: string, providerCode: 'alipay' | 'wechat-pay', orderNo: string) {
    return this.integrations.executeConnection({
      connectionId,
      providerCode,
      operation: 'payment.query',
      execute: async ({ provider, config, credentials, signal }) => {
        const value =
          provider instanceof AlipayProvider
            ? await provider.queryPayment(config, credentials, orderNo)
            : provider instanceof WechatPayProvider
              ? await provider.queryPayment(config, credentials, orderNo, signal)
              : (() => {
                  throw httpError(500, '支付 Provider 注册无效', 'ConfigurationError');
                })();
        return {
          value,
          message: `${provider.name}支付查询完成`,
          metadata: { orderNo, status: value.status },
        };
      },
    });
  }

  refund(
    connectionId: string,
    providerCode: 'alipay' | 'wechat-pay',
    input: PaymentRefundInput,
    actorId?: string,
  ) {
    return this.integrations.executeConnection({
      connectionId,
      providerCode,
      operation: 'payment.refund',
      actorId,
      execute: async ({ provider, config, credentials, signal }) => {
        const value =
          provider instanceof AlipayProvider
            ? await provider.refund(config, credentials, input)
            : provider instanceof WechatPayProvider
              ? await provider.refund(config, credentials, input, signal)
              : (() => {
                  throw httpError(500, '支付 Provider 注册无效', 'ConfigurationError');
                })();
        return {
          value,
          message: `${provider.name}退款请求已提交`,
          metadata: { orderNo: input.orderNo, refundNo: input.refundNo, amount: input.amount },
        };
      },
    });
  }

  verifyAlipayNotification(connectionId: string, form: Record<string, string>) {
    return this.integrations.executeConnection({
      connectionId,
      providerCode: 'alipay',
      operation: 'payment.webhook.verify',
      execute: async ({ provider, config, credentials }) => {
        if (!(provider instanceof AlipayProvider))
          throw httpError(500, '支付宝 Provider 注册无效', 'ConfigurationError');
        const value = provider.verifyNotification(config, credentials, form);
        return {
          value,
          message: '支付宝异步通知验签通过',
          metadata: { eventId: value.eventId, status: value.status, orderNo: value.orderNo },
        };
      },
    });
  }

  verifyWechatNotification(connectionId: string, headers: WechatPayHeaders, rawBody: string) {
    return this.integrations.executeConnection({
      connectionId,
      providerCode: 'wechat-pay',
      operation: 'payment.webhook.verify',
      execute: async ({ provider, config, credentials }) => {
        if (!(provider instanceof WechatPayProvider))
          throw httpError(500, '微信支付 Provider 注册无效', 'ConfigurationError');
        const value = provider.verifyNotification(config, credentials, headers, rawBody);
        return {
          value,
          message: '微信支付通知验签与解密通过',
          metadata: { eventId: value.eventId, status: value.status, orderNo: value.orderNo },
        };
      },
    });
  }
}
