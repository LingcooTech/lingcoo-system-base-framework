ALTER TABLE "cms_content_entries"
  ADD COLUMN IF NOT EXISTS "scheduled_publish_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "cms_content_entries_scheduled_publish_idx"
  ON "cms_content_entries" ("scheduled_publish_at")
  WHERE "scheduled_publish_at" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "cms_redirects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_path" text NOT NULL,
  "target_path" text NOT NULL,
  "status_code" integer DEFAULT 301 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cms_redirects_status_code_check" CHECK ("status_code" IN (301, 302)),
  CONSTRAINT "cms_redirects_source_path_check" CHECK (left("source_path", 1) = '/' AND left("source_path", 2) <> '//'),
  CONSTRAINT "cms_redirects_target_path_check" CHECK (left("target_path", 1) = '/' AND left("target_path", 2) <> '//'),
  CONSTRAINT "cms_redirects_distinct_path_check" CHECK ("source_path" <> "target_path")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_redirects_source_path_idx"
  ON "cms_redirects" ("source_path");
CREATE INDEX IF NOT EXISTS "cms_redirects_enabled_idx"
  ON "cms_redirects" ("enabled");
