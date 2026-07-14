import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as userService from './user.service';
import { sendSuccess } from '../../utils/response';
import { AuthRequest } from '../../middleware/authenticate';
import { NextFunction, Response } from 'express';

const router = Router();
router.use(authenticate);

const t = (req: AuthRequest) => req.user!.tenantId;

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await userService.listRoles(t(req))); } catch (err) { next(err); }
});
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) { res.status(422).json({ success: false, message: 'Role name is required' }); return; }
    sendSuccess(res, await userService.createRole(t(req), req.body, req.user!.sub), 'Role created', 201);
  } catch (err) { next(err); }
});
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await userService.getRoleById(t(req), req.params['id']!)); } catch (err) { next(err); }
});
router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await userService.updateRole(t(req), req.params['id']!, req.body, req.user!.sub)); } catch (err) { next(err); }
});
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { await userService.deleteRole(t(req), req.params['id']!); sendSuccess(res, null, 'Role deleted'); } catch (err) { next(err); }
});

export default router;
