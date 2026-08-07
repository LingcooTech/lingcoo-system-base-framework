import { Button } from '@lingcoo/frame-ui/button';
import { Input } from '@lingcoo/frame-ui/input';
import { Textarea } from '@lingcoo/frame-ui/textarea';
import { useToast } from '@lingcoo/frame-ui/toast';
import { Archive, CalendarClock, ExternalLink, FilePlus2, Plus, Send } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAdminAuth as useAuth } from '@lingcoo/frame-admin/auth';
import { AdminLink as Link, useAdminRouter as useRouter } from '@lingcoo/frame-admin/router';
import {
  AdminPagination,
  AssetPicker,
  BulkActionBar,
  DataTable,
  FilterBar,
  PageFrame,
  ResourceSection,
  StatusPill,
  useConfirm,
  type DataTableColumn,
} from '@lingcoo/frame-admin/shared';

import {
  createCmsContent,
  createCmsRedirect,
  deleteCmsRedirect,
  fetchAssets,
  fetchCmsContent,
  fetchCmsContents,
  fetchCmsRedirects,
  fetchPresentation,
  fetchCmsVersions,
  fetchTaxonomies,
  fetchTaxonomyTerms,
  scheduleCmsContent,
  updateCmsContent,
  updateCmsRedirect,
  updateCmsStatus,
  type CmsContent,
  type CmsContentInput,
  type CmsRedirect,
  type CmsRedirectInput,
  type CmsVersion,
  type PresentationAsset,
  type PresentationProfile,
  type StorageAsset,
  type TaxonomyTerm,
} from '../api/client';
import { sections } from '../lib/foundation';

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

const cmsPageSize = 20;

