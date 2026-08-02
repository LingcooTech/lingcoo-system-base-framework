/* eslint-disable react-refresh/only-export-components */
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

interface RouterValue {
  pathname: string;
  navigate(pathname: string): void;
}

const RouterContext = createContext<RouterValue | null>(null);
const basePath = '/admin';

function readPathname() {
  const pathname = window.location.pathname;
  return (pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname) || '/';
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(readPathname);

  useEffect(() => {
    const handlePopState = () => setPathname(readPathname());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const value = useMemo<RouterValue>(
    () => ({
      pathname,
      navigate(nextPathname) {
        const target = `${basePath}${nextPathname === '/' ? '/' : nextPathname}`;
        window.history.pushState({}, '', target);
        setPathname(nextPathname);
      },
    }),
    [pathname],
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const value = useContext(RouterContext);
  if (!value) throw new Error('useRouter must be used inside RouterProvider');
  return value;
}

export function Link({
  href,
  className,
  title,
  onNavigate,
  ...rest
}: {
  href: string;
  className?: string;
  title?: string;
  onNavigate?(): void;
} & Omit<ComponentPropsWithoutRef<'a'>, 'href' | 'className' | 'title' | 'onClick'>) {
  const { navigate } = useRouter();
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    navigate(href);
    onNavigate?.();
  }
  return (
    <a
      className={className}
      href={`${basePath}${href}`}
      onClick={handleClick}
      title={title}
      {...rest}
    />
  );
}
