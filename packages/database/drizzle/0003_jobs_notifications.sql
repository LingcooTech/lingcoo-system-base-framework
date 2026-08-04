CREATE TABLE IF NOT EXISTS "job_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "queue" text DEFAULT 'default' NOT NULL,
  "kind" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "result" jsonb,
  "dedupe_key" text,
  "related_entity_type" text,
  "related_entity_id" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "locked_by" text,
  "last_error" text,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "job_runs_status_check" CHECK ("status" IN ('pending', 'running', 'succeeded', 'dead', 'cancelled')),
  CONSTRAINT "job_runs_attempts_check" CHECK ("attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 20),
  CONSTRAINT "job_runs_priority_check" CHECK ("priority" BETWEEN 0 AND 1000)
);

CREATE INDEX IF NOT EXISTS "job_runs_claim_idx"
  ON "job_runs" ("status", "available_at", "priority");
CREATE INDEX IF NOT EXISTS "job_runs_kind_created_idx"
  ON "job_runs" ("kind", "created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "job_runs_dedupe_key_idx"
  ON "job_runs" ("dedupe_key");

CREATE TABLE IF NOT EXISTS "outbox_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "topic" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "aggregate_type" text,
  "aggregate_id" text,
  "dedupe_key" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "available_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "locked_by" text,
  "last_error" text,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "outbox_events_status_check" CHECK ("status" IN ('pending', 'processing', 'published', 'dead')),
  CONSTRAINT "outbox_events_attempts_check" CHECK ("attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 20)
);

CREATE INDEX IF NOT EXISTS "outbox_events_claim_idx"
  ON "outbox_events" ("status", "available_at");
CREATE INDEX IF NOT EXISTS "outbox_events_topic_idx"
  ON "outbox_events" ("topic", "created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "outbox_events_dedupe_key_idx"
  ON "outbox_events" ("dedupe_key");

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recipient_account_id" uuid NOT NULL REFERENCES "accounts" ("id") ON DELETE CASCADE,
  "category" text DEFAULT 'system' NOT NULL,
  "level" text DEFAULT 'info' NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "cta_label" text,
  "cta_url" text,
  "status" text DEFAULT 'unread' NOT NULL,
  "source_event_id" uuid REFERENCES "outbox_events" ("id") ON DELETE SET NULL,
  "source_event_name" text,
  "dedupe_key" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notifications_level_check" CHECK ("level" IN ('info', 'success', 'warning', 'error')),
  CONSTRAINT "notifications_status_check" CHECK ("status" IN ('unread', 'read', 'archived'))
);

CREATE INDEX IF NOT EXISTS "notifications_recipient_status_idx"
  ON "notifications" ("recipient_account_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "notifications_category_idx"
  ON "notifications" ("category", "created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_key_idx"
  ON "notifications" ("dedupe_key");

CREATE TABLE IF NOT EXISTS "notification_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "notification_id" uuid NOT NULL REFERENCES "notifications" ("id") ON DELETE CASCADE,
  "channel" text NOT NULL,
  "destination" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "integration_connection_id" uuid REFERENCES "integration_connections" ("id") ON DELETE SET NULL,
  "job_id" uuid REFERENCES "job_runs" ("id") ON DELETE SET NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_deliveries_channel_check" CHECK ("channel" IN ('email')),
  CONSTRAINT "notification_deliveries_status_check" CHECK ("status" IN ('pending', 'sending', 'sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS "notification_deliveries_notification_idx"
  ON "notification_deliveries" ("notification_id");
CREATE INDEX IF NOT EXISTS "notification_deliveries_status_idx"
  ON "notification_deliveries" ("status", "created_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "notification_deliveries_notification_channel_idx"
  ON "notification_deliveries" ("notification_id", "channel");

INSERT INTO "permissions" ("code", "name", "description") VALUES
  ('jobs.read', '查看后台任务', '查看任务、Outbox 状态和执行结果'),
  ('jobs.write', '管理后台任务', '重试或取消后台任务'),
  ('notifications.read', '查看通知记录', '查看系统通知与投递状态'),
  ('notifications.manage', '管理通知', '发布公告和管理通知投递')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code IN (
  'jobs.read', 'jobs.write', 'notifications.read', 'notifications.manage'
)
WHERE role.code IN ('owner', 'administrator', 'operator')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code IN ('jobs.read', 'notifications.read')
WHERE role.code = 'viewer'
ON CONFLICT DO NOTHING;
