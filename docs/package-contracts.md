# Frame 0.3 Package Contracts

## 状态

`0.3` 是内部预览包契约。仓库 CI 验证真实 npm tarball，但本阶段不向公共 npm Registry 发布。
Consumer 应锁定同一 `0.3.x` Backend、Database 和 Extension SDK 版本，不导入 `exports` 之外的文件。

## 包边界

| 包                             | 职责                                                | 公开入口                                                          |
| ------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------- |
| `@lingcoo/frame`               | Fastify 宿主、核心扩展、Worker 和系统迁移组合       | `.`, `./app`, `./env`, `./worker`, `./extensions`, `./migrations` |
| `@lingcoo/frame-database`      | PostgreSQL/Drizzle、Schema、Migration V2 和历史 SQL | `.`, `./schema`, `./migrations`                                   |
| `@lingcoo/frame-extension-sdk` | 浏览器安全 Manifest/System 及分运行面扩展契约       | `.`, `./server`, `./worker`, `./migrations`                       |
| `@lingcoo/frame-ui`            | 无业务语义的 React UI 组件和共享样式                | `.`, 组件子路径, `./styles.css`                                   |
| `@lingcoo/frame-design-tokens` | 基础、后台和公共站点语义 Token                      | `./base.css`, `./admin.css`, `./public.css`                       |

`admin-ui` 和 `public-web` 仍是参考应用，不是 Consumer 前端扩展 API。它们的生产构建继续包含在 Frame
参考镜像中；阶段 3 将提供独立 Admin/Web Shell 与扩展注册表。

## 系统组合

```ts
import { buildApp, createFrameWorker, frameCoreExtension } from '@lingcoo/frame';
import { defineSystem } from '@lingcoo/frame-extension-sdk';
import { officialSiteExtension } from '@lingcoo/official-site-extension';

const system = defineSystem({
  id: 'official-site',
  version: '0.1.0',
  extensions: [frameCoreExtension, officialSiteExtension],
});

const app = await buildApp(env, { system });
const worker = createFrameWorker(env, { system });
```

`defineSystem()` 校验扩展 ID、SemVer、Frame/API 兼容范围、依赖完整性和循环，并稳定拓扑排序。它会
拒绝重复权限、设置、路由、Job Kind、Migration Source 和 Legacy Alias；多个扩展订阅同一个 Outbox
Topic 是合法 fan-out。`buildApp(env)` 与 `createFrameWorker(env)` 继续使用默认核心 System，兼容
0.2 调用方式。

## 运行面

- `@lingcoo/frame-extension-sdk`：只含 Manifest、`defineExtension()` 和 `defineSystem()`，可进入浏览器构建。
- `./server`：Fastify 路由与类型化非敏感设置；声明路由会在注册前检查核心及其他路由冲突。
- `./worker`：通过受限上下文注册声明过的 Job Handler 与 Outbox Subscriber。
- `./migrations`：Migration Source 定义及数据库迁移类型，不进入浏览器入口。

设置 Registry 归属于每个 Defined System，不再由业务扩展修改进程级全局数组。Worker 注册器同样按
Worker 实例创建；扩展只能注册 Manifest 已声明的 Job 和 Topic。

## Migration V2

```ts
import { runSystemMigrations } from '@lingcoo/frame/migrations';

await runSystemMigrations({
  connectionString: process.env.DATABASE_URL!,
  system,
});
```

迁移全局名称为 `source-id/migration-id.sql`。来源按依赖拓扑排序，来源内部严格采用声明顺序，不依赖
文件系统排序。执行器验证 SQL SHA-256，使用 PostgreSQL advisory lock 串行化，并支持 Legacy Alias：
旧记录 checksum 匹配时只写入 canonical adoption 记录，不执行 SQL；不匹配、重复 alias 或已应用
canonical checksum 变化都会立即失败。未知历史记录保持不变。

默认 `lingcoo-frame-migrate` CLI 只迁移 Frame Core。业务系统应在自己的迁移入口调用
`runSystemMigrations()`，确保领域扩展迁移也进入同一计划。

## 发布产物验收

`npm run packages:verify` 构建并打包 Frame、Database、Extension SDK、UI、Design Tokens 与完整示例
扩展，再在临时目录隔离安装。Consumer Fixture 会进行 TypeScript 公共入口编译，组合 API/Worker，
验证示例路由、Job/Topic 注册和 13 条系统迁移。CI 提供 PostgreSQL 17，并真实执行全部迁移。

完整扩展结构、规则与示例见 [扩展开发与系统组合](extension-development.md)。
