# 第一方扩展边界

## 阶段 4 依赖审计

| 候选能力      | 主要上游依赖                                                              | 主要下游消费者                              | 本阶段判断                                   |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------- |
| CMS           | Auth/Account、Audit、Assets、Metadata、Jobs/Outbox、Public Site、Database | Admin、Public Web、Search、Sitemap          | 边界最完整，选为首个一方扩展                 |
| Assets        | Integrations/Qiniu、Audit、Jobs、Database                                 | Auth 头像、Presentation、CMS                | 先以 Asset Port 服务 CMS，后续再独立拆包     |
| Notifications | Auth/Account、Integrations/SMTP、Jobs、Audit、Database                    | Auth 安全流程                               | 认证流程仍直接创建通知，需先提炼通知发送端口 |
| Presentation  | Assets、Audit、Database                                                   | Auth 邮件品牌、Admin Shell、Public Site/Web | 下游较多，需先稳定品牌读取端口与前端 Context |

依赖扫描没有发现 CMS 对 Settings 或 Integrations 的直接依赖。CMS 对其他能力的协作已收敛到四个
Server/Worker Service Port：`CmsAuditPort`、`CmsAssetPort`、`CmsTaxonomyPort` 和 `CmsJobPort`。
重定向与动态 Sitemap 通过 `PublicSiteRegistry` 注册，不再由宿主直接构造 `CmsService`。

## `@lingcootech/frame-cms`

该包提供七个公开入口：

- `.` / `./contracts`：浏览器安全 Manifest 和共享 DTO。
- `./server`：CMS API、服务实现及宿主 Service Port。
- `./worker`：计划发布 Job Handler。
- `./migrations`：`frame-cms` Migration Source。
- `./admin`：Admin Route/Navigation Surface 工厂。
- `./web`：公共内容 Route/SEO/Sitemap Surface 工厂。

Admin 与 Web Surface 工厂接收 Consumer 的页面组件，因此可复用不同站点壳和视觉实现；路由、导航、
SEO 与 Sitemap 声明仍由 CMS 包所有。参考应用提供当前完整页面实现。

## 启停与数据

启用时，在同一个 Defined System 中加入 `frameCmsExtension`；禁用时省略它。Core 不包含 CMS 权限、
路由、Job、搜索 Provider 或迁移声明。扩展停用不会删除历史表和数据，也不提供 Down Migration。

CMS 的两条历史 SQL 字节未改变。`frame-cms/0009_cms_lite.sql` 和
`frame-cms/0011_cms_workflow.sql` 同时接管旧文件名与 Stage 2/3 的 `frame/...` canonical 记录；checksum
匹配时只写 adoption 记录，不重放 SQL。

Landing Block 持久化端口本阶段没有加入 CMS：现有 CMS 数据模型尚不存储 Landing Block，提前增加
空端口没有可验证消费者。等首页内容模型进入真实 Consumer 时，应复用受控 JSON/Schema Version
契约并由实际持久化流程证明该边界。
