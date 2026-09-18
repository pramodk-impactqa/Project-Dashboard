/**
 * Centralized Security Configuration
 * All security-related constants and policies in one place.
 * Values can be overridden via environment variables.
 */

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseInt(v, 10) : fallback;
}

function envStr(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (!v) return fallback;
  return v === 'true' || v === '1';
}

export const SECURITY_CONFIG = {
  // ── Session ─────────────────────────────────────────────────
  session: {
    secret: envStr('SESSION_SECRET', ''),
    idleTimeoutMs: envInt('SESSION_IDLE_TIMEOUT_MIN', 30) * 60 * 1000,
    absoluteLifetimeMs: envInt('SESSION_ABSOLUTE_LIFETIME_HR', 8) * 60 * 60 * 1000,
    cookieName: envBool('SESSION_SECURE_COOKIE', false) ? '__Host-sid' : 'sid',
    secureCookie: envBool('SESSION_SECURE_COOKIE', false),
    sameSite: envStr('SESSION_SAMESITE', 'strict') as 'strict' | 'lax' | 'none',
  },

  // ── Password Policy ─────────────────────────────────────────
  password: {
    minLength: envInt('PASSWORD_MIN_LENGTH', 12),
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireDigit: true,
    requireSpecial: false,
    rejectCommon: true,
  },

  // ── Argon2 Hashing ──────────────────────────────────────────
  argon2: {
    memoryCost: 65536,    // 64 MB
    timeCost: 3,
    parallelism: 4,
    hashLength: 32,
  },

  // ── Login Protection ────────────────────────────────────────
  login: {
    maxAttempts: envInt('MAX_LOGIN_ATTEMPTS', 5),
    lockoutDurationMs: envInt('LOCKOUT_DURATION_MIN', 15) * 60 * 1000,
    rateLimitWindowMs: envInt('LOGIN_RATE_WINDOW_MIN', 15) * 60 * 1000,
    rateLimitMax: envInt('LOGIN_RATE_MAX', 10),
  },

  // ── MFA ─────────────────────────────────────────────────────
  mfa: {
    issuer: envStr('MFA_ISSUER', 'IQA Finance Portal'),
    otpWindow: 1,
    otpDigits: 6,
    otpPeriod: 30,
    maxAttempts: envInt('MFA_MAX_ATTEMPTS', 3),
    recoveryCodes: 8,
  },

  // ── Rate Limiting ───────────────────────────────────────────
  rateLimit: {
    globalWindowMs: envInt('RATE_LIMIT_WINDOW_MIN', 15) * 60 * 1000,
    globalMax: envInt('RATE_LIMIT_MAX', 200),
    authWindowMs: envInt('AUTH_RATE_WINDOW_MIN', 15) * 60 * 1000,
    authMax: envInt('AUTH_RATE_MAX', 10),
    sensitiveWindowMs: envInt('SENSITIVE_RATE_WINDOW_MS', 60) * 1000,
    sensitiveMax: envInt('SENSITIVE_RATE_MAX', 5),
  },

  // ── Password Reset ──────────────────────────────────────────
  passwordReset: {
    tokenExpiryMs: envInt('RESET_TOKEN_EXPIRY_MIN', 30) * 60 * 1000,
    rateLimitWindowMs: 60 * 60 * 1000,
    rateLimitMax: 3,
  },

  // ── Invitation ──────────────────────────────────────────────
  invitation: {
    tokenExpiryMs: envInt('INVITE_TOKEN_EXPIRY_HR', 72) * 60 * 60 * 1000,
  },

  // ── CORS ────────────────────────────────────────────────────
  cors: {
    allowedOrigins: envStr('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5174').split(','),
    credentials: true,
  },

  // ── General ─────────────────────────────────────────────────
  server: {
    port: envInt('PORT', envInt('SERVER_PORT', 3001)),
    isProduction: envStr('NODE_ENV', 'development') === 'production',
  },
} as const;

export function validateSecurityConfig(): void {
  const errors: string[] = [];

  if (SECURITY_CONFIG.server.isProduction) {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      errors.push('SESSION_SECRET must be at least 32 characters in production');
    }
    if (!SECURITY_CONFIG.session.secureCookie) {
      errors.push('SESSION_SECURE_COOKIE must be true in production (requires HTTPS)');
    }
  }

  if (!SECURITY_CONFIG.session.secret && !SECURITY_CONFIG.server.isProduction) {
    (SECURITY_CONFIG.session as { secret: string }).secret =
      'dev-only-insecure-secret-do-not-use-in-production-' + Date.now();
    console.warn('⚠️  Using auto-generated session secret. Set SESSION_SECRET for production.');
  }

  if (errors.length > 0) {
    console.error('❌ Security configuration errors:');
    errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }
}
