# Lingcoo Frame 代码地图

这份地图用于把“架构层级”直接对应到“代码目录”。第一次阅读仓库时，先看组合根，再进入 Frame
内部，不需要从全部模块源码开始逐文件阅读。

## 1. 顶层目录

```text
apps/                         可运行的参考应用
  reference-system/          API、Worker、Migration 的系统组合根
  reference-admin/           参考管理后台
  reference-web/             参考公共 Web

packages/                     可发布、可独立升级的软件包
  extension-sdk/              Ports、Manifest、System 与各运行面公共契约
  kernel/                     无基础设施依赖的 Runtime、Extension/Migration Engine
  fastify/                    Fastify HTTP Host Adapter
  database/                   PostgreSQL/Drizzle Adapter、Schema 和迁移执行器
  audit/                      基础设施无关的 Audit 读写契约与 PostgreSQL Adapter
  opentelemetry/              可选 OpenTelemetry API Adapter
  identity/                   完整 Identity Feature：Ports、Server、Provider、Repository、Migrations
  integrations/               Provider-neutral 连接、凭据、调用事件、REST 与 Migrations
  assets/                     Provider-neutral 资产生命周期、引用、REST、Worker 与 Migrations
  presentation/               品牌呈现、Public Site Discovery 与独立 Migration
  mail-nodemailer/             SMTP/Nodemailer Provider、Service 与管理路由
  storage-qiniu/               七牛对象存储 Provider、Service 与管理路由
  ai-openrouter/               OpenRouter Provider、Service 与管理路由
  payments/                    支付宝、微信支付 Provider 与统一 PaymentService
  jobs/                       Jobs/Outbox Feature：Ports、REST、Services、Worker Registries、Migrations
  notifications/              Notifications Feature：REST、Delivery、Mail Ports、Worker、Migrations
  frame/                      迁移期兼容聚合包与尚未迁出的旧 Feature
  admin-shell/                管理后台路由、导航、Widget、搜索注册表
  web-shell/                  公共 Web 路由、SEO、Sitemap、Landing Block 注册表
  ui/                         无业务语义的 React 组件
  design-tokens/              共享设计变量
  cms/                        可选 CMS 一方扩展

fixtures/                     包消费者和扩展示例，不参与生产部署
test/integration/             跨包组合与迁移测试
scripts/                      仓库级构建、打包和验收脚本
deploy/                       生产部署脚本
docs/                         架构与公开契约文档
```

## 2. Apps 与 Fixtures 的区别

`apps` 是真实可运行参考系统。它负责回答：“这些包怎样组合成 API、Worker、Migration、Admin 和
Public Web，并最终放进同一个自部署镜像？”生产镜像运行的也是这里的 Reference System。

`fixtures` 是契约验收样本。它负责回答：“如果离开仓库内部源码，只安装 npm tarball，普通业务系统
和一个领域扩展还能否正常编译、组合和运行？”Fixture 不承载产品页面，也不部署到生产。

## 3. Kernel 与兼容聚合包

```text
packages/kernel/src/
  ports/          Database、Telemetry 等基础设施端口
  system.ts       零扩展默认 System
  capabilities.ts Runtime Capability Registry
  extensions.ts   Host 无关的 Extension Engine
  migrations.ts   Host 无关的 Migration Source Engine
```

`packages/kernel` 是新的底层内核边界，不导入 Fastify、pg、Drizzle 或 OpenTelemetry。具体实现分别位于
`packages/fastify`、`packages/database` 和 `packages/opentelemetry`，Docker/Compose 位于仓库部署组合层。

旧功能迁移期间，`packages/frame` 是兼容聚合包，而不是 Kernel 本体：

```text
packages/frame/src/
  host/          进程宿主：环境、Fastify、中间件、请求上下文、日志
  core/          稳定基础能力：Core Manifest、Core Extension、基础模块
  runtime/       组合执行：扩展安装、Worker、System Migration
  integrations/  Frame 对可选一方扩展的适配桥，例如 CMS Service Ports
```

- `host` 负责“应用怎样启动和接收请求”，不放业务规则。
- `core` 负责“所有轻量自部署系统都需要的稳定能力”。
- `runtime` 负责“把同一个 Defined System 投影到 API、Worker 和 Migration”。
- `integrations` 负责“可选包怎样接入 Core 已有服务”，防止可选 CMS 反向污染 Core 模块目录。

