# Frame 官方站与参考控制台改造路线

## 1. 目标与口径

本路线将 `frame.lingcoo.com` 定位为 Lingcoo Frame 的官方产品站、在线参考实现和框架控制台：

```text
frame.lingcoo.com/
  Frame 官方介绍、架构、Packages、扩展与开发文档

frame.lingcoo.com/admin/
  Frame Console，操作并验证 Core 与已安装扩展

frame.lingcoo.com/api/、/health、/ready
  Reference System 的真实后端运行面
```

这里的 `reference-*` 是仓库工程角色，不是对外产品名。对外统一显示 `Lingcoo Frame`、
`Frame Console` 和 `Frame Documentation`。

本路线独立使用 `R0` 至 `R6` 编号，避免与平台包化路线的阶段 0 至 8 混淆；它属于平台路线中
“阶段 6：文档与参考应用”的准备和实施工作。

## 2. 已冻结的产品边界

1. Public Web 负责解释 Frame、提供版本化文档并引导开发者开始使用。
2. Admin 负责证明 Frame 能力真实可运行、可管理、可观察和可扩展。
3. Reference System 是 API、Worker、Migration 与扩展清单的唯一组合根，不承担产品文案。
4. Frame 官方首页和文档属于 Reference Web；它们不是业务系统默认页面，也不进入公共包。
5. 通用 Web/Admin 壳和 Core 管理页面必须进入可复用包，不能要求每个 Consumer 复制 Reference 源码。
6. CMS 是可选第一方扩展；CMS 默认管理页和公共内容页应由 CMS 包提供，Reference Apps 只负责选装。
7. Frame 文档采用仓库内版本化内容，CMS 用来证明内容能力，不作为核心技术文档的唯一数据源。
8. 当前不新增细粒度 npm 包；优先通过现有包的稳定子路径导出完成产品化，再由真实 Consumer 判断是否拆包。

### 2.1 Frame 幕后能力原则

Frame 类似应用的操作系统：提供身份、权限、通知、连接、资产、任务、审计和运行时，但不要求这些能力
各自占据业务主导航。

- 左侧导航默认属于业务页面和确实需要持续进入的工作模块。
- 搜索和通知进入 Topbar；个人资料、密码、会话和退出进入账户菜单。
- Asset Picker、Connection Picker 和审计时间线在业务上下文中出现，不为底层能力强制增加菜单。
- 成员、权限、Connections、品牌和类型化设置通过一个应用设置入口组织，应用可以选择是否显示。
- Frame 版本显示在主内容区底部；具备运行权限的用户点击后进入不占主导航的系统信息页。
- 扩展、Worker、Outbox、Migration、指标和异常只对系统所有者、开发者或运维人员展开。
- Navigation Contribution 只表示页面值得进入导航；Route 可以注册但不声明 Navigation。

## 3. 目标所有权模型

```text
apps/reference-web
  官方首页、文档内容、Packages、示例与发布说明
             │
             ├── consumes @lingcoo/frame-web
             ├── consumes @lingcoo/frame-cms/web
             └── consumes @lingcoo/frame-ui

apps/reference-admin
  Admin 组合、品牌入口和 Reference 环境配置
             │
             ├── consumes @lingcoo/frame-admin
             ├── consumes @lingcoo/frame-cms/admin
             └── consumes @lingcoo/frame-ui

apps/reference-system
  defineSystem(frameCoreExtension + frameCmsExtension)
             │
             ├── API
             ├── Worker
             └── Migration
```

### 3.1 公共包职责

| 包                             | 当前稳定职责                                              | 本路线需要补齐                                                |
| ------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------- |
| `@lingcoo/frame`               | Host、Core Modules、Worker、Migration 和 Server 运行时    | 供 Console 使用的浏览器安全运行信息契约；不加入 React 页面    |
| `@lingcoo/frame-extension-sdk` | Manifest、Defined System 与分运行面扩展契约               | 保持协议层，不放视觉实现                                      |
| `@lingcoo/frame-database`      | PostgreSQL、Schema 与 Migration V2                        | 保持服务端数据层，不进入浏览器                                |
| `@lingcoo/frame-admin`         | Admin Registry、Route、Navigation、Widget、Search、Editor | 完整 Admin Shell、账号入口、通用后台组合组件和 Core 页面实现  |
| `@lingcoo/frame-web`           | Web Registry、公共 SiteShell、布局、SEO、状态和账号流程   | 默认最小站点与后续真实 Consumer 反馈                          |
| `@lingcoo/frame-ui`            | 无业务语义 React 组件                                     | 只补真正跨 Admin/Web 的基础组件，不接收 API 或 Frame 业务语义 |
| `@lingcoo/frame-design-tokens` | Base、Admin、Public 设计变量                              | 保持视觉变量，不放页面样式                                    |
| `@lingcoo/frame-cms`           | CMS Server、Worker、Migration 与前端贡献工厂              | 完整默认 CMS Admin/Web 页面和内容渲染组件                     |

