"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("../controllers/analytics.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/forecasting', auth_middleware_1.authMiddleware, analytics_controller_1.getStoreForecasting);
router.get('/health', auth_middleware_1.authMiddleware, analytics_controller_1.getProductionHealth);
exports.default = router;
