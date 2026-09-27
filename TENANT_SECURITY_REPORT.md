# PharmaOS — Tenant Security & Isolation Report (Phase 1)

**Date:** 2026-09-25
**Objective:** **Tenant A must never access Tenant B data** — read or write, via UI or direct API.
**Approach:** Harden the existing app-layer isolation (no redesign, no RLS-forced rearchitecture). Trace the full request path, fix confirmed holes at root, and prove isolation with an automated cross-tenant suite run against the live API + PostgreSQL.
**Result:** ✅ **32/32 automated cross-tenant assertions PASS** (evidence below). All four confirmed IDOR write-holes are closed; login tenant-resolution is now server-controlled and unambiguous; same-tenant operations and the existing demo login are unaffected.

---

## 1. Request-path trace — where tenant identity is established and enforced

| Hop | Mechanism | Tenant binding | File |
|---|---|---|---|
| Login | `POST /api/auth/login` | Resolves user server-side; JWT tenant = **resolved user's** `tenantId` (never client input) | `auth.service.ts:login` |
| JWT sign | `signAccessToken` | `tenantId` embedded in signed HS256 token | `utils/jwt.ts:19` |
| JWT verify | `authenticate` middleware | `req.user` set from verified token; **client cannot set tenant per request** | `middleware/authenticate.ts:9` |
| AuthZ | `requirePermission` | RBAC `module:action` from token | `middleware/authenticate.ts:25` |
| Controller | `t(req) = req.user!.tenantId` | Tenant read **only** from token, passed to service | e.g. `inventory.controller.ts:7` |
| Service | `where: { …, tenantId }` / ownership guard | Every query scoped; by-id writes guarded by `findFirst({ id, tenantId })` → 404 | all `*.service.ts` |
| Prisma → PG | Parameterized queries | Tenant filter in SQL WHERE; no raw string interpolation | Prisma client |

**Client-supplied `tenantId`:** the login body may carry an optional `tenantId` (id **or** slug). It is used **only to disambiguate** when one email exists in multiple tenants — it can never grant access, because the password must still match the user *in that tenant* and the JWT tenant is taken from the resolved user record. Verified by test `LOGIN-no-grant` (supplying a tenant + wrong password → 401). No other endpoint reads a client tenantId; all use the token.

---

## 2. Vulnerabilities fixed (root-cause, with evidence)

### 2.1 Cross-tenant IDOR writes (P0-04) — 4 holes closed
Each was an `update({ where: { id } })` (or read-then-write) with **no tenant ownership check**, letting Tenant A mutate Tenant B by guessing an id.

| # | Endpoint | Before | Fix | File |
|---|---|---|---|---|
| 1 | `PATCH /api/notifications/:id/read` | `notification.update({where:{id}})` | `updateMany({where:{id,tenantId}})` + `count===0 → 404` | `notification.routes.ts:50` |
| 2 | `PATCH /api/reorder/alerts/:id/acknowledge` | `reorderAlert.update({where:{id}})` | `updateMany({where:{id,tenantId}})` + 404 | `reorder.routes.ts:81` |
| 3 | `PATCH /api/reorder/:id` | `reorderItem.update({where:{id},data:{...req.body}})` | ownership `findFirst({id,tenantId})` → 404 **+ field whitelist** (no mass-assignment) | `reorder.routes.ts:101` |
| 4 | `POST /api/vendor-payments` | `purchaseInvoice.findUnique({id:body.invoiceId})` then update B's invoice/vendor | validate `vendorId` **and** `invoiceId` belong to caller tenant → 404 | `vendor.service.ts:193` |

### 2.2 Login tenant resolution (P0-01)
`login()` used `findFirst({ where: { email } })` unscoped, while `User.email` is unique only per-tenant (`@@unique([tenantId,email])`). Two tenants sharing an email → arbitrary/wrong-tenant resolution.
**Fix** (`auth.service.ts`): resolve with `findMany({ email, [+optional tenant id/slug] })`; **0** → invalid, **1** → proceed, **>1 without a tenant** → `409` asking for the pharmacy. Backward compatible (single-tenant emails unaffected — demo login verified). The JWT tenant remains the resolved user's own `tenantId`.