## 4. Reference Web 现状归属矩阵

### 4.1 应保留在 Reference Web

| 当前实现                             | 当前作用                   | 最终归属             | 处理方式                                    |
| ------------------------------------ | -------------------------- | -------------------- | ------------------------------------------- |
| `App.tsx` 中 `HomeRoute`             | Frame 简介首页             | `apps/reference-web` | 重写为官方产品首页，继续作为 Frame 专属内容 |
| `App.tsx` 的系统组合                 | 投影 Core/CMS Web Manifest | `apps/reference-web` | 保留为浏览器组合根，缩减为装配代码          |
| Frame 架构、Packages、扩展和文档内容 | 当前只有首页少量文案       | `apps/reference-web` | 新增版本化内容与路由                        |
| Reference Web 品牌差异               | 官方 Frame 视觉            | `apps/reference-web` | 只保留产品级主题覆盖，不复制结构样式        |

### 4.2 应进入 `@lingcoo/frame-web`

| 当前文件                           | 可复用能力                                    | 目标公开实现                           |
| ---------------------------------- | --------------------------------------------- | -------------------------------------- |
| `components/site/SiteShell.tsx`    | SiteBrand、Header、Footer、移动导航、品牌呈现 | Web Shell 组件和 Presentation Contract |
| `components/site/Layout.tsx`       | Container、Section、Hero、PageHeader          | Web 布局子路径导出                     |
| `components/site/SeoHead.tsx`      | Title、Canonical、Open Graph、结构化数据      | Web SEO Head 实现                      |
| `components/site/SystemStates.tsx` | Loading、404、500、Error Boundary             | Web 系统状态组件                       |
| `App.tsx` 中 `PublicAuthFlow`      | 找回密码、重置、邀请、邮箱验证                | Web 账号安全流程组件                   |
| `styles.css` 中上述组件样式        | 公共 Web 基础视觉                             | 随 Web 包发布的 Shell 样式             |

公共包不保存 `Lingcoo Frame` 首页文案，也不决定 Consumer 的导航项；结构始终读取 Consumer 提供的
Presentation 和扩展 Registry。

### 4.3 应进入 `@lingcoo/frame-cms`

| 当前文件                             | 可复用能力               | 目标入口                 |
| ------------------------------------ | ------------------------ | ------------------------ |
| `components/cms/ArticleCard.tsx`     | 文章摘要卡片             | `@lingcoo/frame-cms/web` |
| `components/cms/ArticleList.tsx`     | 文章列表                 | `@lingcoo/frame-cms/web` |
| `components/cms/CmsPages.tsx`        | 列表、预览和详情数据加载 | `@lingcoo/frame-cms/web` |
| `components/cms/ContentDetail.tsx`   | 内容详情布局与面包屑     | `@lingcoo/frame-cms/web` |
| `components/cms/ContentRenderer.tsx` | Markdown 内容渲染        | `@lingcoo/frame-cms/web` |
| `components/cms/EmptyContent.tsx`    | CMS 空状态               | `@lingcoo/frame-cms/web` |

完成后，`createCmsWebExtension()` 应能提供官方默认页面；Consumer 可以覆盖视觉实现，但不再被要求
先自行提供四个页面组件才能安装 CMS。

## 5. Reference Admin 现状归属矩阵

### 5.1 应保留在 Reference Admin

| 当前实现               | 最终归属               | 处理方式                                       |
| ---------------------- | ---------------------- | ---------------------------------------------- |
| `main.tsx`             | `apps/reference-admin` | 保留应用挂载和产品样式入口                     |
| `App.tsx`              | `apps/reference-admin` | 最终只保留认证状态、Admin System 和 Shell 装配 |
| `extensions.tsx`       | `apps/reference-admin` | 保留组合根；页面 Surface 改为从包导入          |
| Reference 环境品牌覆盖 | `apps/reference-admin` | 只保留 Lingcoo Frame 产品级差异                |

