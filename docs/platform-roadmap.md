# Frame 平台化改造路线

## 目标

Frame 从可运行的源码模板演进为可依赖、可升级、可扩展的模块化单体平台。业务系统只维护组合配置、
领域扩展、品牌页面和部署环境；通用底层由 Frame 版本化包提供。

本计划不改变轻量单体、自有部署、PostgreSQL 默认数据层和单镜像交付方向，也不在 0.x 引入运行时
第三方插件市场、多租户、微服务拆分或跨应用中央控制面。

## 0.1 基线

| 项目       | 基线                                                                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git Commit | `9aa93e3`                                                                                                                                                        |
| 版本       | `0.1.0`，根包与共享包均为 private                                                                                                                                |
| 运行面     | API、Worker、Admin UI、Public Web                                                                                                                                |
| 数据库     | PostgreSQL，根目录迁移 `0000` 至 `0011`                                                                                                                          |
| 基础模块   | system、auth、access、settings、audit、metadata、search、data-exchange、integrations、jobs、notifications、assets、presentation、cms、public-site、observability |
| 组合方式   | API、Worker、Admin 和 Public Web 分别手工注册                                                                                                                    |
| 分发方式   | 复制仓库后修改源码                                                                                                                                               |

## 阶段与验收门槛

| 阶段              | 交付结果                                                          | 退出条件                                                  |
| ----------------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| 0. 架构冻结       | ADR、包边界、迁移与版本策略、进度基线                             | 决策进入仓库，现有检查保持通过                            |
| 1. 0.2 包化       | 可发布 Backend、Database、UI 包和最小 Consumer Fixture            | Fixture 不复制 Frame 源码即可通过迁移、API、Worker 和构建 |
| 2. 扩展内核       | `defineSystem`、Extension Registry、Migration V2、Worker Registry | 示例扩展覆盖权限、API、任务、事件和迁移，并通过冲突测试   |
| 3. 前端扩展       | Admin/Web 路由、导航、Dashboard、SEO 和 Landing Block Registry    | 新页面和区块不再修改中心路由分支                          |
| 4. 第一方扩展     | 通过 Service Port 逐步拆分 CMS、资产、通知、品牌等可选能力        | Consumer 可显式启停扩展，依赖图无循环                     |
| 5. Consumer 试点  | 一个真实业务系统原地改为依赖 Frame 包                             | 保留生产数据、功能和部署链路，无底层源码副本              |
| 6. 文档与参考应用 | 文档站、Reference Web、Reference Admin、Starter、Testkit          | 新开发者按文档独立创建并升级扩展                          |
| 7. 开源 Beta      | 许可证、治理、安全、公共包和兼容矩阵                              | 可复现发布，至少一个真实 Consumer 运行 Beta               |
| 8. 1.0 稳定       | 三类业务系统验证公开扩展 API                                      | SemVer、迁移和升级承诺进入稳定期                          |

## 实施约束

- 先建立可消费的粗粒度包，再拆可选模块，不进行一次性目录大搬迁。
- 每个阶段只在上一阶段验收后开始，并在 `platform-progress.md` 记录实际结果。
- 所有迁移保持不可变；现有数据库通过 Legacy Alias 原地采用新执行器。
- Consumer 只能导入公开 `exports`，CI 增加内部路径导入检查。
- 扩展按 Server、Worker、Admin、Web 和 Contracts 分入口构建。
- Reference App 和文档不进入业务应用默认界面。
- 新抽象必须由 Consumer Fixture 或真实业务扩展证明，不能只为未来可能性设计。

## 质量门槛

每个阶段至少执行：

```bash
npm run format:check
npm run check
npm run build:all
```

包化开始后追加 `npm pack` 安装测试、空数据库迁移、受支持版本升级、Docker 构建、扩展冲突测试和
公共导出检查。数据库相关集成测试必须在 CI 的真实 PostgreSQL 中执行。

## 主要风险

| 风险             | 控制措施                                                    |
| ---------------- | ----------------------------------------------------------- |
| 过早拆成大量包   | 0.2 保留粗粒度 Backend 包，按依赖倒置结果逐步拆分           |
| 模块循环依赖     | 先提炼 Service Port 和事件契约，再移动物理目录              |
| 既有迁移冲突     | 命名空间、checksum 和 Legacy Alias adoption                 |
| React 被重复打包 | React/React DOM 作为 peer dependency，Consumer 锁定兼容范围 |
| 发布包遗漏资源   | 对打包产物执行安装、迁移和构建测试                          |
| 插件供应链风险   | 0.x 只支持受信任构建期扩展，保留 lockfile 和来源审计        |
| 文档与实现漂移   | 示例代码进入 CI，Manifest 和参考表从代码生成                |

## 完成定义

Frame 1.0 的关键结果不是目录变化，而是：同一个 Frame 版本被多个独立应用依赖；底层修复只提交和
发布一次；应用升级主要表现为依赖版本 PR；领域扩展不修改 Frame 内部源码；已有数据库可以持续前向
升级；文档能够支撑不熟悉代码库的开发者完成开发、测试和部署。
