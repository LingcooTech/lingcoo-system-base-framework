# 基于 Frame 的应用全生命周期

本文定义业务系统从独立仓库初始化、安装 Frame、开发领域扩展、完成质量验证到生产部署的当前标准流程。
它记录的是已经由 `lingcoo-official-website-system` 在 Frame `0.7.1` 上走通的真实链路，不是只在本
仓库 workspace 软链接中成立的示例。

## 1. 基本原则

- Frame 与业务应用使用独立 Git 仓库和独立发布节奏。
- 应用通过不可变 npm 版本消费 `@lingcootech/frame*`，不复制 Frame 源码，不使用 Git submodule，
  不从 Frame 仓库导入相对路径。
- `apps` 只负责 API、Worker、Admin、Web 和迁移的组合入口；领域实现位于应用自己的 `packages`。
- API、Worker 和迁移入口必须使用同一个 `DefinedSystem`。
- Frame、第一方扩展和领域扩展分别拥有 Migration Source；已经应用的 SQL、ID、checksum 和 Legacy
  Alias 不可修改。
- Secret 只来自本地环境、CI Secret 或生产环境文件，不写入模板、仓库、镜像层或前端产物。

## 2. Frame 发布边界

当前内部 Preview 由以下八个包组成：

```text
@lingcootech/frame
@lingcootech/frame-admin
@lingcootech/frame-cms
@lingcootech/frame-database
@lingcootech/frame-design-tokens
@lingcootech/frame-extension-sdk
@lingcootech/frame-ui
@lingcootech/frame-web
```

Frame 使用 Changesets 统一版本并发布到 GitHub Packages。Consumer 必须锁定明确版本并提交
`package-lock.json`，不能让生产环境跟随 `latest`、`preview` 或 `canary` dist-tag。完整公开入口与发布
规则见 [0.7 Package Contracts](package-contracts.md)。

## 3. 创建独立应用仓库

推荐的最小结构如下：

```text
apps/
  system/                 API、Worker、迁移组合入口
  admin/                  Frame Admin 与业务后台组合入口
  web/                    Frame Web 与业务公共站点组合入口
packages/
  example-extension/      应用领域扩展
.github/workflows/
Dockerfile
docker-compose.yml
docker-compose.prod.yml
package.json
package-lock.json
```

根 workspace 只声明应用自己的 `apps/*` 和 `packages/*`。Frame 包是 registry 依赖，不进入 workspace。
应用包使用自己的 scope 或稳定包名，不能冒充 Frame 公共包。

## 4. 安装私有 Frame 包

应用仓库提交以下 `.npmrc`，但不提交 Token：

```ini
@lingcootech:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

本地开发使用具有 `read:packages` 的 classic PAT：

```bash
export NODE_AUTH_TOKEN="$(gh auth token)"
npm ci
```

GitHub Actions 使用两种受支持模式之一：

1. 给 Consumer 仓库授予八个包的 `Manage Actions access: Read`，CI 使用仓库自己的
   `GITHUB_TOKEN`。这是没有长期共享 Token 的安全模式。
2. CI 使用专用机器账号的只读 `FRAME_PACKAGES_TOKEN`。这是私有包阶段的快速接入模式，但必须限制
   Token 权限、可见仓库、使用位置并建立轮换流程。

GitHub npm registry 即使包是 public，通常仍要求 PAT 或 `GITHUB_TOKEN`；只有将公共包发布到 npmjs
等允许匿名安装的 registry，才能真正取消 npm 安装认证。GitHub 官方权限说明见
[About permissions for GitHub Packages](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)。

Docker 构建通过 BuildKit secret mount 传入 Token。Dockerfile 不应使用 `ARG` 或 `ENV` 持久化 npm
Token，并应在最终镜像中检查不存在 `.npmrc`。

## 5. 组合应用系统

应用在一个稳定模块中声明全部已安装扩展：

```ts
import { frameCmsExtension } from '@lingcootech/frame/cms';
import { frameCoreExtension } from '@lingcootech/frame/extensions';
import { defineSystem } from '@lingcootech/frame-extension-sdk';
import { exampleExtension } from '@example/example-extension';

