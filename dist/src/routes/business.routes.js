"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const product_controller_1 = require("../controllers/product.controller");
const settings_controller_1 = require("../controllers/settings.controller");
const category_controller_1 = require("../controllers/category.controller");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Products
router.get('/products', auth_middleware_1.authMiddleware, product_controller_1.getProducts);
router.post('/products', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin', 'inventory_controller']), product_controller_1.createProduct);
router.put('/products/:id', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin', 'inventory_controller']), product_controller_1.updateProduct);
router.delete('/products/:id', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin', 'inventory_controller']), product_controller_1.deleteProduct);
// Categories
router.get('/categories', auth_middleware_1.authMiddleware, category_controller_1.getCategories);
router.post('/categories', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin', 'manager']), category_controller_1.createCategory);
router.put('/categories/:id', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin']), category_controller_1.updateCategory);
router.delete('/categories/:id', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin']), category_controller_1.deleteCategory);
// Settings & Logs
router.get('/settings', settings_controller_1.getSettings); // Public so app can check for force update
router.put('/settings', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin']), settings_controller_1.updateSettings);
router.get('/audit-logs', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin']), auth_controller_1.getAuditLogs);
exports.default = router;
