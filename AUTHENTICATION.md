# Authentication Architecture — IQA Finance Operations Portal

> This document describes the authentication implementation based on OWASP Authentication Cheat Sheet, OWASP Password Storage guidance, and OWASP Session Management guidance. External penetration testing is required before production deployment.

---

## Authentication Flow

```
┌──────────┐    POST /auth/login      ┌──────────────┐
│  Client  │ ─────────────────────────→│  Backend     │
│  (React) │    username + password    │  (Express)   │
│          │                           │              │
│          │    ┌─── MFA Enabled? ───→ │  Verify pwd  │
│          │    │                       │  (Argon2id)  │
│          │    │ YES                   │              │
│          │    │    MFA Challenge      │              │
│          │ ←──┼──────────────────────│              │
│          │    │                       │              │
│          │    │  POST /auth/mfa/verify│              │
│          │ ───┼─────────────────────→│  Verify TOTP │
│          │    │                       │              │
│          │    │ NO                    │              │
│          │    │                       │              │
│          │    └─── Set-Cookie ──────→ │  Session     │
│          │ ←─────(HttpOnly,Secure)── │  Created     │
│          │                           │              │
└──────────┘                           └──────────────┘
```

## Password Security

### Hashing Algorithm
- **Algorithm:** Argon2id (OWASP recommended)
- **Memory Cost:** 64 MB (`memoryCost: 65536`)
- **Time Cost:** 3 iterations (`timeCost: 3`)
- **Parallelism:** 4 threads (`parallelism: 4`)
- **Hash Length:** 32 bytes
- **Unique salt:** Automatically generated per password by Argon2

### Password Policy
| Rule | Value |
|---|---|
| Minimum length | 12 characters (configurable via `PASSWORD_MIN_LENGTH`) |
| Maximum length | 128 characters |
| Uppercase required | Yes (A-Z) |
| Lowercase required | Yes (a-z) |
| Digit required | Yes (0-9) |
| Special character required | No (avoids predictable patterns) |
| Common password check | Yes (40+ common passwords rejected) |
| Periodic change forced | No (only after reset/compromise) |
| Passphrases allowed | Yes (long passwords encouraged) |

### What NEVER happens to passwords
- ❌ Stored in plaintext
- ❌ Logged anywhere (server logs, audit log)
- ❌ Sent in URLs or query parameters
- ❌ Returned in API responses
- ❌ Stored in browser localStorage/sessionStorage
- ❌ Included in error messages
- ❌ Hashed with MD5, SHA1, SHA256 alone, or Base64

### Transparent Rehashing
When a user logs in, the system checks if their password hash needs upgrading (e.g., if Argon2 parameters have changed). If so, the hash is transparently upgraded without user intervention.

## Login Protection

### Rate Limiting (Server-Enforced)
| Control | Default | Configurable |
|---|---|---|
| Auth endpoint rate limit | 10 req / 15 min window | `AUTH_RATE_MAX`, `AUTH_RATE_WINDOW_MIN` |
| Login attempts per account | 5 max | `MAX_LOGIN_ATTEMPTS` |
| Lockout duration | 15 minutes | `LOCKOUT_DURATION_MIN` |
| Global API rate limit | 200 req / 15 min window | `RATE_LIMIT_MAX` |
| Sensitive ops rate limit | 5 req / 1 min window | `SENSITIVE_RATE_MAX` |

### Account Lockout
1. After `MAX_LOGIN_ATTEMPTS` (default 5) consecutive failed logins, the account is **temporarily locked**.
2. Lock duration: `LOCKOUT_DURATION_MIN` (default 15 minutes).
3. Lock is automatic and time-based — no permanent lockout from failed attempts alone.
4. Admin can manually unlock via user activation endpoint.
5. Each lockout generates:
   - `ACCOUNT_LOCKED` audit event
   - `ACCOUNT_LOCKOUT` security event (severity: HIGH)

### User Enumeration Protection
| Scenario | Response |
|---|---|
| Invalid username | "Invalid credentials" (generic) |
| Invalid password | "Invalid credentials" (generic) |
| Suspended account | "Invalid credentials" (generic) |
| Locked account | "Account is temporarily locked" |
| Forgot password (non-existent email) | "If the account exists, instructions sent" |

The login endpoint **never reveals** whether a username/email exists.

## Multi-Factor Authentication (MFA)

### Implementation
- **Type:** TOTP (RFC 6238) via `otpauth` library
- **Algorithm:** SHA1 (standard for TOTP)
- **Digits:** 6
- **Period:** 30 seconds
- **Window:** ±1 (accepts previous/next OTP for clock skew)

### MFA Flow
1. User calls `POST /auth/mfa/setup` → receives QR code + secret + recovery codes
2. User scans QR code with authenticator app
3. User verifies with `POST /auth/mfa/enable` + valid TOTP token
4. MFA is now required on every login

### Recovery Codes
- **Count:** 8 single-use codes
- **Storage:** SHA-256 hashed in database
- **Format:** `XXXXX-XXXXX` (hex)
- **Usage:** Each code can only be used once, then removed

### MFA During Login
1. User submits password → password verified
2. Server creates session with `mfaPending: true`
3. Client receives `{ requireMFA: true }`
4. User submits TOTP → `POST /auth/mfa/verify`
5. Session upgraded: `mfaPending: false, mfaVerified: true, role + permissions loaded`

### MFA Bypass Prevention
- No "remember this device" (can be added later)
- No email-based bypass
- No SMS bypass (vulnerable to SIM swapping)
- Recovery codes are the only MFA bypass, and they are single-use
- Admin can reset MFA via `POST /users/:id/reset-mfa` (requires SUPER_ADMIN/ADMIN + reauthentication)