### 5.2 应进入 `@lingcoo/frame-admin` 的 Shell 能力

| 当前文件组                              | 可复用能力                                   |
| --------------------------------------- | -------------------------------------------- |
| `components/layout/Shell.tsx`           | 响应式后台外壳、移动导航和内容区域           |
| `components/layout/Sidebar.tsx`         | Registry 驱动侧栏、分组、折叠和权限过滤      |
| `components/layout/Topbar.tsx`          | 面包屑、全局搜索、帮助和通知入口             |
| `components/layout/AccountMenu.tsx`     | 个人资料、账号安全、设置和退出入口           |
| `components/layout/GlobalSearch.tsx`    | 扩展搜索聚合与命令面板                       |
| `lib/router.tsx`                        | Admin 浏览器路由适配                         |
| `lib/auth.tsx`                          | Admin 认证状态和权限上下文                   |
| `components/shared/PageFrame.tsx`       | 管理页面标题和上下文布局                     |
| `components/shared/DataTable.tsx`       | 通用数据表格                                 |
| `components/shared/FilterBar.tsx`       | 通用筛选器                                   |
| `components/shared/AdminPagination.tsx` | 后台分页器                                   |
| `components/shared/BulkActionBar.tsx`   | 批量操作栏                                   |
| `components/shared/DetailDrawer.tsx`    | 详情抽屉                                     |
| `components/shared/ConfirmProvider.tsx` | 统一确认操作                                 |
| `components/shared/StatusPill.tsx`      | 管理状态标记                                 |
| `components/shared/ResourceSection.tsx` | 管理资源分区                                 |
| `components/shared/AssetPicker.tsx`     | Core Asset 选择器，作为 Frame Admin 组合组件 |

其中纯视觉且跨 Public Web 也成立的部分可以下沉到 `frame-ui`；带 Admin 布局、权限、API 或资源语义的
部分留在 `frame-admin`，不为了“通用”而抽掉必要语义。

### 5.3 应进入 `@lingcoo/frame-admin` 的 Core 页面

| 当前页面                            | Frame 能力                            | Console 分组 |
| ----------------------------------- | ------------------------------------- | ------------ |
| `LoginPage`                         | 管理后台登录                          | 认证入口     |
| `AccountPage`、`ChangePasswordPage` | 个人资料、密码、会话和安全记录        | 账户菜单     |
| `SystemInfoPage`                    | API、Worker、Database、扩展与迁移总览 | Frame        |
| `AccessPage`                        | 账号、角色和权限                      | 账号与访问   |
| `SettingsPage`                      | 类型化非敏感设置                      | 系统管理     |
| `PresentationPage`                  | 品牌、导航和站点呈现                  | 站点管理     |
| `IntegrationsPage`                  | Provider、加密连接和调用记录          | 系统管理     |
| `AssetsPage`                        | 媒体资产和引用                        | 资源管理     |
| `OperationsPage`                    | Job 与 Outbox                         | 运行管理     |
| `NotificationsPage`                 | 站内通知、公告和邮件投递              | 运行管理     |
| `MetadataPage`                      | 字典、分类、标签和数据交换            | 数据管理     |
| `AuditPage`                         | 结构化审计                            | 系统管理     |
| `ObservabilityPage`                 | 心跳、指标和异常                      | 运行管理     |
| `HelpPage`                          | 能力边界和开发入口                    | Frame        |

这些页面是 Core 后端能力的默认管理界面，不是 Lingcoo Frame 官方网站专属内容。它们必须能被官网、
教育或零售 Consumer 直接安装和按品牌配置。

`api/client.ts` 中与上述页面配套的浏览器类型和请求客户端也随 Core Admin 页面进入浏览器安全入口；
服务端实现和密钥处理代码不得进入该构建。

### 5.4 应进入 `@lingcoo/frame-cms/admin`

| 当前页面      | 处理方式                                                                  |
| ------------- | ------------------------------------------------------------------------- |
| `CmsPage.tsx` | 移入 CMS Admin 默认实现，包含列表、编辑、版本、SEO 预览、计划发布和重定向 |

