/**
 * FX rates — Frankfurter (ECB) proxy so the browser stays same-origin.
 */
import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const ALLOWED = new Set(['USD', 'INR', 'GBP', 'EUR', 'JPY', 'CAD', 'AUD', 'CHF']);

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const from = String(req.query.from || 'USD').toUpperCase();
    if (!ALLOWED.has(from)) {
      res.status(400).json({ error: 'Unsupported currency', code: 'VALIDATION_ERROR' });
      return;
    }

    const targets = [...ALLOWED].filter(c => c !== from).join(',');
    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(targets)}`;
    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!upstream.ok) {
      res.status(502).json({ error: 'Exchange rate service unavailable', code: 'FX_UNAVAILABLE' });
      return;
    }

    const data = await upstream.json() as { rates?: Record<string, number>; date?: string };
    const rates: Record<string, number> = { [from]: 1, ...(data.rates || {}) };
    res.json({ base: from, date: data.date || '', rates });
  } catch (err) {
    console.error('FX fetch error:', (err as Error).message);
    res.status(502).json({ error: 'Failed to fetch exchange rates', code: 'FX_UNAVAILABLE' });
  }
});

export default router;
