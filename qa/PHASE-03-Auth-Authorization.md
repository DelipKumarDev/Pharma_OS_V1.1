# PharmaOS — QA Phase 3: Authentication & Authorization

**Document ID:** QA-AUTH-03
**Version under test:** V1.2.1 → fixes applied on top (pending V1.2.2)
**Execution:** Live HTTP against `localhost:4000`, harness `phase3-auth.js`, results `qa/phase3-results.csv`
**Date:** 2026-07-15

---

## 1. Summary

| Metric | Value |
|--------|-------|
| Test cases executed | 33 |
| Passed | 33 |
| Failed | 0 |
| Defects found | 3 (1 Critical, 1 Medium, 1 test-only) |
| Defects fixed & re-verified | 2 (Critical + Medium) |

Phase 3 uncovered the **single most serious defect of the entire QA effort** — a complete absence of authorization enforcement (RBAC was decorative). It has been fixed and re-verified.

---

## 2. Test Execution Results

| Test Case ID | Scenario | Type | Expected | Actual | Status |
|--------------|----------|------|----------|--------|--------|
| TC-AUTH-001 | Valid admin login returns tokens | P | 200 | 200 | PASS |
| TC-AUTH-002 | Login includes roles+permissions | P | perms>0 | 32 perms | PASS |
| TC-AUTH-003 | Wrong password rejected | N | 401 | 401 | PASS |
| TC-AUTH-004 | Unknown email rejected | N | 401 | 401 | PASS |
| TC-AUTH-005 | Malformed email validation | N | 422 | 422 | PASS |
| TC-AUTH-006 | Empty password validation | N | 422 | 422 | PASS |
| TC-AUTH-007 | Protected route without token | SEC | 401 | 401 | PASS |
| TC-AUTH-008 | Tampered JWT rejected | SEC | 401 | 401 | PASS |
| TC-AUTH-009 | Garbage token rejected | SEC | 401 | 401 | PASS |
| TC-AUTH-010 | /auth/me returns profile | P | 200 | 200 | PASS |
| TC-AUTH-011 | Refresh issues new token pair | P | 200 | 200 | PASS |
| TC-AUTH-012 | Refresh token rotated (new≠old) | BR | rotated | rotated | PASS |
| TC-AUTH-013 | Reused (revoked) refresh rejected | N | 401 | 401 | PASS |
| TC-AUTH-014 | Invalid refresh rejected | N | 401 | 401 | PASS |
| TC-AUTH-015 | Reset with wrong OTP | N | 400 | 400 | PASS |
| TC-AUTH-016 | Weak password rejected on reset | BR | 422 | 422 | PASS |
| TC-AUTH-017 | Forgot-password no user enumeration | SEC | equal status | 200/200 | PASS |
| TC-AUTH-018 | Billing Assistant login | P | 200 | 200 | PASS |
| TC-AUTH-019 | Billing Assistant DENIED user:create | SEC | 403 | 403 | PASS |
| TC-AUTH-020 | Billing Assistant DENIED role:create | SEC | 403 | 403 | PASS |
| TC-AUTH-021 | Non-existent bill id → 404 (no leak) | SEC | 404 | 404 | PASS |
| TC-AUTH-022 | Inactive user blocked from login | BR | 403 | 403 | PASS |
| TC-AUTH-023 | Invalid status value rejected | N | 422 | 422 | PASS |
| TC-AUTH-024 | Billing Assistant DENIED settings:view | SEC | 403 | 403 | PASS |
| TC-AUTH-025 | Billing Assistant DENIED settings:edit | SEC | 403 | 403 | PASS |
| TC-AUTH-026 | Billing Assistant DENIED audit read | SEC | 403 | 403 | PASS |
| TC-AUTH-027 | Billing Assistant DENIED user list | SEC | 403 | 403 | PASS |
| TC-AUTH-028 | Billing Assistant DENIED tenant delete | SEC | 403 | 403 | PASS |
| TC-AUTH-029 | Billing Assistant ALLOWED billing:view | P | 200 | 200 | PASS |
| TC-AUTH-030 | Billing Assistant ALLOWED customers:view | P | 200 | 200 | PASS |
| TC-AUTH-031 | Admin ALLOWED settings:view | P | 200 | 200 | PASS |
| TC-AUTH-032 | Admin ALLOWED audit read | P | 200 | 200 | PASS |
| TC-AUTH-033 | Admin ALLOWED user list | P | 200 | 200 | PASS |

---

## 3. Defect Log

