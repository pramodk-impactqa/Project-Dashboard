# Security Documentation — IQA Finance Operations Portal

> **Disclaimer:** This document describes implemented security controls based on OWASP Top 10, OWASP ASVS 5.0, and secure coding principles. This application is **NOT** claimed to be "OWASP certified" or "100% secure." A full security assessment including penetration testing, infrastructure review, and compliance validation is **required** before production deployment.

---

## Architecture Overview

```
┌─────────────────┐        HTTPS (prod)    ┌──────────────────────┐       ┌──────────┐
│  React SPA       │ ←── HttpOnly Cookie ──→│  Express.js Backend  │ ←──→ │  SQLite   │
│  (Frontend)      │     (Secure, SameSite) │                      │       │ Database  │
│                  │                         │  ┌────────────────┐  │       └──────────┘
│  No auth tokens  │                         │  │ Auth Middleware │  │
│  No secrets      │                         │  │ RBAC Middleware │  │
│  No localStorage │                         │  │ Rate Limiter   │  │
│  for auth/data   │                         │  │ Input Validator│  │
│                  │                         │  │ Audit Logger   │  │
└─────────────────┘                         │  │ Session Manager│  │
                                            │  │ Security Headers│  │
                                            │  │ Error Handler  │  │
                                            │  └────────────────┘  │
                                            └──────────────────────┘
```

### Security Middleware Stack (order matters)
1. **Request ID** — Unique correlation ID per request
2. **Helmet** — Security headers (CSP, HSTS, X-Content-Type-Options, etc.)
3. **CORS** — Explicit allowed origins, no wildcards
4. **Cookie Parser** — Parse cookies for session management
5. **Body Parser** — JSON with 1MB size limit
6. **Cache Control** — No-store, no-cache for all API responses
7. **Global Rate Limiter** — 200 req/15 min per IP
8. **Session Middleware** — SQLite-backed server-managed sessions
9. **Content-Type Validation** — Require JSON for mutations
10. **Route Middleware** — Auth → RBAC → Validation → Handler

---

## OWASP Top 10 (2021) Mapping

| # | OWASP Category | Status | Controls Implemented |
|---|---|---|---|
| A01 | Broken Access Control | ✅ Implemented | RBAC with 30+ permissions, backend-enforced middleware, IDOR protection, session-based auth |
| A02 | Cryptographic Failures | ✅ Implemented | Argon2id password hashing (64MB/3 iter), SHA-256 for tokens, secure session IDs, no plaintext secrets |
| A03 | Injection | ✅ Implemented | Parameterized SQL (better-sqlite3 prepared statements), Zod input validation, no string concatenation in queries |
| A04 | Insecure Design | ✅ Implemented | Defense in depth, least privilege, secure-by-default, server-side enforcement |
| A05 | Security Misconfiguration | ✅ Implemented | Helmet headers, strict CORS, CSP, no debug in prod, env-based config, X-Powered-By hidden |
| A06 | Vulnerable Components | ⚠️ Partial | Dependencies use latest versions; `npm audit` recommended regularly; no known vulnerabilities scanning automated yet |
| A07 | Auth Failures | ✅ Implemented | Argon2id, account lockout, rate limiting, MFA (TOTP), secure session management, reauthentication |
| A08 | Software/Data Integrity | ⚠️ Partial | Input validation via Zod; CSP prevents inline scripts; SRI for CDN resources recommended |
| A09 | Logging & Monitoring | ✅ Implemented | Immutable audit log, separate security events, structured logging, sensitive data redaction |
| A10 | SSRF | ✅ N/A | No server-side URL fetching implemented |

## OWASP ASVS 5.0 Mapping

| ASVS Area | Status | Details |
|---|---|---|
| V2: Authentication | ✅ | Argon2id (64MB, 3 iter, 4 parallel), account lockout, progressive rate limiting, TOTP MFA, password reset with hashed tokens |
| V3: Session Management | ✅ | Server-managed SQLite sessions, HttpOnly+Secure+SameSite cookies, idle timeout (30min), absolute lifetime (8hr), session fixation protection |
| V4: Access Control | ✅ | RBAC with 6 roles, 30+ permissions, backend middleware enforcement, privilege escalation prevention, self-suspension blocked |
| V5: Input Validation | ✅ | Zod schemas on all mutations, enum allowlists, string length limits, date format validation, numeric range checks |
| V6: Cryptography | ✅ | Argon2id for passwords, crypto.randomBytes for tokens, crypto.randomUUID for IDs, SHA-256 for token hashing |
| V7: Error Handling | ✅ | Generic user-facing errors, detailed server-side logs, no stack traces/schema/file paths exposed, JSON parse errors caught |
| V8: Data Protection | ✅ | Sensitive fields (password_hash, mfa_secret, recovery codes) never in API responses, no-store cache headers, sensitive data redaction in audit |
| V9: Communication | ⚠️ | HTTPS required in production, HSTS configured; development uses HTTP (documented) |
| V10: Business Logic | ✅ | Soft deletion for financial entities, transactional operations (password reset + session invalidation), atomic ID generation |
| V11: Files | ⚠️ | File upload not yet implemented; when added, must validate type/size/filename and store outside web root |
| V12: APIs | ✅ | Auth+RBAC middleware on all endpoints, rate limiting, input validation, CORS policy, Content-Type enforcement, request ID correlation |
| V14: Configuration | ✅ | `.env.example` template, no hardcoded secrets, production config validation, env-based overrides for all security parameters |

