/**
 * Invoice Routes — CRUD with auth + RBAC + validation + audit.
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validation.js';
import { createInvoiceSchema, updateInvoiceSchema } from '../validators/schemas.js';
import { getDb } from '../db/schema.js';
import { generateId } from '../services/id.service.js';
import { logAuditEvent } from '../services/audit.service.js';

const router = Router();
const ALLOWED_SORT = ['invoice_number', 'status', 'invoice_date', 'due_date', 'total_amount', 'created_at'];

// GET /
router.get('/', requireAuth, requirePermission('INVOICE_VIEW'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 50));
    const search = (req.query.search as string) || '';
    const sortBy = ALLOWED_SORT.includes(req.query.sortBy as string) ? req.query.sortBy as string : 'created_at';
    const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const status = req.query.status as string | undefined;
    const projectId = req.query.projectId as string | undefined;

    const conds: string[] = [];
    const params: unknown[] = [];
    if (search) { conds.push('(invoice_number LIKE ? OR project_name LIKE ? OR client_name LIKE ?)'); const s = `%${search}%`; params.push(s, s, s); }
    if (status) { conds.push('status = ?'); params.push(status); }
    if (projectId) { conds.push('project_id = ?'); params.push(projectId); }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const total = (db.prepare(`SELECT COUNT(*) as c FROM invoices ${where}`).get(...params) as { c: number }).c;
    const invoices = db.prepare(`SELECT * FROM invoices ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`)
      .all(...params, limit, (page - 1) * limit);

    res.json({ invoices, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list invoices', code: 'INTERNAL_ERROR' });
  }
});

// GET /:id
router.get('/:id', requireAuth, requirePermission('INVOICE_VIEW'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const invoice = db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get(req.params.id);
    if (!invoice) { res.status(404).json({ error: 'Invoice not found', code: 'NOT_FOUND' }); return; }
    res.json({ invoice });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invoice', code: 'INTERNAL_ERROR' });
  }
});

// POST /
router.post('/', requireAuth, requirePermission('INVOICE_CREATE'), validateBody(createInvoiceSchema), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = randomUUID();
    const invoiceNumber = generateId('INV');
    const now = new Date().toISOString();
    const b = req.body;

    const project = db.prepare('SELECT name, client_name, billing_id FROM projects WHERE project_id = ?').get(b.projectId) as any;
    if (!project) { res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' }); return; }

    db.prepare(`
      INSERT INTO invoices (id, invoice_number, entity, project_id, project_name, client_name,
        billing_id, sow_id, sow_number, billing_period, invoice_date, due_date,
        amount, currency, tax_amount, total_amount, status, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, invoiceNumber, b.entity, b.projectId, project.name, project.client_name,
      project.billing_id || '', b.sowId || '', b.sowNumber || '', b.billingPeriod || '',
      b.invoiceDate, b.dueDate, b.amount, b.currency || 'USD',
      b.taxAmount || 0, b.totalAmount, b.status || 'Draft',
      req.session.userId, now,
    );

    logAuditEvent({
      eventType: 'INVOICE_CREATED', actorId: req.session.userId,
      targetEntity: 'Invoice', targetId: invoiceNumber,
      targetName: `Invoice for ${project.name}`,
      details: `Invoice ${invoiceNumber} created, amount: ${b.totalAmount} ${b.currency || 'USD'}`,
      ipAddress: req.ip, userAgent: req.get('User-Agent'), requestId: req.requestId,
    });

    const invoice = db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get(invoiceNumber);
    res.status(201).json({ invoice });
  } catch (err) {
    console.error('Invoice create error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to create invoice', code: 'INTERNAL_ERROR' });
  }
});

// PUT /:id
router.put('/:id', requireAuth, requirePermission('INVOICE_UPDATE'), validateBody(updateInvoiceSchema), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get(req.params.id) as any;
    if (!existing) { res.status(404).json({ error: 'Invoice not found', code: 'NOT_FOUND' }); return; }

    const b = req.body;
    const fieldMap: Record<string, string> = {
      entity: 'entity', billingPeriod: 'billing_period', invoiceDate: 'invoice_date',
      dueDate: 'due_date', amount: 'amount', currency: 'currency',
      taxAmount: 'tax_amount', totalAmount: 'total_amount', status: 'status',
      sowId: 'sow_id', sowNumber: 'sow_number',
    };

    const updates: string[] = [];
    const params: unknown[] = [];
    for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
      if (b[jsKey] !== undefined) { updates.push(`${dbCol} = ?`); params.push(b[jsKey]); }
    }
    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }
    params.push(req.params.id);
    db.prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE invoice_number = ?`).run(...params);

    logAuditEvent({
      eventType: 'INVOICE_UPDATED', actorId: req.session.userId,
      targetEntity: 'Invoice', targetId: req.params.id,
      details: `Updated: ${Object.keys(b).join(', ')}`,
      ipAddress: req.ip, userAgent: req.get('User-Agent'), requestId: req.requestId,
    });

    const invoice = db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get(req.params.id);
    res.json({ invoice });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update invoice', code: 'INTERNAL_ERROR' });
  }
});

// PATCH /:id/status (cancel)
router.patch('/:id/status', requireAuth, requirePermission('INVOICE_CANCEL'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT invoice_number, status, project_name FROM invoices WHERE invoice_number = ?').get(req.params.id) as any;
    if (!existing) { res.status(404).json({ error: 'Invoice not found', code: 'NOT_FOUND' }); return; }

    if (!['Draft', 'Sent'].includes(existing.status)) {
      res.status(400).json({ error: 'Only Draft or Sent invoices can be cancelled', code: 'INVALID_STATUS' });
      return;
    }

    db.prepare("UPDATE invoices SET status = 'Cancelled' WHERE invoice_number = ?").run(req.params.id);

    logAuditEvent({
      eventType: 'INVOICE_CANCELLED', actorId: req.session.userId,
      targetEntity: 'Invoice', targetId: req.params.id,
      previousValue: existing.status, newValue: 'Cancelled',
      details: `Invoice cancelled`,
      ipAddress: req.ip, userAgent: req.get('User-Agent'), requestId: req.requestId,
    });

    res.json({ message: 'Invoice cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel invoice', code: 'INTERNAL_ERROR' });
  }
});

export default router;
