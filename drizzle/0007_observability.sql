ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "request_id" text;
CREATE INDEX IF NOT EXISTS "audit_logs_request_created_idx"
  ON "audit_logs" ("request_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "service_heartbeats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "service_type" text NOT NULL,
  "instance_id" text NOT NULL,
  "version" text NOT NULL,
  "status" text DEFAULT 'healthy' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "service_heartbeats_type_check" CHECK ("service_type" IN ('api', 'worker')),
  CONSTRAINT "service_heartbeats_status_check" CHECK ("status" IN ('healthy', 'stopping', 'degraded'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_heartbeats_type_instance_idx"
  ON "service_heartbeats" ("service_type", "instance_id");
CREATE INDEX IF NOT EXISTS "service_heartbeats_type_seen_idx"
  ON "service_heartbeats" ("service_type", "last_seen_at" DESC);

CREATE TABLE IF NOT EXISTS "system_incidents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fingerprint" text NOT NULL UNIQUE,
  "category" text NOT NULL,
  "title" text NOT NULL,
  "severity" text DEFAULT 'error' NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "service_type" text NOT NULL,
  "error_name" text NOT NULL,
  "method" text,
  "route" text,
  "latest_request_id" text,
  "occurrence_count" integer DEFAULT 1 NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  CONSTRAINT "system_incidents_category_check" CHECK ("category" IN ('request_error', 'worker_error')),
  CONSTRAINT "system_incidents_severity_check" CHECK ("severity" IN ('error', 'critical')),
  CONSTRAINT "system_incidents_status_check" CHECK ("status" IN ('open', 'resolved')),
  CONSTRAINT "system_incidents_service_check" CHECK ("service_type" IN ('api', 'worker'))
);

CREATE INDEX IF NOT EXISTS "system_incidents_status_seen_idx"
  ON "system_incidents" ("status", "last_seen_at" DESC);
CREATE INDEX IF NOT EXISTS "system_incidents_service_seen_idx"
  ON "system_incidents" ("service_type", "last_seen_at" DESC);

INSERT INTO "permissions" ("code", "name", "description") VALUES
  ('observability.read', '查看运行可观测性', '查看服务心跳、请求指标和错误聚合'),
  ('observability.manage', '管理系统错误', '解决或重新打开聚合系统错误')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code IN ('observability.read', 'observability.manage')
WHERE role.code IN ('owner', 'administrator')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code = 'observability.read'
WHERE role.code IN ('operator', 'viewer')
ON CONFLICT DO NOTHING;
