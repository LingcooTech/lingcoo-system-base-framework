CREATE TABLE IF NOT EXISTS "storage_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL REFERENCES "integration_connections" ("id") ON DELETE RESTRICT,
  "provider_code" text DEFAULT 'qiniu' NOT NULL,
  "object_key" text NOT NULL,
  "original_filename" text NOT NULL,
  "display_name" text NOT NULL,
  "media_kind" text DEFAULT 'other' NOT NULL,
  "mime_type" text DEFAULT 'application/octet-stream' NOT NULL,
  "byte_size" bigint DEFAULT 0 NOT NULL,
  "checksum" text,
  "visibility" text DEFAULT 'public' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "public_url" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "upload_expires_at" timestamp with time zone,
  "confirmed_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "created_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "storage_assets_provider_check" CHECK ("provider_code" IN ('qiniu')),
  CONSTRAINT "storage_assets_kind_check" CHECK ("media_kind" IN ('image', 'video', 'audio', 'document', 'archive', 'other')),
  CONSTRAINT "storage_assets_visibility_check" CHECK ("visibility" IN ('public', 'private')),
  CONSTRAINT "storage_assets_status_check" CHECK ("status" IN ('pending', 'active', 'archived', 'deleting', 'deleted', 'failed')),
  CONSTRAINT "storage_assets_byte_size_check" CHECK ("byte_size" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "storage_assets_connection_object_idx"
  ON "storage_assets" ("connection_id", "object_key");
CREATE INDEX IF NOT EXISTS "storage_assets_status_created_idx"
  ON "storage_assets" ("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "storage_assets_kind_created_idx"
  ON "storage_assets" ("media_kind", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "storage_asset_references" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL REFERENCES "storage_assets" ("id") ON DELETE CASCADE,
  "owner_type" text NOT NULL,
  "owner_id" text NOT NULL,
  "field" text DEFAULT 'default' NOT NULL,
  "created_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "storage_asset_references_owner_field_idx"
  ON "storage_asset_references" ("owner_type", "owner_id", "field");
CREATE INDEX IF NOT EXISTS "storage_asset_references_asset_idx"
  ON "storage_asset_references" ("asset_id");

INSERT INTO "permissions" ("code", "name", "description") VALUES
  ('assets.read', '查看媒体资产', '查看资产元数据、引用状态与访问地址'),
  ('assets.write', '上传媒体资产', '创建上传意图、确认上传和维护资产信息'),
  ('assets.manage', '管理媒体资产', '归档、恢复和删除媒体资产')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code IN (
  'assets.read', 'assets.write', 'assets.manage'
)
WHERE role.code IN ('owner', 'administrator', 'operator')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code = 'assets.read'
WHERE role.code = 'viewer'
ON CONFLICT DO NOTHING;
