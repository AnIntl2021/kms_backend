import { Router } from 'express';
import { getWastageLogs, recordWastage } from '../controllers/wastage.controller';
import { authMiddleware, authorize } from '../middleware/auth.middleware';
const router = Router();
router.use(authMiddleware);
router.get('/', getWastageLogs);
router.post('/', authorize(['super_admin', 'manager']), recordWastage);
export default router;
