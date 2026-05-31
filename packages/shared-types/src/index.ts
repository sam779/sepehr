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
  isConnected: boolean;
  lastSeenAt: string | null;
  connectionCountry: string | null;
  createdAt: string;
}

export interface ConnectionLog {
  id: string;
  relayUserId: string;
  event: 'connect' | 'disconnect' | 'error' | 'auth_failed';
  country: string | null;
  errorMessage: string | null;
  timestamp: string;
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

// ─── Relay notification requests ────────────────────────────────────────────

export interface RelayLogEventRequest {
  relay_id: string;
  user_id: string;
  event: 'connect' | 'disconnect' | 'error' | 'auth_failed';
  country?: string;
  error_message?: string;
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
  hash: string;   // SHA224(trojanPassword) hex — sent as-is by relay Worker
  relay_id: string;
}

export interface RelayCheckResponse {
  valid: boolean;
  paused: boolean;
}

export interface RelayNotifyRequest {
  relay_id: string;
  event: string;
  user_id?: string;
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
