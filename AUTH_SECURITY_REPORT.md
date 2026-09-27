# PharmaOS — Authentication & Authorization Hardening Report (Phase 2)

**Date:** 2026-09-25
**Objective:** Harden the full authentication lifecycle and authorization model, and prove each control with direct API testing. No PASS without evidence.
**Result:** ✅ **14/14 auth-lifecycle assertions PASS** + **32/32 cross-tenant assertions still PASS** (no regression). Three root-cause fixes landed with **no database migration** (reused the existing `user_sessions` table).

---

## 1. Lifecycle audited (login → logout → JWT → refresh → password → lockout → RBAC)

| Control | Before Phase 2 | After |
|---|---|---|
| Login / lockout / OTP reset / bcrypt / auth rate-limit | Working (Phase 0 verified) | Unchanged, re-verified |
| Wrong-tenant access | Fixed in Phase 1 | Re-verified (32/32) |
| **Access token after logout** | **Stayed valid ≤15 min** (only refresh revoked) | **Invalid immediately** |
| **Disabled / deleted user** | Checked only at login; existing access token kept working | **Denied on every request** |
| **Password change / reset** | Revoked refresh token only | **All access tokens invalidated** |
| **Role-permission assignment** | Any `users:edit` holder could grant **any** permission incl. `*:*` | **Bounded to permissions the actor holds** |
| **Tenant creation** | Gated by tenant-level `settings:edit` (any pharmacy admin) | **Gated behind `platform:manage` — fails closed** |

---

## 2. Fixes (root-cause, with file references)

### 2.1 Server-side session validation on the access token (P1-03 + disabled/deleted)
`authenticate` previously accepted any correctly-signed, unexpired JWT. It now performs a per-request check (`middleware/authenticate.ts`):
```
verify signature → look up user_sessions by token.sessionId
  → deny if session missing/inactive        (logout, password change, disable)
  → deny if user.deletedAt                    (deleted user)
  → deny if user.status !== 'active'          (inactive/suspended/locked)
```
Wiring (no migration — the token’s `sessionId` **is** the `user_sessions.id`):
- `login` / `refresh` create an active session row keyed by `sessionId` (`auth.service.ts`).
- `logout` deactivates the session (existing `updateMany` — now enforced).
- `changePassword`, `resetPassword`, admin `resetUserPassword`, and `toggleUserStatus`(→inactive) deactivate the user’s sessions + revoke refresh tokens (`auth.service.ts`, `user.service.ts`).

**Cost:** one indexed PK lookup per authenticated request. **Deploy note:** existing access tokens issued before deploy have no matching session → users re-login once (expected for a security change).

### 2.2 Bounded role-permission assignment (P1-10 — privilege escalation)
`createRole`/`updateRole` now call `assertGrantablePermissions(permissionIds, actorPermissions)` (`user.service.ts`): every `permissionId` must resolve to a real permission (else 422), and the actor must already hold each `module:action` (via exact, `module:*`, or `*:*`) — else **403**. The actor’s permissions are passed from the route (`roles.routes.ts`, `req.user!.permissions`). A `users:edit` holder can no longer mint a role carrying `settings:edit` or `*:*`.

### 2.3 Platform-admin gate for tenant creation (P0-02)
`POST /api/tenants` moved from `requirePermission('settings','edit')` to `requirePermission('platform','manage')` (`tenant.routes.ts`). No seeded role holds `platform:manage`, so the route **fails closed (403)** for all current users — including a full-catalog admin. Real provisioning (owner + roles + settings + audit) is Phase 8; until then only a deliberately-provisioned operator can reach it.

*No schema/migration changes. No business logic weakened. No secrets exposed (error handler still returns generic messages; verified in Phase 0).*

---

## 3. Verification — direct API tests

**Suite:** `apps/api/scripts/auth-security.test.ts` · **Run:** `pnpm --filter @pharmaos/api test:auth` · **Log:** `Testing/Phase 2 Testing/auth-security-run.log`.
Seeds one synthetic tenant with users at three privilege levels (full admin; `medicines:view`-only; user-manager without `settings:edit`) and drives the live API. Synthetic data only; self-cleaning.

