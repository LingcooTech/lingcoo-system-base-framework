# Frame 0.7 Package Contracts

## 状态

`0.7` 是第一个通过 `@lingcootech` scope 分发的包契约。仓库 CI 验证真实 npm tarball。公开 Stable
目标是 npmjs 的 `latest` dist-tag；scope 释放前由 GitHub Packages 承载需要 Token 的 `preview` 和
`canary`。Consumer 应锁定同一 `0.7.x` Backend、
Database、Extension SDK、Admin、Web 和一方扩展版本，不导入 `exports` 之外的文件。

Stable Consumer 通过普通 npm 依赖消费 Frame，不拉取或复制 Frame 源码，也不需要 Registry Token：

```bash
npm install @lingcootech/frame@0.7.2 @lingcootech/frame-cms@0.7.2
```

只有需要 Preview/Canary 的应用才配置以下 scope：

```ini
@lingcootech:registry=https://npm.pkg.github.com
```

开发中的跨仓库验证使用与 Git commit 绑定的 `canary` 版本；验证通过后再发布不可变 Preview 或 Stable 版本。
应用必须提交 lockfile，生产环境禁止自动跟随 dist-tag。

## 包边界

| 包                                   | 职责                                                              | 公开入口                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@lingcootech/frame-extension-sdk`   | 基础设施无关的 Manifest/System 与分运行面公共契约                 | `.`, `./server`, `./worker`, `./migrations`                                                                         |
| `@lingcootech/frame-kernel`          | System、Capability、Extension 与 Migration Engine                 | `.`, `./ports`, `./extensions`, `./migrations`                                                                      |
| `@lingcootech/frame-fastify`         | Fastify HTTP Host Adapter 与存活/就绪探针                         | `.`                                                                                                                 |
| `@lingcootech/frame-database`        | PostgreSQL/Drizzle Adapter、Schema、Migration Runner              | `.`, `./schema`, `./migrations`                                                                                     |
| `@lingcootech/frame-audit`           | Audit 读写公共契约与 PostgreSQL Adapter                           | `.`, `./postgres`                                                                                                   |
| `@lingcootech/frame-opentelemetry`   | 可选 OpenTelemetry API Adapter                                    | `.`                                                                                                                 |
| `@lingcootech/frame-identity`        | Identity Feature、账号目录端口、Fastify Server 与 PG Adapter      | `.`, `./contracts`, `./environment`, `./provider`, `./postgres`, `./server`, `./migrations`, `./password`, `./rbac` |
| `@lingcootech/frame-integrations`    | Provider-neutral 连接端口、加密凭据、调用事件与 Provider Registry | `.`, `./contracts`, `./server`, `./migrations`, `./crypto`                                                          |
| `@lingcootech/frame-assets`          | Provider-neutral 资产生命周期、引用、REST、Worker 与 Migration    | `.`, `./contracts`, `./server`, `./worker`, `./migrations`                                                          |
| `@lingcootech/frame-presentation`    | 品牌呈现、Public Site Discovery 与站点配置                        | `.`, `./contracts`, `./server`, `./postgres`, `./migrations`                                                        |
| `@lingcootech/frame-mail-nodemailer` | Nodemailer SMTP Provider、Service 与管理路由                      | `.`                                                                                                                 |
| `@lingcootech/frame-storage-qiniu`   | 七牛对象存储 Provider、Service 与管理路由                         | `.`                                                                                                                 |
| `@lingcootech/frame-ai-openrouter`   | OpenRouter Provider、Service 与管理路由                           | `.`                                                                                                                 |
| `@lingcootech/frame-payments`        | 支付宝、微信支付 Provider 与统一 PaymentService                   | `.`                                                                                                                 |
| `@lingcootech/frame-jobs`            | 可选 Jobs/Outbox Feature、REST、Worker Registry 与 Migration      | `.`, `./contracts`, `./server`, `./worker`, `./migrations`                                                          |
| `@lingcootech/frame-notifications`   | 可选通知、投递编排、Mail Ports、Worker 与 Migration               | `.`, `./contracts`, `./server`, `./worker`, `./migrations`                                                          |
| `@lingcootech/frame`                 | 旧 Host/Worker/Core/一方适配的迁移期兼容聚合包                    | `.`, `./app`, `./env`, `./worker`, `./extensions`, `./manifest`, `./migrations`, `./cms`                            |
| `@lingcootech/frame-admin`           | Admin Shell、认证、路由、系统信息与扩展注册表                     | `.`, `./manifest`, `./auth`, `./layout`, `./router`, `./shared`, `./system-info`, `./styles.css`                    |
| `@lingcootech/frame-web`             | Web Registry、公共站点壳、SEO、状态与账号安全流程                 | `.`, `./manifest`, `./layout`, `./site`, `./presentation`, `./seo`, `./system-states`, `./account`, `./styles.css`  |
| `@lingcootech/frame-cms`             | 可选 CMS 一方扩展及全部运行面                                     | `.`, `./contracts`, `./server`, `./worker`, `./migrations`, `./admin`, `./web`, `./styles.css`                      |
| `@lingcootech/frame-ui`              | 无业务语义的 React UI 组件和共享样式                              | `.`, 组件子路径, `./styles.css`                                                                                     |
| `@lingcootech/frame-design-tokens`   | 基础、后台和公共站点语义 Token                                    | `./base.css`, `./admin.css`, `./public.css`                                                                         |

`apps/reference-admin` 和 `apps/reference-web` 是参考应用，不属于 Consumer API；它们已经使用
Admin/Web Registry 组合 Frame Core 页面。业务系统消费 Shell 包并安装自己的前端扩展入口，不复制
参考应用的中心路由分支。

Reference Web 的官方站点扩展属于应用层示例，不是 Frame 公共包。它拥有 `/`、`/framework`、`/architecture`、
`/packages`、`/extensions`、`/docs` 和 `/releases`；通用 `@lingcootech/frame-web` 仅保留 `/auth/:mode`。

## 系统组合

零扩展应用优先从真实 Kernel 和 Adapter 组合：

```ts
import { buildFastifyHost } from '@lingcootech/frame-fastify';
import { frameKernelSystem } from '@lingcootech/frame-kernel';

