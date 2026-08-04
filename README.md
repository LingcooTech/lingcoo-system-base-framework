# Lingcoo System Base Framework

一套剔除具体行业和业务逻辑后，仍然可以独立运行、测试和部署的系统基础框架。

当前 `0.1` 是用于验证完整运行边界的参考实现。Frame 正在演进为版本化软件包与显式扩展协议；新的
业务系统最终通过依赖 Frame 包和安装领域扩展完成组合，而不是复制本仓库后长期维护底层源码副本。

平台化路线见 [Frame 平台化改造路线](docs/platform-roadmap.md)，实际阶段记录见
[Frame 平台化开发进度](docs/platform-progress.md)，长期决策见 [ADR](docs/adr/README.md)。

## 当前包含什么

- 公共 Web：React、TypeScript、Vite、Tailwind CSS
- 管理后台：独立 React 应用，包含导航、筛选、分页、批量操作、详情抽屉和统一反馈
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

当前包含 `system`、`auth`、`access`、`settings`、`audit`、`metadata`、`search`、
`data-exchange`、`integrations`、`jobs`、`notifications`、`assets`、`presentation`、`cms`、`public-site` 和 `observability` 基础模块，
没有商品、课程、订单等具体行业领域概念；CMS 仅提供通用页面与文章边界。

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

| 命令                   | 作用                          |
| ---------------------- | ----------------------------- |
| `npm run setup`        | 安装 API、双 Web 和共享包依赖 |
| `npm run check`        | 类型检查、测试和 Lint         |
| `npm run build:all`    | 构建公共 Web、管理后台和 API  |
| `npm run dev:worker`   | 启动后台任务与 Outbox Worker  |
| `npm run db:generate`  | 根据 Drizzle Schema 生成迁移  |
| `npm run db:migrate`   | 按顺序执行未应用的 SQL 迁移   |
| `npm run format:check` | 检查代码格式                  |

## 如何增加业务

在 `0.2` 扩展 SDK 完成前，本仓库中的模块开发仍用于 Frame 自身和参考验证，不建议再通过复制整个
仓库创建新的长期业务系统。扩展 SDK 完成后，每个业务域通过独立 Extension Package 提供服务端、
Worker、后台、公共 Web、Schema 和迁移入口，并由应用组合根显式安装。

具体约束见：

- [架构说明](docs/architecture.md)
- [成熟系统共同能力矩阵](docs/capability-matrix.md)
- [身份与访问控制](docs/identity-access.md)
- [账号自服务与安全中心](docs/account-security.md)
- [双 Web 前端与共享组件规划](docs/frontend-foundation.md)
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

## 当前边界

这是持续演进的空白业务框架。共享 UI、身份与 RBAC、类型化系统设置、可查询审计和外部集成
生命周期已经进入基础层；SMTP、七牛云、支付宝、微信支付 API v3 与 OpenRouter 均已安装真实
适配器。持久化任务、事务 Outbox、独立 Worker、站内通知、邮件投递、文件与媒体资产中心也已
进入基础层；数据字典、分类标签、统一搜索和版本化 JSON 数据交换也已完成。Request ID、脱敏日志、
API/Worker 心跳、错误聚合和 Prometheus 指标已经进入基础层；外部告警和分布式追踪保持可选适配器边界。
