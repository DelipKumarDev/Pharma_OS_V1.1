# PharmaOS — Production Readiness Baseline (Phase 0)

**Date:** 2026-09-25
**Scope:** Read-only audit of the codebase *exactly as it exists*. No code was changed in Phase 0.
**Method:** Direct inspection of source (auth, middleware, services, Prisma schema, migrations, Docker, Nginx, CI, seed, tests, docs) with file:line evidence. Where a claim could not be proven by reading the code, it is marked **NOT VERIFIED**.

> **Headline:** The core architecture is **sound and correctly shaped for multi-tenant SaaS** — tenant identity is JWT-bound (never client-selected per request), controllers pass `tenantId` from the token only, and risky by-id writes are guarded by tenant-ownership checks. The blockers are **not** in the request-path isolation model; they are in **(a) login-time tenant resolution, (b) platform/super-admin separation & real tenant provisioning, (c) money precision, (d) automated test coverage, and (e) operational backup/CI maturity.** None require a rewrite.

---

## 1. Architecture (as-built)

| Layer | Technology | Location |
|---|---|---|
| Frontend | Next.js 15 App Router, TS, Tailwind, shadcn/ui, TanStack Query/Table, Zustand | `apps/web` |
| API | Express 4, Prisma, Zod, helmet, cors, compression, express-rate-limit | `apps/api` |
| DB | PostgreSQL 15 | `docker-compose.yml` → `db` |
| Auth | JWT (HS256) access 15m / refresh 7d, bcrypt(12), OTP reset | `apps/api/src/modules/auth`, `utils/jwt.ts` |
| AuthZ | RBAC via `module:action` permission strings on the JWT | `middleware/authenticate.ts` |
| Multi-tenancy | App-layer: `tenantId` from JWT, per-query scoping | all modules |
| Reverse proxy | Nginx 1.27 (TLS termination, HTTP→HTTPS) | `nginx/nginx.conf` |
| Containers | Multi-stage Dockerfiles, `docker-compose` (db/api/web/nginx) | `apps/*/Dockerfile`, `docker-compose.yml` |
| CI | GitHub Actions — **Playwright example only** | `.github/workflows/playwright.yml` |

**27 Prisma models**, **13 migrations** (`prisma/migrations`), **26 API modules** (`apps/api/src/modules`).

---

## 2. What is genuinely working (verified by reading the code)

- **Tenant is JWT-bound, not client-selected per request.** `authenticate` sets `req.user` from the verified token; controllers derive tenant via `req.user!.tenantId` only (e.g. `inventory.controller.ts:7`). No route trusts a body/param `tenantId`. ✅
- **By-id writes are tenant-guarded.** Update/delete/status paths first call `findFirst({ where:{ id, tenantId } })` (or `getVendorById/getCustomerById(tenantId,id)`) and 404 if not owned, e.g. `inventory.service.ts:323, 337`, `vendor.service.ts:83,89`, `customer.service.ts:117,150`. ✅ *(completeness must still be proven route-by-route in Phase 1)*
- **Every module router applies `authenticate`.** A scan of all `*.routes.ts` found no unprotected router; only `auth.routes` exposes public endpoints (login/refresh/otp), by design. ✅
- **Error handler never leaks internals.** Stack traces go to the logger only; clients get generic messages; Zod→422, Prisma P2002→409, P2025→404, unknown→500 (`middleware/errorHandler.ts`). ✅
- **Rate limiting is well-designed.** Global `/api` limiter + `authLimiter` on `/login` with `skipSuccessfulRequests` (failed logins only) + per-account lockout after 5 fails / 15 min (`auth.service.ts:26,88`). ✅
- **Password & reset hygiene.** bcrypt(12), strong password regex, OTP reset invalidates old codes + revokes refresh tokens in a transaction (`auth.service.ts:408`), email-enumeration-safe forgot-password. ✅
- **Config fails fast** on invalid env (zod `safeParse` → `process.exit(1)`), JWT secrets enforced ≥32 chars (`config/index.ts`). ✅
- **Graceful shutdown** (SIGTERM/SIGINT close server → disconnect DB) (`server.ts`). ✅
- **Ops stack shape is correct:** Postgres named-volume persistence + healthcheck, API/web expose **no** host ports (only Nginx 80/443), `${DB_PASSWORD:?}` / `${JWT_SECRET:?}` fail-if-unset, TLS 1.2/1.3, HSTS, X-Frame-Options DENY, nosniff, backup volume. ✅
- **Backup endpoint works** (`POST /api/settings/backup`) — `pg_dump` with automatic tenant-scoped JSON fallback; **exercised live 2026-09-25**, wrote a real snapshot. ✅ *(manual trigger only — see P1-05)*

