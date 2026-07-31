# SMTP Provider

## 1. 能力

SMTP 是 Frame 安装的第一个生产 Provider，提供：

- SMTP 网络连接与账号认证验证
- 加密保存密码或服务商授权码
- 已启用连接的邮件发送能力
- 管理后台真实测试邮件
- 每次发送的结果、耗时和非敏感投递信息

它不包含验证码、密码找回、营销通知或行业邮件模板。这些内容由领域模块生成，再调用统一的
`SmtpService` 发送。

## 2. 配置

| 字段         | 类型     | 存储方式 | 说明                                       |
| ------------ | -------- | -------- | ------------------------------------------ |
| `host`       | 普通配置 | JSONB    | SMTP 主机，不包含协议和端口                |
| `port`       | 普通配置 | JSONB    | 1–65535，通常为 465 或 587                 |
| `secure`     | 普通配置 | JSONB    | 是否使用 465 风格的隐式 TLS                |
| `requireTls` | 普通配置 | JSONB    | 非隐式 TLS 时是否强制 STARTTLS             |
| `user`       | 普通配置 | JSONB    | SMTP 登录用户名                            |
| `from`       | 普通配置 | JSONB    | 默认发件地址，可使用 `名称 <邮箱>` 格式    |
| `password`   | 敏感凭据 | AES-GCM  | SMTP 密码或授权码，保存后不再通过 API 返回 |

默认端口为 465，`secure` 和 `requireTls` 默认开启。使用 587 时应关闭 `secure` 并保持
`requireTls` 开启。只有本地受信任的测试服务器确实不支持 TLS 时，才应关闭 `requireTls`。

## 3. 使用流程

1. 在“外部集成”中创建 SMTP 连接并保存配置；
2. 点击“测试”，执行真实 SMTP `verify()`；
3. 测试通过后启用连接；
4. 点击“发测试邮件”，验证完整投递链路；
5. 领域模块通过连接 ID 调用 `SmtpService.send()`。

配置或密码发生变化后，底座会自动停用连接并清除旧测试结果。重新测试并启用前，任何发送调用
都会被拒绝。

## 4. 安全

- 使用已修复已知高危公告的 Nodemailer 9。
- 连接、问候和 socket 均有超时，调用层还有统一 30 秒中止信号。
- 默认要求 TLS；不提供忽略服务端证书校验的配置。
- Nodemailer transport 和每封邮件都关闭文件访问与 URL 访问。
- 测试邮件 HTML 只由转义后的纯文本生成。
- 密码不会进入 API 响应、邮件事件或系统审计。
- 发送接口独立限流为每分钟 5 次。

## 5. API

通用连接创建、编辑、测试和启停继续使用集成基础 API。SMTP 新增：

```text
POST /api/integrations/connections/:connectionId/smtp/send-test
```

请求体：

```json
{
  "to": "recipient@example.com",
  "subject": "Lingcoo Frame SMTP 测试邮件",
  "text": "SMTP connection is ready."
}
```

连接必须属于 SMTP、处于启用状态，并且调用账号拥有 `integrations.write` 权限。
