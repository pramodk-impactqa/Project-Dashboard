/**
 * Database Schema — SQLite via better-sqlite3
 * All tables use parameterized queries. Never concatenate user input into SQL.
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import argon2 from 'argon2';
import { SECURITY_CONFIG } from '../config/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '..', 'data', 'finance.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.pragma('busy_timeout = 5000');
  }
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function initializeDatabase(): void {
  const db = getDb();

  db.exec(`
    -- ════════════════════════════════════════════════════════════
    -- USERS
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      employee_id     TEXT UNIQUE NOT NULL,
      first_name      TEXT NOT NULL,
      last_name       TEXT NOT NULL,
      email           TEXT UNIQUE NOT NULL COLLATE NOCASE,
      username        TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash   TEXT NOT NULL,
      role            TEXT NOT NULL DEFAULT 'VIEWER',
      department      TEXT NOT NULL DEFAULT 'Engineering',
      status          TEXT NOT NULL DEFAULT 'INVITED' CHECK(status IN ('ACTIVE','INVITED','SUSPENDED','LOCKED','INACTIVE')),
      mfa_enabled     INTEGER NOT NULL DEFAULT 0,
      mfa_secret      TEXT,
      mfa_recovery    TEXT,
      password_changed_at TEXT,
      account_locked_until TEXT,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      last_login_at   TEXT,
      force_password_change INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ════════════════════════════════════════════════════════════
    -- ROLES & PERMISSIONS
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS roles (
      id          TEXT PRIMARY KEY,
      name        TEXT UNIQUE NOT NULL,
      description TEXT,
      is_system   INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id          TEXT PRIMARY KEY,
      code        TEXT UNIQUE NOT NULL,
      description TEXT,
      category    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id       TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );

    -- ════════════════════════════════════════════════════════════
    -- SESSIONS (for express-session SQLite store)
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS sessions (
      sid       TEXT PRIMARY KEY,
      sess      TEXT NOT NULL,
      expired   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired);

    -- ════════════════════════════════════════════════════════════
    -- PASSWORD RESET TOKENS
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      token_hash  TEXT NOT NULL,
      expires_at  TEXT NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ════════════════════════════════════════════════════════════
    -- INVITATION TOKENS
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS invitation_tokens (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      token_hash  TEXT NOT NULL,
      expires_at  TEXT NOT NULL,
      used        INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ════════════════════════════════════════════════════════════
    -- LOGIN ATTEMPTS (for rate-limiting / lockout tracking)
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS login_attempts (
      id          TEXT PRIMARY KEY,
      identifier  TEXT NOT NULL,
      ip_address  TEXT,
      user_agent  TEXT,
      success     INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_login_attempts_id_time ON login_attempts(identifier, created_at);

    -- ════════════════════════════════════════════════════════════
    -- AUDIT LOG (immutable, append-only)
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS audit_log (
      id              TEXT PRIMARY KEY,
      event_type      TEXT NOT NULL,
      actor_id        TEXT,
      actor_username  TEXT,
      target_entity   TEXT,
      target_id       TEXT,
      target_name     TEXT,
      details         TEXT,
      previous_value  TEXT,
      new_value       TEXT,
      success         INTEGER NOT NULL DEFAULT 1,
      ip_address      TEXT,
      user_agent      TEXT,
      request_id      TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log(event_type, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_entity, target_id);

    -- ════════════════════════════════════════════════════════════
    -- SECURITY EVENTS (separate from audit — for sec monitoring)
    -- ════════════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS security_events (
      id          TEXT PRIMARY KEY,
      event_type  TEXT NOT NULL,
      severity    TEXT NOT NULL CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
      actor_id    TEXT,
      details     TEXT,
      ip_address  TEXT,
      user_agent  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type, created_at);

    -- Clients (first-class; a client can have many projects)
    CREATE TABLE IF NOT EXISTS clients (
      id            TEXT PRIMARY KEY,
      client_id     TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      address       TEXT DEFAULT '',
      domain        TEXT NOT NULL,
      entity        TEXT NOT NULL CHECK(entity IN ('US','UK','India')),
      status        TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','On Hold','Inactive')),
      tax_id        TEXT DEFAULT '',
      created_by    TEXT REFERENCES users(id),
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ════════════════════════════════════════════════════════════
    -- BUSINESS ENTITIES
    -- ════════════════════════════════════════════════════════════

    -- ID Sequences (atomic counter for readable IDs)
    CREATE TABLE IF NOT EXISTS id_sequences (
      entity_type TEXT PRIMARY KEY,
      next_val    INTEGER NOT NULL DEFAULT 1
    );

    -- Projects
    CREATE TABLE IF NOT EXISTS projects (
      id                TEXT PRIMARY KEY,
      project_id        TEXT UNIQUE NOT NULL,
      name              TEXT NOT NULL,
      description       TEXT DEFAULT '',
      domain            TEXT NOT NULL,
      entity            TEXT NOT NULL CHECK(entity IN ('US','UK','India')),
      currency          TEXT NOT NULL CHECK(currency IN ('USD','GBP','INR')),
      status            TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','On Hold','Inactive')),
      start_date        TEXT NOT NULL,
      end_date          TEXT DEFAULT '',
      client_name       TEXT NOT NULL,
      client_id         TEXT DEFAULT '',
      client_address    TEXT DEFAULT '',
      client_tax_id     TEXT DEFAULT '',
      project_manager   TEXT DEFAULT '',
      delivery_manager  TEXT DEFAULT '',
      department        TEXT DEFAULT 'Engineering',
      billing_id        TEXT DEFAULT '',
      billing_model     TEXT DEFAULT 'FTE',
      billing_frequency TEXT DEFAULT 'Monthly',
      billing_contact   TEXT DEFAULT '',
      billing_address   TEXT DEFAULT '',
      payment_terms     TEXT DEFAULT 'FTE',
      created_by        TEXT REFERENCES users(id),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- SOWs
    CREATE TABLE IF NOT EXISTS sows (
      id                TEXT PRIMARY KEY,
      sow_number        TEXT UNIQUE NOT NULL,
      project_id        TEXT NOT NULL REFERENCES projects(project_id),
      project_name      TEXT DEFAULT '',
      client_name       TEXT DEFAULT '',
      title             TEXT NOT NULL,
      description       TEXT DEFAULT '',
      version           TEXT DEFAULT '1.0',
      start_date        TEXT NOT NULL,
      end_date          TEXT NOT NULL,
      renewal_date      TEXT DEFAULT '',
      contract_type     TEXT DEFAULT 'Fixed Price',
      contract_value    REAL NOT NULL DEFAULT 0,
      monthly_billing   REAL DEFAULT 0,
      billing_frequency TEXT DEFAULT 'Monthly',
      currency          TEXT DEFAULT 'USD',
      status            TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','In Review','Approved','Active','Expired','Cancelled')),
      created_by        TEXT REFERENCES users(id),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Invoices
    CREATE TABLE IF NOT EXISTS invoices (
      id              TEXT PRIMARY KEY,
      invoice_number  TEXT UNIQUE NOT NULL,
      entity          TEXT NOT NULL,
      project_id      TEXT NOT NULL REFERENCES projects(project_id),
      project_name    TEXT DEFAULT '',
      client_name     TEXT DEFAULT '',
      billing_id      TEXT DEFAULT '',
      sow_id          TEXT DEFAULT '',
      sow_number      TEXT DEFAULT '',
      billing_period  TEXT DEFAULT '',
      invoice_date    TEXT NOT NULL,
      due_date        TEXT NOT NULL,
      amount          REAL NOT NULL DEFAULT 0,
      currency        TEXT DEFAULT 'USD',
      tax_amount      REAL DEFAULT 0,
      total_amount    REAL NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Sent','Paid','Partially Paid','Overdue','Cancelled')),
      created_by      TEXT REFERENCES users(id),
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Payments
    CREATE TABLE IF NOT EXISTS payments (
      id                    TEXT PRIMARY KEY,
      invoice_id            TEXT DEFAULT '',
      invoice_number        TEXT DEFAULT '',
      project_id            TEXT NOT NULL REFERENCES projects(project_id),
      project_name          TEXT DEFAULT '',
      amount_received       REAL NOT NULL DEFAULT 0,
      payment_date          TEXT NOT NULL,
      currency              TEXT DEFAULT 'USD',
      exchange_rate         REAL DEFAULT 1,
      bank                  TEXT DEFAULT '',
      tds_withholding       REAL DEFAULT 0,
      short_payment         REAL DEFAULT 0,
      outstanding_balance   REAL DEFAULT 0,
      remarks               TEXT DEFAULT '',
      status                TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Received','Partial','Pending')),
      created_by            TEXT REFERENCES users(id),
      created_at            TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Managers
    CREATE TABLE IF NOT EXISTS managers (
      id    TEXT PRIMARY KEY,
      name  TEXT NOT NULL,
      type  TEXT NOT NULL CHECK(type IN ('Project Manager','Delivery Manager')),
      email TEXT DEFAULT ''
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id        TEXT PRIMARY KEY,
      type      TEXT NOT NULL,
      title     TEXT NOT NULL,
      message   TEXT NOT NULL,
      date      TEXT NOT NULL DEFAULT (datetime('now')),
      read      INTEGER NOT NULL DEFAULT 0,
      severity  TEXT DEFAULT 'info',
      user_id   TEXT REFERENCES users(id)
    );
  `);

  migrateSchema(db);
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrateSchema(db: Database.Database): void {
  addColumnIfMissing(db, 'projects', 'msa_file', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'projects', 'msa_original_name', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'sows', 'sow_type', "TEXT DEFAULT 'T&M'");
  addColumnIfMissing(db, 'sows', 'basis', "TEXT DEFAULT 'Monthly'");
  addColumnIfMissing(db, 'sows', 'remarks', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'sows', 'project_manager', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'sows', 'delivery_manager', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'sows', 'po_number', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'sows', 'sow_file', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'sows', 'sow_original_name', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'sows', 'po_file', "TEXT DEFAULT ''");
  addColumnIfMissing(db, 'sows', 'po_original_name', "TEXT DEFAULT ''");
}

/**
 * Seed initial roles, permissions, and a super-admin account.
 * Only runs if no users exist.
 */
