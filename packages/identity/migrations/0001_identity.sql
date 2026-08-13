CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "avatar_asset_id" uuid,
  "email_verified_at" timestamp with time zone,
  "status" text DEFAULT 'active' NOT NULL,
  "must_change_password" boolean DEFAULT false NOT NULL,
  "last_login_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "accounts_status_check" CHECK ("status" IN ('active', 'suspended'))
);

CREATE INDEX "accounts_status_idx" ON "accounts" ("status");

CREATE TABLE "password_credentials" (
  "account_id" uuid PRIMARY KEY NOT NULL REFERENCES "accounts" ("id") ON DELETE CASCADE,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "permissions" (
  "code" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "account_roles" (
  "account_id" uuid NOT NULL REFERENCES "accounts" ("id") ON DELETE CASCADE,
  "role_id" uuid NOT NULL REFERENCES "roles" ("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("account_id", "role_id")
);

CREATE INDEX "account_roles_role_idx" ON "account_roles" ("role_id");

CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL REFERENCES "roles" ("id") ON DELETE CASCADE,
  "permission_code" text NOT NULL REFERENCES "permissions" ("code") ON DELETE CASCADE,
  PRIMARY KEY ("role_id", "permission_code")
);

CREATE TABLE "auth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts" ("id") ON DELETE CASCADE,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "auth_sessions_account_idx" ON "auth_sessions" ("account_id");
CREATE INDEX "auth_sessions_expires_idx" ON "auth_sessions" ("expires_at");

CREATE TABLE "auth_security_challenges" (
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

CREATE INDEX "auth_security_challenges_account_purpose_idx"
  ON "auth_security_challenges" ("account_id", "purpose", "created_at" DESC);
CREATE INDEX "auth_security_challenges_expires_idx"
  ON "auth_security_challenges" ("expires_at");

INSERT INTO "permissions" ("code", "name", "description") VALUES
  ('iam.accounts.read', '查看账号', '读取账号、状态与角色分配'),
  ('iam.accounts.write', '管理账号', '创建账号并修改状态或角色'),
  ('iam.roles.read', '查看角色权限', '读取角色与权限目录'),
  ('iam.roles.write', '管理角色权限', '创建角色并调整权限');

INSERT INTO "roles" ("code", "name", "description", "is_system") VALUES
  ('owner', '系统所有者', '拥有当前及未来注册的全部权限', true),
  ('administrator', '系统管理员', '负责账号、设置和通用系统管理', true),
  ('operator', '系统运营', '负责系统设置、集成和日常运行', true),
  ('viewer', '只读成员', '只读访问系统状态和配置', true);

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE role.code IN ('owner', 'administrator');
