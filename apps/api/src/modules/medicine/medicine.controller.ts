import { Response, NextFunction } from 'express';
import * as medicineService from './medicine.service';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';

function tenant(req: AuthRequest): string {
  return req.user!.tenantId;
}

export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await medicineService.listMedicines(tenant(req), req.query as Record<string, string>);
    sendSuccess(res, result);
  } catch (err) { next(err); }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const medicine = await medicineService.getMedicineById(tenant(req), req.params['id']!);
    sendSuccess(res, medicine);
  } catch (err) { next(err); }
}

export async function getByBarcode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const medicine = await medicineService.getMedicineByBarcode(tenant(req), req.params['code']!);
    sendSuccess(res, medicine);
  } catch (err) { next(err); }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const medicine = await medicineService.createMedicine(
      tenant(req), req.body, req.user!.sub, req.user!.name
    );
    sendSuccess(res, medicine, 'Medicine created successfully', 201);
  } catch (err) { next(err); }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const medicine = await medicineService.updateMedicine(
      tenant(req), req.params['id']!, req.body, req.user!.sub, req.user!.name
    );
    sendSuccess(res, medicine, 'Medicine updated successfully');
  } catch (err) { next(err); }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await medicineService.deleteMedicine(tenant(req), req.params['id']!, req.user!.sub, req.user!.name);
    sendSuccess(res, null, 'Medicine deleted successfully');
  } catch (err) { next(err); }
}