const app = await buildFastifyHost({ system: frameKernelSystem });
await app.listen({ port: 8090 });
```

需要 PostgreSQL 时，由应用组合根显式传入 `createPostgresAdapter()`；不传数据库时 Host 仍可启动。
完整应用使用兼容 Host/Worker，但在组合根显式安装 Feature：

```ts
import { buildApp, createFrameWorker } from '@lingcootech/frame';
import { frameCmsExtension } from '@lingcootech/frame/cms';
import { frameIntegrationsExtension, frameKernelExtension } from '@lingcootech/frame/extensions';
import { defineSystem } from '@lingcootech/frame-extension-sdk';
import { frameIdentityExtension } from '@lingcootech/frame-identity';
import { frameAssetsExtension } from '@lingcootech/frame-assets';
import { frameJobsExtension } from '@lingcootech/frame-jobs';
import { frameNotificationsExtension } from '@lingcootech/frame/extensions';
import { officialSiteExtension } from '@lingcootech/official-site-extension';

const system = defineSystem({
  id: 'official-site',
  version: '0.1.0',
  extensions: [
    frameKernelExtension,
    frameIdentityExtension,
    frameIntegrationsExtension,
    frameJobsExtension,
    frameAssetsExtension,
    frameNotificationsExtension,
    frameCmsExtension,
    officialSiteExtension,
  ],
});

const app = await buildApp(env, { system });
const worker = createFrameWorker(env, { system });
```

省略任一 Feature Extension 即不会安装它的路由、Worker 合约与迁移；只组合 Kernel 时得到无 Feature 的
空系统。
`defineSystem()` 校验扩展 ID、SemVer、Frame/API 兼容范围、依赖完整性和循环，并稳定拓扑排序。它会
拒绝重复权限、设置、路由、Job Kind、Migration Source 和 Legacy Alias；多个扩展订阅同一个 Outbox
Topic 是合法 fan-out。`buildApp(env)`、`createFrameWorker(env)` 和 `runSystemMigrations()` 的默认
System 都是零扩展 Kernel。仓库 Reference System 在自己的组合根中直接安装
`frameIdentityExtension`、`frameIntegrationsExtension`、`frameJobsExtension`、
`frameNotificationsExtension` 与 CMS；这些能力不会进入
新 Kernel。Notifications 的默认包不包含 SMTP；兼容 Frame 入口为 Reference System 注入当前 SMTP/Mail
Adapter，独立应用也可以注入自己的邮件服务。

## 运行面

- `@lingcootech/frame-extension-sdk`：只含 Manifest、`defineExtension()`、`defineSystem()` 和基础设施无关契约。
- `./server`：默认使用最小 HTTP Application Contract；需要 Fastify 专有 API 的扩展显式参数化 Adapter 类型。
- `@lingcootech/frame-kernel`：验证系统兼容性、Capability 实现、扩展路由声明和 Migration Source 一致性。
- `@lingcootech/frame-fastify`：安装成熟 Fastify 中间件、错误契约与探针，并通过 Kernel Engine 注册扩展。
- `@lingcootech/frame-database`：实现 Kernel Database Port，连接与探针生命周期由 Host 组合根管理。
- `@lingcootech/frame-opentelemetry`：桥接官方 API；没有全局 Provider 时保持 no-op。
- `./worker`：通过受限上下文注册声明过的 Job Handler 与 Outbox Subscriber。
- `./migrations`：Migration Source 定义及数据库迁移类型，不进入浏览器入口。
- `@lingcootech/frame-admin`：Admin Route、Navigation、Dashboard Widget、Search Provider 和 Landing
  Block Editor；同时提供可注入 Client 的认证上下文、可配置基路径的浏览器路由、响应式应用 Shell、Topbar
  搜索/通知/账户入口、Frame 版本页脚，以及表格、筛选、分页、批量操作、详情抽屉、确认操作和 Asset
  Picker。`./system-info` 提供 Runtime/Extension/Migration/Observability/Operations 浏览器安全类型、
  可注入 Client 和集中式系统信息页。`./defaults` 提供完整的 Frame 默认后台页面、同源 API Client 和
  `createFrameAdminExtension()`；Consumer 只负责自己的首页和业务页面，不复制 Reference Admin。React 由
  Consumer 提供，并显式引入 `./styles.css`。
- `@lingcootech/frame-web`：Public Route、SEO Resolver、Sitemap Collector 和 Landing Block Registry；
  同时通过独立子入口提供 SiteShell、布局、Presentation、SEO Head、404/500、错误边界和公共账号安全
  流程。React 与 React DOM 由 Consumer 提供，不重复打包；Consumer 显式引入 `./styles.css`。
- `@lingcootech/frame-cms`：在独立运行面之外提供可直接安装的 CMS Admin/Web 默认页面。`./admin` 暴露内容列表、
  编辑器、版本、SEO 预览、计划发布和重定向工作流，以及 `CmsAdminClient`/请求工厂；`./web` 暴露文章
  列表、文章/页面详情、预览、Markdown 渲染、分页和空状态，以及 `CmsWebClient`/请求工厂。两者都由
  Consumer 注入 API Transport 和品牌上下文，Consumer 不复制 Reference App 页面；`./styles.css` 随包
  发布 CMS Admin/Web 的专属样式。

Frame Admin Manifest 不注册 `/`，Consumer 必须为自己的应用首页声明 Route。Frame 技术 Route 会注册到
Registry 并继续执行权限控制，但不产生侧栏 Navigation；默认只贡献一个 `/settings` 应用设置入口。
安装 CMS 或领域扩展时，业务导航由对应扩展 Manifest 独立贡献。Footer 的 `/system` 是 Frame 系统信息的
默认入口，不应由 Consumer 再复制一组技术导航。

`/api/system/runtime` 保留 `name`、`version`、`environment` 和 `surfaces`，并增加当前 Defined System、
Frame/Extension API 版本、已安装扩展贡献与 Migration V2 账本摘要。该接口只返回 Manifest 和迁移状态
元数据，不返回环境变量、数据库连接、Provider Credential 或其他 Secret。Observability 和 Job/Outbox
摘要继续使用各自权限与 API，由 `AdminSystemInfoClient` 按权限组合。

设置 Registry 归属于每个 Defined System，不再由业务扩展修改进程级全局数组。Worker 注册器同样按
Worker 实例创建；扩展只能注册 Manifest 已声明的 Job 和 Topic。

## Migration V2

```ts
import { runSystemMigrations } from '@lingcootech/frame/migrations';

