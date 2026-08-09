# 领域扩展指南

下面描述如何基于 Frame 0.7 开发具体业务系统。这里的“基于”是消费可升级的软件包，并在应用组合根
安装领域扩展，不是复制 `packages/frame` 后修改一套私有 Core。

## 1. 定义领域边界

先用业务语言划分模块。例如零售系统可以有 `catalog`、`inventory` 和 `order`，教育系统可以有
`course`、`enrollment` 和 `learning`。

模块名应表达稳定业务能力，不使用 `common`、`misc`、`data` 这类无法形成边界的名称。一个领域较小
时可以先做成一个扩展；只有边界、发布节奏或可选性已经明确时才拆成多个包。

## 2. 创建领域扩展

业务仓库可以把领域扩展放入自己的 `packages/`：

```text
packages/example-extension/
  package.json
  src/
    contracts.ts       浏览器安全 Manifest 和共享类型
    server.ts          Fastify 路由与领域服务装配
    worker.ts          Job Handler 与 Outbox Subscriber
    migrations.ts      命名空间前向迁移
    admin.tsx          后台路由、导航、Widget 与搜索
    web.tsx            公共页面、SEO、Sitemap 与 Landing Block
    index.ts           服务端完整扩展入口
```

真实后端领域实现可继续在包内按垂直能力组织：

- `schema.ts`：领域数据表。
- `repository.ts`：持久化查询。
- `service.ts`：业务规则和事务。
- `routes.ts`：HTTP 协议适配。

路由不直接承载业务规则，Service 不依赖 Fastify Request 或 Reply。跨扩展协作优先使用公开 Service
Port 或事务 Outbox，不直接查询其他扩展的私有表。

领域中的封面、附件、音视频等字段应保存 `assetId`，并通过资产服务声明
`ownerType + ownerId + field` 引用。不要保存云厂商对象键或永久复制公开 URL；替换引用后，旧资产才能
进入安全删除流程。

## 3. 组合业务系统

应用组合根显式声明系统安装的 Core、一方扩展和领域扩展：

```ts
import { frameCmsExtension } from '@lingcootech/frame/cms';
import { frameCoreExtension } from '@lingcootech/frame/extensions';
import { defineSystem } from '@lingcootech/frame-extension-sdk';
import { exampleExtension } from '@lingcootech/example-extension';

export const system = defineSystem({
  id: 'example-system',
  version: '0.1.0',
  extensions: [frameCoreExtension, frameCmsExtension, exampleExtension],
});
```

API、Worker 和 Migration 必须使用同一个 `system`。参考写法位于：

```text
apps/reference-system/src/system.ts
apps/reference-system/src/server.ts
apps/reference-system/src/worker.ts
apps/reference-system/src/migrate.ts
```

简单系统可以只安装 Core；需要内容管理时再安装 CMS。扩展清单属于应用，不应通过修改 Frame Core 的
模块数组实现启停。

## 4. 增加前端页面

公共 Web 和管理后台保持独立应用，但通过扩展的 `admin` 与 `web` 入口贡献页面：

```text
apps/example-admin/src/features/example/
apps/example-web/src/features/example/
packages/example-extension/src/admin.tsx
packages/example-extension/src/web.tsx
```

管理后台优先消费 `@lingcootech/frame-admin` 和 `@lingcootech/frame-ui`；公共站点优先消费
`@lingcootech/frame-web`、共享 UI 与 Design Tokens。只有经过多个领域验证、没有业务含义的组件才应回到
Frame 包。

浏览器代码只能导入扩展的 Contracts、Admin 或 Web 入口，不能间接带入 Server、Worker、Migration、
数据库或密钥处理实现。

## 5. 数据迁移

每个扩展拥有稳定 `sourceId` 和只向前演进的 Migration 列表。已在任一环境应用的 SQL、ID、checksum
与 Legacy Alias 不可修改；调整结构时新增下一条迁移。

应用运行：

```bash
npm run db:migrate
```

该命令执行 Reference System 的完整迁移计划，而不是只执行 Database Core。业务仓库也应让部署迁移
入口读取同一个 Defined System。

## 6. 验证

一个领域扩展完成时至少应满足：

```bash
npm run check
npm run build:all
npm run packages:verify
```

并为关键业务规则增加 Service 单元测试，为 API 边界增加注入测试，为 Admin/Web Contribution 增加
注册与路由测试。需要数据库的集成测试使用独立测试库，不依赖开发数据。

## 7. 哪些代码应该回到基础框架

具体系统中的代码满足以下条件后，才考虑提炼回 Frame：

- 至少在两个不同领域或系统中以同样语义使用。
- 不包含行业术语、业务枚举或特定流程。
- 有稳定公开 API、升级策略和测试。
- 上移后不会迫使所有系统接受不需要的依赖。

先在业务中验证，再提炼为 Core、共享包或可选一方扩展，可以避免基础层演变成所有历史需求的集合。
