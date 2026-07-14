import { Router } from 'express';
import * as inventoryController from './inventory.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.use(authenticate);
router.get('/stats', inventoryController.getStats);
router.get('/ai-insights', inventoryController.getAiInsights);
router.get('/batches/:medicineId', inventoryController.getBatches);
router.get('/movements/:medicineId', inventoryController.getMovements);
router.get('/', inventoryController.list);
router.post('/', inventoryController.create);
router.patch('/:id/adjust', inventoryController.adjust);
router.patch('/:id/status', inventoryController.updateStatus);
router.delete('/:id', inventoryController.remove);

export default router;