---

## 3. Production blockers & risks (classified)

### 🔴 P0 — Blocks production / blocks safe multi-tenant onboarding

**P0-01 — Login tenant resolution is ambiguous across tenants.**
`login()` resolves the user with `prisma.user.findFirst({ where: { email, deletedAt: null } })` — **no tenant scoping** (`auth.service.ts:63`). But `User.email` is unique only **per tenant** (`schema.prisma:513 @@unique([tenantId, email])`) — the schema explicitly permits the same email in two tenants. With one pharmacy this never surfaces. The moment a **second** pharmacy has a user with a colliding email (a shared gmail, or a generic `admin@…`), Prisma returns an arbitrary match → the legitimate user is either locked out (wrong record, password fails) or, if passwords happened to match, **authenticated into the wrong tenant**. The stated objective explicitly includes "second production pharmacy" and "multiple independent tenants," so this is a go-live blocker.
*Risk class:* Tenant isolation / auth correctness. *Fix (Phase 1):* disambiguate login by tenant (subdomain/slug/tenant code) and scope the lookup to `{ tenantId, email }`; keep a safe fallback for the single-tenant case.

**P0-02 — No platform/super-admin separation; tenant creation is exposed to tenant admins.**
`POST /api/tenants` (create a new pharmacy tenant) is gated only behind `requirePermission('settings','edit')` — a **regular Pharma-Admin** permission (`tenant.routes.ts`, create handler). The code comment concedes: *"Until a dedicated platform-admin role exists, it is gated behind settings:edit."* So **any pharmacy admin can create arbitrary tenants.** `SUPER_ADMIN_EMAIL/PASSWORD` exist in `config/index.ts:20-21` but are **referenced nowhere else** (dead config) — there is no platform-operator identity, login, or role.
*Risk class:* Authorization / privilege boundary. *Fix (Phase 8, gate in Phase 1/2):* introduce a platform-admin boundary; move tenant CRUD behind it; remove from tenant-scoped `settings:edit`.

**P0-03 — No real tenant provisioning workflow.**
`POST /api/tenants` creates only the `Tenant` row. It bootstraps **no owner/admin user, no default roles, no permissions, no default settings, and writes no audit record.** Onboarding a real pharmacy today requires the `seed.ts` script or manual DB work. This directly blocks the objective ("safely onboard real pharmacies," "first/second/multiple pharmacies").
*Risk class:* Onboarding / operability. *Fix (Phase 8):* idempotent provisioning transaction — Tenant → Owner (forced password change) → default Roles/Permissions → default Settings → Audit → invitation.

**P0-04 — CONFIRMED cross-tenant IDOR writes (tenant guard missing on specific routes).**
A full mutation sweep (`grep` for `.update/.delete` without `tenantId`, then reading each handler) found **three route handlers that mutate by a client-supplied `:id` with no tenant-ownership check**:
- `notification.routes.ts:52` — `PATCH /api/notifications/:id/read` → `prisma.notification.update({ where:{ id: req.params.id } })`. Tenant A can mark Tenant B's notification read.
- `reorder.routes.ts:83` — `PATCH /api/reorder/alerts/:id/acknowledge` → `reorderAlert.update({ where:{ id: req.params.id } })`. Cross-tenant write.
- `reorder.routes.ts:104` — `PATCH /api/reorder/:id` → `reorderItem.update({ where:{ id: req.params.id }, data:{ ...req.body } })`. **Cross-tenant write *and* mass-assignment** — the entire request body is spread into the update, so a caller can also set unintended columns.
This directly violates the mandate's rule *"Never allow Tenant A to access Tenant B data."* The other modules audited (delivery, roles, purchase-order, transfer, settings, medicine, billing, returns, vendor, customer, inventory) **do** guard correctly (`findFirst({ id, tenantId })` → 404, or ids derived inside a tenant-scoped transaction). So the pattern is *usually* right but not *universally* applied — a per-route sweep with tests is mandatory.
*Risk class:* Tenant isolation (IDOR/BOLA). *Fix (Phase 1):* add the ownership guard to these three handlers; replace `data:{...req.body}` with a whitelisted field set; add automated IDOR tests covering every by-id route.

