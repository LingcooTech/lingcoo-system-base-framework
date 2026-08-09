# ADR 0001: Frame 作为版本化依赖分发

- Status: Accepted
- Date: 2026-08-04

## Context

Frame 0.1 是一个可以独立运行的完整应用，后端、Worker、公共 Web、管理后台、迁移和部署均在同一
仓库中。业务系统通过复制仓库并在副本中增加领域代码完成派生。这验证了基础能力，但会导致安全
修复、依赖升级、迁移执行器和应用壳在每个系统中形成独立副本。

Frame 需要同时满足：业务系统独立部署、版本可控、底层修复只维护一次、领域代码不进入框架，以及
应用可以按自己的节奏升级。

## Decision

Frame 改为版本化软件包和参考应用组成的 Monorepo。业务系统保留独立仓库，通过 npm 依赖消费
Frame，不再复制其内部源码。

第一轮包化保持较粗粒度：

- `@lingcootech/frame`：服务端宿主、核心生命周期和现有稳定基础模块。
- `@lingcootech/frame-database`：数据库创建、基础 Schema 和迁移协议。
- `@lingcootech/frame-extension-sdk`：系统与扩展定义契约。
- `@lingcootech/frame-admin`：管理后台 Shell、认证上下文和扩展注册表。
- `@lingcootech/frame-web`：公共站点基础、路由和页面区块契约。
- `@lingcootech/frame-ui` 与 `@lingcootech/frame-design-tokens`：共享视觉基础。
- `@lingcootech/frame-testkit`：测试数据库、认证夹具和扩展契约测试。
- `@lingcootech/frame-devkit`：创建、校验、迁移和升级工具。

Frame 仓库中的 `reference-web`、`reference-admin` 和文档站只用于演示、文档和验收，不作为业务
应用源代码分发。Starter 只生成应用组合根、领域目录、部署文件和最小前端入口。

业务应用构建时将依赖和扩展编译进自己的单体镜像。生产运行不依赖 Frame 中央服务，也不自动跟随
Frame 最新版本。

内部预览版本以 `@lingcootech` scope 发布到组织的 GitHub Packages npm Registry；公开 Beta 稳定后再
评估公共 Registry。Consumer 只通过不可变版本和 lockfile 升级，不通过 dist-tag 直接进入生产。

## Consequences

- Frame 修复通过依赖升级 PR 进入业务系统，而不是复制提交。
- 应用可以锁定版本并独立安排升级。
- Frame 必须维护公开导出、SemVer、废弃周期和升级说明。
- 包不能依赖业务应用路径、业务环境变量或业务静态资源。
- 部署仍由业务应用负责，Frame 只提供可复用脚本和工作流构件。
- 0.2 先完成可依赖性，0.3 再逐步拆分可选基础扩展，避免过早形成大量循环微包。

## Rejected Alternatives

- 继续复制仓库：短期简单，但维护成本随业务系统数量线性增长。
- Git Submodule 或 Subtree：不能提供稳定 API、依赖解析和可靠升级体验。
- 统一运行中的中央 Frame 服务：破坏独立自部署目标并引入分布式系统复杂度。
- 共享基础 Docker 镜像并在运行时覆盖源码：版本、迁移和前端构建边界不清晰。
