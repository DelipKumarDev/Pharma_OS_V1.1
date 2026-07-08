import type { ID, Timestamp } from './common';

export interface AuditLog {
  id: ID;
  userId: ID;
  userName: string;
  userRole: string;
  module: AuditModule;
  action: AuditAction;
  entityId?: ID;
  entityName?: string;
  description: string;
  beforeValue?: Record<string, unknown>;
  afterValue?: Record<string, unknown>;
  ipAddress?: string;
  deviceInfo?: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'success' | 'failed' | 'blocked';
  createdAt: Timestamp;
}

export type AuditModule =
  | 'billing'
  | 'inventory'
  | 'medicine'
  | 'vendor'
  | 'user'
  | 'settings'
  | 'auth'
  | 'report'
  | 'customer'
  | 'reorder';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'export'
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'adjust'
  | 'payment'
  | 'print';

export interface UserSession {
  id: ID;
  userId: ID;
  userName: string;
  userRole: string;
  loginAt: Timestamp;
  logoutAt?: Timestamp;
  deviceInfo?: string;
  ipAddress?: string;
  isActive: boolean;
  actionsCount: number;
}

export interface SecurityEvent {
  id: ID;
  eventType: 'failed_login' | 'suspicious_activity' | 'unauthorized_access' | 'permission_change' | 'password_change';
  userId?: ID;
  userName?: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isResolved: boolean;
  createdAt: Timestamp;
}

export interface AuditStats {
  totalLogsToday: number;
  criticalActions: number;
  failedActions: number;
  activeUsers: number;
  sensitiveActionsToday: number;
  totalSessions: number;
}
