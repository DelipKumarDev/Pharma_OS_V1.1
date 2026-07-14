import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess, paginate } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';
import { TenantStatus, TenantType, TenantPlan } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, status } = req.query as Record<string, string>;
    const tenants = await prisma.tenant.findMany({
      where: {
        deletedAt: null,
        ...(status ? { status: status as TenantStatus } : {}),
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { slug: { contains: search } }] } : {}),
      },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, paginate(tenants, tenants.length, 1, 50));
  } catch (err) { next(err); }
});

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params['id'] } });
    if (!tenant) { res.status(404).json({ success: false, message: 'Not found' }); return; }
    sendSuccess(res, tenant);
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
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

router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenant = await prisma.tenant.update({ where: { id: req.params['id'] }, data: req.body });
    sendSuccess(res, tenant, 'Tenant updated');
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.tenant.update({ where: { id: req.params['id'] }, data: { deletedAt: new Date(), status: 'suspended' } });
    sendSuccess(res, null, 'Tenant suspended');
  } catch (err) { next(err); }
});

export default router;