export const system = defineSystem({
  id: 'example-system',
  version: '0.1.0',
  extensions: [frameCoreExtension, frameCmsExtension, exampleExtension],
});
```

四个 Node 入口围绕同一 `system` 工作：

- Server：`buildApp(env, { system })`。
- Worker：`createFrameWorker(env, { system })`。
- Migration：`runSystemMigrations({ connectionString, system })`。
- Runtime Metadata：由同一 System 输出扩展、版本和迁移状态。

Admin 和 Web 分别投影 Manifest，只安装各自浏览器运行面，不能把 Server、Worker、Migration、SQL、
数据库 Schema 或 Secret 处理代码带入 Vite 构建。

## 6. 开发领域扩展

每项业务能力按完整垂直切片交付：

```text
Manifest
→ Migration
→ Schema
→ Repository/Service
→ API
→ Permission
→ Audit/Event
→ Worker
→ Admin/Web UI
→ Test
```

推荐目录和跨扩展约束见 [领域扩展指南](domain-extension.md)。关键规则如下：

- Manifest 是路由、权限、Job、Topic、Migration、Admin/Web Contribution 的声明来源。
- 路由只适配 HTTP，业务规则进入 Service；Service 不依赖 Fastify Request/Reply。
- 权限由迁移写入数据库，不能靠启动时隐式同步。
- 跨扩展协作使用公开 Service Port 或事务 Outbox，不直接读取其他扩展的私有表。
- 领域迁移使用稳定 Source ID，例如 `official-site/0001_initial.sql`。

## 7. 本地开发

环境要求为 Node.js 22+、PostgreSQL 17+ 和 Docker Compose。典型启动过程：

```bash
cp .env.example .env
# 设置 DATABASE_URL、AUTH_JWT_SECRET、SETTINGS_ENCRYPTION_KEY，
# 以及本环境唯一的 AUTH_BOOTSTRAP_EMAIL / AUTH_BOOTSTRAP_PASSWORD。

NODE_AUTH_TOKEN=... npm ci
docker compose up -d postgres
npm run build:packages
npm run db:migrate

npm run dev:api
npm run dev:worker
npm run dev:web
npm run dev:admin
```

Bootstrap Owner 只允许在账号表为空时创建，密码必须至少 12 位并在首次登录后强制修改。仓库和模板不得
提供固定生产密码。

## 8. 提交前与 CI 门禁

应用至少提供以下统一命令：

```bash
npm run check
npm run build:all
npm audit --omit=dev --audit-level=high
```

CI 必须从全新 checkout 和空 PostgreSQL 开始，依次执行：

```text
npm ci
→ 构建本地领域包
→ runSystemMigrations（Frame + 一方扩展 + 领域扩展）
→ typecheck
→ test
→ lint
→ Admin/Web production build
→ production dependency audit
```

在 macOS 生成 lockfile 时，npm 可能遗漏 Rollup、Lightning CSS、Tailwind Oxide 等 Linux 原生可选包。
Consumer 模板和 CI 必须同时覆盖 Ubuntu glibc 与 Alpine musl 构建，不能把 macOS 本地成功当成生产构建
证据。

## 9. 镜像与生产部署

推荐部署链路：

```text
push main
→ CI
→ 使用 BuildKit secret 构建 Alpine 运行镜像
→ 推送主镜像 registry
→ 可选镜像到第二 registry
→ SSH/平台部署
→ 拉取精确 Git SHA 镜像
→ runSystemMigrations
→ 启动 API、Worker、反向代理
→ Worker health check
→ 公网 /ready
```

生产服务器不运行 `npm install`，也不从源码构建。运行镜像使用非 root 用户、只读文件系统、tmpfs、
`no-new-privileges` 和 `cap_drop: ALL`。迁移必须在切换 API/Worker 前完成；失败时不得继续启动新版本。

数据库默认只向前迁移。删除生产数据必须有独立的显式确认机制、精确卷或数据库校验，并与普通部署入口
隔离。

## 10. 升级 Frame

应用升级时不拉取 Frame Git 源码，而是执行以下流程：

1. 将全部 `@lingcootech/frame*` 更新到同一个明确版本。
2. 重新生成并提交 lockfile。
3. 在空库执行完整迁移和生产构建。
4. 从受支持旧版本创建数据库，写入数据哨兵，再执行新版本迁移。
5. 验证数据、权限、登录、Worker、Admin/Web 与运行元数据。
6. 构建与生产一致的 Linux 镜像。
7. 先使用 Canary/Preview 验证，再升级 Stable。

已应用迁移 checksum 不匹配必须阻止部署。官网从旧复制式项目迁入时，Frame 正确拒绝了内容不同的
`0008_presentation.sql` Legacy Alias；在无历史数据的前提下选择了显式重建，而不是篡改迁移账本。

## 11. 当前打通状态

`lingcoo-official-website-system` 已验证以下完整链路：

| 环节                                      | 状态     |
| ----------------------------------------- | -------- |
| Frame Preview 发布                        | 已打通   |
| 独立仓库安装八个私有包                    | 已打通   |
| Core、CMS、领域扩展组合                   | 已打通   |
| 空库完整迁移                              | 已打通   |
| API、Worker、Admin、Web                   | 已打通   |
| Ubuntu CI 与 Alpine 生产构建              | 已打通   |
| ACR/GHCR 镜像发布、服务器迁移和健康检查   | 已打通   |
| 自动创建新应用                            | 尚未自动 |
| 单动作完成私有包授权                      | 尚未自动 |
| 从上一 Frame 版本升级到下一版本的真实验证 | 尚未验证 |

因此，当前端到端技术链路已经可用；应用创建、私有包接入和跨版本升级仍需按
[应用接入产品化实施方案](application-adoption-plan.md) 继续自动化。
