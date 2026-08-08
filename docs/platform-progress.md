# Frame 平台化开发进度

本文件在每个阶段完成时记录实际交付、验证结果、遗留问题和下一阶段入口。规划以
[`platform-roadmap.md`](platform-roadmap.md) 为准，架构决策以 [`adr/`](adr/README.md) 为准。

## 总体状态

| 阶段              | 状态        | 结果                                               |
| ----------------- | ----------- | -------------------------------------------------- |
| 0. 架构冻结       | Completed   | 4 项 ADR、平台路线、0.1 基线和质量门槛已冻结       |
| 1. 0.2 包化       | Completed   | 4 个可安装包、公开导出和 tarball Consumer 验收完成 |
| 2. 扩展内核       | Completed   | 0.3 系统组合、分运行面注册与 Migration V2 已完成   |
| 3. 前端扩展       | Completed   | 0.4 Admin/Web Shell 与受控 Landing Block 已完成    |
| 4. 第一方扩展     | Completed   | 0.5 CMS 一方扩展、Service Port 与显式启停已完成    |
| 5. Consumer 试点  | Not started | -                                                  |
| 6. 文档与参考应用 | Not started | -                                                  |
| 7. 开源 Beta      | Not started | -                                                  |
| 8. 1.0 稳定       | Not started | -                                                  |

## 阶段 0：架构冻结

### 范围

- 固定从源码模板转为版本化依赖的目标。
- 固定第一轮包边界、扩展运行面和组合方式。
- 固定迁移命名空间、历史 adoption 和前向兼容规则。
- 固定 SemVer、发布通道、升级方式和核心开源边界。
- 记录 0.1 基线、阶段路线、质量门槛和主要风险。

### 完成记录

- Completed: 2026-08-04
- Baseline commit: `9aa93e3`

已交付：

- `platform-roadmap.md`：记录 0.1 基线、0 到 8 阶段、验收门槛、风险和完成定义。
- ADR 0001：确定版本化依赖、Frame Monorepo 和独立 Consumer 模型。
- ADR 0002：确定构建期显式扩展、运行面分离和 Landing Block 边界。
- ADR 0003：确定命名空间迁移、checksum、Legacy Alias 和前向升级规则。
- ADR 0004：确定 SemVer、发布通道、受控升级和 Apache-2.0 Core 开源路线。
- README 和架构文档已改为“参考实现向可依赖平台演进”的准确定位。
- `lingcoo.framework.json` 已补齐当前 16 个基础模块。
- 修复两处既存 Prettier 格式偏差，没有逻辑变化。

验证结果：

- `npm run format:check`：通过。
- `npm run check`：通过。后端 49 项中 40 通过、9 项 PostgreSQL 集成测试在本地按设计跳过；
  Public Web 4 项和 Frame UI 4 项全部通过。
- `npm run build:all`：Admin UI、Public Web 和 Server 生产构建通过。
- `git diff --check`：通过。

未解决事项：

- PostgreSQL 集成测试需在提交后由 CI 真实数据库环境补充验证。
- 包名、公开 `exports` 和 Consumer Fixture 目录将在阶段 1 以可运行实现确定。
- 当前功能模块仍保持原位，避免阶段 0 产生运行行为改动。

阶段 1 输入：

- 以 ADR 0001 的粗粒度包边界为起点，不先拆分 CMS 等可选模块。
- 先建立可安装的 Backend/Database/UI 打包产物和公开导出。
- 在 Frame 仓库中建立最小 Consumer Fixture，验证不复制源码的 API、Worker、迁移和构建。
- 为打包产物增加 `npm pack` 安装测试，但暂不发布公共 npm 版本。

## 阶段 1：0.2 包化

### 范围

- 将后端宿主从私有参考工程改为有明确 `exports` 的 `@lingcoo/frame@0.2.0`。
- 建立独立 `@lingcoo/frame-database`，承载连接、Schema、迁移运行时和历史 SQL。
- 将 UI 与 Design Tokens 从 TypeScript/CSS 源码导出改为编译产物导出。
- 提取无导入副作用的 Worker 工厂，保留现有参考 CLI 与容器运行方式。
- 使用真实 npm tarball 建立隔离 Consumer Fixture 和 CI 门槛。

### 完成记录

- Completed: 2026-08-04
- Starting commit: `6abdd2b`

已交付：

- `@lingcoo/frame`：公开 `.`, `./app`, `./env`, `./worker`，包含声明、Source Map 与参考 Web 产物。
- `@lingcoo/frame-database`：公开连接工厂、完整基础 Schema、迁移发现/执行 API 和迁移 CLI；迁移
  `0000` 至 `0011` 随包发布且 checksum 行为不变。
- `@lingcoo/frame-ui`：全部组件子路径指向 `dist` JavaScript 与声明文件，React/React DOM 保持 peer
  dependency，内部 ESM 引用使用显式 `.js` 后缀。
- `@lingcoo/frame-design-tokens`：基础、Admin 和 Public CSS 从 `dist` 发布。
- Worker：`createFrameWorker()` 不在 import 时读取环境、监听端口或挂载 Signal；现有 `src/worker.ts`
  变为薄 CLI。
- 构建：每次编译先清理旧 `dist`，避免删除或移动后的内部文件混入发布 tarball。
- Consumer Fixture：临时目录隔离安装四个 `.tgz`，验证包内容、公共导入、React 类型构建、API
  注入、Database/Worker 生命周期和迁移发现；CI 有 PostgreSQL 时执行包内迁移。
- Docker：运行镜像保留 Database workspace 目标，部署改用编译后的迁移 CLI，不依赖生产 `tsx`。
- 文档：新增 `package-contracts.md`，记录当前公开 API、生命周期、消费方式和阶段边界。

