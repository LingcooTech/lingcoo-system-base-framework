import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import { AlipayProvider, WechatPayProvider } from '../src/index.js';

test('WeChat Pay v3 signs requests and verifies platform responses', async () => {
  const merchant = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const platform = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const platformSerialNo = 'A'.repeat(32);
  const originalFetch = globalThis.fetch;
  let authorization = '';
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get('Authorization') ?? '';
    const body = JSON.stringify({ data: [] });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 'response-nonce';
    const signer = createSign('RSA-SHA256');
    signer.update(`${timestamp}\n${nonce}\n${body}\n`);
    signer.end();
    return new Response(body, {
      headers: {
        'Wechatpay-Timestamp': timestamp,
        'Wechatpay-Nonce': nonce,
        'Wechatpay-Signature': signer.sign(platform.privateKey, 'base64'),
        'Wechatpay-Serial': platformSerialNo,
      },
    });
  };
  try {
    const result = await new WechatPayProvider().testConnection({
      config: {
        appId: 'wx1234567890abcdef',
        mchId: '1234567890',
        merchantSerialNo: 'B'.repeat(32),
        platformSerialNo,
        notifyUrl: 'https://frame.example.test/api/payments/wechat/notify',
        apiBaseUrl: 'https://api.mch.weixin.qq.com',
      },
      credentials: {
        merchantPrivateKey: merchant.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        platformPublicKey: platform.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        apiV3Key: '12345678901234567890123456789012',
      },
      signal: AbortSignal.timeout(1000),
    });
    assert.match(result.message, /API v3/);
    assert.match(authorization, /^WECHATPAY2-SHA256-RSA2048 /);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Alipay rejects malformed private keys before network requests', async () => {
  await assert.rejects(
    new AlipayProvider().testConnection({
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
