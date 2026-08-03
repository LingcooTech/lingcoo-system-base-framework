# 双 Web 前端与共享组件规划

Frame 从一开始就包含两个前端入口：`admin-ui` 是管理后台，`public-web` 是公共用户侧宿主。它们
共享 `@lingcoo/frame-design-tokens` 和 `@lingcoo/frame-ui`，但应用壳与页面组件保持独立。

## 当前共享基础

`frame-ui` 已提供 Button、Input、Textarea、FormField、Badge、Card、Avatar、Dialog、Dropdown、
Tooltip、Spinner 和 EmptyState。后台和公共 Web 都已经直接使用这些组件。账号找回、邀请和邮箱
验证页面进一步验证了公共 Web 的表单复用边界。

后台另外拥有 Shell、Sidebar、Topbar、PageFrame、ResourceSection、DataTable、StatusPill、
AssetPicker 和全局搜索。这些组件带有管理场景语义，不应直接搬到公共 Web。

公共 Web 当前拥有品牌化首页、CMS 页面/文章渲染和账号安全流程，但站点级组件仍应继续提炼。

## 下一批共享 UI

- Alert / Toast / Skeleton：统一异步反馈和加载状态。
- Tabs / Select / Checkbox / Radio / Switch：补齐通用表单交互。
- Pagination / Breadcrumb：列表和内容导航。
- Drawer / Popover：移动导航和轻量浮层。
- ResponsiveImage：统一 Asset URL、尺寸和加载策略。

## 下一批 Public Web

- SiteShell、Header、Footer、MobileNavigation。
- Container、Section、Hero、PageHeader 等站点布局原语。
- SEO Head、面包屑和结构化数据入口。
- 从 CMS 页面中提取 ContentRenderer、ArticleCard、EmptyContent。
- AuthShell、FormResult 和通用错误页。

公共 Web 只共享展示和交互结构，不把课程卡片、商品卡片、购物车或报名表等行业组件放进 Frame。
