import assert from 'node:assert/strict';
import test from 'node:test';

import { QiniuProvider } from '../src/index.js';

test('Qiniu adapter issues scoped upload tokens without exposing its secret', () => {
  const result = new QiniuProvider().createUploadToken(
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
  assert.match(result.token, /^test_access_key:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
  assert.equal(JSON.stringify(result).includes('never-return-this-secret'), false);
});
