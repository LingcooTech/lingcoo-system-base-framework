CREATE TABLE IF NOT EXISTS "cms_content_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" text NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "excerpt" text,
  "body" text DEFAULT '' NOT NULL,
  "body_format" text DEFAULT 'markdown' NOT NULL,
  "cover_asset_id" uuid REFERENCES "storage_assets" ("id") ON DELETE RESTRICT,
  "social_image_asset_id" uuid REFERENCES "storage_assets" ("id") ON DELETE RESTRICT,
  "status" text DEFAULT 'draft' NOT NULL,
  "pinned" boolean DEFAULT false NOT NULL,
  "seo_title" text,
  "seo_description" text,
  "published_at" timestamp with time zone,
  "current_version" integer DEFAULT 1 NOT NULL,
  "author_id" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cms_content_entries_type_check" CHECK ("type" IN ('article', 'page')),
  CONSTRAINT "cms_content_entries_format_check" CHECK ("body_format" IN ('markdown')),
  CONSTRAINT "cms_content_entries_status_check" CHECK ("status" IN ('draft', 'published', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_content_entries_type_slug_idx"
  ON "cms_content_entries" ("type", "slug");
CREATE INDEX IF NOT EXISTS "cms_content_entries_type_status_published_idx"
  ON "cms_content_entries" ("type", "status", "published_at" DESC);

CREATE TABLE IF NOT EXISTS "cms_content_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "content_id" uuid NOT NULL REFERENCES "cms_content_entries" ("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "snapshot" jsonb NOT NULL,
  "change_reason" text,
  "created_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "cms_content_versions_content_version_idx"
  ON "cms_content_versions" ("content_id", "version");
CREATE INDEX IF NOT EXISTS "cms_content_versions_content_created_idx"
  ON "cms_content_versions" ("content_id", "created_at" DESC);

INSERT INTO "permissions" ("code", "name", "description") VALUES
  ('cms.read', '查看内容', '查看页面、文章、草稿和内容版本'),
  ('cms.write', '编辑内容', '创建和修改页面、文章及其分类资源'),
  ('cms.publish', '发布内容', '发布、撤回和归档公共内容')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code IN ('cms.read', 'cms.write', 'cms.publish')
WHERE role.code IN ('owner', 'administrator')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code IN ('cms.read', 'cms.write')
WHERE role.code = 'operator'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code = 'cms.read'
WHERE role.code = 'viewer'
ON CONFLICT DO NOTHING;
