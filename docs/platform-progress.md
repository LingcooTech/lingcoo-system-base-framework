# Frame 平台化开发进度

本文件在每个阶段完成时记录实际交付、验证结果、遗留问题和下一阶段入口。规划以
[`platform-roadmap.md`](platform-roadmap.md) 为准，架构决策以 [`adr/`](adr/README.md) 为准。

## 总体状态

| 阶段              | 状态        | 结果                                         |
| ----------------- | ----------- | -------------------------------------------- |
| 0. 架构冻结       | Completed   | 4 项 ADR、平台路线、0.1 基线和质量门槛已冻结 |
| 1. 0.2 包化       | Not started | -                                            |
| 2. 扩展内核       | Not started | -                                            |
| 3. 前端扩展       | Not started | -                                            |
| 4. 第一方扩展     | Not started | -                                            |
| 5. Consumer 试点  | Not started | -                                            |
| 6. 文档与参考应用 | Not started | -                                            |
| 7. 开源 Beta      | Not started | -                                            |
| 8. 1.0 稳定       | Not started | -                                            |

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
