import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';

export function useConnectionLogs(userId: string) {
  return useQuery({
    queryKey: ['logs', userId],
    queryFn: async () => {
      const res = await api.users.logs(userId);
      if (!res.ok) throw new Error(res.error);
      return res.data ?? [];
    },
    staleTime: 30_000,
  });
}
