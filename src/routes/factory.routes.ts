import { Router } from 'express';
import { 
  createSalesOrder, 
  processReturn, 
  getDispatches,
  updateSalesOrder,
  getReturns,
  getOrderItems,
  getReturnItems,
  deleteSalesOrder,
  updateReturn
} from '../controllers/factory.controller';
import { recordBatchProduction, getProductionLogs, deleteProductionBatch } from '../controllers/production.controller';
import { updateDispatchStatus } from '../controllers/dispatch.controller';
import { authMiddleware, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/dispatches', authMiddleware, getDispatches);
router.get('/returns', authMiddleware, getReturns);
router.get('/production/logs', authMiddleware, getProductionLogs);
router.put('/dispatches/:id/status', authMiddleware, updateDispatchStatus);
router.post('/production/batch', authMiddleware, authorize(['super_admin', 'manager', 'inventory_controller']), recordBatchProduction);
router.post('/sales', authMiddleware, authorize(['super_admin', 'manager', 'sales_dispatch']), createSalesOrder);
router.put('/sales/:sale_id', authMiddleware, authorize(['super_admin', 'manager', 'sales_dispatch']), updateSalesOrder);
router.post('/returns', authMiddleware, authorize(['super_admin', 'manager', 'sales_dispatch']), processReturn);
router.put('/returns/:return_id', authMiddleware, authorize(['super_admin', 'manager', 'sales_dispatch']), updateReturn);

router.get('/sales/:sale_id/items', authMiddleware, getOrderItems);
router.get('/returns/:return_id/items', authMiddleware, getReturnItems);
router.delete('/sales/:id', authMiddleware, authorize(['super_admin', 'manager']), deleteSalesOrder);
router.delete('/production/batch/:id', authMiddleware, authorize(['super_admin', 'manager']), deleteProductionBatch);
export default router;
