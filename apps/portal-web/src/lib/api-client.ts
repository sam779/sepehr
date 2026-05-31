/**
 * Type-safe API client for the portal Worker.
 * All requests include credentials (session cookie).
 */
import type {
  ApiResponse,
  User,
  Relay,
  RelayUser,
  RelayUserConfig,
  ConnectionLog,
  SignupRequest,
  LoginRequest,
  VerifyEmailRequest,
  ResendVerificationRequest,
  DeployRelayRequest,
  CreateRelayUserRequest,
  PatchRelayUserRequest,
} from '@sepehr/shared-types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://portal-api.blackoutobservatory.org';

let sessionToken: string | null = null;

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  // Merge in any additional headers from init
  if (init?.headers) {
    const initHeaders = init.headers as Record<string, string> | undefined;
    if (initHeaders) Object.assign(headers, initHeaders);
  }


  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });

  return res.json() as Promise<ApiResponse<T>>;
}

export function setSessionToken(token: string | null) {
  sessionToken = token;
}
function json(method: string, body: unknown, init?: RequestInit): RequestInit {
  return { method, body: JSON.stringify(body), ...init };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    me: () => request<User>('/auth/me'),
    signup: (body: SignupRequest) => request<undefined>('/auth/signup', json('POST', body)),
    login: async (body: LoginRequest) => {
      const res = await request<User & { token: string }>('/auth/login', json('POST', body));
      if (res.ok && res.data?.token) {
        setSessionToken(res.data.token);
      }
      return res as ApiResponse<User>;
    },
    logout: () => {
      setSessionToken(null);
      return request<undefined>('/auth/logout', { method: 'POST' });
    },
    verifyEmail: async (body: VerifyEmailRequest) => {
      const res = await request<User & { token: string }>('/auth/verify-email', json('POST', body));
      if (res.ok && res.data?.token) {
        setSessionToken(res.data.token);
      }
      return res as ApiResponse<User>;
    },
    resendVerification: (body: ResendVerificationRequest) =>
      request<undefined>('/auth/resend-verification', json('POST', body)),
  },

  relay: {
    get: () => request<Relay | null>('/relay'),
    deploy: (body: DeployRelayRequest) => request<Relay>('/relay/deploy', json('POST', body)),
    redeploy: () => request<undefined>('/relay/redeploy', { method: 'POST' }),
    delete: () => request<undefined>('/relay', { method: 'DELETE' }),
  },

  users: {
    list: () => request<RelayUser[]>('/relay/users'),
    create: (body: CreateRelayUserRequest) =>
      request<RelayUser & RelayUserConfig>('/relay/users', json('POST', body)),
    delete: (id: string) => request<undefined>(`/relay/users/${id}`, { method: 'DELETE' }),
    patch: (id: string, body: PatchRelayUserRequest) =>
      request<undefined>(`/relay/users/${id}`, json('PATCH', body)),
    config: (id: string) => request<RelayUserConfig>(`/relay/users/${id}/config`),
    rotate: (id: string) => request<RelayUserConfig>(`/relay/users/${id}/rotate`, { method: 'POST' }),
    logs: (id: string) => request<ConnectionLog[]>(`/relay/users/${id}/logs`),
  },
};
