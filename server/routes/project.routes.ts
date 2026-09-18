/**
 * Project Routes — CRUD with auth + RBAC + validation + audit.
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validation.js';
import { createProjectSchema, updateProjectSchema } from '../validators/schemas.js';
import { getDb } from '../db/schema.js';
import { generateId } from '../services/id.service.js';
import { logAuditEvent } from '../services/audit.service.js';

const router = Router();

const ALLOWED_SORT = ['name', 'project_id', 'status', 'domain', 'start_date', 'client_name', 'created_at'];

function findProject(id: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM projects WHERE project_id = ? OR id = ?').get(id, id) as any;
}

// GET /
router.get('/', requireAuth, requirePermission('PROJECT_VIEW'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 50));
    const search = (req.query.search as string) || '';
    const sortBy = ALLOWED_SORT.includes(req.query.sortBy as string) ? req.query.sortBy as string : 'created_at';
    const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const status = req.query.status as string | undefined;
    const domain = req.query.domain as string | undefined;

    const conds: string[] = [];
    const params: unknown[] = [];

    if (search) {
      conds.push('(p.name LIKE ? OR p.project_id LIKE ? OR p.client_name LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (status) { conds.push('p.status = ?'); params.push(status); }
    if (domain) { conds.push('p.domain = ?'); params.push(domain); }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const total = (db.prepare(`SELECT COUNT(*) as c FROM projects p ${where}`).get(...params) as { c: number }).c;

    const projects = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM sows WHERE project_id = p.project_id) as sow_count,
        (SELECT COUNT(*) FROM invoices WHERE project_id = p.project_id) as invoice_count,
        (SELECT COUNT(*) FROM payments WHERE project_id = p.project_id) as payment_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE project_id = p.project_id AND status != 'Cancelled') as total_invoiced,
        (SELECT COALESCE(SUM(amount_received), 0) FROM payments WHERE project_id = p.project_id) as total_paid
      FROM projects p ${where} ORDER BY p.${sortBy} ${sortOrder} LIMIT ? OFFSET ?
    `).all(...params, limit, (page - 1) * limit);

    res.json({ projects, total, page, limit });
  } catch (err) {
    console.error('Project list error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to list projects', code: 'INTERNAL_ERROR' });
  }
});

// GET /:id
router.get('/:id', requireAuth, requirePermission('PROJECT_VIEW'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const project = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM sows WHERE project_id = p.project_id) as sow_count,
        (SELECT COUNT(*) FROM invoices WHERE project_id = p.project_id) as invoice_count,
        (SELECT COUNT(*) FROM payments WHERE project_id = p.project_id) as payment_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE project_id = p.project_id AND status != 'Cancelled') as total_invoiced,
        (SELECT COALESCE(SUM(amount_received), 0) FROM payments WHERE project_id = p.project_id) as total_paid
      FROM projects p WHERE p.project_id = ? OR p.id = ?
    `).get(req.params.id, req.params.id);

    if (!project) { res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' }); return; }
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project', code: 'INTERNAL_ERROR' });
  }
});

// POST /
router.post('/', requireAuth, requirePermission('PROJECT_CREATE'), validateBody(createProjectSchema), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = randomUUID();
    const projectId = generateId('PRJ');
    const billingId = generateId('BIL');
    const now = new Date().toISOString();
    const b = req.body;

    let client = b.clientId
      ? db.prepare('SELECT * FROM clients WHERE client_id = ?').get(b.clientId) as any
      : null;
    if (!client && b.clientName) {
      client = db.prepare('SELECT * FROM clients WHERE name = ? COLLATE NOCASE').get(b.clientName) as any;
    }
    if (!client && b.clientName) {
      const nowClient = new Date().toISOString();
      const newClientId = generateId('CLT');
      db.prepare(`
        INSERT INTO clients (id, client_id, name, address, domain, entity, status, tax_id, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(), newClientId, b.clientName, b.clientAddress || '',
        b.domain || 'Other', b.entity || 'US', 'Active', b.clientTaxId || '',
        req.session.userId, nowClient, nowClient,
      );
      client = db.prepare('SELECT * FROM clients WHERE client_id = ?').get(newClientId) as any;
    }
    if (!client) { res.status(400).json({ error: 'Client not found. Add the client first.', code: 'CLIENT_NOT_FOUND' }); return; }

    const endDate = (b.status === 'Active') ? '' : (b.endDate || '');

    db.prepare(`
      INSERT INTO projects (id, project_id, name, description, domain, entity, currency, status,
        start_date, end_date, client_name, client_id, client_address, client_tax_id,
        project_manager, delivery_manager, department, billing_id, billing_model,
        billing_frequency, billing_contact, billing_address, payment_terms,
        msa_original_name, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, projectId, b.name, b.description || '', b.domain || client.domain, b.entity || client.entity, b.currency || 'USD',
      b.status || 'Active', b.startDate, endDate,
      client.name, client.client_id, client.address || '', client.tax_id || '',
      b.projectManager || '', b.deliveryManager || '', b.department || 'Engineering',
      billingId, b.billingModel || 'FTE', b.billingFrequency || 'Monthly',
      b.billingContact || '', b.billingAddress || '', b.paymentTerms || 'FTE',
      b.msaOriginalName || '',
      req.session.userId, now, now,
    );

    logAuditEvent({
      eventType: 'PROJECT_CREATED',
      actorId: req.session.userId,
      targetEntity: 'Project',
      targetId: projectId,
      targetName: b.name,
      details: `Project created: ${b.name}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId,
    });

    const project = db.prepare('SELECT * FROM projects WHERE project_id = ?').get(projectId);
    res.status(201).json({ project });
  } catch (err) {
    console.error('Project create error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to create project', code: 'INTERNAL_ERROR' });
  }
});

// PUT /:id
router.put('/:id', requireAuth, requirePermission('PROJECT_UPDATE'), validateBody(updateProjectSchema), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = findProject(req.params.id);
    if (!existing) { res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' }); return; }

    const b = req.body;
    const updates: string[] = [];
    const params: unknown[] = [];

    const fieldMap: Record<string, string> = {
      name: 'name', description: 'description', domain: 'domain', entity: 'entity',
      currency: 'currency', status: 'status', startDate: 'start_date', endDate: 'end_date',
      clientName: 'client_name', clientId: 'client_id', clientAddress: 'client_address', clientTaxId: 'client_tax_id',
      projectManager: 'project_manager', deliveryManager: 'delivery_manager', department: 'department',
      billingModel: 'billing_model', billingFrequency: 'billing_frequency',
      billingContact: 'billing_contact', billingAddress: 'billing_address', paymentTerms: 'payment_terms',
      msaOriginalName: 'msa_original_name',
    };

    if (b.clientId) {
      const client = db.prepare('SELECT * FROM clients WHERE client_id = ?').get(b.clientId) as any;
      if (client) {
        b.clientName = client.name;
        b.clientAddress = client.address;
        b.clientTaxId = client.tax_id;
      }
    }
    if (b.status === 'Active') {
      b.endDate = '';
    }

    for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
      if (b[jsKey] !== undefined) {
        updates.push(`${dbCol} = ?`);
        params.push(b[jsKey]);
      }
    }

    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }
    updates.push("updated_at = datetime('now')");
    params.push(existing.project_id);

    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE project_id = ?`).run(...params);

    logAuditEvent({
      eventType: 'PROJECT_UPDATED',
      actorId: req.session.userId,
      targetEntity: 'Project',
      targetId: req.params.id,
      targetName: existing.name,
      details: `Updated fields: ${Object.keys(b).join(', ')}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId,
    });

    const project = db.prepare('SELECT * FROM projects WHERE project_id = ?').get(existing.project_id);
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project', code: 'INTERNAL_ERROR' });
  }
});

// PATCH /:id/status
router.patch('/:id/status', requireAuth, requirePermission('PROJECT_STATUS_CHANGE'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status } = req.body;
    const valid = ['Active', 'On Hold', 'Inactive'];
    if (!status || !valid.includes(status)) {
      res.status(400).json({ error: `Status must be one of: ${valid.join(', ')}` });
      return;
    }

    const existing = db.prepare('SELECT project_id, name, status FROM projects WHERE project_id = ?').get(req.params.id) as any;
    if (!existing) { res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' }); return; }

    db.prepare("UPDATE projects SET status = ?, updated_at = datetime('now') WHERE project_id = ?").run(status, req.params.id);

    logAuditEvent({
      eventType: 'PROJECT_STATUS_CHANGED',
      actorId: req.session.userId,
      targetEntity: 'Project',
      targetId: req.params.id,
      targetName: existing.name,
      previousValue: existing.status,
      newValue: status,
      details: `Status changed from ${existing.status} to ${status}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId,
    });

    res.json({ message: `Project status changed to ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change status', code: 'INTERNAL_ERROR' });
  }
});

// DELETE /:id (soft delete)
router.delete('/:id', requireAuth, requirePermission('PROJECT_STATUS_CHANGE'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT project_id, name, status FROM projects WHERE project_id = ?').get(req.params.id) as any;
    if (!existing) { res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' }); return; }

    db.prepare("UPDATE projects SET status = 'Inactive', updated_at = datetime('now') WHERE project_id = ?").run(req.params.id);

    logAuditEvent({
      eventType: 'PROJECT_STATUS_CHANGED',
      actorId: req.session.userId,
      targetEntity: 'Project',
      targetId: req.params.id,
      targetName: existing.name,
      previousValue: existing.status,
      newValue: 'Inactive',
      details: 'Project soft-deleted (deactivated)',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId,
    });

    res.json({ message: 'Project deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project', code: 'INTERNAL_ERROR' });
  }
});

export default router;
