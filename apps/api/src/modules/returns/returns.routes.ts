import { Router } from 'express';
import * as returnsController from './returns.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();
router.use(authenticate);
router.get('/stats', returnsController.getStats);
router.get('/', returnsController.list);
router.post('/', returnsController.create);
router.get('/:id', returnsController.getById);
router.patch('/:id/approve', returnsController.approve);
router.patch('/:id/process', returnsController.process);
router.patch('/:id/reject', returnsController.reject);

export default router;
