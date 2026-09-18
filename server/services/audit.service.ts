/**
 * Audit Service — Immutable, append-only audit trail.
 * NEVER logs passwords, tokens, secrets, or OTPs.
 */
import { randomUUID } from 'crypto';
import { getDb } from '../db/schema.js';

export interface AuditEvent {
  eventType: string;
  actorId?: string;
  actorUsername?: string;
  targetEntity?: string;
  targetId?: string;
  targetName?: string;
  details?: string;
  previousValue?: string;
  newValue?: string;
  success?: boolean;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export interface SecurityEvent {
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actorId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

const REDACTED_FIELDS = ['password', 'password_hash', 'token', 'secret', 'otp', 'mfa_secret', 'mfa_recovery'];

function redactSensitive(value: string | undefined): string | undefined {
  if (!value) return value;
  for (const field of REDACTED_FIELDS) {
    if (value.toLowerCase().includes(field)) {
      return '[REDACTED]';
    }
  }
  return value;
}

export function logAuditEvent(event: AuditEvent): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_log (id, event_type, actor_id, actor_username, target_entity, target_id, target_name, details, previous_value, new_value, success, ip_address, user_agent, request_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      event.eventType,
      event.actorId ?? null,
      event.actorUsername ?? null,
      event.targetEntity ?? null,
      event.targetId ?? null,
      event.targetName ?? null,
      redactSensitive(event.details) ?? null,
      redactSensitive(event.previousValue) ?? null,
      redactSensitive(event.newValue) ?? null,
      event.success !== false ? 1 : 0,
      event.ipAddress ?? null,
      event.userAgent ?? null,
      event.requestId ?? null,
    );
  } catch (err) {
    console.error('Failed to write audit log:', (err as Error).message);
  }
}

export function logSecurityEvent(event: SecurityEvent): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO security_events (id, event_type, severity, actor_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      event.eventType,
      event.severity,
      event.actorId ?? null,
      redactSensitive(event.details) ?? null,
      event.ipAddress ?? null,
      event.userAgent ?? null,
    );
  } catch (err) {
    console.error('Failed to write security event:', (err as Error).message);
  }
}

export function getAuditLog(filters: {
  eventType?: string;
  actorId?: string;
  targetEntity?: string;
  targetId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): { entries: AuditEvent[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.eventType) { conditions.push('event_type = ?'); params.push(filters.eventType); }
  if (filters.actorId) { conditions.push('actor_id = ?'); params.push(filters.actorId); }
  if (filters.targetEntity) { conditions.push('target_entity = ?'); params.push(filters.targetEntity); }
  if (filters.targetId) { conditions.push('target_id = ?'); params.push(filters.targetId); }
  if (filters.from) { conditions.push('created_at >= ?'); params.push(filters.from); }
  if (filters.to) { conditions.push('created_at <= ?'); params.push(filters.to); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = (db.prepare(`SELECT COUNT(*) as count FROM audit_log ${where}`).get(...params) as { count: number }).count;

  const limit = Math.min(filters.limit || 50, 200);
  const offset = filters.offset || 0;

  const entries = db.prepare(`
    SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as AuditEvent[];

  return { entries, total };
}
