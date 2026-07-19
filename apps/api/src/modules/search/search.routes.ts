import { Router } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { NextFunction, Response } from 'express';

const router = Router();
router.use(authenticate);

interface SearchResult {
  id: string;
  type: 'medicine' | 'customer' | 'bill' | 'vendor';
  title: string;
  subtitle: string;
  href: string;
}

// Universal search across the tenant's medicines, customers, vendors and bills.
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const q = String(req.query['q'] ?? '').trim();
    const limit = Math.min(Number(req.query['limit'] ?? 8), 20);
    if (q.length < 2) { sendSuccess(res, []); return; }

    const ci = { contains: q, mode: 'insensitive' as const };
    const per = Math.max(2, Math.ceil(limit / 2));

    const [medicines, customers, vendors, bills] = await Promise.all([
      prisma.medicine.findMany({
        where: { tenantId, deletedAt: null, OR: [{ name: ci }, { genericName: ci }, { brandName: ci }, { manufacturer: ci }, { barcode: { contains: q } }] },
        take: per, orderBy: { name: 'asc' },
        select: { id: true, name: true, genericName: true, manufacturer: true },
      }),
      prisma.customer.findMany({
        where: { tenantId, deletedAt: null, OR: [{ name: ci }, { phone: { contains: q } }, { email: ci }] },
        take: per, orderBy: { name: 'asc' },
        select: { id: true, name: true, phone: true },
      }),
      prisma.vendor.findMany({
        where: { tenantId, deletedAt: null, OR: [{ name: ci }, { phone: { contains: q } }, { gstNumber: ci }] },
        take: per, orderBy: { name: 'asc' },
        select: { id: true, name: true, phone: true },
      }),
      prisma.bill.findMany({
        where: { tenantId, deletedAt: null, OR: [{ billNumber: ci }, { customerName: ci }, { customerPhone: { contains: q } }] },
        take: per, orderBy: { createdAt: 'desc' },
        select: { id: true, billNumber: true, customerName: true, totalAmount: true },
      }),
    ]);

    const results: SearchResult[] = [
      ...medicines.map(m => ({ id: m.id, type: 'medicine' as const, title: m.name, subtitle: [m.genericName, m.manufacturer].filter(Boolean).join(' · ') || 'Medicine', href: '/medicines' })),
      ...customers.map(c => ({ id: c.id, type: 'customer' as const, title: c.name, subtitle: c.phone || 'Customer', href: '/customers' })),
      ...vendors.map(v => ({ id: v.id, type: 'vendor' as const, title: v.name, subtitle: v.phone || 'Vendor', href: '/vendors' })),
      ...bills.map(b => ({ id: b.id, type: 'bill' as const, title: b.billNumber, subtitle: `${b.customerName ?? 'Walk-in'} · ₹${b.totalAmount}`, href: '/billing' })),
    ].slice(0, limit);

    sendSuccess(res, results);
  } catch (err) { next(err); }
});

export default router;
