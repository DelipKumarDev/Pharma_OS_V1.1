import { Router } from 'express';
import * as billingController from './billing.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();
router.use(authenticate);
router.get('/', billingController.list);
router.get('/:id', billingController.getById);
router.post('/', billingController.create);

export default router;
