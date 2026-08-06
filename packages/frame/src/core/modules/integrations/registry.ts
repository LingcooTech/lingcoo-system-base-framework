import type { IntegrationProvider } from './provider.js';
import { IntegrationProviderRegistry } from './provider.js';
import { AlipayProvider } from './providers/alipay.js';
import { OpenRouterProvider } from './providers/openrouter.js';
import { QiniuProvider } from './providers/qiniu.js';
import { SmtpProvider } from './providers/smtp.js';
import { WechatPayProvider } from './providers/wechat-pay.js';

const diagnosticProvider: IntegrationProvider = {
  code: 'framework-diagnostic',
  name: '框架诊断 Provider',
  category: 'developer',
  description: '只在自动化测试环境注册，用于验证 Provider 生命周期。',
  adapterVersion: '1.0.0',
  capabilities: ['connection.test'],
  configFields: [
    {
      key: 'responseMessage',
      label: '测试响应',
      type: 'text',
      required: true,
    },
  ],
  credentialFields: [
    {
      key: 'token',
      label: '测试密钥',
      type: 'password',
      required: true,
    },
  ],
  async testConnection({ config, credentials }) {
    if (credentials.token !== 'diagnostic-secret') throw new Error('诊断密钥无效');
    return {
      message: String(config.responseMessage),
      metadata: { source: 'diagnostic', reflectedToken: credentials.token },
    };
  },
};

export function createIntegrationProviderRegistry(
  environment: 'development' | 'test' | 'production',
): IntegrationProviderRegistry {
  const registry = new IntegrationProviderRegistry();
  registry.register(new SmtpProvider());
  registry.register(new QiniuProvider());
  registry.register(new AlipayProvider());
  registry.register(new WechatPayProvider());
  registry.register(new OpenRouterProvider());
  if (environment === 'test') registry.register(diagnosticProvider);
  return registry;
}
