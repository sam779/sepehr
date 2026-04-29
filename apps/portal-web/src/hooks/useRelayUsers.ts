import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';
import type { CreateRelayUserRequest, PatchRelayUserRequest } from '@sepehr/shared-types';

export function useRelayUsers() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['relay-users'],
    queryFn: async () => {
      const res = await api.users.list();
      if (!res.ok) throw new Error(res.error);
      return res.data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (body: CreateRelayUserRequest) => {
      const res = await api.users.create(body);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relay-users'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.users.delete(id);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relay-users'] }),
  });

  const patch = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: PatchRelayUserRequest }) => {
      const res = await api.users.patch(id, body);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relay-users'] }),
  });

  const rotate = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.users.rotate(id);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  return { users: query.data ?? [], isLoading: query.isLoading, dataUpdatedAt: query.dataUpdatedAt, refetch: query.refetch, create, remove, patch, rotate };
}
