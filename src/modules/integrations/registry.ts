import type { IntegrationProvider } from './provider.js';
import { IntegrationProviderRegistry } from './provider.js';

const plannedProviders = [
  {
    code: 'smtp',
    name: 'SMTP 邮件服务',
    category: 'communication' as const,
    description: '事务邮件、验证码和系统通知的统一发送通道。',
    capabilities: ['email.send', 'connection.test'],
    configFields: [],
    credentialFields: [],
  },
  {
    code: 'qiniu',
    name: '七牛云对象存储',
    category: 'storage' as const,
    description: '文件上传、私有访问、资源域名和生命周期管理。',
    capabilities: ['object.put', 'object.delete', 'object.sign', 'connection.test'],
    configFields: [],
    credentialFields: [],
  },
  {
    code: 'payment',
    name: '支付网关',
    category: 'payment' as const,
    description: '订单支付、退款、回调验签和账务事件的通用边界。',
    capabilities: ['payment.create', 'refund.create', 'webhook.verify', 'connection.test'],
    configFields: [],
    credentialFields: [],
  },
  {
    code: 'ai-hub',
    name: 'AI Hub',
    category: 'ai' as const,
    description: '统一管理模型端点、API 凭据、调用策略和健康状态。',
    capabilities: ['model.invoke', 'model.list', 'connection.test'],
    configFields: [],
    credentialFields: [],
  },
];

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
  for (const provider of plannedProviders) registry.registerManifest(provider);
  if (environment === 'test') registry.register(diagnosticProvider);
  return registry;
}
