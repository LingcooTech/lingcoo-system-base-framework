# 领域扩展指南

下面描述如何基于本框架开发一个具体系统。这里的“基于”是直接扩展框架代码，而不是先运行一个生成器。

## 1. 定义领域边界

先用业务语言划分模块。例如零售系统可以有 `catalog`、`inventory` 和 `order`，教育系统可以有 `course`、`enrollment` 和 `learning`。

模块名应表达稳定的业务能力，不使用 `common`、`misc`、`data` 这类无法形成边界的名称。

## 2. 创建后端模块

在 `src/modules/<domain>` 中创建模块入口：

```ts
import type { AppModule } from '../types.js';

export const exampleModule: AppModule = {
  name: 'example',
  async register(app) {
    app.get('/api/example', async () => ({ items: [] }));
  },
};
```

然后在 `src/modules/index.ts` 显式注册。模块的数据表定义与迁移也应随该模块提交。

真实模块通常继续拆分：

- `contracts.ts`：输入输出的 Zod Schema 和类型
- `schema.ts`：领域数据表
- `repository.ts`：持久化查询
- `service.ts`：业务规则和事务
- `routes.ts`：HTTP 协议适配

路由不直接承载业务规则，Service 不依赖 Fastify Request 或 Reply。

领域中的封面、附件、音视频等字段应保存 `assetId`，并调用 `AssetService.linkReference()` 声明
`ownerType + ownerId + field` 引用。不要保存七牛对象键或永久复制公开 URL；读取时通过资产服务解析
访问地址。替换资产引用后，旧资产才能进入安全删除流程。

## 3. 增加前端页面

公共 Web 和管理后台保持独立入口，但使用相同的领域名称组织页面：

```text
public-web/src/features/example/
admin-ui/src/features/example/
```

管理后台优先复用现有的 Shell、PageFrame、ResourceSection、DataTable 和 StatusPill。领域组件留在自己的 feature 内；只有经过多个领域验证、没有业务含义的组件才上移到 shared。

## 4. 数据迁移

修改 Drizzle Schema 后生成迁移：

```bash
npm run db:generate
```

提交生成的 SQL，运行：

```bash
npm run db:migrate
```

已在任一环境应用的迁移不可修改。需要调整时新增下一个迁移文件。

## 5. 验证

一个领域模块完成时至少应满足：

```bash
npm run check
npm run build:all
```

并为关键业务规则增加 Service 单元测试，为 API 边界增加注入测试。需要数据库的集成测试使用独立测试库，不依赖开发数据。

## 6. 哪些代码应该回到基础框架

在具体系统中产生的代码，满足以下条件后才考虑回馈：

- 至少在两个不同领域或系统中以同样语义使用
- 不包含行业术语、业务枚举或特定流程
- 有稳定 API 和测试
- 上移后不会迫使所有系统接受不需要的依赖

先在业务中验证，再提炼为框架能力，可以避免基础层演变成所有历史需求的集合。
