import { Response, NextFunction } from 'express';
import * as billingService from './billing.service';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';

const t = (req: AuthRequest) => req.user!.tenantId;

export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await billingService.listBills(t(req), req.query as Record<string, string>)); }
  catch (err) { next(err); }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await billingService.getBillById(t(req), req.params['id']!)); }
  catch (err) { next(err); }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const bill = await billingService.createBill(t(req), req.body, req.user!.sub, req.user!.name);
    sendSuccess(res, bill, 'Bill created successfully', 201);
  } catch (err) { next(err); }
}
