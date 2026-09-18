/**
 * Authentication Middleware
 * Verifies that requests come from authenticated users with valid sessions.
 * BACKEND ENFORCES AUTHENTICATION — never trust the frontend.
 */
import type { Request, Response, NextFunction } from 'express';
import { SECURITY_CONFIG } from '../config/security.js';
import { logSecurityEvent } from '../services/audit.service.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    logSecurityEvent({
      eventType: 'UNAUTHENTICATED_ACCESS',
      severity: 'MEDIUM',
      details: `Unauthenticated request to ${req.method} ${req.path}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  // Check MFA pending — if user has MFA enabled but hasn't verified yet
  if (req.session.mfaPending && !req.path.startsWith('/api/auth/mfa')) {
    res.status(403).json({
      error: 'MFA verification required',
      code: 'MFA_REQUIRED',
    });
    return;
  }

  // Check idle timeout
  const now = Date.now();
  const lastActivity = req.session.lastActivity || 0;
  if (now - lastActivity > SECURITY_CONFIG.session.idleTimeoutMs) {
    req.session.destroy((err) => {
      if (err) console.error('Session destroy error:', err);
    });
    res.status(401).json({
      error: 'Session expired due to inactivity. Please sign in again.',
      code: 'SESSION_EXPIRED',
    });
    return;
  }

  // Check absolute lifetime
  const createdAt = req.session.createdAt || 0;
  if (now - createdAt > SECURITY_CONFIG.session.absoluteLifetimeMs) {
    req.session.destroy((err) => {
      if (err) console.error('Session destroy error:', err);
    });
    res.status(401).json({
      error: 'Session expired. Please sign in again.',
      code: 'SESSION_EXPIRED',
    });
    return;
  }

  // Update last activity
  req.session.lastActivity = now;
  next();
}

/**
 * Require recent authentication for sensitive operations.
 * The session must have been created within the last N minutes.
 */
export function requireRecentAuth(maxAgeMs: number = 5 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      const createdAt = req.session.createdAt || 0;
      const now = Date.now();
      if (now - createdAt > maxAgeMs) {
        res.status(403).json({
          error: 'This operation requires reauthentication. Please sign in again.',
          code: 'REAUTH_REQUIRED',
        });
        return;
      }
      next();
    });
  };
}
