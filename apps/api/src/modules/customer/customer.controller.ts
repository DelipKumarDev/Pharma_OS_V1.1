import { Response, NextFunction } from 'express';
import * as customerService from './customer.service';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';

const t = (req: AuthRequest) => req.user!.tenantId;

export async function getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await customerService.getCustomerStats(t(req))); } catch (err) { next(err); }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await customerService.listCustomers(t(req), req.query as Record<string, string>)); } catch (err) { next(err); }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await customerService.getCustomerById(t(req), req.params['id']!)); } catch (err) { next(err); }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await customerService.createCustomer(t(req), req.body, req.user!.sub), 'Customer created', 201); } catch (err) { next(err); }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await customerService.updateCustomer(t(req), req.params['id']!, req.body, req.user!.sub)); } catch (err) { next(err); }
}

export async function getPurchases(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await customerService.getCustomerPurchases(t(req), req.params['id']!)); } catch (err) { next(err); }
}

export async function recordPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await customerService.recordCustomerPayment(t(req), req.params['id']!, req.body, req.user!.sub), 'Payment recorded'); } catch (err) { next(err); }
}
