import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from 'react';

export interface AdminRouterValue {
  basePath: string;
  pathname: string;
  searchParams: URLSearchParams;
  navigate(href: string): void;
}

const AdminRouterContext = createContext<AdminRouterValue | null>(null);

function normalizeBasePath(basePath: string) {
  const normalized = `/${basePath}`.replace(/\/+/g, '/').replace(/\/$/, '');
  return normalized === '/' ? '' : normalized;
}

function readLocation(basePath: string) {
  const pathname = window.location.pathname;
  const applicationPath = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length) || '/'
    : pathname || '/';
  return {
    pathname: applicationPath.startsWith('/') ? applicationPath : `/${applicationPath}`,
    searchParams: new URLSearchParams(window.location.search),
  };
}

export function AdminRouterProvider({
  basePath = '/admin',
  children,
}: {
  basePath?: string;
  children: ReactNode;
}) {
  const normalizedBasePath = normalizeBasePath(basePath);
  const [location, setLocation] = useState(() => readLocation(normalizedBasePath));

  useEffect(() => {
    const handlePopState = () => setLocation(readLocation(normalizedBasePath));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [normalizedBasePath]);

  const value = useMemo<AdminRouterValue>(
    () => ({
      basePath: normalizedBasePath,
      ...location,
      navigate(href) {
        const target = `${normalizedBasePath}${href === '/' ? '/' : href}`;
        window.history.pushState({}, '', target);
        setLocation(readLocation(normalizedBasePath));
      },
    }),
    [location, normalizedBasePath],
  );

  return <AdminRouterContext.Provider value={value}>{children}</AdminRouterContext.Provider>;
}

export function useAdminRouter() {
  const value = useContext(AdminRouterContext);
  if (!value) throw new Error('useAdminRouter must be used inside AdminRouterProvider');
  return value;
}

export function AdminLink({
  href,
  onNavigate,
  ...rest
}: {
  href: string;
  onNavigate?(): void;
} & Omit<ComponentPropsWithoutRef<'a'>, 'href' | 'onClick'>) {
  const { basePath, navigate } = useAdminRouter();
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    navigate(href);
    onNavigate?.();
  }
  return <a href={`${basePath}${href}`} onClick={handleClick} {...rest} />;
}
