/* eslint-disable react-refresh/only-export-components */
import { Button } from '@lingcoo/frame-ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@lingcoo/frame-ui/dialog';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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
  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
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
