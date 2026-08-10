# Frame 应用接入产品化实施方案

## 目标

Frame `0.7.1` 已经通过第一个独立生产应用验证了发布、安装、组合、迁移、CI、镜像和部署。2026-08-10
又完成了官网 Consumer 从 `0.7.1` 到 `0.7.2` 的保数据生产升级。开源治理已经完成；npmjs Stable 配置
已就绪，但 `@lingcootech` scope 处于名称释放等待期，当前继续使用 GitHub Packages Preview。本方案原定
产品化的标准生成器和真实跨版本升级两个环节均已落地，后续重点转为第二个差异化 Consumer 和规模化体验。

最终目标是让一个新的业务仓库通过一个初始化命令获得可运行、可测试、可部署、可升级的系统，同时
保留明确的安全和迁移门禁。

## 实施进展（2026-08-10）

阶段 A 和阶段 B 的仓库内 MVP 已完成：

- `templates/application` 成为唯一应用模板源，`@lingcootech/create-frame-app@0.7.2` 支持非交互创建、
  功能裁剪、版本一致性校验和受控升级。
- Generated Consumer 使用本次构建的九个真实 tarball，在独立临时目录完成安装、类型检查、测试、
  Admin/Web/System 生产构建和 Alpine 多阶段镜像构建；CI 有 PostgreSQL 时同时验证空库迁移。
- `lingcootech.frame.json` 及其 JSON Schema 已落地，八个运行时包必须保持精确同版本。
- Release 门禁已真实验证 `0.7.1 → 0.7.2`：旧版本迁移并写入数据哨兵，候选版本在同一 PostgreSQL
  数据库迁移，断言数据保留、账本增长和第二次迁移零变更。

- 官网升级 PR 已将八个运行时包和生成器统一升级到 `0.7.2`；CI、Alpine 镜像和生产部署通过。
- 生产迁移前后受保护数据计数均为 `accounts=1 inquiries=0 cms_entries=0 migrations=13`，13 条迁移均为
  `Already applied`，证明升级没有重建数据库或重放 SQL；Worker 与公网健康检查均通过。
- Consumer 升级 workflow 使用仓库 `GITHUB_TOKEN` 和 Package Actions Access，不保存长期 PAT。

尚未完成的是第二个差异化 Consumer、生产回滚演练和 GitHub Template Repository 镜像；这些属于阶段 C，
不阻塞 CLI 创建与升级应用。

## 实施原则

- 自动化必须使用真实 npm tarball 和独立 Consumer，不能依赖 Frame workspace 软链接。
- 模板、CLI、文档和 Frame 版本必须同源发布，不能形成四套独立维护的脚手架。
- 不使用 GitHub 未公开或不稳定的内部接口批量修改 Package Actions Access。
- 快速接入不能以把长期高权限 PAT 写入仓库或镜像为代价。
- 升级门禁必须包含真实 PostgreSQL 数据迁移，不能只验证 TypeScript 编译。
- 0.x 阶段只承诺文档明确列出的升级跨度；超出跨度必须逐版本升级或提供专用桥接工具。

## 改进一：标准应用模板和生成器

### 目标形态

在 Frame 仓库维护唯一模板源 `templates/application`，发布
`@lingcootech/create-frame-app` 生成器，并可从同一模板同步一个 GitHub Template Repository。CLI 和
GitHub Template 都不是第二份源码，只是同一模板的不同入口。

建议命令：

```bash
npm create @lingcootech/frame-app@0.7.2 my-system
```

首版只询问会影响代码结构的稳定选项：

- 项目目录、System ID、npm scope 和显示名称。
- 是否安装 CMS。
- 是否创建 Public Web。
- 本地端口和规范域名占位符。

数据库密码、Bootstrap Owner、JWT、加密密钥、registry Token、SSH Key 和云厂商凭据不得作为模板默认值。

### 生成内容