验证结果：

- `npm run check`：类型检查、Lint 和无数据库回归通过；后端 50 项中 41 通过、9 项 PostgreSQL 测试
  按设计跳过；Public Web 4 项与 Frame UI 4 项通过。
- PostgreSQL 17 实际回归：`0000` 至 `0011` 从空库迁移成功，后端 50/50、Public Web 4/4、Frame UI
  4/4 全部通过，无跳过项。
- `npm run packages:verify`：四个 tarball 内容检查、隔离安装、Consumer UI 编译与运行时验收通过；
  Consumer 连接 PostgreSQL 后使用包内 SQL 完成 12 项 checksum 校验。
- `npm run build:all`：Design Tokens、UI、Database、Admin UI、Public Web 和 Server 构建通过。
- 生产 Docker 镜像构建通过；一次性容器可解析 Frame/Database 公共入口并发现全部 12 个迁移。
- `npm audit --omit=dev --audit-level=high`：修复 `fast-uri` 公告后 0 项已知生产依赖漏洞。
- `npm run format:check` 与 `git diff --check`：通过。

未解决事项：

- 当前 `buildApp()`、Worker Handler 和前端路由仍组合固定基础模块；业务扩展还不能通过单一组合根安装。
- 历史迁移已归属 Database 包，但命名空间、Legacy Alias adoption、依赖排序和冲突检查尚未实现。
- Admin UI 与 Public Web 仍是参考应用构建，不是可由 Consumer 组合的前端 Shell 包。
- 本阶段验证发布产物，但不发布公共 npm 版本；发布通道与兼容矩阵在后续阶段完善。

阶段 2 输入：

- 实现 `defineSystem()` 和统一 Extension Manifest/Registry，按 Server 与 Worker Surface 显式组合。
- 实现 Migration V2：命名空间 ID、依赖图、checksum、Legacy Alias adoption 和冲突拒绝。
- 将现有 AppModule、Job Handler、Outbox Subscriber、权限和设置注册适配到 Extension Contract。
- 增加一个最小示例扩展，覆盖权限、API、任务、事件和迁移，并验证重复 ID、缺失依赖、循环依赖、
  路由/权限/Job 冲突等失败路径。
- 阶段 2 不拆 Admin/Web 前端中心路由；前端扩展注册表仍属于阶段 3。

## 阶段 2：扩展内核

### 范围

- 发布 `@lingcoo/frame-extension-sdk@0.3.0`，提供 Manifest、`defineExtension()` 与 `defineSystem()`。
- 将 Frame Core、Fastify Server、Worker、设置和迁移接入统一 Defined System。
- 实现 Migration V2 的命名空间、来源依赖、Legacy Alias adoption 和 checksum 保护。
- 建立一个覆盖权限、设置、API、Job、Outbox 事件和 SQL 迁移的完整示例扩展。
- 对依赖图、资源冲突、运行面声明和历史数据库升级建立自动化验收。

### 完成记录

- Completed: 2026-08-04
- Starting commit: `8160dff`

已交付：

- Extension SDK：根入口保持浏览器安全；`./server`、`./worker`、`./migrations` 分离 Fastify、Worker
  与 Node.js 数据库依赖。Manifest 包含版本/API/Frame 兼容范围、必需与可选依赖、权限、非敏感设置、
  Server 路由、Worker Job/Topic 和迁移声明。
- System Registry：`defineSystem()` 使用 SemVer 校验并进行输入稳定的拓扑排序；拒绝无效版本、扩展
  重复、依赖缺失/不兼容/循环，以及权限、设置、路由、Job、Migration Source、Migration ID 和
  Legacy Alias 冲突。Outbox Topic 保留多订阅者 fan-out 语义。
- Core Adapter：现有 16 个 AppModule、31 项基础权限、5 项设置、4 个 Job、1 个事件订阅和 12 条
  迁移已经由 `frameCoreExtension` 统一描述和注册。`buildApp(env)` 与 `createFrameWorker(env)` 默认行为
  保持兼容，也可以接收 Consumer 的 Defined System。
- 设置隔离：新增每个 System 独立的 `SettingsRegistry`，服务不再依赖可被扩展修改的进程级全局数组；
  旧只读导出保留兼容。
- Worker Registry：每个 Worker 实例按 System 注册 Handler/Subscriber；受限上下文拒绝未声明贡献，
  并验证每个声明都有实现。状态快照公开已安装扩展、Job Kind 和 Topic。
- Migration V2：canonical 名称为 `source/id.sql`，来源按依赖排序、来源内按 Manifest 顺序；执行器使用
  SHA-256 与 PostgreSQL advisory lock。canonical/alias checksum 不匹配、重复 alias、来源缺失/循环
  会立即失败，未知历史记录保持不变。
- 历史兼容：`0000` 至 `0011` SQL 字节未修改，Frame Migration Source 为每项声明旧文件名 alias。
  实际 Stage 1 数据库中的 9 条旧记录已在不重放 SQL 的情况下 adopted，后续 3 条迁移正常执行。
- 完整示例扩展：独立 `contracts/server/worker/migrations` 入口，包含 `example.read`、
  `example.greeting`、`GET /api/example`、`example.echo`、`example.created` 和
  `example/0001_initial.sql`，由测试与 tarball Consumer 实际使用。
- 分发：Frame 与 Database 升至 `0.3.0`；Extension SDK 纳入 workspace、Docker 构建和运行镜像；
  新增 `./extensions` 与 `./migrations` 公共入口，以及系统迁移 API。
