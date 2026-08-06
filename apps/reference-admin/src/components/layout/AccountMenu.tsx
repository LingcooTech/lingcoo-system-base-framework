import { Avatar, AvatarFallback, AvatarImage } from '@lingcoo/frame-ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@lingcoo/frame-ui/dropdown-menu';
import { Bell, ChevronUp, LogOut, Settings2, ShieldCheck, UserRound } from 'lucide-react';

import type { AuthAccount } from '../../api/client';
import { Link } from '../../lib/router';

function getInitials(displayName: string) {
  return (
    displayName
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'LC'
  );
}

export function AccountMenu({
  account,
  collapsed,
  canReadNotifications,
  canReadSettings,
  onLogout,
  onNavigate,
}: {
  account: AuthAccount;
  collapsed: boolean;
  canReadNotifications: boolean;
  canReadSettings: boolean;
  onLogout(): void;
  onNavigate(): void;
}) {
  const roleNames = account.roles.map((role) => role.name).join('、') || '普通账号';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`${account.displayName}的账号菜单`}
          className={collapsed ? 'sidebar-account sidebar-account-collapsed' : 'sidebar-account'}
          type="button"
        >
          <Avatar>
            {account.avatarUrl ? <AvatarImage alt="" src={account.avatarUrl} /> : null}
            <AvatarFallback>{getInitials(account.displayName)}</AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <>
              <span className="sidebar-account-copy">
                <strong>{account.displayName}</strong>
                <small>{roleNames}</small>
              </span>
              <ChevronUp aria-hidden size={15} />
            </>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="account-dropdown" side="top">
        <DropdownMenuLabel>
          <span className="account-dropdown-name">{account.displayName}</span>
          <span className="account-dropdown-email">{account.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account" onNavigate={onNavigate}>
            <UserRound aria-hidden size={16} />
            个人中心
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account#security" onNavigate={onNavigate}>
            <ShieldCheck aria-hidden size={16} />
            账号安全
          </Link>
        </DropdownMenuItem>
        {canReadNotifications ? (
          <DropdownMenuItem asChild>
            <Link href="/notifications" onNavigate={onNavigate}>
              <Bell aria-hidden size={16} />
              通知中心
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canReadSettings ? (
          <DropdownMenuItem asChild>
            <Link href="/settings" onNavigate={onNavigate}>
              <Settings2 aria-hidden size={16} />
              系统设置
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} tone="danger">
          <LogOut aria-hidden size={16} />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
