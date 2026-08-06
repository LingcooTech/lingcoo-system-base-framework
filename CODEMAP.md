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
  frame/                      Backend Host、Core、Runtime 与一方扩展适配
  extension-sdk/              扩展 Manifest、System 与各运行面契约
  database/                   PostgreSQL/Drizzle、共享 Schema 和迁移执行器
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

## 3. Frame 内部四层

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

`packages/frame/src/index.ts` 只导出稳定的默认入口。CMS 适配通过 `@lingcoo/frame/cms` 显式导入，
因此不安装 CMS 的 Consumer 不会在概念上获得 CMS。

## 4. 包之间的依赖方向

```text
reference apps
      │
      ├───────────────┐
      ▼               ▼
  @lingcoo/frame   admin-shell / web-shell / cms
      │               │
      ├───────┬───────┘
      ▼       ▼
 extension-sdk   database

ui ──► design-tokens
```

关键规则：

1. `apps` 可以依赖 `packages`，`packages` 不能依赖 `apps`。
2. 业务系统依赖包的公开 `exports`，不能导入包内 `src`。
3. `extension-sdk` 只定义组合协议，不依赖具体业务扩展。
4. `database` 提供共享数据库基础；领域功能通过命名空间迁移加入自己的表。
5. Admin/Web 浏览器入口不能导入 Server、Worker、Migration 或密钥处理实现。

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
