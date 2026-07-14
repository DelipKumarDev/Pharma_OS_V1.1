import { Response, NextFunction } from 'express';
import * as inventoryService from './inventory.service';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { AdjustmentType, InventoryStatus } from '@prisma/client';

function t(req: AuthRequest): string { return req.user!.tenantId; }

export async function getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await inventoryService.getInventoryStats(t(req))); } catch (err) { next(err); }
}

export async function getAiInsights(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await inventoryService.getAiInsights(t(req))); } catch (err) { next(err); }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await inventoryService.listInventory(t(req), req.query as Record<string, string>));
  } catch (err) { next(err); }
}

export async function getBatches(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await inventoryService.getBatchesByMedicine(t(req), req.params['medicineId']!));
  } catch (err) { next(err); }
}

export async function getMovements(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, await inventoryService.getMovementsByMedicine(t(req), req.params['medicineId']!));
  } catch (err) { next(err); }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const item = await inventoryService.createInventoryItem(t(req), req.body, req.user!.sub, req.user!.name);
    sendSuccess(res, item, 'Inventory item added', 201);
  } catch (err) { next(err); }
}

export async function adjust(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { adjustmentType, quantity, notes } = req.body as {
      adjustmentType: AdjustmentType;
      quantity: number;
      notes: string;
    };
    const item = await inventoryService.adjustStock(
      t(req), req.params['id']!, adjustmentType, quantity, notes, req.user!.sub, req.user!.name
    );
    sendSuccess(res, item, 'Stock adjusted successfully');
  } catch (err) { next(err); }
}

export async function updateStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.body as { status: string };
    const valid: string[] = ['available', 'low_stock', 'out_of_stock', 'expired', 'damaged'];
    if (!valid.includes(status)) {
      res.status(422).json({ success: false, message: `Invalid status. Must be one of: ${valid.join(', ')}` });
      return;
    }
    const item = await inventoryService.updateInventoryStatus(t(req), req.params['id']!, status as InventoryStatus);
    sendSuccess(res, item, 'Inventory status updated');
  } catch (err) { next(err); }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await inventoryService.deleteInventoryItem(t(req), req.params['id']!, req.user!.sub, req.user!.name);
    sendSuccess(res, null, 'Inventory item removed');
  } catch (err) { next(err); }
}
