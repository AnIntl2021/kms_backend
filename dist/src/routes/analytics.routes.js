import { Router } from 'express';
import { getStoreForecasting, getProductionHealth } from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware/auth.middleware';
const router = Router();
router.get('/forecasting', authMiddleware, getStoreForecasting);
router.get('/health', authMiddleware, getProductionHealth);
export default router;
