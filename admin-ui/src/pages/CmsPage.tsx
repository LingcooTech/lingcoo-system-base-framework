import { Button } from '@lingcoo/frame-ui/button';
import { Input } from '@lingcoo/frame-ui/input';
import { Textarea } from '@lingcoo/frame-ui/textarea';
import { Archive, ExternalLink, FilePlus2, Plus, Send } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import {
  createCmsContent,
  fetchCmsContent,
  fetchCmsContents,
  fetchCmsVersions,
  fetchTaxonomies,
  fetchTaxonomyTerms,
  updateCmsContent,
  updateCmsStatus,
  type CmsContent,
  type CmsContentInput,
  type CmsVersion,
  type PresentationAsset,
  type StorageAsset,
  type TaxonomyTerm,
} from '../api/client';
import { AssetPicker } from '../components/shared/AssetPicker';
import { DataTable, type DataTableColumn } from '../components/shared/DataTable';
import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { useAuth } from '../lib/auth';
import { sections } from '../lib/foundation';
import { Link, useRouter } from '../lib/router';

const emptyDraft = (type: 'article' | 'page'): CmsContentInput => ({
  type,
  slug: '',
  title: '',
  excerpt: null,
  body: '',
  coverAssetId: null,
  socialImageAssetId: null,
  pinned: false,
  seoTitle: null,
  seoDescription: null,
  termIds: [],
});