---

## Authentication

See [AUTHENTICATION.md](./AUTHENTICATION.md) for complete details.

### Summary
- **Password Hashing:** Argon2id (memory: 64MB, iterations: 3, parallelism: 4)
- **Login Protection:** Rate limiting (10 req/15 min), lockout after 5 failures (15 min)
- **MFA:** TOTP (RFC 6238), 8 hashed recovery codes
- **Sessions:** Server-managed SQLite, HttpOnly cookies, SameSite=Strict
- **Timeouts:** 30 min idle, 8 hr absolute
- **User Enumeration:** Generic error messages on all auth endpoints

## Authorization

See [AUTHORIZATION.md](./AUTHORIZATION.md) for complete details.

### Summary
- **6 Roles:** SUPER_ADMIN, ADMIN, FINANCE, PROJECT_MANAGER, DELIVERY_MANAGER, VIEWER
- **30+ Permissions:** Granular, categorized by module
- **Backend Enforcement:** Middleware on every protected endpoint
- **Frontend:** UI-only permission checks (never trusted for security)
- **Extensibility:** New roles/permissions added via database, no code changes to middleware

---

## Data Protection

### Sensitive Data Classification

| Data | Sensitivity | Protection |
|---|---|---|
| Passwords | CRITICAL | Argon2id hashed, never stored/returned/logged in plaintext |
| MFA secrets | CRITICAL | Stored in DB, returned only during setup, never after |
| Recovery codes | HIGH | SHA-256 hashed, single-use, never shown again after setup |
| Session IDs | HIGH | Cryptographically random, server-side only, HttpOnly cookies |
| Reset tokens | HIGH | SHA-256 hashed, single-use, time-limited (30 min) |
| Invitation tokens | HIGH | SHA-256 hashed, single-use, time-limited (72 hr) |
| Financial data | HIGH | Auth + RBAC required, no-store cache headers |
| Client information | HIGH | Auth + RBAC required |
| Employee data | MEDIUM | Auth + RBAC required, no unnecessary PII |
| Audit logs | MEDIUM | Sensitive values redacted, append-only |

### API Response Filtering
**NEVER returned in API responses:**
- `password_hash`
- `mfa_secret`
- `mfa_recovery`
- `token_hash`
- Internal database fields
- Session identifiers

### Data Minimization
- SSN field removed (not required for finance workflow)
- No full payment card storage
- Minimal PII collection (name, email, employee ID only)

---

## Audit Logging

### Logged Events
| Category | Events |
|---|---|
| **Authentication** | `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT` |
| **Password** | `PASSWORD_CHANGED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED` |
| **MFA** | `MFA_ENABLED`, `MFA_DISABLED`, `MFA_FAILED` |
| **Account** | `ACCOUNT_LOCKED`, `USER_CREATED`, `USER_UPDATED`, `USER_SUSPENDED`, `ROLE_CHANGED` |
| **Projects** | `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_STATUS_CHANGED` |
| **SOWs** | `SOW_CREATED`, `SOW_UPDATED`, `SOW_CANCELLED` |
| **Invoices** | `INVOICE_CREATED`, `INVOICE_UPDATED`, `INVOICE_CANCELLED` |
| **Payments** | `PAYMENT_CREATED`, `PAYMENT_UPDATED` |

### Audit Record Fields
- Event type, actor ID/username, target entity/ID/name
- Previous and new values (with sensitive data redacted)
- Timestamp, IP address, user agent, request correlation ID
- Success/failure indicator

### Security Events (Separate Table)
| Event | Severity |
|---|---|
| `UNAUTHENTICATED_ACCESS` | MEDIUM |
| `AUTHORIZATION_FAILURE` | HIGH |
| `ACCOUNT_LOCKOUT` | HIGH |
| `MFA_FAILED` | MEDIUM |

