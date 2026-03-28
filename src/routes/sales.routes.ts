import { Router } from 'express';
import { getSales, createSale, updateSaleStatus } from '../controllers/sales.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, getSales);
router.post('/', authMiddleware, createSale);
router.put('/:id/status', authMiddleware, updateSaleStatus);

export default router;