await runSystemMigrations({
  connectionString: process.env.DATABASE_URL!,
  system,
});
```

迁移全局名称为 `source-id/migration-id.sql`。来源按依赖拓扑排序，来源内部严格采用声明顺序，不依赖
文件系统排序。执行器验证 SQL SHA-256，使用 PostgreSQL advisory lock 串行化，并支持 Legacy Alias：
一条或多条旧记录的 checksum 全部匹配时只写入 canonical adoption 记录，不执行 SQL；任一旧记录
不匹配、不同迁移重复声明 alias 或已应用 canonical checksum 变化都会立即失败。未知历史记录保持不变。

低层 `lingcoo-frame-migrate` CLI 只迁移 Database Core。仓库 `npm run db:migrate` 与生产部署调用
`runSystemMigrations()`，会按实际 Defined System 纳入一方和领域扩展迁移。

## 受控 Landing Block

页面只存储 `{ id, type, schemaVersion, config }` JSON。扩展代码注册稳定 Block Type、Zod Schema、
公共 Renderer、后台 Editor、资产引用函数和显式配置迁移。Registry 拒绝函数、类实例、非有限数字、
未知类型、未来 Schema 版本和不完整迁移链；数据库不保存 JSX、脚本或任意可执行代码。

## 发布产物验收

`npm run packages:verify` 构建并打包 Kernel、基础设施 Adapters、Frame 兼容包、Extension SDK、Admin、Web、CMS、UI、Design
Tokens 与完整示例扩展，再在临时目录隔离安装。Consumer Fixture 会进行 TypeScript 公共入口编译，组合
API/Worker/Admin/Web/CMS 默认页面，验证示例页面、搜索、SEO、Sitemap、Landing Block 和 13 条系统迁移。CI 提供
PostgreSQL 17，并真实执行全部迁移。

包版本由 Changesets 统一管理：`npm run changeset` 记录变更，`npm run version:packages` 应用版本，
`Release Frame Packages` workflow 发布 Preview/Stable，`Release Frame Canary` workflow 发布当前提交的
不可变 Canary。发布脚本只读取明确列出的公开包和 `create-frame-app` 生成器，不会发布 Reference
App 或 Fixture。

完整扩展结构、规则与示例见 [扩展开发与系统组合](extension-development.md)，第一方模块依赖与端口见
[第一方扩展边界](first-party-extensions.md)。独立业务仓库的安装、开发、CI、Docker 和生产部署顺序见
[基于 Frame 的应用全生命周期](application-lifecycle.md)。
