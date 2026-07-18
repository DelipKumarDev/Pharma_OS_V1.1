import { Router } from 'express';
import * as returnsController from './returns.controller';
import { authenticate, requirePermission } from '../../middleware/authenticate';

const router = Router();
router.use(authenticate);
router.get('/stats', requirePermission('returns', 'view'), returnsController.getStats);
router.get('/', requirePermission('returns', 'view'), returnsController.list);
router.post('/', requirePermission('returns', 'create'), returnsController.create);
router.get('/:id', requirePermission('returns', 'view'), returnsController.getById);
router.patch('/:id/approve', requirePermission('returns', 'approve'), returnsController.approve);
router.patch('/:id/process', requirePermission('returns', 'approve'), returnsController.process);
router.patch('/:id/reject', requirePermission('returns', 'approve'), returnsController.reject);

export default router;
