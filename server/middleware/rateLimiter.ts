/**
 * Rate Limiting Middleware — protects against brute-force, credential stuffing, abuse.
 * ALWAYS enforced server-side. Never rely on client-side rate limiting.
 */
import rateLimit from 'express-rate-limit';
import { SECURITY_CONFIG } from '../config/security.js';

/**
 * Global API rate limiter.
 */
export const globalRateLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.rateLimit.globalWindowMs,
  max: SECURITY_CONFIG.rateLimit.globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMITED',
  },
});

/**
 * Strict rate limiter for authentication endpoints.
 */
export const authRateLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.rateLimit.authWindowMs,
  max: SECURITY_CONFIG.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    error: 'Too many authentication attempts. Please try again later.',
    code: 'AUTH_RATE_LIMITED',
  },
});

/**
 * Strict rate limiter for sensitive operations (password reset, MFA).
 */
export const sensitiveRateLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.rateLimit.sensitiveWindowMs,
  max: SECURITY_CONFIG.rateLimit.sensitiveMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests for this operation. Please try again later.',
    code: 'SENSITIVE_RATE_LIMITED',
  },
});
