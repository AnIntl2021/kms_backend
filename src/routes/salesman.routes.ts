import { Router } from 'express';
import * as salesmanController from '../controllers/salesman.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', salesmanController.getSalesmen);
router.get('/performance', salesmanController.getSalesmanPerformance);
router.get('/:id', salesmanController.getSalesmanById);
router.post('/', salesmanController.createSalesman);
router.put('/:id', salesmanController.updateSalesman);
router.delete('/:id', salesmanController.deleteSalesman);

export default router;
