import type { ID, Timestamp, Status, AuditFields } from './common';

export interface User {
  id: ID;
  tenantId: ID;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: UserStatus;
  roles: Role[];
  mfaEnabled: boolean;
  lastLoginAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type UserStatus = 'active' | 'inactive' | 'locked' | 'pending';

export interface Role {
  id: ID;
  tenantId: ID;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem: boolean;
  userCount?: number;
  createdAt: Timestamp;
}

export interface Permission {
  id: ID;
  module: string;
  action: PermissionAction;
  resource: string;
  description: string;
}

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'approve';

export interface CreateUserRequest {
  name: string;
  email: string;
  phone?: string;
  roleIds: ID[];
  sendInvite?: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  phone?: string;
  roleIds?: ID[];
  status?: UserStatus;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissionIds: ID[];
}
