# PharmaOS — Production Configuration & Secrets (Phase 4)

**Date:** 2026-09-25
**Objective:** Separate environments, audit every variable, ship a safe `.env.example`, and make the app **fail fast** when production configuration is unsafe — without ever printing secret values.
**Result:** ✅ Production **fail-fast validation** added (verified live — server refuses to start on unsafe config, exit 1). Demo **seed guarded** against production. `.env.example` corrected & completed. **11/11** config-safety assertions PASS; no regression (integrity 5/5, `tsc` clean).

---

## 1. Environments

| Env | How it's set | Behaviour |
|---|---|---|
| development | `NODE_ENV=development` (default) | verbose Prisma query logs; config safety check is a **no-op**; demo seed allowed |
| test / CI | `NODE_ENV=test` | error-only logs; safety check no-op |
| production | `NODE_ENV=production` (set in `docker-compose.yml`) | error-only logs; **safety check enforced (fail-fast)**; demo seed **refused** |

Config is centralized and type-validated at load in `apps/api/src/config/index.ts` (zod) — invalid/missing types already `process.exit(1)`. Phase 4 adds a **production hardening** layer on top.

---

## 2. Production fail-fast validation (new)

`checkProductionConfig(config)` (`config/index.ts`) runs at server startup (`server.ts`, before DB connect). In production it **refuses to start** on any of:

| Check | Rule |
|---|---|
| JWT secret strength | `JWT_SECRET` ≥ 32 chars, not a placeholder |
| JWT secret placeholders | `JWT_SECRET` / `JWT_REFRESH_SECRET` must not match `change-me / placeholder / example / your- / generate-a / xxxx` |
| Distinct secrets | `JWT_SECRET` ≠ `JWT_REFRESH_SECRET` |
| CORS wildcard | `CORS_ORIGIN` must not contain `*` |
| CORS localhost | `CORS_ORIGIN` must not point at `localhost` / `127.0.0.1` |
| DB placeholder | `DATABASE_URL` must not contain `USER:PASSWORD` |
| DB weak password | `DATABASE_URL` must not use `postgres/password/admin/root/changeme/123456` |

**Warnings (non-fatal, logged):** `CORS_ORIGIN` on `http://` (should be https); SMTP not fully configured (emails fall back to console). SMTP is a warning, not a hard error, because the mailer has a safe console fallback and email is not on the core pharmacy critical path.

**Never leaks secrets:** issue messages describe the problem only — no secret value is ever logged. Startup logs (`server.ts`) print only `PORT`, `NODE_ENV`, and the JWT *expiry duration* — never a secret.

**Live proof** (spawned with unsafe prod env):
```
❌ config: JWT_SECRET looks like a placeholder — set a real random secret
❌ config: JWT_REFRESH_SECRET looks like a placeholder — set a real random secret
❌ config: CORS_ORIGIN must not be "*" in production
❌ config: DATABASE_URL uses a weak/default database password
Refusing to start with unsafe production configuration. Fix the above and restart.
(exit 1)
```

---

## 3. Seed safety (new)

`prisma/seed.ts` creates **demo data with known credentials** (`admin@divyacare.test` / `Divya@Care2026`). It now refuses to run when `NODE_ENV=production` unless `ALLOW_PROD_SEED=true` is explicitly set:
```
❌ Refusing to seed: NODE_ENV=production. This seed creates DEMO data with known credentials.
   If you really intend to seed production, set ALLOW_PROD_SEED=true. (You almost never want this.)
(exit 1)
```
This prevents the most common way demo credentials leak into a real deployment.

---

## 4. `.env.example` audit & fixes

