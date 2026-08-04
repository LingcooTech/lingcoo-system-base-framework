# Frame 平台化开发进度

本文件在每个阶段完成时记录实际交付、验证结果、遗留问题和下一阶段入口。规划以
[`platform-roadmap.md`](platform-roadmap.md) 为准，架构决策以 [`adr/`](adr/README.md) 为准。

## 总体状态

| 阶段              | 状态        | 结果                                               |
| ----------------- | ----------- | -------------------------------------------------- |
| 0. 架构冻结       | Completed   | 4 项 ADR、平台路线、0.1 基线和质量门槛已冻结       |
| 1. 0.2 包化       | Completed   | 4 个可安装包、公开导出和 tarball Consumer 验收完成 |
| 2. 扩展内核       | Completed   | 0.3 系统组合、分运行面注册与 Migration V2 已完成   |
| 3. 前端扩展       | Not started | -                                                  |
| 4. 第一方扩展     | Not started | -                                                  |
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
