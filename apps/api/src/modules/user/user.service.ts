import { Prisma, UserStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { hashPassword } from '../../utils/password';
import { createAuditLog } from '../../utils/audit';
import { paginate } from '../../utils/response';
import { sendMail } from '../../utils/mailer';

export async function listUsers(tenantId: string) {
  const users = await prisma.user.findMany({
    where: { tenantId, deletedAt: null },
    include: { userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    orderBy: { createdAt: 'desc' },
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

export async function getUserById(tenantId: string, id: string) {
  const u = await prisma.user.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: { userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!u) throw new AppError('User not found', 404);
  return {
    id: u.id, tenantId: u.tenantId, name: u.name, email: u.email, phone: u.phone,
    status: u.status, mfaEnabled: u.mfaEnabled, avatarUrl: u.avatarUrl,
    lastLoginAt: u.lastLoginAt, createdAt: u.createdAt, updatedAt: u.updatedAt,
    roles: u.userRoles.map(ur => ({ id: ur.role.id, name: ur.role.name, description: ur.role.description, permissions: ur.role.permissions.map(rp => rp.permission), isSystem: ur.role.isSystem })),
  };
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

  // Send the invite email (delivered when SMTP is configured; logged to console
  // otherwise). Never let a mail failure block user creation.
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
    await sendMail({
      to: user.email,
      subject: `You've been invited to ${tenant?.name ?? 'Pharma Ist'}`,
      html: `<p>Hi ${user.name},</p>
        <p>An account has been created for you at <b>${tenant?.name ?? 'Pharma Ist'}</b>.</p>
        <p><b>Sign in:</b> <a href="${appUrl}/login">${appUrl}/login</a><br/>
        <b>Email:</b> ${user.email}<br/>
        <b>Temporary password:</b> Welcome@123</p>
        <p>Please change your password after your first sign-in.</p>`,
      text: `Hi ${user.name}, an account was created for you at ${tenant?.name ?? 'Pharma Ist'}. Sign in at ${appUrl}/login with ${user.email} / Welcome@123 and change your password.`,
    });
  } catch { /* email is best-effort */ }

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

// Generate a strong temporary password that satisfies the login policy
// (>=8 chars, upper + lower + digit + special). Ambiguous chars are avoided.
function genTempPassword(): string {
  const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', L = 'abcdefghijkmnpqrstuvwxyz', D = '23456789', S = '@#$%*';
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pw = pick(U) + pick(L) + pick(D) + pick(S);
  const all = U + L + D;
  for (let i = 0; i < 6; i++) pw += pick(all);
  return pw;
}

// Admin-initiated password reset: sets a fresh temporary password, unlocks the
// account, and returns the temp password once for the admin to hand over.
export async function resetUserPassword(tenantId: string, id: string, adminId: string, adminName: string) {
  const user = await prisma.user.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!user) throw new AppError('User not found', 404);

  const tempPassword = genTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await prisma.user.update({
    where: { id },
    data: { passwordHash, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
  });
  // Invalidate the target user's existing tokens/sessions — an admin reset must
  // not leave the old credentials usable.
  await prisma.refreshToken.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } });
  await prisma.userSession.updateMany({ where: { userId: id, isActive: true }, data: { isActive: false, logoutAt: new Date() } });

  await createAuditLog({
    tenantId, userId: adminId, userName: adminName, module: 'user', action: 'update',
    entityId: id, entityName: user.name, severity: 'critical',
    description: `Reset password for ${user.name} (${user.email})`,
  });

  return { tempPassword };
}

export async function toggleUserStatus(tenantId: string, id: string, status: UserStatus, userId: string, userName: string) {
  const user = await prisma.user.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!user) throw new AppError('User not found', 404);

  await prisma.user.update({ where: { id }, data: { status, updatedBy: userId } });
  // Disabling an account terminates its active sessions immediately.
  if (status !== 'active') {
    await prisma.userSession.updateMany({ where: { userId: id, isActive: true }, data: { isActive: false, logoutAt: new Date() } });
    await prisma.refreshToken.updateMany({ where: { userId: id }, data: { revokedAt: new Date() } });
  }

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

// Privilege-escalation guard: a role may only be granted permissions that the
// ACTOR performing the change already holds (or a wildcard covering them), and
// every permissionId must resolve to a real permission. Prevents a user with
// (say) users:edit from minting a role carrying settings:edit or *:* and
// assigning themselves elevated access.
async function assertGrantablePermissions(permissionIds: string[] | undefined, actorPermissions: string[]) {
  if (!permissionIds || permissionIds.length === 0) return;
  const perms = await prisma.permission.findMany({ where: { id: { in: permissionIds } } });
  if (perms.length !== new Set(permissionIds).size) throw new AppError('One or more permissions are invalid', 422);
  const holds = (m: string, a: string) =>
    actorPermissions.includes('*:*') || actorPermissions.includes(`${m}:*`) || actorPermissions.includes(`${m}:${a}`);
  const ungrantable = perms.filter(p => !holds(p.module, p.action)).map(p => `${p.module}:${p.action}`);
  if (ungrantable.length) throw new AppError(`You cannot grant permissions you do not hold: ${ungrantable.join(', ')}`, 403);
}

export async function updateRole(tenantId: string, id: string, input: Record<string, unknown>, userId: string, actorPermissions: string[] = []) {
  const role = await prisma.role.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!role) throw new AppError('Role not found', 404);
  if (role.isSystem) throw new AppError('Cannot modify system roles', 400);
  await assertGrantablePermissions(input['permissionIds'] as string[] | undefined, actorPermissions);

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

export async function createRole(tenantId: string, input: Record<string, unknown>, userId: string, actorPermissions: string[] = []) {
  const dupRole = await prisma.role.findFirst({ where: { tenantId, name: input['name'] as string, deletedAt: null } });
  if (dupRole) throw new AppError('A role with this name already exists', 409);
  await assertGrantablePermissions(input['permissionIds'] as string[] | undefined, actorPermissions);

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
