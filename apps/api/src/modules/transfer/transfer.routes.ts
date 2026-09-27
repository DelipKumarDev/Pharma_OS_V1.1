import { Router } from 'express';
import { authenticate, requirePermission, AuthRequest } from '../../middleware/authenticate';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import { NextFunction, Response } from 'express';

const router = Router();
router.use(authenticate);
const t = (req: AuthRequest) => req.user!.tenantId;

async function nextNumber(tenantId: string): Promise<string> {
  const n = await prisma.stockTransfer.count({ where: { tenantId } });
  return `TRF${String(n + 1).padStart(5, '0')}`;
}

router.get('/', requirePermission('inventory', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.stockTransfer.findMany({ where: { tenantId: t(req) }, orderBy: { createdAt: 'desc' } });
    sendSuccess(res, { data, total: data.length });
  } catch (err) { next(err); }
});

// Create a transfer and (if completed) move the batch to its new rack location.
router.post('/', requirePermission('inventory', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = t(req);
    const b = req.body as { inventoryItemId?: string; toLocation?: string; quantity?: number; notes?: string };
    if (!b.inventoryItemId) throw new AppError('Select a batch to transfer', 422);
    if (!b.toLocation?.trim()) throw new AppError('Destination location is required', 422);

    const inv = await prisma.inventoryItem.findFirst({ where: { id: b.inventoryItemId, tenantId, deletedAt: null }, include: { medicine: true } });
    if (!inv) throw new AppError('Batch not found', 404);
    const qty = Number(b.quantity) || inv.quantity;
    if (qty <= 0 || qty > inv.quantity) throw new AppError(`Quantity must be between 1 and ${inv.quantity}`, 422);

    const transfer = await prisma.$transaction(async (tx) => {
      const trf = await tx.stockTransfer.create({
        data: {
          tenantId, transferNumber: await nextNumber(tenantId),
          inventoryItemId: inv.id, medicineId: inv.medicineId, medicineName: inv.medicine.name,
          batchNumber: inv.batchNumber, quantity: qty,
          fromLocation: inv.rackLocation ?? undefined, toLocation: b.toLocation!,
          status: 'completed', notes: b.notes, createdBy: req.user!.sub,
        },
      });
      // Full-batch transfer → relocate the batch; record a TRANSFER movement.
      if (qty === inv.quantity) {
        await tx.inventoryItem.update({ where: { id: inv.id }, data: { rackLocation: b.toLocation } });
      }
      await tx.stockMovement.create({
        data: {
          tenantId, medicineId: inv.medicineId, inventoryItemId: inv.id, movementType: 'TRANSFER',
          quantity: qty, previousQty: inv.quantity, newQty: inv.quantity,
          referenceId: trf.id, referenceType: 'transfer', createdBy: req.user!.sub,
        },
      });
      return trf;
    });

    sendSuccess(res, transfer, 'Stock transferred', 201);
  } catch (err) { next(err); }
});

export default router;
