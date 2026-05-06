import { Router } from 'express';
import { getSettings, updateSettings, triggerBackup } from '../controllers/settings.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, getSettings);
router.post('/update', authMiddleware, updateSettings);
router.post('/backup', authMiddleware, triggerBackup);

export default router;
