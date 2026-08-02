# 运行可观测性

该模块提供每个行业系统都需要、但不携带行业语义的最小观测闭环：请求关联、结构化日志、服务
存活、请求指标和异常处置。它默认只依赖 PostgreSQL 与当前进程，不要求先部署监控平台。

## Request ID

API 接受格式安全、长度为 8–120 的 `x-request-id`，否则生成 UUID，并始终在响应头回传。该 ID
通过异步请求上下文进入统一审计写入和 5xx 异常记录，因此管理员可从一次失败响应定位异常分组，
再用同一 ID 查询相关操作。领域模块不自行生成另一套追踪字段。

## 日志与隐私边界

Fastify 日志对 Authorization、Cookie、密码、Token、Secret 和 API Key 字段做脱敏。Worker 使用
JSON 行日志；错误只输出安全化的名称和消息。异常表不会保存请求体、响应体、堆栈、数据库连接串
或 Provider 凭据。领域代码写日志时同样不得绕过这一边界。

## 心跳和异常

API 与 Worker 使用各自实例 ID 每 15 秒更新 `service_heartbeats`。45 秒内的 `healthy` 心跳视为新鲜；
容器健康检查仍负责进程级重启，持久化心跳用于后台统一查看。

API 5xx 与 Worker 执行失败会按“服务、类别、错误类型、方法、路由/任务类型”生成 SHA-256 指纹。
相同故障递增次数并刷新最近发生时间，不复制堆栈。管理员可以解决或重新打开异常，状态变更写入
审计日志。

## 指标

管理后台展示当前 API 实例的请求数、5xx、平均耗时、P95、内存和数据库延迟。进程内指标会随实例
重启归零，这是底座的有意边界；需要长期留存时，将 Prometheus 接到 `/metrics`。

```text
METRICS_BEARER_TOKEN=<at-least-24-random-characters>
```

令牌为空时接口返回 404；启用后接受 `Authorization: Bearer <token>` 或 `x-metrics-token`。令牌只从
部署环境注入，不进入系统设置或 Provider 连接。生产环境应在入口层进一步限制抓取来源。

Sentry、Grafana、云告警和 OpenTelemetry 不是默认依赖。后续适配器应消费现有 Request ID、日志与
指标协议，而不是改变领域模块。
