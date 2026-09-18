# Authorization Architecture — IQA Finance Operations Portal

> This document describes the Role-Based Access Control (RBAC) implementation based on OWASP Access Control guidance. The frontend may hide UI elements for UX, but the **backend ALWAYS enforces authorization**.

---

## Core Principle

```
         ╔════════════════════════════════════════════════╗
         ║  NEVER TRUST THE FRONTEND FOR SECURITY.       ║
         ║                                                ║
         ║  Hiding a button is UX, NOT security.          ║
         ║  The API MUST independently verify:            ║
         ║    1. Authentication                           ║
         ║    2. Authorization (role + permission)        ║
         ║    3. Resource access (ownership/scope)        ║
         ║  for EVERY protected operation.                ║
         ╚════════════════════════════════════════════════╝
```

## RBAC Architecture

### Middleware Stack (applied to every protected endpoint)

```
Request → requireAuth → requirePermission('X') → Route Handler
              │                    │
              │  Checks:           │  Checks:
              │  - Session exists   │  - Role in session
              │  - MFA verified     │  - Permission lookup
              │  - Session not      │  - Centralized cache
              │    expired          │  - Audit log on fail
              │  - Idle timeout     │
              │  - Absolute timeout │
              └────────────────────└──→ 401/403 if failed
```

### Middleware Functions

| Middleware | Purpose | Usage |
|---|---|---|
| `requireAuth` | Verifies authenticated session | All protected endpoints |
| `requirePermission(perm)` | Checks specific permission | Endpoint-level access |
| `requireAnyPermission(...perms)` | Checks any of multiple permissions | OR-based access |
| `requireRole(...roles)` | Checks specific role(s) | Admin-only operations |
| `requireRecentAuth(maxAgeMs)` | Requires recent login | Sensitive operations |

## Roles

| Role | Description | Typical User |
|---|---|---|
| `SUPER_ADMIN` | Full administrative control | System administrator |
| `ADMIN` | User and operational administration | IT manager |
| `FINANCE` | Billing, invoices, payments, reports | Finance team |
| `PROJECT_MANAGER` | Project and SOW management | PM team |
| `DELIVERY_MANAGER` | Read-only project oversight | DM team |
| `VIEWER` | Read-only access across modules | External stakeholders |

### Role Hierarchy (Implicit)
```
SUPER_ADMIN ──→ All permissions
     │
   ADMIN ──→ All permissions except some audit restrictions
     │
  FINANCE ──→ Client, Project, SOW, Billing, Invoice, Payment, Report, Manager (view), Notification, Audit
     │
PROJECT_MANAGER ──→ Client (view), Project (CRUD), SOW (CRU), Billing/Invoice/Payment (view), Report, Manager (view), Notification
     │
DELIVERY_MANAGER ──→ Client (view), Project (view), SOW/Billing/Invoice/Payment (view), Report, Manager (view), Notification
     │
  VIEWER ──→ Client (view), Project (view), SOW/Billing/Invoice/Payment (view), Report, Manager (view), Notification
```

## Permissions

### Permission Categories

#### Users
| Permission | SUPER_ADMIN | ADMIN | FINANCE | PM | DM | VIEWER |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `USER_VIEW` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `USER_CREATE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `USER_UPDATE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `USER_SUSPEND` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

#### Clients & Projects
| Permission | SUPER_ADMIN | ADMIN | FINANCE | PM | DM | VIEWER |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `CLIENT_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `CLIENT_CREATE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `CLIENT_UPDATE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `PROJECT_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PROJECT_CREATE` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `PROJECT_UPDATE` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `PROJECT_STATUS_CHANGE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

#### SOWs
| Permission | SUPER_ADMIN | ADMIN | FINANCE | PM | DM | VIEWER |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `SOW_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `SOW_CREATE` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `SOW_UPDATE` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `SOW_DELETE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `SOW_APPROVE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

#### Billing & Finance
| Permission | SUPER_ADMIN | ADMIN | FINANCE | PM | DM | VIEWER |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `BILLING_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `BILLING_CREATE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `BILLING_UPDATE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `INVOICE_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `INVOICE_CREATE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `INVOICE_UPDATE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `INVOICE_CANCEL` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `INVOICE_DOWNLOAD` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `PAYMENT_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `PAYMENT_CREATE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `PAYMENT_UPDATE` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

#### Reports, Settings & Administration
| Permission | SUPER_ADMIN | ADMIN | FINANCE | PM | DM | VIEWER |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `REPORT_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `REPORT_EXPORT` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `SETTINGS_VIEW` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `SETTINGS_UPDATE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `AUDIT_VIEW` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `MANAGER_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `MANAGER_CREATE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `MANAGER_DELETE` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `NOTIFICATION_VIEW` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Authorization Enforcement

### Backend Enforcement (MANDATORY)
Every API endpoint uses middleware:
```typescript
router.post('/', requireAuth, requirePermission('PROJECT_CREATE'), validateBody(schema), handler);
```

### Frontend UX (OPTIONAL, NOT SECURITY)
The frontend uses `hasPermission()` from `AuthContext` to conditionally render UI:
```tsx
// This is UX ONLY — the backend independently verifies permissions
{hasPermission('PROJECT_CREATE') && <button>Add Project</button>}
```

### Route-Level Protection (Frontend)
```tsx
<PermissionRoute permission="AUDIT_VIEW">
  <AuditPage />