完成后，`createCmsAdminExtension()` 默认安装 CMS 页面，同时允许 Consumer 显式覆盖组件。

## 6. 目标信息架构

### 6.1 Public Web

```text
首页 /
产品 /framework
架构 /architecture
Packages /packages
扩展 /extensions
示例 /examples
文档 /docs/*
发布 /releases
CMS 示例 /articles、/articles/:slug、/pages/:slug
账号安全 /auth/:mode
```

首页按“Frame 是什么 → 解决什么 → 如何分层 → 如何组合 → 如何扩展 → 如何部署 → 开始使用”叙述，
不把全部技术细节堆在 Landing Page。详细内容进入文档路由。

### 6.2 Admin Shell

```text
业务左侧导航
  业务 Dashboard、领域页面和 CMS 等工作模块

Topbar
  全局搜索、通知和账户菜单

应用设置
  成员与权限、Connections、品牌、数据字典和审计

内容区底部
  本系统基于 Lingcoo Frame 构建 · Frame 版本

隐藏式系统信息
  系统版本、已安装扩展、API/Worker/Database、Job/Outbox、Migration、指标和异常
```

Frame 不拥有业务应用的默认 Dashboard。没有安装业务 Dashboard 时可以显示最小“系统已就绪”页面；
Reference Admin 因为用于验证 Frame，可以通过测试入口访问全部能力，但复用同一套隐藏式系统信息实现。

“外部集成”产品名称改为 Connections。后端继续使用 Provider、Connection、加密 Credential、Capability
和 Activity 模型；连接中心进入应用设置，并可以在邮件、存储、支付和 AI 等业务配置中上下文调用。

## 7. 内容与数据策略

- Frame 首页、架构、Packages、扩展指南、快速开始和版本文档随源码发布。
- CMS 继续提供文章与通用页面，作为可选一方扩展的在线证明。
- Console 读取真实 API，不使用静态假数据伪造健康状态、扩展、任务或迁移。
- 公开站点只展示安全运行摘要；详细运行、账号和配置数据必须经过 Admin 登录与权限校验。
- 不公开系统所有者密码。未来若提供公开体验账号，应使用独立只读 Demo 角色、受限数据和可重复重置流程。

## 8. 实施阶段

| 阶段                  | 交付                                                | 退出条件                                           |
| --------------------- | --------------------------------------------------- | -------------------------------------------------- |
| R0 边界盘点           | 本文、逐页面归属、目标信息架构                      | 每个现有页面和公共组件都有明确所有者               |
| R1 Web 基础产品化     | Web Shell、布局、SEO、状态和账号流程进入包          | Consumer 不复制 `components/site` 即可建立公共站点 |
| R2 Admin Shell 产品化 | 后台壳、认证、Topbar、账户菜单和通用组件进入包      | Consumer 不复制 layout/shared/lib 即可建立管理后台 |
| R3 应用公共能力       | 应用设置、成员权限、Connections、品牌、通知上下文化 | Frame 能力不强制占据业务主导航                     |
| R4 系统信息产品化     | 底部版本入口和隐藏式系统信息页                      | 扩展、运行、事件、迁移和指标按权限集中查看         |
| R5 CMS 默认前端       | CMS Admin/Web 默认页面进入 CMS 包                   | Consumer 安装 CMS 不再必须自写页面组件             |
| R6 Reference 与发布   | 官方首页/文档、薄 Reference Apps、E2E 和部署验收    | `frame.lingcoo.com` 成为稳定官方站和在线参考系统   |

每一阶段完成后都更新本文状态与 `platform-progress.md`，记录实际文件、公开 API、测试、遗留问题和
下一阶段输入。

## 9. R0 完成记录

- Completed: 2026-08-07
- Baseline commit: `f6615bc`

已完成：

- 核对三个 Reference App、八个可发布包及真实 npm 依赖方向。
- 对现有 Reference Web 的首页、账号、Site Shell、SEO、状态和 CMS 页面完成所有权分类。
- 对现有 Reference Admin 的组合根、布局、通用组件、Core 页面和 CMS 页面完成所有权分类。
- 冻结官方内容留在 Apps、通用实现进入 Packages、CMS 默认界面归 CMS 扩展的边界。
- 冻结文档随代码版本化、Console 使用真实 API、公开 Demo 不暴露所有者凭据的内容和安全策略。