### 🟠 P1 — Must fix before broad onboarding

**P1-01 — Money stored as `Float` throughout the schema.**
Every monetary field is `Float`: `mrp`, `purchasePrice`, `sellingPrice`, `subtotal`, `discountAmount`, `taxAmount`, `totalAmount`, `paidAmount`, `balanceAmount`, `creditBalance`, `gstAmount`, `refundAmount`, vendor `pendingAmount`, etc. (`schema.prisma:632-634,741-747,780-785,813,879-884,914-919,1026-1027,…`). Floating-point currency accumulates rounding error; over many bills/returns/credit movements, **GST totals, customer credit balances and vendor balances will drift by paise and fail reconciliation.** Code compensates with `.toFixed(2)` in places but the stored/aggregated type is still `Float`.
*Risk class:* Data integrity / financial correctness. *Fix (Phase 3):* migrate to `Decimal @db.Decimal(12,2)` + a money helper for arithmetic. **Substantial, money-touching migration — must be done with a data-safety review and regression tests; do not rush.**

**P1-02 — No automated test suite.**
Only `tests/example.spec.ts` (Playwright starter) exists; **no** API unit/integration tests, **no** cross-tenant/IDOR tests, **no** auth regression tests. The prior "~200 tests" were manual/curl, not committed. The go-live gate mandates automated cross-tenant + critical-security tests.
*Risk class:* Verification. *Fix (Phase 1/2/11):* add a cross-tenant isolation suite (Tenant A ↔ Tenant B for every resource), auth/authz regression tests, and per-fix regression tests going forward.

**P1-03 — Access tokens are not revocable on logout.**
`verifyAccessToken` only checks the JWT signature/expiry; the embedded `sessionId` is **never** validated against `UserSession.isActive` (`jwt.ts:31`, `authenticate.ts:18`). `logout` revokes the refresh token and marks the session inactive but the **access token stays valid up to its 15-min TTL.** Disabled/deleted users likewise keep access until expiry.
*Risk class:* Session security. *Fix (Phase 2):* check session/user status on `authenticate` (cheap cached lookup) or shorten access TTL + document the trade-off.

**P1-04 — Per-route tenant-guard completeness (mostly PASS; exceptions promoted to P0-04).**
The full mutation sweep is now done: the guard pattern holds across the large majority of modules, with the three confirmed exceptions promoted to **P0-04**. Remaining unread surface (`scan`, `schedule-register`, `reports` read-only aggregations) still needs a final read + the automated IDOR suite (P1-02) as durable proof.
*Risk class:* Tenant isolation. *Fix (Phase 1):* finish the sweep + IDOR tests.

**P1-10 — Unbounded role-permission assignment → privilege escalation.**
`updateRole`/`createRole` (`user.service.ts:228,270`) accept an arbitrary `permissionIds[]` and attach them verbatim (`rolePermission.createMany`) with **no check that the caller may grant those permissions**. A user holding only `users:edit` can mint/modify a role carrying any permission — including `*:*` — and assign it, escalating privileges beyond their own grant. `isSystem` roles are protected, but custom roles are not bounded.
*Risk class:* Authorization / privilege escalation. *Fix (Phase 2):* restrict assignable permissions to a subset the actor holds (or to platform-defined role templates); validate `permissionIds` against the permission table.

**P1-05 — No automated/operational backup.**
Backup is a **manual** `POST /api/settings/backup`. The only scheduled job is `alerts.job.ts` (daily stock/expiry email). There is **no** scheduled `pg_dump`, **no** encryption, **no** retention policy, **no** off-site copy, and **no** restore test. `autoBackup` (tenant flag) and the `/backups` volume exist but nothing drives them.
*Risk class:* Recoverability. *Fix (Phase 6):* scheduled encrypted backups + retention + a proven restore drill (create→populate→destroy→restore→verify).