```text
apps/system          Server、Worker、Migration、System composition
apps/admin           Frame 默认后台 + 业务后台扩展
apps/web             Frame 公共壳 + 业务 Web 扩展（可选）
packages/domain      Manifest 到测试的最小垂直切片
.github/workflows    CI、Docker Verify、可选 Deploy 骨架
Dockerfile           BuildKit secret、非 root、只读运行约束
docker-compose.yml   本地 PostgreSQL
package-lock.json    与生成器版本一致的精确 Frame 版本
```

### 实施步骤

1. 从已验证的官网结构提炼无品牌、无云厂商、无域名的最小模板。
2. 将模板参数限制在结构化 JSON Schema，生成后执行名称、路径和包边界校验。
3. 生成器先支持非交互参数，交互模式只是其包装，保证 CI 可重复执行。
4. `packages:verify` 增加 Generated Consumer：在临时目录生成应用、安装本次构建 tarball、编译所有运行面。
5. CI 使用 PostgreSQL 17 对生成应用执行空库迁移、测试和生产构建。
6. Generated Consumer 在 Node 环境完成源码构建，并通过 Alpine/musl 生产镜像验证；Consumer CI 的
   Ubuntu runner 覆盖 glibc 原生依赖。
7. 发布 Frame 时同步发布同版本生成器；版本不一致时生成器直接拒绝。

### 验收标准

- 一个空目录在 15 分钟内变成可登录、带一个示例领域路由的本地系统。
- 生成结果不存在 Frame 相对路径、workspace 依赖、固定密码或真实品牌内容。
- 删除 CMS 选项后，不包含 CMS 代码、迁移、导航或运行时声明。
- 生成应用在隔离目录通过 `npm ci`、空库迁移、`check`、`build:all` 和 Docker build。
- 连续生成两次得到除时间戳外完全一致的结果。

## 分发状态：开源已完成，npmjs Stable 待 scope 释放

Frame 采用 Apache-2.0，源码仓库公开。八个运行时包和应用生成器声明相同许可证及公开 npmjs
`publishConfig`。等待期内 Consumer 使用 GitHub Packages Preview，仍需 `.npmrc`、`NODE_AUTH_TOKEN`、
BuildKit npm secret 和 Package Actions Access；scope 释放并完成首次 Stable 发布后再移除这些配置。

发布脚本按通道强制 Registry 和可见性，CI 检查开源治理文件、包许可证、源码链接和公开发布配置。
GitHub Packages 即使公开仍要求 Token，因此只作为预发布通道，不再承担开源 Consumer 的默认安装。

## 改进二：真实跨版本升级门禁

### 目标形态

Frame 的 Release workflow 在发布 Stable/Preview 前，同时验证：

```text
当前候选版本 → 空库安装
上一受支持版本 → 写入数据哨兵 → 当前候选版本迁移 → 新运行时验证
```

Consumer 侧使用一个版本清单和升级命令统一更新八个 Frame 运行时包及同版本生成/升级工具，避免手工
版本漂移。

### 版本清单和升级命令

生成应用包含 `lingcootech.frame.json`：

```json
{
  "schemaVersion": 1,
  "frameVersion": "0.7.2",
  "channel": "preview",
  "registry": "github",
  "features": { "cms": true, "web": true }
}
```

建议命令：

```bash
npx @lingcootech/create-frame-app upgrade 0.8.0
```

升级命令负责：

1. 校验目标版本和允许的升级跨度。
2. 同步八个 Frame 运行时依赖和 `create-frame-app` 工具；Linux 原生可选依赖由模板维护并在构建门禁
   验证。
3. 更新 Manifest 的 Frame SemVer 范围。
4. 重新生成 lockfile。
5. 升级前要求人工阅读目标版本的 Release Notes 和迁移风险；自动链接将在阶段 C 补齐。
6. 不自动执行生产迁移、不修改已应用 SQL、不自动提交 Git。

### Release 升级测试

