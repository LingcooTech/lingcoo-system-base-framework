INSERT INTO "permissions" ("code", "name", "description") VALUES
  ('admin.access', '访问管理后台', '允许进入通用管理后台'),
  ('system.runtime.read', '查看运行状态', '读取系统运行时与健康信息'),
  ('system.settings.read', '查看系统设置', '读取系统级配置概览'),
  ('system.settings.write', '管理系统设置', '修改系统级配置'),
  ('audit.read', '查看审计日志', '读取共享审计事件');

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
  'audit.read'
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
  'audit.read'
)
WHERE role.code = 'viewer'
ON CONFLICT DO NOTHING;
