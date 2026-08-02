import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { buildApp } from '../src/app.js';
import { accountRoles, accounts, auditLogs, passwordCredentials, roles } from '../src/db/schema.js';
import { loadEnv } from '../src/lib/env.js';
import { hashPassword } from '../src/lib/password.js';
import { serializeSafeError } from '../src/lib/structured-log.js';
import { MetricsRegistry } from '../src/modules/observability/metrics.js';

function baseEnv(overrides: Record<string, string> = {}) {
  return loadEnv({
    NODE_ENV: 'test',
    APP_NAME: 'lingcoo-system-base-framework',
    APP_VERSION: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://lingcoo:lingcoo@127.0.0.1:1/unused',
    ...overrides,
  });
}

function sessionCookie(response: { headers: Record<string, string | string[] | undefined> }) {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  assert.ok(value);
  return value.split(';', 1)[0];
}

test('request metrics aggregate routes and expose Prometheus text', () => {
  const metrics = new MetricsRegistry();
  const first = metrics.beginRequest();
  metrics.finishRequest(first, 'GET', '/api/example', 200);
  const second = metrics.beginRequest();
  metrics.finishRequest(second, 'GET', '/api/example', 500);

  const [route] = metrics.breakdown();
  assert.equal(route.requestCount, 2);
  assert.equal(route.errorCount, 1);
  assert.match(metrics.prometheus(1, 2), /lingcoo_http_requests_total/);
  assert.match(metrics.prometheus(1, 2), /lingcoo_open_incidents 1/);
});

test('safe error serialization removes credentials and bearer tokens', () => {
  const secret = 'private-secret-value';
  const result = serializeSafeError(
    new Error(`password=hunter2 Authorization: Bearer access-token ${secret}`),
    [secret],
  );
  assert.doesNotMatch(result.message, /hunter2|access-token|private-secret-value/);
  assert.match(result.message, /\[REDACTED\]/);
});

test('request IDs are echoed and metrics stay hidden when no token is configured', async () => {
  const app = await buildApp(baseEnv());
  const requestId = 'external-request-12345678';
  const health = await app.inject({
    method: 'GET',
    url: '/health',
    headers: { 'x-request-id': requestId },
  });
  assert.equal(health.headers['x-request-id'], requestId);

  const metrics = await app.inject({ method: 'GET', url: '/metrics' });
  assert.equal(metrics.statusCode, 404);
  await app.close();
});

test('metrics endpoint accepts only its dedicated bearer token', async () => {
  const token = 'metrics-test-token-with-24-characters';
  const app = await buildApp(baseEnv({ METRICS_BEARER_TOKEN: token }));
  const denied = await app.inject({ method: 'GET', url: '/metrics' });
  assert.equal(denied.statusCode, 401);
  const metrics = await app.inject({
    method: 'GET',
    url: '/metrics',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(metrics.statusCode, 200);
  assert.match(metrics.body, /lingcoo_process_uptime_seconds/);
  await app.close();
});

const databaseUrl = process.env.DATABASE_URL;

test(
  'request context links audit events and grouped 5xx incidents',
  { skip: !databaseUrl },
  async () => {
    const app = await buildApp(
      loadEnv({
        NODE_ENV: 'test',
        APP_VERSION: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: databaseUrl,
        AUTH_JWT_SECRET: 'observability-test-secret-with-32-characters',
      }),
    );
    app.get('/test/observability-failure', async () => {
      throw new TypeError('test failure payload is never persisted');
    });
    const suffix = crypto.randomUUID().slice(0, 8);
    const email = `observability-${suffix}@example.test`;
    const password = 'Observability-owner-2026!';
    const [ownerRole] = await app.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, 'owner'))
      .limit(1);
    assert.ok(ownerRole);
    const [account] = await app.db
      .insert(accounts)
      .values({ email, displayName: 'Observability Owner' })
      .returning({ id: accounts.id });
    await app.db.insert(passwordCredentials).values({
      accountId: account.id,
      passwordHash: await hashPassword(password),
    });
    await app.db.insert(accountRoles).values({ accountId: account.id, roleId: ownerRole.id });
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    const cookie = sessionCookie(login);
    const requestId = `audit-link-${suffix}`;
    const setting = await app.inject({
      method: 'PATCH',
      url: '/api/system/settings/general.system_name',
      headers: { cookie, 'x-request-id': requestId },
      payload: { value: `Observability ${suffix}`, reason: 'request context test' },
    });
    assert.equal(setting.statusCode, 200);
    const [audit] = await app.db
      .select({ requestId: auditLogs.requestId })
      .from(auditLogs)
      .where(eq(auditLogs.requestId, requestId))
      .limit(1);
    assert.equal(audit?.requestId, requestId);

    const failureRequestId = `failure-link-${suffix}`;
    const failure = await app.inject({
      method: 'GET',
      url: '/test/observability-failure',
      headers: { 'x-request-id': failureRequestId },
    });
    assert.equal(failure.statusCode, 500);
    const incidents = await app.observability.listIncidents('open');
    assert.ok(
      incidents.some(
        (incident) =>
          incident.errorName === 'TypeError' && incident.latestRequestId === failureRequestId,
      ),
    );
    await app.close();
  },
);