1. 在临时 Consumer 中安装上一受支持的已发布版本。
2. 启动 PostgreSQL 17，运行该版本的 Core 和一方扩展迁移。
3. 创建账号、权限、设置、任务、CMS 内容、资产元数据和领域数据哨兵。
4. 换装当前候选 tarball，使用同一数据库运行 `runSystemMigrations()`。
5. 验证旧数据、权限和 checksum 账本不变，新迁移只增加 canonical 记录。
6. 使用新版本启动 API/Worker，执行登录、公开页面、Admin Registry 和任务处理 smoke test。
7. 构建 Admin/Web 和 Alpine 镜像。
8. 对同一候选版本再次迁移，验证幂等。

0.x 阶段建议只保证“上一 Preview/Stable → 当前版本”的直接升级。跨多个未验证版本时，CLI 要求逐个升级。
破坏性 Schema 变化采用 expand/contract：先增加兼容结构并双读/双写，下一版本迁移数据，最后一个版本才
删除旧结构。数据库默认不提供 Down Migration，应用回滚能力必须在发布前单独验证。

### Consumer 升级试点

第一个升级目标使用官网系统，以下流程已在 `0.7.1 → 0.7.2` 完成：

1. Frame 发布下一 Preview。
2. 官网升级 workflow 统一更新八个 Frame 包和 lockfile，并创建升级 PR。
3. PR CI 执行版本一致性、类型、测试、Lint、生产构建和 Alpine 镜像验证。
4. 合并后在现有生产数据库执行迁移；部署前后自动比较账号、询盘、CMS 内容和迁移账本计数。
5. 验证 Worker、公开站点和数据库健康状态。

试点同时暴露并修复了两个 Consumer 自动化问题：提交升级结果时必须暂存所有 workspace 的
`package.json`，不能只暂存根清单；通过 SSH stdin 发送部署脚本时必须先在远端完整落盘再执行，避免
Compose 子进程消费后续脚本内容。两项均属于应用工作流问题，不需要复制或修改 Frame 源码。

第二个结构不同的业务系统完成同一升级后，才把该升级跨度标记为“多应用验证”。

### 验收标准

- Release 不能在空库或上一版本升级任一测试失败时发布。
- 数据哨兵、迁移账本和 Extension Runtime Metadata 有自动断言。
- Consumer 不可能提交 Frame 包混合版本而通过 CI。
- 同一数据库重复运行迁移结果为零新增、零变更。
- 官网完成至少一次 Canary → Preview/Stable 的生产升级且无需重建数据库。

## 分阶段执行顺序

### 阶段 A：接入基础

1. 新增 `templates/application` 和非交互生成器 MVP。
2. 新增 Generated Consumer tarball 验证。
3. scope 等待期默认使用 GitHub Packages Preview；npmjs 首次发布后切换为 Stable 且不生成 Token 配置。

阶段 A 完成后，新应用创建不再需要复制已有项目。

### 阶段 B：升级门禁

1. 定义 `lingcootech.frame.json` Schema 和同版本校验器。
2. 实现升级命令，但先只输出/修改文件，不接触数据库。
3. Release CI 增加上一版本数据库升级 Fixture 和数据哨兵。
4. 使用官网完成首个真实升级 PR。

### 阶段 C：规模化

1. 增加 GitHub Template 镜像和更多生成选项，但保持同一模板源。
2. 接入第二个差异化业务系统并完成生成、部署、升级验证。
3. 根据两个真实 Consumer 的反馈收敛公共 API 和支持矩阵。

## 完成定义

剩余两个改进点只有在以下端到端场景全部自动通过后才算完成：

```text
空目录
→ 生成应用
→ 安装真实发布包
→ 空库迁移
→ 本地登录和业务示例
→ CI
→ Alpine 镜像
→ Preview 部署
→ Frame 下一版本升级
→ 数据保留和幂等验证
```

仅增加模板目录或版本更新脚本，不构成“已经产品化”。