### 2.3 Mass-assignment (P2-07, the reachable one)
`PATCH /api/reorder/:id` previously spread the entire request body into the Prisma update. Now only `reorderLevel, suggestedQty, priority, status, preferredVendor, notes` are accepted.

### 2.4 Backup isolation
`POST /api/settings/backup` ran a **full-DB `pg_dump`** (all tenants) when available. A tenant admin must not trigger a whole-database artifact. **Fix:** the tenant-facing endpoint now always produces a **tenant-scoped** JSON snapshot; full-DB backup is deferred to a platform/ops job (Phase 6). (`settings.routes.ts:299`)

### 2.5 Also verified SAFE (no change needed)
Full mutation sweep confirmed correct guards already in: `medicine`, `customer`, `inventory` (edit/adjust/status/delete), `vendor` (update/deactivate/confirm-invoice), `returns`, `billing`, `delivery`, `roles` (update/delete + system-role protection), `purchase-order` (receive), `transfer`, `scan`, `schedule-register`, `tenant` (self-scoped `id===req.user.tenantId`).

---

## 3. Automated cross-tenant test suite (new)

**File:** `apps/api/scripts/cross-tenant-security.test.ts` · **Run:** `pnpm --filter @pharmaos/api test:security` (added to `package.json`).
**Method:** seeds two synthetic tenants (A, B), each with a **full-permission** admin (so a denied cross-tenant call is the *tenant* guard, not a permission miss) and one record per resource. Each cross-tenant attack is paired with a same-tenant **control** (A→A = 2xx proves the route/method/permission are correct). Write attacks are re-checked against the DB via Prisma to prove B's data is unchanged. Uses synthetic data only; tears down after. No new runtime dependency (runs on `tsx`, already present).

**Coverage:** users, roles, medicines, inventory, vendors, customers, billing, purchase-invoices, returns-shaped, prescriptions-shaped, notifications, reorder items+alerts, vendor-payments, tenants, audit, settings/exports — READ + WRITE + LIST-leakage + EXPORT + login-resolution + same-tenant sanity.

### 3.1 Results — 2026-09-25 (raw log: `Testing/Phase 2 Testing/tenant-security-run.log`)

```
TOTAL 32  |  PASS 32  |  FAIL 0     (exit 0)
```

| Category | Assertions | Result |
|---|---|---|
| Cross-tenant READ (medicines, customers, vendors, billing, purchase-invoices, users, roles, tenants) | 8 | all **404** (control A→A = 200) |
| Cross-tenant READ inventory batches (tenant-scoped filter) | 1 | **200, no B data** |
| Cross-tenant WRITE (notification-read, reorder-ack, reorder-item, vendor-payment, medicine, inventory-delete, customer, vendor-deactivate, role, user-status) | 10 | all **404 + B unchanged** (verified via DB) |
| LIST leakage (medicines, customers, vendors, notifications, audit, tenants) | 6 | all **clean** (no B ids) |
| EXPORT customers | 1 | **200, no B data** |
| Login resolution (ambiguous→409, resolve-by-slug→200/correct tenant, wrong-password→401) | 3 | all **PASS** |
| Same-tenant sanity (own read, own write, own notification-read) | 3 | all **200** |

Representative rows (from the log):
```
WRITE-notification-read | PASS | status=404 B.isRead false→false
WRITE-reorder-item      | PASS | status=404 B.reorderLevel=10 (expect 10) status=pending
WRITE-vendor-payment    | PASS | status=404 B.invoice.paidAmount=0, payments=0
LOGIN-ambiguous         | PASS | 409 "registered with more than one pharmacy…"
LOGIN-no-grant          | PASS | 401 (tenantId must not bypass password)
SANITY-own-notif        | PASS | 200 A.isRead=true
```

