import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as prescriptionService from './prescription.service';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';
import { PrescriptionStatus } from '@prisma/client';

const router = Router();
router.use(authenticate);

const t = (req: AuthRequest) => req.user!.tenantId;

router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await prescriptionService.getPrescriptionStats(t(req))); } catch (err) { next(err); }
});
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await prescriptionService.listPrescriptions(t(req), req.query as Record<string, string>)); } catch (err) { next(err); }
});
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await prescriptionService.getPrescriptionById(t(req), req.params['id']!)); } catch (err) { next(err); }
});
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await prescriptionService.createPrescription(t(req), req.body, req.user!.sub), 'Prescription created', 201); } catch (err) { next(err); }
});
router.patch('/:id/approve', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await prescriptionService.updatePrescriptionStatus(t(req), req.params['id']!, 'approved', req.user!.sub)); } catch (err) { next(err); }
});
router.patch('/:id/dispense', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await prescriptionService.updatePrescriptionStatus(t(req), req.params['id']!, 'dispensed', req.user!.sub)); } catch (err) { next(err); }
});
router.patch('/:id/reject', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body as { reason?: string };
    sendSuccess(res, await prescriptionService.updatePrescriptionStatus(t(req), req.params['id']!, 'rejected', req.user!.sub, reason));
  } catch (err) { next(err); }
});

export default router;
