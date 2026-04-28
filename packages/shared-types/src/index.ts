// ─── Domain entities ────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface Relay {
  id: string;
  workerName: string;
  workerUrl: string;
  cfAccountId: string;
  relayStatus: 'active' | 'paused';
  createdAt: string;
  userCount: number;
}

export interface RelayUser {
  id: string;
  relayId: string;
  displayName: string;
  isActive: boolean;
  isPaused: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

/** Returned only once, at creation or rotation. Never returned again. */
export interface RelayUserConfig {
  trojanUri: string;
  clashYaml: string;
  debugJson: Record<string, unknown>;
  qrData: string;
  shareUrl: string;
}

// ─── Auth requests ───────────────────────────────────────────────────────────

export interface SignupRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ResendVerificationRequest {
  email: string;
}

// ─── Relay requests ──────────────────────────────────────────────────────────

export interface DeployRelayRequest {
  cfAccountId: string;
  cfApiToken: string;
}

export interface CreateRelayUserRequest {
  displayName: string;
}

export interface PatchRelayUserRequest {
  displayName?: string;
  isPaused?: boolean;
}

// ─── Internal relay endpoints ────────────────────────────────────────────────

export interface RelayCheckRequest {
  password: string;
  relay_id: string;
}

export interface RelayCheckResponse {
  valid: boolean;
  paused: boolean;
}

export interface RelayNotifyRequest {
  relay_id: string;
  event: string;
}

// ─── Generic API envelope ────────────────────────────────────────────────────

export interface ApiOk<T = undefined> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiResponse<T = undefined> = ApiOk<T> | ApiError;
