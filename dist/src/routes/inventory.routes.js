"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventory_controller_1 = require("../controllers/inventory.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware); // All inventory routes require authentication
router.get('/', inventory_controller_1.getInventoryItems);
router.get('/packages', inventory_controller_1.getInventoryPackages);
router.post('/', inventory_controller_1.createInventoryItem);
router.put('/:id', inventory_controller_1.updateInventoryItem);
router.delete('/:id', inventory_controller_1.deleteInventoryItem);
router.post('/:id/adjust-stock', inventory_controller_1.adjustStock);
exports.default = router;
