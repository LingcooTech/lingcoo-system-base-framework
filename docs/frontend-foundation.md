# 双 Web 前端与共享组件规划

Frame 从一开始就包含两个前端入口：`admin-ui` 是管理后台，`public-web` 是公共用户侧宿主。它们
共享 `@lingcoo/frame-design-tokens` 和 `@lingcoo/frame-ui`，但应用壳与页面组件保持独立。

## 当前共享基础

`frame-ui` 已提供以下无业务语义的组件：

- 操作与反馈：Button、Alert、Toast、Spinner、Skeleton、EmptyState。
- 表单：Input、Textarea、FormField、Select、Checkbox、RadioGroup、Switch。
- 容器与浮层：Card、Dialog、Drawer、Popover、Dropdown、Tooltip、Tabs。
- 身份与内容：Avatar、Badge、ResponsiveImage、Breadcrumb、Pagination。

后台和公共 Web 都直接使用同一个包。后台账号中心已经接入全局 Toast 与 Skeleton；公共 Web 的
账号流程接入 Alert，CMS 页面接入 Breadcrumb、ResponsiveImage、Skeleton 和 EmptyState。

后台另外拥有 Shell、Sidebar、Topbar、PageFrame、ResourceSection、DataTable、StatusPill、
AssetPicker 和全局搜索。这些组件带有管理场景语义，不应直接搬到公共 Web。资源列表统一组合
FilterBar、AdminPagination、BulkActionBar 和 DetailDrawer，DataTable 支持受控的行选择状态与加载骨架。

公共 Web 已拥有统一站点壳：SiteShell 组合 Header、Footer 和 MobileNavigation；Container、Section、
Hero 与 PageHeader 负责无业务语义的页面结构。首页和 CMS 页面均使用同一套壳层，账号安全流程保留
独立、聚焦的 Auth 布局。

## 共享 UI 使用边界

- ToastProvider 在应用根节点安装，业务页面通过 `useToast` 提交短暂操作反馈；需要持续呈现或
  影响页面理解的消息使用 Alert。
- ConfirmProvider 在后台根节点提供 Promise 确认接口，删除、归档等操作不再调用浏览器原生确认框；
  表格、资产网格和详情区域使用 Skeleton 保持加载期间布局稳定。
- Drawer 负责侧边或移动端面板，Dialog 负责需要用户聚焦确认的任务，Popover 只承载轻量内容。
- ResponsiveImage 统一 Picture Source、比例、加载策略和图片适配；业务层仍负责提供 Asset URL。
- 交互组件由 Radix 管理键盘、焦点和 ARIA 行为，外层只保留 Frame 的设计变量与视觉风格。

## 公共站点壳

- Header 读取 Logo、站点名称和 `headerNavigation`；非首页的锚点导航自动回到首页锚点。
- MobileNavigation 复用共享 Drawer，并和桌面导航使用同一份数据。
- Footer 读取 `footerLinks`、联系方式、标语、版权和备案信息。
- 品牌设置中的顶部导航和页脚链接支持新增、修改、删除和显式排序，公共站点按保存顺序渲染。
- 首页与内容页只组合 Container、Section、Hero 和 PageHeader，不再自行复制站点导航结构。

## 公共 Web 页面元数据与系统页面

- `SeoHead` 统一管理页面标题、Description、Canonical、Open Graph、Twitter Card、Robots 与 JSON-LD；
  文章详情同时输出 Article 和 BreadcrumbList 结构化数据。
- `/sitemap.xml` 根据品牌公开地址和已发布 CMS 内容动态生成，`/robots.txt` 明确排除管理、API 与
  草稿预览路径。
- 公共 Web 对未知路由、内容不存在、接口失败和渲染异常分别提供 404、500、加载骨架与错误边界。
- CMS 前台已经拆分为 `ContentRenderer`、`ArticleCard`、`ArticleList`、`EmptyContent`、详情布局和
  分页页面；公共文章 API 返回 `page`、`pageSize`、`total` 与 `pageCount`。

账号安全页面当前保持轻量独立布局。后续只有在增加更多公共账号流程时，再提炼 `AuthShell` 与
`FormResult`，避免为单一页面提前增加抽象。

管理后台提供“框架帮助”导航与顶栏入口，集中说明稳定能力、领域边界、常用控制面和扩展约束。该页面
只描述框架已经具备的能力，不替代领域模块自己的业务帮助。

公共 Web 只共享展示和交互结构，不把课程卡片、商品卡片、购物车或报名表等行业组件放进 Frame。