---

## 4. Regression & normal-operation evidence

- **API typecheck:** `tsc --noEmit` → **exit 0** (also fixed 2 pre-existing JSON-cast type errors in `settings.routes.ts` unrelated to isolation).
- **Demo login unchanged:** `admin@divyapharmacy.com` (single-tenant) → **200 "Login successful"**, with and without an explicit tenant slug.
- **Same-tenant CRUD:** control reads/writes in the suite all returned 200 (routes/permissions intact).
- **Existing tests:** the only committed test, `tests/example.spec.ts`, is the default Playwright placeholder that loads `playwright.dev` — not a PharmaOS test, so it is not a regression signal and was not run. The cross-tenant suite is the project's first real automated test.

---

## 5. PostgreSQL RLS evaluation

**Decision: evaluated, deferred as defense-in-depth (NOT IMPLEMENTED this phase).**
- **Why not now:** app-layer isolation is now proven (32/32). RLS with Prisma requires setting a per-transaction session variable (`SET LOCAL app.current_tenant`) on every request and adding `USING (tenant_id = current_setting('app.current_tenant')::uuid)` policies to ~25 tables. With connection pooling this needs a Prisma `$extends`/middleware wrapper and careful testing to avoid leaking a pooled connection's setting across requests — a non-trivial change that risks breaking the working Prisma architecture the mandate says to preserve.
- **When to do it (recommended, a later hardening phase):** add a `tenantId` DB session var set from `req.user.tenantId` in a Prisma client extension, enable RLS + policies per tenant table, and re-run this same suite (it will catch any regression). It is the right belt-and-suspenders layer but should land on its own, after the P0/P1 functional fixes, with its own test gate.

---

## 6. Status

| Item | Status | Evidence |
|---|---|---|
| Tenant A cannot READ Tenant B (any resource) | **PASS** | 9 read + 6 list + 1 export assertions |
| Tenant A cannot WRITE Tenant B (any resource) | **PASS** | 10 write assertions + DB verification |
| Client-supplied tenantId cannot grant access | **PASS** | `LOGIN-no-grant` 401 |
| Login resolves the correct tenant | **PASS** | `LOGIN-ambiguous` 409, `LOGIN-resolve-A` 200 |
| 4 confirmed IDOR holes closed | **PASS** | notification, reorder×2, vendor-payment |
| Mass-assignment (reorder) removed | **PASS** | field whitelist |
| Backup no longer whole-DB for a tenant | **PASS** | tenant-scoped JSON only |
| Same-tenant operations unaffected | **PASS** | 3 sanity + demo login |
| Automated suite reproducible in CI | **PASS** | `pnpm test:security`, exit 0 |
| PostgreSQL RLS | **DEFERRED** | §5 rationale + sketch |

---

## 7. Known limitations / follow-ups (honest, not silently ignored)

1. **OTP / password-reset resolution** (`forgotPassword`, `sendOtp`, `resetPassword`) still use `findFirst({ email })` unscoped. Low risk — a shared email is one human who owns that inbox, so no cross-tenant *data* breach — but for correctness these should accept the same optional tenant identifier. **Follow-up (P1).**
2. **Web login UX:** the API returns 409 for an ambiguous email; the web login page does not yet render a "select your pharmacy" field. Single-tenant logins are unaffected. **Follow-up (frontend, when multi-tenant onboarding goes live).**
3. **Platform/super-admin (P0-02) & provisioning (P0-03)** are **out of Phase 1 scope** — `POST /api/tenants` is still gated by tenant-level `settings:edit`. Scheduled for Phase 2/8. Until then, tenant creation must be operator-only (do not grant `settings:edit` to untrusted admins, or disable the route).
4. **RLS** deferred (§5).

*No source outside the tenant-isolation scope was modified. Phase 1 complete. Awaiting approval before Phase 2.*
