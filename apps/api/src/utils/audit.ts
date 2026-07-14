import { prisma } from '../config/database';
import { AuditModule, AuditAction, AuditSeverity, AuditStatus } from '@prisma/client';

interface CreateAuditLogParams {
  tenantId: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  module: AuditModule;
  action: AuditAction;
  entityId?: string;
  entityName?: string;
  description: string;
  beforeValue?: Record<string, unknown>;
  afterValue?: Record<string, unknown>;
  ipAddress?: string;
  deviceInfo?: string;
  severity?: AuditSeverity;
  status?: AuditStatus;
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        userName: params.userName,
        userRole: params.userRole,
        module: params.module,
        action: params.action,
        entityId: params.entityId,
        entityName: params.entityName,
        description: params.description,
        beforeValue: params.beforeValue as import('@prisma/client').Prisma.InputJsonValue,
        afterValue: params.afterValue as import('@prisma/client').Prisma.InputJsonValue,
        ipAddress: params.ipAddress,
        deviceInfo: params.deviceInfo,
        severity: params.severity ?? 'info',
        status: params.status ?? 'success',
      },
    });
  } catch {
    // Audit log failure must never break the main operation
  }
}