- 文档：更新 Package Contracts 与架构说明，新增扩展开发、系统组合、迁移和跨扩展规则文档。

验证结果：

- `npm run check`：无数据库回归通过；后端 60 项中 49 通过、11 项 PostgreSQL 测试按设计跳过；
  Public Web 4/4、Frame UI 4/4 通过，全部 workspace 类型检查和 Lint 通过。
- PostgreSQL 17 空库：12 条 Frame canonical 迁移全部成功；后端 60/60、Public Web 4/4、Frame UI
  4/4 全部通过，无跳过项。Migration V2 adoption 与 checksum mismatch 集成测试均通过。
- PostgreSQL 17 旧库：Stage 1 的 `0000` 至 `0008` 9 条历史记录全部 adopted，SQL 未重放；`0009`
  至 `0011` 以 canonical ID 正常执行。
- `npm run packages:verify`：6 个真实 tarball 构建和隔离安装通过；Consumer TypeScript、示例 API、
  Worker 注册和含示例扩展的 13 条系统迁移通过。
- 生产 Docker 镜像构建通过；非 root 运行容器可导入 Frame、Database 与 Extension SDK，识别 12 条
  核心迁移和 4 个核心 Job。
- `npm audit --omit=dev --audit-level=high`：0 项已知生产依赖漏洞。
- `npm run format:check` 与 `git diff --check`：通过。

未解决事项：

- Admin UI 与 Public Web 仍是参考应用固定路由，Manifest 尚未包含前端贡献；这是阶段 3 的明确范围。
- Core 的现有模块仍由一个粗粒度 `frameCoreExtension` 承载；CMS、资产、通知与品牌等可选第一方扩展
  的物理拆分属于阶段 4，现阶段不提前制造循环微包。
- Server 会验证声明路由存在并拦截与已安装路由冲突；0.3 的受信任扩展模型不尝试沙箱化 Fastify，
  因此不能阻止恶意扩展通过原生实例注册额外路由。
- 本阶段继续使用内部 tarball 验收，尚未建立 Changesets、私有 Registry 发布和公共 Beta 通道。

阶段 3 输入：

- 建立 `@lingcoo/frame-admin` 与 `@lingcoo/frame-web` 的可消费 Shell，不再把参考应用源码作为 Consumer
  的前端实现。
- 扩展 Manifest 增加 Admin 路由、导航、Dashboard Widget、全局搜索，以及 Public Web 路由、SEO、
  Sitemap 和 Landing Block 声明，并保持 contracts 入口浏览器安全。
- 分别实现 Admin/Web Registry、依赖顺序与冲突检查，使扩展增加页面不再修改中心路由和菜单分支。
- Landing Block 使用类型、Zod Schema、渲染器、编辑器、资源声明和配置迁移的受控注册表，不允许
  数据库存储任意可执行代码。
- 扩展示例增加 Admin 页面、Public Web 页面和一个 Landing Block，并继续通过真实 tarball Consumer
  验证浏览器依赖边界、路由冲突与生产构建。

## 阶段 3：前端扩展

### 范围

- 发布可消费的 `@lingcoo/frame-admin@0.4.0` 与 `@lingcoo/frame-web@0.4.0`。
- 将 Admin/Web 声明纳入浏览器安全 Manifest 和 `defineSystem()` 冲突检查。
- 让参考 Admin/Public Web 使用注册表选择页面，不再维护中心路由分支。
- 建立受控 Landing Block Type、Schema、Renderer、Editor、Asset 和配置迁移协议。
- 由完整示例扩展和真实 tarball Consumer 验证全部前端运行面。

### 完成记录

- Completed: 2026-08-05
- Starting commit: `166c7c2`

已交付：

- Extension Manifest：增加 Admin Route、Navigation、Dashboard Widget、Search Provider、Landing Block
  Editor，以及 Web Route、SEO、Sitemap 和 Landing Block 声明。`defineSystem()` 会拒绝无效路径、
  引用缺失、参数同构路由冲突、重复贡献 ID、重复 Block Type 和无对应 Block 的 Editor。
- 运行面投影：`projectExtensionManifest()` 让浏览器组合根只保留 Admin 或 Web 声明，避免把 Fastify、
  Worker、数据库和迁移实现带入前端构建；Landing Block Editor 投影会保留必要的 Block 声明。
- `@lingcoo/frame-admin`：提供 `AdminShell`、Registry Context、Route Slot、Dashboard Widget Slot，以及
  Route、Navigation、Search 和 Landing Block Editor 注册表。声明与实现逐项核对，运行时拒绝漏注册、
  重复注册和未声明实现；路由支持静态段、参数段和末尾通配符。
- `@lingcoo/frame-web`：提供 `WebShell`、Route Slot、SEO Resolver、Sitemap Collector 和 Landing Block
  Registry。注册顺序遵循 System 依赖拓扑，路由匹配优先选择更具体的模式。
- Landing Block：数据库边界只接受 JSON 配置；每个 Type 必须提供 Zod Schema、公共 Renderer、后台
  Editor、资产引用函数和显式配置迁移。Registry 拒绝未知类型、函数/类实例、非有限数字、未来版本、
  缺失迁移链、Schema 失败和非法资产引用，不允许数据库保存任意可执行代码。
- Frame Core：完整 Manifest 现在由 Backend、Admin 和 Web 声明共同组成；`./manifest` 是浏览器安全
  公共入口。Admin/Web 内置声明分别由 Shell 包的 `./manifest` 提供，避免前端依赖服务端根包。
- Reference Admin：`App.tsx` 的 15 路中心条件分支已删除；页面、侧栏、当前页元数据、Dashboard
  Widget 和全局搜索从 Admin Registry 解析，现有鉴权、响应式壳和视觉行为保持不变。
