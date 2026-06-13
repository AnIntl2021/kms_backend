import { verifyToken } from '../utils/jwt';
import { errorResponse } from '../utils/response';
export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return errorResponse(res, 'Authentication required', 401);
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
        return errorResponse(res, 'Invalid or expired token', 401);
    }
    req.user = decoded;
    next();
};
export const authorize = (allowedRolesOrPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return errorResponse(res, 'Access denied: not authenticated', 403);
        }
        // Check if the user's role is in the allowed list (backward compatibility)
        const hasRole = allowedRolesOrPermissions.includes(req.user.role);
        // Check if the user has at least one of the required permissions
        const userPermissions = req.user.permissions || [];
        const hasPermission = allowedRolesOrPermissions.some(perm => userPermissions.includes(perm));
        if (!hasRole && !hasPermission && req.user.role !== 'super_admin') {
            return errorResponse(res, 'Access denied: insufficient permissions', 403);
        }
        next();
    };
};
