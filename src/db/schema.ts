import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    displayName: text('display_name').notNull(),
    status: text('status').notNull().default('active'),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('accounts_status_idx').on(table.status)],
);

export const passwordCredentials = pgTable('password_credentials', {
  accountId: uuid('account_id')
    .primaryKey()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable('permissions', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accountRoles = pgTable(
  'account_roles',
  {
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.roleId] }),
    index('account_roles_role_idx').on(table.roleId),
  ],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionCode: text('permission_code')
      .notNull()
      .references(() => permissions.code, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionCode] })],
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('auth_sessions_account_idx').on(table.accountId),
    index('auth_sessions_expires_idx').on(table.expiresAt),
  ],
);

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  actorId: text('actor_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerCode: text('provider_code').notNull(),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    encryptedCredentials: jsonb('encrypted_credentials').notNull(),
    credentialKeys: jsonb('credential_keys').$type<string[]>().notNull().default([]),
    lastTestStatus: text('last_test_status'),
    lastTestMessage: text('last_test_message'),
    lastTestDurationMs: integer('last_test_duration_ms'),
    lastTestAt: timestamp('last_test_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('integration_connections_provider_idx').on(table.providerCode),
    index('integration_connections_enabled_idx').on(table.enabled),
  ],
);

export const integrationEvents = pgTable(
  'integration_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => integrationConnections.id, { onDelete: 'cascade' }),
    operation: text('operation').notNull(),
    outcome: text('outcome').notNull(),
    durationMs: integer('duration_ms'),
    message: text('message'),
    actorId: uuid('actor_id').references(() => accounts.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('integration_events_connection_idx').on(table.connectionId),
    index('integration_events_created_at_idx').on(table.createdAt),
  ],
);

export const jobRuns = pgTable(
  'job_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    queue: text('queue').notNull().default('default'),
    kind: text('kind').notNull(),
    status: text('status').notNull().default('pending'),
    priority: integer('priority').notNull().default(100),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    result: jsonb('result').$type<Record<string, unknown>>(),
    dedupeKey: text('dedupe_key'),
    relatedEntityType: text('related_entity_type'),
    relatedEntityId: text('related_entity_id'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: text('locked_by'),
    lastError: text('last_error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('job_runs_claim_idx').on(table.status, table.availableAt, table.priority),
    index('job_runs_kind_created_idx').on(table.kind, table.createdAt),
    uniqueIndex('job_runs_dedupe_key_idx').on(table.dedupeKey),
  ],
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    topic: text('topic').notNull(),
    status: text('status').notNull().default('pending'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    aggregateType: text('aggregate_type'),
    aggregateId: text('aggregate_id'),
    dedupeKey: text('dedupe_key'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: text('locked_by'),
    lastError: text('last_error'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('outbox_events_claim_idx').on(table.status, table.availableAt),
    index('outbox_events_topic_idx').on(table.topic, table.createdAt),
    uniqueIndex('outbox_events_dedupe_key_idx').on(table.dedupeKey),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipientAccountId: uuid('recipient_account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    category: text('category').notNull().default('system'),
    level: text('level').notNull().default('info'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    ctaLabel: text('cta_label'),
    ctaUrl: text('cta_url'),
    status: text('status').notNull().default('unread'),
    sourceEventId: uuid('source_event_id').references(() => outboxEvents.id, {
      onDelete: 'set null',
    }),
    sourceEventName: text('source_event_name'),
    dedupeKey: text('dedupe_key').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_recipient_status_idx').on(
      table.recipientAccountId,
      table.status,
      table.createdAt,
    ),
    index('notifications_category_idx').on(table.category, table.createdAt),
    uniqueIndex('notifications_dedupe_key_idx').on(table.dedupeKey),
  ],
);

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    destination: text('destination').notNull(),
    status: text('status').notNull().default('pending'),
    integrationConnectionId: uuid('integration_connection_id').references(
      () => integrationConnections.id,
      { onDelete: 'set null' },
    ),
    jobId: uuid('job_id').references(() => jobRuns.id, { onDelete: 'set null' }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notification_deliveries_notification_idx').on(table.notificationId),
    index('notification_deliveries_status_idx').on(table.status, table.createdAt),
    uniqueIndex('notification_deliveries_notification_channel_idx').on(
      table.notificationId,
      table.channel,
    ),
  ],
);
