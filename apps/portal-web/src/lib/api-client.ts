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
  SignupRequest,
  LoginRequest,
  VerifyEmailRequest,
  ResendVerificationRequest,
  DeployRelayRequest,
  CreateRelayUserRequest,
  PatchRelayUserRequest,
} from '@sepehr/shared-types';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  return res.json() as Promise<ApiResponse<T>>;
}

function json(method: string, body: unknown, init?: RequestInit): RequestInit {
  return { method, body: JSON.stringify(body), ...init };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    me: () => request<User>('/auth/me'),
    signup: (body: SignupRequest) => request<undefined>('/auth/signup', json('POST', body)),
    login: (body: LoginRequest) => request<User>('/auth/login', json('POST', body)),
    logout: () => request<undefined>('/auth/logout', { method: 'POST' }),
    verifyEmail: (body: VerifyEmailRequest) =>
      request<User>('/auth/verify-email', json('POST', body)),
    resendVerification: (body: ResendVerificationRequest) =>
      request<undefined>('/auth/resend-verification', json('POST', body)),
  },

  relay: {
    get: () => request<Relay | null>('/relay'),
    deploy: (body: DeployRelayRequest) => request<Relay>('/relay/deploy', json('POST', body)),
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
  },
};
