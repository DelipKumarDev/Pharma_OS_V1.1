import { Router } from 'express';
import * as vendorController from './vendor.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();
router.use(authenticate);

router.get('/', vendorController.listInvoices);
router.post('/', vendorController.createInvoice);
router.get('/:id', vendorController.getInvoiceById);
router.patch('/:id/confirm', vendorController.confirmInvoice);

export default router;
