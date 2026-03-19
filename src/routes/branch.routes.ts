import { Router } from 'express';
import { getBranches, createBranch, updateBranch, deleteBranch } from '../controllers/branch.controller';
import { authMiddleware, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getBranches);
router.post('/', authorize(['super_admin', 'manager']), createBranch);
router.put('/:id', authorize(['super_admin', 'manager']), updateBranch);
router.delete('/:id', authorize(['super_admin']), deleteBranch);

export default router;
