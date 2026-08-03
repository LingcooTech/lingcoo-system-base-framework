ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "avatar_asset_id" uuid REFERENCES "storage_assets" ("id") ON DELETE RESTRICT;
ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "auth_security_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts" ("id") ON DELETE CASCADE,
  "purpose" text NOT NULL,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "requested_ip" text,
  "created_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "auth_security_challenges_purpose_check"
    CHECK ("purpose" IN ('password_reset', 'email_verification', 'account_invitation'))
);

CREATE INDEX IF NOT EXISTS "auth_security_challenges_account_purpose_idx"
  ON "auth_security_challenges" ("account_id", "purpose", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "auth_security_challenges_expires_idx"
  ON "auth_security_challenges" ("expires_at");

ALTER TABLE "notification_deliveries"
  ADD COLUMN IF NOT EXISTS "encrypted_content" jsonb;
