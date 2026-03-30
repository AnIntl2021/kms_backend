import { Router } from 'express';
import { 
  createSalesOrder, 
  processReturn, 
  getDispatches 
} from '../controllers/factory.controller';
import { recordBatchProduction, getProductionLogs } from '../controllers/production.controller';
import { updateDispatchStatus } from '../controllers/dispatch.controller';
import { authMiddleware, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/dispatches', authMiddleware, getDispatches);
router.get('/production/logs', authMiddleware, getProductionLogs);
router.put('/dispatches/:id/status', authMiddleware, updateDispatchStatus);
router.post('/production/batch', authMiddleware, authorize(['super_admin', 'manager', 'inventory_controller']), recordBatchProduction);
router.post('/sales', authMiddleware, authorize(['super_admin', 'manager', 'sales_dispatch']), createSalesOrder);
router.post('/returns', authMiddleware, authorize(['super_admin', 'manager', 'sales_dispatch']), processReturn);

export default router;
