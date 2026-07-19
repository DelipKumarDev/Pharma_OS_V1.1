import { Router } from 'express';
import { authenticate, requirePermission, AuthRequest } from '../../middleware/authenticate';
import { sendSuccess } from '../../utils/response';
import { NextFunction, Response } from 'express';
import { commitScannedInvoice } from './scan.service';

const router = Router();
router.use(authenticate);

// Commit a human-reviewed scanned purchase bill → vendor + invoice + medicines + stock.
// Guarded by inventory:create (adding stock). OCR itself runs client-side; this
// endpoint only receives the confirmed rows.
router.post('/commit', requirePermission('inventory', 'create'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await commitScannedInvoice(req.user!.tenantId, req.body, req.user!.sub, req.user!.name);
    sendSuccess(res, summary, 'Scanned bill committed to stock', 201);
  } catch (err) { next(err); }
});

export default router;
