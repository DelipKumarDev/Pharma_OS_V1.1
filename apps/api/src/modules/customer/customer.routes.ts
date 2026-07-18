import { Router } from 'express';
import * as customerController from './customer.controller';
import { authenticate, requirePermission } from '../../middleware/authenticate';

const router = Router();
router.use(authenticate);
router.get('/stats', requirePermission('customers', 'view'), customerController.getStats);
router.get('/', requirePermission('customers', 'view'), customerController.list);
router.get('/:id', requirePermission('customers', 'view'), customerController.getById);
router.post('/', requirePermission('customers', 'create'), customerController.create);
router.patch('/:id', requirePermission('customers', 'edit'), customerController.update);
router.get('/:id/purchases', requirePermission('customers', 'view'), customerController.getPurchases);

export default router;
