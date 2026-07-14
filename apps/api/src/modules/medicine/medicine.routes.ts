import { Router } from 'express';
import * as medicineController from './medicine.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.use(authenticate);
router.get('/barcode/:code', medicineController.getByBarcode);
router.get('/', medicineController.list);
router.get('/:id', medicineController.getById);
router.post('/', medicineController.create);
router.put('/:id', medicineController.update);
router.delete('/:id', medicineController.remove);

export default router;
