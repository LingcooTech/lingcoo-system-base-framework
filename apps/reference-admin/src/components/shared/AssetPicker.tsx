import { Button } from '@lingcoo/frame-ui/button';
import { Dialog, DialogContent, DialogHeader } from '@lingcoo/frame-ui/dialog';
import { Image, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { fetchAssets, type StorageAsset } from '../../api/client';

export function AssetPicker({
  label,
  value,
  asset,
  disabled = false,
  onChange,
}: {
  label: string;
  value: string | null;
  asset?: { displayName: string; publicUrl: string | null };
  disabled?: boolean;
  onChange(value: string | null, asset?: StorageAsset): void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<StorageAsset[]>([]);

  useEffect(() => {
    if (!open) return;
    fetchAssets()
      .then((result) =>
        setItems(
          result.items.filter(
            (item) =>
              item.status === 'active' &&
              item.visibility === 'public' &&
              item.mediaKind === 'image' &&
              Boolean(item.publicUrl),
          ),
        ),
      )
      .catch(() => setItems([]));
  }, [open]);

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
