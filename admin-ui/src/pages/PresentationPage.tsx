import { Button } from '@lingcoo/frame-ui/button';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { Textarea } from '@lingcoo/frame-ui/textarea';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import {
  fetchPresentation,
  updatePresentation,
  type PresentationAsset,
  type PresentationProfile,
  type PresentationUpdate,
  type StorageAsset,
} from '../api/client';
import { AssetPicker } from '../components/shared/AssetPicker';
import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { useAuth } from '../lib/auth';
import { sections } from '../lib/foundation';

const assetFields = [
  ['fullLogoAssetId', '完整 Logo'],
  ['squareLogoAssetId', '方形 Logo'],
  ['darkLogoAssetId', '深色背景 Logo'],
  ['faviconAssetId', 'Favicon'],
  ['socialImageAssetId', '社交分享图'],
] as const;

function toUpdate(profile: PresentationProfile): PresentationUpdate {
  const input = { ...profile } as Record<string, unknown>;
  delete input.id;
  delete input.version;
  delete input.updatedAt;
  delete input.assets;
  return input as PresentationUpdate;
}

function LinkEditor({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  value: { label: string; href: string }[];
  onChange(value: { label: string; href: string }[]): void;
}) {
  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="presentation-link-editor">
      {value.map((item, index) => (
        <div className="presentation-link-row" key={index}>
          <Input
            aria-label="链接名称"
            disabled={disabled}
            onChange={(event) =>
              onChange(
                value.map((current, itemIndex) =>
                  itemIndex === index ? { ...current, label: event.target.value } : current,
                ),
              )
            }
            placeholder="名称"
            value={item.label}
          />
          <Input
            aria-label="链接地址"
            disabled={disabled}
            onChange={(event) =>
              onChange(
                value.map((current, itemIndex) =>
                  itemIndex === index ? { ...current, href: event.target.value } : current,
                ),
              )
            }
            placeholder="/about 或 https://…"
            value={item.href}
          />
          {!disabled ? (
            <div className="presentation-link-actions">
              <button
                aria-label="上移链接"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                title="上移"
                type="button"
              >
                <ArrowUp size={15} />
              </button>
              <button
                aria-label="下移链接"
                disabled={index === value.length - 1}
                onClick={() => move(index, 1)}
                title="下移"
                type="button"
              >
                <ArrowDown size={15} />
              </button>
              <button
                aria-label="删除链接"
                className="presentation-link-delete"
                onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                title="删除"
                type="button"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {!disabled ? (
        <Button
          onClick={() => onChange([...value, { label: '', href: '' }])}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Plus size={15} /> 添加链接
        </Button>
      ) : null}
    </div>
  );
}

export function PresentationPage() {
  const { hasPermission } = useAuth();
  const [profile, setProfile] = useState<PresentationProfile | null>(null);
  const [draft, setDraft] = useState<PresentationUpdate | null>(null);
  const [assets, setAssets] = useState<Record<string, PresentationAsset>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPresentation()
      .then((result) => {
        setProfile(result);
        setDraft(toUpdate(result));
        setAssets(result.assets);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  function setField<K extends keyof PresentationUpdate>(key: K, value: PresentationUpdate[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function setAsset(
    field: (typeof assetFields)[number][0],
    id: string | null,
    selected?: StorageAsset,
  ) {
    setField(field, id);
    if (selected) {
      setAssets((current) => ({
        ...current,
        [selected.id]: {
          id: selected.id,
          displayName: selected.displayName,
          publicUrl: selected.publicUrl,
          mimeType: selected.mimeType,
        },
      }));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setStatus('saving');
    setMessage('');
    try {
      const saved = await updatePresentation(draft);
      setProfile(saved);
      setDraft(toUpdate(saved));
      setAssets(saved.assets);
      setMessage('品牌与站点呈现已保存。');
      setStatus('ready');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
      setStatus('error');
    }
  }

  if (!draft || !profile) {
    return (
      <PageFrame section={sections.presentation}>
        <ResourceSection
          title="品牌档案"
          description={status === 'error' ? '品牌配置加载失败。' : '正在加载品牌配置…'}
        >
          <div className="asset-empty">
            {status === 'error' ? '请稍后重试。' : '正在读取配置。'}
          </div>
        </ResourceSection>
      </PageFrame>
    );
  }

  const canWrite = hasPermission('presentation.write');
  return (
    <PageFrame section={sections.presentation}>
      <form className="presentation-form" onSubmit={submit}>
        <ResourceSection
          title="品牌标识"
          description="这些内容会用于管理后台和公共网站的系统识别。"
        >
          <div className="presentation-fields two-columns">
            <FormField label="系统显示名称">
              <Input
                disabled={!canWrite}
                onChange={(e) => setField('displayName', e.target.value)}
                required
                value={draft.displayName}
              />
            </FormField>
            <FormField label="品牌简称">
              <Input
                disabled={!canWrite}
                onChange={(e) => setField('shortName', e.target.value || null)}
                value={draft.shortName ?? ''}
              />
            </FormField>
            <FormField className="full-column" label="品牌标语">
              <Input
                disabled={!canWrite}
                onChange={(e) => setField('slogan', e.target.value || null)}
                value={draft.slogan ?? ''}
              />
            </FormField>
          </div>
          <div className="brand-asset-list">
            {assetFields.map(([field, label]) => (
              <AssetPicker
                asset={draft[field] ? assets[draft[field]!] : undefined}
                disabled={!canWrite}
                key={field}
                label={label}
                onChange={(id, asset) => setAsset(field, id, asset)}
                value={draft[field]}
              />
            ))}
          </div>
        </ResourceSection>

        <ResourceSection
          title="颜色与实时预览"
          description="后台只使用安全的品牌标识，公共站点可以完整应用这些品牌色。"
        >
          <div className="presentation-color-layout">
            <div className="presentation-fields">
              {(['primaryColor', 'secondaryColor', 'accentColor'] as const).map((field, index) => (
                <FormField key={field} label={['主色', '辅助色', '强调色'][index]}>
                  <div className="color-input">
                    <input
                      disabled={!canWrite}
                      onChange={(e) => setField(field, e.target.value)}
                      type="color"
                      value={draft[field]}
                    />
                    <Input
                      disabled={!canWrite}
                      onChange={(e) => setField(field, e.target.value)}
                      value={draft[field]}
                    />
                  </div>
                </FormField>
              ))}
            </div>
            <div className="brand-live-preview" style={{ background: draft.primaryColor }}>
              <span style={{ background: draft.secondaryColor, color: draft.primaryColor }}>
                {draft.shortName?.slice(0, 2) || 'LC'}
              </span>
              <strong>{draft.displayName}</strong>
              <small>{draft.slogan || '品牌标语预览'}</small>
              <button
                style={{ background: draft.secondaryColor, color: draft.primaryColor }}
                type="button"
              >
                主要操作
              </button>
            </div>
          </div>
        </ResourceSection>

        <ResourceSection
          title="联系与搜索呈现"
          description="用于公共页脚、通知落款和搜索引擎基础信息。"
        >
          <div className="presentation-fields two-columns">
            <FormField label="联系邮箱">
              <Input
                disabled={!canWrite}
                onChange={(e) => setField('contactEmail', e.target.value || null)}
                type="email"
                value={draft.contactEmail ?? ''}
              />
            </FormField>
            <FormField label="联系电话">
              <Input
                disabled={!canWrite}
                onChange={(e) => setField('contactPhone', e.target.value || null)}
                value={draft.contactPhone ?? ''}
              />
            </FormField>
            <FormField label="公开站点地址">
              <Input
                disabled={!canWrite}
                onChange={(e) => setField('publicUrl', e.target.value || null)}
                type="url"
                value={draft.publicUrl ?? ''}
              />
            </FormField>
            <FormField label="SEO 标题">
              <Input
                disabled={!canWrite}
                onChange={(e) => setField('seoTitle', e.target.value || null)}
                value={draft.seoTitle ?? ''}
              />
            </FormField>
            <FormField className="full-column" label="联系地址">
              <Input
                disabled={!canWrite}
                onChange={(e) => setField('contactAddress', e.target.value || null)}
                value={draft.contactAddress ?? ''}
              />
            </FormField>
            <FormField className="full-column" label="SEO 描述">
              <Textarea
                disabled={!canWrite}
                onChange={(e) => setField('seoDescription', e.target.value || null)}
                value={draft.seoDescription ?? ''}
              />
            </FormField>
            <FormField label="页脚版权">
              <Input
                disabled={!canWrite}
                onChange={(e) => setField('footerCopyright', e.target.value || null)}
                value={draft.footerCopyright ?? ''}
              />
            </FormField>
            <FormField label="备案信息">
              <Input
                disabled={!canWrite}
                onChange={(e) => setField('filingInfo', e.target.value || null)}
                value={draft.filingInfo ?? ''}
              />
            </FormField>
            <FormField className="full-column" label="本次修改说明">
              <Input
                disabled={!canWrite}
                onChange={(e) => setField('changeReason', e.target.value)}
                placeholder="可选，将记录到配置版本和审计日志"
                value={draft.changeReason ?? ''}
              />
            </FormField>
          </div>
        </ResourceSection>
        <ResourceSection
          title="站点导航"
          description="维护公共网站的顶部导航与页脚链接，不包含行业页面内容。"
        >
          <div className="presentation-navigation-grid">
            <div>
              <h3>顶部导航</h3>
              <LinkEditor
                disabled={!canWrite}
                onChange={(value) => setField('headerNavigation', value)}
                value={draft.headerNavigation}
              />
            </div>
            <div>
              <h3>页脚链接</h3>
              <LinkEditor
                disabled={!canWrite}
                onChange={(value) => setField('footerLinks', value)}
                value={draft.footerLinks}
              />
            </div>
          </div>
        </ResourceSection>
        <div className="presentation-savebar">
          <span>{message || `当前版本 v${profile.version}`}</span>
          {canWrite ? (
            <Button loading={status === 'saving'} type="submit">
              保存品牌设置
            </Button>
          ) : null}
        </div>
      </form>
    </PageFrame>
  );
}
