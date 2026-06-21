import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { errorResponse } from '../utils/response';

import { tenantContext } from './tenantContext';

export interface AuthRequest extends Request {
  user?: any;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
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
  
  // Wrap the rest of the request in the tenant context
  tenantContext.run({ dbName: decoded.tenant_db || 'kms_master' }, () => {
    next();
  });
};

export const authorize = (allowedRolesOrPermissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return errorResponse(res, 'Access denied: not authenticated', 403);
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
      return errorResponse(res, 'Access denied: insufficient permissions', 403);
    }
    
    next();
  };
};

export const restoreTenantContext = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.tenant_db) {
    tenantContext.run({ dbName: req.user.tenant_db }, () => {
      next();
    });
  } else {
    next();
  }
};
