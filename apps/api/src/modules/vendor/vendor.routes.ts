import { Router } from 'express';
import * as vendorController from './vendor.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();
router.use(authenticate);

// Vendor routes
router.get('/stats', vendorController.getStats);
router.get('/', vendorController.list);
router.post('/', vendorController.create);
router.get('/:id', vendorController.getById);
router.patch('/:id', vendorController.update);
router.delete('/:id', vendorController.deactivate);
router.get('/:id/invoices', vendorController.getInvoices);
router.get('/:id/payments', vendorController.getPayments);

export default router;
