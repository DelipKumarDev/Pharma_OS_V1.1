import type { ID, Timestamp } from './common';

export interface LoginCredentials {
  email: string;
  password: string;
  tenantSlug?: string;
  rememberMe?: boolean;
}

export interface OtpVerification {
  sessionToken: string;
  otp: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: ID;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  tenantId: ID;
  tenantName: string;
  tenantSlug: string;
  /** Pharmacy logo (data URL / URL) shown in the app header, dashboard and receipts. */
  logoUrl?: string;
  /** Tenant localization (System Preferences) — currency code + numeric date format. */
  currency?: string;
  dateFormat?: string;
  supportContact?: string;
  /** Per-tenant configurable dropdown option lists, keyed by registry key (TC_028). */
  dropdownOptions?: Record<string, string[]>;
  /** Per-tenant configurable message templates (refill reminder, alerts…). */
  messageTemplates?: Record<string, string>;
  /** Menu keys (sidebar leaf hrefs) hidden for this user's role(s). */
  menuHidden?: string[];
  /** Per-tenant form-field configuration ({ [formId]: FieldConfig[] }). */
  formFields?: Record<string, unknown>;
  roles: string[];
  permissions: string[];
  mfaEnabled: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: Timestamp;
  passwordChangedAt?: Timestamp;
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface LoginPolicy {
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number;
  requireMfa: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
}

export interface AuthAuditLog {
  id: ID;
  userId: ID;
  userEmail: string;
  event: AuthEvent;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
  timestamp: Timestamp;
}

export type AuthEvent =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'mfa_success'
  | 'mfa_failed'
  | 'password_reset'
  | 'password_changed'
  | 'account_locked'
  | 'account_unlocked'
  | 'token_refreshed';
