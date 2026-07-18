import { Router } from 'express';
import * as inventoryController from './inventory.controller';
import { authenticate, requirePermission } from '../../middleware/authenticate';

const router = Router();

router.use(authenticate);
router.get('/stats', requirePermission('inventory', 'view'), inventoryController.getStats);
router.get('/ai-insights', requirePermission('inventory', 'view'), inventoryController.getAiInsights);
router.get('/batches/:medicineId', requirePermission('inventory', 'view'), inventoryController.getBatches);
router.get('/movements/:medicineId', requirePermission('inventory', 'view'), inventoryController.getMovements);
router.get('/', requirePermission('inventory', 'view'), inventoryController.list);
router.post('/', requirePermission('inventory', 'create'), inventoryController.create);
router.patch('/:id/adjust', requirePermission('inventory', 'edit'), inventoryController.adjust);
router.patch('/:id/status', requirePermission('inventory', 'edit'), inventoryController.updateStatus);
router.delete('/:id', requirePermission('inventory', 'delete'), inventoryController.remove);

export default router;
