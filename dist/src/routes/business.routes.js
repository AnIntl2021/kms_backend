import { Router } from 'express';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../controllers/product.controller';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller';
import { getAuditLogs } from '../controllers/auth.controller';
import { authMiddleware, authorize } from '../middleware/auth.middleware';
const router = Router();
// Products
router.get('/products', authMiddleware, getProducts);
router.post('/products', authMiddleware, authorize(['super_admin', 'inventory_controller']), createProduct);
router.put('/products/:id', authMiddleware, authorize(['super_admin', 'inventory_controller']), updateProduct);
router.delete('/products/:id', authMiddleware, authorize(['super_admin', 'inventory_controller']), deleteProduct);
// Categories
router.get('/categories', authMiddleware, getCategories);
router.post('/categories', authMiddleware, authorize(['super_admin', 'manager']), createCategory);
router.put('/categories/:id', authMiddleware, authorize(['super_admin']), updateCategory);
router.delete('/categories/:id', authMiddleware, authorize(['super_admin']), deleteCategory);
// Settings & Logs
router.get('/settings', getSettings); // Public so app can check for force update
router.put('/settings', authMiddleware, authorize(['super_admin']), updateSettings);
router.get('/audit-logs', authMiddleware, authorize(['super_admin']), getAuditLogs);
export default router;
