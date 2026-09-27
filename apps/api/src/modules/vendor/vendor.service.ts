import { Prisma, VendorStatus, PurchaseStatus, VendorPaymentMode } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { createAuditLog } from '../../utils/audit';
import { paginate } from '../../utils/response';

export async function getVendorStats(tenantId: string) {
  const [total, active] = await Promise.all([
    prisma.vendor.count({ where: { tenantId, deletedAt: null } }),
    prisma.vendor.count({ where: { tenantId, status: 'active', deletedAt: null } }),
  ]);

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const [monthlyPurchases, pendingPayments, pendingReview, topVendor] = await Promise.all([
    prisma.purchaseInvoice.aggregate({
      where: { tenantId, createdAt: { gte: thisMonth }, deletedAt: null },
      _sum: { totalAmount: true },
    }),
    prisma.purchaseInvoice.aggregate({
      where: { tenantId, status: { notIn: ['completed', 'cancelled'] }, deletedAt: null },
      _sum: { pendingAmount: true },
    }),
    prisma.purchaseInvoice.count({ where: { tenantId, status: 'pending_review', deletedAt: null } }),
    prisma.vendor.findFirst({
      where: { tenantId, deletedAt: null },
      orderBy: { totalPurchases: 'desc' },
    }),
  ]);

  return {
    totalVendors: total,
    activeVendors: active,
    totalPurchasesThisMonth: monthlyPurchases._sum.totalAmount ?? 0,
    pendingPayments: pendingPayments._sum.pendingAmount ?? 0,
    overduePayments: 0,
    topVendorName: topVendor?.name ?? '-',
    invoicesPendingReview: pendingReview,
  };
}