**P1-06 — Config validation does not enforce production hardening.**
`config/index.ts` validates types/lengths but does not, in production, reject: default/weak secrets, `NODE_ENV !== production`, localhost/wildcard `CORS_ORIGIN`, or unset SMTP when email is required. No guard prevents `seed.ts` from running against a production DB, and `seed.ts` has **no `NODE_ENV` check** — it creates the demo tenant `tnt_001` / `admin@divyapharmacy.com` with a known password (`prisma/seed.ts`).
*Risk class:* Secrets / config safety. *Fix (Phase 4):* production fail-fast assertions + a seed guard.

**P1-07 — Documentation misrepresents the product.**
`README.md` describes a *"production-grade, frontend-first pharmacy management SaaS built with Next.js 15, TurboRepo, and MSW,"* and its architecture block lists **only `apps/web`** — the entire Express/Prisma/Postgres backend is omitted. This is the "frontend-only / mock API" claim the mandate says to remove.
*Risk class:* Documentation. *Fix (final cleanup):* rewrite README/architecture to the real full-stack system.

**P1-08 — No real CI/CD pipeline.**
Only `.github/workflows/playwright.yml` (runs the example spec). No lint/typecheck/build/unit/integration/security stages, no staging→prod flow, no branch-protection-as-code, no tagging/rollback procedure.
*Risk class:* Release management. *Fix (Phase 12).*

**P1-09 — Container & health-probe hardening gaps.**
API `Dockerfile` runs as **root** (no `USER node`); no `HEALTHCHECK` in either Dockerfile; `docker-compose` has a healthcheck only for `db`, not api/web. `/health` returns `ok` **without** checking DB connectivity — there is no real readiness probe.
*Risk class:* Deployment / observability. *Fix (Phase 5/7).*

### 🟡 P2 — Should fix after initial go-live

- **P2-01** MSW mock layer still ships in `apps/web/src/mock/` (auth/billing/inventory handlers, started in `providers.tsx`). Disabled in the prod image via `NEXT_PUBLIC_USE_REAL_API=true`, but present — a misconfigured flag would silently serve mock data. Exclude/remove from prod builds.
- **P2-02** Nginx missing `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`; no gzip/brotli at the proxy (Express `compression()` covers API responses only).
- **P2-03** Alert scheduler uses `setInterval` (drifts / resets on restart) rather than a real cron; a restart near the run window can skip or double-run.
- **P2-04** Dead `tenantId` field in `loginSchema` (`auth.schema.ts:6`) — accepted but ignored; remove to prevent confusion.
- **P2-05** Request correlation: `requestLogger` + `X-Request-ID` (CORS-allowed) exist but structured request-id propagation into error logs is **NOT VERIFIED**; confirm in Phase 7.
- **P2-06** No dependency-vulnerability scanning (`pnpm audit` / Dependabot) in CI.
- **P2-07** Mass-assignment: several updates spread the raw request body into Prisma — `reorder.routes.ts:104` (`data:{...req.body}`), `tenant.routes.ts:64` (`data:req.body`), `customer.service.ts:119` / `vendor.service.ts:85` (`...input`). Even where tenant-guarded, callers can set unintended columns; whitelist updatable fields per resource.

### 🔵 P3 — Future enhancement

- **P3-01** PostgreSQL Row-Level Security as defense-in-depth beneath the app-layer isolation (careful Prisma integration required).
- **P3-02** Offline functionality — out of scope unless required; if partially present, document honestly (**NOT VERIFIED** in Phase 0).
- **P3-03** Observability: metrics/APM, centralized log aggregation, alerting on backup/auth-failure spikes.

---

## 4. Phase-gate readiness snapshot (pre-work)