R1 输入：

- 先提取无 API 依赖的 `Container`、`Section`、`Hero`、`PageHeader` 与 Site Shell 结构。
- 再迁移 SEO、系统状态和 Public Auth Flow，建立浏览器安全的 Presentation/Account Contracts。
- 保持 Reference Web 当前路由和视觉行为，通过公共导出替换源码导入。
- 增加真实 tarball Consumer 验证，证明新 Web 组件不依赖 Reference App 内部文件。

## 10. R1 完成记录

- Completed: 2026-08-07
- Starting baseline: `f6615bc`

已完成：

- `@lingcoo/frame-web` 新增 `./layout`、`./site`、`./presentation`、`./seo`、
  `./system-states`、`./account` 和 `./styles.css` 公开入口。
- SiteShell 支持品牌 Presentation、桌面/移动导航、可选管理入口、页脚联系信息和备案信息。
- Presentation Hook 读取 Frame 公共 API并应用品牌色与 Favicon；Consumer 可以直接复用返回契约。
- SEO Head 统一 Canonical、Open Graph、Twitter Card、Robots 和 JSON-LD；结构化数据辅助函数进入公开包。
- 404、500、Loading 和 Error Boundary 进入公开包；账号入口覆盖找回、重置、邀请和邮箱验证。
- Reference Web 删除全部 `components/site` 源码并改用公开包；公共基础样式不再保留 App 副本。
- tarball Consumer 从新子入口编译 SiteShell 和布局，并验证发布包包含样式和全部声明文件。

R2 输入：

- 提取 Admin Shell、响应式 Sidebar、Topbar、账户菜单、认证上下文和通用后台组合组件。
- 左侧 Registry 导航只呈现应用明确贡献的工作页面；Frame 搜索、通知和账户能力进入固定 Shell 位置。
- 在内容区底部加入 Frame 名称、版本和系统信息入口，但 R2 暂不迁移全部 Core 管理页面。

## 11. R2 完成记录

- Completed: 2026-08-07
- Starting commit: `1d71645`

已完成：

- `@lingcoo/frame-admin` 新增 `./auth`、`./layout`、`./router`、`./shared` 和 `./styles.css` 公开入口。
- 认证状态通过 `AdminAuthClient` 注入；浏览器路由支持 Consumer 自定义后台基路径，不绑定 Reference API。
- `AdminApplicationShell` 统一响应式 Sidebar、Topbar、全局搜索、通知、账户菜单、品牌读取和移动导航。
- 个人中心、账号安全、应用设置和退出进入账户菜单；通知显示在账户入口旁，不再依赖侧栏账号区。
- 左侧导航只渲染 Registry 中当前账号有权限的 Navigation Contribution，Shell 不添加 Frame 技术菜单。
- 内容区底部显示“本系统基于 Lingcoo Frame 构建 · vX”，授权账号可进入不占主导航的 `/system` Route。
- PageFrame、DataTable、FilterBar、Pagination、BulkAction、DetailDrawer、ConfirmProvider 和 AssetPicker
  进入公共包；AssetPicker 通过加载器读取 Consumer 资产 API。
- Reference Admin 删除 `components/layout`、`components/shared`、`lib/auth`、`lib/router` 及登录/首次改密
  页面源码，改为消费公共入口。
- Admin 包增加 Shell 与共享组件测试；tarball Consumer 编译完整 Admin Shell 和样式入口。

验证结果：

- `@lingcoo/frame-admin` 构建、类型检查、Lint 与 2/2 测试通过。
- Reference Admin 类型检查、Lint 与生产构建通过；既有约 527 kB 主 Chunk 警告不影响构建。
- `npm run packages:verify`、`npm run check`、`npm run format:check` 与 `git diff --check` 全部通过。

R3 输入：

- 将 Frame Core 当前导航按“业务工作区 / 应用设置 / 隐藏系统信息”重新归类，避免技术模块占据主侧栏。
- 将“外部集成”产品化为 Connections，并在应用设置与具体业务配置中提供上下文入口。
- 统一成员与权限、品牌、通知和设置的应用级入口；通知继续由 Topbar 承载，不新增独立能力导航区域。
- 保持 Reference Admin 能验证全部 Frame 能力，但通过隐藏 Route 和权限控制访问开发/运维信息。

## 12. R3 完成记录

