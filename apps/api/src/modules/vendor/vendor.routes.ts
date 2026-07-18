import { Router } from 'express';
import * as vendorController from './vendor.controller';
import { authenticate, requirePermission } from '../../middleware/authenticate';

const router = Router();
router.use(authenticate);

// Vendor routes
router.get('/stats', requirePermission('vendors', 'view'), vendorController.getStats);
router.get('/', requirePermission('vendors', 'view'), vendorController.list);
router.post('/', requirePermission('vendors', 'create'), vendorController.create);
router.get('/:id', requirePermission('vendors', 'view'), vendorController.getById);
router.patch('/:id', requirePermission('vendors', 'edit'), vendorController.update);
router.delete('/:id', requirePermission('vendors', 'edit'), vendorController.deactivate);
router.get('/:id/invoices', requirePermission('vendors', 'view'), vendorController.getInvoices);
router.get('/:id/payments', requirePermission('vendors', 'view'), vendorController.getPayments);

export default router;
