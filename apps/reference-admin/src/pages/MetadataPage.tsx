import { Button } from '@lingcoo/frame-ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@lingcoo/frame-ui/dialog';
import { FormField } from '@lingcoo/frame-ui/form-field';
import { Input } from '@lingcoo/frame-ui/input';
import { Textarea } from '@lingcoo/frame-ui/textarea';
import { useEffect, useState, type FormEvent } from 'react';

import {
  applyExchangeImport,
  createMetadataDictionary,
  createMetadataDictionaryItem,
  createTaxonomy,
  createTaxonomyTerm,
  exportExchangeDataset,
  fetchExchangeDatasets,
  fetchExchangeRuns,
  fetchMetadataDictionaries,
  fetchMetadataDictionaryItems,
  fetchMetadataSummary,
  fetchTaxonomies,
  fetchTaxonomyTerms,
  previewExchangeImport,
  updateMetadataDictionary,
  updateMetadataDictionaryItem,
  updateTaxonomy,
  updateTaxonomyTerm,
  type ExchangeDataset,
  type ExchangePreview,
  type ExchangeRun,
  type MetadataDictionary,
  type MetadataDictionaryItem,
  type MetadataSummary,
  type Taxonomy,
  type TaxonomyTerm,
} from '../api/client';
import { DataTable, type DataTableColumn } from '../components/shared/DataTable';
import { PageFrame } from '../components/shared/PageFrame';
import { ResourceSection } from '../components/shared/ResourceSection';
import { StatusPill } from '../components/shared/StatusPill';
import { useAuth } from '../lib/auth';
import { sections } from '../lib/foundation';

const emptySummary: MetadataSummary = {
  dictionaries: 0,
  dictionaryItems: 0,
  taxonomies: 0,
  terms: 0,
  assignments: 0,
};

function displayValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function parseValue(valueType: MetadataDictionary['valueType'], value: string): unknown {
  if (valueType === 'number') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error('请输入有效数字');
    return parsed;
  }
  if (valueType === 'boolean') return value === 'true';
  if (valueType === 'json') return JSON.parse(value) as unknown;
  return value;
}

