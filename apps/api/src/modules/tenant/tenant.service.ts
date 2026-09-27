import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { hashPassword } from '../../utils/password';
import { createAuditLog } from '../../utils/audit';
import { sendMail } from '../../utils/mailer';
import { ensurePermissionCatalog, ensureDefaultRoles } from './tenant.defaults';
import { TenantStatus, TenantType, TenantPlan } from '@prisma/client';

export interface Actor { sub: string; name: string; tenantId: string }

export interface ProvisionInput {
  name: string;
  slug?: string;
  type?: string;
  plan?: string;
  phone?: string; email?: string;
  addressLine1?: string; city?: string; state?: string; pincode?: string;
  gstNumber?: string; drugLicenseNumber?: string; licenseNumber?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
}

const OPERATIONAL: TenantStatus[] = ['active', 'trial'];
export function isTenantOperational(status: TenantStatus, deletedAt: Date | null): boolean {
  return !deletedAt && OPERATIONAL.includes(status);
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// Strong temporary password: guarantees the password policy (upper/lower/digit/special, 14 chars).
function genTempPassword(): string {
  const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', L = 'abcdefghijkmnpqrstuvwxyz', D = '23456789', S = '@$!%*?&#';
  const all = U + L + D + S;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  let pw = pick(U) + pick(L) + pick(D) + pick(S);
  for (let i = 0; i < 10; i++) pw += pick(all);
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Idempotently provision a pharmacy tenant: Tenant → default Roles/Permissions →
 * Owner (temp password, must-change) → Audit → invite email. Re-running with the
 * same slug/owner does NOT create duplicates; a temp password is returned only
 * when the owner is newly created.
 */
export async function provisionTenant(input: ProvisionInput, actor: Actor) {
  if (!input.name?.trim()) throw new AppError('Pharmacy name is required', 422);
  if (!input.ownerName?.trim()) throw new AppError('Owner name is required', 422);
  if (!input.ownerEmail?.trim()) throw new AppError('Owner email is required', 422);
  const slug = input.slug?.trim() || slugify(input.name);
  if (!slug) throw new AppError('Could not derive a valid slug from the name', 422);

  const result = await prisma.$transaction(async tx => {
    let tenant = await tx.tenant.findFirst({ where: { slug } });
    let tenantCreated = false;
    if (tenant?.deletedAt) {
      throw new AppError(`A tenant with slug "${slug}" was previously deactivated. Use a different slug or restore it.`, 409);
    }
    if (!tenant) {
      tenant = await tx.tenant.create({
        data: {
          name: input.name.trim(),
          slug,
          type: (input.type as TenantType) ?? 'retail',
          status: 'trial',
          plan: (input.plan as TenantPlan) ?? 'starter',
          phone: input.phone, email: input.email,
          addressLine1: input.addressLine1, city: input.city, state: input.state, pincode: input.pincode,
          gstNumber: input.gstNumber, drugLicenseNumber: input.drugLicenseNumber, licenseNumber: input.licenseNumber,
        },
      });
      tenantCreated = true;
    }

    const permByKey = await ensurePermissionCatalog(tx);
    const ownerRoleId = await ensureDefaultRoles(tx, tenant.id, permByKey);

    let owner = await tx.user.findFirst({ where: { tenantId: tenant.id, email: input.ownerEmail.trim(), deletedAt: null } });
    let tempPassword: string | undefined;
    let ownerCreated = false;
    if (!owner) {
      tempPassword = genTempPassword();
      owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: input.ownerName.trim(),
          email: input.ownerEmail.trim(),
          phone: input.ownerPhone,
          passwordHash: await hashPassword(tempPassword),
          status: 'pending',
          mustChangePassword: true,
        },
      });
      await tx.userRole.create({ data: { userId: owner.id, roleId: ownerRoleId } });
      ownerCreated = true;
    }
    return { tenant, owner, tempPassword, tenantCreated, ownerCreated };
  });

  // Audit — platform actions are always logged (actor recorded).
  if (result.tenantCreated) {
    await createAuditLog({ tenantId: result.tenant.id, userId: actor.sub, userName: actor.name, module: 'platform', action: 'create', entityId: result.tenant.id, entityName: result.tenant.name, description: `Provisioned tenant "${result.tenant.name}" (${slug})`, severity: 'critical' });
  }
  if (result.ownerCreated) {
    await createAuditLog({ tenantId: result.tenant.id, userId: actor.sub, userName: actor.name, module: 'platform', action: 'create', entityId: result.owner.id, entityName: result.owner.email, description: `Created tenant owner ${result.owner.email}`, severity: 'critical' });
    try {
      await sendMail({
        to: result.owner.email,
        subject: `Welcome to PharmaOS — ${result.tenant.name}`,
        html: `<p>Hello ${result.owner.name},</p><p>A PharmaOS account has been created for <b>${result.tenant.name}</b>.</p>
               <p><b>Pharmacy code:</b> ${slug}<br/><b>Email:</b> ${result.owner.email}<br/><b>Temporary password:</b> ${result.tempPassword}</p>
               <p>You will be required to set a new password on first sign-in.</p>`,
        text: `PharmaOS account for ${result.tenant.name}. Pharmacy code: ${slug}. Email: ${result.owner.email}. Temporary password: ${result.tempPassword}. You must change it on first sign-in.`,
      });
    } catch { /* email is best-effort; the temp password is also returned to the operator */ }
  }

  return {
    tenant: result.tenant,
    owner: { id: result.owner.id, email: result.owner.email, name: result.owner.name },
    tempPassword: result.tempPassword,       // present only when owner newly created
    alreadyExisted: !result.tenantCreated,
  };
}

