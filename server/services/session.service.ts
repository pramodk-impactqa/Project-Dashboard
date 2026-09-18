/**
 * Session Service — Secure server-managed sessions via express-session + SQLite store.
 * Session identifiers are cryptographically random and do NOT contain user data.
 */
import session from 'express-session';
import { getDb } from '../db/schema.js';
import { SECURITY_CONFIG } from '../config/security.js';
import type { Store } from 'express-session';

/**
 * Custom SQLite session store for express-session.
 * Stores sessions in the `sessions` table with automatic cleanup.
 */
class SQLiteSessionStore extends session.Store {
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.startCleanup();
  }

  get(sid: string, callback: (err?: Error | null, session?: session.SessionData | null) => void): void {
    try {
      const db = getDb();
      const row = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired > ?').get(sid, Date.now()) as { sess: string } | undefined;
      if (!row) return callback(null, null);
      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err as Error);
    }
  }

  set(sid: string, sess: session.SessionData, callback?: (err?: Error) => void): void {
    try {
      const db = getDb();
      const maxAge = sess.cookie?.maxAge ?? SECURITY_CONFIG.session.absoluteLifetimeMs;
      const expired = Date.now() + maxAge;
      db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, ?)')
        .run(sid, JSON.stringify(sess), expired);
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  destroy(sid: string, callback?: (err?: Error) => void): void {
    try {
      const db = getDb();
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  touch(sid: string, sess: session.SessionData, callback?: (err?: Error) => void): void {
    try {
      const db = getDb();
      const maxAge = sess.cookie?.maxAge ?? SECURITY_CONFIG.session.absoluteLifetimeMs;
      const expired = Date.now() + maxAge;
      db.prepare('UPDATE sessions SET expired = ?, sess = ? WHERE sid = ?')
        .run(expired, JSON.stringify(sess), sid);
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  all(callback: (err?: Error | null, sessions?: { [sid: string]: session.SessionData }) => void): void {
    try {
      const db = getDb();
      const rows = db.prepare('SELECT sid, sess FROM sessions WHERE expired > ?').all(Date.now()) as { sid: string; sess: string }[];
      const result: { [sid: string]: session.SessionData } = {};
      for (const row of rows) {
        result[row.sid] = JSON.parse(row.sess);
      }
      callback(null, result);
    } catch (err) {
      callback(err as Error);
    }
  }

  length(callback: (err?: Error | null, length?: number) => void): void {
    try {
      const db = getDb();
      const row = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE expired > ?').get(Date.now()) as { count: number };
      callback(null, row.count);
    } catch (err) {
      callback(err as Error);
    }
  }

  clear(callback?: (err?: Error) => void): void {
    try {
      const db = getDb();
      db.prepare('DELETE FROM sessions').run();
      callback?.();
    } catch (err) {
      callback?.(err as Error);
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      try {
        const db = getDb();
        db.prepare('DELETE FROM sessions WHERE expired <= ?').run(Date.now());
      } catch { /* cleanup is best-effort */ }
    }, 15 * 60 * 1000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export function createSessionMiddleware() {
  const store = new SQLiteSessionStore();

  return session({
    store: store as Store,
    name: SECURITY_CONFIG.session.cookieName,
    secret: SECURITY_CONFIG.session.secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: SECURITY_CONFIG.session.secureCookie,
      sameSite: SECURITY_CONFIG.session.sameSite,
      maxAge: SECURITY_CONFIG.session.absoluteLifetimeMs,
      path: '/',
    },
  });
}

/**
 * Destroy all sessions for a given userId (logout all sessions).
 */
export function destroyAllUserSessions(userId: string): void {
  const db = getDb();
  const rows = db.prepare('SELECT sid, sess FROM sessions WHERE expired > ?').all(Date.now()) as { sid: string; sess: string }[];

  for (const row of rows) {
    try {
      const sess = JSON.parse(row.sess);
      if (sess.userId === userId) {
        db.prepare('DELETE FROM sessions WHERE sid = ?').run(row.sid);
      }
    } catch { /* skip malformed sessions */ }
  }
}
