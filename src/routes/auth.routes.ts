import { Router } from 'express';
import { login, getProfile, getUsers, createUser, updateUser, deleteUser, getRoles } from '../controllers/auth.controller';
import { createRole, updateRole, deleteRole } from '../controllers/roles.controller';
import { authMiddleware, authorize } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/login', login);

// Protected routes
router.get('/profile', authMiddleware, getProfile);
router.get('/roles', authMiddleware, authorize(['super_admin', 'manager', 'roles']), getRoles);
router.post('/roles', authMiddleware, authorize(['super_admin', 'manager', 'roles']), createRole);
router.put('/roles/:id', authMiddleware, authorize(['super_admin', 'manager', 'roles']), updateRole);
router.delete('/roles/:id', authMiddleware, authorize(['super_admin', 'manager', 'roles']), deleteRole);

router.get('/users', authMiddleware, authorize(['super_admin', 'manager', 'users']), getUsers);
router.post('/users', authMiddleware, authorize(['super_admin', 'manager', 'users']), createUser);
router.put('/users/:id', authMiddleware, authorize(['super_admin', 'manager', 'users']), updateUser);
router.delete('/users/:id', authMiddleware, authorize(['super_admin', 'manager', 'users']), deleteUser);

export default router;
