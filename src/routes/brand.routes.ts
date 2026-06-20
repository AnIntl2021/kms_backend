import { Router } from 'express';
import { getBrands, createBrand, updateBrand, deleteBrand } from '../controllers/brand.controller';
import { authMiddleware, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getBrands);
router.post('/', authorize(['super_admin', 'manager']), createBrand);
router.put('/:id', authorize(['super_admin', 'manager']), updateBrand);
router.delete('/:id', authorize(['super_admin']), deleteBrand);

export default router;
