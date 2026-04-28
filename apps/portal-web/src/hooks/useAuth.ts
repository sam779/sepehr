import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';
import type { User } from '@sepehr/shared-types';

export function useAuth() {
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.auth.me();
      if (!res.ok) return null;
      return res.data ?? null;
    },
    retry: false,
    staleTime: 5 * 60_000,
  });

  const logout = async () => {
    await api.auth.logout();
    qc.clear();
    window.location.href = '/';
  };

  return {
    user: (data ?? null) as User | null,
    isLoading,
    isError: !!error,
    logout,
  };
}
