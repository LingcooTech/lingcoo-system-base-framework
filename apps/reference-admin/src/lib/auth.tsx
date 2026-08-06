/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  ApiError,
  changePassword as changePasswordRequest,
  fetchCurrentAccount,
  login as loginRequest,
  logout as logoutRequest,
  type AuthAccount,
} from '../api/client';

interface AuthContextValue {
  account: AuthAccount | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  changePassword(input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<void>;
  refresh(): Promise<void>;
  hasPermission(permission: string): boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setAccount(await fetchCurrentAccount());
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      setAccount(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchCurrentAccount()
      .then((currentAccount) => {
        if (active) setAccount(currentAccount);
      })
      .catch(() => {
        if (active) setAccount(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      loading,
      async login(email, password) {
        setAccount(await loginRequest(email, password));
      },
      async logout() {
        await logoutRequest().catch(() => undefined);
        setAccount(null);
      },
      async changePassword(input) {
        await changePasswordRequest(input);
        await refresh();
      },
      refresh,
      hasPermission(permission) {
        return account?.permissions.includes(permission) ?? false;
      },
    }),
    [account, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
