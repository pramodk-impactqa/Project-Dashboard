/**
 * Notification Routes
 */
import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDb } from '../db/schema.js';

const router = Router();

router.get('/', requireAuth, (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const notifications = db.prepare('SELECT * FROM notifications ORDER BY date DESC LIMIT 200').all();
    const unreadCount = (db.prepare('SELECT COUNT(*) as c FROM notifications WHERE read = 0').get() as { c: number }).c;
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list notifications', code: 'INTERNAL_ERROR' });
  }
});

router.patch('/:id/read', requireAuth, (req: Request, res: Response) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification', code: 'INTERNAL_ERROR' });
  }
});

router.post('/mark-all-read', requireAuth, (_req: Request, res: Response) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET read = 1 WHERE read = 0').run();
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications', code: 'INTERNAL_ERROR' });
  }
});

export default router;
