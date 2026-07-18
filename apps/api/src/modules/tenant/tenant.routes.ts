import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess, sendError, paginate } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';
import { TenantType, TenantPlan } from '@prisma/client';

const router = Router();
router.use(authenticate);

// A tenant may only ever see/modify its OWN organisation. Cross-tenant access
// (listing or reading other pharmacies) is a platform-operator concern that does
// not exist for regular tenant users — so every operation here is self-scoped.

router.get('/', requirePermission('settings', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const own = await prisma.tenant.findUnique({ where: { id: req.user!.tenantId } });
    const list = own && !own.deletedAt ? [own] : [];
    sendSuccess(res, paginate(list, list.length, 1, 50));
  } catch (err) { next(err); }
});

router.get('/:id', requirePermission('settings', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.params['id'] !== req.user!.tenantId) { sendError(res, 'Not found', 404); return; }
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params['id'] } });
    if (!tenant) { sendError(res, 'Not found', 404); return; }
    sendSuccess(res, tenant);
  } catch (err) { next(err); }
});

// Creating a new tenant is platform onboarding. Until a dedicated platform-admin
// role exists, it is gated behind settings:edit (Pharma Admin only).
router.post('/', requirePermission('settings', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
    if (!body['name']) { sendError(res, 'Tenant name is required', 422); return; }
    const tenant = await prisma.tenant.create({
      data: {
        name: body['name'] as string,
        slug: (body['slug'] as string) ?? (body['name'] as string).toLowerCase().replace(/\s+/g, '-'),
        type: (body['type'] as TenantType) ?? 'retail',
        status: 'trial',
        plan: (body['plan'] as TenantPlan) ?? 'starter',
        phone: body['phone'] as string | undefined,
        email: body['email'] as string | undefined,
        addressLine1: body['addressLine1'] as string | undefined,
        city: body['city'] as string | undefined,
        state: body['state'] as string | undefined,
        pincode: body['pincode'] as string | undefined,
        licenseNumber: body['licenseNumber'] as string | undefined,
        gstNumber: body['gstNumber'] as string | undefined,
        drugLicenseNumber: body['drugLicenseNumber'] as string | undefined,
      },
    });
    sendSuccess(res, tenant, 'Tenant created', 201);
  } catch (err) { next(err); }
});

router.patch('/:id', requirePermission('settings', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.params['id'] !== req.user!.tenantId) { sendError(res, 'Not found', 404); return; }
    const tenant = await prisma.tenant.update({ where: { id: req.params['id'] }, data: req.body });
    sendSuccess(res, tenant, 'Tenant updated');
  } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('settings', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.params['id'] !== req.user!.tenantId) { sendError(res, 'Not found', 404); return; }
    await prisma.tenant.update({ where: { id: req.params['id'] }, data: { deletedAt: new Date(), status: 'suspended' } });
    sendSuccess(res, null, 'Tenant suspended');
  } catch (err) { next(err); }
});

export default router;
