import { Router } from 'express';
import { login, getProfile, getUsers, createUser, getRoles } from '../controllers/auth.controller';
import { authMiddleware, authorize } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/login', login);

// Protected routes
router.get('/profile', authMiddleware, getProfile);
router.get('/roles', authMiddleware, getRoles);
router.get('/users', authMiddleware, authorize(['super_admin', 'manager']), getUsers);
router.post('/users', authMiddleware, authorize(['super_admin', 'manager']), createUser);

export default router;