- **Fixed mismatch:** `.env.example` set `MAX_FILE_SIZE=5242880`, but the app reads **`MAX_FILE_SIZE_MB`** (MB) — corrected to `MAX_FILE_SIZE_MB=10`. (Previously the example set a variable the app ignored, and the real one was undocumented.)
- **Added:** `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` (optional platform-operator bootstrap, commented) and an `ALLOW_PROD_SEED` note.
- **Verified safe:** only placeholders, no real secrets; JWT secret-generation commands included (PowerShell + openssl); `CORS_ORIGIN` example is an https domain; `DATABASE_URL` uses the `USER:PASSWORD` placeholder (which production validation now rejects, forcing a real value).
- **Verified no secrets in the repo:** `.env` is git-ignored; only `.env.example` (placeholders) is tracked.

**Note on email `FROM`:** the mailer reads `EMAIL_FROM` (documented in `.env.example`); the config schema also defines an unused `SMTP_FROM` default — harmless, flagged for a future cleanup.

---

## 5. Debug / verbose-output posture (verified, no change needed)

- **Errors:** the global error handler returns **generic** messages in all environments; stack traces go only to the server logger, never to clients (verified Phase 0). No debug mode is exposed.
- **DB query logging:** `['query', ...]` only in development; production logs `['error']` only (`config/database.ts`).
- **Tokens, not cookies:** auth uses `Authorization: Bearer` tokens (no server-set cookies), so cookie security flags do not apply; CORS uses an explicit allow-list (no wildcard in production).

---

## 6. Verification

**Suite:** `apps/api/scripts/config-safety.test.ts` · **Run:** `pnpm --filter @pharmaos/api test:config` · **Log:** `Testing/Phase 2 Testing/config-safety-run.log`.

| Assertion | Result |
|---|---|
| Well-formed production config passes (0 errors) | **PASS** |
| Non-production is a no-op (even with junk) | **PASS** |
| Weak/short JWT secret flagged | **PASS** |
| Placeholder JWT secret flagged | **PASS** |
| Duplicate JWT secrets flagged | **PASS** |
| Wildcard CORS flagged | **PASS** |
| Localhost CORS flagged | **PASS** |
| `USER:PASSWORD` DB placeholder flagged | **PASS** |
| Weak DB password flagged | **PASS** |
| `http://` CORS → warning (not error) | **PASS** |
| Seed refuses in production (spawned, exit 1) | **PASS** |
| **Total** | **11/11 PASS** |

Plus: **live server fail-fast** confirmed (§2), **integrity suite 5/5** (no regression), **`tsc --noEmit` exit 0**, dev server starts clean (validator no-op).

---

## 7. Pre-deploy checklist (ops)

1. Copy `apps/api/.env.example` → `.env.production`; fill real values.
2. Generate two **distinct** strong secrets: `openssl rand -base64 48` (or the PowerShell one-liner in the file) for `JWT_SECRET` and `JWT_REFRESH_SECRET`.
3. Set a strong `DB_PASSWORD` (compose injects it into `DATABASE_URL`); avoid `postgres/admin/root`.
4. Set `CORS_ORIGIN` to your real **https** pharmacy domain(s), comma-separated — no `*`, no localhost.
5. Set SMTP creds if email delivery is required (otherwise emails log to console — a startup warning will remind you).
6. Leave `NODE_ENV=production` (compose sets it). Do **not** set `ALLOW_PROD_SEED`.
7. Start the stack — if any secret/CORS/DB value is unsafe, the API refuses to boot and prints exactly what to fix.

---

## 8. Status

| Item | Status |
|---|---|
| Environment separation (dev/test/prod) | **PASS** |
| Every env var audited | **PASS** (§4) |
| `.env.example` safe placeholders only | **PASS** |
| Strong secrets enforced in prod | **PASS** |
| Wildcard/localhost CORS blocked | **PASS** |
| Weak/default DB password blocked | **PASS** |
| Demo credentials blocked in prod (seed guard) | **PASS** |
| Debug mode / verbose errors in prod | **PASS** (none exposed) |
| Fail-fast on missing/unsafe prod config | **PASS** (live proof) |
| Secrets never printed in logs | **PASS** |

*No request-path logic changed in Phase 4 — additions are startup validation + a seed guard + doc/config fixes. Phase 4 complete. Awaiting approval before Phase 5 (Docker & Production Deployment).*
