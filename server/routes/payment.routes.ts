/**
 * Payment Routes — CRUD with auth + RBAC + validation + audit.
 */
import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validation.js';
import { createPaymentSchema, updatePaymentSchema } from '../validators/schemas.js';
import { getDb } from '../db/schema.js';
import { logAuditEvent } from '../services/audit.service.js';

const router = Router();
const ALLOWED_SORT = ['payment_date', 'amount_received', 'status', 'project_name', 'created_at'];

// GET /
router.get('/', requireAuth, requirePermission('PAYMENT_VIEW'), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 50));
    const search = (req.query.search as string) || '';
    const sortBy = ALLOWED_SORT.includes(req.query.sortBy as string) ? req.query.sortBy as string : 'created_at';
    const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const projectId = req.query.projectId as string | undefined;

    const conds: string[] = [];
    const params: unknown[] = [];
    if (search) { conds.push('(project_name LIKE ? OR invoice_number LIKE ? OR bank LIKE ?)'); const s = `%${search}%`; params.push(s, s, s); }
    if (projectId) { conds.push('project_id = ?'); params.push(projectId); }

    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    const total = (db.prepare(`SELECT COUNT(*) as c FROM payments ${where}`).get(...params) as { c: number }).c;
    const payments = db.prepare(`SELECT * FROM payments ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`)
      .all(...params, limit, (page - 1) * limit);

    res.json({ payments, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list payments', code: 'INTERNAL_ERROR' });
  }
});

// POST /
router.post('/', requireAuth, requirePermission('PAYMENT_CREATE'), validateBody(createPaymentSchema), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();
    const b = req.body;

    const project = db.prepare('SELECT name FROM projects WHERE project_id = ?').get(b.projectId) as any;
    if (!project) { res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' }); return; }

    db.prepare(`
      INSERT INTO payments (id, invoice_id, invoice_number, project_id, project_name,
        amount_received, payment_date, currency, exchange_rate, bank,
        tds_withholding, short_payment, outstanding_balance, remarks, status, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, b.invoiceId || '', b.invoiceNumber || '', b.projectId, project.name,
      b.amountReceived, b.paymentDate, b.currency || 'USD', b.exchangeRate || 1,
      b.bank || '', b.tdsWithholding || 0, b.shortPayment || 0,
      b.outstandingBalance || 0, b.remarks || '', b.status || 'Pending',
      req.session.userId, now,
    );

    logAuditEvent({
      eventType: 'PAYMENT_CREATED', actorId: req.session.userId,
      targetEntity: 'Payment', targetId: id,
      targetName: `Payment for ${project.name}`,
      details: `Payment of ${b.amountReceived} ${b.currency || 'USD'} recorded`,
      ipAddress: req.ip, userAgent: req.get('User-Agent'), requestId: req.requestId,
    });

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    res.status(201).json({ payment });
  } catch (err) {
    console.error('Payment create error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to create payment', code: 'INTERNAL_ERROR' });
  }
});

// PUT /:id
router.put('/:id', requireAuth, requirePermission('PAYMENT_UPDATE'), validateBody(updatePaymentSchema), (req: Request, res: Response) => {
  try {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id) as any;
    if (!existing) { res.status(404).json({ error: 'Payment not found', code: 'NOT_FOUND' }); return; }

    const b = req.body;
    const fieldMap: Record<string, string> = {
      amountReceived: 'amount_received', paymentDate: 'payment_date', currency: 'currency',
      exchangeRate: 'exchange_rate', bank: 'bank', tdsWithholding: 'tds_withholding',
      shortPayment: 'short_payment', outstandingBalance: 'outstanding_balance',
      remarks: 'remarks', status: 'status',
    };

    const updates: string[] = [];
    const params: unknown[] = [];
    for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
      if (b[jsKey] !== undefined) { updates.push(`${dbCol} = ?`); params.push(b[jsKey]); }
    }
    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }
    params.push(req.params.id);
    db.prepare(`UPDATE payments SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    logAuditEvent({
      eventType: 'PAYMENT_UPDATED', actorId: req.session.userId,
      targetEntity: 'Payment', targetId: req.params.id,
      details: `Updated: ${Object.keys(b).join(', ')}`,
      ipAddress: req.ip, userAgent: req.get('User-Agent'), requestId: req.requestId,
    });

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    res.json({ payment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update payment', code: 'INTERNAL_ERROR' });
  }
});

export default router;