- Reference Web：首页、账号安全、预览、文章列表、文章详情和页面详情全部成为 Web Route
  Contribution；未知路径统一由 Route Slot 进入 404，现有站点壳和品牌读取保持不变。
- 示例扩展：新增独立 `./admin` 与 `./web` 入口，实际贡献一个后台页、导航、Widget、搜索源、公共页、
  SEO、Sitemap 和 `example.hero` Landing Block。该 Block 含 V1 到 V2 配置迁移与 Asset ID 声明。
- 分发：Frame、Database、Extension SDK、Admin 和 Web 统一升至 `0.4.0`；Docker dependencies/runtime
  层包含两个新 workspace，React 继续由 Consumer 作为 peer dependency 提供。
- Consumer Fixture：8 个真实 tarball 在临时目录隔离安装，公共 TypeScript 入口、API、Worker、13 条
  系统迁移和全部前端贡献均从包导出执行，不导入仓库内部源码。

验证结果：

- `npm run check`：无数据库回归通过；后端 64 项中 53 通过、11 项 PostgreSQL 测试按设计跳过；
  Public Web 4/4、Frame UI 4/4 通过，全部 workspace 类型检查和 Lint 通过。
- PostgreSQL 17 空库：12 条 Frame canonical 迁移全部成功；后端 64/64、Public Web 4/4、Frame UI
  4/4 全部通过，无跳过项。
- `npm run packages:verify`：8 个 tarball 的内容、隔离安装、Consumer TypeScript 和运行时验收通过；
  Consumer 验证示例 Admin/Web/SEO/Sitemap/Landing Block，并在 PostgreSQL 中组合 13 条系统迁移。
- `npm run build:all`：Admin UI、Public Web、Server 和全部共享包生产构建通过。
- 生产 Docker 镜像：构建通过；非 root 容器可加载 Admin/Web Manifest、提供双 Web 静态产物并通过
  `/health` 与 `/ready` 探针。
- `npm audit --omit=dev --audit-level=high`：0 项已知生产依赖漏洞。
- `npm run format:check` 与 `git diff --check`：通过。

未解决事项：

- Reference Admin 单入口压缩后约 524 kB，Vite 有分包提示但不影响构建；按页面懒加载和稳定 Chunk
  策略留到真实 Consumer 试点前处理，避免本阶段同时改变加载行为。
- Web Sitemap Collector 已提供组合 API；参考系统现有 `/sitemap.xml` 仍由 Server 侧 Public Site/CMS
  数据源生成。需要数据库动态 URL 的领域扩展应在阶段 4 通过 Service Port 接入服务端发现源，不能让
  Server 隐式执行浏览器入口。
- 当前继续使用内部 tarball 验收，尚未建立 Changesets、私有 Registry 发布和公共 Beta 通道。
- CMS、资产、通知和品牌仍属于粗粒度 `frameCoreExtension`；本阶段只完成前端贡献契约，没有提前拆包。

阶段 4 输入：

- 先绘制 CMS、资产、通知和品牌对 Auth、Settings、Audit、Jobs、Integration 与数据库的实际依赖图，
  提炼最少的 Service Port 和共享 Contracts，再移动物理目录。
- 以一个依赖最清晰的可选能力完成首个第一方扩展闭环，随后逐个拆分，不进行一次性目录搬迁。
- 每个第一方扩展必须同时使用本阶段的 Server、Worker、Admin、Web 和 Migration 公开入口；启停扩展
  不得要求修改 Frame 的中心路由、菜单或 Job 分支。
- 为动态 Sitemap、资产选择和 Landing Block 持久化建立服务端 Port，但保持数据库只存 JSON 配置、
  Asset ID 和版本，不引入运行时上传插件或任意代码执行。
- 继续验证空库、Stage 1/2 历史库升级、扩展启用/停用、真实 tarball Consumer 和生产镜像。

## 阶段 4：第一方扩展

### 范围

- 审计 CMS、资产、通知和品牌展示对 Core 能力的真实依赖，避免一次性拆分全部模块。
- 发布 `@lingcoo/frame-cms@0.5.0`，完成 Server、Worker、Admin、Web 与 Migration 五个运行面。
- 通过最小 Service Port 倒置 CMS 对审计、资产、分类、任务/Outbox 和公共站点发现的依赖。
- 让 CMS 能从 Defined System 显式启用或停用，不修改 Core 路由、菜单、Job 分支或迁移清单。
- 保持阶段 1 至 3 数据库账本和历史 SQL 字节兼容。

### 完成记录

- Completed: 2026-08-05
- Starting commit: `69c7d72`

已交付：

- 依赖审计：新增 `first-party-extensions.md`，记录 CMS、资产、通知和品牌展示的上下游依赖及后续
  拆分前置条件。CMS 不直接依赖 Settings/Integrations，因此被选为首个贯穿一方扩展。
- CMS 包：新增独立 `@lingcoo/frame-cms` workspace 和浏览器安全 `./contracts`，以及 `./server`、
  `./worker`、`./migrations`、`./admin`、`./web` 公开入口。版本统一推进到 `0.5.0`。
- Service Port：CMS 服务只通过 `CmsAuditPort`、`CmsAssetPort`、`CmsTaxonomyPort` 和 `CmsJobPort`
  使用其他能力；Frame 宿主提供现有 PostgreSQL/Audit/Assets/Metadata/Jobs 实现。
- 公共发现：新增 `PublicSiteRegistry`。CMS 以命名贡献注册动态 Sitemap URL 与站内重定向解析器；
  `src/app.ts` 和 Public Site Core 不再导入或构造 `CmsService`。
