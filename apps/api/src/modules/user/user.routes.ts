import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/authenticate';
import * as userService from './user.service';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';
import { UserStatus } from '@prisma/client';

const router = Router();
router.use(authenticate);

const t = (req: AuthRequest) => req.user!.tenantId;

// Users
router.get('/', requirePermission('users', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await userService.listUsers(t(req))); } catch (err) { next(err); }
});
router.get('/:id', requirePermission('users', 'view'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await userService.getUserById(t(req), req.params['id']!)); } catch (err) { next(err); }
});
router.post('/', requirePermission('users', 'create'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await userService.createUser(t(req), req.body, req.user!.sub, req.user!.name), 'User invited', 201); } catch (err) { next(err); }
});
router.put('/:id', requirePermission('users', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await userService.updateUser(t(req), req.params['id']!, req.body, req.user!.sub, req.user!.name)); } catch (err) { next(err); }
});
// Admin-initiated password reset — returns a one-time temporary password.
router.post('/:id/reset-password', requirePermission('users', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await userService.resetUserPassword(t(req), req.params['id']!, req.user!.sub, req.user!.name);
    sendSuccess(res, result, 'Password reset — share the temporary password securely');
  } catch (err) { next(err); }
});
router.patch('/:id/status', requirePermission('users', 'edit'), async (req: AuthRequest, res: Response, next: NextFunction) => {
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