export async function listVendors(tenantId: string, query: Record<string, string | undefined>) {
  const where: Prisma.VendorWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query['status'] ? { status: query['status'] as VendorStatus } : {}),
    ...(query['search']
      ? {
          OR: [
            { name: { contains: query['search'], mode: 'insensitive' } },
            { gstNumber: { contains: query['search'], mode: 'insensitive' } },
            { city: { contains: query['search'], mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const vendors = await prisma.vendor.findMany({ where, orderBy: { createdAt: 'desc' } });
  return paginate(vendors, vendors.length, 1, 100);
}

export async function getVendorById(tenantId: string, id: string) {
  const v = await prisma.vendor.findFirst({ where: { id, tenantId, deletedAt: null } });
  if (!v) throw new AppError('Vendor not found', 404);
  return v;
}

export async function createVendor(tenantId: string, input: Record<string, unknown>, userId: string) {
  // Reject duplicate vendors (same name, case-insensitive) within the tenant.
  const name = String(input['name'] ?? '').trim();
  if (name) {
    const existing = await prisma.vendor.findFirst({
      where: { tenantId, deletedAt: null, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) throw new AppError(`A vendor named "${name}" already exists`, 409);
  }
  return prisma.vendor.create({
    data: { tenantId, ...input, createdBy: userId, updatedBy: userId } as Prisma.VendorUncheckedCreateInput,
  });
}

export async function updateVendor(tenantId: string, id: string, input: Record<string, unknown>, userId: string) {
  await getVendorById(tenantId, id);
  return prisma.vendor.update({ where: { id }, data: { ...input, updatedBy: userId } as Prisma.VendorUncheckedUpdateInput });
}

export async function deactivateVendor(tenantId: string, id: string, userId: string) {
  const v = await getVendorById(tenantId, id);
  await prisma.vendor.update({ where: { id }, data: { status: 'inactive', updatedBy: userId } });
  return v;
}

export async function getVendorInvoices(tenantId: string, vendorId: string) {
  const invoices = await prisma.purchaseInvoice.findMany({
    where: { tenantId, vendorId, deletedAt: null },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  return paginate(invoices, invoices.length, 1, 100);
}

export async function getVendorPayments(tenantId: string, vendorId: string) {
  const payments = await prisma.vendorPayment.findMany({
    where: { tenantId, vendorId },
    orderBy: { paymentDate: 'desc' },
  });
  return paginate(payments, payments.length, 1, 100);
}

export async function listPurchaseInvoices(tenantId: string, query: Record<string, string | undefined>) {
  const where: Prisma.PurchaseInvoiceWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query['status'] ? { status: query['status'] as PurchaseStatus } : {}),
    ...(query['vendorId'] ? { vendorId: query['vendorId'] } : {}),
  };
  const invoices = await prisma.purchaseInvoice.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' } });
  return paginate(invoices, invoices.length, 1, 100);
}

export async function getPurchaseInvoiceById(tenantId: string, id: string) {
  const inv = await prisma.purchaseInvoice.findFirst({ where: { id, tenantId, deletedAt: null }, include: { items: true } });
  if (!inv) throw new AppError('Purchase invoice not found', 404);
  return inv;
}

export async function createPurchaseInvoice(tenantId: string, input: Record<string, unknown>, userId: string) {
  const vendor = await prisma.vendor.findFirst({ where: { id: input['vendorId'] as string, tenantId } });
  const items = (input['items'] as Array<Record<string, unknown>>) ?? [];
  const inv = await prisma.purchaseInvoice.create({
    data: {
      tenantId,
      vendorId: input['vendorId'] as string,
      vendorName: vendor?.name ?? 'Unknown',
      invoiceNumber: input['invoiceNumber'] as string ?? `PI-${Date.now()}`,
      invoiceDate: input['invoiceDate'] ? new Date(input['invoiceDate'] as string) : new Date(),
      status: 'draft',
      subtotal: input['subtotal'] as number ?? 0,
      discountAmount: input['discountAmount'] as number ?? 0,
      taxAmount: input['taxAmount'] as number ?? 0,
      totalAmount: input['totalAmount'] as number ?? 0,
      paidAmount: 0,
      pendingAmount: input['totalAmount'] as number ?? 0,
      paymentDueDate: input['paymentDueDate'] ? new Date(input['paymentDueDate'] as string) : null,
      ocrStatus: 'pending',
      notes: input['notes'] as string | undefined,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  if (items.length > 0) {
    await prisma.purchaseInvoiceItem.createMany({
      data: items.map(item => ({
        invoiceId: inv.id,
        medicineName: item['medicineName'] as string,
        batchNumber: item['batchNumber'] as string,
        expiryDate: new Date(item['expiryDate'] as string),
        quantity: item['quantity'] as number,
        receivedQuantity: item['receivedQuantity'] as number ?? 0,
        purchasePrice: item['purchasePrice'] as number,
        mrp: item['mrp'] as number,
        sellingPrice: item['sellingPrice'] as number,
        gstRate: item['gstRate'] as number ?? 12,
        gstAmount: item['gstAmount'] as number ?? 0,
        totalAmount: item['totalAmount'] as number,
        mismatch: !!(item['mismatch']),
      })),
    });
  }

  return prisma.purchaseInvoice.findUnique({ where: { id: inv.id }, include: { items: true } });
}

export async function confirmPurchaseInvoice(tenantId: string, id: string, userId: string, userName: string) {
  const inv = await getPurchaseInvoiceById(tenantId, id);
  const updated = await prisma.purchaseInvoice.update({
    where: { id },
    data: { status: 'confirmed', updatedBy: userId },
    include: { items: true },
  });

  await createAuditLog({
    tenantId, userId, userName, module: 'vendor', action: 'approve',
    entityId: id, entityName: inv.invoiceNumber,
    description: `Confirmed purchase invoice ${inv.invoiceNumber}`,
  });

  return updated;
}

export async function createVendorPayment(tenantId: string, input: Record<string, unknown>, userId: string) {
  // Ownership guards — the vendor and (optional) invoice referenced in the body
  // MUST belong to the caller's tenant, or this becomes a cross-tenant write that
  // corrupts another pharmacy's vendor balance / invoice status.
  const vendorId = input['vendorId'] as string | undefined;
  if (!vendorId) throw new AppError('Vendor is required', 422);
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, tenantId, deletedAt: null } });
  if (!vendor) throw new AppError('Vendor not found', 404);

  const linkedInvoiceId = input['invoiceId'] as string | undefined;
  if (linkedInvoiceId) {
    const owned = await prisma.purchaseInvoice.findFirst({ where: { id: linkedInvoiceId, tenantId } });
    if (!owned) throw new AppError('Invoice not found', 404);
  }

  const payment = await prisma.vendorPayment.create({
    data: {
      tenantId,
      vendorId,
      invoiceId: linkedInvoiceId,
      amount: input['amount'] as number,
      paymentDate: input['paymentDate'] ? new Date(input['paymentDate'] as string) : new Date(),
      paymentMode: (input['paymentMode'] as VendorPaymentMode) ?? 'neft',
      referenceNumber: input['referenceNumber'] as string | undefined,
      notes: input['notes'] as string | undefined,
      createdBy: userId,
    },
  });

  // Update invoice paid/pending amounts if linked
  if (input['invoiceId']) {
    const inv = await prisma.purchaseInvoice.findUnique({ where: { id: input['invoiceId'] as string } });
    if (inv) {
      const newPaid = Number(inv.paidAmount) + Number(payment.amount);
      const newPending = Math.max(0, Number(inv.totalAmount) - newPaid);
      await prisma.purchaseInvoice.update({
        where: { id: inv.id },
        data: {
          paidAmount: newPaid,
          pendingAmount: newPending,
          status: newPending === 0 ? 'completed' : inv.status,
        },
      });
      // Update vendor pending payment
      await prisma.vendor.update({
        where: { id: input['vendorId'] as string },
        data: { pendingPayment: { decrement: payment.amount } },
      });
    }
  }

  return payment;
}
