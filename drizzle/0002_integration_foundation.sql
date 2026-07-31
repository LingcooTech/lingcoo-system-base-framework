CREATE TABLE IF NOT EXISTS "integration_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_code" text NOT NULL,
  "name" text NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "encrypted_credentials" jsonb NOT NULL,
  "credential_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "last_test_status" text,
  "last_test_message" text,
  "last_test_duration_ms" integer,
  "last_test_at" timestamp with time zone,
  "created_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "integration_connections_test_status_check"
    CHECK ("last_test_status" IS NULL OR "last_test_status" IN ('success', 'failure'))
);

CREATE INDEX IF NOT EXISTS "integration_connections_provider_idx"
  ON "integration_connections" ("provider_code");
CREATE INDEX IF NOT EXISTS "integration_connections_enabled_idx"
  ON "integration_connections" ("enabled");

CREATE TABLE IF NOT EXISTS "integration_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL
    REFERENCES "integration_connections" ("id") ON DELETE CASCADE,
  "operation" text NOT NULL,
  "outcome" text NOT NULL,
  "duration_ms" integer,
  "message" text,
  "actor_id" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "integration_events_outcome_check"
    CHECK ("outcome" IN ('success', 'failure'))
);

CREATE INDEX IF NOT EXISTS "integration_events_connection_idx"
  ON "integration_events" ("connection_id");
CREATE INDEX IF NOT EXISTS "integration_events_created_at_idx"
  ON "integration_events" ("created_at" DESC);
