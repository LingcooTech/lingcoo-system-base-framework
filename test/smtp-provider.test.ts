import assert from 'node:assert/strict';
import test from 'node:test';

import { SmtpProvider } from '../src/modules/integrations/providers/smtp.js';

const config = {
  host: 'smtp.example.test',
  port: 465,
  secure: true,
  requireTls: true,
  user: 'mailer@example.test',
  from: 'Lingcoo <mailer@example.test>',
};
const credentials = { password: 'smtp-secret' };

test('SMTP provider verifies authentication and always closes its transport', async () => {
  let verified = false;
  let closed = false;
  let receivedConfig: Record<string, unknown> | undefined;
  const provider = new SmtpProvider((settings) => {
    receivedConfig = settings;
    return {
      async verify() {
        verified = true;
        return true;
      },
      async sendMail() {
        throw new Error('not used');
      },
      close() {
        closed = true;
      },
    };
  });

  const result = await provider.testConnection({
    config,
    credentials,
    signal: AbortSignal.timeout(1000),
  });

  assert.equal(verified, true);
  assert.equal(closed, true);
  assert.equal(receivedConfig?.password, 'smtp-secret');
  assert.equal(result.message, 'SMTP 连接与身份认证正常');
  assert.deepEqual(result.metadata, {
    host: 'smtp.example.test',
    port: 465,
    secure: true,
    requireTls: true,
  });
});

test('SMTP provider sends safe message options and normalizes delivery results', async () => {
  let sentMessage: Record<string, unknown> | undefined;
  let closed = false;
  const provider = new SmtpProvider(() => ({
    async verify() {
      return true;
    },
    async sendMail(message) {
      sentMessage = message;
      return {
        messageId: 'message-1',
        accepted: ['recipient@example.test'],
        rejected: [],
        response: '250 queued',
      };
    },
    close() {
      closed = true;
    },
  }));

  const result = await provider.sendMail(
    config,
    credentials,
    {
      to: 'recipient@example.test',
      subject: 'SMTP test',
      text: 'Safe body',
      html: '<p>Safe body</p>',
    },
    AbortSignal.timeout(1000),
  );

  assert.equal(sentMessage?.from, config.from);
  assert.equal(sentMessage?.disableFileAccess, true);
  assert.equal(sentMessage?.disableUrlAccess, true);
  assert.equal(closed, true);
  assert.deepEqual(result, {
    messageId: 'message-1',
    accepted: ['recipient@example.test'],
    rejected: [],
    response: '250 queued',
  });
});

test('SMTP provider rejects invalid connection endpoints before opening a transport', async () => {
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