- Completed: 2026-08-07
- Starting commit: `680faa5`

已完成：

- Frame Admin Manifest 不再注册 `/`，默认业务首页正式归 Consumer App 所有；Reference Admin 通过独立的
  `frame-reference-app` 扩展注册自己的最小应用首页。
- Frame 的 Navigation Contribution 从 13 项收敛为唯一的“应用设置”；CMS 等业务扩展继续按自己的
  Manifest 贡献工作导航，技术路由仍完整注册并执行原有权限门禁。
- `/settings` 升级为统一应用设置入口，按账号权限提供成员与权限、连接、品牌与站点、数据字典与分类、
  审计记录和类型化基础设置，不再要求这些能力分别占据侧栏。
- “外部集成”前台产品名称统一为“连接”；Provider、Connection、Credential、Capability、Activity、
  数据库结构和 `/api/integrations/*` 后端契约保持不变。
- 通知继续只由 Topbar 承载，个人中心与账号安全继续只进入账户菜单；媒体资产保留 AssetPicker 上下文
  工作流和受保护的直接管理 Route，但不进入应用主导航。
- Footer 的 Frame 版本链接进入 `/system`；Reference Admin 在该隐藏页面按权限提供扩展、任务与事件、
  运行状态、资产管理和 Frame 帮助入口，用于验证全部现有能力。
- Admin 包测试锁定“Frame 不占用根路由、技术 Route 不生成 Navigation、仅一个应用设置入口”；CMS
  组合测试锁定安装 CMS 后的侧栏只包含“内容管理 + 应用设置”。

验证结果：

- `@lingcoo/frame-admin` 类型检查、Lint 与 3/3 测试通过；Reference Admin 类型检查、Lint 和生产构建通过。
- `npm run packages:verify`：9 个公开包与示例扩展完成 tarball 验收，隔离 Consumer 安装 251 个包后完成
  TypeScript 和运行时验证。
- `npm run check`：14 项跨包集成测试、52 项 Frame 测试及 Admin/Web/UI 测试全部通过；其中依赖
  PostgreSQL 的 11 项测试在无数据库环境按设计跳过。
- `npm run format:check` 与 `git diff --check`：通过。

R4 输入：

- 将当前 Reference `/system` 页面提炼为 `@lingcoo/frame-admin` 可复用的系统信息产品面。
- 建立浏览器安全的系统摘要契约，统一展示 Frame/应用版本、扩展、API/Worker/Database、Migration、
  Job/Outbox、指标和异常状态。
- 把分散的技术详情按权限组合到一个系统信息路由，继续保持零技术主导航贡献。

## 13. R4 完成记录

- Completed: 2026-08-08
- Starting commit: `0f729c6`

已完成：

- `@lingcoo/frame-admin` 新增 `./system-info` 公开入口，提供浏览器安全的 Runtime、Extension、Migration、
  Observability 和 Operations 类型、`AdminSystemInfoClient` 以及完整的 `AdminSystemInfoPage`。
- 系统信息页通过 Consumer 注入加载器读取真实 API，不依赖 Reference App；统一展示应用/System/Frame
  版本、Extension API、已安装扩展、运行面、迁移来源、Job/Outbox、进程指标和异常摘要。
- `buildApp()` 将当前 `DefinedSystem` 作为只读运行上下文挂入 Fastify；`/api/system/runtime` 在保留原有
  顶层字段的同时，从真实 Manifest 与 `framework_migrations` 账本生成扩展贡献和迁移状态。
- Observability 与 Operations 按 `observability.read`、`jobs.read` 独立加载；无权限时既不请求对应 API，
  也不误报 Worker、Database、Metrics、Job 或 Outbox 状态。
- Reference Admin 的系统页缩减为 Client 和权限组合层；旧 `ModulesPage`、`frame.modules` Route、15 条
  静态模块数组及未使用的 Section 路由辅助函数已删除，扩展信息只保留一个真实来源。
- Frame Footer 仍是 `/system` 唯一默认入口；任务、运行诊断、资产和帮助详情页继续受权限保护且不进入
  业务主导航。
- 补正 `@lingcoo/frame` 对 `@lingcoo/frame-admin`、`@lingcoo/frame-web` 的实际运行时依赖声明，避免
  Monorepo Hoist 掩盖独立安装缺包。

验证结果：

