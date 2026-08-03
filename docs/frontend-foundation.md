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
AssetPicker 和全局搜索。这些组件带有管理场景语义，不应直接搬到公共 Web。

公共 Web 已拥有统一站点壳：SiteShell 组合 Header、Footer 和 MobileNavigation；Container、Section、
Hero 与 PageHeader 负责无业务语义的页面结构。首页和 CMS 页面均使用同一套壳层，账号安全流程保留
独立、聚焦的 Auth 布局。

## 共享 UI 使用边界

- ToastProvider 在应用根节点安装，业务页面通过 `useToast` 提交短暂操作反馈；需要持续呈现或
  影响页面理解的消息使用 Alert。
- Drawer 负责侧边或移动端面板，Dialog 负责需要用户聚焦确认的任务，Popover 只承载轻量内容。
- ResponsiveImage 统一 Picture Source、比例、加载策略和图片适配；业务层仍负责提供 Asset URL。
- 交互组件由 Radix 管理键盘、焦点和 ARIA 行为，外层只保留 Frame 的设计变量与视觉风格。

## 公共站点壳

- Header 读取 Logo、站点名称和 `headerNavigation`；非首页的锚点导航自动回到首页锚点。
- MobileNavigation 复用共享 Drawer，并和桌面导航使用同一份数据。
- Footer 读取 `footerLinks`、联系方式、标语、版权和备案信息。
- 首页与内容页只组合 Container、Section、Hero 和 PageHeader，不再自行复制站点导航结构。

## 下一批 Public Web：页面元数据与系统页面

- SEO Head、Canonical、Open Graph、面包屑结构化数据入口。
- Sitemap、Robots 和公共路由清单。
- 404 / 500 页面与全站加载、错误边界。
- 从 CMS 页面中提取 ContentRenderer、ArticleCard、EmptyContent。
- AuthShell、FormResult 和通用错误页。

公共 Web 只共享展示和交互结构，不把课程卡片、商品卡片、购物车或报名表等行业组件放进 Frame。
