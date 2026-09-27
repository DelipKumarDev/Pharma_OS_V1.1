import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess, sendError, paginate } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';
import { TenantStatus } from '@prisma/client';
import * as tenantService from './tenant.service';

const router = Router();
router.use(authenticate);

// A platform operator (has the platform:manage permission) can provision and
// manage every tenant. Regular tenant users are strictly self-scoped.
const isPlatform = (req: AuthRequest): boolean => {
  const p = req.user!.permissions;
  return p.includes('platform:manage') || p.includes('platform:*') || p.includes('*:*');
};
const actor = (req: AuthRequest): tenantService.Actor => ({ sub: req.user!.sub, name: req.user!.name, tenantId: req.user!.tenantId });

// List — platform sees all tenants; a regular user sees only their own.
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const list = await tenantService.listTenants(actor(req), isPlatform(req));
    sendSuccess(res, paginate(list, list.length, 1, Math.max(list.length, 1)));
  } catch (err) { next(err); }
});

// Provision a new pharmacy tenant (platform operator only). Idempotent.
router.post('/', requirePermission('platform', 'manage'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await tenantService.provisionTenant(req.body, actor(req));
    sendSuccess(res, result, result.alreadyExisted ? 'Tenant already existed (no changes)' : 'Tenant provisioned', result.alreadyExisted ? 200 : 201);
  } catch (err) { next(err); }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await tenantService.getTenant(req.params['id']!, actor(req), isPlatform(req))); } catch (err) { next(err); }
});

// Tenant health & metadata (platform console).
router.get('/:id/health', requirePermission('platform', 'manage'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await tenantService.getTenantHealth(req.params['id']!)); } catch (err) { next(err); }
});

// Lifecycle — activate / suspend / etc. (platform operator only).
router.patch('/:id/status', requirePermission('platform', 'manage'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = (req.body as { status?: string }).status as TenantStatus | undefined;
    const valid: TenantStatus[] = ['active', 'suspended', 'pending_verification', 'trial', 'expired'];
    if (!status || !valid.includes(status)) { sendError(res, `Invalid status. One of: ${valid.join(', ')}`, 422); return; }
    sendSuccess(res, await tenantService.setTenantStatus(req.params['id']!, status, actor(req)), 'Tenant status updated');
  } catch (err) { next(err); }
});

// Reset the tenant owner's password (platform operator only).
router.post('/:id/reset-admin', requirePermission('platform', 'manage'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await tenantService.resetTenantAdmin(req.params['id']!, actor(req)), 'Tenant admin reset — hand over the temporary password securely'); } catch (err) { next(err); }
});

// Self profile edit (a tenant editing its OWN organisation) — settings permission, self-scoped.
router.patch('/:id', requirePermission('settings', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.params['id'] !== req.user!.tenantId) { sendError(res, 'Not found', 404); return; }
    // Whitelist self-editable profile fields — never let a tenant set its own
    // status/plan/slug/deletedAt (those are platform-operator controlled).
    const b = req.body as Record<string, unknown>;
    const allowed = ['name', 'phone', 'email', 'addressLine1', 'addressLine2', 'city', 'state', 'pincode', 'country',
      'gstNumber', 'drugLicenseNumber', 'licenseNumber', 'logoUrl', 'ownerName', 'mobile'] as const;
    const data: Record<string, unknown> = {};
    for (const k of allowed) if (b[k] !== undefined) data[k] = b[k];
    const tenant = await prisma.tenant.update({ where: { id: req.params['id'] }, data });
    sendSuccess(res, tenant, 'Tenant updated');
  } catch (err) { next(err); }
});

// Deactivate (soft-delete) a tenant (platform operator only).
router.delete('/:id', requirePermission('platform', 'manage'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await tenantService.deactivateTenant(req.params['id']!, actor(req)), 'Tenant deactivated'); } catch (err) { next(err); }
});

export default router;
