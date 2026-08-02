import { Dialog, DialogContent, DialogHeader } from '@lingcoo/frame-ui/dialog';
import { Input } from '@lingcoo/frame-ui/input';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { searchResources, type SearchGroup } from '../../api/client';
import { useRouter } from '../../lib/router';

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { navigate } = useRouter();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (query.trim().length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setStatus('loading');
      searchResources(query.trim())
        .then((result) => {
          if (active) {
            setGroups(result);
            setStatus('ready');
          }
        })
        .catch(() => {
          if (active) setStatus('error');
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  function openResult(href: string) {
    navigate(href);
    changeOpen(false);
  }

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery('');
      setGroups([]);
      setStatus('idle');
    }
    onOpenChange(nextOpen);
  }

  function changeQuery(nextQuery: string) {
    setQuery(nextQuery);
    if (nextQuery.trim().length < 2) {
      setGroups([]);
      setStatus('idle');
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className="global-search-dialog"
        header={
          <DialogHeader title="统一搜索" description="只搜索当前账号有权访问的已注册资源。" />
        }
        size="lg"
      >
        <Input
          autoFocus
          onChange={(event) => changeQuery(event.target.value)}
          placeholder="输入至少两个字符，搜索账号、资产、连接、字典和分类法"
          prefix={<Search size={16} />}
          value={query}
        />
        <div className="global-search-results">
          {groups.map((group) => (
            <section key={group.source}>
              <h3>{group.label}</h3>
              {group.items.map((item) => (
                <button
                  key={`${item.source}-${item.id}`}
                  onClick={() => openResult(item.href)}
                  type="button"
                >
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  <code>{item.kind}</code>
                </button>
              ))}
            </section>
          ))}
          {status === 'idle' ? <p>输入名称、代码、邮箱或对象键开始搜索。</p> : null}
          {status === 'loading' ? <p>正在搜索已注册资源…</p> : null}
          {status === 'ready' && groups.length === 0 ? <p>没有找到匹配资源。</p> : null}
          {status === 'error' ? <p className="error">搜索暂时不可用，请稍后重试。</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