### 3.1 Results — 2026-09-25 (14/14 PASS, exit 0)

| # | Assertion | Expected | Actual |
|---|---|---|---|
| 1 | authenticated + valid permission | 200 | **200** |
| 2 | authenticated + missing permission | 403 | **403** |
| 3 | no token | 401 | **401** |
| 4 | invalid token | 401 | **401** |
| 5 | expired token (valid signature, past exp) | 401 | **401** |
| 6 | valid signature + unknown/forged session | 401 | **401** |
| 7 | disabled user (token issued while active) | 200→403 | **200→403** |
| 8 | deleted user | 200→401 | **200→401** |
| 9 | logout invalidates access token | 200→401 | **200→401** |
| 10 | password change invalidates tokens | change 200, token 200→401 | **200 / 200→401** |
| 11 | privilege escalation (grant unheld perm) | 403 + no role created | **403, role not created** |
| 12 | platform gate (admin creates tenant) | 403 | **403** |
| 13 | refresh issues a working token | refresh 200 + usable | **200 / 200** |
| 14 | account lockout (repeated failed logins) | denied (423 lock / 429 rate-limit) | **423, lockedUntil set, failedAttempts=5** |

### 3.2 Verification matrix (mandated statements)

| Statement | Result | Evidence |
|---|---|---|
| authenticated user + valid permission = allowed | **PASS** | #1 |
| authenticated user + missing permission = denied | **PASS** | #2 |
| expired token = denied | **PASS** | #5 |
| invalid token = denied | **PASS** | #4 |
| disabled user = denied | **PASS** | #7 |
| deleted user = denied | **PASS** | #8 |
| wrong tenant = denied | **PASS** | Phase 1 suite, 32/32 (re-run below) |

### 3.3 Regression — cross-tenant isolation unaffected
`pnpm --filter @pharmaos/api test:security` re-run after the `authenticate` change → **32/32 PASS, exit 0**. Session validation did not weaken or break tenant isolation.

### 3.4 Other regression
- **API typecheck** `tsc --noEmit` → **exit 0**.
- **Demo login** (`admin@divyapharmacy.com`) → 200; `/api/auth/me` with the fresh token → 200 (session wiring healthy).

---

## 4. Status

| Item | Status | Evidence |
|---|---|---|
| Logout invalidates access token | **PASS** | #9 |
| Disabled user denied | **PASS** | #7 |
| Deleted user denied | **PASS** | #8 |
| Password change/reset invalidates tokens | **PASS** | #10 |
| Expired/invalid/forged token denied | **PASS** | #4,#5,#6 |
| Missing permission denied | **PASS** | #2 |
| Privilege escalation prevented (P1-10) | **PASS** | #11 |
| Tenant creation not a tenant-admin action (P0-02) | **PASS** | #12 |
| Brute-force lockout + rate-limit | **PASS** | #14 |
| Refresh rotation works | **PASS** | #13 |
| Cross-tenant isolation preserved | **PASS** | 32/32 |
| No secret/stack-trace exposure | **PASS** | Phase 0 (error handler) |

---

## 5. Known limitations / follow-ups (not silently ignored)

1. **Session store is a DB table (`user_sessions`)** checked on every request. Fine at pilot scale; if request volume grows, cache session validity (e.g., short-TTL in-memory/Redis) to avoid a per-request DB hit. **Follow-up (perf, Phase 10).**
2. **Logout is global (all devices)** for password/reset/disable events, and current per-session for `logout`. This is intentional (safer). If per-device logout on password change is later desired, scope by `sessionId`.
3. **`platform:manage`** is a fail-closed gate, not yet a full platform-admin role/console. Proper platform provisioning + audited super-admin lifecycle is **Phase 8** (P0-03).
4. **OTP/password-reset lookup** still resolves the user by unscoped email (carried from Phase 1 follow-up) — low risk, same-inbox owner. **Follow-up (P1).**
5. **Deploy impact:** all pre-existing access tokens are invalidated on deploy (no matching session) — users re-login once.

*No source outside the auth/authz scope was modified. Phase 2 complete. Awaiting approval before Phase 3 (Database & Data Integrity — the `Float`→`Decimal` money migration).*
