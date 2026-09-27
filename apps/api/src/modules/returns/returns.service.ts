import { Prisma, ReturnType, ReturnStatus, ReturnReason, RefundMethod } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { paginate } from '../../utils/response';

async function getNextReturnNumber(tenantId: string): Promise<string> {
  const count = await prisma.returnRequest.count({ where: { tenantId } });
  const year = new Date().getFullYear();
  return `RET-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function getReturnStats(tenantId: string) {
  const [total, pending, customerReturns, vendorReturns] = await Promise.all([
    prisma.returnRequest.count({ where: { tenantId, deletedAt: null } }),
    prisma.returnRequest.count({ where: { tenantId, status: 'pending', deletedAt: null } }),
    prisma.returnRequest.count({ where: { tenantId, type: 'customer_return', deletedAt: null } }),
    prisma.returnRequest.count({ where: { tenantId, type: 'vendor_return', deletedAt: null } }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [processedToday, monthlyRefund] = await Promise.all([
    prisma.returnRequest.count({ where: { tenantId, status: 'processed', processedAt: { gte: today }, deletedAt: null } }),
    prisma.returnRequest.aggregate({
      // Count refunds once a return is approved (and still while processed) so the
      // month total reflects approvals immediately (TC_016).
      where: { tenantId, status: { in: ['approved', 'processed'] }, deletedAt: null, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      _sum: { refundAmount: true },
    }),
  ]);

  return {
    totalReturns: total,
    pendingApproval: pending,
    processedToday,
    totalRefundedThisMonth: monthlyRefund._sum.refundAmount ?? 0,
    customerReturns,
    vendorReturns,
  };
}

export async function listReturns(tenantId: string, query: Record<string, string | undefined>) {
  const where: Prisma.ReturnRequestWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query['type'] ? { type: query['type'] as ReturnType } : {}),
    ...(query['status'] ? { status: query['status'] as ReturnStatus } : {}),
    ...(query['search']
      ? {
          OR: [
            { customerName: { contains: query['search'], mode: 'insensitive' } },
            { vendorName: { contains: query['search'], mode: 'insensitive' } },
            { returnNumber: { contains: query['search'], mode: 'insensitive' } },
            { billNumber: { contains: query['search'] } },
          ],
        }
      : {}),
  };

  const returns = await prisma.returnRequest.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  return paginate(returns, returns.length, 1, 100);
}

export async function getReturnById(tenantId: string, id: string) {
  const r = await prisma.returnRequest.findFirst({ where: { id, tenantId, deletedAt: null }, include: { items: true } });
  if (!r) throw new AppError('Return not found', 404);
  return r;
}

export async function createReturn(tenantId: string, input: Record<string, unknown>, userId: string) {
  if (!input['type']) throw new AppError('Return type is required', 422);
  const items = (input['items'] as Array<Record<string, unknown>>) ?? [];
  if (items.length === 0) throw new AppError('At least one item is required', 422);
  // Validate required per-item fields → clean 422 rather than a leaked Prisma error.
  for (const it of items) {
    if (!(it['medicineName'] as string | undefined)?.trim()) throw new AppError('Each return item needs a medicine name', 422);
    if (!(it['batchNumber'] as string | undefined)?.trim()) throw new AppError(`Batch number is required for ${it['medicineName']}`, 422);
    const q = Number(it['returnQty']);
    if (!Number.isFinite(q) || q < 1) throw new AppError(`Return quantity must be at least 1 for ${it['medicineName']}`, 422);
  }

  // Block returning the same bill's batch twice — an existing non-rejected return
  // for this bill that already covers a medicine+batch can't be re-submitted (I3).
  if (input['type'] === 'customer_return' && input['billNumber']) {
    const prior = await prisma.returnRequest.findMany({
      where: { tenantId, deletedAt: null, billNumber: input['billNumber'] as string, status: { not: 'rejected' } },
      include: { items: true },
    });
    const seen = new Set(prior.flatMap((p) => p.items.map((it) => `${it.medicineName}|${it.batchNumber}`.toLowerCase())));
    const dup = items.find((it) => seen.has(`${it['medicineName']}|${it['batchNumber']}`.toLowerCase()));
    if (dup) throw new AppError(`${dup['medicineName']} (batch ${dup['batchNumber']}) from bill ${input['billNumber']} has already been returned`, 409);
  }

  const returnNumber = await getNextReturnNumber(tenantId);
  const totalAmount = items.reduce((sum, i) => sum + ((i['totalAmount'] as number) ?? 0), 0);

  const r = await prisma.returnRequest.create({
    data: {
      tenantId,
      returnNumber,
      type: (input['type'] as ReturnType) ?? 'customer_return',
      status: 'pending',
      billId: input['billId'] as string | undefined,
      billNumber: input['billNumber'] as string | undefined,
      customerId: input['customerId'] as string | undefined,
      customerName: input['customerName'] as string | undefined,
      customerPhone: input['customerPhone'] as string | undefined,
      vendorId: input['vendorId'] as string | undefined,
      vendorName: input['vendorName'] as string | undefined,
      purchaseInvoiceId: input['purchaseInvoiceId'] as string | undefined,
      purchaseInvoiceNumber: input['purchaseInvoiceNumber'] as string | undefined,
      totalAmount,
      refundAmount: input['refundAmount'] as number ?? totalAmount,
      refundMethod: input['refundMethod'] as RefundMethod,
      reason: (input['reason'] as ReturnReason) ?? 'other',
      reasonNotes: input['reasonNotes'] as string | undefined,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  if (items.length > 0) {
    await prisma.returnItem.createMany({
      data: items.map(item => ({
        returnId: r.id,
        medicineId: item['medicineId'] as string | undefined,
        medicineName: item['medicineName'] as string,
        batchNumber: item['batchNumber'] as string,
        expiryDate: item['expiryDate'] ? new Date(item['expiryDate'] as string) : null,
        returnQty: item['returnQty'] as number,
        unitPrice: item['unitPrice'] as number,
        totalAmount: item['totalAmount'] as number,
        condition: (item['condition'] as Prisma.EnumItemConditionFilter['equals']) ?? 'resaleable',
        restocked: false,
      })),
    });
  }

  return prisma.returnRequest.findUnique({ where: { id: r.id }, include: { items: true } });
}

export async function approveReturn(tenantId: string, id: string, userId: string) {
  const r = await getReturnById(tenantId, id);
  if (r.status !== 'pending') throw new AppError('Return is not in pending status', 400);
  return prisma.returnRequest.update({
    where: { id },
    data: { status: 'approved', updatedBy: userId },
    include: { items: true },
  });
}

export async function processReturn(tenantId: string, id: string, userId: string) {
  const r = await getReturnById(tenantId, id);
  if (!['pending', 'approved'].includes(r.status)) throw new AppError('Return cannot be processed', 400);

  const updated = await prisma.$transaction(async tx => {
    const result = await tx.returnRequest.update({
      where: { id },
      data: { status: 'processed', processedBy: userId, processedAt: new Date(), updatedBy: userId },
      include: { items: true },
    });

    // Restock resaleable items
    for (const item of result.items) {
      if (item.condition === 'resaleable' && item.medicineId) {
        await tx.returnItem.update({ where: { id: item.id }, data: { restocked: true } });
        // Find active inventory batch and add back
        const inv = await tx.inventoryItem.findFirst({
          where: { tenantId, medicineId: item.medicineId, batchNumber: item.batchNumber, deletedAt: null },
        });
        if (inv) {
          await tx.inventoryItem.update({
            where: { id: inv.id },
            data: { quantity: { increment: item.returnQty } },
          });
        }
      }
    }

    return result;
  });

  return updated;
}

export async function rejectReturn(tenantId: string, id: string, notes: string, userId: string) {
  const r = await getReturnById(tenantId, id);
  return prisma.returnRequest.update({
    where: { id },
    data: {
      status: 'rejected',
      reasonNotes: notes || r.reasonNotes,
      refundAmount: 0,
      processedBy: userId,
      processedAt: new Date(),
      updatedBy: userId,
    },
    include: { items: true },
  });
}
