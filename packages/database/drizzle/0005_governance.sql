ALTER TABLE "system_settings"
  ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "updated_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "system_setting_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "setting_key" text NOT NULL,
  "version" integer NOT NULL,
  "value" jsonb NOT NULL,
  "change_reason" text,
  "changed_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "system_setting_versions_key_version_idx"
  ON "system_setting_versions" ("setting_key", "version");
CREATE INDEX IF NOT EXISTS "system_setting_versions_key_created_idx"
  ON "system_setting_versions" ("setting_key", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx"
  ON "audit_logs" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_action_created_idx"
  ON "audit_logs" ("action", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_resource_created_idx"
  ON "audit_logs" ("resource_type", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "audit_logs_actor_created_idx"
  ON "audit_logs" ("actor_id", "created_at" DESC);
