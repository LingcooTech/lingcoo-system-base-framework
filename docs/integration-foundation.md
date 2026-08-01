# 外部集成基础

## 1. 目标与边界

集成基础层解决所有外部服务共有的问题：

- Provider 能力与配置字段如何声明
- 普通配置和敏感凭据如何分离
- 凭据如何加密、更新且不回传
- 连接何时可以启用
- 连通性测试和后续业务调用如何审计
- 管理后台如何根据 Provider 契约生成配置入口

它不直接承载行业业务，但通过具体 Provider 实现邮件、对象存储、支付协议和模型调用。目前已安装
SMTP、七牛云、支付宝、微信支付 API v3 和 OpenRouter。

## 2. 组成

```text
Provider Manifest
  ├─ code / version / category
  ├─ capabilities
  ├─ configFields          可回传的普通配置
  └─ credentialFields      只写的敏感配置
            │
            ▼
Integration Connection
  ├─ config                JSONB 明文业务配置
  ├─ encryptedCredentials  AES-256-GCM envelope
  ├─ credentialKeys        只暴露已配置字段名
  ├─ enabled
  └─ last test result
            │
            ▼
Provider Adapter
  ├─ validate
  ├─ testConnection
  └─ 后续能力方法
            │
            ▼
Integration Event + Audit Log
```

`IntegrationProviderRegistry` 是进程内注册表。Provider 必须由代码显式注册，数据库中的
`provider_code` 不能动态加载任意代码。

## 3. 安全约束

### 凭据

- `SETTINGS_ENCRYPTION_KEY` 只从运行环境读取，至少 32 个字符。
- 凭据以带版本号的 AES-256-GCM envelope 写入数据库。
- API 只返回 `credentialKeys`，永远不返回密文 envelope 或解密后的值。
- 更新凭据采用字段级合并；空字符串或 `null` 表示删除该字段。
- 日志和系统审计只记录字段名及变更事实，不记录字段值。
- Provider 测试错误在返回前会对已知凭据值做二次脱敏。

### 启用状态

新连接默认停用。只有当前配置完成成功的连通性测试后才能启用。普通配置或凭据发生变化时：

1. 连接自动停用；
2. 旧测试结果失效；
3. 必须使用新配置重新测试；
4. 测试成功后才能再次启用。

这可以避免服务继续使用未经验证的新密钥或新端点。

### 审计

连接创建、修改和测试结果写入共享 `audit_logs`。每次连通性测试还会写入
`integration_events`，保存操作、结果、耗时和非敏感诊断信息。后续 Provider 的发送、上传、
支付和模型调用必须复用同一执行审计约定。

## 4. 数据表

- `integration_connections`：连接实例、普通配置、加密凭据、启用状态和最近测试结果。
- `integration_events`：连接级操作结果，当前保留最近事件查询接口。
- `audit_logs`：面向系统管理员的跨模块操作审计。

删除连接能力当前刻意不开放，防止在业务模块开始引用连接后误删配置。未来如需删除，应先加入
引用检查或归档状态。

## 5. API

| 方法    | 路径                                                 | 权限                 | 用途           |
| ------- | ---------------------------------------------------- | -------------------- | -------------- |
| `GET`   | `/api/integrations/providers`                        | `integrations.read`  | Provider 目录  |
| `GET`   | `/api/integrations/connections`                      | `integrations.read`  | 连接列表       |
| `POST`  | `/api/integrations/connections`                      | `integrations.write` | 新建连接       |
| `PATCH` | `/api/integrations/connections/:connectionId`        | `integrations.write` | 更新或启停连接 |
| `POST`  | `/api/integrations/connections/:connectionId/test`   | `integrations.write` | 连通性测试     |
| `GET`   | `/api/integrations/connections/:connectionId/events` | `integrations.read`  | 最近 50 条事件 |

连通性测试有独立的每分钟限流，避免误操作形成外部请求洪峰。

## 6. 实现一个 Provider

Provider 适配器实现 `IntegrationProvider`：

```ts
const provider: IntegrationProvider = {
  code: 'example',
  name: 'Example Service',
  category: 'developer',
  description: 'Example adapter',
  adapterVersion: '1.0.0',
  capabilities: ['connection.test'],
  configFields: [{ key: 'endpoint', label: 'Endpoint', type: 'url', required: true }],
  credentialFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
  async testConnection({ config, credentials, signal }) {
    // 只返回适合管理员查看的非敏感结果。
    return { message: '连接正常' };
  },
};
```

然后在 `createIntegrationProviderRegistry` 中显式注册。安装适配器后，管理后台会根据字段声明自动
提供连接表单，无需再次开发凭据展示和状态控制。

## 7. 当前 Provider 目录

生产环境显式注册 SMTP、七牛云、支付宝、微信支付和 OpenRouter 五个适配器，均可创建、测试并
启用真实连接。具体边界见 [SMTP Provider](smtp-provider.md) 与
[通用 Provider 适配器](shared-providers.md)。自动化测试环境额外注册诊断 Provider，用于覆盖创建、
加密、测试、启用、凭据轮换和失败审计的完整生命周期。
