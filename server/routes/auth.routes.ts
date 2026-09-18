/**
 * Authentication Routes
 * Handles login, logout, MFA, password reset, session info.
 * Rate-limited. Generic error messages to prevent user enumeration.
 */
import { Router, type Request, type Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import { getDb } from '../db/schema.js';
import { verifyPassword, hashPassword, validatePasswordPolicy, needsRehash } from '../services/password.service.js';
import { logAuditEvent, logSecurityEvent } from '../services/audit.service.js';
import { getPermissionsForRole } from '../services/rbac.service.js';
import { setupMFA, verifyMFAToken, verifyRecoveryCode, enableMFA, disableMFA } from '../services/mfa.service.js';
import { destroyAllUserSessions } from '../services/session.service.js';
import { requireAuth, requireRecentAuth } from '../middleware/auth.js';
import { authRateLimiter, sensitiveRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validation.js';
import { loginSchema, mfaVerifySchema, mfaRecoverySchema, passwordResetRequestSchema, passwordResetSchema, changePasswordSchema } from '../validators/schemas.js';
import { SECURITY_CONFIG } from '../config/security.js';

const router = Router();

// ═══════════════════════════════════════════════════════════
// POST /api/auth/login
// ═══════════════════════════════════════════════════════════
router.post('/login', authRateLimiter, validateBody(loginSchema), async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const ip = req.ip || 'unknown';
  const ua = req.get('User-Agent') || 'unknown';

  try {
    const db = getDb();

    // Generic error to prevent user enumeration
    const genericError = 'Invalid credentials. Please check your username and password.';

    // Find user by username or email (case-insensitive)
    const user = db.prepare(`
      SELECT id, employee_id, first_name, last_name, email, username, password_hash,
             role, department, status, mfa_enabled, failed_login_attempts,
             account_locked_until, force_password_change
      FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
    `).get(username, username) as any;

    if (!user) {
      // Record failed attempt (don't reveal user doesn't exist)
      db.prepare('INSERT INTO login_attempts (id, identifier, ip_address, user_agent, success) VALUES (?, ?, ?, ?, 0)')
        .run(randomBytes(16).toString('hex'), username, ip, ua);

      logAuditEvent({
        eventType: 'LOGIN_FAILURE',
        details: 'Invalid credentials (user not found)',
        ipAddress: ip,
        userAgent: ua,
        success: false,
      });

      res.status(401).json({ error: genericError, code: 'AUTH_FAILED' });
      return;
    }

    // Check account status
    if (user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
      logAuditEvent({
        eventType: 'LOGIN_FAILURE',
        actorId: user.id,
        actorUsername: user.username,
        details: `Account status: ${user.status}`,
        ipAddress: ip,
        userAgent: ua,
        success: false,
      });
      res.status(401).json({ error: genericError, code: 'AUTH_FAILED' });
      return;
    }

    // Check account lockout
    if (user.status === 'LOCKED' && user.account_locked_until) {
      const lockUntil = new Date(user.account_locked_until).getTime();
      if (Date.now() < lockUntil) {
        res.status(401).json({
          error: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.',
          code: 'ACCOUNT_LOCKED',
        });
        return;
      }
      // Lock expired — clear it
      db.prepare(`UPDATE users SET status = 'ACTIVE', failed_login_attempts = 0, account_locked_until = NULL, updated_at = datetime('now') WHERE id = ?`)
        .run(user.id);
    }

    if (user.status === 'INVITED') {
      res.status(401).json({
        error: 'Please complete your account setup before signing in.',
        code: 'ACCOUNT_INVITED',
      });
      return;
    }

    // Verify password
    const passwordValid = await verifyPassword(user.password_hash, password);

    if (!passwordValid) {
      const attempts = user.failed_login_attempts + 1;

      if (attempts >= SECURITY_CONFIG.login.maxAttempts) {
        const lockUntil = new Date(Date.now() + SECURITY_CONFIG.login.lockoutDurationMs).toISOString();
        db.prepare(`UPDATE users SET status = 'LOCKED', failed_login_attempts = ?, account_locked_until = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(attempts, lockUntil, user.id);

        logAuditEvent({
          eventType: 'ACCOUNT_LOCKED',
          actorId: user.id,
          actorUsername: user.username,
          details: `Account locked after ${attempts} failed attempts`,
          ipAddress: ip,
          userAgent: ua,
        });

        logSecurityEvent({
          eventType: 'ACCOUNT_LOCKOUT',
          severity: 'HIGH',
          actorId: user.id,
          details: `Account locked after ${attempts} failed login attempts`,
          ipAddress: ip,
          userAgent: ua,
        });

        res.status(401).json({
          error: 'Account is temporarily locked due to multiple failed login attempts. Please try again later.',
          code: 'ACCOUNT_LOCKED',
        });
        return;
      }

      db.prepare(`UPDATE users SET failed_login_attempts = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(attempts, user.id);

      db.prepare('INSERT INTO login_attempts (id, identifier, ip_address, user_agent, success) VALUES (?, ?, ?, ?, 0)')
        .run(randomBytes(16).toString('hex'), username, ip, ua);

      logAuditEvent({
        eventType: 'LOGIN_FAILURE',
        actorId: user.id,
        actorUsername: user.username,
        details: `Invalid password (attempt ${attempts}/${SECURITY_CONFIG.login.maxAttempts})`,
        ipAddress: ip,
        userAgent: ua,
        success: false,
      });

      res.status(401).json({ error: genericError, code: 'AUTH_FAILED' });
      return;
    }

    // Password valid — check if MFA is required
    if (user.mfa_enabled) {
      // Regenerate session ID for session fixation protection
      req.session.regenerate((err) => {
        if (err) {
          res.status(500).json({ error: 'Authentication error', code: 'INTERNAL_ERROR' });
          return;
        }
        req.session.userId = user.id;
        req.session.mfaPending = true;
        req.session.mfaVerified = false;
        req.session.createdAt = Date.now();
        req.session.lastActivity = Date.now();
        req.session.ipAddress = ip;
        req.session.userAgent = ua;

        res.json({
          requireMFA: true,
          message: 'Please enter your MFA code',
        });
      });
      return;
    }

    // No MFA — complete login
    completeLogin(req, res, user, ip, ua);

    // Rehash password if needed (transparent upgrade)
    if (await needsRehash(user.password_hash)) {
      const newHash = await hashPassword(password);
      db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(newHash, user.id);
    }

  } catch (err) {
    console.error('Login error:', (err as Error).message);
    res.status(500).json({ error: 'Authentication error. Please try again.', code: 'INTERNAL_ERROR' });
  }
});

function completeLogin(req: Request, res: Response, user: any, ip: string, ua: string): void {
  const db = getDb();
  const permissions = getPermissionsForRole(user.role);

  // Reset failed attempts
  db.prepare(`UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL, last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
    .run(user.id);

  // Record successful login attempt
  db.prepare('INSERT INTO login_attempts (id, identifier, ip_address, user_agent, success) VALUES (?, ?, ?, ?, 1)')
    .run(randomBytes(16).toString('hex'), user.username, ip, ua);

  // Regenerate session ID (session fixation protection)
  req.session.regenerate((err) => {
    if (err) {
      res.status(500).json({ error: 'Authentication error', code: 'INTERNAL_ERROR' });
      return;
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.permissions = permissions;
    req.session.mfaVerified = !user.mfa_enabled;
    req.session.mfaPending = false;
    req.session.createdAt = Date.now();
    req.session.lastActivity = Date.now();
    req.session.ipAddress = ip;
    req.session.userAgent = ua;

    logAuditEvent({
      eventType: 'LOGIN_SUCCESS',
      actorId: user.id,
      actorUsername: user.username,
      details: 'User logged in successfully',
      ipAddress: ip,
      userAgent: ua,
    });

    // Return safe user data (NEVER password_hash, mfa_secret, etc.)
    res.json({
      user: {
        id: user.id,
        employeeId: user.employee_id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        username: user.username,
        role: user.role,
        department: user.department,
        mfaEnabled: !!user.mfa_enabled,
        permissions,
        forcePasswordChange: !!user.force_password_change,
      },
      requireMFA: false,
    });
  });
}

// ═══════════════════════════════════════════════════════════
// POST /api/auth/mfa/verify
// ═══════════════════════════════════════════════════════════
router.post('/mfa/verify', sensitiveRateLimiter, validateBody(mfaVerifySchema), (req: Request, res: Response) => {
  if (!req.session?.userId || !req.session.mfaPending) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return;
  }

  const { token } = req.body;
  const userId = req.session.userId;

  const valid = verifyMFAToken(userId, token);

  if (!valid) {
    logSecurityEvent({
      eventType: 'MFA_FAILED',
      severity: 'MEDIUM',
      actorId: userId,
      details: 'Invalid MFA token',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(401).json({ error: 'Invalid verification code. Please try again.', code: 'MFA_INVALID' });
    return;
  }

  const db = getDb();
  const user = db.prepare(`
    SELECT id, employee_id, first_name, last_name, email, username, role, department, mfa_enabled, force_password_change
    FROM users WHERE id = ?
  `).get(userId) as any;

  if (!user) {
    res.status(401).json({ error: 'Authentication error', code: 'AUTH_FAILED' });
    return;
  }

  const permissions = getPermissionsForRole(user.role);

  // Upgrade session after MFA
  req.session.role = user.role;
  req.session.permissions = permissions;
  req.session.mfaVerified = true;
  req.session.mfaPending = false;

  // Update last login
  db.prepare(`UPDATE users SET failed_login_attempts = 0, last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
    .run(user.id);

  logAuditEvent({
    eventType: 'LOGIN_SUCCESS',
    actorId: user.id,
    actorUsername: user.username,
    details: 'User logged in with MFA',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.json({
    user: {
      id: user.id,
      employeeId: user.employee_id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      username: user.username,
      role: user.role,
      department: user.department,
      mfaEnabled: !!user.mfa_enabled,
      permissions,
      forcePasswordChange: !!user.force_password_change,
    },
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/auth/mfa/recovery
// ═══════════════════════════════════════════════════════════
router.post('/mfa/recovery', sensitiveRateLimiter, validateBody(mfaRecoverySchema), (req: Request, res: Response) => {
  if (!req.session?.userId || !req.session.mfaPending) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return;
  }

  const { code } = req.body;
  const valid = verifyRecoveryCode(req.session.userId, code);

  if (!valid) {
    res.status(401).json({ error: 'Invalid recovery code', code: 'RECOVERY_INVALID' });
    return;
  }

  const db = getDb();
  const user = db.prepare(`
    SELECT id, employee_id, first_name, last_name, email, username, role, department, mfa_enabled, force_password_change
    FROM users WHERE id = ?
  `).get(req.session.userId) as any;

  const permissions = getPermissionsForRole(user.role);

  req.session.role = user.role;
  req.session.permissions = permissions;
  req.session.mfaVerified = true;
  req.session.mfaPending = false;

  logAuditEvent({
    eventType: 'LOGIN_SUCCESS',
    actorId: user.id,
    actorUsername: user.username,
    details: 'User logged in with MFA recovery code',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.json({
    user: {
      id: user.id,
      employeeId: user.employee_id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      username: user.username,
      role: user.role,
      department: user.department,
      mfaEnabled: !!user.mfa_enabled,
      permissions,
      forcePasswordChange: !!user.force_password_change,
    },
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/auth/logout
// ═══════════════════════════════════════════════════════════
router.post('/logout', (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const username = req.session?.userId;

  logAuditEvent({
    eventType: 'LOGOUT',
    actorId: userId,
    details: 'User logged out',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });

  req.session.destroy((err) => {
    if (err) {
      console.error('Logout session destroy error:', err);
    }
    res.clearCookie(SECURITY_CONFIG.session.cookieName, { path: '/' });
    res.json({ message: 'Logged out successfully' });
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/auth/logout-all
// ═══════════════════════════════════════════════════════════
router.post('/logout-all', requireAuth, (req: Request, res: Response) => {
  const userId = req.session.userId!;

  destroyAllUserSessions(userId);

  logAuditEvent({
    eventType: 'LOGOUT',
    actorId: userId,
    details: 'User logged out from all sessions',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.clearCookie(SECURITY_CONFIG.session.cookieName, { path: '/' });
  res.json({ message: 'Logged out from all sessions' });
});

// ═══════════════════════════════════════════════════════════
// GET /api/auth/session
// ═══════════════════════════════════════════════════════════
router.get('/session', requireAuth, (req: Request, res: Response) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT id, employee_id, first_name, last_name, email, username, role, department, mfa_enabled, force_password_change
    FROM users WHERE id = ?
  `).get(req.session.userId!) as any;

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: 'Session invalid', code: 'AUTH_REQUIRED' });
    return;
  }

  res.json({
    user: {
      id: user.id,
      employeeId: user.employee_id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      username: user.username,
      role: user.role,
      department: user.department,
      mfaEnabled: !!user.mfa_enabled,
      permissions: req.session.permissions,
      forcePasswordChange: !!user.force_password_change,
    },
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/auth/change-password
// ═══════════════════════════════════════════════════════════
router.post('/change-password', requireAuth, sensitiveRateLimiter, validateBody(changePasswordSchema), async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.session.userId!;

  const db = getDb();
  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE id = ?').get(userId) as any;

  if (!user) {
    res.status(401).json({ error: 'Authentication error', code: 'AUTH_FAILED' });
    return;
  }

  const currentValid = await verifyPassword(user.password_hash, currentPassword);
  if (!currentValid) {
    res.status(401).json({ error: 'Current password is incorrect', code: 'INVALID_PASSWORD' });
    return;
  }

  const policy = validatePasswordPolicy(newPassword);
  if (!policy.valid) {
    res.status(400).json({ error: 'Password does not meet policy requirements', code: 'PASSWORD_POLICY', details: policy.errors });
    return;
  }

  const newHash = await hashPassword(newPassword);
  db.prepare(`UPDATE users SET password_hash = ?, password_changed_at = datetime('now'), force_password_change = 0, updated_at = datetime('now') WHERE id = ?`)
    .run(newHash, userId);

  // Invalidate all other sessions
  destroyAllUserSessions(userId);

  logAuditEvent({
    eventType: 'PASSWORD_CHANGED',
    actorId: userId,
    actorUsername: user.username,
    details: 'User changed their password',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Regenerate current session
  req.session.regenerate((err) => {
    if (err) {
      res.status(500).json({ error: 'Session error', code: 'INTERNAL_ERROR' });
      return;
    }
    req.session.userId = userId;
    req.session.role = user.role;
    req.session.permissions = getPermissionsForRole(user.role);
    req.session.mfaVerified = true;
    req.session.mfaPending = false;
    req.session.createdAt = Date.now();
    req.session.lastActivity = Date.now();

    res.json({ message: 'Password changed successfully' });
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/auth/forgot-password
// ═══════════════════════════════════════════════════════════
router.post('/forgot-password', sensitiveRateLimiter, validateBody(passwordResetRequestSchema), async (req: Request, res: Response) => {
  const { email } = req.body;

  // ALWAYS return generic response (user enumeration protection)
  const genericResponse = { message: 'If the account exists, password reset instructions have been sent.' };

  try {
    const db = getDb();
    const user = db.prepare('SELECT id, username, email FROM users WHERE email = ? COLLATE NOCASE').get(email) as any;

    if (!user) {
      // Do NOT reveal account doesn't exist
      res.json(genericResponse);
      return;
    }

    // Generate secure random token
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + SECURITY_CONFIG.passwordReset.tokenExpiryMs).toISOString();

    // Invalidate existing tokens
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);

    // Store hashed token (never store plaintext)
    db.prepare('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)')
      .run(randomBytes(16).toString('hex'), user.id, tokenHash, expiresAt);

    logAuditEvent({
      eventType: 'PASSWORD_RESET_REQUESTED',
      actorId: user.id,
      actorUsername: user.username,
      details: 'Password reset requested',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // In production: send email with reset link containing `token`
    // For dev: log the token (NOT in production!)
    if (!SECURITY_CONFIG.server.isProduction) {
      console.log(`🔑 Password reset token for ${user.email}: ${token}`);
    }

    res.json(genericResponse);
  } catch (err) {
    console.error('Password reset error:', (err as Error).message);
    res.json(genericResponse);
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/auth/reset-password
// ═══════════════════════════════════════════════════════════
router.post('/reset-password', sensitiveRateLimiter, validateBody(passwordResetSchema), async (req: Request, res: Response) => {
  const { token, password } = req.body;

  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const db = getDb();

    const resetToken = db.prepare(`
      SELECT prt.id, prt.user_id, prt.expires_at, prt.used, u.username
      FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE prt.token_hash = ? AND prt.used = 0
    `).get(tokenHash) as any;

    if (!resetToken) {
      res.status(400).json({ error: 'Invalid or expired reset token', code: 'INVALID_TOKEN' });
      return;
    }

    if (new Date(resetToken.expires_at).getTime() < Date.now()) {
      db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);
      res.status(400).json({ error: 'Reset token has expired', code: 'TOKEN_EXPIRED' });
      return;
    }

    const policy = validatePasswordPolicy(password);
    if (!policy.valid) {
      res.status(400).json({ error: 'Password does not meet policy requirements', code: 'PASSWORD_POLICY', details: policy.errors });
      return;
    }

    const newHash = await hashPassword(password);

    // Atomic: update password + mark token used + invalidate sessions
    db.transaction(() => {
      db.prepare(`UPDATE users SET password_hash = ?, password_changed_at = datetime('now'), force_password_change = 0, updated_at = datetime('now') WHERE id = ?`)
        .run(newHash, resetToken.user_id);
      db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);
    })();

    destroyAllUserSessions(resetToken.user_id);

    logAuditEvent({
      eventType: 'PASSWORD_RESET_COMPLETED',
      actorId: resetToken.user_id,
      actorUsername: resetToken.username,
      details: 'Password reset completed',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ message: 'Password has been reset successfully. Please sign in.' });
  } catch (err) {
    console.error('Password reset error:', (err as Error).message);
    res.status(500).json({ error: 'An error occurred. Please try again.', code: 'INTERNAL_ERROR' });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/auth/activate — Invitation activation (set password)
// ═══════════════════════════════════════════════════════════
router.post('/activate', sensitiveRateLimiter, async (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
    res.status(400).json({ error: 'Token and password are required', code: 'VALIDATION_ERROR' });
    return;
  }

  try {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const db = getDb();

    const invite = db.prepare(`
      SELECT it.id, it.user_id, it.expires_at, it.used, u.username, u.first_name, u.last_name, u.status
      FROM invitation_tokens it
      JOIN users u ON u.id = it.user_id
      WHERE it.token_hash = ? AND it.used = 0
    `).get(tokenHash) as any;

    if (!invite) {
      res.status(400).json({ error: 'Invalid or expired invitation token', code: 'INVALID_TOKEN' });
      return;
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      db.prepare('UPDATE invitation_tokens SET used = 1 WHERE id = ?').run(invite.id);
      res.status(400).json({ error: 'Invitation has expired. Please contact your administrator.', code: 'TOKEN_EXPIRED' });
      return;
    }

    if (invite.status !== 'INVITED') {
      res.status(400).json({ error: 'Account has already been activated', code: 'ALREADY_ACTIVATED' });
      return;
    }

    const policy = validatePasswordPolicy(password);
    if (!policy.valid) {
      res.status(400).json({ error: 'Password does not meet policy requirements', code: 'PASSWORD_POLICY', details: policy.errors });
      return;
    }

    const newHash = await hashPassword(password);

    db.transaction(() => {
      db.prepare(`UPDATE users SET password_hash = ?, status = 'ACTIVE', force_password_change = 0, password_changed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
        .run(newHash, invite.user_id);
      db.prepare('UPDATE invitation_tokens SET used = 1 WHERE id = ?').run(invite.id);
    })();

    logAuditEvent({
      eventType: 'USER_UPDATED',
      actorId: invite.user_id,
      actorUsername: invite.username,
      details: 'Account activated via invitation',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ message: 'Account activated successfully. You can now sign in.' });
  } catch (err) {
    console.error('Activation error:', (err as Error).message);
    res.status(500).json({ error: 'An error occurred. Please try again.', code: 'INTERNAL_ERROR' });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/auth/mfa/setup
// ═══════════════════════════════════════════════════════════
router.post('/mfa/setup', requireAuth, sensitiveRateLimiter, async (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const db = getDb();
  const user = db.prepare('SELECT username, mfa_enabled FROM users WHERE id = ?').get(userId) as any;

  if (user.mfa_enabled) {
    res.status(400).json({ error: 'MFA is already enabled', code: 'MFA_ALREADY_ENABLED' });
    return;
  }

  const result = await setupMFA(userId, user.username);
  res.json({
    qrCode: result.qrCodeDataUrl,
    secret: result.secret,
    recoveryCodes: result.recoveryCodes,
  });
});

// ═══════════════════════════════════════════════════════════
// POST /api/auth/mfa/enable
// ═══════════════════════════════════════════════════════════
router.post('/mfa/enable', requireAuth, sensitiveRateLimiter, validateBody(mfaVerifySchema), (req: Request, res: Response) => {
  const userId = req.session.userId!;
  const { token } = req.body;

  const valid = verifyMFAToken(userId, token);
  if (!valid) {
    res.status(400).json({ error: 'Invalid verification code. MFA not enabled.', code: 'MFA_INVALID' });
    return;
  }

  enableMFA(userId);

  logAuditEvent({
    eventType: 'MFA_ENABLED',
    actorId: userId,
    details: 'MFA enabled',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.json({ message: 'MFA enabled successfully' });
});

// ═══════════════════════════════════════════════════════════
// POST /api/auth/mfa/disable
// ═══════════════════════════════════════════════════════════
router.post('/mfa/disable', requireRecentAuth(5 * 60 * 1000), sensitiveRateLimiter, async (req: Request, res: Response) => {
  const userId = req.session.userId!;

  disableMFA(userId);

  logAuditEvent({
    eventType: 'MFA_DISABLED',
    actorId: userId,
    details: 'MFA disabled',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.json({ message: 'MFA disabled' });
});

export default router;
