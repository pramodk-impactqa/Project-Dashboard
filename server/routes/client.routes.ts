/**
 * Client Routes — first-class clients; many projects per client.
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validation.js';
import { createClientSchema, updateClientSchema } from '../validators/schemas.js';
import { getDb } from '../db/schema.js';
import { generateId } from '../services/id.service.js';
import { logAuditEvent } from '../services/audit.service.js';

const router = Router();

router.get('/', requireAuth, requirePermission('CLIENT_VIEW'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const search = (req.query.search as string) || '';
    const status = req.query.status as string | undefined;
    const conds: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conds.push('(c.name LIKE ? OR c.client_id LIKE ? OR c.tax_id LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (status) { conds.push('c.status = ?'); params.push(status); }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const clients = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.client_id) as project_count
      FROM clients c ${where}
      ORDER BY c.created_at DESC
    `).all(...params);

    res.json({ clients, total: clients.length });
  } catch (err) {
    console.error('Client list error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to list clients', code: 'INTERNAL_ERROR' });
  }
});

router.get('/:id', requireAuth, requirePermission('CLIENT_VIEW'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const client = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.client_id) as project_count
      FROM clients c WHERE c.client_id = ?
    `).get(req.params.id);

    if (!client) { res.status(404).json({ error: 'Client not found', code: 'NOT_FOUND' }); return; }
    const projects = db.prepare('SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json({ client, projects });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch client', code: 'INTERNAL_ERROR' });
  }
});

router.post('/', requireAuth, requirePermission('CLIENT_CREATE'), validateBody(createClientSchema), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = randomUUID();
    const clientId = generateId('CLT');
    const now = new Date().toISOString();
    const b = req.body;

    db.prepare(`
      INSERT INTO clients (id, client_id, name, address, domain, entity, status, tax_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, clientId, b.name, b.address || '', b.domain, b.entity,
      b.status || 'Active', b.taxId || '', req.session.userId, now, now,
    );

    logAuditEvent({
      eventType: 'CLIENT_CREATED',
      actorId: req.session.userId,
      targetEntity: 'Client',
      targetId: clientId,
      targetName: b.name,
      details: `Client created: ${b.name}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId,
    });

    const client = db.prepare('SELECT * FROM clients WHERE client_id = ?').get(clientId);
    res.status(201).json({ client });
  } catch (err) {
    console.error('Client create error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to create client', code: 'INTERNAL_ERROR' });
  }
});

router.put('/:id', requireAuth, requirePermission('CLIENT_UPDATE'), validateBody(updateClientSchema), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM clients WHERE client_id = ?').get(req.params.id) as any;
    if (!existing) { res.status(404).json({ error: 'Client not found', code: 'NOT_FOUND' }); return; }

    const b = req.body;
    const fieldMap: Record<string, string> = {
      name: 'name', address: 'address', domain: 'domain', entity: 'entity',
      status: 'status', taxId: 'tax_id',
    };
    const updates: string[] = [];
    const params: unknown[] = [];

    for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
      if (b[jsKey] !== undefined) {
        updates.push(`${dbCol} = ?`);
        params.push(b[jsKey]);
      }
    }

    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }
    updates.push("updated_at = datetime('now')");
    params.push(req.params.id);
    db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE client_id = ?`).run(...params);

    if (b.name) {
      db.prepare('UPDATE projects SET client_name = ? WHERE client_id = ?').run(b.name, req.params.id);
      db.prepare('UPDATE sows SET client_name = ? WHERE project_id IN (SELECT project_id FROM projects WHERE client_id = ?)').run(b.name, req.params.id);
    }

    logAuditEvent({
      eventType: 'CLIENT_UPDATED',
      actorId: req.session.userId,
      targetEntity: 'Client',
      targetId: req.params.id,
      targetName: existing.name,
      details: `Updated fields: ${Object.keys(b).join(', ')}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId,
    });

    const client = db.prepare('SELECT * FROM clients WHERE client_id = ?').get(req.params.id);
    res.json({ client });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update client', code: 'INTERNAL_ERROR' });
  }
});

export default router;
