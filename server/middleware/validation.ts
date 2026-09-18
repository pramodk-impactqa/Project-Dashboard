/**
 * Validation Middleware — wraps Zod schemas as Express middleware.
 * All input validation happens server-side. Never trust frontend.
 * Compatible with Zod v4 (uses .issues instead of .errors).
 */
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

function formatZodError(err: unknown): { field: string; message: string }[] {
  if (err && typeof err === 'object' && 'issues' in err) {
    const issues = (err as { issues: { path: (string | number)[]; message: string }[] }).issues;
    return issues.map(issue => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
  }
  return [{ field: 'unknown', message: String(err) }];
}

function isZodError(err: unknown): boolean {
  return err instanceof Error && err.name === 'ZodError';
}

export function validateBody<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (isZodError(err)) {
        res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: formatZodError(err),
        });
        return;
      }
      next(err);
    }
  };
}

export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (err) {
      if (isZodError(err)) {
        res.status(400).json({
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: formatZodError(err),
        });
        return;
      }
      next(err);
    }
  };
}

export function validateParams<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (err) {
      if (isZodError(err)) {
        res.status(400).json({
          error: 'Invalid parameters',
          code: 'VALIDATION_ERROR',
          details: formatZodError(err),
        });
        return;
      }
      next(err);
    }
  };
}
