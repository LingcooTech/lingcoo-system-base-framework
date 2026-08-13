CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recipient_account_id" uuid NOT NULL REFERENCES "accounts" ("id") ON DELETE CASCADE,
  "category" text DEFAULT 'system' NOT NULL,
  "level" text DEFAULT 'info' NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "cta_label" text,
  "cta_url" text,
  "status" text DEFAULT 'unread' NOT NULL,
  "dedupe_key" text NOT NULL,
  "source_event_id" uuid REFERENCES "outbox_events" ("id") ON DELETE SET NULL,
  "source_event_name" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notifications_level_check" CHECK ("level" IN ('info', 'success', 'warning', 'error')),
  CONSTRAINT "notifications_status_check" CHECK ("status" IN ('unread', 'read', 'archived'))
);

CREATE INDEX "notifications_recipient_status_idx"
  ON "notifications" ("recipient_account_id", "status", "created_at" DESC);
CREATE INDEX "notifications_category_idx" ON "notifications" ("category", "created_at" DESC);
CREATE UNIQUE INDEX "notifications_dedupe_key_idx" ON "notifications" ("dedupe_key");

CREATE TABLE "notification_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "notification_id" uuid NOT NULL REFERENCES "notifications" ("id") ON DELETE CASCADE,
  "channel" text NOT NULL,
  "destination" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "transport_id" text,
  "transport_label" text,
  "job_id" uuid REFERENCES "job_runs" ("id") ON DELETE SET NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "content" jsonb,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_deliveries_channel_check" CHECK ("channel" IN ('email')),
  CONSTRAINT "notification_deliveries_status_check" CHECK ("status" IN ('pending', 'sending', 'sent', 'failed'))
);

CREATE INDEX "notification_deliveries_notification_idx" ON "notification_deliveries" ("notification_id");
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries" ("status", "created_at" DESC);
CREATE UNIQUE INDEX "notification_deliveries_notification_channel_idx"
  ON "notification_deliveries" ("notification_id", "channel");

INSERT INTO "permissions" ("code", "name", "description") VALUES
  ('notifications.read', '查看通知记录', '查看系统通知与投递状态'),
  ('notifications.manage', '管理通知', '发布公告和管理通知投递');

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code IN ('notifications.read', 'notifications.manage')
WHERE role.code IN ('owner', 'administrator', 'operator');

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code = 'notifications.read'
WHERE role.code = 'viewer';