- 组合启停：Core Manifest、模块数组、Worker 和 Admin/Web Manifest 均移除 CMS 声明；默认参考 System
  显式加入 `frameCmsExtension`。Core-only System 不出现 CMS API、Job、搜索源、前端路由或迁移。
- 前端运行面：CMS 包拥有 Admin Route/Navigation 与 Web Route/SEO/Sitemap 声明和 Surface 工厂；参考
  Admin/Web 通过 Registry 安装完整现有页面，不再把 CMS 路由归属到 Frame Core。
- 迁移归属：`0009_cms_lite.sql` 与 `0011_cms_workflow.sql` 从 Database Core 原字节移动到 CMS 包；
  Core 从 12 条迁移缩减为 10 条，默认 System 仍为 12 条。
- 历史升级：Legacy Alias 现在安全支持 `source/id.sql` 形式。CMS 同时接管 Stage 1 文件名和 Stage 2/3
  的 `frame/...` canonical 记录；一条或多条历史记录的 checksum 全部匹配时仅新增
  `frame-cms/...` adoption 记录，任一不匹配仍立即失败。
- 部署迁移：`npm run db:migrate` 和生产部署改为调用 `dist/migrate.js` 的 System 迁移计划，不再错误地
  只运行 Database Core CLI。
- 分发与镜像：CMS tarball、Docker dependencies/build/runtime 三层、根包依赖与 Consumer Fixture 已
  全部接入；生产镜像包含 CMS 编译产物和两条 SQL。

验证结果：

- PostgreSQL 17 空库：10 条 Core 和 2 条 CMS canonical 迁移按依赖顺序全部应用；后端 66/66 通过，
  无跳过项；Public Web 4/4 与 Frame UI 4/4 通过。
- Stage 3 数据库：10 条 Core 已存在；`frame-cms/0009` 和 `frame-cms/0011` 分别从旧 `frame/...`
  记录 adopted，SQL 未重放。迁移文件与阶段 3 原文件 SHA-256 完全一致。
- 启停矩阵：Core-only 与 Core+CMS 的 Server、Worker、Migration、Admin 和 Web 注册状态均有自动测试；
  `defineSystem()` 将依赖稳定排序为 `frame -> frame-cms`，无循环。
- `npm run packages:verify`：9 个真实 tarball 构建并在临时 Consumer 隔离安装；Consumer 从公开入口
  验证 CMS API、Job、迁移、Admin/Web 路由、SEO/Sitemap，并组合示例扩展的 13 条系统迁移。
- `npm run build:all`：Server、Admin UI、Public Web 与全部共享/扩展包生产构建通过。
- 生产 Docker 镜像：全新依赖安装、构建和 prune 通过；生产依赖审计为 0 漏洞；非 root UID 100
  可导入 Frame/CMS，并识别 `frame + frame-cms` 和 12 条默认迁移。镜像内 `node dist/migrate.js`
  已实际连接 PostgreSQL 并通过。
- `npm run lint`、`npm run format:check` 与 `git diff --check`：通过。

未解决事项：

- Admin 生产单入口约 526 kB，仍触发 Vite 500 kB 分包提示；功能和构建不受影响，真实 Consumer 试点
  应以路由懒加载处理，而不是调高警告阈值。
- CMS Admin/Web Surface 工厂当前接收 Consumer 页面组件，参考应用保留完整默认实现。这允许站点壳与
  产品视觉不同，但阶段 5 需要用真实 Consumer 验证是否还应把更多默认页面实现提入一方包。
- CMS Drizzle Schema 暂时仍由 Database 包统一导出，只有迁移归属完成拆分；0.x 期间继续以一个共享
  Schema 包支持模块化单体，避免过早拆出循环 Schema 包。
- Assets、Notifications 和 Presentation 仍属于 `frameCoreExtension`；依赖审计已经确定前置 Port，但
  本阶段按路线约束不同时拆分。
- Landing Block 持久化端口没有空实现：当前 CMS 不存 Landing Block，没有可验证消费者。应由阶段 5
  的真实首页内容模型证明存储边界后再加入。
- Changesets、Registry 发布和公共 Beta 仍属于阶段 7，不在本阶段发布公共 npm 版本。

## 阶段 4.5：架构与目录对齐

### 范围

- 让 Monorepo 物理目录与 Host、Core、Runtime、Integration、Package 和 Reference App 架构逐层对应。
- 把根仓库从可发布 Backend 包改为私有 Workspace 调度器，将 `@lingcoo/frame` 迁入独立 Package。
- 建立 API、Worker 和 Migration 共用的 Reference System 组合根，显式安装 Core 与 CMS。
- 将参考前端、可发布 Shell、包内测试和跨包测试迁入清晰归属目录。
- 更新本地构建、真实 tarball Consumer、Docker 和生产部署入口，不改变历史 Migration ID 与 SQL。

### 完成记录

- Completed: 2026-08-06
- Starting commit: `3cfc463`

已交付：

- 顶层语义：形成 `apps/`、`packages/`、`fixtures/`、`test/integration/`、`scripts/`、`deploy/` 和
  `docs/` 七个清晰入口；删除旧根 Backend `src/`、历史根 `dist/` 和空目录。
- Frame 包：新增独立 `packages/frame@0.6.0`。源码按 `host/`、`core/`、`runtime/` 和
  `integrations/` 分层；根 `package.json` 只负责 Workspace 调度，不再发布。
- Reference System：新增 `apps/reference-system`，由 `system.ts` 显式组合
  `frameCoreExtension + frameCmsExtension`；Server、Worker 和 Migration 全部读取同一个 System。
