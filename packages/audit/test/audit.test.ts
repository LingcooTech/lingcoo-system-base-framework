import assert from 'node:assert/strict';
import test from 'node:test';

import type { Database } from '@lingcootech/frame-database';
import { auditLogs } from '@lingcootech/frame-database/schema';

import { createNoopAuditCommandPort, createNoopAuditQueryPort } from '../src/index.js';
import { PostgresAuditCommandPort } from '../src/postgres.js';

test('Audit exposes an infrastructure-neutral no-op command port', async () => {
  await assert.doesNotReject(
    createNoopAuditCommandPort().record({
      action: 'test.recorded',
      resourceType: 'test',
    }),
  );
});

test('Audit exposes an infrastructure-neutral empty query port', async () => {
  const queries = createNoopAuditQueryPort();
  assert.deepEqual(await queries.list({ page: 2, pageSize: 25 }), {
    items: [],
    total: 0,
    page: 2,
    pageSize: 25,
  });
  assert.equal(await queries.findById('missing'), null);
});

test('Postgres adapter maps events and fills missing actor/request values from context', async () => {
  const inserted: Record<string, unknown>[] = [];
  const database = {
    insert(table: unknown) {
      assert.equal(table, auditLogs);
      return {
        async values(value: Record<string, unknown>) {
          inserted.push(value);
        },
      };
    },
  } as unknown as Database;
  const audit = new PostgresAuditCommandPort(database, () => ({
    actorId: 'context-actor',
    requestId: 'context-request',
  }));

  await audit.record({
    action: 'test.created',
    resourceType: 'test',
    resourceId: 'resource-1',
    metadata: { stable: true },
  });
  await audit.record({
    action: 'test.updated',
    resourceType: 'test',
    actorId: 'event-actor',
    requestId: 'event-request',
  });

  assert.deepEqual(inserted, [
    {
      action: 'test.created',
      resourceType: 'test',
      resourceId: 'resource-1',
      actorId: 'context-actor',
      requestId: 'context-request',
      metadata: { stable: true },
    },
    {
      action: 'test.updated',
      resourceType: 'test',
      resourceId: undefined,
      actorId: 'event-actor',
      requestId: 'event-request',
      metadata: undefined,
    },
  ]);
});