export async function seedDatabase(): Promise<void> {
  const db = getDb();

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) return;

  console.log('🌱 Seeding database with roles, permissions, and initial admin...');

  // ── Roles ──────────────────────────────────────────────────
  const roles = [
    { id: 'role-superadmin', name: 'SUPER_ADMIN', description: 'Full administrative control', is_system: 1 },
    { id: 'role-admin', name: 'ADMIN', description: 'User and operational administration', is_system: 1 },
    { id: 'role-finance', name: 'FINANCE', description: 'Billing, invoices, payments, and reports', is_system: 1 },
    { id: 'role-pm', name: 'PROJECT_MANAGER', description: 'Project and SOW management', is_system: 1 },
    { id: 'role-dm', name: 'DELIVERY_MANAGER', description: 'Delivery oversight', is_system: 1 },
    { id: 'role-viewer', name: 'VIEWER', description: 'Read-only access', is_system: 1 },
  ];

  const insertRole = db.prepare(
    'INSERT OR IGNORE INTO roles (id, name, description, is_system) VALUES (?, ?, ?, ?)'
  );

  for (const r of roles) {
    insertRole.run(r.id, r.name, r.description, r.is_system);
  }

  // ── Permissions ────────────────────────────────────────────
  const perms = [
    // Users
    { code: 'USER_VIEW', cat: 'Users' }, { code: 'USER_CREATE', cat: 'Users' },
    { code: 'USER_UPDATE', cat: 'Users' }, { code: 'USER_SUSPEND', cat: 'Users' },

    // Clients (via Projects)
    { code: 'CLIENT_VIEW', cat: 'Clients' }, { code: 'CLIENT_CREATE', cat: 'Clients' },
    { code: 'CLIENT_UPDATE', cat: 'Clients' },

    // Projects
    { code: 'PROJECT_VIEW', cat: 'Projects' }, { code: 'PROJECT_CREATE', cat: 'Projects' },
    { code: 'PROJECT_UPDATE', cat: 'Projects' }, { code: 'PROJECT_STATUS_CHANGE', cat: 'Projects' },

    // SOWs
    { code: 'SOW_VIEW', cat: 'SOWs' }, { code: 'SOW_CREATE', cat: 'SOWs' },
    { code: 'SOW_UPDATE', cat: 'SOWs' }, { code: 'SOW_DELETE', cat: 'SOWs' },
    { code: 'SOW_APPROVE', cat: 'SOWs' },

    // Billing
    { code: 'BILLING_VIEW', cat: 'Billing' }, { code: 'BILLING_CREATE', cat: 'Billing' },
    { code: 'BILLING_UPDATE', cat: 'Billing' },

    // Invoices
    { code: 'INVOICE_VIEW', cat: 'Invoices' }, { code: 'INVOICE_CREATE', cat: 'Invoices' },
    { code: 'INVOICE_UPDATE', cat: 'Invoices' }, { code: 'INVOICE_CANCEL', cat: 'Invoices' },
    { code: 'INVOICE_DOWNLOAD', cat: 'Invoices' },

    // Payments
    { code: 'PAYMENT_VIEW', cat: 'Payments' }, { code: 'PAYMENT_CREATE', cat: 'Payments' },
    { code: 'PAYMENT_UPDATE', cat: 'Payments' },

    // Reports
    { code: 'REPORT_VIEW', cat: 'Reports' }, { code: 'REPORT_EXPORT', cat: 'Reports' },

    // Settings
    { code: 'SETTINGS_VIEW', cat: 'Settings' }, { code: 'SETTINGS_UPDATE', cat: 'Settings' },

    // Audit
    { code: 'AUDIT_VIEW', cat: 'Audit' },

    // Managers
    { code: 'MANAGER_VIEW', cat: 'Managers' }, { code: 'MANAGER_CREATE', cat: 'Managers' },
    { code: 'MANAGER_DELETE', cat: 'Managers' },

    // Notifications
    { code: 'NOTIFICATION_VIEW', cat: 'Notifications' },
  ];

  const insertPerm = db.prepare(
    'INSERT OR IGNORE INTO permissions (id, code, description, category) VALUES (?, ?, ?, ?)'
  );

  for (const p of perms) {
    insertPerm.run(`perm-${p.code.toLowerCase()}`, p.code, `Permission to ${p.code.toLowerCase().replace(/_/g, ' ')}`, p.cat);
  }

  // ── Role → Permission Mapping ─────────────────────────────
  const allPermCodes = perms.map(p => p.code);

  const rolePermMap: Record<string, string[]> = {
    SUPER_ADMIN: allPermCodes,
    ADMIN: allPermCodes.filter(p => !p.startsWith('AUDIT_') || p === 'AUDIT_VIEW'),
    FINANCE: [
      'CLIENT_VIEW', 'CLIENT_CREATE', 'CLIENT_UPDATE', 'PROJECT_VIEW', 'SOW_VIEW', 'BILLING_VIEW', 'BILLING_CREATE', 'BILLING_UPDATE',
      'INVOICE_VIEW', 'INVOICE_CREATE', 'INVOICE_UPDATE', 'INVOICE_CANCEL', 'INVOICE_DOWNLOAD',
      'PAYMENT_VIEW', 'PAYMENT_CREATE', 'PAYMENT_UPDATE',
      'REPORT_VIEW', 'REPORT_EXPORT', 'MANAGER_VIEW', 'MANAGER_CREATE', 'NOTIFICATION_VIEW', 'AUDIT_VIEW',
    ],
    PROJECT_MANAGER: [
      'CLIENT_VIEW', 'CLIENT_CREATE', 'CLIENT_UPDATE',
      'PROJECT_VIEW', 'PROJECT_CREATE', 'PROJECT_UPDATE',
      'SOW_VIEW', 'SOW_CREATE', 'SOW_UPDATE',
      'BILLING_VIEW', 'INVOICE_VIEW', 'PAYMENT_VIEW',
      'REPORT_VIEW', 'MANAGER_VIEW', 'MANAGER_CREATE', 'NOTIFICATION_VIEW',
    ],
    DELIVERY_MANAGER: [
      'CLIENT_VIEW', 'PROJECT_VIEW',
      'SOW_VIEW', 'BILLING_VIEW', 'INVOICE_VIEW', 'PAYMENT_VIEW',
      'REPORT_VIEW', 'MANAGER_VIEW', 'NOTIFICATION_VIEW',
    ],
    VIEWER: [
      'CLIENT_VIEW', 'PROJECT_VIEW', 'SOW_VIEW', 'BILLING_VIEW',
      'INVOICE_VIEW', 'PAYMENT_VIEW', 'REPORT_VIEW', 'MANAGER_VIEW', 'NOTIFICATION_VIEW',
    ],
  };

  const insertRolePerm = db.prepare(
    'INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)'
  );

  for (const [roleName, permCodes] of Object.entries(rolePermMap)) {
    const role = roles.find(r => r.name === roleName)!;
    for (const code of permCodes) {
      insertRolePerm.run(role.id, `perm-${code.toLowerCase()}`);
    }
  }

  // ── Seed ID Sequences ─────────────────────────────────────
  const insertSeq = db.prepare('INSERT OR IGNORE INTO id_sequences (entity_type, next_val) VALUES (?, 1)');
  for (const et of ['PRJ', 'CLT', 'BIL', 'SOW', 'INV', 'PAY', 'EMP']) {
    insertSeq.run(et);
  }

  // ── Create Initial Super Admin ─────────────────────────────
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@SecureP0rtal!';
  const hashedPassword = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: SECURITY_CONFIG.argon2.memoryCost,
    timeCost: SECURITY_CONFIG.argon2.timeCost,
    parallelism: SECURITY_CONFIG.argon2.parallelism,
    hashLength: SECURITY_CONFIG.argon2.hashLength,
  });

  const adminId = randomUUID();
  db.prepare(`
    INSERT INTO users (id, employee_id, first_name, last_name, email, username, password_hash, role, department, status, mfa_enabled, force_password_change)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    adminId, 'EMP-000001', 'System', 'Administrator', 'admin@iqafinance.local',
    'admin', hashedPassword, 'SUPER_ADMIN', 'Administration', 'ACTIVE', 0, 1
  );

  // Finance user
  const financePassword = process.env.INITIAL_FINANCE_PASSWORD || 'Finance@SecureP0rtal!';
  const financeHash = await argon2.hash(financePassword, {
    type: argon2.argon2id,
    memoryCost: SECURITY_CONFIG.argon2.memoryCost,
    timeCost: SECURITY_CONFIG.argon2.timeCost,
    parallelism: SECURITY_CONFIG.argon2.parallelism,
    hashLength: SECURITY_CONFIG.argon2.hashLength,
  });

  const financeId = randomUUID();
  db.prepare(`
    INSERT INTO users (id, employee_id, first_name, last_name, email, username, password_hash, role, department, status, mfa_enabled, force_password_change)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    financeId, 'EMP-000002', 'Finance', 'Manager', 'finance@iqafinance.local',
    'finance', financeHash, 'FINANCE', 'Finance', 'ACTIVE', 0, 1
  );

  // Seed default managers
  const insertMgr = db.prepare('INSERT OR IGNORE INTO managers (id, name, type, email) VALUES (?, ?, ?, ?)');
  const mgrs = [
    { name: 'Sachin Sangle', type: 'Delivery Manager' },
    { name: 'Naini Ghai', type: 'Delivery Manager' },
    { name: 'Sarthak Seth', type: 'Project Manager' },
    { name: 'Gaurav Pandey', type: 'Project Manager' },
    { name: 'Richa Bajaj', type: 'Project Manager' },
    { name: 'Aman Verma', type: 'Project Manager' },
    { name: 'Nagarjuna', type: 'Project Manager' },
  ];
  for (const m of mgrs) {
    insertMgr.run(randomUUID(), m.name, m.type, '');
  }

  console.log('✅ Database seeded successfully');
  console.log('   Admin: admin (password from INITIAL_ADMIN_PASSWORD env var)');
  console.log('   Finance: finance (password from INITIAL_FINANCE_PASSWORD env var)');
  console.log('   ⚠️  Users MUST change passwords on first login (force_password_change=1)');
}