function RedirectManager({ canWrite }: { canWrite: boolean }) {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [items, setItems] = useState<CmsRedirect[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CmsRedirectInput>({
    sourcePath: '',
    targetPath: '',
    statusCode: 301,
    enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setItems(await fetchCmsRedirects());
    } catch (error) {
      toast({
        title: '重定向加载失败',
        description: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCmsRedirects()
      .then(setItems)
      .catch(() => toast({ title: '重定向加载失败', tone: 'danger' }))
      .finally(() => setLoading(false));
  }, [toast]);

  function reset() {
    setEditingId(null);
    setDraft({ sourcePath: '', targetPath: '', statusCode: 301, enabled: true });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingId) await updateCmsRedirect(editingId, draft);
      else await createCmsRedirect(draft);
      toast({ title: editingId ? '重定向已更新' : '重定向已创建', tone: 'success' });
      reset();
      await load();
    } catch (error) {
      toast({
        title: '重定向保存失败',
        description: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: CmsRedirect) {
    if (
      !(await confirm({
        title: '删除重定向',
        description: `${item.sourcePath} 将不再跳转到 ${item.targetPath}。`,
        confirmLabel: '删除',
        tone: 'danger',
      }))
    )
      return;
    try {
      await deleteCmsRedirect(item.id);
      if (editingId === item.id) reset();
      await load();
      toast({ title: '重定向已删除', tone: 'success' });
    } catch (error) {
      toast({
        title: '重定向删除失败',
        description: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      });
    }
  }

  async function toggle(item: CmsRedirect) {
    try {
      await updateCmsRedirect(item.id, {
        sourcePath: item.sourcePath,
        targetPath: item.targetPath,
        statusCode: item.statusCode,
        enabled: !item.enabled,
      });
      await load();
      toast({ title: item.enabled ? '重定向已停用' : '重定向已启用', tone: 'success' });
    } catch (error) {
      toast({
        title: '重定向状态更新失败',
        description: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      });
    }
  }

  const columns: DataTableColumn<CmsRedirect>[] = [
    { key: 'source', header: '来源路径', cell: (item) => <code>{item.sourcePath}</code> },
    { key: 'target', header: '目标路径', cell: (item) => <code>{item.targetPath}</code> },
    { key: 'code', header: '状态码', cell: (item) => item.statusCode },
    {
      key: 'enabled',
      header: '状态',
      cell: (item) => (
        <StatusPill tone={item.enabled ? 'ok' : 'neutral'}>
          {item.enabled ? '已启用' : '已停用'}
        </StatusPill>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      cell: (item) =>
        canWrite ? (
          <div className="integration-actions">
            <Button
              onClick={() => {
                setEditingId(item.id);
                setDraft({
                  sourcePath: item.sourcePath,
                  targetPath: item.targetPath,
                  statusCode: item.statusCode,
                  enabled: item.enabled,
                });
              }}
              size="sm"
              variant="ghost"
            >
              编辑
            </Button>
            <Button onClick={() => void toggle(item)} size="sm" variant="ghost">
              {item.enabled ? '停用' : '启用'}
            </Button>
            <Button onClick={() => void remove(item)} size="sm" variant="ghost">
              删除
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <ResourceSection
      title="URL 重定向"
      description="仅对不存在的公共路径执行站内 301 或 302 跳转。"
    >
      {canWrite ? (
        <form className="cms-redirect-form" onSubmit={submit}>
          <Input
            aria-label="来源路径"
            onChange={(event) =>
              setDraft((current) => ({ ...current, sourcePath: event.target.value }))
            }
            placeholder="/old-path"
            required
            value={draft.sourcePath}
          />
          <Input
            aria-label="目标路径"
            onChange={(event) =>
              setDraft((current) => ({ ...current, targetPath: event.target.value }))
            }
            placeholder="/pages/new-path"
            required
            value={draft.targetPath}
          />
          <select
            aria-label="重定向状态码"
            className="integration-select"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                statusCode: Number(event.target.value) as 301 | 302,
              }))
            }
            value={draft.statusCode}
          >
            <option value={301}>301 永久</option>
            <option value={302}>302 临时</option>
          </select>
          <Button loading={saving} size="sm" type="submit">
            {editingId ? '保存修改' : '添加重定向'}
          </Button>
          {editingId ? (
            <Button onClick={reset} size="sm" type="button" variant="ghost">
              取消编辑
            </Button>
          ) : null}
        </form>
      ) : null}
      <DataTable
        columns={columns}
        emptyTitle="暂无重定向"
        getRowKey={(item) => item.id}
        loading={loading}
        rows={items}
      />
    </ResourceSection>
  );
}

function CmsList() {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [items, setItems] = useState<CmsContent[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    fetchCmsContents({
      type: type || undefined,
      status: status || undefined,
      search: search || undefined,
      page,
      pageSize: cmsPageSize,
    })
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
        setSelectedKeys([]);
      })
      .catch(() => toast({ title: '内容列表加载失败', tone: 'danger' }))
      .finally(() => setLoading(false));
  }, [page, search, status, toast, type]);

  async function bulkStatus(nextStatus: CmsContent['status']) {
    const label = nextStatus === 'published' ? '发布' : nextStatus === 'archived' ? '归档' : '撤回';
    if (
      !(await confirm({
        title: `批量${label}内容`,
        description: `将处理 ${selectedKeys.length} 项内容。`,
      }))
    )
      return;
    try {
      await Promise.all(selectedKeys.map((id) => updateCmsStatus(id, nextStatus)));
      toast({ title: `已批量${label} ${selectedKeys.length} 项内容`, tone: 'success' });
      const result = await fetchCmsContents({
        type: type || undefined,
        status: status || undefined,
        search: search || undefined,
        page,
        pageSize: cmsPageSize,
      });
      setItems(result.items);
      setTotal(result.total);
      setSelectedKeys([]);
    } catch (error) {
      toast({
        title: `批量${label}失败`,
        description: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      });
    }
  }

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
          {row.status === 'published'
            ? '已发布'
            : row.status === 'archived'
              ? '已归档'
              : row.scheduledPublishAt
                ? '计划发布'
                : '草稿'}
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
        <FilterBar
          actions={
            <Button size="sm" type="submit">
              查询
            </Button>
          }
          onReset={() => {
            setSearchInput('');
            setSearch('');
            setType('');
            setStatus('');
            setPage(1);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput);
            setPage(1);
          }}
        >
          <Input
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="搜索标题或 Slug"
            value={searchInput}
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
        </FilterBar>
        <BulkActionBar onClear={() => setSelectedKeys([])} selectedCount={selectedKeys.length}>
          <Button onClick={() => void bulkStatus('published')} size="sm">
            发布
          </Button>
          <Button onClick={() => void bulkStatus('draft')} size="sm" variant="ghost">
            撤回
          </Button>
          <Button onClick={() => void bulkStatus('archived')} size="sm" variant="danger">
            归档
          </Button>
        </BulkActionBar>
        <div className="cms-toolbar cms-toolbar--actions">
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
          loading={loading}
          onSelectionChange={hasPermission('cms.publish') ? setSelectedKeys : undefined}
          rows={items}
          selectedKeys={selectedKeys}
        />
        <AdminPagination onPageChange={setPage} page={page} pageSize={cmsPageSize} total={total} />
      </ResourceSection>
      <RedirectManager canWrite={hasPermission('cms.write')} />
    </PageFrame>
  );
}

