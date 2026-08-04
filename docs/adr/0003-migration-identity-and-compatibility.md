# ADR 0003: 迁移使用命名空间并兼容现有记录

- Status: Accepted
- Date: 2026-08-04

## Context

Frame 0.1 按根目录 SQL 文件名排序，并以文件名作为 `framework_migrations` 主键。基础迁移已经使用
`0000` 到 `0011`。业务系统继续使用同一全局序列后，Frame 和应用都可能创建相同编号，导致升级时
无法可靠合并迁移来源。

现有生产数据库已经保存迁移文件名和 SHA-256 校验和，不能修改已应用文件，也不能要求业务系统重建
数据库。

## Decision

新迁移使用稳定来源 ID 与来源内迁移 ID 组成全局名称：

```text
frame/0012_extension_runtime.sql
frame-cms/0001_initial.sql
official-site/0001_inquiries.sql
```

每个 Migration Source 声明来源 ID、版本、依赖来源和有序迁移。每条迁移包含规范 ID、SQL、校验和
以及可选 Legacy Alias。

迁移执行器继续使用现有 `framework_migrations.name` 保存规范 ID。首次采用新执行器时：

1. 查找规范 ID；存在时必须校验 checksum。
2. 规范 ID 不存在时查找声明的 Legacy Alias。
3. Legacy Alias 存在且 checksum 一致时，不执行 SQL，只写入规范 ID 作为 adoption 记录。
4. Alias checksum 不一致或被多个来源声明时立即失败。
5. 没有任何记录时才在事务中执行 SQL 并写入规范 ID。

现有 Frame `0000` 到 `0011` 保持字节不变，并由 Frame Migration Source 声明为 Legacy Alias。业务
系统为自己的既有迁移声明独立 Alias。未知历史记录可以保留，但不会被自动归属或修改。

来源之间先按显式依赖做拓扑排序，同一来源内按 Manifest 顺序执行。文件系统扫描顺序不再决定跨来源
执行顺序。

迁移只支持前向执行。Patch 不引入破坏性 Schema 变化；Minor 使用 Expand/Contract 并在废弃周期内
保持上一应用版本可运行；真正不兼容的收缩进入 Major。

## Consequences

- Frame 和领域扩展可以独立演进迁移编号。
- 既有数据库可原地采用新执行器，无需重放 SQL。
- 发布包必须包含完整迁移资源，CI 必须执行 `npm pack` 后安装测试，防止漏发 SQL。
- 每个支持的历史版本都要有升级集成测试和 checksum 固定测试。
- 扩展卸载默认保留数据；0.x 不提供自动 Down Migration。
