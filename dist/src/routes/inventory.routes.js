import { Router } from 'express';
import { getInventoryItems, createInventoryItem, updateInventoryItem, deleteInventoryItem, adjustStock, getInventoryPackages } from '../controllers/inventory.controller';
import { authMiddleware } from '../middleware/auth.middleware';
const router = Router();
router.use(authMiddleware); // All inventory routes require authentication
router.get('/', getInventoryItems);
router.get('/packages', getInventoryPackages);
router.post('/', createInventoryItem);
router.put('/:id', updateInventoryItem);
router.delete('/:id', deleteInventoryItem);
router.post('/:id/adjust-stock', adjustStock);
export default router;
