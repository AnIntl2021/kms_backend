"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const accounts_controller_js_1 = require("../controllers/accounts.controller.js");
const auth_middleware_js_1 = require("../middleware/auth.middleware.js");
const router = (0, express_1.Router)();
// Financial endpoints
router.get('/transactions', auth_middleware_js_1.authMiddleware, (0, auth_middleware_js_1.authorize)(['super_admin', 'manager']), accounts_controller_js_1.getTransactions);
router.get('/summary', auth_middleware_js_1.authMiddleware, (0, auth_middleware_js_1.authorize)(['super_admin', 'manager']), accounts_controller_js_1.getFinancialSummary);
exports.default = router;