## Session Management

### Architecture
- **Storage:** Server-side SQLite database (NOT localStorage)
- **Session IDs:** Cryptographically random (128-bit via `express-session`)
- **Cookie name:** `sid` (dev) / `__Host-sid` (production with Secure flag)

### Cookie Security Flags
| Flag | Value | Purpose |
|---|---|---|
| HttpOnly | `true` | Prevents JavaScript access (XSS protection) |
| Secure | `true` (production) | HTTPS-only transmission |
| SameSite | `strict` | CSRF protection |
| Path | `/` | Available to all routes |
| MaxAge | 8 hours | Absolute session lifetime |

### Session Timeouts
| Timeout | Default | Purpose |
|---|---|---|
| Idle timeout | 30 minutes | Expires after inactivity |
| Absolute lifetime | 8 hours | Maximum session duration regardless of activity |

Both are configurable via `SESSION_IDLE_TIMEOUT_MIN` and `SESSION_ABSOLUTE_LIFETIME_HR`.

### Session Fixation Protection
Session ID is regenerated:
- ✅ After successful password authentication
- ✅ After successful MFA verification (session upgraded)
- ✅ After password change (new session created)

### Session Invalidation
Sessions are invalidated:
- ✅ On explicit logout (`POST /auth/logout`)
- ✅ On "logout all" (`POST /auth/logout-all`)
- ✅ On idle timeout
- ✅ On absolute lifetime expiry
- ✅ On password change (all other sessions destroyed)
- ✅ On role change (all sessions destroyed)
- ✅ On account suspension (all sessions destroyed)
- ✅ On password reset completion (all sessions destroyed)
- ✅ On MFA disable via admin (all sessions destroyed)

### Session Data
The session stores only:
- `userId` (UUID)
- `role` (string)
- `permissions` (string array)
- `mfaVerified` (boolean)
- `mfaPending` (boolean)
- `createdAt` (timestamp)
- `lastActivity` (timestamp)
- `ipAddress`, `userAgent`

**Never stored in session:** passwords, password hashes, tokens, secrets, PII.

## Logout

### Current Session Logout
`POST /auth/logout`:
1. Server destroys session in SQLite store
2. `Set-Cookie` sent to clear browser cookie
3. Subsequent API calls with old cookie → 401

### All Sessions Logout
`POST /auth/logout-all`:
1. Server finds all sessions for the user in the store
2. All sessions deleted from SQLite
3. User is logged out from every device/browser

## Password Reset

### Flow
1. `POST /auth/forgot-password` with email
2. Server generates cryptographically random 256-bit token
3. Token is SHA-256 hashed before storage (never stored in plaintext)
4. Token has 30-minute expiry (configurable via `RESET_TOKEN_EXPIRY_MIN`)
5. Any existing unused tokens for the user are invalidated
6. Generic response: "If the account exists, instructions sent"
7. User submits `POST /auth/reset-password` with token + new password
8. Token is verified (hash match + not expired + not used)
9. Password is updated, token marked as used
10. All existing sessions are invalidated
11. Audit event generated

### Token Security
- Cryptographically random (256-bit via `crypto.randomBytes`)
- SHA-256 hashed before database storage
- Single-use (marked as `used` after consumption)
- Time-limited (30 minutes default)
- Old tokens invalidated when new reset requested

## Account Invitation / Activation

### Flow
1. Admin creates user via `POST /users` → user status = `INVITED`
2. Secure random invitation token generated (256-bit)
3. Token hashed (SHA-256) before storage, 72-hour expiry
4. User receives invitation (email in production, console log in dev)
5. User submits `POST /auth/activate` with token + new password
6. Password policy enforced
7. Account activated (status → `ACTIVE`), token marked as used
8. User can now log in normally

## Reauthentication

The `requireRecentAuth(maxAgeMs)` middleware enforces reauthentication for sensitive operations:

### Operations Requiring Recent Authentication
- Admin password reset (`POST /users/:id/reset-password`)
- Admin MFA reset (`POST /users/:id/reset-mfa`)
- MFA disable (`POST /auth/mfa/disable`)

If the session was created more than 5 minutes ago, these operations return:
```json
{ "error": "This operation requires reauthentication.", "code": "REAUTH_REQUIRED" }
```

## Environment Configuration

All authentication parameters are configurable via environment variables. See `.env.example` for the complete list.

| Variable | Default | Description |
|---|---|---|
| `SESSION_SECRET` | Auto-generated (dev) | Session signing secret (≥32 chars in production) |
| `SESSION_SECURE_COOKIE` | `false` | Set `true` in production (requires HTTPS) |
| `SESSION_SAMESITE` | `strict` | Cookie SameSite policy |
| `SESSION_IDLE_TIMEOUT_MIN` | `30` | Idle timeout in minutes |
| `SESSION_ABSOLUTE_LIFETIME_HR` | `8` | Max session lifetime in hours |
| `MAX_LOGIN_ATTEMPTS` | `5` | Failed attempts before lockout |
| `LOCKOUT_DURATION_MIN` | `15` | Lockout duration in minutes |
| `PASSWORD_MIN_LENGTH` | `12` | Minimum password length |
| `MFA_ISSUER` | `IQA Finance Portal` | MFA issuer name |
| `RESET_TOKEN_EXPIRY_MIN` | `30` | Password reset token TTL |
| `INVITE_TOKEN_EXPIRY_HR` | `72` | Invitation token TTL |