- Reference Frontend：`admin-ui` 与 `public-web` 分别迁入 `apps/reference-admin` 和
  `apps/reference-web`；可发布的 Admin/Web Registry 分别迁入 `packages/admin-shell` 和
  `packages/web-shell`。
- Core 默认语义：`buildApp()`、`createFrameWorker()` 与 `runSystemMigrations()` 默认只安装 Core；CMS
  通过新的 `@lingcoo/frame/cms` 子入口显式接入，不再从 Frame 主入口隐式导出。
- CMS 边界：Frame 对 CMS 的 Audit、Asset、Taxonomy、Job 和 Search 适配集中到
  `packages/frame/src/integrations/cms`；旧 `core/modules/cms` 转发文件和空目录已删除。
- 测试归属：Frame 内部测试迁入 `packages/frame/test`；CMS、Frontend Extension 与 Migration V2
  组合测试迁入 `test/integration`；真实包消费者继续留在 `fixtures/consumer`。
- 工程与部署：Dockerfile、Compose、GitHub Actions、迁移入口、部署脚本和 tarball verifier 已全部切换
  到新路径。部署脚本由 `scripts/deploy` 迁入 `deploy/scripts`。
- 文档：新增根 `CODEMAP.md`，说明 Apps/Fixtures、包依赖方向、Frame 四层、测试归属和推荐阅读顺序；
  README、架构、包契约、扩展、前端、领域开发和运维文档统一推进到 0.6 目录模型。
- 测试稳定性：修复 CMS、Auth、Notification 和 Metadata 集成测试对固定 slug、旧密码、SMTP 全局状态
  与固定资源 ID 的依赖，使同一测试库可重复执行。

验证结果：

- `npm run format`、`npm run lint` 与 `npm run typecheck`：通过。
- `npm run build:all`：全部 Packages、Reference System、Reference Admin 和 Reference Web 生产构建通过。
- `npm run packages:verify`：9 个真实 npm tarball 在临时 Consumer 隔离安装，公开入口、System 组合、
  Admin/Web Contribution 和 13 条 Consumer Migration 验收通过。
- PostgreSQL 历史测试库：Reference System Migration 识别 10 条 Core + 2 条 CMS 迁移，全部保持已应用
  状态且未重放 SQL；跨包 Integration 14/14、Frame 52/52、Public Web 4/4、Frame UI 4/4 通过。
- 生产 Docker 镜像：全新 `npm ci`、全量构建和 production prune 通过；运行依赖 0 漏洞。镜像使用
  UID 100 非 root 用户，能从公开入口加载 Core/CMS，并从容器内执行完整 System Migration。
- 容器运行：`/health`、`/ready`、公共 `/` 与 `/admin/` 均返回 200，新静态目录与数据库连接正常。

已知事项：

- Reference Admin 主 Chunk 约 526 kB，仍触发 Vite 500 kB 提示，但不影响构建和运行。应在真实
  Consumer 阶段通过路由懒加载解决。
- 本阶段完成的是目录、所有权和默认组合语义调整，没有拆分 Assets、Notifications 或 Presentation；
  这些能力仍属于 Core，是否继续拆成一方扩展必须由真实业务 Consumer 证明。
- 0.6 仍使用内部 tarball 验收，Changesets、私有 Registry 和公共 Beta 发布属于后续发布阶段。

阶段 5 输入：

- 选择一个已有生产数据和部署链路的真实业务系统作为 Consumer，优先使用即将开发的官网系统。
- 业务仓库只保留组合配置、品牌/站点页面、领域扩展和部署环境；不得复制 Frame Core 或 CMS 后端源码。
- 同一个 Defined System 必须用于 API、Worker 和迁移；Admin/Web 使用相同扩展清单的浏览器投影。
- 先建立数据和功能基线，再原地采用 Frame 0.6 包；验证现有数据、登录、CMS、Sitemap、Worker 和部署
  不中断，并记录从 0.5 升级的真实摩擦点。
- 根据 Consumer 证据决定是否提取 CMS 默认前端页面、Admin 路由懒加载和 Landing Block 持久化 Port，
  不在试点前继续凭假设扩展公开 API。

## Reference Experience：R0 边界盘点

### 范围

- 将 `frame.lingcoo.com` 固定为 Frame 官方产品站、在线参考实现和 Frame Console。
- 从 Reference Apps 中识别官方专属内容、公共 Shell、Core 默认页面和 CMS 默认页面。
- 明确 Public Web、Admin、Reference System 与可发布 Packages 的最终所有权。
- 制定不复制 Reference 源码即可建立 Consumer Web/Admin 的后续产品化阶段。

### 完成记录

- Completed: 2026-08-07
- Baseline commit: `f6615bc`

已交付：

- 新增 `reference-experience-roadmap.md`，记录目标域名结构、产品边界、目标所有权模型和 R0 至 R6 路线。
- 完成 Reference Web 逐组件分类：Frame 首页与文档留在 App；Site Shell、布局、SEO、系统状态和账号流程
  进入 Web 包；CMS 列表、详情和渲染进入 CMS 包。
- 完成 Reference Admin 逐页面分类：App 只保留组合；布局与通用后台组件进入 Admin 包；Core 默认管理页
  由 Admin 包提供；CMS 管理页进入 CMS 包。
- 固定文档随源码版本化、Console 读取真实 API、公开体验不泄露所有者凭据的内容和安全原则。

验证结果：

- 文档中的包依赖、页面名称、扩展入口与当前 `package.json`、Reference App 源码和公开 `exports` 一致。
- 本阶段只修改文档，没有改变运行时代码、数据库迁移或线上行为。
- `npm run format:check` 与 `git diff --check` 作为文档质量门槛执行。

