/**
 * Audit Routes — Read-only access to audit log and security events.
 */
import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { getDb } from '../db/schema.js';

const router = Router();

router.get('/', requireAuth, requirePermission('AUDIT_VIEW'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const eventType = req.query.eventType as string | undefined;
    const actorId = req.query.actorId as string | undefined;
    const targetEntity = req.query.targetEntity as string | undefined;
    const targetId = req.query.targetId as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const conds: string[] = [];
    const params: unknown[] = [];
    if (eventType) { conds.push('event_type = ?'); params.push(eventType); }
    if (actorId) { conds.push('actor_id = ?'); params.push(actorId); }
    if (targetEntity) { conds.push('target_entity = ?'); params.push(targetEntity); }
    if (targetId) { conds.push('target_id = ?'); params.push(targetId); }
    if (from) { conds.push('created_at >= ?'); params.push(from); }
    if (to) { conds.push('created_at <= ?'); params.push(to); }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const total = (db.prepare(`SELECT COUNT(*) as c FROM audit_log ${where}`).get(...params) as { c: number }).c;
    const entries = db.prepare(`SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, (page - 1) * limit);

    res.json({ entries, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list audit entries', code: 'INTERNAL_ERROR' });
  }
});

router.get('/security-events', requireAuth, requirePermission('AUDIT_VIEW'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));

    const total = (db.prepare('SELECT COUNT(*) as c FROM security_events').get() as { c: number }).c;
    const events = db.prepare('SELECT * FROM security_events ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(limit, (page - 1) * limit);

    res.json({ events, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list security events', code: 'INTERNAL_ERROR' });
  }
});

export default router;
