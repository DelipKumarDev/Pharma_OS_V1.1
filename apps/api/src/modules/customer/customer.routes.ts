import { Router } from 'express';
import * as customerController from './customer.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();
router.use(authenticate);
router.get('/stats', customerController.getStats);
router.get('/', customerController.list);
router.get('/:id', customerController.getById);
router.post('/', customerController.create);
router.patch('/:id', customerController.update);
router.get('/:id/purchases', customerController.getPurchases);

export default router;
