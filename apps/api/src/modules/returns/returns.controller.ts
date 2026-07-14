import { Response, NextFunction } from 'express';
import * as returnsService from './returns.service';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';

const t = (req: AuthRequest) => req.user!.tenantId;

export async function getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await returnsService.getReturnStats(t(req))); } catch (err) { next(err); }
}
export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await returnsService.listReturns(t(req), req.query as Record<string, string>)); } catch (err) { next(err); }
}
export async function getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await returnsService.getReturnById(t(req), req.params['id']!)); } catch (err) { next(err); }
}
export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await returnsService.createReturn(t(req), req.body, req.user!.sub), 'Return created', 201); } catch (err) { next(err); }
}
export async function approve(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await returnsService.approveReturn(t(req), req.params['id']!, req.user!.sub)); } catch (err) { next(err); }
}
export async function process(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await returnsService.processReturn(t(req), req.params['id']!, req.user!.sub)); } catch (err) { next(err); }
}
export async function reject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { notes } = req.body as { notes?: string };
    sendSuccess(res, await returnsService.rejectReturn(t(req), req.params['id']!, notes ?? '', req.user!.sub));
  } catch (err) { next(err); }
}
