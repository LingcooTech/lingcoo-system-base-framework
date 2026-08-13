import assert from 'node:assert/strict';
import test from 'node:test';

import { SmtpProvider } from '../src/index.js';

const config = {
  host: 'smtp.example.test',
  port: 465,
  secure: true,
  requireTls: true,
  user: 'mailer@example.test',
  from: 'Lingcoo <mailer@example.test>',
};
const credentials = { password: 'smtp-secret' };

test('SMTP provider verifies authentication and closes its transport', async () => {
  let closed = false;
  const provider = new SmtpProvider((settings) => ({
    async verify() {
      assert.equal(settings.password, credentials.password);
      return true;
    },
    async sendMail() {
      throw new Error('not used');
    },
    close() {
      closed = true;
    },
  }));

  const result = await provider.testConnection({
    config,
    credentials,
    signal: AbortSignal.timeout(1000),
  });
  assert.equal(closed, true);
  assert.equal(result.message, 'SMTP 连接与身份认证正常');
});

test('SMTP provider rejects invalid endpoints before opening a transport', async () => {
  let opened = false;
  const provider = new SmtpProvider(() => {
    opened = true;
    throw new Error('must not open');
  });
  await assert.rejects(
    () =>
      provider.testConnection({
        config: { ...config, host: 'https://smtp.example.test', port: 70_000 },
        credentials,
        signal: AbortSignal.timeout(1000),
      }),
    /SMTP 主机格式无效/,
  );
  assert.equal(opened, false);
});
