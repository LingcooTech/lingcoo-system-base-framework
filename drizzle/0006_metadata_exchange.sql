CREATE TABLE IF NOT EXISTS "metadata_dictionaries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "value_type" text DEFAULT 'string' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "metadata_dictionaries_value_type_check" CHECK ("value_type" IN ('string', 'number', 'boolean', 'json')),
  CONSTRAINT "metadata_dictionaries_status_check" CHECK ("status" IN ('active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS "metadata_dictionaries_status_idx" ON "metadata_dictionaries" ("status");

CREATE TABLE IF NOT EXISTS "metadata_dictionary_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dictionary_id" uuid NOT NULL REFERENCES "metadata_dictionaries" ("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "label" text NOT NULL,
  "value" jsonb NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 100 NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "metadata_dictionary_items_status_check" CHECK ("status" IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "metadata_dictionary_items_dictionary_code_idx"
  ON "metadata_dictionary_items" ("dictionary_id", "code");
CREATE INDEX IF NOT EXISTS "metadata_dictionary_items_dictionary_sort_idx"
  ON "metadata_dictionary_items" ("dictionary_id", "sort_order");

CREATE TABLE IF NOT EXISTS "taxonomies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "kind" text DEFAULT 'tag' NOT NULL,
  "description" text,
  "hierarchical" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "taxonomies_kind_check" CHECK ("kind" IN ('tag', 'category')),
  CONSTRAINT "taxonomies_status_check" CHECK ("status" IN ('active', 'inactive')),
  CONSTRAINT "taxonomies_hierarchy_check" CHECK ("kind" = 'category' OR "hierarchical" = false)
);

CREATE INDEX IF NOT EXISTS "taxonomies_kind_status_idx" ON "taxonomies" ("kind", "status");

CREATE TABLE IF NOT EXISTS "taxonomy_terms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "taxonomy_id" uuid NOT NULL REFERENCES "taxonomies" ("id") ON DELETE CASCADE,
  "parent_id" uuid REFERENCES "taxonomy_terms" ("id") ON DELETE RESTRICT,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "color" text,
  "sort_order" integer DEFAULT 100 NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "taxonomy_terms_status_check" CHECK ("status" IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "taxonomy_terms_taxonomy_code_idx"
  ON "taxonomy_terms" ("taxonomy_id", "code");
CREATE INDEX IF NOT EXISTS "taxonomy_terms_taxonomy_parent_idx"
  ON "taxonomy_terms" ("taxonomy_id", "parent_id");

CREATE TABLE IF NOT EXISTS "resource_terms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "term_id" uuid NOT NULL REFERENCES "taxonomy_terms" ("id") ON DELETE CASCADE,
  "resource_type" text NOT NULL,
  "resource_id" text NOT NULL,
  "assigned_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "resource_terms_resource_term_idx"
  ON "resource_terms" ("resource_type", "resource_id", "term_id");
CREATE INDEX IF NOT EXISTS "resource_terms_resource_idx"
  ON "resource_terms" ("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "resource_terms_term_idx" ON "resource_terms" ("term_id");

CREATE TABLE IF NOT EXISTS "data_exchange_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dataset_code" text NOT NULL,
  "direction" text NOT NULL,
  "format" text DEFAULT 'json' NOT NULL,
  "status" text NOT NULL,
  "record_count" integer DEFAULT 0 NOT NULL,
  "summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error_message" text,
  "created_by" uuid REFERENCES "accounts" ("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "data_exchange_runs_direction_check" CHECK ("direction" IN ('import', 'export')),
  CONSTRAINT "data_exchange_runs_format_check" CHECK ("format" IN ('json')),
  CONSTRAINT "data_exchange_runs_status_check" CHECK ("status" IN ('succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS "data_exchange_runs_dataset_created_idx"
  ON "data_exchange_runs" ("dataset_code", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "data_exchange_runs_direction_created_idx"
  ON "data_exchange_runs" ("direction", "created_at" DESC);

INSERT INTO "permissions" ("code", "name", "description") VALUES
  ('metadata.read', '查看数据字典与分类', '读取通用字典、分类法、标签和资源关联'),
  ('metadata.write', '管理数据字典与分类', '创建和维护通用字典、分类法与词条'),
  ('metadata.assign', '分配分类与标签', '为领域资源分配或移除分类词条'),
  ('search.use', '使用统一搜索', '跨已注册资源源执行权限感知搜索'),
  ('data_exchange.read', '导出注册数据集', '查看数据集目录并导出可移植快照'),
  ('data_exchange.write', '导入注册数据集', '预检并应用注册数据集快照')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code IN (
  'metadata.read', 'metadata.write', 'metadata.assign', 'search.use',
  'data_exchange.read', 'data_exchange.write'
)
WHERE role.code IN ('owner', 'administrator', 'operator')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, permission.code
FROM "roles" role
JOIN "permissions" permission ON permission.code IN ('metadata.read', 'search.use')
WHERE role.code = 'viewer'
ON CONFLICT DO NOTHING;
