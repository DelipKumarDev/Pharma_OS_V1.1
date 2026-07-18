import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';
import { toCsv, sendCsv } from '../../utils/csv';

const router = Router();
router.use(authenticate);

// ─── GSTR-1 (outward supplies) ───────────────────────────────────────────────
// GET /api/reports/gstr1?month=7&year=2026[&format=csv]
router.get('/gstr1', requirePermission('reports', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const month = parseInt((req.query['month'] as string) ?? '');
    const year = parseInt((req.query['year'] as string) ?? '');
    if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2017 || year > 2100) {
      res.status(400).json({ success: false, message: '"month" (1-12) and "year" (>=2017) are required' });
      return;
    }

    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));

    const [tenant, bills] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true, gstNumber: true, state: true } }),
      prisma.bill.findMany({
        where: { tenantId, createdAt: { gte: from, lt: to }, deletedAt: null },
        include: { items: { include: { medicine: { select: { hsn: true, unit: true } } } } },
        orderBy: { billNumber: 'asc' },
      }),
    ]);

    const completed = bills.filter(b => b.status === 'completed' || b.status === 'partially_paid');
    const cancelled = bills.filter(b => b.status === 'cancelled');

    // B2CS — B2C supplies grouped by GST rate (retail pharmacy sales are B2C, intra-state)
    const b2csMap = new Map<number, { taxableValue: number; cgst: number; sgst: number; igst: number }>();
    // HSN summary — grouped by HSN code + rate
    const hsnMap = new Map<string, { hsn: string; description: string; uqc: string; totalQty: number; taxableValue: number; rate: number; cgst: number; sgst: number; igst: number }>();

    for (const bill of completed) {
      for (const item of bill.items) {
        const rate = item.gstRate ?? 0;
        const taxable = Number((item.totalAmount - item.gstAmount).toFixed(2));
        const half = Number((item.gstAmount / 2).toFixed(2));

        const b2cs = b2csMap.get(rate) ?? { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
        b2cs.taxableValue += taxable;
        b2cs.cgst += half;
        b2cs.sgst += half;
        b2csMap.set(rate, b2cs);

        const hsn = item.medicine?.hsn || '30049099';
        const hsnKey = `${hsn}|${rate}`;
        const h = hsnMap.get(hsnKey) ?? {
          hsn, description: item.medicineName.slice(0, 30),
          uqc: (item.medicine?.unit ?? 'strip').toUpperCase() === 'STRIP' ? 'STP' : 'NOS',
          totalQty: 0, taxableValue: 0, rate, cgst: 0, sgst: 0, igst: 0,
        };
        h.totalQty += item.quantity;
        h.taxableValue += taxable;
        h.cgst += half;
        h.sgst += half;
        hsnMap.set(hsnKey, h);
      }
    }

    const round2 = (n: number) => Number(n.toFixed(2));
    const b2cs = Array.from(b2csMap.entries())
      .map(([rate, v]) => ({ type: 'OE', placeOfSupply: tenant?.state ?? 'Karnataka', rate, taxableValue: round2(v.taxableValue), cgst: round2(v.cgst), sgst: round2(v.sgst), igst: 0 }))
      .sort((a, b) => a.rate - b.rate);
    const hsnSummary = Array.from(hsnMap.values())
      .map(h => ({ ...h, taxableValue: round2(h.taxableValue), cgst: round2(h.cgst), sgst: round2(h.sgst) }))
      .sort((a, b) => a.hsn.localeCompare(b.hsn));

    const docs = {
      natureOfDocument: 'Invoices for outward supply',
      from: completed[0]?.billNumber ?? '-',
      to: completed[completed.length - 1]?.billNumber ?? '-',
      totalIssued: bills.length,
      cancelled: cancelled.length,
      netIssued: bills.length - cancelled.length,
    };

    const summary = {
      gstin: tenant?.gstNumber ?? 'UNREGISTERED',
      legalName: tenant?.name ?? '',
      period: `${String(month).padStart(2, '0')}${year}`,
      totalTaxableValue: round2(b2cs.reduce((s, r) => s + r.taxableValue, 0)),
      totalCgst: round2(b2cs.reduce((s, r) => s + r.cgst, 0)),
      totalSgst: round2(b2cs.reduce((s, r) => s + r.sgst, 0)),
      totalInvoiceValue: round2(completed.reduce((s, b) => s + b.totalAmount, 0)),
      invoiceCount: completed.length,
    };

    if ((req.query['format'] as string) === 'csv') {
      const hsnCsv = toCsv(hsnSummary, [
        { header: 'HSN', value: r => r.hsn },
        { header: 'Description', value: r => r.description },
        { header: 'UQC', value: r => r.uqc },
        { header: 'Total Quantity', value: r => r.totalQty },
        { header: 'Rate', value: r => r.rate },
        { header: 'Taxable Value', value: r => r.taxableValue },
        { header: 'Integrated Tax Amount', value: () => 0 },
        { header: 'Central Tax Amount', value: r => r.cgst },
        { header: 'State/UT Tax Amount', value: r => r.sgst },
        { header: 'Cess Amount', value: () => 0 },
      ]);
      const b2csCsv = toCsv(b2cs, [
        { header: 'Type', value: r => r.type },
        { header: 'Place Of Supply', value: r => r.placeOfSupply },
        { header: 'Rate', value: r => r.rate },
        { header: 'Taxable Value', value: r => r.taxableValue },
        { header: 'Cess Amount', value: () => 0 },
        { header: 'E-Commerce GSTIN', value: () => '' },
      ]);
      const combined = `GSTR-1 ${summary.period} — ${summary.legalName} (${summary.gstin})\r\n\r\nB2CS (B2C Small)\r\n${b2csCsv}\r\n\r\nHSN Summary\r\n${hsnCsv}`;
      sendCsv(res, `gstr1-${summary.period}.csv`, combined);
      return;
    }

    sendSuccess(res, { summary, b2cs, hsnSummary, docs });
  } catch (err) { next(err); }
});

