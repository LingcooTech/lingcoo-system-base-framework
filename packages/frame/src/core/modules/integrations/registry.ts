import type { IntegrationProvider } from './provider.js';
import { IntegrationProviderRegistry } from './provider.js';
import { OpenRouterProvider } from '@lingcootech/frame-ai-openrouter';
import { SmtpProvider } from '@lingcootech/frame-mail-nodemailer';
import { AlipayProvider, WechatPayProvider } from '@lingcootech/frame-payments';
import { QiniuProvider } from '@lingcootech/frame-storage-qiniu';

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