已知事项：

- `frame-admin` 和 `frame-web` 当前主要是 Registry，尚不包含矩阵中规划的完整默认 Shell 和页面。
- CMS 前端工厂仍要求 Consumer 提供页面组件，R5 完成前仍需使用 Reference 实现。
- 平台路线原阶段 5 Consumer 试点尚未执行；本路线属于阶段 6 参考应用工作的前置产品边界整理。

R1 输入：

- 从 `reference-web` 提取无业务语义的布局与 Site Shell，建立稳定公共导出和样式入口。
- 提取 SEO、系统状态和公共账号流程，同时保持当前 Reference Web 页面行为。
- 将新入口加入 tarball Consumer，验证业务应用无需导入 Reference App 源码。

## Reference Experience：R1 Web 基础产品化

### 范围

- 将公共 Site Shell、布局、Presentation、SEO、系统状态与账号安全流程从 Reference App 移入 Web 包。
- 为每类能力建立稳定子路径和随包发布的样式入口。
- 保持 Frame 官方首页与 CMS 内容仍由 Reference App/扩展拥有。
- 使用真实 tarball Consumer 证明业务应用不需要复制 `components/site`。

### 完成记录

- Completed: 2026-08-07
- Starting baseline: `f6615bc`

已交付：

- `@lingcoo/frame-web` 新增 `layout`、`site`、`presentation`、`seo`、`system-states`、`account` 与
  `styles.css` 七类公开入口，并在构建时复制样式到 `dist`。
- 公共 Presentation Hook 负责同源 API、品牌 Token 与 Favicon；SiteShell 读取导航、Logo、联系信息和
  备案信息，管理后台入口可以由 Consumer 改名或关闭。
- SEO、404/500、Loading、Error Boundary、找回密码、密码重置、邀请和邮箱验证不再由 Reference 实现。
- Reference Web 删除 `src/components/site`，首页和 CMS 页面全部改为消费公开包。
- Web 包新增 4 项基础测试；tarball 内容检查和 Consumer TypeScript Fixture 纳入全部新入口与样式。

验证结果：

- `@lingcoo/frame-web` 构建、类型检查、Lint 与 4/4 测试通过。
- Reference Web 生产构建、Lint 与 4/4 测试通过。
- `npm run packages:verify`：所有 Frame 包完成 tarball 打包，隔离 Consumer 安装成功，Consumer TypeScript
  校验和运行时导入验证通过。
- `npm run check`：类型检查、集成测试、Frame/Web/UI 测试和全仓 Lint 通过；需要 PostgreSQL 的测试在
  无数据库环境按设计跳过。
- `npm run format:check` 与 `git diff --check`：通过。

R2 输入：

- 产品化 Admin Shell、响应式导航、Topbar、账户菜单、认证上下文和通用后台组合组件。
- 业务导航保持主体；搜索、通知和个人能力进入 Shell 固定位置。
- 增加内容区底部 Frame 版本入口和不占主导航的系统信息 Route。

## Reference Experience：R2 Admin Shell 产品化

### 范围

- 将后台布局、认证上下文、浏览器路由和通用管理组件从 Reference Admin 移入 Admin 包。
- 让 Shell 只渲染业务 Registry 导航，并把搜索、通知和账户能力放在固定 Topbar 位置。
- 通过 Consumer 注入 API Client，保持公共包浏览器安全且不依赖 Reference App。
- 建立底部 Frame 版本入口和无 Navigation Contribution 的系统信息 Route。

### 完成记录

- Completed: 2026-08-07
- Starting commit: `1d71645`

已交付：

- `@lingcoo/frame-admin` 新增 Auth、Router、Application Shell、共享工作流组件与包内样式公开入口。
- Admin Auth 接受 `AdminAuthClient`；账号、角色和权限使用最小公共契约，Consumer 保留实际请求实现。
- Admin Router 支持自定义 Base Path、Search Params、Hash 和 SPA History，修复账号安全锚点导航边界。
- Application Shell 组合响应式 Sidebar、Topbar、权限过滤导航、Search Provider、通知计数、账户菜单、
  Presentation 品牌和 Frame 页脚。
- 账户菜单已移动到 Topbar；通知紧邻账户入口；个人中心、账号安全、应用设置和退出不占左侧导航。
- 共享包提供 PageFrame、ResourceSection、DataTable、StatusPill、AssetPicker、筛选、分页、批量操作、
  详情抽屉和 Promise Confirm；AssetPicker 使用 Consumer Loader，不导入 Reference API。
- Frame Manifest 新增 `/system/*` Route，但没有 Navigation Contribution；当前 Reference 环境复用真实
  Dashboard 数据作为初始系统信息视图，完整集中式系统信息在 R4 继续产品化。
- Reference Admin 删除 19 个布局、共享、认证、路由和认证页面文件，App 只保留 API 适配、权限门禁、
  Registry Route Slot 与具体 Core/CMS 页面组合。
- Consumer Fixture 和 tarball 内容检查覆盖新子路径、声明文件及 `styles.css`。

验证结果：

- `@lingcoo/frame-admin` 构建、类型检查、Lint 与 2/2 Shell/共享组件测试通过。
- Reference Admin 类型检查、Lint 和生产构建通过；主 Chunk 约 527 kB，仍为既有懒加载优化项。
- `npm run packages:verify`：9 个公开包与示例扩展完成 tarball 打包；临时 Consumer 安装 251 个包，
  新 Admin Auth/Layout/Router/Shared/CSS 入口的 TypeScript 与运行时验收通过。
