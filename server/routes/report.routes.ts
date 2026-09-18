/**
 * Report Routes — Financial reporting with auth + RBAC.
 */
import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { getDb } from '../db/schema.js';

const router = Router();

router.get('/summary', requireAuth, requirePermission('REPORT_VIEW'), (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const totalProjects = (db.prepare("SELECT COUNT(*) as c FROM projects").get() as { c: number }).c;
    const activeProjects = (db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'Active'").get() as { c: number }).c;
    const totalSOWs = (db.prepare("SELECT COUNT(*) as c FROM sows").get() as { c: number }).c;
    const totalInvoiced = (db.prepare("SELECT COALESCE(SUM(total_amount), 0) as s FROM invoices WHERE status != 'Cancelled'").get() as { s: number }).s;
    const totalPaid = (db.prepare("SELECT COALESCE(SUM(amount_received), 0) as s FROM payments").get() as { s: number }).s;
    const totalOutstanding = totalInvoiced - totalPaid;
    const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced * 100) : 0;

    res.json({ totalProjects, activeProjects, totalSOWs, totalInvoiced, totalPaid, totalOutstanding, collectionRate });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate summary', code: 'INTERNAL_ERROR' });
  }
});

router.get('/revenue-by-project', requireAuth, requirePermission('REPORT_VIEW'), (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const data = db.prepare(`
      SELECT p.project_id, p.name, p.currency,
        COALESCE(SUM(i.total_amount), 0) as invoiced,
        COALESCE((SELECT SUM(amount_received) FROM payments WHERE project_id = p.project_id), 0) as paid
      FROM projects p
      LEFT JOIN invoices i ON i.project_id = p.project_id AND i.status != 'Cancelled'
      GROUP BY p.project_id
      ORDER BY invoiced DESC
    `).all();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report', code: 'INTERNAL_ERROR' });
  }
});

router.get('/revenue-by-month', requireAuth, requirePermission('REPORT_VIEW'), (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const data = db.prepare(`
      SELECT strftime('%Y-%m', payment_date) as month,
        SUM(amount_received) as total, COUNT(*) as count
      FROM payments
      GROUP BY strftime('%Y-%m', payment_date)
      ORDER BY month DESC
      LIMIT 24
    `).all();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report', code: 'INTERNAL_ERROR' });
  }
});

export default router;