| Go-live gate item | Baseline status |
|---|---|
| Tenant isolation (request path) | **PARTIAL** — model correct, but 3 confirmed IDOR write holes (P0-04) |
| Cross-tenant security tests | **FAIL** — none exist (P1-02) |
| Login tenant resolution | **FAIL** — ambiguous across tenants (P0-01) |
| Platform/super-admin separation | **FAIL** — none (P0-02) |
| Tenant provisioning workflow | **FAIL** — creates row only (P0-03) |
| Auth security (login/lockout/reset/rate-limit) | **PASS** (verified) — except access-token revocation (P1-03) |
| Authorization (RBAC) | **PASS** (verified) — except tenant-create gating (P0-02) |
| Database integrity | **PARTIAL** — schema/FKs good; money as `Float` (P1-01) |
| Production config / secrets | **PARTIAL** — fail-fast on types; no prod hardening/seed guard (P1-06) |
| HTTPS / Nginx | **PASS** (TLS, redirect, HSTS) — headers to extend (P2-02) |
| Docker deployment | **PARTIAL** — works; root user, no healthchecks (P1-09) |
| Postgres persistence | **PASS** (named volume + healthcheck) |
| Backup | **PARTIAL** — manual endpoint works; no schedule/encryption/off-site (P1-05) |
| Restore test | **NOT VERIFIED** — never performed (Phase 6) |
| Monitoring / readiness | **PARTIAL** — logs + `/health`; no DB readiness (P1-09) |
| Error handling | **PASS** (no leakage, clean 4xx/5xx) |
| Pilot E2E | **NOT VERIFIED** as a provisioned-tenant flow (Phase 9) |
| CI/CD | **FAIL** — example only (P1-08) |
| Rollback | **NOT VERIFIED** — undocumented/untested (Phase 12) |
| Docs updated | **FAIL** — README stale (P1-07) |
| No unresolved P0 | **FAIL** — P0-01/02/03 open |

**Overall: NOT GO-LIVE READY.** 4 × P0 and 10 × P1 open. The good news: the isolation *model* is correct, so the P0s are targeted fixes (login disambiguation, platform-admin boundary, provisioning transaction, 3 IDOR guards), not architectural rework.

---

## 5. Recommended remediation order

1. **Phase 1 — Tenant security & isolation:** fix P0-01 (login disambiguation), complete the route-by-route tenant-guard audit (P1-04), and land the first automated cross-tenant/IDOR suite (P1-02). *Highest priority.*
2. **Phase 2 — Auth/authz hardening:** P0-02 platform-admin boundary + P1-03 session revocation, with regression tests.
3. **Phase 3 — Database & data integrity:** P1-01 `Float`→`Decimal` money migration (carefully, with a data-safety review) + transaction/concurrency tests for stock & balances.
4. **Phase 4 — Config & secrets:** P1-06 production fail-fast + seed guard.
5. **Phase 5–7 — Docker/backup/monitoring:** P1-09, P1-05, readiness probe, structured logging.
6. **Phase 8–9 — Provisioning & pilot:** P0-03 provisioning workflow, then a full provisioned-tenant E2E.
7. **Phase 10–13 — Performance, security testing, CI/CD, certification review.**
8. **Docs cleanup** (P1-07) alongside the phases that change each area.

---

---

## 6. Phase 0 structured summary (requested outputs)

### 6.1 Confirmed P0 blockers
| ID | Blocker | Evidence |
|---|---|---|
| P0-01 | Login resolves user by **unscoped** email while email is unique only per-tenant → 2nd-tenant auth ambiguity / mis-routing | `auth.service.ts:63` vs `schema.prisma:513` |
| P0-02 | No platform/super-admin; `POST /api/tenants` gated by tenant-level `settings:edit` → any tenant admin can create tenants; `SUPER_ADMIN_*` config unused | `tenant.routes.ts` (create), `config/index.ts:20-21` |
| P0-03 | Tenant creation bootstraps only the row (no owner/roles/settings/audit) → no real provisioning | `tenant.routes.ts` create handler |
| P0-04 | **Confirmed cross-tenant IDOR writes** on 3 routes (no ownership guard); one also mass-assigns body | `notification.routes.ts:52`, `reorder.routes.ts:83`, `reorder.routes.ts:104` |

### 6.2 Confirmed P1 gaps
| ID | Gap | Evidence |
|---|---|---|
| P1-01 | Money stored as `Float` across all financial fields → rounding/reconciliation drift | `schema.prisma:632-634,741-747,780-785,813,879-884,914-919,…` |
| P1-02 | No automated tests (unit/integration/cross-tenant/auth) | only `tests/example.spec.ts` |
| P1-03 | Access token not revocable on logout (sessionId never verified) | `jwt.ts:31`, `authenticate.ts:18`, `auth.service.ts:203` |
| P1-04 | Route-guard sweep mostly PASS; `scan`/`schedule-register`/`reports` final read + IDOR tests outstanding | sweep output |
| P1-05 | Backup is manual-only; no schedule/encryption/retention/off-site/restore-test | `settings.routes.ts` `/backup`, only job = `alerts.job.ts` |
| P1-06 | Config lacks production hardening; `seed.ts` has no `NODE_ENV` guard (demo creds) | `config/index.ts`, `prisma/seed.ts` |
| P1-07 | README describes a frontend-only MSW app; omits backend | `README.md:3-16` |
| P1-08 | No real CI/CD (only Playwright example); no lint/typecheck/build/test/security/deploy stages | `.github/workflows/playwright.yml` |
| P1-09 | API container runs as root; no Dockerfile/compose healthchecks for api/web; `/health` skips DB (no readiness) | `apps/api/Dockerfile`, `docker-compose.yml`, `app.ts:68` |
| P1-10 | Unbounded role-permission assignment → privilege escalation | `user.service.ts:228,270` |