- `npm run check`：全仓类型检查、14 项跨包集成测试、52 项 Frame 测试、Admin/Web/UI 包测试和全部
  Workspace Lint 通过；无 PostgreSQL 环境下相关集成测试按设计跳过。
- `npm run format:check` 与 `git diff --check`：通过。

R3 输入：

- 重组 Frame Core 的默认 Admin 信息架构，让业务工作区成为左侧导航主体。
- 将成员与权限、Connections、品牌、数据字典和审计收敛到一个应用设置入口及上下文组件。
- 让通知继续停留在 Topbar；资产选择器、Connection Picker 和审计时间线嵌入具体工作流。
- 为 R4 的集中式系统信息页准备浏览器安全运行摘要契约，但本阶段不把技术页面重新暴露到主导航。

## Reference Experience：R3 应用公共能力

### 范围

- 让 Frame 公共能力进入应用设置、Topbar、账户菜单和具体业务工作流，不挤占业务主导航。
- 解除 Frame Manifest 对应用根路由的占用，由 Consumer 明确拥有默认 Dashboard。
- 保留全部受保护的 Frame 管理 Route，并为 Reference 环境提供隐藏式验证入口。

### 完成记录

- Completed: 2026-08-07
- Starting commit: `680faa5`

已交付：

- `frameAdminManifest` 删除 `frame.dashboard` 根路由，只保留 `/system` 等受保护的公共能力路由；Frame
  默认导航只贡献一项“应用设置”。
- Reference Admin 新增应用级 `frame-reference-app` 扩展，自行拥有 `/`，证明行业 Consumer 可以自由
  安装或替换业务 Dashboard。
- 应用设置总览按权限聚合成员与权限、连接、品牌与站点、数据字典与分类、审计记录和类型化基础设置。
- Connections 产品语言在 Manifest、页面元数据和上下文提示中统一为“连接”，后端 integrations API、
  权限码和持久化模型保持兼容。
- 通知保留在 Topbar，个人中心与账号安全保留在账户菜单；资产、任务、运行状态和扩展页面从侧栏移除，
  但仍可从授权用户的 `/system` 页面进入。
- 新增 Manifest 信息架构测试和 CMS 组合测试，防止技术 Route 重新产生 Navigation Contribution。

验证结果：

- Admin 包 3/3 测试、Reference Admin 类型检查、Lint 和生产构建通过；生产 JS 约 529 kB，只有既有的
  Vite 分包建议。
- `npm run packages:verify`：所有可发布包完成构建、打包、隔离安装、Consumer TypeScript 与运行时验收。
- `npm run check`：全仓类型检查、14 项跨包集成测试、52 项 Frame 测试、Admin/Web/UI 测试及全部
  Workspace Lint 通过；PostgreSQL 相关测试在本地按设计跳过。
- `npm run format:check` 与 `git diff --check`：通过。

R4 输入：

- 产品化集中式系统信息页与浏览器安全摘要契约。
- 集成扩展、运行面、Worker、Job/Outbox、Migration、指标和异常状态，并按权限分区展示。
- 将 R3 的 Reference 系统信息实现迁入 Admin 包，同时保持 Footer 为唯一默认入口。

## Reference Experience：R4 系统信息产品化

### 范围

- 建立可发布、可注入、权限感知的集中式系统信息页面。
- 让 Backend 从实际 Defined System 和 Migration 账本提供浏览器安全摘要。
- 删除 Reference 中重复、静态或会形成第二真相源的扩展展示代码。

### 完成记录

- Completed: 2026-08-08
- Starting commit: `0f729c6`

已交付：

- `@lingcoo/frame-admin/system-info` 提供完整类型、Client 契约和 System Info 页面；样式随 Admin 包发布。
- `/api/system/runtime` 新增 System/Frame/API 版本、扩展运行面与贡献计数、Migration Source、账本条数、
  已应用和待执行统计；旧 `name/version/environment/surfaces` 字段保持兼容。
- Fastify Host 保存当前 `DefinedSystem` 只读引用，摘要不依赖进程全局变量，也不返回环境变量或 Secret。
- 系统信息页组合真实 Runtime、Observability、Job Summary 和 Outbox Total；各数据区按原权限独立加载并
  支持局部失败，不因一个受保护接口失败而隐藏全部系统身份信息。
- Reference Admin 只保留 Runtime、Observability/Operations Adapter 和权限过滤；静态 `ModulesPage`、
  对应 Route、模块数组及遗留 Section Resolver 已删除。
- Admin 包新增完整渲染与无权限分区测试；Backend 新增 Manifest/Ledger 摘要和账本不可用降级测试；
  Consumer Fixture 与 tarball 文件检查覆盖 `./system-info`。
- `@lingcoo/frame` 补齐对 Admin/Web Manifest 包的直接依赖，独立安装契约与源码 import 保持一致。

验证结果：

- Admin 包 5/5 测试、Backend 新增 2/2 摘要测试、Reference Admin 类型检查、Lint 和生产构建通过。
- `npm run packages:verify`：全部可发布包完成构建、打包、隔离安装、Consumer TypeScript 与运行时验收。
- `npm run check`：全仓类型检查、14 项跨包集成测试、54 项 Frame 测试、Admin/Web/UI 测试及全部
  Workspace Lint 通过；PostgreSQL 相关测试在本地按设计跳过。
- `npm run format:check` 与 `git diff --check`：通过。

R5 输入：

- 产品化 CMS Admin/Web 默认页面、内容工作流与公共渲染组件。
- 进一步缩薄 Reference Admin/Web，安装 CMS 时不再要求 Consumer 提供页面组件。
- 补齐 CMS 的 tarball Consumer、浏览器交互和部署环境验收。
