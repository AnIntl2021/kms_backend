import { Router } from 'express';
import { getTransfers, createTransfer, updateTransferStatus } from '../controllers/transfer.controller';
import { authMiddleware, authorize } from '../middleware/auth.middleware';
const router = Router();
router.use(authMiddleware);
router.get('/', getTransfers);
router.post('/', authorize(['super_admin', 'manager']), createTransfer);
router.put('/:id/status', authorize(['super_admin', 'manager']), updateTransferStatus);
export default router;
