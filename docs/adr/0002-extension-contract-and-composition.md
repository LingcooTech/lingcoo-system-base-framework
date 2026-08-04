# ADR 0002: 扩展按运行面分离并显式组合

- Status: Accepted
- Date: 2026-08-04

## Context

Frame 0.1 已经存在 `AppModule`、Provider、Search Provider、Dataset Adapter、Job Handler 和 Outbox
Subscriber 等注册机制，但它们由 API、Worker 和两个前端分别手工组合。新增完整领域模块仍需修改
多个中心文件，Manifest 也只是手工维护的描述数据。

同一个扩展可能包含服务端、Worker、管理后台和公共 Web 代码。浏览器构建不得引入数据库、密钥或
Node.js 依赖，服务端也不应依赖 React 实现。

## Decision

Frame 提供统一 Extension Contract，但每个运行面使用独立入口：

```text
@lingcoo/example-extension/contracts
@lingcoo/example-extension/server
@lingcoo/example-extension/worker
@lingcoo/example-extension/admin
@lingcoo/example-extension/web
```

扩展 Manifest 至少声明：

- 全局唯一 `id`、版本、Extension API 版本和兼容 Frame 范围。
- 必需和可选扩展依赖。
- Schema 与迁移来源。
- 权限、非敏感设置和健康检查贡献。
- Server 路由与服务注册。
- Worker Job Handler 与 Outbox Subscriber。
- Admin 路由、导航、Dashboard Widget 和全局搜索贡献。
- Public Web 路由、Sitemap、SEO 数据和 Landing Page Block 贡献。

应用通过类型化 `defineSystem()` 显式列出扩展。构建工具为各运行面生成注册表和只读
`lingcoo.system.json`。JSON 是构建产物，不是第二份手工配置来源。

构建和启动阶段必须拒绝：重复扩展 ID、依赖缺失、循环依赖、版本不兼容、路由冲突、权限冲突、
Job Kind 冲突和 Landing Block Type 冲突。

扩展只能依赖公开契约。跨扩展协作使用声明的 Service Port 或领域事件，不直接读取其他扩展的数据表
或导入其内部文件。框架默认实现必须在应用提供自定义实现后退让。

0.x 阶段只支持受信任、构建期安装的扩展。扩展拥有与应用进程相同的数据库和运行权限，不宣称提供
安全沙箱，也不支持生产环境上传 ZIP、在线执行第三方代码或无重启卸载。

## Consequences

- 新领域模块不再修改 Frame 的 API、Worker 和前端中心分支。
- 扩展包需要维护多个构建入口和严格的浏览器/服务端依赖边界。
- `AppModule` 会保留为 Server Surface 的底层适配器，但不再是完整扩展模型。
- 现有模块间直接依赖需要逐步提炼 Service Port，不能一次机械拆包。
- 应用仍能在组合根中清楚看到全部安装能力，不采用隐式目录扫描。

## Landing Page Boundary

Landing Page 使用受控区块注册表。区块必须提供类型、Zod Schema、前台渲染器、后台编辑器、资源
引用声明和配置迁移；页面存储有序区块实例，不保存任意可执行代码。Button、Header 等基础组件不是
独立插件，只有形成完整业务或页面能力的单元才成为扩展。
