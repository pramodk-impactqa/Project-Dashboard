/**
 * RBAC Service — Role-Based Access Control
 * Centralized authorization. Do NOT duplicate permission checks across routes.
 */
import { getDb } from '../db/schema.js';

export interface RolePermissions {
  role: string;
  permissions: string[];
}

const permissionCache = new Map<string, string[]>();

export function clearPermissionCache(): void {
  permissionCache.clear();
}

export function getPermissionsForRole(roleName: string): string[] {
  if (permissionCache.has(roleName)) {
    return permissionCache.get(roleName)!;
  }

  const db = getDb();
  const perms = db.prepare(`
    SELECT p.code FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    JOIN roles r ON r.id = rp.role_id
    WHERE r.name = ?
  `).all(roleName) as { code: string }[];

  const codes = perms.map(p => p.code);
  permissionCache.set(roleName, codes);
  return codes;
}

export function hasPermission(roleName: string, requiredPermission: string): boolean {
  const perms = getPermissionsForRole(roleName);
  return perms.includes(requiredPermission);
}

export function hasAnyPermission(roleName: string, requiredPermissions: string[]): boolean {
  const perms = getPermissionsForRole(roleName);
  return requiredPermissions.some(p => perms.includes(p));
}

export function hasAllPermissions(roleName: string, requiredPermissions: string[]): boolean {
  const perms = getPermissionsForRole(roleName);
  return requiredPermissions.every(p => perms.includes(p));
}

export function getAllRoles(): { id: string; name: string; description: string; is_system: number; permissionCount: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT r.id, r.name, r.description, r.is_system,
           (SELECT COUNT(*) FROM role_permissions WHERE role_id = r.id) as permissionCount
    FROM roles r ORDER BY r.name
  `).all() as { id: string; name: string; description: string; is_system: number; permissionCount: number }[];
}

export function getRolePermissions(roleId: string): string[] {
  const db = getDb();
  const perms = db.prepare(`
    SELECT p.code FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    WHERE rp.role_id = ?
  `).all(roleId) as { code: string }[];
  return perms.map(p => p.code);
}

export function getAllPermissions(): { id: string; code: string; description: string; category: string }[] {
  const db = getDb();
  return db.prepare('SELECT * FROM permissions ORDER BY category, code').all() as {
    id: string; code: string; description: string; category: string;
  }[];
}

export function isSuperAdmin(role: string): boolean {
  return role === 'SUPER_ADMIN';
}

export function isAdmin(role: string): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}
