import assert from 'node:assert/strict';
import test from 'node:test';

import type { AuditQueryPort, AuditRecord } from '@lingcootech/frame-audit';
import type { IdentityAccountDirectoryPort } from '@lingcootech/frame-identity';

import { AuditService } from '../src/core/modules/audit/service.js';

const accountId = '22932865-4edb-41a5-81c9-03af4d282aac';
const records: AuditRecord[] = [
  {
    id: '9e24c275-51c2-41ac-87c8-fb09e945ca7a',
    action: 'system.started',
    resourceType: 'system',
    resourceId: null,
    actorId: 'system-worker',
    requestId: null,
    metadata: null,
    createdAt: new Date('2026-08-13T00:00:00.000Z'),
  },
  {
    id: 'bb28f928-0942-474c-b33f-233af9ca69b7',
    action: 'system.setting_updated',
    resourceType: 'system_setting',
    resourceId: 'general.system_name',
    actorId: accountId,
    requestId: 'request-1',
    metadata: { version: 2 },
    createdAt: new Date('2026-08-13T00:01:00.000Z'),
  },
];

test('Audit read composition enriches only account actors through Identity', async () => {
  let requestedActorIds: readonly string[] = [];
  const queries: AuditQueryPort = {
    async list(query) {
      return { items: records, total: records.length, page: query.page, pageSize: query.pageSize };
    },
    async findById(auditId) {
      return records.find((record) => record.id === auditId) ?? null;
    },
  };
  const accounts: IdentityAccountDirectoryPort = {
    configured: true,
    async findById() {
      return null;
    },
    async findByIds(accountIds) {
      requestedActorIds = accountIds;
      return [
        {
          id: accountId,
          email: 'owner@example.test',
          displayName: 'Owner',
          status: 'active',
        },
      ];
    },
    async listActive() {
      return [];
    },
    async search() {
      return [];
    },
    async findMatchingIds() {
      return [];
    },
  };

  const page = await new AuditService(queries, accounts).list({ page: 1, pageSize: 30 });

  assert.deepEqual(requestedActorIds, [accountId]);
  assert.equal(page.items[0]?.actor, null);
  assert.deepEqual(page.items[1]?.actor, {
    id: accountId,
    email: 'owner@example.test',
    displayName: 'Owner',
  });
  assert.equal('status' in (page.items[1]?.actor ?? {}), false);
});
