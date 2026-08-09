import { Badge, type BadgeTone } from '@lingcootech/frame-ui/badge';
import { Button } from '@lingcootech/frame-ui/button';
import { Checkbox } from '@lingcootech/frame-ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@lingcootech/frame-ui/dialog';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader } from '@lingcootech/frame-ui/drawer';
import { EmptyState } from '@lingcootech/frame-ui/empty-state';
import { Pagination } from '@lingcootech/frame-ui/pagination';
import { Skeleton } from '@lingcootech/frame-ui/skeleton';
import { Image, Search, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormHTMLAttributes,
  type ReactNode,
} from 'react';

export interface AdminPageSection {
  group: string;
  title: string;
  description: string;
  context?: readonly { label: string; value: string; note: string }[];
}

export function PageFrame({
  badge,
  children,
  section,
}: {
  badge?: ReactNode;
  children: ReactNode;
  section: AdminPageSection;
}) {
  return (
    <div className="page-frame">
      <section className="page-hero">
        <div>
          <p className="eyebrow">{section.group}</p>
          <h1>{section.title}</h1>
          <p className="page-lead">{section.description}</p>
        </div>
        {badge ? <span className="framework-label">{badge}</span> : null}
      </section>
      {section.context?.length ? (
        <div className="context-grid">
          {section.context.map((card) => (
            <article key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p>{card.note}</p>
            </article>
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function ResourceSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="resource-section">
      <header>
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </header>
      <div>{children}</div>
    </section>
  );
}

export type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export function StatusPill({ children, tone }: { children: string; tone: StatusTone }) {
  const badgeTone: BadgeTone = tone === 'ok' ? 'success' : tone === 'warn' ? 'warning' : tone;
  return (
    <Badge dot tone={badgeTone}>
      {children}
    </Badge>
  );
}

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  cell(row: Row): ReactNode;
  align?: 'left' | 'right';
}

export function DataTable<Row>({
  columns,
  emptyTitle = '暂无资源',
  getRowKey,
  loading = false,
  onSelectionChange,
  rows,
  selectedKeys = [],
}: {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey(row: Row): string;
  emptyTitle?: string;
  loading?: boolean;
  onSelectionChange?: (keys: string[]) => void;
  selectedKeys?: string[];
}) {
  if (!loading && rows.length === 0) return <EmptyState compact title={emptyTitle} />;
  const selectable = Boolean(onSelectionChange);
  const rowKeys = rows.map(getRowKey);
  const allSelected = rowKeys.length > 0 && rowKeys.every((key) => selectedKeys.includes(key));
  const someSelected = rowKeys.some((key) => selectedKeys.includes(key));
  const toggle = (key: string, checked: boolean) =>
    onSelectionChange?.(
      checked ? [...new Set([...selectedKeys, key])] : selectedKeys.filter((item) => item !== key),
    );
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {selectable ? (
              <th className="data-table__selection">
                <Checkbox
                  aria-label="选择当前页全部项目"
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={(checked) =>
                    onSelectionChange?.(
                      checked === true
                        ? [...new Set([...selectedKeys, ...rowKeys])]
                        : selectedKeys.filter((key) => !rowKeys.includes(key)),
                    )
                  }
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th className={column.align === 'right' ? 'align-right' : undefined} key={column.key}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, rowIndex) => (
                <tr key={`loading-${rowIndex}`}>
                  {selectable ? <td className="data-table__selection" /> : null}
                  {columns.map((column) => (
                    <td key={column.key}>
                      <Skeleton
                        style={{ height: 18, width: column.align === 'right' ? 70 : '80%' }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  data-selected={selectedKeys.includes(getRowKey(row)) || undefined}
                  key={getRowKey(row)}
                >
                  {selectable ? (
                    <td className="data-table__selection">
                      <Checkbox
                        aria-label="选择项目"
                        checked={selectedKeys.includes(getRowKey(row))}
                        onCheckedChange={(checked) => toggle(getRowKey(row), checked === true)}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td
                      className={column.align === 'right' ? 'align-right' : undefined}
                      key={column.key}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPagination({
  onPageChange,
  page,
  pageSize,
  total,
}: {
  onPageChange(page: number): void;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="admin-pagination">
      <span>
        第 {page} / {pageCount} 页 · 共 {total} 条
      </span>
      <Pagination
        nextLabel="下一页"
        onPageChange={onPageChange}
        page={page}
        pageCount={pageCount}
        previousLabel="上一页"
      />
    </div>
  );
}

export function FilterBar({
  actions,
  children,
  onReset,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { actions?: ReactNode; onReset?: () => void }) {
  return (
    <form className="admin-filter-bar" {...props}>
      <Search aria-hidden size={16} />
      <div className="admin-filter-bar__fields">{children}</div>
      <div className="admin-filter-bar__actions">
        {onReset ? (
          <Button aria-label="重置筛选" onClick={onReset} size="sm" type="button" variant="ghost">
            <X size={15} />
          </Button>
        ) : null}
        {actions}
      </div>
    </form>
  );
}

export function BulkActionBar({
  children,
  onClear,
  selectedCount,
}: {
  children: ReactNode;
  onClear(): void;
  selectedCount: number;
}) {
  if (!selectedCount) return null;
  return (
    <div className="admin-bulk-bar" role="region" aria-label="批量操作">
      <strong>已选择 {selectedCount} 项</strong>
      <div>{children}</div>
      <Button aria-label="清除选择" onClick={onClear} size="sm" variant="ghost">
        <X size={15} />
      </Button>
    </div>
  );
}

export function DetailDrawer({
  children,
  description,
  footer,
  onOpenChange,
  open,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  onOpenChange(open: boolean): void;
  open: boolean;
  title: ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="admin-detail-drawer"
        footer={footer ? <DrawerFooter>{footer}</DrawerFooter> : undefined}
        header={<DrawerHeader description={description} title={title} />}
      >
        {children}
      </DrawerContent>
    </Drawer>
  );
}

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);
  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={Boolean(options)} onOpenChange={(open) => !open && settle(false)}>
        <DialogContent
          footer={
            <DialogFooter>
              <Button onClick={() => settle(false)} variant="ghost">
                {options?.cancelLabel ?? '取消'}
              </Button>
              <Button
                onClick={() => settle(true)}
                variant={options?.tone === 'danger' ? 'danger' : 'primary'}
              >
                {options?.confirmLabel ?? '确认'}
              </Button>
            </DialogFooter>
          }
          header={
            <DialogHeader
              closable={false}
              description={options?.description}
              title={options?.title ?? '确认操作'}
            />
          }
          size="sm"
        >
          <span className="confirm-dialog-spacer" />
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used inside ConfirmProvider');
  return context;
}

export interface AdminAssetOption {
  id: string;
  displayName: string;
  publicUrl: string | null;
  status: string;
  visibility: string;
  mediaKind: string;
}

export function AssetPicker<TAsset extends AdminAssetOption>({
  asset,
  disabled = false,
  label,
  loadAssets,
  onChange,
  value,
}: {
  label: string;
  value: string | null;
  asset?: { displayName: string; publicUrl: string | null };
  disabled?: boolean;
  loadAssets(): Promise<{ items: TAsset[] } | TAsset[]>;
  onChange(value: string | null, asset?: TAsset): void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TAsset[]>([]);
  useEffect(() => {
    if (!open) return;
    loadAssets()
      .then((result) => {
        const assets = Array.isArray(result) ? result : result.items;
        setItems(
          assets.filter(
            (item) =>
              item.status === 'active' &&
              item.visibility === 'public' &&
              item.mediaKind === 'image' &&
              Boolean(item.publicUrl),
          ),
        );
      })
      .catch(() => setItems([]));
  }, [loadAssets, open]);
  return (
    <div className="brand-asset-field">
      <span>{label}</span>
      <div className="brand-asset-preview">
        {asset?.publicUrl ? (
          <img alt={asset.displayName} src={asset.publicUrl} />
        ) : (
          <Image size={22} />
        )}
      </div>
      <div>
        <strong>{asset?.displayName ?? '未设置'}</strong>
        <small>{value ?? '从媒体资源库选择公开图片'}</small>
      </div>
      <Button
        disabled={disabled}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="secondary"
      >
        选择
      </Button>
      {value && !disabled ? (
        <button
          aria-label={`清除${label}`}
          className="brand-asset-clear"
          onClick={() => onChange(null)}
          type="button"
        >
          <X size={15} />
        </button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          header={
            <DialogHeader title={`选择${label}`} description="仅显示已启用的公开图片资产。" />
          }
          size="lg"
        >
          <div className="asset-picker-grid">
            {items.map((item) => (
              <button
                className={item.id === value ? 'asset-picker-item selected' : 'asset-picker-item'}
                key={item.id}
                onClick={() => {
                  onChange(item.id, item);
                  setOpen(false);
                }}
                type="button"
              >
                <img alt="" src={item.publicUrl!} />
                <span>{item.displayName}</span>
              </button>
            ))}
            {!items.length ? (
              <p className="asset-picker-empty">媒体资源库中还没有可用的公开图片。</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
