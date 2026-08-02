import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';
import test from 'node:test';

import { AlipayProvider } from '../src/modules/integrations/providers/alipay.js';
import { OpenRouterProvider } from '../src/modules/integrations/providers/openrouter.js';
import { QiniuProvider } from '../src/modules/integrations/providers/qiniu.js';
import { WechatPayProvider } from '../src/modules/integrations/providers/wechat-pay.js';

test('Qiniu adapter issues scoped upload tokens without exposing its secret', () => {
  const provider = new QiniuProvider();
  const result = provider.createUploadToken(
    {
      accessKey: 'test_access_key',
      bucketName: 'frame-assets',
      publicBaseUrl: 'https://assets.example.test',
      uploadHost: 'https://upload.qiniup.com',
      defaultPrefix: 'uploads',
    },
    { secretKey: 'never-return-this-secret' },
    { key: 'avatar.png', expiresInSeconds: 600 },
  );

  assert.equal(result.key, 'uploads/avatar.png');
  assert.equal(result.publicUrl, 'https://assets.example.test/uploads/avatar.png');
  assert.match(result.token, /^test_access_key:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
  assert.equal(JSON.stringify(result).includes('never-return-this-secret'), false);
  const policy = JSON.parse(Buffer.from(result.token.split(':')[2], 'base64url').toString()) as {
    insertOnly: number;
  };
  assert.equal(policy.insertOnly, 1);
});

test('OpenRouter adapter lists models and captures chat usage', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; authorization: string | null }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    requests.push({ url, authorization: headers.get('Authorization') });
    if (url.endsWith('/models')) {
      return Response.json({
        data: [{ id: 'openai/test-model', name: 'Test Model', context_length: 8192 }],
      });
    }
    return Response.json({
      id: 'generation-1',
      model: 'openai/test-model',
      choices: [{ message: { content: '连接正常' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
    });
  };
  try {
    const provider = new OpenRouterProvider();
    const config = {
      baseUrl: 'https://openrouter.ai/api/v1',
      siteUrl: 'https://frame.example.test',
      siteName: 'Frame Test',
      defaultModel: 'openai/test-model',
    };
    const credentials = { apiKey: 'sk-or-v1-test-key' };
    const tested = await provider.testConnection({
      config,
      credentials,
      signal: AbortSignal.timeout(1000),
    });
    const chat = await provider.chat(
      config,
      credentials,
      { messages: [{ role: 'user', content: 'test' }] },
      AbortSignal.timeout(1000),
    );
    assert.match(tested.message, /默认模型/);
    assert.equal(chat.content, '连接正常');
    assert.equal(chat.usage?.totalTokens, 6);
    assert.equal(
      requests.every((request) => request.authorization === 'Bearer sk-or-v1-test-key'),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('WeChat Pay v3 adapter signs requests and verifies platform responses', async () => {
  const merchant = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const platform = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const merchantPrivateKey = merchant.privateKey
    .export({ type: 'pkcs8', format: 'pem' })
    .toString();
  const platformPublicKey = platform.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const platformSerialNo = 'A'.repeat(32);
  const originalFetch = globalThis.fetch;
  let authorizationHeader = '';
  globalThis.fetch = async (_input, init) => {
    authorizationHeader = new Headers(init?.headers).get('Authorization') ?? '';
    const body = JSON.stringify({ data: [] });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 'response-nonce';
    const signer = createSign('RSA-SHA256');
    signer.update(`${timestamp}\n${nonce}\n${body}\n`);
    signer.end();
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Wechatpay-Timestamp': timestamp,
        'Wechatpay-Nonce': nonce,
        'Wechatpay-Signature': signer.sign(platform.privateKey, 'base64'),
        'Wechatpay-Serial': platformSerialNo,
      },
    });
  };
  try {
    const provider = new WechatPayProvider();
    const result = await provider.testConnection({
      config: {
        appId: 'wx1234567890abcdef',
        mchId: '1234567890',
        merchantSerialNo: 'B'.repeat(32),
        platformSerialNo,
        notifyUrl: 'https://frame.example.test/api/payments/wechat/notify',
        apiBaseUrl: 'https://api.mch.weixin.qq.com',
      },
      credentials: {
        merchantPrivateKey,
        platformPublicKey,
        apiV3Key: '12345678901234567890123456789012',
      },
      signal: AbortSignal.timeout(1000),
    });
    assert.match(result.message, /API v3/);
    assert.match(authorizationHeader, /^WECHATPAY2-SHA256-RSA2048 /);
    assert.match(authorizationHeader, /mchid="1234567890"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('payment adapters reject malformed private keys before network requests', async () => {
  const provider = new AlipayProvider();
  await assert.rejects(
    provider.testConnection({
      config: {
        appId: '2021000000000000',
        gateway: 'https://openapi.alipay.com/gateway.do',
        notifyUrl: 'https://frame.example.test/api/payments/alipay/notify',
        keyType: 'PKCS8',
      },
      credentials: { appPrivateKey: 'not-a-private-key', alipayPublicKey: 'not-a-public-key' },
      signal: AbortSignal.timeout(1000),
    }),
    /有效 PEM/,
  );
});
