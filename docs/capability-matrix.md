# 成熟系统共同能力矩阵

本矩阵来自 `Lingcoo-core-stack`、`lingcoo-edu-system` 和
`lingcoo-retail-system` 三个已运行项目的代码对照。目的不是选一个项目整套复制，而是识别稳定边界、保留已验证的实现经验，并排除行业模型。

## 工程与 UI

| 能力                     | Core            | Edu                 | Retail                  | Frame 决策                            |
| ------------------------ | --------------- | ------------------- | ----------------------- | ------------------------------------- |
| Fastify + TypeScript API | 是              | 是                  | 是                      | 保留                                  |
| React + Vite             | 管理后台        | 公共 Web + 管理后台 | 商城 Web + 管理后台     | 保留双 Web 入口                       |
| 单镜像运行               | 是              | 是                  | 多镜像                  | Frame 保持单镜像                      |
| npm workspace            | 否              | 否                  | 是                      | Frame 采用 workspace 共享包           |
| Design Tokens            | 后台 CSS Tokens | 后台 CSS Tokens     | 独立 `design-tokens` 包 | 提炼为 `@lingcoo/frame-design-tokens` |
| 通用 UI 包               | 后台内部组件    | 后台内部组件        | 独立 `ui` 包            | 提炼为 `@lingcoo/frame-ui`            |
| Button / Input / Dialog  | Radix/shadcn    | Radix + 简化组件    | 独立可复用组件          | 统一到 Frame UI                       |
| DataTable                | 是              | 是                  | 是                      | 第二批提炼，保留查询状态扩展点        |
| Confirm Dialog           | 是              | 是                  | 是                      | 第二批提炼为 Promise API              |
| Toast                    | 是              | 是                  | 是                      | 第二批提炼                            |
| 公共页面块               | Core 内容页     | Edu 内容与营销块    | Retail 商城组件         | 只抽布局和反馈，不抽业务区块          |

结论是：

```text
Edu 的运行形态 + Retail 的共享包边界 + Core 的系统能力深度
```

## 系统基础能力

| 能力                 | Core           | Edu                | Retail          | 可抽象程度                       |
| -------------------- | -------------- | ------------------ | --------------- | -------------------------------- |
| Cookie/JWT 会话      | 是             | 是                 | 是              | 高                               |
| 用户身份             | 平台用户       | 机构成员/家长等    | 管理员/买家分离 | 共享身份内核，主体类型由业务扩展 |
| RBAC                 | 用户角色与权限 | 账号角色与教师权限 | 管理员权限      | 高，但资源枚举不能带行业含义     |
| 系统设置             | 是             | 是                 | 是              | 高                               |
| AES-256-GCM 设置加密 | 是             | 是                 | 是              | 很高，三套实现同源               |
| 操作审计             | 完整           | 局部               | 局部            | 共享写入协议，事件内容由业务提供 |
| Worker/Redis         | 是             | 是                 | 非统一          | 作为可选能力，不进入最小运行内核 |

## 外部集成

| 模块     | Core                          | Edu                | Retail           | Frame 边界                                  |
| -------- | ----------------------------- | ------------------ | ---------------- | ------------------------------------------- |
| SMTP     | 配置、加密、测试、发送        | 配置、加密、发送   | 配置、加密、发送 | Transport、模板输入、发送记录和测试         |
| 七牛云   | 完整设置与图片字段            | 完整设置与图片字段 | 设置与上传       | Storage Provider、上传凭证、文件元数据      |
| 支付宝   | Billing Provider              | Payment Provider   | Payment Provider | Provider Adapter，不包含商品和订单          |
| 微信支付 | Billing Provider              | Payment Provider   | Payment Provider | Provider Adapter、回调验签、查询和退款      |
| AI Hub   | OpenRouter Provider、用量事件 | 无                 | 无               | 采用 Provider 模型，按 Frame 规划进入基础层 |

支付模块不能包含商品、课程、会员、行业订单状态机、购买页面或收货信息。它应该包含支付渠道配置与加密、统一支付意图、回调验签与幂等、渠道查询、退款接口和支付事件。

## 提炼顺序

1. `design-tokens` 与 `ui` 共享包
2. 认证、会话和 RBAC
3. 系统设置、加密与审计
4. SMTP
5. Storage Hub（首个 Provider 为七牛云）
6. Payment Hub（支付宝、微信支付）
7. AI Hub（首个 Provider 为 OpenRouter）
8. 官网项目复制验证

每一层都必须满足：没有行业术语、默认关闭外部服务、没有凭据时仍可运行、具备明确健康状态和测试。
