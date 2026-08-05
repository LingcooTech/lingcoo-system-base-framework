# 扩展开发与系统组合

## 当前能力

Frame 0.5 只支持受信任、构建期安装的扩展。扩展与宿主运行在同一个单体部署和 PostgreSQL 数据库
中，不提供安全沙箱、生产 ZIP 上传、无重启卸载或运行时插件市场。

一个领域扩展可以贡献：

- 权限与类型化非敏感设置声明。
- Fastify Server 路由。
- Worker Job Handler 与 Outbox Subscriber。
- 带来源命名空间、依赖和 Legacy Alias 的前向 SQL 迁移。
- Admin 路由、导航、Dashboard Widget、全局搜索和 Landing Block Editor。
- Public Web 路由、SEO、Sitemap 和受控 Landing Block。

## 推荐包结构

```text
@lingcoo/example-extension
├── contracts       # 浏览器安全 Manifest
├── server          # Fastify 与设置
├── worker          # Job 和领域事件订阅
├── admin           # React 后台页面、Widget、搜索与编辑器
├── web             # React 公共页面、SEO、Sitemap 与 Landing Block
├── migrations      # Node.js SQL 资源入口
└── index           # 服务端组合入口
```

浏览器代码只能导入 `contracts`、`admin` 或 `web`，不能从 `server`、`worker` 或 `migrations` 间接
带入数据库、密钥和 Node.js 依赖。仓库内可运行示例位于 `fixtures/example-extension`。

## Manifest

```ts
import type { ExtensionManifest } from '@lingcoo/frame-extension-sdk';

export const manifest = {
  id: 'example',
  version: '0.1.0',
  apiVersion: '1',
  frame: '^0.5.0',
  dependencies: [{ id: 'frame', version: '^0.5.0' }],
  permissions: ['example.read'],
  settings: ['example.greeting'],
  server: { routes: [{ method: 'GET', path: '/api/example' }] },
  worker: {
    jobs: ['example.echo'],
    subscriptions: ['example.created'],
  },
  migrations: {
    sourceId: 'example',
    migrations: [{ id: '0001_initial.sql' }],
  },
  admin: {
    routes: [
      { id: 'example.overview', path: '/example/*', title: '示例', permission: 'example.read' },
    ],
    navigation: [
      {
        id: 'example.overview',
        routeId: 'example.overview',
        href: '/example',
        label: '示例',
        group: '扩展',
      },
    ],
  },
  web: {
    routes: [{ id: 'example.public', path: '/example' }],
    landingBlocks: [{ type: 'example.hero', schemaVersion: 2 }],
  },
} as const satisfies ExtensionManifest;
```

Manifest 是声明和冲突检查来源，运行面函数提供实现。权限必须由扩展迁移写入 `permissions`，Manifest
不会在启动时隐式同步数据库。敏感值必须来自环境或加密 Provider 凭据，不得声明为普通 Setting。

## Server 与 Worker

```ts
import { defineServerExtension } from '@lingcoo/frame-extension-sdk/server';
import { defineWorkerExtension } from '@lingcoo/frame-extension-sdk/worker';

export const server = defineServerExtension({
  register({ app }) {
    app.get('/api/example', async () => ({ status: 'ok' }));
  },
});

export const worker = defineWorkerExtension({
  register({ registerJob, subscribe }) {
    registerJob('example.echo', ({ payload }) => ({ echoed: payload }));
    subscribe('example.created', async (event) => {
      // Subscriber 必须自行保证幂等。
      void event.eventId;
    });
  },
});
```

Server 路由必须先在 Manifest 声明。Worker 受限上下文拒绝未声明的 Job/Topic，并在注册完成后确认每项
声明都有实现。不同扩展可以订阅同一个 Topic；Job Kind 和相同 method/path 的路由必须全局唯一。

## 迁移

```ts
import {
  defineMigrationExtension,
  defineMigrationSource,
} from '@lingcoo/frame-extension-sdk/migrations';

const source = defineMigrationSource({
  id: 'example',
  version: '0.1.0',
  dependencies: [{ id: 'frame', version: '^0.5.0' }],
  migrations: [
    {
      id: '0001_initial.sql',
      sql,
      legacyAliases: ['0001_example_initial.sql'],
    },
  ],
});

export const migrations = defineMigrationExtension(source);
```

同一来源内的数组顺序就是执行顺序。已发布 SQL、ID、checksum 和 Legacy Alias 不得修改；修复只能
增加新迁移。扩展卸载默认保留数据，0.x 不提供 Down Migration。

## 应用组合根

```ts
import {
  buildApp,
  createFrameWorker,
  frameCmsExtension,
  frameCoreExtension,
  runSystemMigrations,
} from '@lingcoo/frame';
import { defineSystem } from '@lingcoo/frame-extension-sdk';
import { exampleExtension } from '@lingcoo/example-extension';

export const system = defineSystem({
  id: 'example-system',
  version: '0.1.0',
  extensions: [frameCoreExtension, frameCmsExtension, exampleExtension],
});

await runSystemMigrations({ connectionString: env.DATABASE_URL, system });
const app = await buildApp(env, { system });
const worker = createFrameWorker(env, { system });
```

API、Worker 和迁移必须使用同一个 Defined System。应用应提交 lockfile，升级 Frame 后依次执行空库
迁移、受支持旧版本升级、完整测试、tarball Consumer 和生产镜像验证。

## Admin 与 Web

`defineAdminExtension()` 注册 Route Component、Navigation Icon、Dashboard Widget、Search Provider 和
Landing Block Editor；`createAdminRegistry()` 按 System 依赖顺序逐项核对 Manifest。`defineWebExtension()`
注册 Public Route、SEO Resolver、Sitemap Collector 与 Landing Block；`createWebRegistry()` 提供匹配、
解析和收集 API。参考实现见 `fixtures/example-extension/src/admin.tsx` 与 `web.tsx`。

浏览器组合根使用 `projectExtensionManifest(manifest, ['admin'])` 或 `['web']`，只保留当前运行面声明，
再附加对应运行面实现。这样 Vite 构建不会引入 Fastify、PostgreSQL、迁移 SQL 或密钥处理代码。

Landing Block 必须通过 `defineLandingBlock()` 提供稳定 Type、Zod Schema、Renderer、资产引用声明和从
旧 Schema 版本到当前版本的显式迁移；Admin 入口注册相同 Type 的 Editor。数据库只保存有序 Block
实例和 JSON 配置，不保存函数、组件或脚本。

## 跨扩展规则

- 只导入包 `exports` 中的公开入口。
- 必需或可选依赖必须在 Manifest 明确声明并限定 SemVer。
- 跨扩展协作优先使用 Service Port 或 Outbox 领域事件，不读取其他扩展私有表。
- 扩展不能修改 Frame 的模块数组、全局设置数组或 Worker 中心分支。
- Frame/API 不兼容、依赖缺失/循环、重复声明和迁移冲突必须在构建或启动阶段失败。
