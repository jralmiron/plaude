'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MeResponse } from '@/components/types';

interface SessionState {
  loading: boolean;
  authenticated: boolean;
  data: MeResponse | null;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSessionProfile(): SessionState {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [data, setData] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/me', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        setAuthenticated(false);
        setData({ authenticated: false });
        return;
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'No se pudo cargar tu sesión');
      }
      const payload = (await res.json()) as MeResponse;
      setAuthenticated(Boolean(payload.authenticated && payload.user));
      setData(payload);
    } catch (err) {
      setAuthenticated(false);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, authenticated, data, error, refresh };
}
