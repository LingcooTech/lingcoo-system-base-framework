# 通用 Provider 适配器

Frame 将成熟系统反复使用的外部服务拆成五个独立适配器。适配器只负责服务商协议，不包含课程、
商品、会员、行业订单或业务状态机。

| Provider   | 连接测试（无业务副作用）       | 可复用能力                                       |
| ---------- | ------------------------------ | ------------------------------------------------ |
| SMTP       | 建立连接并执行账号认证         | 邮件发送                                         |
| 七牛云     | 签名读取一个对象列表页         | 上传凭证、列表、删除、私有 URL                   |
| 支付宝     | RSA2 查询一个不存在的测试订单  | 网站支付、当面付、查询、退款、异步通知验签       |
| 微信支付   | API v3 证书查询及平台响应验签  | Native 支付、查询、退款、回调验签和 AES-GCM 解密 |
| OpenRouter | 获取模型目录并确认默认模型存在 | 模型目录、聊天补全、token 用量                   |

所有连接都复用 `IntegrationService` 的生命周期：敏感凭据 AES-256-GCM 加密、保存后不回传、
当前配置测试通过后才能启用、配置变化自动停用、每次调用写入连接事件与系统审计。

## 七牛云

普通配置包括 AccessKey、空间名称、HTTPS 资源域名、上传域名和默认对象前缀；SecretKey 是加密凭据。
`QiniuService` 提供：

- `createUploadToken()`：签发 60 秒至 24 小时有效的、精确到对象键的上传凭证；
- `listObjects()`：按默认前缀或指定前缀分页读取对象；
- `statObject()`：从服务端核验对象哈希、大小和 MIME 类型；
- `deleteObject()`：删除明确指定的对象；
- `createPrivateUrl()`：签发短期私有下载地址。

管理 API 提供对象列表、上传凭证、私有 URL 和单对象删除。上传本身由浏览器或业务服务直传七牛，
避免文件流无谓经过 Frame API。

领域模块不应直接使用上述管理 API 保存裸 URL。框架的 `assets` 模块在 Provider 之上提供上传意图、
对象复核、统一资产 ID、引用保护和异步删除；见 [文件与媒体资产中心](media-assets.md)。

## 支付宝和微信支付

`PaymentService` 是领域模块调用的统一入口，支持 `prepare()`、`query()`、`refund()` 以及两个渠道的
通知验签。金额统一使用人民币“分”的安全整数，领域模块负责支付意图、订单关联、通知幂等和最终
业务状态流转。

支付能力没有暴露通用管理后台下单接口。连接页面的“测试”不会创建交易或产生扣款。业务项目应当：

1. 创建自己的支付意图并生成唯一订单号；
2. 调用 `PaymentService.prepare()` 获取跳转地址或二维码内容；
3. 在自己的公开回调路由中保留原始请求体，调用通知验签；
4. 以服务商事件 ID 建立唯一约束，事务性更新支付意图与业务订单；
5. 对超时或不确定状态使用 `query()` 主动核对。

支付宝使用官方 `alipay-sdk` 和 RSA2。微信支付只实现 API v3，不继承成熟项目中旧的 v2 XML/MD5
兼容代码；API 响应和回调都验证平台签名，回调资源使用 32 字节 API v3 密钥解密。

## OpenRouter

普通配置包括官方 API 地址、站点来源、站点名称和默认模型；API Key 是加密凭据。
`OpenRouterService` 提供模型目录与非流式聊天补全，调用事件只记录模型名、完成原因与 token 用量，
不把提示词或模型回复写入审计。管理后台“模型测试”会产生一次真实模型调用和少量费用，因此只有
已启用连接可以使用，并限制为每分钟五次。

## 管理 API

```text
GET    /api/integrations/connections/:id/qiniu/objects
POST   /api/integrations/connections/:id/qiniu/upload-token
POST   /api/integrations/connections/:id/qiniu/private-url
DELETE /api/integrations/connections/:id/qiniu/object
GET    /api/integrations/connections/:id/openrouter/models
POST   /api/integrations/connections/:id/openrouter/chat-test
```

支付服务不提供上述形式的管理 API；它作为领域服务被行业系统的订单与支付模块调用。
