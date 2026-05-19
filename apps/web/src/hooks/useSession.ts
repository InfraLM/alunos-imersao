import { useEffect, useState, useCallback } from 'react';
import { api, ApiError, type MeResponse } from '@/lib/api';

interface SessionState {
  loading: boolean;
  user: MeResponse | null;
  error: string | null;
}

export function useSession() {
  const [state, setState] = useState<SessionState>({
    loading: true,
    user: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const me = await api.get<MeResponse>('/api/auth/me');
      setState({ loading: false, user: me, error: null });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setState({
        loading: false,
        user: null,
        error: status === 401 ? null : (err as Error).message,
      });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // ignore
    }
    setState({ loading: false, user: null, error: null });
  }, []);

  return { ...state, refresh, logout };
}
