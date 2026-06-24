"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const roles_controller_1 = require("../controllers/roles.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public routes
router.post('/login', auth_controller_1.login);
// Protected routes
router.get('/profile', auth_middleware_1.authMiddleware, auth_controller_1.getProfile);
router.get('/roles', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin', 'manager', 'roles']), auth_controller_1.getRoles);
router.post('/roles', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin', 'manager', 'roles']), roles_controller_1.createRole);
router.put('/roles/:id', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin', 'manager', 'roles']), roles_controller_1.updateRole);
router.delete('/roles/:id', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin', 'manager', 'roles']), roles_controller_1.deleteRole);
router.get('/users', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin', 'manager', 'users']), auth_controller_1.getUsers);
router.post('/users', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin', 'manager', 'users']), auth_controller_1.createUser);
router.put('/users/:id', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin', 'manager', 'users']), auth_controller_1.updateUser);
router.delete('/users/:id', auth_middleware_1.authMiddleware, (0, auth_middleware_1.authorize)(['super_admin', 'manager', 'users']), auth_controller_1.deleteUser);
exports.default = router;
