import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as userService from './user.service';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';
import { UserStatus } from '@prisma/client';

const router = Router();
router.use(authenticate);

const t = (req: AuthRequest) => req.user!.tenantId;

// Users
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await userService.listUsers(t(req))); } catch (err) { next(err); }
});
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await userService.createUser(t(req), req.body, req.user!.sub, req.user!.name), 'User invited', 201); } catch (err) { next(err); }
});
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await userService.updateUser(t(req), req.params['id']!, req.body, req.user!.sub, req.user!.name)); } catch (err) { next(err); }
});
router.patch('/:id/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body as { status: UserStatus };
    const validStatuses: string[] = ['active', 'inactive', 'suspended', 'pending'];
    if (!validStatuses.includes(status)) {
      res.status(422).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }
    await userService.toggleUserStatus(t(req), req.params['id']!, status, req.user!.sub, req.user!.name);
    sendSuccess(res, null, 'User status updated');
  } catch (err) { next(err); }
});

export default router;
