# 身份、会话与访问控制

## 边界

Frame 只定义系统都会需要的身份内核：

- `accounts`：稳定账号主体
- `password_credentials`：密码登录凭据
- `auth_sessions`：可撤销会话
- `auth_security_challenges`：只保存摘要的一次性邀请、验证和密码重置凭证
- `roles` / `permissions`：通用 RBAC
- `account_roles` / `role_permissions`：多对多授权关系

教师、家长、买家、员工、会员等名称都属于领域资料，不能进入这些基础表。领域模块可以使用 `account_id` 关联自己的资料表。

## 会话

登录成功后，服务端签发只包含账号 ID 与会话 ID 的 JWT，并写入 `HttpOnly`、`SameSite=Lax` Cookie。浏览器代码不能读取令牌；每个受保护请求仍会检查：

1. JWT 签名与有效期
2. 数据库会话是否存在、未撤销且未过期
3. 账号是否仍为启用状态
4. 当前数据库中的角色与权限

因此退出登录、停用账号和修改角色都会以数据库状态为准，不依赖旧令牌中的权限快照。

## 基础权限

权限使用 `<resource>.<action>` 或 `<scope>.<resource>.<action>` 的稳定代码：

- `admin.access`
- `system.runtime.read`
- `system.settings.read` / `system.settings.write`
- `iam.accounts.read` / `iam.accounts.write`
- `iam.roles.read` / `iam.roles.write`
- `audit.read`
- `integrations.read` / `integrations.write`
- `assets.read` / `assets.write` / `assets.manage`

领域模块通过迁移注册自己的权限，例如 `catalog.products.write`，不能把行业权限硬编码进身份模块。

内置角色为：

- `owner`：拥有当前及未来注册的全部权限
- `administrator`：完整管理当前基础能力
- `operator`：系统运行、设置与集成
- `viewer`：只读系统能力

内置角色不能通过 API 修改；应用可以创建自己的非系统角色。

## 首个所有者

首次部署可以临时提供：

```text
AUTH_BOOTSTRAP_EMAIL=owner@example.com
AUTH_BOOTSTRAP_PASSWORD=<temporary-password-at-least-12-characters>
AUTH_BOOTSTRAP_DISPLAY_NAME=系统所有者
```

只有数据库中尚无账号时才会创建首个 `owner`，并强制首次登录修改密码。完成创建后应从运行环境删除 `AUTH_BOOTSTRAP_PASSWORD`。服务不会在后续重启时覆盖数据库密码。

## API

认证：

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/complete`
- `POST /api/auth/invitations/accept`
- `POST /api/auth/email/verify`

账号自服务：

- `GET/PATCH /api/account/profile`
- `POST /api/account/email-verification`
- `GET /api/account/sessions`
- `DELETE /api/account/sessions/:sessionId`
- `POST /api/account/sessions/revoke-others`
- `GET /api/account/security-events`

身份与权限：

- `GET/POST /api/access/accounts`
- `PATCH /api/access/accounts/:accountId`
- `GET/POST /api/access/roles`
- `PATCH /api/access/roles/:roleId`
- `GET /api/access/permissions`

所有身份与权限写操作都会记录审计事件；系统禁止停用自己，并禁止移除最后一个启用的所有者。
