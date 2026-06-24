"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tenant_controller_1 = require("../controllers/tenant.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// In a real app, we'd add authorizeRoles('super_admin') here too
router.use(auth_middleware_1.authMiddleware);
router.get('/', tenant_controller_1.getTenants);
router.post('/', tenant_controller_1.createTenant);
router.put('/:id', tenant_controller_1.updateTenant);
exports.default = router;