</PermissionRoute>
```
This prevents navigating to pages the user doesn't have access to, but the **API still enforces authorization** independently.

## IDOR / BOLA Protection

### How It's Prevented
1. **Every resource access is authenticated** — no anonymous access to data
2. **Every resource access is authorized** — permission checked via RBAC middleware
3. **Resource IDs are not predictable** — UUIDs for internal IDs, readable IDs (PRJ-000001) for business IDs
4. **Backend never trusts client-supplied ownership** — the server verifies the user's session and role

### Example: Project Access
```
GET /api/projects/PRJ-000001

1. requireAuth → Is user authenticated? (session valid?)
2. requirePermission('PROJECT_VIEW') → Does user's role have this permission?
3. Route handler → Fetch project from DB
4. If not found → 404 (no information leak)
```

Changing `PRJ-000001` to `PRJ-000002` in the request only works if the authenticated user has `PROJECT_VIEW` permission. The same principal applies to all entities.

## Privilege Escalation Protection

### Vertical Escalation Prevention
- Only `SUPER_ADMIN` can create `SUPER_ADMIN` accounts
- Only `SUPER_ADMIN` / `ADMIN` can reset MFA
- Role changes invalidate all sessions for the affected user
- Reauthentication required for sensitive admin operations

### Self-Action Prevention
- Users cannot suspend their own account
- Role changes trigger session invalidation

### Permission Cache
- Permissions are cached per role to avoid repeated DB lookups
- Cache is cleared on role/permission changes (manual via `clearPermissionCache()`)

## Adding New Roles (Extensibility)

The RBAC system is designed for extensibility:

1. **Add role to `roles` table:**
   ```sql
   INSERT INTO roles (id, name, description, is_system) VALUES (?, 'NEW_ROLE', 'Description', 0);
   ```

2. **Assign permissions to role:**
   ```sql
   INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?);
   ```

3. **Clear permission cache** (if server is running)

4. **Add role to Zod schema:**
   ```typescript
   role: z.enum(['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'PROJECT_MANAGER', 'DELIVERY_MANAGER', 'VIEWER', 'NEW_ROLE'])
   ```

5. **Update frontend (optional)** — add role to `UserRole` type and route guards

No code changes to middleware are needed — the authorization middleware dynamically looks up permissions from the database.

## Audit Trail for Authorization

### Logged Events
| Event | When |
|---|---|
| `AUTHORIZATION_FAILURE` | User attempts action without required permission (severity: HIGH) |
| `ROLE_CHANGED` | Admin changes a user's role |
| `USER_SUSPENDED` | Admin suspends a user |
| `USER_UPDATED` | Admin modifies user attributes |

### Security Events
All authorization failures are logged to the `security_events` table with:
- Event type
- Actor ID
- Attempted permission/role
- Request path and method
- IP address
- User agent
- Severity: HIGH

## User Lifecycle

```
                    Admin creates user
                          │
                    ┌─────▼──────┐
                    │  INVITED    │ ← Cannot log in yet
                    └─────┬──────┘
                          │ User activates account
                    ┌─────▼──────┐
                    │   ACTIVE    │ ← Normal access
                    └──┬──┬──┬───┘
                       │  │  │
              Lockout ─┘  │  └─ Admin suspends
                       │  │        │
                ┌──────▼┐ │  ┌─────▼──────┐
                │ LOCKED │ │  │ SUSPENDED   │ ← Cannot log in
                └──┬────┘ │  └─────┬──────┘
                   │      │        │ Admin activates
              Auto-│      │        │
              unlock      │  ┌─────▼──────┐
                   └──────┘  │   ACTIVE    │
                             └─────┬──────┘
                                   │ Admin deactivates
                             ┌─────▼──────┐
                             │  INACTIVE   │ ← Cannot log in
                             └─────────────┘
```

### Rules
- **ACTIVE:** Can authenticate and access resources per role
- **INVITED:** Must complete activation before any access
- **SUSPENDED:** All sessions invalidated, cannot log in
- **LOCKED:** Temporary, auto-clears after lockout duration
- **INACTIVE:** Permanent deactivation, historical records preserved
- **Physical deletion is NEVER used** for users with financial activity
