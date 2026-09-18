/**
 * MFA Service — TOTP-based multi-factor authentication.
 * Uses otpauth library. NEVER logs OTP codes or MFA secrets.
 */
import { TOTP, Secret } from 'otpauth';
import { randomBytes, createHash } from 'crypto';
import QRCode from 'qrcode';
import { SECURITY_CONFIG } from '../config/security.js';
import { getDb } from '../db/schema.js';

export interface MFASetupResult {
  secret: string;
  qrCodeDataUrl: string;
  recoveryCodes: string[];
}

function generateRecoveryCodes(count: number): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(5);
    const code = bytes.toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-');
    codes.push(code);
  }
  return codes;
}

function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.replace(/-/g, '').toLowerCase()).digest('hex');
}

export async function setupMFA(userId: string, username: string): Promise<MFASetupResult> {
  const secret = new Secret({ size: 20 });

  const totp = new TOTP({
    issuer: SECURITY_CONFIG.mfa.issuer,
    label: username,
    algorithm: 'SHA1',
    digits: SECURITY_CONFIG.mfa.otpDigits,
    period: SECURITY_CONFIG.mfa.otpPeriod,
    secret,
  });

  const uri = totp.toString();
  const qrCodeDataUrl = await QRCode.toDataURL(uri);

  const recoveryCodes = generateRecoveryCodes(SECURITY_CONFIG.mfa.recoveryCodes);
  const hashedCodes = recoveryCodes.map(c => hashRecoveryCode(c));

  const db = getDb();
  db.prepare(`
    UPDATE users SET mfa_secret = ?, mfa_recovery = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(secret.base32, JSON.stringify(hashedCodes), userId);

  return {
    secret: secret.base32,
    qrCodeDataUrl,
    recoveryCodes,
  };
}

export function verifyMFAToken(userId: string, token: string): boolean {
  const db = getDb();
  const user = db.prepare('SELECT mfa_secret FROM users WHERE id = ?').get(userId) as { mfa_secret: string } | undefined;

  if (!user?.mfa_secret) return false;

  const totp = new TOTP({
    issuer: SECURITY_CONFIG.mfa.issuer,
    algorithm: 'SHA1',
    digits: SECURITY_CONFIG.mfa.otpDigits,
    period: SECURITY_CONFIG.mfa.otpPeriod,
    secret: Secret.fromBase32(user.mfa_secret),
  });

  const delta = totp.validate({ token, window: SECURITY_CONFIG.mfa.otpWindow });
  return delta !== null;
}

export function verifyRecoveryCode(userId: string, code: string): boolean {
  const db = getDb();
  const user = db.prepare('SELECT mfa_recovery FROM users WHERE id = ?').get(userId) as { mfa_recovery: string } | undefined;

  if (!user?.mfa_recovery) return false;

  const hashedCodes: string[] = JSON.parse(user.mfa_recovery);
  const inputHash = hashRecoveryCode(code);
  const idx = hashedCodes.indexOf(inputHash);

  if (idx === -1) return false;

  // Remove used recovery code (single-use)
  hashedCodes.splice(idx, 1);
  db.prepare(`UPDATE users SET mfa_recovery = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(hashedCodes), userId);

  return true;
}

export function enableMFA(userId: string): void {
  const db = getDb();
  db.prepare(`UPDATE users SET mfa_enabled = 1, updated_at = datetime('now') WHERE id = ?`).run(userId);
}

export function disableMFA(userId: string): void {
  const db = getDb();
  db.prepare(`UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, mfa_recovery = NULL, updated_at = datetime('now') WHERE id = ?`).run(userId);
}