### 6.3 Confirmed P2 gaps
| ID | Gap | Evidence |
|---|---|---|
| P2-01 | MSW mock layer still in web codebase (flag-disabled in prod build) | `apps/web/src/mock/*`, `providers.tsx` |
| P2-02 | Nginx missing CSP/Referrer-Policy/Permissions-Policy; no proxy gzip/brotli | `nginx/nginx.conf` |
| P2-03 | Alert scheduler uses `setInterval` (drifts/resets on restart), not cron | `alerts.job.ts:112` |
| P2-04 | Dead `tenantId` field in `loginSchema` (accepted, ignored) | `auth.schema.ts:6` |
| P2-05 | Request-id correlation into error logs — **NOT VERIFIED** | `requestLogger.ts` |
| P2-06 | No dependency-vulnerability scan in CI | — |
| P2-07 | Mass-assignment via `{...req.body}` / `data:req.body` in several updates | `reorder.routes.ts:104`, `tenant.routes.ts:64`, `customer.service.ts:119`, `vendor.service.ts:85` |

### 6.4 Already-working production capabilities (verified)
- JWT-bound tenant context; controllers use `req.user.tenantId` only (no client tenant selection per request).
- Tenant-ownership guards on by-id writes across the large majority of modules (inventory, vendor, customer, medicine, returns, billing, delivery, roles, purchase-order, transfer).
- All module routers require `authenticate`; only `auth` exposes public endpoints.
- Error handler leaks no stack traces; clean 4xx/5xx mapping (Zod 422, Prisma 409/404).
- Auth hardening: bcrypt(12), strong-password policy, OTP reset (transactional, revokes tokens), failed-login lockout (5/15min), `authLimiter` (failed-only) on `/login`.
- Config fail-fast on invalid env; JWT secrets ≥32 chars enforced.
- Graceful shutdown (SIGTERM/SIGINT).
- Docker/Nginx: Postgres named-volume + healthcheck; API/web expose no host ports; TLS 1.2/1.3 + HTTP→HTTPS + HSTS + X-Frame-Options + nosniff; fail-if-unset secrets in compose.
- Backup endpoint functional (`pg_dump` + JSON fallback), exercised live.

### 6.5 Files/modules requiring modification (by phase)
| Area | Files |
|---|---|
| **P0-01 login** | `apps/api/src/modules/auth/auth.service.ts`, `auth.schema.ts`, `auth.controller.ts`; `apps/web` login page (add tenant identifier) |
| **P0-02/03 platform-admin + provisioning** | `apps/api/src/modules/tenant/tenant.routes.ts` (+ new `tenant.service.ts`), `middleware/authenticate.ts` (platform-admin guard), `prisma/schema.prisma` (platform-admin flag/role), `prisma/seed.ts` |
| **P0-04 IDOR guards** | `apps/api/src/modules/notification/notification.routes.ts`, `apps/api/src/modules/reorder/reorder.routes.ts` |
| **P1-01 money** | `prisma/schema.prisma` (Float→Decimal) + new migration; all services doing money math (`billing`, `returns`, `customer`, `vendor`, `reports`, `day-close`, `purchase-order`) |
| **P1-03 session revocation** | `middleware/authenticate.ts`, `utils/jwt.ts`, `auth.service.ts` |
| **P1-06 config/seed** | `apps/api/src/config/index.ts`, `prisma/seed.ts` |
| **P1-09 container/health** | `apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker-compose.yml`, `apps/api/src/app.ts` (readiness endpoint) |
| **P1-10 role perms** | `apps/api/src/modules/user/user.service.ts` |
| **P2-02 headers** | `nginx/nginx.conf` |
| **Docs** | `README.md`, `DEPLOYMENT.md`, `GO-LIVE-CHECKLIST.md` |

