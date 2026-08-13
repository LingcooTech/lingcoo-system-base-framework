# Lingcoo System Base Framework

[![CI](https://github.com/LingcooTech/lingcoo-system-base-framework/actions/workflows/ci.yml/badge.svg)](https://github.com/LingcooTech/lingcoo-system-base-framework/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

一套剔除具体行业和业务逻辑后，仍然可以独立运行、测试和部署的系统基础框架。

当前 `0.7` 已完成首个一方扩展闭环、目录架构对齐、官方 Reference Experience 和版本化包发布链路：
无基础设施依赖的 Kernel、Fastify/PostgreSQL/OpenTelemetry Adapters、Extension SDK、Identity、Jobs、
Notifications、Admin/Web Shell、共享 UI、Design Tokens 与 CMS 都能以真实 npm tarball 安装和消费。
Frame 仍同时保留可运行参考系统；新的业务
系统通过 `defineSystem()` 显式安装构建期扩展，而不是复制本仓库后长期维护底层源码副本。

平台化路线见 [Frame 平台化改造路线](docs/platform-roadmap.md)，实际阶段记录见
[Frame 平台化开发进度](docs/platform-progress.md)，当前公开包契约见
[0.7 Package Contracts](docs/package-contracts.md)，代码阅读入口见 [CODEMAP](CODEMAP.md)，长期决策见
[ADR](docs/adr/README.md)。

新业务仓库从初始化到生产部署的标准步骤见
[基于 Frame 的应用全生命周期](docs/application-lifecycle.md)；脚手架和跨版本升级的下一步
工作见 [Frame 应用接入产品化实施方案](docs/application-adoption-plan.md)。

## 开源与商业边界

Frame 源码、官方包、参考应用、测试和文档采用 [Apache License 2.0](LICENSE)。Edu 等行业应用、
Stack 中台、应用市场、客户代码/数据、商业镜像交付和运维服务不因 Frame 开源而自动开放。Apache-2.0
不授予 LingcooTech、Lingcoo 或 Lingcoo Frame 的品牌使用权，详见
[Frame 开源与商业边界](docs/open-source-policy.md) 和 [商标说明](TRADEMARKS.md)。

参与贡献、安全披露和支持范围分别见 [CONTRIBUTING.md](CONTRIBUTING.md)、[SECURITY.md](SECURITY.md) 和
[SUPPORT.md](SUPPORT.md)。

Stable 长期以同一版本集发布到 npmjs，Consumer 可匿名安装。`@lingcootech` npm scope 当前处于名称
释放等待期，生产验证暂时继续使用需要 Token 的 GitHub Packages Preview。生产应用必须锁定明确版本与
lockfile，不自动跟随 dist-tag。

## 当前包含什么

- 公共 Web：React、TypeScript、Vite、Tailwind CSS
- 管理后台：可消费的 Admin Shell、认证/路由上下文、Topbar 账户与通知入口，以及共享后台工作流组件
- 共享 UI：npm workspace 管理 Design Tokens 与无业务含义的 React 组件
- 应用 API：Fastify、TypeScript、Zod、统一错误处理、CORS、安全响应头和限流
- 身份权限：统一账号、HttpOnly JWT Cookie、可撤销会话和多角色 RBAC
- 账号自服务：个人资料与头像、邮箱验证、邀请设密、密码找回、会话和安全记录
- 外部集成：Provider 注册表、加密凭据、配置生命周期、连通性测试和调用审计
- 异步执行：PostgreSQL 持久化任务、事务 Outbox、幂等键、并发锁、退避重试和独立 Worker
- 通知中心：站内通知、系统公告、未读状态和通过 SMTP 异步执行的邮件投递
- 资产中心：受约束的浏览器直传、对象复核、统一资产身份、引用保护和异步删除
- 品牌呈现：版本化品牌档案、Asset ID 图片引用、可排序站点导航和管理端实时预览
- 轻量 CMS：通用页面与文章、Markdown、SEO 预览、定时发布、站内重定向和版本管理
- 治理基础：类型化非敏感系统设置、版本历史、统一审计写入与后台查询
- 数据基础：类型化数据字典、层级分类、扁平标签、资源关联和版本化数据集交换
- 统一搜索：权限感知的 Search Provider 注册表和 `⌘/Ctrl + K` 管理后台入口
- 运行可观测性：Request ID、脱敏结构化日志、服务心跳、5xx 聚合和 Prometheus 指标
- 部署链路：单一应用镜像、Docker Compose、Caddy、健康检查和非 root 运行
- 工程质量：类型检查、测试、Lint、格式检查和 CI
- 扩展内核：Manifest、`defineSystem()`、依赖排序、冲突拒绝和分运行面注册
- 前端扩展：Admin/Web Shell、路由、导航、Widget、搜索、SEO、Sitemap 与 Landing Block 注册表
- 一方扩展：Identity、Integrations Core、Jobs/Outbox、Notifications 与 CMS 均拥有独立包、Manifest、运行面和 Migration Source
- 迁移协议：命名空间 Migration Source、Legacy Alias adoption、checksum 和并发锁

当前可发布边界包含空 Kernel、三种基础设施 Adapter、Identity、Integrations Core、Jobs/Outbox、
Assets、Notifications、CMS，以及 Nodemailer、七牛、支付和 OpenRouter Adapter；Presentation 等
尚未拆出的功能暂时留在兼容 `@lingcootech/frame` 内。
默认 `frameKernelSystem` 不安装任何 Feature，可部署的 Reference System 在组合根显式安装
Kernel、Identity、Integrations、Jobs、Notifications、CMS 和应用扩展。框架没有商品、课程、订单等具体行业领域概念。

## 仓库结构

```text
apps/       可运行、可部署的参考系统及其 Admin/Web 应用
packages/   可发布、可升级、供业务系统消费的 Frame 软件包
fixtures/   只通过公开包入口验证 Consumer 和示例扩展
test/       跨包集成测试
scripts/    仓库工程与发布产物验收脚本
deploy/     生产部署脚本和入口配置
docs/       架构、契约、能力与演进记录
```

`apps` 证明框架可以组成一个完整系统，但不是框架公共 API；`packages` 才是业务系统长期依赖和升级的
边界。两者的关系和推荐阅读顺序见 [CODEMAP](CODEMAP.md)。

## 架构来源

初始实现以 `lingcoo-edu-system` 的工程形态作为母本参照，因为它已经具备公共 Web、管理后台、Fastify API 和单镜像部署的完整闭环。抽取时只保留了可复用的技术边界与运行方式，没有复制教育业务。

Core、Edu、Retail 三个成熟系统不会成为本仓库的运行依赖，也不会由本仓库反向修改。

## 本地启动

环境要求：

- Node.js 22+
- Docker 及 Docker Compose

```bash
cp .env.example .env
npm run setup
docker compose up -d
npm run db:migrate
```

首次运行前，在 `.env` 中临时设置 `AUTH_BOOTSTRAP_EMAIL` 和至少 12 位的
`AUTH_BOOTSTRAP_PASSWORD`。首个所有者创建后删除临时密码，并在首次登录时设置正式密码。

然后分别启动四个开发进程：

```bash
npm run dev:api
npm run dev:worker
npm run dev:public
npm run dev:admin
```

访问：

- 公共 Web：<http://localhost:5174>
- Frame 文档：<http://localhost:5174/docs>
- 管理后台：<http://localhost:5173/admin/>
- API 健康检查：<http://localhost:8090/health>
- 数据库就绪检查：<http://localhost:8090/ready>

## 一体化构建

```bash
npm run build:all
npm start
```

构建后，Fastify 在同一端口提供全部运行面：

- `/`：公共 Web
- `/framework`、`/architecture`、`/packages`、`/extensions`、`/docs`、`/releases`：Reference 官方站
- `/admin/`：管理后台
- `/api/*`：应用 API
- `/health`：进程健康
- `/ready`：数据库就绪

## 容器部署

本地验证生产拓扑时，可以先构建应用镜像再启动：

```bash
docker build -t lingcoo-system-base-framework:local .
LINGCOO_BASE_RUNTIME_IMAGE=lingcoo-system-base-framework:local \
docker compose -f docker-compose.prod.yml up -d
```

正式部署使用 GitHub Actions 构建镜像并发布到阿里云 ACR，服务器只拉取指定 Git 提交对应的镜像，不在服务器构建。完整链路见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 常用命令

| 命令                      | 作用                          |
| ------------------------- | ----------------------------- |
| `npm run setup`           | 安装 API、双 Web 和共享包依赖 |
| `npm run check`           | 类型检查、测试和 Lint         |
| `npm run build:all`       | 构建共享包、双 Web 和 API     |
| `npm run packages:verify` | 构建并安装真实 tarball 验收   |
| `npm run dev:worker`      | 启动后台任务与 Outbox Worker  |
| `npm run db:generate`     | 根据 Drizzle Schema 生成迁移  |
| `npm run db:migrate`      | 按顺序执行未应用的 SQL 迁移   |
| `npm run format:check`    | 检查代码格式                  |

## 如何增加业务

业务应用在组合根中把 `frameKernelExtension`、`frameIdentityExtension`、`frameJobsExtension`、
`frameNotificationsExtension`、所需其它一方扩展与自己的领域扩展交给 `defineSystem()`，再将同一个
System 传给 API、Worker 和迁移运行时。
领域扩展现在可以贡献权限、
非敏感设置、Server 路由、Job Handler、Outbox Subscriber、命名空间迁移、Admin 页面与导航、
Public Web 页面、SEO、Sitemap 和受控 Landing Block。各运行面使用独立入口，浏览器代码不导入
Server、Worker 或数据库实现。

具体约束见：

- [架构说明](docs/architecture.md)
- [扩展开发与系统组合](docs/extension-development.md)
- [第一方扩展边界](docs/first-party-extensions.md)
- [成熟系统共同能力矩阵](docs/capability-matrix.md)
- [身份与访问控制](docs/identity-access.md)
- [账号自服务与安全中心](docs/account-security.md)
- [双 Web 前端与共享组件规划](docs/frontend-foundation.md)
- [Frame 官方站与参考控制台改造路线](docs/reference-experience-roadmap.md)
- [外部集成基础](docs/integration-foundation.md)
- [SMTP Provider](docs/smtp-provider.md)
- [七牛云、支付与 OpenRouter Provider](docs/shared-providers.md)
- [后台任务、Outbox 与通知](docs/jobs-notifications.md)
- [文件与媒体资产中心](docs/media-assets.md)
- [品牌与站点呈现](docs/presentation.md)
- [轻量内容中心](docs/cms-lite.md)
- [元数据、统一搜索与数据交换](docs/metadata-search-exchange.md)
- [运行可观测性](docs/observability.md)
- [领域扩展指南](docs/domain-extension.md)
- [基于 Frame 的应用全生命周期](docs/application-lifecycle.md)
- [Frame 应用接入产品化实施方案](docs/application-adoption-plan.md)

## 当前边界

这是持续演进的空白业务框架。共享 UI、身份与 RBAC、类型化系统设置、可查询审计和外部集成
生命周期已经进入基础层；SMTP、七牛云、支付宝、微信支付 API v3 与 OpenRouter 均已安装真实
适配器。持久化任务、事务 Outbox、独立 Worker、站内通知、邮件投递、文件与媒体资产中心也已
进入基础层；数据字典、分类标签、统一搜索和版本化 JSON 数据交换也已完成。Request ID、脱敏日志、
API/Worker 心跳、错误聚合和 Prometheus 指标已经进入基础层；外部告警和分布式追踪保持可选适配器边界。
