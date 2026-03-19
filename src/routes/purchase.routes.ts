import { Router } from 'express';
import { 
  getPurchaseOrders, 
  getPurchaseOrderById, 
  createPurchaseOrder, 
  receivePurchaseOrder,
  updatePurchaseOrder 
} from '../controllers/purchase.controller';
import { authMiddleware, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getPurchaseOrders);
router.get('/:id', getPurchaseOrderById);
router.post('/', authorize(['super_admin', 'manager', 'inventory_controller']), createPurchaseOrder);
router.put('/:id', authorize(['super_admin', 'manager']), updatePurchaseOrder);
router.post('/:id/receive', authorize(['super_admin', 'inventory_controller']), receivePurchaseOrder);

export default router;
