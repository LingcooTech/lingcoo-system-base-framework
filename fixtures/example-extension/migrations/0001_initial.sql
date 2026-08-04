CREATE TABLE IF NOT EXISTS "example_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "permissions" ("code", "name", "description") VALUES
  ('example.read', '查看示例扩展', '访问示例扩展提供的业务能力')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT role.id, 'example.read'
FROM "roles" role
WHERE role.code IN ('owner', 'administrator')
ON CONFLICT DO NOTHING;
