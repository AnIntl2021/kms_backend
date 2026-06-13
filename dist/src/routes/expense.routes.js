import { Router } from 'express';
import { getExpenses, createExpense, deleteExpense } from '../controllers/expense.controller';
import { authMiddleware } from '../middleware/auth.middleware';
const router = Router();
router.get('/', authMiddleware, getExpenses);
router.post('/', authMiddleware, createExpense);
router.delete('/:id', authMiddleware, deleteExpense);
export default router;
