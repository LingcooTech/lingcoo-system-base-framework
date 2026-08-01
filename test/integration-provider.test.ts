import assert from 'node:assert/strict';
import test from 'node:test';

import {
  IntegrationProviderRegistry,
  validateProviderFields,
} from '../src/modules/integrations/provider.js';
import { createIntegrationProviderRegistry } from '../src/modules/integrations/registry.js';

test('production registry installs all shared service adapters', () => {
  const registry = createIntegrationProviderRegistry('production');
  const providers = registry.list();

  assert.deepEqual(
    providers.map((provider) => provider.code),
    ['openrouter', 'smtp', 'wechat-pay', 'alipay', 'qiniu'],
  );
  assert.equal(
    providers.every((provider) => provider.availability === 'available'),
    true,
  );
  assert.equal(typeof registry.requireAdapter('smtp').testConnection, 'function');
  assert.equal(typeof registry.requireAdapter('qiniu').testConnection, 'function');
  assert.equal(typeof registry.requireAdapter('alipay').testConnection, 'function');
  assert.equal(typeof registry.requireAdapter('wechat-pay').testConnection, 'function');
  assert.equal(typeof registry.requireAdapter('openrouter').testConnection, 'function');
});

test('test registry installs the diagnostic adapter with no executable function in manifests', () => {
  const registry = createIntegrationProviderRegistry('test');
  const diagnostic = registry.list().find((provider) => provider.code === 'framework-diagnostic');

  assert.equal(diagnostic?.availability, 'available');
  assert.equal('testConnection' in (diagnostic ?? {}), false);
  assert.equal(typeof registry.getAdapter('framework-diagnostic')?.testConnection, 'function');
});

test('provider fields reject unknown keys, missing values and invalid URLs', () => {
  const fields = [
    { key: 'endpoint', label: '服务地址', type: 'url' as const, required: true },
    { key: 'retries', label: '重试次数', type: 'number' as const },
  ];

  assert.doesNotThrow(() =>
    validateProviderFields(fields, { endpoint: 'https://example.test', retries: 3 }, '连接配置'),
  );
  assert.throws(() => validateProviderFields(fields, {}, '连接配置'), /服务地址不能为空/);
  assert.throws(
    () => validateProviderFields(fields, { endpoint: 'file:///tmp/secret' }, '连接配置'),
    /HTTP\(S\)/,
  );
  assert.throws(
    () =>
      validateProviderFields(
        fields,
        { endpoint: 'https://example.test', unexpected: true },
        '连接配置',
      ),
    /未知字段/,
  );
});

test('provider registry prevents accidental duplicate adapters', () => {
  const registry = new IntegrationProviderRegistry();
  const provider = {
    code: 'duplicate',
    name: 'Duplicate',
    category: 'developer' as const,
    description: 'duplicate guard',
    adapterVersion: '1.0.0',
    capabilities: [],
    configFields: [],
    credentialFields: [],
    async testConnection() {
      return { message: 'ok' };
    },
  };
  registry.register(provider);
  assert.throws(() => registry.register(provider), /already registered/);
});