function CmsList() {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<CmsContent[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchCmsContents({
      type: type || undefined,
      status: status || undefined,
      search: search || undefined,
    })
      .then((result) => setItems(result.items))
      .catch(() => setItems([]));
  }, [search, status, type]);

  const columns: DataTableColumn<CmsContent>[] = [
    {
      key: 'title',
      header: '内容',
      cell: (row) => (
        <div className="table-primary">
          <Link href={'/cms/' + row.id}>
            <strong>{row.title}</strong>
          </Link>
          <small>
            /{row.type === 'page' ? 'pages' : 'articles'}/{row.slug}
          </small>
        </div>
      ),
    },
    { key: 'type', header: '类型', cell: (row) => (row.type === 'page' ? '页面' : '文章') },
    { key: 'version', header: '版本', cell: (row) => 'v' + row.currentVersion },
    {
      key: 'status',
      header: '状态',
      align: 'right',
      cell: (row) => (
        <StatusPill
          tone={
            row.status === 'published' ? 'ok' : row.status === 'archived' ? 'danger' : 'neutral'
          }
        >
          {row.status === 'published' ? '已发布' : row.status === 'archived' ? '已归档' : '草稿'}
        </StatusPill>
      ),
    },
  ];

  return (
    <PageFrame section={sections.cms}>
      <ResourceSection
        title="页面与文章"
        description="只管理通用内容；行业内容类型由对应领域模块注册。"
      >
        <div className="cms-toolbar">
          <Input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索标题或 Slug"
            value={search}
          />
          <select
            className="integration-select"
            onChange={(event) => setType(event.target.value)}
            value={type}
          >
            <option value="">全部类型</option>
            <option value="page">页面</option>
            <option value="article">文章</option>
          </select>
          <select
            className="integration-select"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select>
          {hasPermission('cms.write') ? (
            <div className="cms-create-actions">
              <Button asChild size="sm" variant="secondary">
                <Link href="/cms/new/page">
                  <FilePlus2 size={15} />
                  新建页面
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/cms/new/article">
                  <Plus size={15} />
                  新建文章
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
        <DataTable
          columns={columns}
          emptyTitle="还没有页面或文章"
          getRowKey={(row) => row.id}
          rows={items}
        />
      </ResourceSection>
    </PageFrame>
  );
}

function CmsEditor({
  contentId,
  initialType,
}: {
  contentId?: string;
  initialType: 'article' | 'page';
}) {
  const { hasPermission } = useAuth();
  const { navigate } = useRouter();
  const [content, setContent] = useState<CmsContent | null>(null);
  const [draft, setDraft] = useState<CmsContentInput>(emptyDraft(initialType));
  const [assets, setAssets] = useState<Record<string, PresentationAsset>>({});
  const [terms, setTerms] = useState<(TaxonomyTerm & { taxonomyName: string })[]>([]);
  const [versions, setVersions] = useState<CmsVersion[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const canWrite = hasPermission('cms.write');
  const canPublish = hasPermission('cms.publish');

  useEffect(() => {
    fetchTaxonomies()
      .then(async (taxonomies) =>
        (
          await Promise.all(
            taxonomies
              .filter((item) => item.status === 'active')
              .map(async (taxonomy) =>
                (await fetchTaxonomyTerms(taxonomy.code))
                  .filter((term) => term.status === 'active')
                  .map((term) => ({ ...term, taxonomyName: taxonomy.name })),
              ),
          )
        ).flat(),
      )
      .then(setTerms)
      .catch(() => setTerms([]));
    if (!contentId) return;
    Promise.all([fetchCmsContent(contentId), fetchCmsVersions(contentId)])
      .then(([item, history]) => {
        setContent(item);
        setDraft({
          type: item.type,
          slug: item.slug,
          title: item.title,
          excerpt: item.excerpt,
          body: item.body,
          coverAssetId: item.coverAssetId,
          socialImageAssetId: item.socialImageAssetId,
          pinned: item.pinned,
          seoTitle: item.seoTitle,
          seoDescription: item.seoDescription,
          termIds: item.terms.map((term) => term.id),
        });
        setAssets(item.assets);
        setVersions(history);
      })
      .catch(() => setMessage('内容加载失败。'));
  }, [contentId]);

  function setField<K extends keyof CmsContentInput>(key: K, value: CmsContentInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setAsset(
    field: 'coverAssetId' | 'socialImageAssetId',
    id: string | null,
    selected?: StorageAsset,
  ) {
    setField(field, id);
    if (selected)
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

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const saved = contentId
        ? await updateCmsContent(contentId, draft)
        : await createCmsContent(draft);
      setContent(saved);
      setAssets(saved.assets);
      setMessage('内容已保存。');
      if (!contentId) navigate('/cms/' + saved.id);
      else setVersions(await fetchCmsVersions(saved.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: CmsContent['status']) {
    if (!content) return;
    try {
      const saved = await updateCmsStatus(content.id, status);
      setContent(saved);
      setMessage(
        status === 'published'
          ? '内容已发布。'
          : status === 'archived'
            ? '内容已归档。'
            : '内容已转为草稿。',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '状态修改失败');
    }
  }

  const termGroups = useMemo(
    () =>
      Object.entries(
        terms.reduce<Record<string, (TaxonomyTerm & { taxonomyName: string })[]>>(
          (groups, term) => {
            (groups[term.taxonomyName] ??= []).push(term);
            return groups;
          },
          {},
        ),
      ),
    [terms],
  );

  return (
    <PageFrame section={sections.cms}>
      <form className="cms-editor" onSubmit={save}>
        <div className="cms-editor-heading">
          <div>
            <Link href="/cms">← 返回内容列表</Link>
            <h2>{content ? content.title : draft.type === 'page' ? '新建页面' : '新建文章'}</h2>
          </div>
          <div>
            {content ? (
              <StatusPill tone={content.status === 'published' ? 'ok' : 'neutral'}>
                {content.status}
              </StatusPill>
            ) : null}
            {content ? (
              <a
                className="lc-button lc-button--secondary lc-button--sm"
                href={'/preview/content/' + content.id}
                rel="noreferrer"
                target="_blank"
              >
                预览 <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
        </div>
        <div className="cms-editor-grid">
          <section className="cms-main-fields">
            <label>
              标题
              <Input
                disabled={!canWrite}
                onChange={(event) => setField('title', event.target.value)}
                required
                value={draft.title}
              />
            </label>
            <div className="cms-inline-fields">
              <label>
                类型
                <select
                  className="integration-select"
                  disabled={!canWrite || Boolean(content)}
                  onChange={(event) => setField('type', event.target.value as CmsContent['type'])}
                  value={draft.type}
                >
                  <option value="page">页面</option>
                  <option value="article">文章</option>
                </select>
              </label>
              <label>
                Slug
                <Input
                  disabled={!canWrite}
                  onChange={(event) => setField('slug', event.target.value)}
                  placeholder="about-us"
                  required
                  value={draft.slug}
                />
              </label>
            </div>
            <label>
              摘要
              <Textarea
                disabled={!canWrite}
                onChange={(event) => setField('excerpt', event.target.value || null)}
                value={draft.excerpt ?? ''}
              />
            </label>
            <label>
              正文 <small>Markdown</small>
              <Textarea
                className="cms-body-editor"
                disabled={!canWrite}
                onChange={(event) => setField('body', event.target.value)}
                placeholder="# 标题&#10;&#10;开始编写正文…"
                value={draft.body}
              />
            </label>
          </section>
          <aside className="cms-side-fields">
            <AssetPicker
              asset={draft.coverAssetId ? assets[draft.coverAssetId] : undefined}
              disabled={!canWrite}
              label="封面图"
              onChange={(id, asset) => setAsset('coverAssetId', id, asset)}
              value={draft.coverAssetId}
            />
            <AssetPicker
              asset={draft.socialImageAssetId ? assets[draft.socialImageAssetId] : undefined}
              disabled={!canWrite}
              label="分享图"
              onChange={(id, asset) => setAsset('socialImageAssetId', id, asset)}
              value={draft.socialImageAssetId}
            />
            <label className="cms-check">
              <input
                checked={draft.pinned}
                disabled={!canWrite}
                onChange={(event) => setField('pinned', event.target.checked)}
                type="checkbox"
              />
              置顶内容
            </label>
            <div className="cms-terms">
              <strong>分类与标签</strong>
              {termGroups.map(([name, group]) => (
                <fieldset key={name}>
                  <legend>{name}</legend>
                  {group?.map((term) => (
                    <label key={term.id}>
                      <input
                        checked={draft.termIds.includes(term.id)}
                        disabled={!canWrite}
                        onChange={(event) =>
                          setField(
                            'termIds',
                            event.target.checked
                              ? [...draft.termIds, term.id]
                              : draft.termIds.filter((id) => id !== term.id),
                          )
                        }
                        type="checkbox"
                      />
                      {term.name}
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
            <label>
              SEO 标题
              <Input
                disabled={!canWrite}
                onChange={(event) => setField('seoTitle', event.target.value || null)}
                value={draft.seoTitle ?? ''}
              />
            </label>
            <label>
              SEO 描述
              <Textarea
                disabled={!canWrite}
                onChange={(event) => setField('seoDescription', event.target.value || null)}
                value={draft.seoDescription ?? ''}
              />
            </label>
            <label>
              修改说明
              <Input
                disabled={!canWrite}
                onChange={(event) => setField('changeReason', event.target.value)}
                value={draft.changeReason ?? ''}
              />
            </label>
          </aside>
        </div>
        {versions.length ? (
          <section className="cms-versions">
            <h3>版本历史</h3>
            {versions.slice(0, 8).map((version) => (
              <div key={version.id}>
                <strong>v{version.version}</strong>
                <span>{version.changeReason || '未填写修改说明'}</span>
                <small>{new Date(version.createdAt).toLocaleString()}</small>
              </div>
            ))}
          </section>
        ) : null}
        <div className="presentation-savebar">
          <span>
            {message || (content ? '当前版本 v' + content.currentVersion : '内容将以草稿创建')}
          </span>
          <div>
            {content && canPublish && content.status !== 'archived' ? (
              <Button
                onClick={() =>
                  void changeStatus(content.status === 'published' ? 'draft' : 'published')
                }
                type="button"
                variant="secondary"
              >
                <Send size={15} />
                {content.status === 'published' ? '撤回草稿' : '发布'}
              </Button>
            ) : null}
            {content && canPublish && content.status !== 'archived' ? (
              <Button onClick={() => void changeStatus('archived')} type="button" variant="ghost">
                <Archive size={15} />
                归档
              </Button>
            ) : null}
            {content && canPublish && content.status === 'archived' ? (
              <Button onClick={() => void changeStatus('draft')} type="button" variant="secondary">
                恢复为草稿
              </Button>
            ) : null}
            {canWrite ? (
              <Button loading={saving} type="submit">
                保存内容
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </PageFrame>
  );
}

export function CmsPage() {
  const { pathname } = useRouter();
  if (pathname === '/cms' || pathname === '/cms/') return <CmsList />;
  if (pathname === '/cms/new/page') return <CmsEditor initialType="page" />;
  if (pathname === '/cms/new/article') return <CmsEditor initialType="article" />;
  return <CmsEditor contentId={pathname.slice('/cms/'.length)} initialType="article" />;
}
