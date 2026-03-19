import { Router } from 'express';
import { login, getProfile } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/login', login);

// Protected routes
router.get('/profile', authMiddleware, getProfile);

export default router;
