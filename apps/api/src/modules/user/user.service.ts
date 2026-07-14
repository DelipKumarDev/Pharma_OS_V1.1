import { Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { hashPassword } from '../../utils/password';
import { createAuditLog } from '../../utils/audit';
import { paginate } from '../../utils/response';

export async function listUsers(tenantId: string) {
  const users = await prisma.user.findMany({
    where: { tenantId, deletedAt: null },
    include: { userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    orderBy: { name: 'asc' },
  });

  return paginate(users.map(u => ({
    id: u.id,
    tenantId: u.tenantId,
    name: u.name,
    email: u.email,
    phone: u.phone,
    status: u.status,
    mfaEnabled: u.mfaEnabled,
    avatarUrl: u.avatarUrl,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    roles: u.userRoles.map(ur => ({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description,
      permissions: ur.role.permissions.map(rp => rp.permission),
      isSystem: ur.role.isSystem,
      userCount: 0,
      createdAt: ur.role.createdAt,
    })),
  })), users.length, 1, 50);
}

export async function createUser(tenantId: string, input: Record<string, unknown>, userId: string, userName: string) {
  const name = input['name'] as string | undefined;
  const email = input['email'] as string | undefined;
  if (!name?.trim()) throw new AppError('User name is required', 422);
  if (!email?.trim()) throw new AppError('Email is required', 422);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Invalid email format', 422);

  const existing = await prisma.user.findFirst({ where: { tenantId, email } });
  if (existing) throw new AppError('User with this email already exists', 409);

  const passwordHash = await hashPassword('Welcome@123');

  const user = await prisma.user.create({
    data: {
      tenantId,
      name: input['name'] as string,
      email: input['email'] as string,
      phone: input['phone'] as string | undefined,
      passwordHash,
      status: 'pending',
      createdBy: userId,
      updatedBy: userId,
    },
  });

  const roleIds = (input['roleIds'] as string[]) ?? [];
  if (roleIds.length > 0) {
    await prisma.userRole.createMany({
      data: roleIds.map(roleId => ({ userId: user.id, roleId })),
    });
  }

  await createAuditLog({
    tenantId, userId, userName, module: 'user', action: 'create',
    entityId: user.id, entityName: user.name,
    description: `Invited new user: ${user.email}`,
  });

  return prisma.user.findUnique({
    where: { id: user.id },
    include: { userRoles: { include: { role: true } } },
  });
}

export async function updateUser(tenantId: string, id: string, input: Record<string, unknown>, userId: string, userName: string) {
  const existing = await prisma.user.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!existing) throw new AppError('User not found', 404);

  const { roleIds, ...rest } = input as { roleIds?: string[]; [key: string]: unknown };

  const updated = await prisma.$transaction(async tx => {
    const user = await tx.user.update({
      where: { id },
      data: { ...rest, updatedBy: userId } as Prisma.UserUncheckedUpdateInput,
    });

    if (roleIds) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      if (roleIds.length > 0) {
        await tx.userRole.createMany({ data: roleIds.map(roleId => ({ userId: id, roleId })) });
      }
    }

    return user;
  });

  await createAuditLog({
    tenantId, userId, userName, module: 'user', action: 'update',
    entityId: id, entityName: existing.name,
    description: `Updated user: ${existing.name}`,
    severity: 'critical',
  });

  return prisma.user.findUnique({ where: { id }, include: { userRoles: { include: { role: true } } } });
}

export async function toggleUserStatus(tenantId: string, id: string, status: UserStatus, userId: string, userName: string) {
  const user = await prisma.user.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!user) throw new AppError('User not found', 404);

  await prisma.user.update({ where: { id }, data: { status, updatedBy: userId } });

  await createAuditLog({
    tenantId, userId, userName, module: 'user', action: 'update',
    entityId: id, entityName: user.name,
    description: `User status changed to ${status}: ${user.name}`,
    severity: 'critical',
  });
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export async function listRoles(tenantId: string) {
  const roles = await prisma.role.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { userRoles: true } },
    },
    orderBy: { name: 'asc' },
  });

  return paginate(roles.map(r => ({
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    description: r.description,
    permissions: r.permissions.map(rp => rp.permission),
    isSystem: r.isSystem,
    userCount: r._count.userRoles,
    createdAt: r.createdAt,
  })), roles.length, 1, 20);
}

export async function getRoleById(tenantId: string, id: string) {
  const role = await prisma.role.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { permissions: { include: { permission: true } }, _count: { select: { userRoles: true } } },
  });
  if (!role) throw new AppError('Role not found', 404);
  return { ...role, userCount: role._count.userRoles };
}

export async function updateRole(tenantId: string, id: string, input: Record<string, unknown>, userId: string) {
  const role = await prisma.role.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!role) throw new AppError('Role not found', 404);
  if (role.isSystem) throw new AppError('Cannot modify system roles', 400);

  const updated = await prisma.role.update({
    where: { id },
    data: { name: input['name'] as string | undefined, description: input['description'] as string | undefined, updatedBy: userId },
    include: { permissions: { include: { permission: true } } },
  });

  const permissionIds = input['permissionIds'] as string[] | undefined;
  if (permissionIds) {
    await prisma.rolePermission.deleteMany({ where: { roleId: id } });
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({ data: permissionIds.map(pid => ({ roleId: id, permissionId: pid })) });
    }
  }

  return updated;
}

export async function createRole(tenantId: string, input: Record<string, unknown>, userId: string) {
  const dupRole = await prisma.role.findFirst({ where: { tenantId, name: input['name'] as string, deletedAt: null } });
  if (dupRole) throw new AppError('A role with this name already exists', 409);

  const role = await prisma.role.create({
    data: {
      tenantId,
      name: input['name'] as string,
      description: input['description'] as string | undefined,
      isSystem: false,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  const permissionIds = (input['permissionIds'] as string[]) ?? [];
  if (permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map(permissionId => ({ roleId: role.id, permissionId })),
    });
  }

  return prisma.role.findUnique({ where: { id: role.id }, include: { permissions: { include: { permission: true } } } });
}

export async function deleteRole(tenantId: string, id: string) {
  const role = await prisma.role.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!role) throw new AppError('Role not found', 404);
  if (role.isSystem) throw new AppError('Cannot delete system roles', 400);
  await prisma.role.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function listPermissions() {
  return prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
}
