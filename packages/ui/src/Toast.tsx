import * as RadixToast from '@radix-ui/react-toast';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface ToastMessage {
  id: number;
  title: ReactNode;
  description?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export type ToastInput = Omit<ToastMessage, 'id'>;

interface ToastContextValue {
  toast: (input: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);
  const toast = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setMessages((current) => [...current, { ...input, id }].slice(-4));
    return id;
  }, []);
  const value = useMemo(() => ({ dismiss, toast }), [dismiss, toast]);
  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider duration={5000} swipeDirection="right">
        {children}
        {messages.map((message) => (
          <RadixToast.Root
            className={`lc-toast lc-toast--${message.tone ?? 'default'}`}
            duration={message.duration}
            key={message.id}
            onOpenChange={(open) => {
              if (!open) dismiss(message.id);
            }}
            open
          >
            <div className="lc-toast__content">
              <RadixToast.Title className="lc-toast__title">{message.title}</RadixToast.Title>
              {message.description ? (
                <RadixToast.Description className="lc-toast__description">
                  {message.description}
                </RadixToast.Description>
              ) : null}
            </div>
            {message.action ? (
              <RadixToast.Action altText={message.action.label} asChild>
                <button className="lc-toast__action" onClick={message.action.onClick} type="button">
                  {message.action.label}
                </button>
              </RadixToast.Action>
            ) : null}
            <RadixToast.Close aria-label="关闭通知" className="lc-toast__close">
              ×
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="lc-toast-viewport" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
