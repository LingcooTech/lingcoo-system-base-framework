CREATE TABLE IF NOT EXISTS "presentation_profiles" (
  "id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
  "display_name" text DEFAULT 'Lingcoo Frame' NOT NULL,
  "short_name" text,
  "slogan" text,
  "full_logo_asset_id" uuid REFERENCES "storage_assets" ("id") ON DELETE RESTRICT,
  "square_logo_asset_id" uuid REFERENCES "storage_assets" ("id") ON DELETE RESTRICT,
  "dark_logo_asset_id" uuid REFERENCES "storage_assets" ("id") ON DELETE RESTRICT,
  "favicon_asset_id" uuid REFERENCES "storage_assets" ("id") ON DELETE RESTRICT,
  "social_image_asset_id" uuid REFERENCES "storage_assets" ("id") ON DELETE RESTRICT,
  "primary_color" text DEFAULT '#315f47' NOT NULL,
  "secondary_color" text DEFAULT '#b9efc5' NOT NULL,
  "accent_color" text DEFAULT '#39735a' NOT NULL,
  "contact_email" text,
  "contact_phone" text,
  "contact_address" text,
  "public_url" text,
  "seo_title" text,
  "seo_description" text,
  "header_navigation" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "footer_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "footer_copyright" text,
  "filing_info" text,
  "version" integer DEFAULT 1 NOT NULL,
  "updated_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "presentation_profile_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "profile_id" text NOT NULL,
  "version" integer NOT NULL,
  "snapshot" jsonb NOT NULL,
  "change_reason" text,
  "changed_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "presentation_profile_versions_profile_version_idx"
  ON "presentation_profile_versions" ("profile_id", "version");

INSERT INTO "permissions" ("code", "name", "description") VALUES
  ('presentation.read', '查看品牌呈现', '查看品牌、站点导航、页脚与 SEO 配置'),
  ('presentation.write', '管理品牌呈现', '修改品牌、站点导航、页脚与 SEO 配置')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code IN ('presentation.read', 'presentation.write')
WHERE role.code IN ('owner', 'administrator')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code = 'presentation.read'
WHERE role.code IN ('operator', 'viewer')
ON CONFLICT DO NOTHING;
