import { Router } from 'express';
import { getNotifications, markAsRead, clearAll } from '../controllers/notification.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
const router = Router();
router.get('/', authMiddleware, getNotifications);
router.put('/:id/read', authMiddleware, markAsRead);
router.post('/clear-all', authMiddleware, clearAll);
export default router;
