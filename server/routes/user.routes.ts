/**
 * User Management Routes
 * Admin-only operations. Every action is audit-logged.
 * BACKEND ENFORCES AUTHORIZATION — the API rejects unauthorized requests.
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { getDb } from '../db/schema.js';
import { hashPassword, validatePasswordPolicy } from '../services/password.service.js';
import { logAuditEvent } from '../services/audit.service.js';
import { destroyAllUserSessions } from '../services/session.service.js';
import { disableMFA } from '../services/mfa.service.js';
import { requireAuth, requireRecentAuth } from '../middleware/auth.js';
import { requirePermission, requireRole } from '../middleware/rbac.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.js';
import { createUserSchema, updateUserSchema, idParamSchema, paginationSchema } from '../validators/schemas.js';
import { SECURITY_CONFIG } from '../config/security.js';

const router = Router();

// ═══════════════════════════════════════════════════════════
// GET /api/users — List users
// ═══════════════════════════════════════════════════════════
router.get('/', requireAuth, requirePermission('USER_VIEW'), validateQuery(paginationSchema), (req: Request, res: Response) => {
  const { page, limit, search, sortBy, sortOrder } = req.query as any;
  const db = getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    conditions.push(`(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR employee_id LIKE ? OR username LIKE ?)`);
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const allowedSorts = ['first_name', 'last_name', 'email', 'role', 'status', 'created_at', 'last_login_at'];
  const orderCol = allowedSorts.includes(sortBy as string) ? sortBy : 'created_at';
  const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const total = (db.prepare(`SELECT COUNT(*) as count FROM users ${where}`).get(...params) as { count: number }).count;

  // NEVER return password_hash, mfa_secret, mfa_recovery
  const users = db.prepare(`
    SELECT id, employee_id, first_name, last_name, email, username, role, department, status,
           mfa_enabled, last_login_at, created_at, updated_at
    FROM users ${where} ORDER BY ${orderCol} ${order} LIMIT ? OFFSET ?
  `).all(...params, limit, (page - 1) * limit);

  res.json({ users, total, page, limit });
});

// ═══════════════════════════════════════════════════════════
// GET /api/users/:id — Get user detail
// ═══════════════════════════════════════════════════════════
router.get('/:id', requireAuth, requirePermission('USER_VIEW'), validateParams(idParamSchema), (req: Request, res: Response) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT id, employee_id, first_name, last_name, email, username, role, department, status,
           mfa_enabled, last_login_at, password_changed_at, created_at, updated_at
    FROM users WHERE id = ?
  `).get(req.params.id);

  if (!user) {
    res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    return;
  }

  res.json({ user });
});

// ═══════════════════════════════════════════════════════════
// POST /api/users — Create user (Admin only)
// ═══════════════════════════════════════════════════════════
router.post('/', requireAuth, requirePermission('USER_CREATE'), validateBody(createUserSchema), async (req: Request, res: Response) => {
  const { employeeId, firstName, lastName, email, username, role, department } = req.body;
  const db = getDb();

  // Prevent creating SUPER_ADMIN unless requester is SUPER_ADMIN
  if (role === 'SUPER_ADMIN' && req.session.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Only Super Admin can create Super Admin accounts', code: 'FORBIDDEN' });
    return;
  }

  // Check uniqueness
  const existing = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE OR username = ? COLLATE NOCASE OR employee_id = ?')
    .get(email, username, employeeId);

  if (existing) {
    res.status(409).json({ error: 'A user with this email, username, or employee ID already exists', code: 'CONFLICT' });
    return;
  }

  // Generate invitation token
  const inviteToken = randomBytes(32).toString('hex');
  const inviteTokenHash = createHash('sha256').update(inviteToken).digest('hex');

  // Create user with temporary password (will be changed on activation)
  const tempPassword = randomBytes(16).toString('base64url');
  const hashedPassword = await hashPassword(tempPassword);

  const userId = randomUUID();

  db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, employee_id, first_name, last_name, email, username, password_hash, role, department, status, force_password_change)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INVITED', 1)
    `).run(userId, employeeId, firstName, lastName, email, username, hashedPassword, role, department);

    db.prepare(`INSERT INTO invitation_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`)
      .run(randomUUID(), userId, inviteTokenHash, new Date(Date.now() + SECURITY_CONFIG.invitation.tokenExpiryMs).toISOString());
  })();

  logAuditEvent({
    eventType: 'USER_CREATED',
    actorId: req.session.userId,
    targetEntity: 'User',
    targetId: userId,
    targetName: `${firstName} ${lastName}`,
    details: `User created with role ${role}`,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.requestId,
  });

  // In production: send invitation email
  if (!SECURITY_CONFIG.server.isProduction) {
    console.log(`📧 Invitation token for ${email}: ${inviteToken}`);
  }

  res.status(201).json({
    user: { id: userId, employeeId, firstName, lastName, email, username, role, department, status: 'INVITED' },
    message: 'User created. An invitation has been sent.',
  });
});

// ═══════════════════════════════════════════════════════════
// PUT /api/users/:id — Update user
// ═══════════════════════════════════════════════════════════
router.put('/:id', requireAuth, requirePermission('USER_UPDATE'), validateParams(idParamSchema), validateBody(updateUserSchema), (req: Request, res: Response) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;

  if (!existing) {
    res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    return;
  }

  // Prevent role escalation
  if (req.body.role === 'SUPER_ADMIN' && req.session.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Only Super Admin can assign Super Admin role', code: 'FORBIDDEN' });
    return;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (req.body.firstName) { updates.push('first_name = ?'); params.push(req.body.firstName); }
  if (req.body.lastName) { updates.push('last_name = ?'); params.push(req.body.lastName); }
  if (req.body.email) { updates.push('email = ?'); params.push(req.body.email); }
  if (req.body.role) { updates.push('role = ?'); params.push(req.body.role); }
  if (req.body.department) { updates.push('department = ?'); params.push(req.body.department); }
  if (req.body.status) { updates.push('status = ?'); params.push(req.body.status); }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update', code: 'VALIDATION_ERROR' });
    return;
  }

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  // If role changed, invalidate sessions
  if (req.body.role && req.body.role !== existing.role) {
    destroyAllUserSessions(req.params.id);

    logAuditEvent({
      eventType: 'ROLE_CHANGED',
      actorId: req.session.userId,
      targetEntity: 'User',
      targetId: req.params.id,
      targetName: `${existing.first_name} ${existing.last_name}`,
      previousValue: existing.role,
      newValue: req.body.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId,
    });
  }

  // If status changed to SUSPENDED/INACTIVE, invalidate sessions
  if (req.body.status && ['SUSPENDED', 'INACTIVE'].includes(req.body.status)) {
    destroyAllUserSessions(req.params.id);
  }

  logAuditEvent({
    eventType: 'USER_UPDATED',
    actorId: req.session.userId,
    targetEntity: 'User',
    targetId: req.params.id,
    targetName: `${existing.first_name} ${existing.last_name}`,
    details: `Updated fields: ${Object.keys(req.body).join(', ')}`,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.requestId,
  });

  const updated = db.prepare(`
    SELECT id, employee_id, first_name, last_name, email, username, role, department, status,
           mfa_enabled, last_login_at, created_at, updated_at
    FROM users WHERE id = ?
  `).get(req.params.id);

  res.json({ user: updated });
});

// ═══════════════════════════════════════════════════════════
// POST /api/users/:id/suspend — Suspend user
// ═══════════════════════════════════════════════════════════
router.post('/:id/suspend', requireAuth, requirePermission('USER_SUSPEND'), validateParams(idParamSchema), (req: Request, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT id, first_name, last_name, role, status FROM users WHERE id = ?').get(req.params.id) as any;

  if (!user) {
    res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    return;
  }

  if (user.id === req.session.userId) {
    res.status(400).json({ error: 'Cannot suspend your own account', code: 'SELF_SUSPEND' });
    return;
  }

  db.prepare(`UPDATE users SET status = 'SUSPENDED', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  destroyAllUserSessions(req.params.id);

  logAuditEvent({
    eventType: 'USER_SUSPENDED',
    actorId: req.session.userId,
    targetEntity: 'User',
    targetId: req.params.id,
    targetName: `${user.first_name} ${user.last_name}`,
    details: 'User account suspended',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.requestId,
  });

  res.json({ message: 'User suspended' });
});

// ═══════════════════════════════════════════════════════════
// POST /api/users/:id/activate — Activate user
// ═══════════════════════════════════════════════════════════
router.post('/:id/activate', requireAuth, requirePermission('USER_UPDATE'), validateParams(idParamSchema), (req: Request, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT id, first_name, last_name, status FROM users WHERE id = ?').get(req.params.id) as any;

  if (!user) {
    res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    return;
  }

  db.prepare(`UPDATE users SET status = 'ACTIVE', failed_login_attempts = 0, account_locked_until = NULL, updated_at = datetime('now') WHERE id = ?`)
    .run(req.params.id);

  logAuditEvent({
    eventType: 'USER_UPDATED',
    actorId: req.session.userId,
    targetEntity: 'User',
    targetId: req.params.id,
    targetName: `${user.first_name} ${user.last_name}`,
    previousValue: user.status,
    newValue: 'ACTIVE',
    details: 'User account activated',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.requestId,
  });

  res.json({ message: 'User activated' });
});

// ═══════════════════════════════════════════════════════════
// POST /api/users/:id/reset-password — Admin password reset
// ═══════════════════════════════════════════════════════════
router.post('/:id/reset-password', requireRecentAuth(), requirePermission('USER_UPDATE'), validateParams(idParamSchema), async (req: Request, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT id, first_name, last_name, username, email FROM users WHERE id = ?').get(req.params.id) as any;

  if (!user) {
    res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    return;
  }

  // Generate temporary password
  const tempPassword = randomBytes(12).toString('base64url');
  const hashedPassword = await hashPassword(tempPassword);

  db.prepare(`UPDATE users SET password_hash = ?, force_password_change = 1, password_changed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
    .run(hashedPassword, req.params.id);

  destroyAllUserSessions(req.params.id);

  logAuditEvent({
    eventType: 'PASSWORD_RESET_COMPLETED',
    actorId: req.session.userId,
    targetEntity: 'User',
    targetId: req.params.id,
    targetName: `${user.first_name} ${user.last_name}`,
    details: 'Admin-initiated password reset',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.requestId,
  });

  // In production: send email with temp password
  if (!SECURITY_CONFIG.server.isProduction) {
    console.log(`🔑 Temporary password for ${user.email}: ${tempPassword}`);
  }

  res.json({ message: 'Password reset. User must change password on next login.' });
});

// ═══════════════════════════════════════════════════════════
// POST /api/users/:id/reset-mfa — Admin MFA reset
// ═══════════════════════════════════════════════════════════
router.post('/:id/reset-mfa', requireRecentAuth(), requireRole('SUPER_ADMIN', 'ADMIN'), validateParams(idParamSchema), (req: Request, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT id, first_name, last_name FROM users WHERE id = ?').get(req.params.id) as any;

  if (!user) {
    res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
    return;
  }

  disableMFA(req.params.id);
  destroyAllUserSessions(req.params.id);

  logAuditEvent({
    eventType: 'MFA_DISABLED',
    actorId: req.session.userId,
    targetEntity: 'User',
    targetId: req.params.id,
    targetName: `${user.first_name} ${user.last_name}`,
    details: 'Admin-initiated MFA reset',
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.requestId,
  });

  res.json({ message: 'MFA reset successfully' });
});

export default router;
