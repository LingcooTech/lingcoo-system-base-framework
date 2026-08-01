# 基础框架架构

## 1. 定位

本仓库是一个可以直接运行和部署的系统底座。它负责定义所有 Lingcoo 行业系统都应遵守的通用工程结构、运行边界和 UI 基础，不负责定义任何行业业务。

判断一项能力是否属于框架，可以使用两个问题：

1. 删除全部领域业务之后，这项能力是否仍然成立？
2. 教育、零售、官网或未来其他系统是否会以相同方式使用它？

只有两个答案都为“是”的能力，才适合进入基础框架。

## 2. 运行结构

```text
Browser
  ├─ /             → Public Web
  ├─ /admin/*      → Admin UI
  └─ /api/*        → Fastify API
                         │
                         └─ PostgreSQL ← Worker
```

开发时 API、Worker 和两个 Web 应用独立运行，以获得快速热更新；`admin-ui`、`public-web` 和共享包由 npm workspace 统一管理。生产时两个前端编译为静态资源，API 与 Worker 使用同一镜像、不同进程。Caddy 只负责入口、压缩、TLS 和反向代理。

这种形态保持了前端职责的独立性，同时避免一个基础系统一开始就承担多镜像编排、服务发现和跨服务认证等不必要复杂度。

## 3. 目录职责

```text
admin-ui/              管理后台应用
public-web/            公共用户侧应用
packages/
  design-tokens/       双 Web 入口共享的语义设计变量
  ui/                  无业务含义的 React 基础组件
src/
  app.ts               HTTP 宿主与通用中间件
  server.ts            进程入口
  worker.ts            后台任务与 Outbox 独立进程入口
  db/                  数据库连接和共享基础表
  lib/                 无领域含义的运行工具
  modules/
    system/            健康、就绪和运行时信息
    auth/              登录、会话与密码生命周期
    access/            账号、角色与权限管理
    integrations/      Provider、加密凭据与连接生命周期
    jobs/              持久化任务、Outbox 与处理器注册表
    notifications/     站内通知、公告策略与邮件投递
    index.ts            模块组合根
drizzle/               有序 SQL 迁移
deploy/                入口代理配置
docs/                  架构约束与扩展指南
```

`src/app.ts` 是组合根，不承载业务规则。具体业务只能通过模块注册进入应用。

## 4. 基础能力

### 公共 Web

公共 Web 是未来用户侧应用的宿主，不等同于营销官网。当前页面只说明框架状态，没有预设行业信息、导航模型或内容结构。

### 管理后台

后台提供可复用的应用壳、响应式导航、页面容器、数据表格、资源分区和状态呈现。当前数据都用于表达框架运行状态，不伪造业务仪表盘。

### 共享 UI

`@lingcoo/frame-design-tokens` 定义语义颜色、间距、排版、圆角、阴影、动效和层级；`@lingcoo/frame-ui` 实现 Button、Badge、Card、Input、Textarea、FormField、Dialog、Spinner 和 EmptyState 等无业务含义的组件。两套前端只能通过语义 Token 定制品牌外观，不复制组件实现。

### API

Fastify 宿主统一提供：

- 环境变量校验
- 请求日志
- CORS
- 安全响应头
- 请求限流
- 统一错误响应
- 静态前端托管
- 健康与就绪探针

### 身份与权限

身份内核提供统一账号、独立密码凭据、HttpOnly JWT Cookie、数据库可撤销会话、多角色 RBAC 和权限中间件。JWT 只携带账号与会话标识，账号状态、角色和权限在请求时从数据库重新确认，避免停用账号或权限变更后旧令牌继续生效。

基础角色与权限没有行业语义。领域模块只能注册自己的权限并通过 `account_id` 关联领域资料，不能修改身份内核。完整约束见 [身份与访问控制](identity-access.md)。

### 数据库

PostgreSQL 是默认事务数据库。Drizzle Schema 提供类型化的数据定义；部署执行器以文件名顺序运行 SQL，并记录文件校验和，避免已发布迁移被静默修改。

基础层当前包含：

- `system_settings`：系统级键值配置的持久化位置
- `audit_logs`：共享审计事件
- `accounts` / `password_credentials`：账号与登录凭据
- `auth_sessions`：可撤销登录会话
- `roles` / `permissions`：通用角色权限目录
- `account_roles` / `role_permissions`：授权关系
- `integration_connections`：Provider 连接、配置与加密凭据
- `integration_events`：连通性与后续外部调用事件
- `job_runs`：幂等、可重试的持久化后台任务
- `outbox_events`：与业务写入共享事务的可靠领域事件
- `notifications`：账号级站内通知与阅读状态
- `notification_deliveries`：外部通知通道的投递状态
- `framework_migrations`：迁移执行记录

这些表不包含行业业务。

敏感系统设置使用带版本号的 AES-256-GCM envelope 写入 `system_settings`。密钥只来自运行环境，不进入数据库或 API 响应；读取端支持 keyring，便于在不中断既有配置读取的前提下轮换密钥。`audit_logs` 通过统一写入函数记录操作者、动作、资源和上下文，领域模块不直接拼装表字段。

### 外部集成

外部服务使用显式注册的 Provider 契约进入系统。普通配置可以通过 API 返回，凭据使用
AES-256-GCM 独立加密且 API 只暴露已配置字段名。连接默认停用，只有当前配置通过连通性测试后
才能启用；配置或凭据变更会自动停用并使旧测试结果失效。

框架当前安装 SMTP、七牛云、支付宝、微信支付 API v3 和 OpenRouter 真实适配器。完整约束见
[外部集成基础](integration-foundation.md)、[SMTP Provider](smtp-provider.md) 和
[通用 Provider 适配器](shared-providers.md)。

### 后台任务与通知

后台任务由 PostgreSQL 持久化，Worker 通过 `FOR UPDATE SKIP LOCKED` 原子领取任务，并提供幂等键、
失败退避、最大尝试次数、死亡任务与人工重试。事务 Outbox 用于保证核心状态变化和待发布事件同成
同败；订阅器必须自行保持幂等。通知中心在此基础上提供站内通知、全员公告和 SMTP 邮件投递，
不引入 Redis 作为最小运行依赖。完整约束见 [后台任务、Outbox 与通知](jobs-notifications.md)。

### 部署

开发拓扑只启动 PostgreSQL，三个应用由本机 Node.js 进程运行。生产拓扑包含：

- PostgreSQL
- 一次性迁移容器
- 非 root、只读文件系统的应用容器
- 与 API 使用同一镜像的非 root Worker 容器
- Caddy 入口

迁移成功后应用才启动，应用健康后入口才接受流量。

## 5. 模块边界

每个领域模块应包含完整的垂直能力，而不是只按技术层横向堆放：

```text
src/modules/catalog/
  index.ts
  schema.ts
  repository.ts
  service.ts
  routes.ts
  contracts.ts
```

模块可以引用基础库，但基础库不能引用领域模块；领域模块之间也不应直接读写对方的数据表，应通过公开服务边界协作。

## 6. 暂不纳入的能力

以下能力很可能是共享能力，但需要在 Core、Edu、Retail 的真实实现中继续对照后再固化：

- 日志、指标和链路追踪

第一阶段保留接入位置，不提前选择无法被成熟系统共同验证的抽象。
