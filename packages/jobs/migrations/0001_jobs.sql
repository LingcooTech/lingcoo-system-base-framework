CREATE TABLE "job_runs" (
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

CREATE INDEX "job_runs_claim_idx" ON "job_runs" ("status", "available_at", "priority");
CREATE INDEX "job_runs_kind_created_idx" ON "job_runs" ("kind", "created_at" DESC);
CREATE UNIQUE INDEX "job_runs_dedupe_key_idx" ON "job_runs" ("dedupe_key");

CREATE TABLE "outbox_events" (
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

CREATE INDEX "outbox_events_claim_idx" ON "outbox_events" ("status", "available_at");
CREATE INDEX "outbox_events_topic_idx" ON "outbox_events" ("topic", "created_at" DESC);
CREATE UNIQUE INDEX "outbox_events_dedupe_key_idx" ON "outbox_events" ("dedupe_key");

INSERT INTO "permissions" ("code", "name", "description") VALUES
  ('jobs.read', '查看后台任务', '查看任务、Outbox 状态和执行结果'),
  ('jobs.write', '管理后台任务', '重试或取消后台任务');

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code IN ('jobs.read', 'jobs.write')
WHERE role.code IN ('owner', 'administrator', 'operator');

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code = 'jobs.read'
WHERE role.code = 'viewer';
