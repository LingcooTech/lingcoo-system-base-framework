import { Button } from '@lingcoo/frame-ui/button';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { Skeleton } from '@lingcoo/frame-ui/skeleton';
import { useToast } from '@lingcoo/frame-ui/toast';
import { useEffect, useState, type FormEvent } from 'react';

import {
  archiveAsset,
  completeAssetUpload,
  createAssetUploadIntent,
  deleteAsset,
  fetchAssets,
  fetchAssetAccessUrl,
  fetchAssetSummary,
  fetchIntegrationConnections,
  restoreAsset,
  uploadAssetFile,
  type AssetSummary,
  type IntegrationConnection,
  type StorageAsset,
} from '../api/client';
import { PageFrame } from '../components/shared/PageFrame';
import { useConfirm } from '../components/shared/ConfirmProvider';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { useAuth } from '../lib/auth';
import { sections } from '../lib/foundation';

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function assetTone(status: StorageAsset['status']) {
  return status === 'active'
    ? ('ok' as const)
    : status === 'failed'
      ? ('danger' as const)
      : status === 'pending' || status === 'deleting'
        ? ('warn' as const)
        : ('neutral' as const);
}

function statusLabel(status: StorageAsset['status']) {
  return {
    pending: '等待上传',
    active: '已启用',
    archived: '已归档',
    deleting: '删除中',
    deleted: '已删除',
    failed: '失败',
  }[status];
}

async function fetchPageData() {
  const [assetResult, summary, connections] = await Promise.all([
    fetchAssets(),
    fetchAssetSummary(),
    fetchIntegrationConnections(),
  ]);
  return { assetResult, summary, connections };
}

