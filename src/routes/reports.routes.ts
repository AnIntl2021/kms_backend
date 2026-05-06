import { Router } from 'express';
import { getSalesReport, getProductionReport, getWastageReport, getAnalyticsSummary, getPurchaseReport } from '../controllers/reports.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/sales', authMiddleware, getSalesReport);
router.get('/production', authMiddleware, getProductionReport);
router.get('/wastage', authMiddleware, getWastageReport);
router.get('/purchase', authMiddleware, getPurchaseReport);
router.get('/analytics', authMiddleware, getAnalyticsSummary);

export default router;
