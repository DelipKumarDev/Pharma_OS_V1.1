import { Response, NextFunction } from 'express';
import * as vendorService from './vendor.service';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';

const t = (req: AuthRequest) => req.user!.tenantId;

export async function getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await vendorService.getVendorStats(t(req))); } catch (err) { next(err); }
}
export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await vendorService.listVendors(t(req), req.query as Record<string, string>)); } catch (err) { next(err); }
}
export async function getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await vendorService.getVendorById(t(req), req.params['id']!)); } catch (err) { next(err); }
}
export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await vendorService.createVendor(t(req), req.body, req.user!.sub), 'Vendor created', 201); } catch (err) { next(err); }
}
export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await vendorService.updateVendor(t(req), req.params['id']!, req.body, req.user!.sub)); } catch (err) { next(err); }
}
export async function deactivate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await vendorService.deactivateVendor(t(req), req.params['id']!, req.user!.sub), 'Vendor deactivated'); } catch (err) { next(err); }
}
export async function getInvoices(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await vendorService.getVendorInvoices(t(req), req.params['id']!)); } catch (err) { next(err); }
}
export async function getPayments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await vendorService.getVendorPayments(t(req), req.params['id']!)); } catch (err) { next(err); }
}
export async function listInvoices(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await vendorService.listPurchaseInvoices(t(req), req.query as Record<string, string>)); } catch (err) { next(err); }
}
export async function getInvoiceById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await vendorService.getPurchaseInvoiceById(t(req), req.params['id']!)); } catch (err) { next(err); }
}
export async function createInvoice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await vendorService.createPurchaseInvoice(t(req), req.body, req.user!.sub), 'Invoice created', 201); } catch (err) { next(err); }
}
export async function confirmInvoice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await vendorService.confirmPurchaseInvoice(t(req), req.params['id']!, req.user!.sub, req.user!.name)); } catch (err) { next(err); }
}
export async function createPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await vendorService.createVendorPayment(t(req), req.body, req.user!.sub), 'Payment recorded', 201); } catch (err) { next(err); }
}
