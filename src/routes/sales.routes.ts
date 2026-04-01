import { Router } from 'express';
import { getSales, createSale, updateSaleStatus, getSaleById, returnOrder } from '../controllers/sales.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, getSales);
router.get('/:id', authMiddleware, getSaleById);
router.post('/', authMiddleware, createSale);
router.put('/:id/status', authMiddleware, updateSaleStatus);
router.post('/:id/return', authMiddleware, returnOrder);

export default router;
