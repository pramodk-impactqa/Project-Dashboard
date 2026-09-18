/**
 * RBAC Authorization Middleware
 * Verifies that authenticated users have the required permissions.
 * BACKEND ENFORCES AUTHORIZATION — hiding UI buttons is NOT security.
 */
import type { Request, Response, NextFunction } from 'express';
import { hasPermission, hasAnyPermission } from '../services/rbac.service.js';
import { logSecurityEvent } from '../services/audit.service.js';

/**
 * Require a specific permission.
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.session?.role;
    if (!role) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }

    if (!hasPermission(role, permission)) {
      logSecurityEvent({
        eventType: 'AUTHORIZATION_FAILURE',
        severity: 'HIGH',
        actorId: req.session?.userId,
        details: `User with role ${role} attempted ${permission} on ${req.method} ${req.path}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.status(403).json({
        error: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}

/**
 * Require any one of multiple permissions.
 */
export function requireAnyPermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.session?.role;
    if (!role) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }

    if (!hasAnyPermission(role, permissions)) {
      logSecurityEvent({
        eventType: 'AUTHORIZATION_FAILURE',
        severity: 'HIGH',
        actorId: req.session?.userId,
        details: `User with role ${role} attempted [${permissions.join(',')}] on ${req.method} ${req.path}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.status(403).json({
        error: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}

/**
 * Require a specific role (e.g., for admin-only operations).
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.session?.role;
    if (!userRole) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
      return;
    }

    if (!roles.includes(userRole)) {
      logSecurityEvent({
        eventType: 'AUTHORIZATION_FAILURE',
        severity: 'HIGH',
        actorId: req.session?.userId,
        details: `User with role ${userRole} attempted access requiring role [${roles.join(',')}] on ${req.method} ${req.path}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.status(403).json({
        error: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}