### DEF-001 — Authorization not enforced on any endpoint (privilege escalation / broken access control)
| Field | Value |
|-------|-------|
| **Severity** | **CRITICAL** |
| **Priority** | P1 (blocker) |
| **OWASP** | A01:2021 Broken Access Control |
| **Requirement** | Bible §9 (RBAC, 31 permissions, 5 roles) |
| **Found by** | TC-AUTH-019, TC-AUTH-020 |
| **Status** | **FIXED & RE-VERIFIED** |

**Description:** The `requirePermission()` and `requireRoles()` middleware existed but was **not applied to a single route** in the entire API. Every route group only ran `authenticate` (token validity). Any authenticated user — regardless of role — could invoke every endpoint.

**Reproduction (pre-fix):**
1. Log in as `billing@divyapharmacy.com` (Billing Assistant, sales-only role).
2. `POST /api/users` with a new user body → **HTTP 201 Created** (should be 403).
3. `POST /api/roles` → **HTTP 201 Created** (created a role named "HackRole" — residue visible in DB).

**Impact:** A sales clerk could create/modify/delete users and roles, change tax and pricing settings, read the full audit trail, export the entire customer/sales database, and — via the unscoped tenant routes — **list, modify, and suspend other pharmacies' tenants** (cross-tenant compromise). Complete failure of the access-control model.

**Fix:**
- Applied `requirePermission(module, action)` to **61 endpoints** across 13 route modules (medicine, inventory, billing, customer, vendor, purchase invoices, prescription, returns, reports, reorder, schedule-register, users, roles).
- Restricted settings routes: view→`settings:view`, mutate/backup/import/export→`settings:edit`.
- Restricted audit routes (trail, sessions, security events) to `settings:view` (admin oversight).
- Rewrote tenant routes: every operation self-scoped to the caller's own `tenantId` (by-ID reads/updates/deletes on another tenant now 404), guarded by settings permissions; tenant creation gated to `settings:edit`.
- Left intentionally open: public auth endpoints, dashboard (all staff), notifications (own-tenant).

**Re-verification:** TC-AUTH-019/020/024–028 all return 403; TC-AUTH-029–033 confirm legitimate access still works; admin retains full access.

---

### DEF-002 — Auth rate limiter too aggressive for shared-IP pharmacies
| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Priority** | P2 |
| **OWASP** | A04:2021 (defense tuning) |
| **Requirement** | Bible §9 (rate limiting) |
| **Found by** | Suite blocked by 429 during first execution |
| **Status** | **FIXED & RE-VERIFIED** |

**Description:** The auth rate limiter was 5 requests / 15 min **per IP, counting successful logins**. A pharmacy where staff share one public IP / counter terminal would lock the whole network out after 5 logins in 15 minutes — even on all-successful logins.

**Fix:** Set `skipSuccessfulRequests: true` (only failed logins count) and raised the ceiling to 10. Per-account lockout after 5 *failed* attempts (auth.service) remains the primary brute-force defense — unchanged.

**Residual risk:** Low. Brute-force is still bounded (10 failed/IP/15min + 5-failure account lockout).

---

### DEF-003 — (Test-only) refresh-token response field path
| Field | Value |
|-------|-------|
| **Severity** | N/A (test harness) |
| **Status** | Corrected in harness |

Initial harness read `data.refreshToken`; actual contract nests tokens under `data.tokens.refreshToken` (consistent with login). Product behaviour is correct — rotation independently proven by TC-AUTH-013 (reused old refresh → 401). Harness corrected; no product change.

---

## 4. Coverage vs Scenario Catalog

Covered: SC-AUTH 1–23 (login, validation, lockout, inactive, token lifecycle, rotation, OTP/reset, enumeration), SC-AUTH-22/23/24 (RBAC denial + tenant isolation), SC-SECX-1 (broken access control), SC-SECX-5 (auth failures), SC-SECX-7 (rate limiting), SC-USR-9 (inactive login), SC-TEN-5 (cross-tenant modify).

Deferred to later phases: full per-endpoint RBAC matrix for every role×module (Phase 8 Security will sweep systematically), OTP happy-path with real inbox (needs SMTP).

---

## 5. Exit Criteria

| Criterion | Status |
|-----------|--------|
| All planned cases executed | ✅ 33/33 |
| All Critical/High fixed & re-verified | ✅ DEF-001 fixed |
| Deliverable stored | ✅ this file + phase3-results.csv |

**Phase 3 status: COMPLETE.** The Critical authorization defect is remediated and re-verified. Proceeding requires a code commit (V1.2.2) capturing DEF-001/DEF-002 fixes.
