# Frame 0.2 Package Contracts

## 状态

`0.2` 是内部预览包契约。仓库 CI 已验证真实 npm tarball，但本阶段不向公共 npm Registry 发布。
Consumer 应锁定同一 `0.2.x` 版本，不导入 `exports` 之外的文件。

## 包边界

| 包                             | 职责                                                   | 公开入口                                    |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------- |
| `@lingcoo/frame`               | Fastify 宿主、环境契约、Worker 运行时和现有基础模块    | `.`, `./app`, `./env`, `./worker`           |
| `@lingcoo/frame-database`      | PostgreSQL/Drizzle 连接、基础 Schema、迁移运行时和 SQL | `.`, `./schema`, `./migrations`             |
| `@lingcoo/frame-ui`            | 无业务语义的 React UI 组件和共享样式                   | `.`, 组件子路径, `./styles.css`             |
| `@lingcoo/frame-design-tokens` | 基础、后台和公共站点语义 Token                         | `./base.css`, `./admin.css`, `./public.css` |

`admin-ui` 和 `public-web` 在阶段 1 仍是参考应用，不是 Consumer 前端扩展 API。它们的生产构建被
包含在 `@lingcoo/frame` tarball 中，用于保证现有参考部署继续工作；阶段 3 将提供独立 Admin/Web
Shell 与扩展注册表。

## 服务端调用

```ts
import { buildApp, loadEnv } from '@lingcoo/frame';

const env = loadEnv();
const app = await buildApp(env);
await app.listen({ host: env.API_HOST, port: env.API_PORT });
```

`buildApp()` 返回 Fastify 实例，由 Consumer 拥有监听、关闭和进程信号处理。阶段 1 使用 Frame 的
固定基础模块集合；自定义模块组合由阶段 2 的 `defineSystem()` 接管。

## Worker 调用

```ts
import { createFrameWorker, loadEnv } from '@lingcoo/frame';

const worker = createFrameWorker(loadEnv());
process.on('SIGTERM', () => void worker.stop('SIGTERM'));
await worker.run();
```

导入 `@lingcoo/frame/worker` 不会读取环境、连接数据库、监听端口或注册进程信号。调用
`createFrameWorker()` 只创建运行时；`run()` 启动循环，`stop()` 请求优雅停止，未启动实例可用
`dispose()` 释放资源。Worker Handler/Subscriber 扩展注册属于阶段 2。

## Database 与迁移

```ts
import { createDatabase } from '@lingcoo/frame-database';
import { runMigrations } from '@lingcoo/frame-database/migrations';

await runMigrations({ connectionString: process.env.DATABASE_URL! });
const { db, pool } = createDatabase(process.env.DATABASE_URL!);
```

发布包包含 `0000` 到 `0011` 的不可变 SQL，并提供 `lingcoo-frame-migrate` CLI。迁移记录继续使用
`framework_migrations` 和 SHA-256 checksum；阶段 1 不改变已部署数据库的语义。

## UI 调用

```tsx
import '@lingcoo/frame-design-tokens/base.css';
import '@lingcoo/frame-ui/styles.css';
import { Button } from '@lingcoo/frame-ui/button';

export function SaveButton() {
  return <Button>Save</Button>;
}
```

UI 包只发布编译后的 JavaScript、声明文件和 CSS，不发布 TypeScript 源码。React 与 React DOM 是
peer dependency，Consumer 负责提供兼容的 React 19 版本。

## 发布产物验收

`npm run packages:verify` 会构建四个包，执行 `npm pack`，核对关键文件，然后在系统临时目录隔离安装
tarball。Frame 包始终来自本次生成的本地 `.tgz`；第三方依赖优先使用 npm 缓存，缓存缺失时从配置的
Registry 获取。Consumer Fixture 会编译 React 引用、导入全部运行时入口、发现 12 个迁移、注入 API
健康请求并验证 Worker 可创建和释放。CI 提供 PostgreSQL 时还会实际执行打包后的迁移。
