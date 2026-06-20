import { Router } from 'express';
import { createTenant, getTenants, updateTenant } from '../controllers/tenant.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// In a real app, we'd add authorizeRoles('super_admin') here too
router.use(authMiddleware);

router.get('/', getTenants);
router.post('/', createTenant);
router.put('/:id', updateTenant);

export default router;
