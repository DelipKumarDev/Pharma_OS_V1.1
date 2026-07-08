import type { ID, Timestamp } from './common';

export interface Notification {
  id: ID;
  title: string;
  message: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: 'info' | 'warning' | 'critical';
  isRead: boolean;
  actionUrl?: string;
  actionLabel?: string;
  entityId?: ID;
  entityName?: string;
  createdAt: Timestamp;
  readAt?: Timestamp;
}

export type NotificationType =
  | 'expiry_alert'
  | 'low_stock'
  | 'out_of_stock'
  | 'reorder_due'
  | 'payment_due'
  | 'sync_failure'
  | 'backup_failure'
  | 'login_alert'
  | 'approval_required'
  | 'customer_due'
  | 'system';

export type NotificationCategory =
  | 'inventory'
  | 'billing'
  | 'vendor'
  | 'system'
  | 'customer'
  | 'security';

export interface NotificationStats {
  totalUnread: number;
  criticalUnread: number;
  warningUnread: number;
  infoUnread: number;
  todayTotal: number;
}
