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
// Record a payment against a vendor. The vendor id comes from the URL; inject it
// into the body so the service (which reads body.vendorId) receives it. This
// route was missing, which is why "Record Payment" errored (Divya R65 / Vinay P8.2).
router.post('/:id/payments', requirePermission('vendors', 'edit'), (req, _res, next) => {
  (req.body as Record<string, unknown>)['vendorId'] = req.params['id'];
  next();
}, vendorController.createPayment);
// Create a purchase invoice for a vendor (used by "Upload Invoice").
router.post('/:id/invoices', requirePermission('vendors', 'edit'), (req, _res, next) => {
  (req.body as Record<string, unknown>)['vendorId'] = req.params['id'];
  next();
}, vendorController.createInvoice);

export default router;