### Never Logged
Passwords, OTPs, session tokens, API keys, encryption keys, MFA secrets, recovery codes

---

## Security Headers

| Header | Value | Purpose |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; ...` | Prevent XSS, restrict resource loading |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | Clickjacking protection |
| `X-XSS-Protection` | `0` | Disabled (CSP is preferred) |
| `Strict-Transport-Security` | `max-age=31536000` (production) | Force HTTPS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leaks |
| `X-Powered-By` | **Removed** | Prevent technology disclosure |
| `Cache-Control` | `no-store, no-cache, must-revalidate` | Prevent caching of sensitive data |
| `X-Request-ID` | UUID per request | Audit correlation |

---

## Threat Model

### Assets

| Asset | Sensitivity | Description |
|---|---|---|
| User credentials | CRITICAL | Passwords, MFA secrets, recovery codes |
| Admin privileges | CRITICAL | SUPER_ADMIN/ADMIN access |
| Financial data | HIGH | Invoices, payments, SOW values, billing info |
| Client data | HIGH | Client names, addresses, tax IDs |
| Session tokens | HIGH | HttpOnly cookies, session data |
| User accounts | HIGH | Employee information, roles |
| Audit logs | MEDIUM | Historical operation records |

### Threat Actors

| Actor | Motivation | Capability |
|---|---|---|
| External attacker | Data theft, financial fraud | Web-based attacks, credential stuffing |
| Credential-stuffing bot | Account takeover | Automated login attempts with leaked credentials |
| Compromised employee account | Unauthorized access | Valid credentials, limited permissions |
| Malicious insider | Data exfiltration, financial manipulation | Valid credentials, knowledge of system |
| Unauthorized internal user | Access beyond their role | Curiosity, IDOR attempts |

### Threat → Control → Residual Risk Matrix

| Threat | Impact | Likelihood | Controls | Residual Risk |
|---|---|---|---|---|
| **Account takeover** | HIGH | MEDIUM | Argon2id hashing, rate limiting, account lockout, MFA support | LOW (if MFA enabled) |
| **Credential stuffing** | HIGH | HIGH | Rate limiting (10/15min), lockout after 5 failures, common password rejection | LOW |
| **Privilege escalation** | CRITICAL | LOW | RBAC middleware, SUPER_ADMIN-only escalation, session invalidation on role change | LOW |
| **Data exfiltration** | HIGH | MEDIUM | Auth+RBAC on all endpoints, API response filtering, no-store caching | LOW |
| **Invoice manipulation** | HIGH | LOW | Auth+RBAC, input validation, audit logging, only Cancelled from Draft/Sent | LOW |
| **Payment fraud** | HIGH | LOW | Auth+RBAC, Zod validation (amounts ≥ 0), audit logging | LOW |
| **SQL injection** | CRITICAL | LOW | Parameterized queries exclusively, Zod input validation | VERY LOW |
| **XSS** | MEDIUM | LOW | React auto-escaping, CSP headers, no dangerouslySetInnerHTML | LOW |
| **CSRF** | MEDIUM | LOW | SameSite=Strict cookies, same-origin API | LOW |
| **Session hijacking** | HIGH | LOW | HttpOnly+Secure+SameSite cookies, session rotation, idle timeout | LOW |
| **Session fixation** | HIGH | LOW | Session regeneration after login and MFA | VERY LOW |
| **Brute force** | MEDIUM | HIGH | Rate limiting, account lockout, progressive delay | LOW |
| **IDOR/BOLA** | HIGH | MEDIUM | Backend auth+RBAC on every endpoint, resource-level checks | LOW |
| **Insider threat** | HIGH | LOW | Least privilege RBAC, comprehensive audit logging | MEDIUM |
| **User enumeration** | LOW | MEDIUM | Generic error messages on all auth endpoints | VERY LOW |
| **Information disclosure** | MEDIUM | LOW | No stack traces, no DB schema, no server version, generic errors | LOW |
| **File upload attack** | MEDIUM | N/A | Not implemented; when added, must validate type/size/name | N/A |

---

## Security Tests

### Test Suite (84 automated tests)
Run: `npx tsx server/tests/security.test.ts`

| Category | Tests | Coverage |
|---|---|---|
| Authentication | 12 | Login, logout, enumeration protection, password hash hiding, MFA secret hiding, forgot password, reset token |
| Authorization (RBAC) | 12 | Unauthenticated access (9 endpoints), unauthorized mutations, role restrictions, self-suspension |
| Input Validation | 11 | SQL injection, XSS, enum validation, negative amounts, oversized strings, date formats, email formats |
| Session Management | 6 | No cookie, invalid cookie, HttpOnly, SameSite, Path, safe fields only |
| IDOR/BOLA | 6 | Non-existent projects, users, SOWs, invoices, user suspension |
| Security Headers | 7 | CSP, X-Content-Type-Options, X-Frame-Options, Cache-Control, X-Powered-By hidden, CSP script restriction |
| Financial Data | 7 | Unauthenticated access (4 endpoints), non-existent entity creation, cache headers |
| Password Policy | 5 | Short password, common password, missing character classes, wrong current password, URL exclusion |
| Error Handling | 5 | Invalid JSON, wrong Content-Type, no stack traces, no DB schema, 404 for unknown routes |
| Audit Logging | 4 | Login events recorded, project events recorded, no sensitive data in logs, security events endpoint |
| CORS & API Security | 3 | No wildcard origins, request ID in responses, body size limit |
| Concurrency | 1 | Concurrent project creation → unique IDs (atomic SQLite transactions) |

---

## Production Deployment Checklist

### Critical (Must Do)
- [ ] Set `NODE_ENV=production`
- [ ] Set `SESSION_SECRET` to a random string ≥ 32 characters
- [ ] Set `SESSION_SECURE_COOKIE=true` (requires HTTPS)
- [ ] Enable HTTPS/TLS (reverse proxy or Node.js TLS)
- [ ] **Change initial admin and finance passwords immediately**
- [ ] Configure `CORS_ORIGINS` to production domain only
- [ ] Run `npm audit` and resolve all high/critical vulnerabilities
- [ ] Review and set production-appropriate rate limits

### Recommended
- [ ] Enable MFA for all SUPER_ADMIN and ADMIN accounts
- [ ] Set up database backup schedule
- [ ] Configure log rotation and centralized log aggregation
- [ ] Set up monitoring/alerting for security events (ACCOUNT_LOCKOUT, AUTHORIZATION_FAILURE)
- [ ] Run penetration testing by qualified security team
- [ ] Review Content-Security-Policy for production assets
- [ ] Consider switching from SQLite to PostgreSQL for production scale
- [ ] Set up intrusion detection system (IDS)
- [ ] Document and test incident response procedures

### Verified ✅
- [x] Passwords hashed with Argon2id (never plaintext)
- [x] No credentials in logs
- [x] MFA supported (TOTP)
- [x] Login rate limiting (server-enforced)
- [x] Account lockout after failed attempts
- [x] Secure password reset (hashed tokens, single-use, time-limited)
- [x] Secure invitation flow (hashed tokens, single-use, time-limited)
- [x] Server-managed sessions (SQLite store)
- [x] HttpOnly cookies
- [x] Appropriate SameSite policy (Strict)
- [x] Session rotation after authentication
- [x] Session expiration (idle + absolute)
- [x] Logout invalidates session
- [x] Reauthentication for sensitive operations
- [x] RBAC implemented (6 roles, 30+ permissions)
- [x] Backend authorization enforced on every endpoint
- [x] IDOR/BOLA protection
- [x] Input validation (Zod schemas)
- [x] SQL injection protection (parameterized queries)
- [x] XSS protection (React escaping + CSP)
- [x] CSRF protection (SameSite cookies)
- [x] Secure CORS (explicit origins)
- [x] Security headers (Helmet)
- [x] Secrets externalized (.env)
- [x] No secrets in Git (.gitignore)
- [x] Audit logging (immutable, append-only)
- [x] Security event logging
- [x] No sensitive data in logs (redaction)
- [x] Error messages do not expose internals
- [x] Rate limiting on sensitive endpoints
- [x] Unique financial IDs protected against race conditions (SQLite transactions)
- [x] Automated security tests (84 tests)
- [x] `force_password_change` flag on seed users

---

## Items Requiring External Review

1. **Penetration Testing** — Full application pentest by qualified security team
2. **Infrastructure Security** — Server hardening, network segmentation, firewall rules
3. **Compliance Validation** — SOC 2, ISO 27001, or applicable regulatory framework
4. **Dependency Audit** — Deep analysis of all npm packages for known vulnerabilities
5. **Key Management** — Production encryption key storage and rotation strategy
6. **Disaster Recovery** — Database backup, recovery testing, business continuity plan
7. **Incident Response** — Security incident handling playbook and escalation procedures
8. **CSP Refinement** — Review `'unsafe-inline'` for styles (required by Tailwind CSS)
9. **Rate Limiting at Scale** — If deploying multi-server, use Redis-backed rate limiter
10. **File Upload Security** — When file uploads are added, requires separate security review
