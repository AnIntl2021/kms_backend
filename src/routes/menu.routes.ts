import { Router } from 'express';
import { 
  getMenuItems, 
  getMenuItemDetails, 
  createMenuItem, 
  deleteMenuItem 
} from '../controllers/menu.controller';
import { authMiddleware, authorize } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getMenuItems);
router.get('/:id', getMenuItemDetails);
router.post('/', authorize(['super_admin', 'manager']), upload.single('image'), createMenuItem);
router.delete('/:id', authorize(['super_admin']), deleteMenuItem);

export default router;
