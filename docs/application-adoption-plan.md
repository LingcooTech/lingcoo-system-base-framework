# Frame 应用接入产品化实施方案

## 目标

Frame `0.7.1` 已经通过第一个独立生产应用验证了发布、安装、组合、迁移、CI、镜像和部署。下一阶段不是
增加更多 Core 功能，而是把以下三个仍依赖人工经验的环节产品化：

1. 新应用没有标准生成器，需要手工创建目录和入口。
2. 私有 GitHub Packages 需要对八个包逐一授予 Consumer Actions 权限。
3. 尚未真实验证从一个已发布 Frame 版本升级到下一个版本。

最终目标是让一个新的业务仓库通过一个初始化命令和一次凭据配置获得可运行、可测试、可部署、可升级
的系统，同时保留明确的安全和迁移门禁。

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
npm create @lingcootech/frame-app@0.7.1 my-system
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
6. Docker Verify 同时覆盖 Ubuntu/glibc 和 Alpine/musl 原生依赖。
7. 发布 Frame 时同步发布同版本生成器；版本不一致时生成器直接拒绝。

### 验收标准

- 一个空目录在 15 分钟内变成可登录、带一个示例领域路由的本地系统。
- 生成结果不存在 Frame 相对路径、workspace 依赖、固定密码或真实品牌内容。
- 删除 CMS 选项后，不包含 CMS 代码、迁移、导航或运行时声明。
- 生成应用在隔离目录通过 `npm ci`、空库迁移、`check`、`build:all` 和 Docker build。
- 连续生成两次得到除时间戳外完全一致的结果。

## 改进二：私有包接入从八次授权降为一次配置

### 已确认的约束

GitHub npm registry 支持包级细粒度权限，但 Consumer 的 `GITHUB_TOKEN` 必须被每个包显式授予 Actions
Read。GitHub 官方文档同时允许使用 classic PAT 安装其他私有仓库关联的包。GitHub Packages 没有公开、
稳定的“批量给多个 npm 包添加 Actions 仓库访问”的 REST 契约，因此首版不应依赖网页自动化或未公开
API。

参考：

- [About permissions for GitHub Packages](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages)
- [REST API endpoints for packages](https://docs.github.com/en/rest/packages/packages)

### 双模式方案

#### A. 独立 GITHUB_TOKEN 模式

保留当前最小权限方案：给 Consumer 仓库授予八个包的 Actions Read，不保存共享 PAT。增加
`frame packages verify-access` 命令，一次检查八个包并输出缺失包的准确设置链接和期望角色。

该模式适合安全要求高、Consumer 数量少的阶段。

#### B. 只读机器账号 Token 模式（当前推荐的快速接入方案）

1. 创建不参与日常开发的 GitHub 机器账号。
2. 只给它八个 Frame 包的 Read 权限。
3. 创建仅含 `read:packages` 的 classic PAT，不附加 `write:packages`、`delete:packages`。
4. Consumer 仓库只配置一个 Secret：`FRAME_PACKAGES_TOKEN`。
5. CI 将其映射到 `NODE_AUTH_TOKEN`；Docker 只通过 BuildKit secret 使用。
6. 记录 Token owner、创建时间、使用仓库和轮换时间；泄漏时可一次吊销。

如果后续把代码和包转移到真正的 GitHub Organization，可以把同一只读 Token 配置为选定仓库可用的
Organization Actions Secret，减少逐仓库 Secret 写入。机器账号不得拥有 Frame 源码写权限或生产部署
权限。

### 长期出口

若 Frame 完成开源治理并决定公开分发，应将 Stable 包发布到 npmjs。GitHub Packages 可继续保存
Canary/内部 Preview；公开 Stable 从 npmjs 匿名安装，才能同时消除本地 PAT、Actions Package Access 和
Docker npm Token。是否开源必须由许可证、支持策略、品牌和安全披露方案决定，不能只为绕过权限界面而
仓促执行。

### 验收标准

- 快速模式的新仓库只配置一个 Secret，即可安装全部 Frame 包。
- Token 不出现在 lockfile、Docker history、构建日志、镜像文件系统或前端产物。
- `verify-access` 能区分认证缺失、包不存在、版本不存在和仓库未授权。
- Token 撤销演练后，所有依赖它的构建可被准确定位并在完成轮换后恢复。
- Stable 公开分发启用后，全新环境可在没有 GitHub Token 的情况下执行 `npm ci`。

## 改进三：真实跨版本升级门禁

### 目标形态

Frame 的 Release workflow 在发布 Stable/Preview 前，同时验证：

```text
当前候选版本 → 空库安装
上一受支持版本 → 写入数据哨兵 → 当前候选版本迁移 → 新运行时验证
```

Consumer 侧使用一个版本清单和升级命令统一更新八个 Frame 包，避免手工版本漂移。

### 版本清单和升级命令

生成应用包含 `lingcoo.frame.json`：

```json
{
  "frameVersion": "0.7.1",
  "channel": "preview",
  "extensions": {
    "cms": true
  }
}
```

建议命令：

```bash
npx @lingcootech/create-frame-app upgrade 0.8.0
```

升级命令负责：

1. 校验目标版本和允许的升级跨度。
2. 同步八个 Frame 依赖及对应的 Linux 原生可选依赖。
3. 更新 Manifest 的 Frame SemVer 范围。
4. 重新生成 lockfile。
5. 输出需要人工阅读的 Release Notes 和迁移风险。
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

第一个升级目标使用官网系统：

1. Frame 发布下一 Canary。
2. 自动创建官网升级 PR，八个 Frame 包保持同版本。
3. PR CI 同时执行空库和生产数据库脱敏副本升级。
4. Preview 环境验证后台登录、CMS、询盘、Worker 和公开站点。
5. 合并后观察部署与指标，再发布 Stable。

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
3. 新增 `verify-access`，并建立只读机器账号 Token 流程。
4. 在文档和模板中统一 `NODE_AUTH_TOKEN`/BuildKit secret 用法。

阶段 A 完成后，新应用创建和私有包安装不再需要复制已有项目或打开八个包页面。

### 阶段 B：升级门禁

1. 定义 `lingcoo.frame.json` Schema 和同版本校验器。
2. 实现升级命令，但先只输出/修改文件，不接触数据库。
3. Release CI 增加上一版本数据库升级 Fixture 和数据哨兵。
4. 使用官网完成首个真实升级 PR。

### 阶段 C：规模化与公开策略

1. 增加 GitHub Template 镜像和更多生成选项，但保持同一模板源。
2. 接入第二个差异化业务系统并完成生成、部署、升级验证。
3. 完成 LICENSE、SECURITY、CONTRIBUTING、支持版本和安全披露治理。
4. 决策是否开源并把 Stable 同步到 npmjs。

## 完成定义

三个改进点只有在以下端到端场景全部自动通过后才算完成：

```text
空目录
→ 生成应用
→ 一次凭据配置
→ 安装真实发布包
→ 空库迁移
→ 本地登录和业务示例
→ CI
→ Alpine 镜像
→ Preview 部署
→ Frame 下一版本升级
→ 数据保留和幂等验证
```

仅增加模板目录、权限说明或版本更新脚本，不构成“已经产品化”。
