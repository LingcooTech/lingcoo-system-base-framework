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

公共 Web 当前拥有品牌化首页、CMS 页面/文章渲染和账号安全流程，但站点级组件仍应继续提炼。

## 共享 UI 使用边界

- ToastProvider 在应用根节点安装，业务页面通过 `useToast` 提交短暂操作反馈；需要持续呈现或
  影响页面理解的消息使用 Alert。
- Drawer 负责侧边或移动端面板，Dialog 负责需要用户聚焦确认的任务，Popover 只承载轻量内容。
- ResponsiveImage 统一 Picture Source、比例、加载策略和图片适配；业务层仍负责提供 Asset URL。
- 交互组件由 Radix 管理键盘、焦点和 ARIA 行为，外层只保留 Frame 的设计变量与视觉风格。

## 下一批 Public Web：站点壳

- SiteShell、Header、Footer、MobileNavigation。
- Container、Section、Hero、PageHeader 等站点布局原语。
- SEO Head、面包屑和结构化数据入口。
- 从 CMS 页面中提取 ContentRenderer、ArticleCard、EmptyContent。
- AuthShell、FormResult 和通用错误页。

公共 Web 只共享展示和交互结构，不把课程卡片、商品卡片、购物车或报名表等行业组件放进 Frame。
