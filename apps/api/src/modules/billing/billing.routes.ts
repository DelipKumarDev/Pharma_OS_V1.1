import { Router } from 'express';
import * as billingController from './billing.controller';
import { authenticate, requirePermission } from '../../middleware/authenticate';

const router = Router();
router.use(authenticate);
router.get('/', requirePermission('billing', 'view'), billingController.list);
router.get('/:id', requirePermission('billing', 'view'), billingController.getById);
router.post('/', requirePermission('billing', 'create'), billingController.create);

export default router;