// ─── Sales report CSV export ─────────────────────────────────────────────────
// GET /api/reports/export?days=30
router.get('/export', requirePermission('reports', 'export'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const days = parseInt((req.query['days'] as string) ?? '30');
    if (isNaN(days) || days <= 0) {
      res.status(400).json({ success: false, message: '"days" must be a positive integer' });
      return;
    }
    const from = new Date(Date.now() - days * 86400000);
    const bills = await prisma.bill.findMany({
      where: { tenantId, createdAt: { gte: from }, status: 'completed', deletedAt: null },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    const csv = toCsv(bills, [
      { header: 'Date', value: b => b.createdAt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) },
      { header: 'Bill No', value: b => b.billNumber },
      { header: 'Customer', value: b => b.customerName ?? 'Walk-in' },
      { header: 'Items', value: b => b.items.length },
      { header: 'Subtotal', value: b => b.subtotal },
      { header: 'Discount', value: b => b.discountAmount },
      { header: 'GST', value: b => b.taxAmount },
      { header: 'Total', value: b => b.totalAmount },
      { header: 'Paid', value: b => b.paidAmount },
      { header: 'Balance', value: b => b.balanceAmount },
      { header: 'Payment Method', value: b => b.paymentMethod },
      { header: 'Status', value: b => b.status },
    ]);
    sendCsv(res, `sales-report-${days}d-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  } catch (err) { next(err); }
});

router.get('/', requirePermission('reports', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { period, days: daysParam } = req.query as Record<string, string>;
    const raw = parseInt(daysParam ?? period ?? '30');
    if (isNaN(raw) || raw <= 0) {
      res.status(400).json({ success: false, message: '"days" must be a positive integer' });
      return;
    }
    const days = raw;
    const from = new Date(Date.now() - days * 86400000);
    const round2 = (n: number) => Number(n.toFixed(2));

    const [bills, items, scheduleLog, inventory, customersInPeriod] = await Promise.all([
      prisma.bill.findMany({
        where: { tenantId, createdAt: { gte: from }, status: 'completed', deletedAt: null },
        include: { items: true },
      }),
      prisma.billItem.findMany({
        where: { bill: { tenantId, createdAt: { gte: from }, status: 'completed', deletedAt: null } },
        include: { medicine: { select: { name: true, genericName: true, category: true, purchasePrice: true, schedule: true } } },
      }),
      prisma.scheduleDrugRegister.findMany({
        where: { tenantId, dispensedAt: { gte: from } },
        orderBy: { dispensedAt: 'desc' },
        take: 50,
      }),
      prisma.inventoryItem.findMany({
        where: { tenantId, deletedAt: null, quantity: { gt: 0 } },
        include: { medicine: { select: { name: true, category: true } } },
      }),
      prisma.customer.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true, phone: true, createdAt: true, totalVisits: true, totalSpend: true, loyaltyPoints: true, lastVisitDate: true },
      }),
    ]);

    const totalRevenue = bills.reduce((s, b) => s + b.totalAmount, 0);
    const totalBills = bills.length;
    const totalItems = items.reduce((s, i) => s + i.quantity, 0);
    const totalGST = bills.reduce((s, b) => s + b.taxAmount, 0);
    const totalDiscount = bills.reduce((s, b) => s + b.discountAmount, 0);

    // Gross profit — selling revenue minus purchase cost (medicine master purchase price)
    const totalCost = items.reduce((s, i) => s + (i.medicine?.purchasePrice ?? i.sellingPrice * 0.8) * i.quantity, 0);
    const grossProfit = round2(totalRevenue - totalGST - totalCost);
    const netRevenue = totalRevenue - totalGST;
    const grossMarginPct = netRevenue > 0 ? round2((grossProfit / netRevenue) * 100) : 0;

    // Payment method mix
    const paymentMethods = { cash: 0, upi: 0, card: 0, credit: 0 };
    for (const b of bills) {
      const m = (b.paymentMethod ?? 'cash') as keyof typeof paymentMethods;
      if (m in paymentMethods) paymentMethods[m] += b.totalAmount;
      else paymentMethods.cash += b.totalAmount;
    }

    // Daily sales with payment split
    const dailyMap = new Map<string, { revenue: number; bills: number; gst: number; cash: number; upi: number; card: number; credit: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - (days - 1 - i) * 86400000);
      dailyMap.set(d.toISOString().split('T')[0]!, { revenue: 0, bills: 0, gst: 0, cash: 0, upi: 0, card: 0, credit: 0 });
    }
    for (const bill of bills) {
      const key = bill.createdAt.toISOString().split('T')[0]!;
      const entry = dailyMap.get(key);
      if (entry) {
        entry.revenue += bill.totalAmount; entry.bills++; entry.gst += bill.taxAmount;
        const m = (bill.paymentMethod ?? 'cash') as 'cash' | 'upi' | 'card' | 'credit';
        if (m in entry) entry[m] += bill.totalAmount;
        else entry.cash += bill.totalAmount;
      }
    }
    const dailySales = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date, revenue: round2(v.revenue), bills: v.bills, gst: round2(v.gst),
      avgBillValue: v.bills > 0 ? Math.round(v.revenue / v.bills) : 0,
      cash: round2(v.cash), upi: round2(v.upi), card: round2(v.card), credit: round2(v.credit),
    }));

    const bestDay = dailySales.reduce(
      (best, d) => (d.revenue > best.revenue ? { date: d.date, revenue: d.revenue } : best),
      { date: dailySales[0]?.date ?? new Date().toISOString().split('T')[0]!, revenue: 0 },
    );

    // Top medicines with margin + schedule flag
    const medMap = new Map<string, { generic: string; qtySold: number; revenue: number; cost: number; category: string; scheduleH: boolean }>();
    for (const item of items) {
      const entry = medMap.get(item.medicineName) ?? {
        generic: item.genericName ?? item.medicine?.genericName ?? '',
        qtySold: 0, revenue: 0, cost: 0,
        category: item.medicine?.category ?? 'other',
        scheduleH: item.medicine?.schedule === 'H' || item.medicine?.schedule === 'H1',
      };
      entry.qtySold += item.quantity;
      entry.revenue += item.totalAmount;
      entry.cost += (item.medicine?.purchasePrice ?? item.sellingPrice * 0.8) * item.quantity;
      medMap.set(item.medicineName, entry);
    }
    const topMedicines = Array.from(medMap.entries())
      .map(([name, v]) => ({
        name, generic: v.generic, category: v.category, qtySold: v.qtySold,
        revenue: round2(v.revenue), scheduleH: v.scheduleH,
        margin: v.revenue > 0 ? round2(((v.revenue - v.cost) / v.revenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Categories with margin + gst + pct
    const catMap = new Map<string, { revenue: number; bills: number; gst: number; cost: number }>();
    for (const item of items) {
      const cat = item.medicine?.category ?? 'other';
      const entry = catMap.get(cat) ?? { revenue: 0, bills: 0, gst: 0, cost: 0 };
      entry.revenue += item.totalAmount;
      entry.bills++;
      entry.gst += item.gstAmount;
      entry.cost += (item.medicine?.purchasePrice ?? item.sellingPrice * 0.8) * item.quantity;
      catMap.set(cat, entry);
    }
    const catRevenueTotal = Array.from(catMap.values()).reduce((s, v) => s + v.revenue, 0);
    const categories = Array.from(catMap.entries())
      .map(([category, v]) => ({
        category, revenue: round2(v.revenue), bills: v.bills, gst: round2(v.gst),
        margin: v.revenue > 0 ? round2(((v.revenue - v.cost) / v.revenue) * 100) : 0,
        pct: catRevenueTotal > 0 ? Math.round((v.revenue / catRevenueTotal) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
    const salesByCategory = categories.map(c => ({ category: c.category, revenue: c.revenue, bills: c.bills }));

    // GST slabs
    const slabMap = new Map<number, { taxable: number; gst: number }>();
    for (const item of items) {
      const rate = item.gstRate ?? 0;
      const entry = slabMap.get(rate) ?? { taxable: 0, gst: 0 };
      entry.taxable += item.totalAmount - item.gstAmount;
      entry.gst += item.gstAmount;
      slabMap.set(rate, entry);
    }
    const slabTaxableTotal = Array.from(slabMap.values()).reduce((s, v) => s + v.taxable, 0);
    const SLAB_DESC: Record<number, string> = { 0: 'Exempt / life-saving drugs', 5: 'Essential medicines', 12: 'Standard medicines', 18: 'Supplements & devices', 28: 'Luxury / cosmetics' };
    const gstSlabs = Array.from(slabMap.entries())
      .map(([rate, v]) => ({
        rate, description: SLAB_DESC[rate] ?? 'Other',
        taxable: round2(v.taxable), gst: round2(v.gst),
        cgst: round2(v.gst / 2), sgst: round2(v.gst / 2), igst: 0,
        pct: slabTaxableTotal > 0 ? Math.round((v.taxable / slabTaxableTotal) * 100) : 0,
      }))
      .sort((a, b) => a.rate - b.rate);
    const gstTotals = {
      totalTaxable: round2(slabTaxableTotal),
      totalGST: round2(totalGST),
      cgst: round2(totalGST / 2),
      sgst: round2(totalGST / 2),
      igst: 0,
      effectiveRate: slabTaxableTotal > 0 ? round2((totalGST / slabTaxableTotal) * 100) : 0,
    };

    // Schedule H dispensing log — real statutory register entries
    const scheduleHLog = scheduleLog.map(e => ({
      date: e.dispensedAt.toISOString(),
      medicine: e.medicineName,
      qty: e.quantity,
      prescriptionNo: e.billNumber ?? '-',
      doctorName: e.doctorName,
      doctorReg: e.doctorRegNumber ?? '-',
      patientName: e.patientName,
      address: e.patientAddress ?? '-',
    }));

    // Stock intelligence
    const soldMedicineIds = new Set(items.map(i => i.medicineId));
    const totalStockValue = round2(inventory.reduce((s, i) => s + i.quantity * i.sellingPrice, 0));
    const deadStock = inventory
      .filter(i => !soldMedicineIds.has(i.medicineId))
      .map(i => ({
        name: i.medicine?.name ?? 'Unknown',
        category: i.medicine?.category ?? 'other',
        qty: i.quantity,
        value: round2(i.quantity * i.sellingPrice),
        lastSoldDays: days,
        batchExpiry: i.expiryDate.toISOString(),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    const deadStockValue = round2(deadStock.reduce((s, i) => s + i.value, 0));

    // Customer insights
    const billCustomerIds = new Set(bills.filter(b => b.customerId).map(b => b.customerId!));
    const newCustomers = customersInPeriod.filter(c => c.createdAt >= from).length;
    const returningCustomers = customersInPeriod.filter(c => c.createdAt < from && billCustomerIds.has(c.id)).length;
    const topCustomers = customersInPeriod
      .filter(c => c.totalSpend > 0)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5)
      .map(c => ({
        name: c.name, phone: c.phone ?? '', visits: c.totalVisits,
        totalSpend: round2(c.totalSpend), loyaltyPts: c.loyaltyPoints,
        lastVisit: (c.lastVisitDate ?? c.createdAt).toISOString(),
      }));

    // Hourly pattern (IST)
    const hourCounts = new Array<number>(24).fill(0);
    for (const b of bills) {
      const istHour = Number(b.createdAt.toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }));
      if (!isNaN(istHour)) hourCounts[istHour % 24] = (hourCounts[istHour % 24] ?? 0) + 1;
    }
    const hourlyPattern = Array.from({ length: 13 }, (_, i) => {
      const h = i + 8; // 8 AM – 8 PM window
      const label = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
      return { hour: label, bills: hourCounts[h] ?? 0 };
    });

    sendSuccess(res, {
      summary: {
        totalRevenue: round2(totalRevenue), totalBills, totalItems,
        totalGST: round2(totalGST), totalDiscount: round2(totalDiscount),
        avgBillValue: totalBills > 0 ? Math.round(totalRevenue / totalBills) : 0,
        grossProfit, grossMarginPct, bestDay, paymentMethods,
        newCustomers, returningCustomers, deadStockValue, totalStockValue,
      },
      dailySales,
      topMedicines,
      salesByCategory,
      categories,
      gstSlabs,
      gstTotals,
      scheduleHLog,
      deadStock,
      topCustomers,
      hourlyPattern,
      period: days,
    });
  } catch (err) { next(err); }
});

export default router;
