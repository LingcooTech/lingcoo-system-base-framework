# Lingcoo System Base Framework

一套剔除具体行业和业务逻辑后，仍然可以独立运行、测试和部署的系统基础框架。

它不是代码生成器，也不是组件展示站。新的行业系统直接以本仓库为工程基础，在明确的模块边界内增加领域模型、接口和页面即可。

## 当前包含什么

- 公共 Web：React、TypeScript、Vite、Tailwind CSS
- 管理后台：独立 React 应用，包含导航、页面容器、状态、表格和资源区块等基础界面
- 应用 API：Fastify、TypeScript、Zod、统一错误处理、CORS、安全响应头和限流
- 数据基础：PostgreSQL、Drizzle Schema、可追踪的 SQL 迁移
- 部署链路：单一应用镜像、Docker Compose、Caddy、健康检查和非 root 运行
- 工程质量：类型检查、测试、Lint、格式检查和 CI

当前只包含 `system` 基础模块，没有用户、商品、课程、订单、内容等领域概念。

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

然后分别启动三个开发进程：

```bash
npm run dev:api
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

先构建应用镜像：

```bash
docker build -t lingcoo-system-base-framework:local .
```

再启动完整生产拓扑：

```bash
docker compose -f docker-compose.prod.yml up -d
```

默认访问地址为 <http://localhost:18090>。生产环境必须通过环境变量覆盖数据库密码、站点地址、CORS 来源和镜像版本。

## 常用命令

| 命令                   | 作用                         |
| ---------------------- | ---------------------------- |
| `npm run setup`        | 安装根目录和两个前端的依赖   |
| `npm run check`        | 类型检查、测试和 Lint        |
| `npm run build:all`    | 构建公共 Web、管理后台和 API |
| `npm run db:generate`  | 根据 Drizzle Schema 生成迁移 |
| `npm run db:migrate`   | 按顺序执行未应用的 SQL 迁移  |
| `npm run format:check` | 检查代码格式                 |

## 如何增加业务

不要把领域代码放进 `system` 模块。每个业务域在 `src/modules/<domain>` 下拥有自己的路由、服务和数据访问边界，并从 `src/modules/index.ts` 显式注册。前端页面也按同一个领域组织。

具体约束见：

- [架构说明](docs/architecture.md)
- [领域扩展指南](docs/domain-extension.md)

## 当前边界

这是第一阶段的空白框架。认证、RBAC、文件存储、消息队列、后台任务和可观测性接入位置已经被纳入设计，但尚未为了“看起来完整”而加入虚假实现。它们应在确认三个成熟系统的共同约束后作为下一批共享能力进入框架。