export function AssetsPage() {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [assets, setAssets] = useState<StorageAsset[]>([]);
  const [summary, setSummary] = useState<AssetSummary>({ status: {}, kind: {}, totalBytes: 0 });
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  function applyPageData(data: Awaited<ReturnType<typeof fetchPageData>>) {
    setAssets(data.assetResult.items);
    setSummary(data.summary);
    const qiniu = data.connections.filter(
      (connection) => connection.providerCode === 'qiniu' && connection.enabled,
    );
    setConnections(qiniu);
    setConnectionId((current) => current || qiniu[0]?.id || '');
    setError('');
    setLoading(false);
  }

  async function load() {
    try {
      applyPageData(await fetchPageData());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '媒体资产加载失败');
    }
  }

  useEffect(() => {
    fetchPageData()
      .then(applyPageData)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : '媒体资产加载失败');
      })
      .finally(() => setLoading(false));
  }, []);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || !connectionId) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      const intent = await createAssetUploadIntent({
        connectionId,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        byteSize: file.size,
        visibility,
      });
      await uploadAssetFile(intent, file);
      await completeAssetUpload(intent.asset.id);
      setMessage('文件已上传并通过云存储对象复核，现已进入资产库。');
      toast({ title: '资产上传完成', tone: 'success' });
      setFile(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '文件上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function operate(asset: StorageAsset, action: 'copy' | 'archive' | 'restore' | 'delete') {
    if (
      action === 'delete' &&
      !(await confirm({
        title: '删除媒体资产',
        description: `“${asset.displayName}”的云存储对象将由 Worker 异步删除。`,
        confirmLabel: '删除',
        tone: 'danger',
      }))
    ) {
      return;
    }
    setBusyId(asset.id);
    setError('');
    setMessage('');
    try {
      if (action === 'copy') {
        const url = await fetchAssetAccessUrl(asset.id);
        await navigator.clipboard.writeText(url);
        setMessage('资产访问地址已复制。');
      } else if (action === 'archive') {
        await archiveAsset(asset.id);
        setMessage('资产已归档，现有引用保持不变。');
      } else if (action === 'restore') {
        await restoreAsset(asset.id);
        setMessage('资产已恢复。');
      } else {
        await deleteAsset(asset.id);
        setMessage('删除任务已进入后台队列。');
      }
      await load();
      toast({ title: action === 'copy' ? '地址已复制' : '资产操作已完成', tone: 'success' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '资产操作失败');
    } finally {
      setBusyId('');
    }
  }

  return (
    <PageFrame section={sections.assets}>
      <div className="metric-grid access-metrics">
        <article className="metric-card">
          <span>已启用资产</span>
          <strong>{summary.status.active ?? 0}</strong>
          <small>已完成对象复核</small>
        </article>
        <article className="metric-card">
          <span>等待上传</span>
          <strong>{summary.status.pending ?? 0}</strong>
          <small>凭证过期后自动清理</small>
        </article>
        <article className="metric-card">
          <span>图片资产</span>
          <strong>{summary.kind.image ?? 0}</strong>
          <small>领域通过 assetId 引用</small>
        </article>
        <article className="metric-card">
          <span>存储用量</span>
          <strong>{formatBytes(summary.totalBytes)}</strong>
          <small>已启用资产合计</small>
        </article>
      </div>
      {message ? <p className="integration-notice success">{message}</p> : null}
      {error ? <p className="integration-notice error">{error}</p> : null}
      {hasPermission('assets.write') ? (
        <ResourceSection
          title="上传资产"
          description="浏览器直传七牛云；完成后由 API 重新查询对象信息，不信任客户端回报。"
        >
          <form className="asset-upload-form" onSubmit={upload}>
            <FormField label="存储连接" required>
              {({ controlId }) => (
                <select
                  className="integration-select"
                  id={controlId}
                  onChange={(event) => setConnectionId(event.target.value)}
                  required
                  value={connectionId}
                >
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="选择文件" required>
              {({ controlId }) => (
                <Input
                  id={controlId}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  required
                  type="file"
                />
              )}
            </FormField>
            <FormField label="访问方式" required>
              {({ controlId }) => (
                <select
                  className="integration-select"
                  id={controlId}
                  onChange={(event) => setVisibility(event.target.value as typeof visibility)}
                  value={visibility}
                >
                  <option value="public">公开地址</option>
                  <option value="private">临时签名地址</option>
                </select>
              )}
            </FormField>
            <Button
              disabled={!file || !connectionId || connections.length === 0}
              loading={uploading}
              type="submit"
            >
              上传并登记
            </Button>
          </form>
          {connections.length === 0 ? (
            <p className="auth-error">请先在外部集成中配置、测试并启用七牛云连接。</p>
          ) : null}
        </ResourceSection>
      ) : null}
      <ResourceSection
        title="媒体资源库"
        description="数据库保存稳定资产身份、对象校验信息和引用数量；云存储只负责保存文件。"
      >
        {loading ? (
          <div className="asset-grid" aria-label="正在加载媒体资产">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} shape="block" style={{ minHeight: 260 }} />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="asset-empty">暂无媒体资产</div>
        ) : (
          <div className="asset-grid">
            {assets.map((asset) => (
              <article className="asset-card" key={asset.id}>
                <div className="asset-preview">
                  {asset.mediaKind === 'image' && asset.publicUrl ? (
                    <img alt={asset.displayName} loading="lazy" src={asset.publicUrl} />
                  ) : (
                    <span>{asset.mediaKind.toUpperCase()}</span>
                  )}
                </div>
                <div className="asset-card-body">
                  <div className="asset-card-heading">
                    <strong title={asset.displayName}>{asset.displayName}</strong>
                    <StatusPill tone={assetTone(asset.status)}>
                      {statusLabel(asset.status)}
                    </StatusPill>
                  </div>
                  <small>{asset.mimeType}</small>
                  <small>
                    {formatBytes(asset.byteSize)} ·{' '}
                    {asset.visibility === 'public' ? '公开' : '私有'} · {asset.referenceCount}{' '}
                    个引用
                  </small>
                  <code title={asset.objectKey}>{asset.objectKey}</code>
                  <div className="integration-actions">
                    {['active', 'archived'].includes(asset.status) ? (
                      <Button
                        loading={busyId === asset.id}
                        onClick={() => void operate(asset, 'copy')}
                        size="sm"
                        variant="secondary"
                      >
                        复制地址
                      </Button>
                    ) : null}
                    {hasPermission('assets.manage') && asset.status === 'active' ? (
                      <Button
                        onClick={() => void operate(asset, 'archive')}
                        size="sm"
                        variant="ghost"
                      >
                        归档
                      </Button>
                    ) : null}
                    {hasPermission('assets.manage') && asset.status === 'archived' ? (
                      <Button
                        onClick={() => void operate(asset, 'restore')}
                        size="sm"
                        variant="ghost"
                      >
                        恢复
                      </Button>
                    ) : null}
                    {hasPermission('assets.manage') &&
                    ['active', 'archived', 'failed'].includes(asset.status) ? (
                      <Button
                        disabled={asset.referenceCount > 0}
                        onClick={() => void operate(asset, 'delete')}
                        size="sm"
                        variant="ghost"
                      >
                        删除
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </ResourceSection>
    </PageFrame>
  );
}
