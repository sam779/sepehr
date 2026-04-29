import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client.js';
import type { DeployRelayRequest } from '@sepehr/shared-types';

export function useRelay() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['relay'],
    queryFn: async () => {
      const res = await api.relay.get();
      if (!res.ok) throw new Error(res.error);
      return res.data ?? null;
    },
  });

  const deploy = useMutation({
    mutationFn: async (body: DeployRelayRequest) => {
      const res = await api.relay.deploy(body);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relay'] }),
  });

  const redeploy = useMutation({
    mutationFn: async () => {
      const res = await api.relay.redeploy();
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relay'] }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const res = await api.relay.delete();
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      qc.setQueryData(['relay'], null);
      qc.invalidateQueries({ queryKey: ['relay-users'] });
    },
  });

  return { relay: query.data ?? null, isLoading: query.isLoading, dataUpdatedAt: query.dataUpdatedAt, refetch: query.refetch, deploy, redeploy, remove };
}