- Admin 包构建、类型检查、Lint 与 5/5 测试通过；新增测试覆盖完整系统信息和无权限诊断隐藏。
- Reference Admin 类型检查、Lint 与生产构建通过；生产 JS 约 532 kB，仅保留既有 Vite 分包建议。
- `npm run packages:verify`：9 个公开包与示例扩展完成 tarball 构建，隔离 Consumer 安装 251 个包后
  `./system-info` TypeScript 和运行时验证通过。
- `npm run check`：14 项跨包集成测试、54 项 Frame 测试及 Admin/Web/UI 测试全部通过；其中依赖
  PostgreSQL 的 11 项测试在无数据库环境按设计跳过。
- `npm run format:check` 与 `git diff --check`：通过。

R5 输入：

- 将 CMS Admin/Web 默认页面和工作流从 Reference Apps 迁入 `@lingcoo/frame-cms`。
- 让 Consumer 安装 CMS 后只需注入 API/路由环境，不再复制 `CmsPage`、文章列表、详情、预览和编辑实现。
- 保持内容类型、发布、版本、重定向、SEO 和定时发布契约稳定，并补齐 tarball Consumer 与 E2E 验收。

## 14. R5 完成记录

- Completed: 2026-08-08
- Starting commit: `0146791`

已完成：

- `@lingcoo/frame-cms/admin` 默认提供内容列表、批量状态操作、页面/文章编辑器、媒体选择、分类标签、
  版本历史、SEO/社交预览、计划发布和 URL 重定向；`createCmsAdminExtension()` 只需要 Consumer 注入
  `CmsAdminClient` 即可安装，仍允许按页面覆盖组件。
- `@lingcoo/frame-cms/web` 默认提供公共文章列表、分页、文章/页面详情、预览、面包屑、响应式封面图、
  Markdown 渲染和空/加载/404/500 状态；`createCmsWebExtension()` 只需要注入 `CmsWebClient` 和
  `resolvePresentation()`，保留公共 SEO Resolver 和 Sitemap Collector。
- CMS Admin/Web 的浏览器安全类型、请求路径和 JSON 映射分别集中在 `admin-client.ts`、`web-client.ts`；
  Consumer 只提供认证 API Transport、公共 `fetch` 和品牌环境，不再复制 Reference 页面或 CMS CSS。
- Reference Admin 删除 `CmsPage` 和 CMS-specific API 类型/请求函数；Reference Web 删除 `components/cms`
  和 `types.ts`，改为直接安装 CMS 默认页面。CMS 样式随 `@lingcoo/frame-cms/styles.css` tarball 发布。
- Consumer Fixture 已按默认页面方式组合 CMS Admin/Web，并验证公开导出、端点映射、404 状态、服务端渲染的
  列表/编辑器、Markdown 渲染和完整 tarball 隔离安装。

验证结果：

- `@lingcoo/frame-cms` 类型检查、Lint、构建与 5/5 测试通过；新增测试覆盖默认 Admin 页面静态渲染、
  Client 端点映射、Web 404 语义和文章详情结构化数据。
- Reference Admin/Web 类型检查与生产构建通过；Admin 主 Chunk 约 533 kB，只有既有 Vite 分包建议，
  Web 主 Chunk 约 492 kB。
- `npm run packages:verify` 通过：全部包完成 tarball 构建，隔离 Consumer 安装 350 个包后完成 TypeScript
  和运行时验证，并实际确认 `@lingcoo/frame-cms/styles.css` 与默认 CMS 页面声明文件存在。
- `git diff --check` 通过；完整 `npm run check` 将在本阶段提交前再次执行，作为跨包回归门槛。

已知事项：

- R5 产品化的是默认 CMS 页面与工作流，Reference Web 首页/文档内容仍属于应用层；真实官网 Consumer 迁移、
  在线域名验收和路由级懒加载留到 R6。

R6 输入：

- 将 Reference Admin/Web 进一步缩减为官方站点和 Frame 能力的组合根，补齐 Frame 首页、文档、Packages、
  扩展和部署说明。
- 为 `frame.lingcoo.com` 建立真实生产配置、API/Worker/数据库部署验收、登录/内容流程 E2E 和发布回滚检查。
- 根据真实官网 Consumer 证据决定是否引入路由懒加载、Changesets/Registry 发布和独立版本兼容矩阵。