Identity 的 Auth/Access 路由和服务已经迁至 `packages/identity/src`，Integrations Core、Jobs/Outbox、
Assets 与 Notifications 的 REST、Service 和迁移已经分别迁至对应独立包。Frame 中
相同路径只保留 deprecated 转发；
`integrations/*/ports.ts` 负责把 Audit、Qiniu、Jobs 等 Adapter 接到新 Feature Ports；
其中 `integrations/integrations/ports.ts` 是 `integration_connections` 在 Frame 内唯一的查询适配器，
Assets、Notifications、Identity 与全局搜索均通过 Integrations 公共连接端口访问；
Identity 的 `PostgresIdentityAccountDirectory` 是账号只读查询适配器，Notifications、Presentation 和
全局搜索不再直接访问 `accounts` 表；
Presentation 的 `PostgresPresentationProfileReader` 为 Identity 邮件挑战提供窄化品牌读取能力；
Audit 读写契约及 PostgreSQL Adapter 位于 `packages/audit`；Feature 和旧平台写服务均通过组合根注入
`AuditCommandPort`，Audit API 与 Identity 安全事件通过 `AuditQueryPort` 读取，Frame 内部 recorder 和
`audit_logs` 查询均已删除；
厂商协议实现已迁至独立 Adapter 包。Frame 不再承载 Identity、Integrations Core、Jobs、Assets 或
Notifications 业务实现。

`packages/frame/src/index.ts` 继续导出稳定的兼容入口。CMS 适配通过 `@lingcootech/frame/cms` 显式导入，
因此不安装 CMS 的 Consumer 不会在概念上获得 CMS。

## 4. 包之间的依赖方向

```text
reference apps
      │
      ├─────────────────────────────┐
      ▼                             ▼
 frame-fastify / database / otel   frame compatibility / feature extensions
      │                             │
      └──────────► frame-kernel ◄───┘
                       │
                       ▼
                 extension-sdk

ui ──► design-tokens
```

关键规则：

1. `apps` 可以依赖 `packages`，`packages` 不能依赖 `apps`。
2. 业务系统依赖包的公开 `exports`，不能导入包内 `src`。
3. `extension-sdk` 只定义组合协议，不依赖 Fastify 或数据库适配器。
4. `kernel` 只依赖公共契约；基础设施 Adapter 依赖 Kernel Port，不能反向依赖。
5. `database` 实现 PostgreSQL Port；领域功能通过命名空间迁移加入自己的表。
6. Admin/Web 浏览器入口不能导入 Server、Worker、Migration 或密钥处理实现。

## 5. 一个系统如何被组合

推荐按以下顺序阅读：

1. `apps/reference-system/src/system.ts`：定义 Reference System 安装哪些扩展。
2. `apps/reference-system/src/server.ts`：把该 System 交给 HTTP Host，并指定参考前端静态目录。
3. `apps/reference-system/src/worker.ts`：把同一个 System 交给 Worker。
4. `apps/reference-system/src/migrate.ts`：把同一个 System 交给 Migration Runtime。
5. `packages/frame/src/core/extension.ts`：Core 如何贡献 Server、Worker 和 Migration。
6. `packages/frame/src/host/app.ts`：HTTP Host 如何安装扩展和公共基础设施。
7. `packages/frame/src/runtime/worker.ts` 与 `migrations.ts`：另外两个运行面如何执行相同组合。

## 6. 测试归属

- 包内部行为测试放在对应 `packages/<name>/test`。
- Reference Web 自身页面测试放在 `apps/reference-web/test`。
- 跨 Frame、CMS、示例扩展、数据库迁移的组合测试放在 `test/integration`。
- `fixtures/consumer` 由 `npm run packages:verify` 使用，验证真实 tarball，而不是 workspace 源码捷径。

## 7. 构建产物

每个 workspace 的 `dist/` 都是可重新生成的构建产物，不属于源代码。根目录不再拥有 Backend
`dist/`；Frame Backend 产物在 `packages/frame/dist`，可部署系统产物在
`apps/reference-system/dist`。根 `scripts/`、`test/` 和 `deploy/` 仍然需要，它们分别承担仓库级验收、
跨包测试和生产部署职责。
