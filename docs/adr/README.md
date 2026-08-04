# Architecture Decision Records

本目录记录 Frame 平台化过程中已经接受的长期架构决策。ADR 一经接受不直接改写结论；需要改变
决策时新增 ADR，并在新文档中标记被替代关系。

| ADR                                                  | 状态     | 决策                                               |
| ---------------------------------------------------- | -------- | -------------------------------------------------- |
| [0001](0001-framework-distribution-model.md)         | Accepted | Frame 作为版本化依赖分发，业务系统不再复制底层源码 |
| [0002](0002-extension-contract-and-composition.md)   | Accepted | 扩展按运行面分离，并在构建期显式组合               |
| [0003](0003-migration-identity-and-compatibility.md) | Accepted | 迁移使用命名空间标识并兼容现有迁移记录             |
| [0004](0004-versioning-release-and-open-source.md)   | Accepted | 采用受控版本升级、私有预览和核心开源路线           |

## 状态定义

- `Proposed`：仍在讨论，不能作为实现依据。
- `Accepted`：已经确认，后续实现必须遵守。
- `Superseded`：已被新的 ADR 替代。
- `Deprecated`：历史决策仍可追溯，但不再适用于新实现。
