CREATE TABLE IF NOT EXISTS "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "must_change_password" boolean DEFAULT false NOT NULL,
  "last_login_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "accounts_status_check" CHECK ("status" IN ('active', 'suspended'))
);

CREATE INDEX IF NOT EXISTS "accounts_status_idx" ON "accounts" ("status");

CREATE TABLE IF NOT EXISTS "password_credentials" (
  "account_id" uuid PRIMARY KEY NOT NULL
    REFERENCES "accounts" ("id") ON DELETE CASCADE,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "permissions" (
  "code" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "account_roles" (
  "account_id" uuid NOT NULL REFERENCES "accounts" ("id") ON DELETE CASCADE,
  "role_id" uuid NOT NULL REFERENCES "roles" ("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("account_id", "role_id")
);

CREATE INDEX IF NOT EXISTS "account_roles_role_idx" ON "account_roles" ("role_id");

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role_id" uuid NOT NULL REFERENCES "roles" ("id") ON DELETE CASCADE,
  "permission_code" text NOT NULL REFERENCES "permissions" ("code") ON DELETE CASCADE,
  PRIMARY KEY ("role_id", "permission_code")
);

CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "accounts" ("id") ON DELETE CASCADE,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "auth_sessions_account_idx" ON "auth_sessions" ("account_id");
CREATE INDEX IF NOT EXISTS "auth_sessions_expires_idx" ON "auth_sessions" ("expires_at");

INSERT INTO "permissions" ("code", "name", "description") VALUES
  ('admin.access', '访问管理后台', '允许进入通用管理后台'),
  ('system.runtime.read', '查看运行状态', '读取系统运行时与健康信息'),
  ('system.settings.read', '查看系统设置', '读取系统级配置概览'),
  ('system.settings.write', '管理系统设置', '修改系统级配置'),
  ('iam.accounts.read', '查看账号', '读取账号、状态与角色分配'),
  ('iam.accounts.write', '管理账号', '创建账号并修改状态或角色'),
  ('iam.roles.read', '查看角色权限', '读取角色与权限目录'),
  ('iam.roles.write', '管理角色权限', '创建角色并调整权限'),
  ('audit.read', '查看审计日志', '读取共享审计事件'),
  ('integrations.read', '查看外部集成', '读取外部服务接入状态'),
  ('integrations.write', '管理外部集成', '配置与测试外部服务')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "roles" ("code", "name", "description", "is_system") VALUES
  ('owner', '系统所有者', '拥有当前及未来注册的全部权限', true),
  ('administrator', '系统管理员', '负责账号、设置和通用系统管理', true),
  ('operator', '系统运营', '负责系统设置、集成和日常运行', true),
  ('viewer', '只读成员', '只读访问系统状态和配置', true)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE role.code IN ('owner', 'administrator')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code IN (
  'admin.access',
  'system.runtime.read',
  'system.settings.read',
  'system.settings.write',
  'audit.read',
  'integrations.read',
  'integrations.write'
)
WHERE role.code = 'operator'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code IN (
  'admin.access',
  'system.runtime.read',
  'system.settings.read',
  'audit.read',
  'integrations.read'
)
WHERE role.code = 'viewer'
ON CONFLICT DO NOTHING;