function SeoPreview({
  assets,
  draft,
  presentation,
}: {
  assets: Record<string, PresentationAsset>;
  draft: CmsContentInput;
  presentation: PresentationProfile | null;
}) {
  const title = draft.seoTitle || draft.title || '页面标题';
  const description = draft.seoDescription || draft.excerpt || '页面描述会显示在这里。';
  const path = `/${draft.type === 'article' ? 'articles' : 'pages'}/${draft.slug || 'slug'}`;
  const url = `${presentation?.publicUrl || window.location.origin}${path}`;
  const imageId = draft.socialImageAssetId || draft.coverAssetId;
  const imageUrl = imageId ? assets[imageId]?.publicUrl : null;
  return (
    <section className="cms-seo-preview" aria-label="SEO 预览">
      <div className="cms-search-preview">
        <small>{url}</small>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="cms-social-preview">
        {imageUrl ? (
          <img alt="" src={imageUrl} />
        ) : (
          <div aria-hidden className="cms-social-preview__empty" />
        )}
        <div>
          <small>{presentation?.displayName || 'Lingcoo Frame'}</small>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
      </div>
    </section>
  );
}

function toDateTimeInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
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
  const confirm = useConfirm();
  const { toast } = useToast();
  const [content, setContent] = useState<CmsContent | null>(null);
  const [draft, setDraft] = useState<CmsContentInput>(emptyDraft(initialType));
  const [assets, setAssets] = useState<Record<string, PresentationAsset>>({});
  const [terms, setTerms] = useState<(TaxonomyTerm & { taxonomyName: string })[]>([]);
  const [versions, setVersions] = useState<CmsVersion[]>([]);
  const [presentation, setPresentation] = useState<PresentationProfile | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [scheduleMin] = useState(() =>
    toDateTimeInput(new Date(Date.now() + 60_000).toISOString()),
  );
  const canWrite = hasPermission('cms.write');
  const canPublish = hasPermission('cms.publish');

  useEffect(() => {
    fetchPresentation()
      .then(setPresentation)
      .catch(() => undefined);
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
        setScheduleAt(toDateTimeInput(item.scheduledPublishAt));
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
      toast({ title: '内容已保存', tone: 'success' });
      if (!contentId) navigate('/cms/' + saved.id);
      else setVersions(await fetchCmsVersions(saved.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
      toast({
        title: '内容保存失败',
        description: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: CmsContent['status']) {
    if (!content) return;
    if (
      status === 'archived' &&
      !(await confirm({
        title: '归档内容',
        description: '归档后公共地址将不再展示该内容。',
        confirmLabel: '归档',
        tone: 'danger',
      }))
    )
      return;
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
      toast({
        title:
          status === 'published'
            ? '内容已发布'
            : status === 'archived'
              ? '内容已归档'
              : '内容已撤回',
        tone: 'success',
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '状态修改失败');
      toast({
        title: '内容状态更新失败',
        description: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      });
    }
  }

  async function updateSchedule(publishAt: string | null) {
    if (!content) return;
    try {
      const saved = await scheduleCmsContent(
        content.id,
        publishAt ? new Date(publishAt).toISOString() : null,
      );
      setContent(saved);
      setScheduleAt(toDateTimeInput(saved.scheduledPublishAt));
      toast({ title: publishAt ? '发布计划已设置' : '发布计划已取消', tone: 'success' });
    } catch (error) {
      toast({
        title: '发布计划更新失败',
        description: error instanceof Error ? error.message : undefined,
        tone: 'danger',
      });
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
              loadAssets={fetchAssets}
              onChange={(id, asset) => setAsset('coverAssetId', id, asset)}
              value={draft.coverAssetId}
            />
            <AssetPicker
              asset={draft.socialImageAssetId ? assets[draft.socialImageAssetId] : undefined}
              disabled={!canWrite}
              label="分享图"
              loadAssets={fetchAssets}
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
            <SeoPreview assets={assets} draft={draft} presentation={presentation} />
            {content && canPublish && content.status !== 'archived' ? (
              <div className="cms-schedule-control">
                <label>
                  计划发布时间
                  <Input
                    min={scheduleMin}
                    onChange={(event) => setScheduleAt(event.target.value)}
                    type="datetime-local"
                    value={scheduleAt}
                  />
                </label>
                <div>
                  <Button
                    disabled={!scheduleAt}
                    leadingIcon={<CalendarClock size={15} />}
                    onClick={() => void updateSchedule(scheduleAt)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    设置计划
                  </Button>
                  {content.scheduledPublishAt ? (
                    <Button
                      onClick={() => void updateSchedule(null)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      取消计划
                    </Button>
                  ) : null}
                </div>
                {content.scheduledPublishAt ? (
                  <small>
                    将在 {new Date(content.scheduledPublishAt).toLocaleString()} 自动发布
                  </small>
                ) : null}
              </div>
            ) : null}
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
