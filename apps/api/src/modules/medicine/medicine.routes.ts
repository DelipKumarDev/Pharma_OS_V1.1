import { Router } from 'express';
import * as medicineController from './medicine.controller';
import { authenticate, requirePermission } from '../../middleware/authenticate';

const router = Router();

router.use(authenticate);
router.get('/barcode/:code', requirePermission('medicines', 'view'), medicineController.getByBarcode);
router.get('/', requirePermission('medicines', 'view'), medicineController.list);
router.get('/:id', requirePermission('medicines', 'view'), medicineController.getById);
router.post('/', requirePermission('medicines', 'create'), medicineController.create);
router.put('/:id', requirePermission('medicines', 'edit'), medicineController.update);
router.delete('/:id', requirePermission('medicines', 'delete'), medicineController.remove);

export default router;