// Platform admins see all tenants; regular users see only their own.
export async function listTenants(actor: Actor, isPlatform: boolean) {
  if (isPlatform) return prisma.tenant.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });
  const own = await prisma.tenant.findFirst({ where: { id: actor.tenantId, deletedAt: null } });
  return own ? [own] : [];
}

export async function getTenant(id: string, actor: Actor, isPlatform: boolean) {
  if (!isPlatform && id !== actor.tenantId) throw new AppError('Not found', 404);
  const tenant = await prisma.tenant.findFirst({ where: { id, deletedAt: null } });
  if (!tenant) throw new AppError('Not found', 404);
  return tenant;
}

export async function setTenantStatus(id: string, status: TenantStatus, actor: Actor) {
  const tenant = await prisma.tenant.findFirst({ where: { id, deletedAt: null } });
  if (!tenant) throw new AppError('Tenant not found', 404);
  const updated = await prisma.tenant.update({ where: { id }, data: { status } });
  // Suspending/expiring a tenant terminates its users' active sessions immediately.
  if (!OPERATIONAL.includes(status)) {
    await prisma.userSession.updateMany({ where: { tenantId: id, isActive: true }, data: { isActive: false, logoutAt: new Date() } });
    await prisma.refreshToken.updateMany({ where: { user: { tenantId: id } }, data: { revokedAt: new Date() } });
  }
  await createAuditLog({ tenantId: id, userId: actor.sub, userName: actor.name, module: 'platform', action: 'update', entityId: id, entityName: tenant.name, description: `Tenant status: ${tenant.status} → ${status}`, severity: 'critical' });
  return updated;
}

// Soft-deactivate a tenant (suspend + soft-delete). Reversible by restoring deletedAt/status.
export async function deactivateTenant(id: string, actor: Actor) {
  const tenant = await prisma.tenant.findFirst({ where: { id, deletedAt: null } });
  if (!tenant) throw new AppError('Tenant not found', 404);
  const updated = await prisma.tenant.update({ where: { id }, data: { status: 'suspended', deletedAt: new Date() } });
  await prisma.userSession.updateMany({ where: { tenantId: id, isActive: true }, data: { isActive: false, logoutAt: new Date() } });
  await prisma.refreshToken.updateMany({ where: { user: { tenantId: id } }, data: { revokedAt: new Date() } });
  await createAuditLog({ tenantId: id, userId: actor.sub, userName: actor.name, module: 'platform', action: 'delete', entityId: id, entityName: tenant.name, description: `Deactivated tenant "${tenant.name}"`, severity: 'critical' });
  return updated;
}

// Reset the tenant OWNER's password (the first Pharma Admin). Returns a temp
// password (must-change) and kills the owner's sessions/tokens.
export async function resetTenantAdmin(id: string, actor: Actor) {
  const tenant = await prisma.tenant.findFirst({ where: { id, deletedAt: null } });
  if (!tenant) throw new AppError('Tenant not found', 404);
  const owner = await prisma.user.findFirst({
    where: { tenantId: id, deletedAt: null, userRoles: { some: { role: { name: 'Pharma Admin' } } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!owner) throw new AppError('Tenant has no owner (Pharma Admin) to reset', 404);

  const tempPassword = genTempPassword();
  await prisma.user.update({ where: { id: owner.id }, data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true, failedLoginAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() } });
  await prisma.refreshToken.updateMany({ where: { userId: owner.id }, data: { revokedAt: new Date() } });
  await prisma.userSession.updateMany({ where: { userId: owner.id, isActive: true }, data: { isActive: false, logoutAt: new Date() } });
  await createAuditLog({ tenantId: id, userId: actor.sub, userName: actor.name, module: 'platform', action: 'update', entityId: owner.id, entityName: owner.email, description: `Reset tenant admin password for ${owner.email}`, severity: 'critical' });
  return { ownerEmail: owner.email, tempPassword };
}

// Tenant health/metadata for the platform console.
export async function getTenantHealth(id: string) {
  const tenant = await prisma.tenant.findFirst({ where: { id } });
  if (!tenant) throw new AppError('Tenant not found', 404);
  const [users, activeUsers, medicines, bills, lastSession] = await Promise.all([
    prisma.user.count({ where: { tenantId: id, deletedAt: null } }),
    prisma.user.count({ where: { tenantId: id, deletedAt: null, status: 'active' } }),
    prisma.medicine.count({ where: { tenantId: id, deletedAt: null } }),
    prisma.bill.count({ where: { tenantId: id, deletedAt: null } }),
    prisma.userSession.findFirst({ where: { tenantId: id }, orderBy: { loginAt: 'desc' }, select: { loginAt: true } }),
  ]);
  return {
    id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status, plan: tenant.plan,
    deleted: !!tenant.deletedAt, createdAt: tenant.createdAt,
    metadata: { gstNumber: tenant.gstNumber, drugLicenseNumber: tenant.drugLicenseNumber, city: tenant.city, state: tenant.state },
    health: { users, activeUsers, medicines, bills, lastActivityAt: lastSession?.loginAt ?? null },
  };
}
