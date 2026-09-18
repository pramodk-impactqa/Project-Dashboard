/**
 * ID Generation Service — Atomic, sequential, unique readable IDs.
 * Protected against race conditions via SQLite transactions.
 * IDs are generated server-side ONLY — never trust client-supplied IDs.
 */
import { getDb } from '../db/schema.js';

export function generateId(entityType: string): string {
  const db = getDb();

  const result = db.transaction(() => {
    const row = db.prepare('SELECT next_val FROM id_sequences WHERE entity_type = ?').get(entityType) as { next_val: number } | undefined;

    if (!row) {
      db.prepare('INSERT INTO id_sequences (entity_type, next_val) VALUES (?, 2)').run(entityType);
      return 1;
    }

    db.prepare('UPDATE id_sequences SET next_val = next_val + 1 WHERE entity_type = ?').run(entityType);
    return row.next_val;
  })();

  const prefixes: Record<string, string> = {
    PRJ: 'IQA-Proj',
    CLT: 'IQA-CLT',
  };
  const prefix = prefixes[entityType] || entityType;
  return `${prefix}-${String(result).padStart(6, '0')}`;
}