export function MetadataPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('metadata.write');
  const canExchangeRead = hasPermission('data_exchange.read');
  const canExchangeWrite = hasPermission('data_exchange.write');
  const [summary, setSummary] = useState(emptySummary);
  const [dictionaries, setDictionaries] = useState<MetadataDictionary[]>([]);
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([]);
  const [datasets, setDatasets] = useState<ExchangeDataset[]>([]);
  const [runs, setRuns] = useState<ExchangeRun[]>([]);
  const [selectedDictionary, setSelectedDictionary] = useState<MetadataDictionary | null>(null);
  const [dictionaryItems, setDictionaryItems] = useState<MetadataDictionaryItem[]>([]);
  const [selectedTaxonomy, setSelectedTaxonomy] = useState<Taxonomy | null>(null);
  const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
  const [dictionaryDialog, setDictionaryDialog] = useState(false);
  const [editingDictionary, setEditingDictionary] = useState<MetadataDictionary | null>(null);
  const [itemDialog, setItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<MetadataDictionaryItem | null>(null);
  const [taxonomyDialog, setTaxonomyDialog] = useState(false);
  const [editingTaxonomy, setEditingTaxonomy] = useState<Taxonomy | null>(null);
  const [termDialog, setTermDialog] = useState(false);
  const [editingTerm, setEditingTerm] = useState<TaxonomyTerm | null>(null);
  const [exchangeDialog, setExchangeDialog] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [statusValue, setStatusValue] = useState<'active' | 'inactive'>('active');
  const [valueType, setValueType] = useState<MetadataDictionary['valueType']>('string');
  const [valueText, setValueText] = useState('');
  const [sortOrder, setSortOrder] = useState(100);
  const [taxonomyKind, setTaxonomyKind] = useState<Taxonomy['kind']>('tag');
  const [hierarchical, setHierarchical] = useState(false);
  const [parentId, setParentId] = useState('');
  const [color, setColor] = useState('');
  const [datasetCode, setDatasetCode] = useState('');
  const [documentText, setDocumentText] = useState('');
  const [preview, setPreview] = useState<ExchangePreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [nextSummary, nextDictionaries, nextTaxonomies, nextDatasets, nextRuns] =
      await Promise.all([
        fetchMetadataSummary(),
        fetchMetadataDictionaries(),
        fetchTaxonomies(),
        canExchangeRead ? fetchExchangeDatasets() : Promise.resolve([]),
        canExchangeRead ? fetchExchangeRuns() : Promise.resolve([]),
      ]);
    setSummary(nextSummary);
    setDictionaries(nextDictionaries);
    setTaxonomies(nextTaxonomies);
    setDatasets(nextDatasets);
    setRuns(nextRuns);
    setDatasetCode((current) => current || nextDatasets[0]?.code || '');
  }

  useEffect(() => {
    Promise.all([
      fetchMetadataSummary(),
      fetchMetadataDictionaries(),
      fetchTaxonomies(),
      canExchangeRead ? fetchExchangeDatasets() : Promise.resolve([]),
      canExchangeRead ? fetchExchangeRuns() : Promise.resolve([]),
    ])
      .then(([nextSummary, nextDictionaries, nextTaxonomies, nextDatasets, nextRuns]) => {
        setSummary(nextSummary);
        setDictionaries(nextDictionaries);
        setTaxonomies(nextTaxonomies);
        setDatasets(nextDatasets);
        setRuns(nextRuns);
        setDatasetCode(nextDatasets[0]?.code ?? '');
      })
      .catch(() => setError('通用数据能力加载失败'));
  }, [canExchangeRead]);

  async function selectDictionary(dictionary: MetadataDictionary) {
    setSelectedDictionary(dictionary);
    setSelectedTaxonomy(null);
    try {
      setDictionaryItems(await fetchMetadataDictionaryItems(dictionary.code));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '字典条目加载失败');
    }
  }

  async function selectTaxonomy(taxonomy: Taxonomy) {
    setSelectedTaxonomy(taxonomy);
    setSelectedDictionary(null);
    try {
      setTerms(await fetchTaxonomyTerms(taxonomy.code));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '分类词条加载失败');
    }
  }

  function openDictionary(dictionary?: MetadataDictionary) {
    setEditingDictionary(dictionary ?? null);
    setCode(dictionary?.code ?? '');
    setName(dictionary?.name ?? '');
    setDescription(dictionary?.description ?? '');
    setValueType(dictionary?.valueType ?? 'string');
    setStatusValue(dictionary?.status ?? 'active');
    setError('');
    setDictionaryDialog(true);
  }

  function openItem(item?: MetadataDictionaryItem) {
    setEditingItem(item ?? null);
    setCode(item?.code ?? '');
    setName(item?.label ?? '');
    setDescription(item?.description ?? '');
    setValueText(
      item ? displayValue(item.value) : selectedDictionary?.valueType === 'boolean' ? 'true' : '',
    );
    setSortOrder(item?.sortOrder ?? 100);
    setStatusValue(item?.status ?? 'active');
    setError('');
    setItemDialog(true);
  }

  function openTaxonomy(taxonomy?: Taxonomy) {
    setEditingTaxonomy(taxonomy ?? null);
    setCode(taxonomy?.code ?? '');
    setName(taxonomy?.name ?? '');
    setDescription(taxonomy?.description ?? '');
    setTaxonomyKind(taxonomy?.kind ?? 'tag');
    setHierarchical(taxonomy?.hierarchical ?? false);
    setStatusValue(taxonomy?.status ?? 'active');
    setError('');
    setTaxonomyDialog(true);
  }

  function openTerm(term?: TaxonomyTerm) {
    setEditingTerm(term ?? null);
    setCode(term?.code ?? '');
    setName(term?.name ?? '');
    setParentId(term?.parentId ?? '');
    setColor(term?.color ?? '');
    setSortOrder(term?.sortOrder ?? 100);
    setStatusValue(term?.status ?? 'active');
    setError('');
    setTermDialog(true);
  }

  async function submitDictionary(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (editingDictionary)
        await updateMetadataDictionary(editingDictionary.code, {
          name,
          description,
          status: statusValue,
        });
      else await createMetadataDictionary({ code, name, description, valueType });
      setDictionaryDialog(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '字典保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitItem(event: FormEvent) {
    event.preventDefault();
    if (!selectedDictionary) return;
    setSubmitting(true);
    setError('');
    try {
      const value = parseValue(selectedDictionary.valueType, valueText);
      if (editingItem)
        await updateMetadataDictionaryItem(selectedDictionary.code, editingItem.id, {
          label: name,
          value,
          description,
          sortOrder,
          status: statusValue,
        });
      else
        await createMetadataDictionaryItem(selectedDictionary.code, {
          code,
          label: name,
          value,
          description,
          sortOrder,
          status: statusValue,
        });
      setItemDialog(false);
      setDictionaryItems(await fetchMetadataDictionaryItems(selectedDictionary.code));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '字典条目保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTaxonomy(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (editingTaxonomy)
        await updateTaxonomy(editingTaxonomy.code, { name, description, status: statusValue });
      else
        await createTaxonomy({
          code,
          name,
          description,
          kind: taxonomyKind,
          hierarchical: taxonomyKind === 'category' && hierarchical,
        });
      setTaxonomyDialog(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '分类法保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTerm(event: FormEvent) {
    event.preventDefault();
    if (!selectedTaxonomy) return;
    setSubmitting(true);
    setError('');
    try {
      const input = {
        name,
        parentId: parentId || null,
        color: color || null,
        sortOrder,
        status: statusValue,
      };
      if (editingTerm) await updateTaxonomyTerm(selectedTaxonomy.code, editingTerm.id, input);
      else await createTaxonomyTerm(selectedTaxonomy.code, { code, ...input, metadata: {} });
      setTermDialog(false);
      setTerms(await fetchTaxonomyTerms(selectedTaxonomy.code));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '分类词条保存失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function exportDataset(dataset: ExchangeDataset) {
    try {
      const document = await exportExchangeDataset(dataset.code);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }),
      );
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = `${dataset.code}-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(`${dataset.name}已导出。`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '数据集导出失败');
    }
  }

  async function previewImport() {
    setSubmitting(true);
    setError('');
    try {
      setPreview(await previewExchangeImport(datasetCode, JSON.parse(documentText) as unknown));
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : '导入预检失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function applyImport() {
    if (!preview?.valid) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await applyExchangeImport(datasetCode, JSON.parse(documentText) as unknown);
      setMessage(
        `导入完成：${result.recordCount} 条记录，新增 ${result.creates}，更新 ${result.updates}。`,
      );
      setExchangeDialog(false);
      setPreview(null);
      setDocumentText('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '数据集导入失败');
    } finally {
      setSubmitting(false);
    }
  }

  const dictionaryColumns: DataTableColumn<MetadataDictionary>[] = [
    {
      key: 'name',
      header: '字典',
      cell: (item) => (
        <div className="table-primary">
          <strong>{item.name}</strong>
          <small>{item.code}</small>
        </div>
      ),
    },
    { key: 'type', header: '值类型', cell: (item) => <code>{item.valueType}</code> },
    { key: 'items', header: '条目', cell: (item) => String(item.itemCount) },
    {
      key: 'status',
      header: '状态',
      cell: (item) => (
        <StatusPill tone={item.status === 'active' ? 'ok' : 'neutral'}>
          {item.status === 'active' ? '启用' : '停用'}
        </StatusPill>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      cell: (item) => (
        <div className="integration-actions">
          <Button onClick={() => void selectDictionary(item)} size="sm" variant="ghost">
            条目
          </Button>
          {canWrite ? (
            <Button onClick={() => openDictionary(item)} size="sm" variant="ghost">
              编辑
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
  const itemColumns: DataTableColumn<MetadataDictionaryItem>[] = [
    {
      key: 'label',
      header: '条目',
      cell: (item) => (
        <div className="table-primary">
          <strong>{item.label}</strong>
          <small>{item.code}</small>
        </div>
      ),
    },
    { key: 'value', header: '值', cell: (item) => <code>{displayValue(item.value)}</code> },
    { key: 'order', header: '排序', cell: (item) => String(item.sortOrder) },
    {
      key: 'status',
      header: '状态',
      cell: (item) => (
        <StatusPill tone={item.status === 'active' ? 'ok' : 'neutral'}>
          {item.status === 'active' ? '启用' : '停用'}
        </StatusPill>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      cell: (item) =>
        canWrite ? (
          <Button onClick={() => openItem(item)} size="sm" variant="ghost">
            编辑
          </Button>
        ) : null,
    },
  ];
  const taxonomyColumns: DataTableColumn<Taxonomy>[] = [
    {
      key: 'name',
      header: '分类法',
      cell: (item) => (
        <div className="table-primary">
          <strong>{item.name}</strong>
          <small>{item.code}</small>
        </div>
      ),
    },
    {
      key: 'kind',
      header: '类型',
      cell: (item) => (
        <StatusPill tone="info">{item.kind === 'category' ? '分类' : '标签'}</StatusPill>
      ),
    },
    { key: 'mode', header: '结构', cell: (item) => (item.hierarchical ? '层级' : '扁平') },
    { key: 'terms', header: '词条', cell: (item) => String(item.termCount) },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      cell: (item) => (
        <div className="integration-actions">
          <Button onClick={() => void selectTaxonomy(item)} size="sm" variant="ghost">
            词条
          </Button>
          {canWrite ? (
            <Button onClick={() => openTaxonomy(item)} size="sm" variant="ghost">
              编辑
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
  const termColumns: DataTableColumn<TaxonomyTerm>[] = [
    {
      key: 'name',
      header: '词条',
      cell: (item) => (
        <div className="table-primary">
          <strong>
            <span className="term-color" style={{ background: item.color ?? '#dfe7e1' }} />
            {item.name}
          </strong>
          <small>{item.code}</small>
        </div>
      ),
    },
    {
      key: 'parent',
      header: '父级',
      cell: (item) => terms.find((term) => term.id === item.parentId)?.name ?? '—',
    },
    { key: 'order', header: '排序', cell: (item) => String(item.sortOrder) },
    {
      key: 'status',
      header: '状态',
      cell: (item) => (
        <StatusPill tone={item.status === 'active' ? 'ok' : 'neutral'}>
          {item.status === 'active' ? '启用' : '停用'}
        </StatusPill>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      cell: (item) =>
        canWrite ? (
          <Button onClick={() => openTerm(item)} size="sm" variant="ghost">
            编辑
          </Button>
        ) : null,
    },
  ];
  const runColumns: DataTableColumn<ExchangeRun>[] = [
    { key: 'dataset', header: '数据集', cell: (item) => <code>{item.datasetCode}</code> },
    {
      key: 'direction',
      header: '方向',
      cell: (item) => (item.direction === 'import' ? '导入' : '导出'),
    },
    {
      key: 'status',
      header: '结果',
      cell: (item) => (
        <StatusPill tone={item.status === 'succeeded' ? 'ok' : 'danger'}>
          {item.status === 'succeeded' ? '成功' : '失败'}
        </StatusPill>
      ),
    },
    { key: 'count', header: '记录', cell: (item) => String(item.recordCount) },
    {
      key: 'time',
      header: '时间',
      align: 'right',
      cell: (item) => new Date(item.createdAt).toLocaleString('zh-CN'),
    },
  ];

  return (
    <PageFrame section={sections.metadata}>
      <div className="metric-grid access-metrics">
        <article className="metric-card">
          <span>数据字典</span>
          <strong>{summary.dictionaries}</strong>
          <small>{summary.dictionaryItems} 个条目</small>
        </article>
        <article className="metric-card">
          <span>分类法</span>
          <strong>{summary.taxonomies}</strong>
          <small>{summary.terms} 个词条</small>
        </article>
        <article className="metric-card">
          <span>资源关联</span>
          <strong>{summary.assignments}</strong>
          <small>跨领域稳定引用</small>
        </article>
        <article className="metric-card">
          <span>交换适配器</span>
          <strong>{datasets.length}</strong>
          <small>JSON · 预检 · Upsert</small>
        </article>
      </div>
      {error ? <p className="integration-notice error">{error}</p> : null}
      {message ? <p className="integration-notice success">{message}</p> : null}
      <ResourceSection
        title="数据字典"
        description="管理状态、类型和选项等稳定枚举；值类型一旦产生条目便不可改变。"
      >
        <div className="integration-toolbar">
          <p>领域表只保存稳定代码，显示名称可以独立演进。</p>
          {canWrite ? (
            <Button onClick={() => openDictionary()} size="sm">
              新建字典
            </Button>
          ) : null}
        </div>
        <DataTable columns={dictionaryColumns} getRowKey={(item) => item.id} rows={dictionaries} />
      </ResourceSection>
      {selectedDictionary ? (
        <ResourceSection
          title={`${selectedDictionary.name} · 字典条目`}
          description={`${selectedDictionary.code} · ${selectedDictionary.valueType}`}
        >
          <div className="integration-toolbar">
            <p>停用条目保留历史引用，不进行物理删除。</p>
            {canWrite ? (
              <Button onClick={() => openItem()} size="sm">
                新建条目
              </Button>
            ) : null}
          </div>
          <DataTable columns={itemColumns} getRowKey={(item) => item.id} rows={dictionaryItems} />
        </ResourceSection>
      ) : null}
      <ResourceSection
        title="分类与标签"
        description="Category 支持可选层级，Tag 保持扁平；领域资源通过通用关联表使用词条。"
      >
        <div className="integration-toolbar">
          <p>分类法表达组织方式，不承载课程、商品等业务字段。</p>
          {canWrite ? (
            <Button onClick={() => openTaxonomy()} size="sm">
              新建分类法
            </Button>
          ) : null}
        </div>
        <DataTable columns={taxonomyColumns} getRowKey={(item) => item.id} rows={taxonomies} />
      </ResourceSection>
      {selectedTaxonomy ? (
        <ResourceSection
          title={`${selectedTaxonomy.name} · 词条`}
          description={`${selectedTaxonomy.kind === 'category' ? '分类' : '标签'} · ${selectedTaxonomy.hierarchical ? '层级结构' : '扁平结构'}`}
        >
          <div className="integration-toolbar">
            <p>词条代码用于 API 和数据交换，名称与颜色用于展示。</p>
            {canWrite ? (
              <Button onClick={() => openTerm()} size="sm">
                新建词条
              </Button>
            ) : null}
          </div>
          <DataTable columns={termColumns} getRowKey={(item) => item.id} rows={terms} />
        </ResourceSection>
      ) : null}
      {canExchangeRead ? (
        <ResourceSection
          title="数据集交换"
          description="先由适配器导出版本化 JSON；导入必须通过结构和引用预检后才能原子应用。"
        >
          <div className="exchange-datasets">
            {datasets.map((dataset) => (
              <article key={dataset.code}>
                <div>
                  <strong>{dataset.name}</strong>
                  <code>{dataset.code}</code>
                  <p>{dataset.description}</p>
                </div>
                <div className="integration-actions">
                  <Button onClick={() => void exportDataset(dataset)} size="sm" variant="secondary">
                    导出 JSON
                  </Button>
                  {canExchangeWrite ? (
                    <Button
                      onClick={() => {
                        setDatasetCode(dataset.code);
                        setDocumentText('');
                        setPreview(null);
                        setExchangeDialog(true);
                      }}
                      size="sm"
                    >
                      导入
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          <DataTable
            columns={runColumns}
            emptyTitle="暂无导入导出记录"
            getRowKey={(item) => item.id}
            rows={runs}
          />
        </ResourceSection>
      ) : null}

      <Dialog open={dictionaryDialog} onOpenChange={setDictionaryDialog}>
        <DialogContent
          header={
            <DialogHeader
              title={editingDictionary ? '编辑数据字典' : '新建数据字典'}
              description="字典代码建立后保持稳定，业务数据只保存代码。"
            />
          }
          footer={
            <DialogFooter>
              <Button onClick={() => setDictionaryDialog(false)} variant="secondary">
                取消
              </Button>
              <Button form="dictionary-form" loading={submitting} type="submit">
                保存字典
              </Button>
            </DialogFooter>
          }
        >
          <form className="integration-form" id="dictionary-form" onSubmit={submitDictionary}>
            {!editingDictionary ? (
              <FormField label="字典代码" required>
                {({ controlId }) => (
                  <Input
                    id={controlId}
                    onChange={(event) => setCode(event.target.value)}
                    required
                    value={code}
                  />
                )}
              </FormField>
            ) : null}
            <FormField label="名称" required>
              {({ controlId }) => (
                <Input
                  id={controlId}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              )}
            </FormField>
            <FormField label="说明">
              {({ controlId }) => (
                <Textarea
                  id={controlId}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  value={description}
                />
              )}
            </FormField>
            {!editingDictionary ? (
              <FormField label="值类型" required>
                {({ controlId }) => (
                  <select
                    className="integration-select"
                    id={controlId}
                    onChange={(event) => setValueType(event.target.value as typeof valueType)}
                    value={valueType}
                  >
                    <option value="string">字符串</option>
                    <option value="number">数字</option>
                    <option value="boolean">布尔</option>
                    <option value="json">JSON</option>
                  </select>
                )}
              </FormField>
            ) : (
              <FormField label="状态">
                {({ controlId }) => (
                  <select
                    className="integration-select"
                    id={controlId}
                    onChange={(event) => setStatusValue(event.target.value as typeof statusValue)}
                    value={statusValue}
                  >
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
                )}
              </FormField>
            )}
            {error ? <p className="auth-error">{error}</p> : null}
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={itemDialog} onOpenChange={setItemDialog}>
        <DialogContent
          header={
            <DialogHeader
              title={editingItem ? '编辑字典条目' : '新建字典条目'}
              description={`值类型：${selectedDictionary?.valueType ?? 'string'}`}
            />
          }
          footer={
            <DialogFooter>
              <Button onClick={() => setItemDialog(false)} variant="secondary">
                取消
              </Button>
              <Button form="dictionary-item-form" loading={submitting} type="submit">
                保存条目
              </Button>
            </DialogFooter>
          }
        >
          <form className="integration-form" id="dictionary-item-form" onSubmit={submitItem}>
            {!editingItem ? (
              <FormField label="条目代码" required>
                {({ controlId }) => (
                  <Input
                    id={controlId}
                    onChange={(event) => setCode(event.target.value)}
                    required
                    value={code}
                  />
                )}
              </FormField>
            ) : null}
            <FormField label="显示名称" required>
              {({ controlId }) => (
                <Input
                  id={controlId}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              )}
            </FormField>
            <FormField label="值" required>
              {({ controlId }) =>
                selectedDictionary?.valueType === 'boolean' ? (
                  <select
                    className="integration-select"
                    id={controlId}
                    onChange={(event) => setValueText(event.target.value)}
                    value={valueText}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : selectedDictionary?.valueType === 'json' ? (
                  <Textarea
                    id={controlId}
                    onChange={(event) => setValueText(event.target.value)}
                    required
                    rows={5}
                    value={valueText}
                  />
                ) : (
                  <Input
                    id={controlId}
                    onChange={(event) => setValueText(event.target.value)}
                    required
                    value={valueText}
                  />
                )
              }
            </FormField>
            <FormField label="排序">
              {({ controlId }) => (
                <Input
                  id={controlId}
                  onChange={(event) => setSortOrder(Number(event.target.value))}
                  type="number"
                  value={sortOrder}
                />
              )}
            </FormField>
            <FormField label="状态">
              {({ controlId }) => (
                <select
                  className="integration-select"
                  id={controlId}
                  onChange={(event) => setStatusValue(event.target.value as typeof statusValue)}
                  value={statusValue}
                >
                  <option value="active">启用</option>
                  <option value="inactive">停用</option>
                </select>
              )}
            </FormField>
            {error ? <p className="auth-error">{error}</p> : null}
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={taxonomyDialog} onOpenChange={setTaxonomyDialog}>
        <DialogContent
          header={
            <DialogHeader
              title={editingTaxonomy ? '编辑分类法' : '新建分类法'}
              description="Category 用于分类，Tag 用于跨维度标记。"
            />
          }
          footer={
            <DialogFooter>
              <Button onClick={() => setTaxonomyDialog(false)} variant="secondary">
                取消
              </Button>
              <Button form="taxonomy-form" loading={submitting} type="submit">
                保存分类法
              </Button>
            </DialogFooter>
          }
        >
          <form className="integration-form" id="taxonomy-form" onSubmit={submitTaxonomy}>
            {!editingTaxonomy ? (
              <>
                <FormField label="分类法代码" required>
                  {({ controlId }) => (
                    <Input
                      id={controlId}
                      onChange={(event) => setCode(event.target.value)}
                      required
                      value={code}
                    />
                  )}
                </FormField>
                <FormField label="类型" required>
                  {({ controlId }) => (
                    <select
                      className="integration-select"
                      id={controlId}
                      onChange={(event) => {
                        const kind = event.target.value as Taxonomy['kind'];
                        setTaxonomyKind(kind);
                        if (kind === 'tag') setHierarchical(false);
                      }}
                      value={taxonomyKind}
                    >
                      <option value="tag">标签</option>
                      <option value="category">分类</option>
                    </select>
                  )}
                </FormField>
                {taxonomyKind === 'category' ? (
                  <label className="integration-check">
                    <input
                      checked={hierarchical}
                      onChange={(event) => setHierarchical(event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      <strong>允许层级</strong>
                      <small>词条可以选择同一分类法中的父级。</small>
                    </span>
                  </label>
                ) : null}
              </>
            ) : null}
            <FormField label="名称" required>
              {({ controlId }) => (
                <Input
                  id={controlId}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              )}
            </FormField>
            <FormField label="说明">
              {({ controlId }) => (
                <Textarea
                  id={controlId}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  value={description}
                />
              )}
            </FormField>
            {editingTaxonomy ? (
              <FormField label="状态">
                {({ controlId }) => (
                  <select
                    className="integration-select"
                    id={controlId}
                    onChange={(event) => setStatusValue(event.target.value as typeof statusValue)}
                    value={statusValue}
                  >
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
                )}
              </FormField>
            ) : null}
            {error ? <p className="auth-error">{error}</p> : null}
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={termDialog} onOpenChange={setTermDialog}>
        <DialogContent
          header={
            <DialogHeader
              title={editingTerm ? '编辑分类词条' : '新建分类词条'}
              description={selectedTaxonomy?.name}
            />
          }
          footer={
            <DialogFooter>
              <Button onClick={() => setTermDialog(false)} variant="secondary">
                取消
              </Button>
              <Button form="term-form" loading={submitting} type="submit">
                保存词条
              </Button>
            </DialogFooter>
          }
        >
          <form className="integration-form" id="term-form" onSubmit={submitTerm}>
            {!editingTerm ? (
              <FormField label="词条代码" required>
                {({ controlId }) => (
                  <Input
                    id={controlId}
                    onChange={(event) => setCode(event.target.value)}
                    required
                    value={code}
                  />
                )}
              </FormField>
            ) : null}
            <FormField label="名称" required>
              {({ controlId }) => (
                <Input
                  id={controlId}
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
              )}
            </FormField>
            {selectedTaxonomy?.hierarchical ? (
              <FormField label="父级">
                {({ controlId }) => (
                  <select
                    className="integration-select"
                    id={controlId}
                    onChange={(event) => setParentId(event.target.value)}
                    value={parentId}
                  >
                    <option value="">无父级</option>
                    {terms
                      .filter((term) => term.id !== editingTerm?.id)
                      .map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.name}
                        </option>
                      ))}
                  </select>
                )}
              </FormField>
            ) : null}
            <FormField label="颜色">
              {({ controlId }) => (
                <Input
                  id={controlId}
                  onChange={(event) => setColor(event.target.value)}
                  placeholder="#4f7a61"
                  type="color"
                  value={color || '#4f7a61'}
                />
              )}
            </FormField>
            <FormField label="排序">
              {({ controlId }) => (
                <Input
                  id={controlId}
                  onChange={(event) => setSortOrder(Number(event.target.value))}
                  type="number"
                  value={sortOrder}
                />
              )}
            </FormField>
            <FormField label="状态">
              {({ controlId }) => (
                <select
                  className="integration-select"
                  id={controlId}
                  onChange={(event) => setStatusValue(event.target.value as typeof statusValue)}
                  value={statusValue}
                >
                  <option value="active">启用</option>
                  <option value="inactive">停用</option>
                </select>
              )}
            </FormField>
            {error ? <p className="auth-error">{error}</p> : null}
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={exchangeDialog} onOpenChange={setExchangeDialog}>
        <DialogContent
          header={
            <DialogHeader
              title="导入数据集"
              description="上传或粘贴由同一适配器导出的版本化 JSON；预检不会写入数据库。"
            />
          }
          footer={
            <DialogFooter>
              <Button onClick={() => setExchangeDialog(false)} variant="secondary">
                取消
              </Button>
              <Button loading={submitting} onClick={() => void previewImport()} variant="secondary">
                预检
              </Button>
              <Button
                disabled={!preview?.valid}
                loading={submitting}
                onClick={() => void applyImport()}
              >
                应用导入
              </Button>
            </DialogFooter>
          }
        >
          <div className="integration-form">
            <FormField label="数据集" required>
              {({ controlId }) => (
                <select
                  className="integration-select"
                  id={controlId}
                  onChange={(event) => {
                    setDatasetCode(event.target.value);
                    setPreview(null);
                  }}
                  value={datasetCode}
                >
                  {datasets.map((dataset) => (
                    <option key={dataset.code} value={dataset.code}>
                      {dataset.name}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField description="文件内容只在浏览器读取，然后发送到预检接口。" label="JSON 文件">
              {({ controlId }) => (
                <Input
                  accept="application/json,.json"
                  id={controlId}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file)
                      void file.text().then((text) => {
                        setDocumentText(text);
                        setPreview(null);
                      });
                  }}
                  type="file"
                />
              )}
            </FormField>
            <FormField label="JSON 内容" required>
              {({ controlId }) => (
                <Textarea
                  id={controlId}
                  onChange={(event) => {
                    setDocumentText(event.target.value);
                    setPreview(null);
                  }}
                  required
                  rows={10}
                  value={documentText}
                />
              )}
            </FormField>
            {preview ? (
              <div
                className={preview.valid ? 'exchange-preview success' : 'exchange-preview error'}
              >
                <strong>{preview.valid ? '预检通过' : '预检未通过'}</strong>
                <span>
                  {preview.recordCount} 条记录 · 新增 {preview.creates} · 更新 {preview.updates}
                </span>
                {preview.errors.map((item) => (
                  <small key={item}>{item}</small>
                ))}
              </div>
            ) : null}
            {error ? <p className="auth-error">{error}</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
