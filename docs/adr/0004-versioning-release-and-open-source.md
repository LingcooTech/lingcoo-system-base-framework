# ADR 0004: 受控版本升级与核心开源

- Status: Accepted
- Date: 2026-08-04

## Context

Frame 需要在多个独立部署的业务系统间共享修复，同时避免未经验证的升级直接进入生产。建立扩展生态
还需要公开契约、文档、许可证、兼容规则和可复现发布，而不仅是公开源代码仓库。

## Decision

Frame 包采用统一版本和 SemVer：

- Patch：兼容修复、文档和内部实现调整。
- Minor：兼容新增能力、可选扩展点和 Expand 阶段迁移。
- Major：删除公开 API、收缩数据库兼容面或改变扩展协议。

0.x 期间允许迭代公开契约，但每次发布仍必须提供迁移说明。Extension Manifest 使用独立
`apiVersion`；扩展通过 `peerDependencies` 声明 Frame 兼容范围。

发布使用 Changesets、Git Tag、GitHub Release 和不可变 npm 版本。应用锁定 lockfile，通过自动依赖
升级 PR、完整 CI、数据库升级测试和测试环境验证后进入生产，禁止生产自动追随 `latest`。

发布通道为：

```text
canary -> private preview -> public beta -> stable
```

Frame Core、Extension SDK、UI、Devkit、Testkit、文档和 Starter 计划使用 Apache-2.0。Lingcoo 商标、
客户代码、客户数据模型和按商业策略发布的行业扩展不因 Core 开源而自动开放。

公开 Beta 之前必须完成许可证清单、`LICENSE`、`SECURITY.md`、`CONTRIBUTING.md`、行为准则、支持
策略、漏洞报告流程、公开 API 文档和至少一个不复制 Frame 源码的真实 Consumer。

## Compatibility Policy

- 只有包 `exports` 中记录的入口属于公开 API，内部路径禁止被 Consumer 导入。
- Minor 中废弃的 API 至少保留到下一个 Major，并在类型和文档中标记。
- 每次发布生成包变更、迁移、配置变化和 Consumer 操作清单。
- Frame CI 必须验证从受支持基线升级，而不只验证空数据库安装。
- 应用回滚使用上一镜像和 lockfile；数据库迁移必须遵守向后兼容窗口。

## Consequences

- 发布流程比当前单仓库部署更严格，但可以把升级风险集中在一次验证中。
- 开源时间由可消费性和文档质量决定，而不是仅由代码可见性决定。
- 官方扩展需要兼容矩阵和维护状态，未维护扩展不能标记为官方认证。
