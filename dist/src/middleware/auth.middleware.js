"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreTenantContext = exports.authorize = exports.authMiddleware = void 0;
const jwt_1 = require("../utils/jwt");
const response_1 = require("../utils/response");
const tenantContext_1 = require("./tenantContext");
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return (0, response_1.errorResponse)(res, 'Authentication required', 401);
    }
    const token = authHeader.split(' ')[1];
    const decoded = (0, jwt_1.verifyToken)(token);
    if (!decoded) {
        return (0, response_1.errorResponse)(res, 'Invalid or expired token', 401);
    }
    req.user = decoded;
    // Wrap the rest of the request in the tenant context
    tenantContext_1.tenantContext.run({ dbName: decoded.tenant_db || 'kms_master' }, () => {
        next();
    });
};
exports.authMiddleware = authMiddleware;
const authorize = (allowedRolesOrPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return (0, response_1.errorResponse)(res, 'Access denied: not authenticated', 403);
        }
        console.log('🔒 AUTH DEBUGLOG:', {
            userRole: req.user.role,
            userPermissions: req.user.permissions,
            required: allowedRolesOrPermissions
        });
        // Check if the user's role is in the allowed list (backward compatibility)
        const hasRole = allowedRolesOrPermissions.includes(req.user.role);
        // Check if the user has at least one of the required permissions
        const userPermissions = req.user.permissions || [];
        const hasPermission = allowedRolesOrPermissions.some(perm => userPermissions.includes(perm));
        if (!hasRole && !hasPermission && req.user.role !== 'super_admin' && req.user.role !== 'tenant_admin') {
            return (0, response_1.errorResponse)(res, 'Access denied: insufficient permissions', 403);
        }
        next();
    };
};
exports.authorize = authorize;
const restoreTenantContext = (req, res, next) => {
    if (req.user && req.user.tenant_db) {
        tenantContext_1.tenantContext.run({ dbName: req.user.tenant_db }, () => {
            next();
        });
    }
    else {
        next();
    }
};
exports.restoreTenantContext = restoreTenantContext;
