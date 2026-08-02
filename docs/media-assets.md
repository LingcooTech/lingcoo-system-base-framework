# 文件与媒体资产中心

## 定位

七牛云 Provider 负责服务商协议，`assets` 模块负责系统自己的文件身份和生命周期。它不包含商品图、
课程封面、文章附件等业务字段；这些领域只通过 `assetId` 引用资产。

成熟系统共同采用“浏览器直传 + 云对象列表”模式。Frame 保留直传以避免文件流经过 API，同时补上
原实现缺少的对象复核、稳定 ID、引用保护、归档和可靠删除。

## 上传协议

1. 管理端提交文件名、浏览器 MIME、字节数、可见性和已启用的七牛连接。
2. API 创建 `pending` 资产，并签发 15 分钟上传凭证。对象键由服务端生成；策略禁止覆盖，并限制
   最大字节数和 MIME 类型。
3. 浏览器使用凭证直接上传七牛云，不把文件内容发送给 Frame API。
4. 浏览器调用完成接口。API 使用 `statObject()` 从七牛重新读取哈希、实际大小和 MIME，不采信客户
   端回报；核验后资产进入 `active`。
5. 未完成的意图在凭证过期后由 Worker 幂等删除可能残留的对象，并标记为 `failed`。

单文件上限当前为 100 MiB。后续行业系统需要大视频分片上传时，应扩展 Storage Provider 契约，
不应绕过资产记录直接落裸 URL。

## 引用与生命周期

`storage_asset_references` 使用 `ownerType + ownerId + field` 表达一个领域字段当前引用的资产。同一字段
替换资产时使用 upsert 指向新 `assetId`。引用写入与删除请求都会锁定资产行，避免“检查时无引用，
随后又新增引用”的竞态。

生命周期为：

```text
pending → active ⇄ archived → deleting → deleted
    └────────────────────────────→ failed
```

- `archived` 只影响资产管理状态，不破坏已有引用；
- 存在任何引用时拒绝删除；
- 删除请求与 `storage.asset.delete` 任务在同一事务中写入；
- Worker 删除云对象后才标记 `deleted`；七牛返回“对象不存在”也视为幂等成功；
- 私有资产不在列表 API 暴露固定 URL，每次按权限签发一小时临时地址。

## 权限

- `assets.read`：列表、统计、引用和访问地址；
- `assets.write`：创建/确认上传、修改资产信息和维护领域引用；
- `assets.manage`：归档、恢复和请求删除。

Viewer 默认只有读取权限；Owner、Administrator 和 Operator 拥有完整资产权限。

## 领域接入示例

领域事务创建或更新记录后，使用稳定的三元组声明引用：

```ts
await assets.linkReference(
  assetId,
  { ownerType: 'example.record', ownerId: record.id, field: 'cover' },
  actorId,
);
```

`ownerType` 是机器可读的领域资源类型，不应出现数据库表名或外部服务商名称。领域记录删除或移除
文件字段时同步解除引用，资产是否归档或删除仍由资产管理策略决定。
