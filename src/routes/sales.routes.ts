import { Router } from 'express';
import { getSales, createSale, updateSaleStatus, updatePaymentStatus, getSaleById, returnOrder, deleteSale, searchCustomers } from '../controllers/sales.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, getSales);
router.get('/customers/search', authMiddleware, searchCustomers);
router.get('/:id', authMiddleware, getSaleById);
router.post('/', authMiddleware, createSale);
router.put('/:id/status', authMiddleware, updateSaleStatus);
router.put('/:id/payment-status', authMiddleware, updatePaymentStatus);
router.post('/:id/return', authMiddleware, returnOrder);
router.delete('/:id', authMiddleware, deleteSale);

export default router;
