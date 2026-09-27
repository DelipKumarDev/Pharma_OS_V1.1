import { Router } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { NextFunction, Response } from 'express';

const router = Router();
router.use(authenticate);

interface SearchResult {
  id: string;
  type: 'medicine' | 'customer' | 'bill' | 'vendor' | 'prescription' | 'purchaseOrder';
  title: string;
  subtitle: string;
  href: string;
}

// Universal record search across the tenant's medicines, customers, vendors,
// bills, prescriptions and purchase orders.
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const q = String(req.query['q'] ?? '').trim();
    const limit = Math.min(Number(req.query['limit'] ?? 10), 24);
    if (q.length < 2) { sendSuccess(res, []); return; }

    const ci = { contains: q, mode: 'insensitive' as const };
    const per = 4;

    const [medicines, customers, vendors, bills, prescriptions, purchaseOrders] = await Promise.all([
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
      prisma.prescription.findMany({
        where: { tenantId, deletedAt: null, OR: [{ prescriptionNumber: ci }, { customerName: ci }, { doctorName: ci }, { customerPhone: { contains: q } }] },
        take: per, orderBy: { createdAt: 'desc' },
        select: { id: true, prescriptionNumber: true, customerName: true, doctorName: true },
      }),
      prisma.purchaseOrder.findMany({
        where: { tenantId, OR: [{ poNumber: ci }, { vendorName: ci }] },
        take: per, orderBy: { createdAt: 'desc' },
        select: { id: true, poNumber: true, vendorName: true, totalAmount: true },
      }),
    ]);

    // Deep-link each result to its module pre-filtered to the matched record
    // (?q=) so the target row is immediately visible, not just the list page.
    const qp = (s: string) => encodeURIComponent(s);
    const results: SearchResult[] = [
      ...medicines.map(m => ({ id: m.id, type: 'medicine' as const, title: m.name, subtitle: [m.genericName, m.manufacturer].filter(Boolean).join(' · ') || 'Medicine', href: `/medicines?q=${qp(m.name)}` })),
      ...customers.map(c => ({ id: c.id, type: 'customer' as const, title: c.name, subtitle: c.phone || 'Customer', href: `/contacts?q=${qp(c.name)}` })),
      ...vendors.map(v => ({ id: v.id, type: 'vendor' as const, title: v.name, subtitle: v.phone || 'Vendor', href: `/contacts?tab=vendors&q=${qp(v.name)}` })),
      ...bills.map(b => ({ id: b.id, type: 'bill' as const, title: b.billNumber, subtitle: `${b.customerName ?? 'Walk-in'} · ₹${b.totalAmount}`, href: `/billing?q=${qp(b.billNumber)}` })),
      ...prescriptions.map(p => ({ id: p.id, type: 'prescription' as const, title: p.prescriptionNumber, subtitle: `${p.customerName}${p.doctorName ? ` · Dr. ${p.doctorName}` : ''}`, href: `/prescriptions?q=${qp(p.prescriptionNumber)}` })),
      ...purchaseOrders.map(po => ({ id: po.id, type: 'purchaseOrder' as const, title: po.poNumber, subtitle: `${po.vendorName} · ₹${po.totalAmount}`, href: `/purchase-orders?q=${qp(po.poNumber)}` })),
    ].slice(0, limit);

    sendSuccess(res, results);
  } catch (err) { next(err); }
});

export default router;
