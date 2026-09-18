/**
 * Security Middleware — Headers, CORS, request sanitization, error handling.
 */
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { SECURITY_CONFIG } from '../config/security.js';

/**
 * Helmet security headers.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: SECURITY_CONFIG.server.isProduction
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
});

/**
 * CORS configuration — explicit origins, no wildcards.
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (SECURITY_CONFIG.cors.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: SECURITY_CONFIG.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 600,
});

/**
 * Request ID middleware — assigns a unique ID to each request for audit correlation.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  req.requestId = req.get('X-Request-ID') || randomUUID();
  res.set('X-Request-ID', req.requestId);
  next();
}

/**
 * Global error handler — NEVER exposes internals to clients.
 */
export function errorHandler(err: Error & { status?: number; statusCode?: number; type?: string }, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.status || err.statusCode || 500;

  // Handle JSON parse errors (malformed request bodies)
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    res.status(400).json({
      error: 'Invalid JSON in request body',
      code: 'INVALID_JSON',
      requestId: req.requestId,
    });
    return;
  }

  // Handle entity too large
  if (err.type === 'entity.too.large') {
    res.status(413).json({
      error: 'Request body too large',
      code: 'PAYLOAD_TOO_LARGE',
      requestId: req.requestId,
    });
    return;
  }

  console.error(`[${req.requestId}] Unhandled error:`, err.message);

  if (SECURITY_CONFIG.server.isProduction) {
    res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      error: 'An internal error occurred. Please try again later.',
      code: 'INTERNAL_ERROR',
      requestId: req.requestId,
    });
  } else {
    res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      error: statusCode < 500 ? err.message : 'An internal error occurred.',
      code: 'INTERNAL_ERROR',
      requestId: req.requestId,
    });
  }
}

/**
 * Cache control for sensitive API responses.
 */
export function noCacheHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
  });
  next();
}

/**
 * Request size limiter — reject oversized requests.
 */
export function requestSizeLimiter(maxBytes: number = 1_048_576) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    if (contentLength > maxBytes) {
      res.status(413).json({
        error: 'Request body too large',
        code: 'PAYLOAD_TOO_LARGE',
      });
      return;
    }
    next();
  };
}

/**
 * Content-Type validation for mutation requests.
 */
export function requireJsonContentType(req: Request, res: Response, next: NextFunction): void {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    const hasBody = contentLength > 0 || req.get('Transfer-Encoding');
    if (hasBody) {
      const ct = req.get('Content-Type');
      if (!ct || !ct.includes('application/json')) {
        res.status(415).json({
          error: 'Content-Type must be application/json',
          code: 'UNSUPPORTED_MEDIA_TYPE',
        });
        return;
      }
    }
  }
  next();
}
