import { Router } from 'express';
import * as vendorController from './vendor.controller';
import { authenticate, requirePermission } from '../../middleware/authenticate';

const router = Router();
router.use(authenticate);

router.get('/', requirePermission('vendors', 'view'), vendorController.listInvoices);
router.post('/', requirePermission('vendors', 'create'), vendorController.createInvoice);
router.get('/:id', requirePermission('vendors', 'view'), vendorController.getInvoiceById);
router.patch('/:id/confirm', requirePermission('vendors', 'edit'), vendorController.confirmInvoice);

export default router;
