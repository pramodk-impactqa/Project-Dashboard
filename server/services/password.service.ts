/**
 * Password Service — Argon2id hashing, policy enforcement, common password check.
 * NEVER stores, logs, or returns plaintext passwords.
 */
import argon2 from 'argon2';
import { SECURITY_CONFIG } from '../config/security.js';

const COMMON_PASSWORDS = new Set([
  'password', 'password1', '123456', '12345678', '123456789', '1234567890',
  'qwerty', 'abc123', 'password123', 'admin', 'letmein', 'welcome',
  'monkey', 'dragon', 'master', 'login', 'princess', 'football',
  'shadow', 'sunshine', 'trustno1', 'iloveyou', 'batman', 'access',
  'hello', 'charlie', 'donald', 'baseball', 'passw0rd', 'p@ssword',
  'p@ssw0rd', 'admin123', 'admin@123', 'finance@123', 'user@123',
  'test123', 'Password1', 'Password123', 'Qwerty123',
]);

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const cfg = SECURITY_CONFIG.password;

  if (password.length < cfg.minLength) {
    errors.push(`Password must be at least ${cfg.minLength} characters`);
  }
  if (password.length > cfg.maxLength) {
    errors.push(`Password must not exceed ${cfg.maxLength} characters`);
  }
  if (cfg.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (cfg.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (cfg.requireDigit && !/\d/.test(password)) {
    errors.push('Password must contain at least one digit');
  }
  if (cfg.requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  if (cfg.rejectCommon && COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a more unique password');
  }

  return { valid: errors.length === 0, errors };
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: SECURITY_CONFIG.argon2.memoryCost,
    timeCost: SECURITY_CONFIG.argon2.timeCost,
    parallelism: SECURITY_CONFIG.argon2.parallelism,
    hashLength: SECURITY_CONFIG.argon2.hashLength,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function needsRehash(hash: string): Promise<boolean> {
  return argon2.needsRehash(hash, {
    type: argon2.argon2id,
    memoryCost: SECURITY_CONFIG.argon2.memoryCost,
    timeCost: SECURITY_CONFIG.argon2.timeCost,
  });
}
