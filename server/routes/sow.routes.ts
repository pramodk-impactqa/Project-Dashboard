/**
 * SOW Routes — CRUD operations with auth + RBAC + validation + audit.
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validation.js';
import { createSOWSchema, updateSOWSchema } from '../validators/schemas.js';
import { getDb } from '../db/schema.js';
import { generateId } from '../services/id.service.js';
import { logAuditEvent } from '../services/audit.service.js';

const router = Router();

const ALLOWED_SORT = ['sow_number', 'title', 'status', 'start_date', 'end_date', 'contract_value', 'created_at'];

// GET /
router.get('/', requireAuth, requirePermission('SOW_VIEW'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const search = (req.query.search as string) || '';
    const sortBy = ALLOWED_SORT.includes(req.query.sortBy as string) ? req.query.sortBy as string : 'created_at';
    const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const status = req.query.status as string | undefined;
    const projectId = req.query.projectId as string | undefined;

    const conds: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conds.push('(sow_number LIKE ? OR title LIKE ? OR project_name LIKE ? OR client_name LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (status) { conds.push('status = ?'); params.push(status); }
    if (projectId) { conds.push('project_id = ?'); params.push(projectId); }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const total = (db.prepare(`SELECT COUNT(*) as c FROM sows ${where}`).get(...params) as { c: number }).c;
    const sows = db.prepare(`SELECT * FROM sows ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`)
      .all(...params, limit, (page - 1) * limit);

    res.json({ sows, total, page, limit });
  } catch (err) {
    console.error('SOW list error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to list SOWs', code: 'INTERNAL_ERROR' });
  }
});

// GET /:id
router.get('/:id', requireAuth, requirePermission('SOW_VIEW'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const sow = db.prepare('SELECT * FROM sows WHERE sow_number = ?').get(req.params.id);
    if (!sow) { res.status(404).json({ error: 'SOW not found', code: 'NOT_FOUND' }); return; }
    res.json({ sow });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch SOW', code: 'INTERNAL_ERROR' });
  }
});

// POST /
router.post('/', requireAuth, requirePermission('SOW_CREATE'), validateBody(createSOWSchema), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = randomUUID();
    const sowNumber = generateId('SOW');
    const now = new Date().toISOString();
    const b = req.body;

    const project = db.prepare('SELECT name, client_name, project_id FROM projects WHERE project_id = ? OR id = ?').get(b.projectId, b.projectId) as any;
    if (!project) { res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' }); return; }

    const sowType = b.sowType || b.contractType || 'T&M';
    const contractType = sowType === 'Fixed' ? 'Fixed Price' : sowType === 'FTE' ? 'T&M' : sowType;

    db.prepare(`
      INSERT INTO sows (id, sow_number, project_id, project_name, client_name, title, description, version,
        start_date, end_date, renewal_date, contract_type, contract_value, monthly_billing, billing_frequency,
        currency, status, sow_type, basis, remarks, project_manager, delivery_manager, po_number,
        sow_original_name, po_original_name, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, sowNumber, project.project_id, project.name, project.client_name,
      b.title, b.description || '', b.version || '1.0',
      b.startDate, b.endDate, b.renewalDate || '',
      contractType, b.contractValue, b.monthlyBilling || 0,
      b.billingFrequency || b.basis || 'Monthly', b.currency || 'USD', b.status || 'Draft',
      sowType, b.basis || 'Monthly', b.remarks || '',
      b.projectManager || '', b.deliveryManager || '', b.poNumber || '',
      b.sowOriginalName || '', b.poOriginalName || '',
      req.session.userId, now, now,
    );

    logAuditEvent({
      eventType: 'SOW_CREATED',
      actorId: req.session.userId,
      targetEntity: 'SOW',
      targetId: sowNumber,
      targetName: b.title,
      details: `SOW created for project ${b.projectId}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId,
    });

    const sow = db.prepare('SELECT * FROM sows WHERE sow_number = ?').get(sowNumber);
    res.status(201).json({ sow });
  } catch (err) {
    console.error('SOW create error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to create SOW', code: 'INTERNAL_ERROR' });
  }
});

// PUT /:id
router.put('/:id', requireAuth, requirePermission('SOW_UPDATE'), validateBody(updateSOWSchema), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM sows WHERE sow_number = ?').get(req.params.id) as any;
    if (!existing) { res.status(404).json({ error: 'SOW not found', code: 'NOT_FOUND' }); return; }

    const b = req.body;
    const updates: string[] = [];
    const params: unknown[] = [];

    if (b.title !== undefined) { updates.push('title = ?'); params.push(b.title); }
    if (b.description !== undefined) { updates.push('description = ?'); params.push(b.description); }
    if (b.version !== undefined) { updates.push('version = ?'); params.push(b.version); }
    if (b.startDate !== undefined) { updates.push('start_date = ?'); params.push(b.startDate); }
    if (b.endDate !== undefined) { updates.push('end_date = ?'); params.push(b.endDate); }
    if (b.renewalDate !== undefined) { updates.push('renewal_date = ?'); params.push(b.renewalDate); }
    if (b.contractType !== undefined) { updates.push('contract_type = ?'); params.push(b.contractType); }
    if (b.sowType !== undefined) { updates.push('sow_type = ?'); params.push(b.sowType); }
    if (b.contractValue !== undefined) { updates.push('contract_value = ?'); params.push(b.contractValue); }
    if (b.monthlyBilling !== undefined) { updates.push('monthly_billing = ?'); params.push(b.monthlyBilling); }
    if (b.billingFrequency !== undefined) { updates.push('billing_frequency = ?'); params.push(b.billingFrequency); }
    if (b.basis !== undefined) { updates.push('basis = ?'); params.push(b.basis); }
    if (b.currency !== undefined) { updates.push('currency = ?'); params.push(b.currency); }
    if (b.status !== undefined) { updates.push('status = ?'); params.push(b.status); }
    if (b.remarks !== undefined) { updates.push('remarks = ?'); params.push(b.remarks); }
    if (b.projectManager !== undefined) { updates.push('project_manager = ?'); params.push(b.projectManager); }
    if (b.deliveryManager !== undefined) { updates.push('delivery_manager = ?'); params.push(b.deliveryManager); }
    if (b.poNumber !== undefined) { updates.push('po_number = ?'); params.push(b.poNumber); }
    if (b.sowOriginalName !== undefined) { updates.push('sow_original_name = ?'); params.push(b.sowOriginalName); }
    if (b.poOriginalName !== undefined) { updates.push('po_original_name = ?'); params.push(b.poOriginalName); }

    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }
    updates.push("updated_at = datetime('now')");
    params.push(req.params.id);

    db.prepare(`UPDATE sows SET ${updates.join(', ')} WHERE sow_number = ?`).run(...params);

    logAuditEvent({
      eventType: 'SOW_UPDATED',
      actorId: req.session.userId,
      targetEntity: 'SOW',
      targetId: req.params.id,
      targetName: existing.title,
      details: `Updated fields: ${Object.keys(b).join(', ')}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId,
    });

    const sow = db.prepare('SELECT * FROM sows WHERE sow_number = ?').get(req.params.id);
    res.json({ sow });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update SOW', code: 'INTERNAL_ERROR' });
  }
});

// PATCH /:id/status
router.patch('/:id/status', requireAuth, requirePermission('SOW_UPDATE'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status } = req.body;
    if (!status) { res.status(400).json({ error: 'Status is required' }); return; }

    const existing = db.prepare('SELECT sow_number, status as old_status, title FROM sows WHERE sow_number = ?').get(req.params.id) as any;
    if (!existing) { res.status(404).json({ error: 'SOW not found', code: 'NOT_FOUND' }); return; }

    db.prepare("UPDATE sows SET status = ?, updated_at = datetime('now') WHERE sow_number = ?").run(status, req.params.id);

    logAuditEvent({
      eventType: status === 'Cancelled' ? 'SOW_CANCELLED' : 'SOW_UPDATED',
      actorId: req.session.userId,
      targetEntity: 'SOW',
      targetId: req.params.id,
      targetName: existing.title,
      previousValue: existing.old_status,
      newValue: status,
      details: `Status changed from ${existing.old_status} to ${status}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId,
    });

    res.json({ message: `SOW status changed to ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change SOW status', code: 'INTERNAL_ERROR' });
  }
});

export default router;
