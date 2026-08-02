import {
  type AnyPgColumn,
  bigint,
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
  version: integer('version').notNull().default(1),
  updatedBy: uuid('updated_by').references(() => accounts.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const systemSettingVersions = pgTable(
  'system_setting_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    settingKey: text('setting_key').notNull(),
    version: integer('version').notNull(),
    value: jsonb('value').notNull(),
    changeReason: text('change_reason'),
    changedBy: uuid('changed_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('system_setting_versions_key_version_idx').on(table.settingKey, table.version),
    index('system_setting_versions_key_created_idx').on(table.settingKey, table.createdAt),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    actorId: text('actor_id'),
    requestId: text('request_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_logs_created_at_idx').on(table.createdAt),
    index('audit_logs_action_created_idx').on(table.action, table.createdAt),
    index('audit_logs_resource_created_idx').on(table.resourceType, table.createdAt),
    index('audit_logs_actor_created_idx').on(table.actorId, table.createdAt),
    index('audit_logs_request_created_idx').on(table.requestId, table.createdAt),
  ],
);

export const serviceHeartbeats = pgTable(
  'service_heartbeats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    serviceType: text('service_type').notNull(),
    instanceId: text('instance_id').notNull(),
    version: text('version').notNull(),
    status: text('status').notNull().default('healthy'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('service_heartbeats_type_instance_idx').on(table.serviceType, table.instanceId),
    index('service_heartbeats_type_seen_idx').on(table.serviceType, table.lastSeenAt),
  ],
);

export const systemIncidents = pgTable(
  'system_incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fingerprint: text('fingerprint').notNull().unique(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    severity: text('severity').notNull().default('error'),
    status: text('status').notNull().default('open'),
    serviceType: text('service_type').notNull(),
    errorName: text('error_name').notNull(),
    method: text('method'),
    route: text('route'),
    latestRequestId: text('latest_request_id'),
    occurrenceCount: integer('occurrence_count').notNull().default(1),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => accounts.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('system_incidents_status_seen_idx').on(table.status, table.lastSeenAt),
    index('system_incidents_service_seen_idx').on(table.serviceType, table.lastSeenAt),
  ],
);

export const metadataDictionaries = pgTable(
  'metadata_dictionaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    valueType: text('value_type').notNull().default('string'),
    status: text('status').notNull().default('active'),
    isSystem: boolean('is_system').notNull().default(false),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('metadata_dictionaries_status_idx').on(table.status)],
);

export const metadataDictionaryItems = pgTable(
  'metadata_dictionary_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dictionaryId: uuid('dictionary_id')
      .notNull()
      .references(() => metadataDictionaries.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    label: text('label').notNull(),
    value: jsonb('value').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(100),
    status: text('status').notNull().default('active'),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('metadata_dictionary_items_dictionary_code_idx').on(table.dictionaryId, table.code),
    index('metadata_dictionary_items_dictionary_sort_idx').on(table.dictionaryId, table.sortOrder),
  ],
);

export const taxonomies = pgTable(
  'taxonomies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    kind: text('kind').notNull().default('tag'),
    description: text('description'),
    hierarchical: boolean('hierarchical').notNull().default(false),
    status: text('status').notNull().default('active'),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('taxonomies_kind_status_idx').on(table.kind, table.status)],
);

export const taxonomyTerms = pgTable(
  'taxonomy_terms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taxonomyId: uuid('taxonomy_id')
      .notNull()
      .references(() => taxonomies.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => taxonomyTerms.id, {
      onDelete: 'restrict',
    }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    color: text('color'),
    sortOrder: integer('sort_order').notNull().default(100),
    status: text('status').notNull().default('active'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('taxonomy_terms_taxonomy_code_idx').on(table.taxonomyId, table.code),
    index('taxonomy_terms_taxonomy_parent_idx').on(table.taxonomyId, table.parentId),
  ],
);

export const resourceTerms = pgTable(
  'resource_terms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    termId: uuid('term_id')
      .notNull()
      .references(() => taxonomyTerms.id, { onDelete: 'cascade' }),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    assignedBy: uuid('assigned_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('resource_terms_resource_term_idx').on(
      table.resourceType,
      table.resourceId,
      table.termId,
    ),
    index('resource_terms_resource_idx').on(table.resourceType, table.resourceId),
    index('resource_terms_term_idx').on(table.termId),
  ],
);

export const dataExchangeRuns = pgTable(
  'data_exchange_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    datasetCode: text('dataset_code').notNull(),
    direction: text('direction').notNull(),
    format: text('format').notNull().default('json'),
    status: text('status').notNull(),
    recordCount: integer('record_count').notNull().default(0),
    summary: jsonb('summary').$type<Record<string, unknown>>().notNull().default({}),
    errorMessage: text('error_message'),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('data_exchange_runs_dataset_created_idx').on(table.datasetCode, table.createdAt),
    index('data_exchange_runs_direction_created_idx').on(table.direction, table.createdAt),
  ],
);

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

export const storageAssets = pgTable(
  'storage_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => integrationConnections.id, { onDelete: 'restrict' }),
    providerCode: text('provider_code').notNull().default('qiniu'),
    objectKey: text('object_key').notNull(),
    originalFilename: text('original_filename').notNull(),
    displayName: text('display_name').notNull(),
    mediaKind: text('media_kind').notNull().default('other'),
    mimeType: text('mime_type').notNull().default('application/octet-stream'),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull().default(0),
    checksum: text('checksum'),
    visibility: text('visibility').notNull().default('public'),
    status: text('status').notNull().default('pending'),
    publicUrl: text('public_url'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    uploadExpiresAt: timestamp('upload_expires_at', { withTimezone: true }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('storage_assets_connection_object_idx').on(table.connectionId, table.objectKey),
    index('storage_assets_status_created_idx').on(table.status, table.createdAt),
    index('storage_assets_kind_created_idx').on(table.mediaKind, table.createdAt),
  ],
);

export const storageAssetReferences = pgTable(
  'storage_asset_references',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => storageAssets.id, { onDelete: 'cascade' }),
    ownerType: text('owner_type').notNull(),
    ownerId: text('owner_id').notNull(),
    field: text('field').notNull().default('default'),
    createdBy: uuid('created_by').references(() => accounts.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('storage_asset_references_owner_field_idx').on(
      table.ownerType,
      table.ownerId,
      table.field,
    ),
    index('storage_asset_references_asset_idx').on(table.assetId),
  ],
);
