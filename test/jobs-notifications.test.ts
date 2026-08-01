import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { buildApp } from '../src/app.js';
import { accountRoles, accounts, passwordCredentials, roles } from '../src/db/schema.js';
import { loadEnv } from '../src/lib/env.js';
import { hashPassword } from '../src/lib/password.js';
import { JobHandlerRegistry, OutboxSubscriberRegistry } from '../src/modules/jobs/registry.js';
import { computeBackoffMs, JobService } from '../src/modules/jobs/service.js';
import { OutboxService } from '../src/modules/jobs/outbox.js';

test('job backoff is exponential and capped', () => {
  assert.equal(computeBackoffMs(1), 5000);
  assert.equal(computeBackoffMs(2), 10_000);
  assert.equal(computeBackoffMs(20), 15 * 60_000);
});

test('job and outbox registries reject duplicates and dispatch subscribers', async () => {
  const jobs = new JobHandlerRegistry();
  jobs.register('test.run', async ({ payload }) => ({ reflected: payload.value }));
  assert.throws(() => jobs.register('test.run', async () => ({})), /already registered/);
  assert.deepEqual(
    await jobs.execute('test.run', {
      jobId: 'job-1',
      payload: { value: 'ok' },
      signal: AbortSignal.timeout(1000),
    }),
    { reflected: 'ok' },
  );

  const events = new OutboxSubscriberRegistry();
  const received: string[] = [];
  events.subscribe('example.created', async () => void received.push('specific'));
  events.subscribe('*', async () => void received.push('wildcard'));
  await events.dispatch({
    eventId: 'event-1',
    topic: 'example.created',
    payload: {},
    aggregateType: null,
    aggregateId: null,
  });
  assert.deepEqual(received, ['specific', 'wildcard']);
});

const databaseUrl = process.env.DATABASE_URL;

function sessionCookie(response: { headers: Record<string, string | string[] | undefined> }) {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  assert.ok(value);
  return value.split(';', 1)[0];
}

test(
  'job persistence and notification APIs support idempotency and account inbox state',
  { skip: !databaseUrl },
  async () => {
    const app = await buildApp(
      loadEnv({
        NODE_ENV: 'test',
        APP_VERSION: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: databaseUrl,
        AUTH_JWT_SECRET: 'jobs-notifications-test-secret-32-characters',
      }),
    );
    const email = 'jobs-notifications-owner@example.test';
    const password = 'Jobs-notifications-2026!';
    const [ownerRole] = await app.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, 'owner'))
      .limit(1);
    assert.ok(ownerRole);
    const [account] = await app.db
      .insert(accounts)
      .values({ email, displayName: 'Job Owner' })
      .onConflictDoUpdate({ target: accounts.email, set: { status: 'active' } })
      .returning({ id: accounts.id });
    const passwordHash = await hashPassword(password);
    await app.db
      .insert(passwordCredentials)
      .values({ accountId: account.id, passwordHash })
      .onConflictDoUpdate({ target: passwordCredentials.accountId, set: { passwordHash } });
    await app.db
      .insert(accountRoles)
      .values({ accountId: account.id, roleId: ownerRole.id })
      .onConflictDoNothing();
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    assert.equal(login.statusCode, 200);
    const cookie = sessionCookie(login);

    const announcement = await app.inject({
      method: 'POST',
      url: '/api/notifications/announcements',
      headers: { cookie },
      payload: {
        title: '系统通知测试',
        body: '通知基础层工作正常。',
        level: 'info',
        sendEmail: false,
      },
    });
    assert.equal(announcement.statusCode, 201);
    assert.ok(announcement.json().result.recipientCount >= 1);

    const inbox = await app.inject({
      method: 'GET',
      url: '/api/notifications/me',
      headers: { cookie },
    });
    assert.equal(inbox.statusCode, 200);
    const item = inbox
      .json()
      .items.find((value: { title: string }) => value.title === '系统通知测试');
    assert.ok(item);
    const read = await app.inject({
      method: 'POST',
      url: `/api/notifications/${item.id}/read`,
      headers: { cookie },
    });
    assert.equal(read.statusCode, 200);
    assert.equal(read.json().notification.status, 'read');

    const emailAnnouncement = await app.inject({
      method: 'POST',
      url: '/api/notifications/announcements',
      headers: { cookie },
      payload: {
        title: '邮件通道验证',
        body: '没有启用 SMTP 时不能接受邮件投递。',
        level: 'info',
        sendEmail: true,
      },
    });
    assert.equal(emailAnnouncement.statusCode, 422);

    const deliveries = await app.inject({
      method: 'GET',
      url: '/api/notifications/deliveries',
      headers: { cookie },
    });
    assert.equal(deliveries.statusCode, 200);

    const jobs = new JobService(app.db);
    const dedupeKey = `test-job:${crypto.randomUUID()}`;
    const first = await jobs.enqueue({ kind: 'test.run', dedupeKey, payload: { safe: true } });
    const duplicate = await jobs.enqueue({ kind: 'test.run', dedupeKey, payload: { safe: false } });
    assert.equal(first.id, duplicate.id);
    const claimed = await jobs.claimNext('test-worker');
    assert.ok(claimed);
    await jobs.markSucceeded(claimed.id, { ok: true });
    const jobList = await app.inject({ method: 'GET', url: '/api/jobs', headers: { cookie } });
    assert.equal(jobList.statusCode, 200);
    const listedJob = jobList.json().items.find((value: { id: string }) => value.id === first.id);
    assert.ok(listedJob);
    assert.equal('payload' in listedJob, false);
    assert.equal('result' in listedJob, false);

    const outbox = new OutboxService(app.db);
    const eventKey = `test-event:${crypto.randomUUID()}`;
    const event = await outbox.publish({ topic: 'test.created', dedupeKey: eventKey });
    const duplicateEvent = await outbox.publish({ topic: 'test.created', dedupeKey: eventKey });
    assert.equal(event.id, duplicateEvent.id);
    const outboxList = await app.inject({
      method: 'GET',
      url: '/api/jobs/outbox',
      headers: { cookie },
    });
    assert.equal(outboxList.statusCode, 200);
    const listedEvent = outboxList
      .json()
      .items.find((value: { id: string }) => value.id === event.id);
    assert.ok(listedEvent);
    assert.equal('payload' in listedEvent, false);
    await app.close();
  },
);