### 6.6 Tests currently available
- `tests/example.spec.ts` — Playwright starter (not product coverage).
- `playwright.config.ts` + `.github/workflows/playwright.yml` — harness wired, runs the example only.
- `postman/PharmaOS.postman_collection.json` + `…environment.json` — manual API collection (not automated in CI).
- `qa/PHASE-01..12-*.md` + `QA-Pilot-Readiness-2026-07-31.md` — **manual** QA docs/results from July 2026 (evidence, not executable tests).
- **No** `*.test.ts` / `*.spec.ts` unit or integration tests in `apps/api` or `apps/web`.

### 6.7 Tests missing (required by the go-live gate)
1. **Cross-tenant/IDOR suite** — for every by-id route, Tenant A token vs Tenant B resource → expect 403/404 (must catch P0-04 regressions).
2. **Auth/authz regression** — expired/malformed/invalid-signature token, disabled/deleted user, insufficient permission, privilege-escalation (P1-10), brute-force/lockout, rate-limit.
3. **Tenant login resolution** (P0-01) — colliding emails across tenants resolve correctly.
4. **Data-integrity/transaction** — atomic billing/returns/stock; concurrent billing (no negative stock); money precision after Float→Decimal (P1-01).
5. **Provisioning idempotency** (P0-03) — duplicate tenant/owner creation is safe.
6. **Backup/restore drill** (P1-05) — create→populate→destroy→restore→verify.
7. **E2E pharmacy pilot** (Phase 9) — provisioned-tenant full workflow.

### 6.8 Exact recommended implementation order
1. **Phase 1 — Tenant security & isolation (highest):** patch **P0-04** IDOR guards (fast, high-value) → fix **P0-01** login disambiguation → finish route-guard sweep (`scan`/`schedule-register`/`reports`) → build the **cross-tenant/IDOR + auth regression** test suites (P1-02) as durable proof. Deliver `TENANT_SECURITY_REPORT.md`.
2. **Phase 2 — Auth/authz hardening:** **P0-02** platform-admin boundary (move tenant CRUD off `settings:edit`) + **P1-03** session revocation + **P1-10** bounded role permissions, each with regression tests. Deliver `AUTH_SECURITY_REPORT.md`.
3. **Phase 3 — Database & data integrity:** **P1-01** `Float`→`Decimal(12,2)` migration with data-safety review + transaction/concurrency tests. Deliver `DATABASE_PRODUCTION_REPORT.md`.
4. **Phase 4 — Config & secrets:** **P1-06** production fail-fast + seed guard + `.env.example` review. Deliver `PRODUCTION_CONFIGURATION.md`.
5. **Phase 5 — Docker/deploy:** **P1-09** non-root, healthchecks, readiness; clean-env deploy. Deliver `PRODUCTION_DEPLOYMENT_RUNBOOK.md`.
6. **Phase 6 — Backup & DR:** **P1-05** scheduled encrypted backups + retention + **restore drill**. Deliver `BACKUP_AND_DISASTER_RECOVERY.md`.
7. **Phase 7 — Observability:** structured logs + request-id + readiness/health. Deliver `PRODUCTION_MONITORING.md`.
8. **Phase 8 — Onboarding:** **P0-03** idempotent provisioning workflow + admin lifecycle. Deliver `CUSTOMER_ONBOARDING_RUNBOOK.md`.
9. **Phase 9 — E2E pilot** (`Divya Care Pharmacy`, synthetic). Deliver `PHARMAOS_PILOT_EXECUTION_REPORT.md`.
10. **Phase 10–13 — Performance → Security testing → CI/CD → Certification review.** Docs cleanup (**P1-07**) folded into each area it touches.

*Rationale:* P0-04 first (small patches that close live tenant-boundary holes), then P0-01 (unblocks 2nd-tenant onboarding), then the platform-admin/provisioning P0s that make onboarding real, then data-integrity, then ops. Tests land in the same phase as each fix so nothing is marked PASS without evidence.

---

*End of Phase 0 baseline. No source was modified. Awaiting approval to proceed to Phase 1.*
