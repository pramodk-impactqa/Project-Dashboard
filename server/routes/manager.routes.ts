/**
 * Manager Routes — CRUD with auth + RBAC + audit.
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validation.js';
import { createManagerSchema } from '../validators/schemas.js';
import { getDb } from '../db/schema.js';
import { logAuditEvent } from '../services/audit.service.js';

const router = Router();

router.get('/', requireAuth, requirePermission('MANAGER_VIEW'), (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const managers = db.prepare('SELECT * FROM managers ORDER BY type, name').all();
    res.json({ managers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list managers', code: 'INTERNAL_ERROR' });
  }
});

router.post('/', requireAuth, requirePermission('MANAGER_CREATE'), validateBody(createManagerSchema), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = randomUUID();
    const { name, type, email } = req.body;
    db.prepare('INSERT INTO managers (id, name, type, email) VALUES (?, ?, ?, ?)').run(id, name, type, email || '');

    logAuditEvent({
      eventType: 'MANAGER_CREATED', actorId: req.session.userId,
      targetEntity: 'Manager', targetId: id, targetName: name,
      details: `${type} "${name}" created`,
      ipAddress: req.ip, userAgent: req.get('User-Agent'), requestId: req.requestId,
    });

    const manager = db.prepare('SELECT * FROM managers WHERE id = ?').get(id);
    res.status(201).json({ manager });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create manager', code: 'INTERNAL_ERROR' });
  }
});

router.delete('/:id', requireAuth, requirePermission('MANAGER_DELETE'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT id, name, type FROM managers WHERE id = ?').get(req.params.id) as any;
    if (!existing) { res.status(404).json({ error: 'Manager not found', code: 'NOT_FOUND' }); return; }

    db.prepare('DELETE FROM managers WHERE id = ?').run(req.params.id);

    logAuditEvent({
      eventType: 'MANAGER_DELETED', actorId: req.session.userId,
      targetEntity: 'Manager', targetId: req.params.id, targetName: existing.name,
      details: `${existing.type} "${existing.name}" deleted`,
      ipAddress: req.ip, userAgent: req.get('User-Agent'), requestId: req.requestId,
    });

    res.json({ message: 'Manager deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete manager', code: 'INTERNAL_ERROR' });
  }
});

export default router;
