import { Router } from 'express';
import { getTransactions, getFinancialSummary } from '../controllers/accounts.controller.js';
import { authMiddleware, authorize } from '../middleware/auth.middleware.js';
const router = Router();
// Financial endpoints
router.get('/transactions', authMiddleware, authorize(['super_admin', 'manager']), getTransactions);
router.get('/summary', authMiddleware, authorize(['super_admin', 'manager']), getFinancialSummary);
export default router;
