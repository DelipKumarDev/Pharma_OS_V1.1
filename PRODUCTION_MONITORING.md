# PharmaOS — Production Monitoring & Observability (Phase 7)

**Date:** 2026-09-26
**Objective:** Structured, correlated logs (no sensitive data), health/readiness probes, and an operational runbook for common failures.
**Result:** ✅ Structured logging with **request-id correlation** implemented and verified; status-based severity (info/warn/error); safe user/tenant context; JSON logs in production for aggregation; liveness + readiness endpoints; failure runbook + health-check commands below.

---

## 1. Logging architecture

- **Library:** winston (`utils/logger.ts`). **Dev:** colorized text that now **renders metadata** (previously dropped). **Production:** **JSON** lines — ready for Loki / ELK / CloudWatch ingestion.
- **Sinks:** stdout (container-captured), `LOG_DIR/error.log` (errors only), `LOG_DIR/combined.log` (all). In Docker, point these at a mounted/observed volume or rely on stdout + a log driver.
- **Level:** `LOG_LEVEL` (default `info`).

## 2. Request correlation (request-id)

`requestLogger` (`middleware/requestLogger.ts`) runs first on every request:
- Uses a client-supplied **`X-Request-ID`** (validated `[\w-]{8,64}`) or generates a UUID.
- Stores it in `res.locals.requestId`, **echoes it in the `X-Request-ID` response header**, and stamps it on the access log **and** the error log — so one id ties a client report → access log → error/stack together.

**Verified:** supplying `X-Request-ID: test-correlation-123` echoed it back and appeared in the log line for that request.

## 3. What is logged

| Event | Where | Level | Fields |
|---|---|---|---|
| Every request (access log) | `requestLogger` on `finish` | **info** (2xx/3xx), **warn** (4xx), **error** (5xx) | `requestId, method, route, status, durationMs, ip, userId?, tenantId?` |
| Unhandled/handled errors | `errorHandler` | error | `requestId, code, stack` (server-side only) |
| Auth failures (bad password, lockout) | `auth.service` audit + access log 401/423 | critical audit / warn | `module:auth, action:login_failed, ip, deviceInfo` |
| Authorization failures (IDOR/permission) | access log 403/404 | warn | `requestId, route, status, userId, tenantId` |
| Startup failure (unsafe config) | `server.ts` + `checkProductionConfig` | error → **exit 1** | which config item (no values) |
| Startup failure (DB unreachable) | `server.ts` connect catch | error → **exit 1** | error message |
| Backup failure | `scripts/backup.sh` non-zero exit | (cron/stderr) | see Phase 6 §8 |

**Verified samples** (dev, structured):
```
[info]  GET  /api/medicines     200 12ms {requestId, method, route, status, durationMs, ip, userId, tenantId}
[warn]  GET  /api/medicines     401 31ms {requestId, route:"/api/medicines", status:401, ip}
[warn]  GET  /api/nonexistent    404  4ms {requestId, route:"/api/nonexistent", status:404}
[info]  POST /api/auth/login     200 533ms {requestId, route:"/api/auth/login"}
```

## 4. What is NOT logged (privacy)

Never logged: request/response **bodies**, the **Authorization** header, **passwords/tokens/OTPs**, cookies, or the **query string** (route is logged path-only). Access logs carry only `userId`/`tenantId` (opaque ids) as context — no emails/PII. Error messages returned to clients are generic (stack traces stay in the server log). Secret values are never printed (Phase 4).

## 5. Health & readiness probes

| Check | Endpoint / command | Meaning |
|---|---|---|
| **API liveness** | `GET /health` → `{status:"ok"}` | process is up (container HEALTHCHECK uses this) |
| **API readiness** | `GET /health/ready` → 200 `{ready, db:"up"}` / **503** `{not-ready, db:"down"}` | app can serve (DB reachable via `SELECT 1`) — LB/orchestrator gate |
| **Frontend** | `curl -fsk https://<domain>/login` → 200 | web tier serving |
| **Database** | `docker compose exec db pg_isready -U pharmaos` | Postgres accepting connections |
| **Backup freshness** | `find backups -name 'pharmaos-*.sql.gz*' -mtime -1 \| head -1` (empty ⇒ no backup in 24h → alert) | DR backups current |

**Verified:** `/health` → 200 ok; `/health/ready` → 200 `{ready, db:up}` (live DB check).

## 6. Recommended alerts (thresholds)

- **5xx rate** > a few/min, or any sustained 500s → page (grep `"status":5` / level `error`).
- **Auth-failure spike** (401/423 burst from one IP or account) → possible brute force (rate-limiter + lockout already defend; alert to notice).
- **Readiness failing** (`/health/ready` 503) → DB down / pool exhausted.
- **Backup age** > 24h (freshness check §5) → DR at risk.
- **Disk** > 85% on the DB/backup volume → prune retention / expand.
- **Container unhealthy / restart loop** (`docker compose ps`, restart count).

## 7. Failure runbook — "what to check when…"

**Login fails**
1. `grep '"route":"/api/auth/login"' combined.log | tail` — status? 401 (bad creds), 423 (lockout), 429 (rate limit), 500 (server).
2. 423 → account locked: check `users.lockedUntil` / reset via admin. 429 → per-IP limiter (15-min window). 500 → check error.log for the same `requestId`.
3. Readiness: `curl /health/ready` — if `db:down`, it's a DB problem, not auth.

**Billing fails**
1. Find the request: `grep '"route":"/api/billing"' combined.log | tail`.
2. 422 → insufficient stock / validation (expected business rejection). 500 → error.log by `requestId` (transaction/DB).
3. Concurrency: overselling is prevented by the batch row-lock (Phase 3); a 422 "insufficient stock" under load is correct, not a bug.

**Database unavailable**
1. `curl /health/ready` → 503 `db:down`. `docker compose exec db pg_isready`. `docker compose logs db`.
2. Check connections/pool (`connection_limit` in `DATABASE_URL`), disk on `pgdata`. Restart `db` if needed; API becomes ready automatically once DB is back.

**Server disk fills**
1. `df -h`; identify volume (`pgdata` / `backups` / logs). 2. Prune old backups (retention should; run `backup.sh` retention or delete oldest). 3. Rotate/ship logs. 4. Never delete `pgdata`.

**Backup fails** — see Phase 6 §8. Check cron/stderr log; `backup.sh` exits non-zero and keeps the last good dump.

**API crashes / restart loop**
1. `docker compose ps` (restart count), `docker compose logs api`. 2. Startup exit 1 → config (Phase 4 messages) or DB unreachable. 3. `uncaughtException`/`unhandledRejection` exit 1 → error.log stack; find `requestId` of the last request.

**Deployment fails**
1. `docker compose config` (missing required var → exact message). 2. `docker compose build` logs. 3. First boot runs `prisma migrate deploy` — watch `docker compose logs -f api` for migration errors. 4. Readiness not turning healthy → §"Database unavailable".

## 8. Log aggregation (production)

JSON logs on stdout → ship via the Docker logging driver or a collector (Promtail→Loki, Fluent Bit→ELK/CloudWatch). Index on `requestId`, `route`, `status`, `tenantId`. Retain error logs longer than access logs. The `combined.log`/`error.log` files are a fallback when a collector isn't present.

## 9. Status

| Item | Status | Evidence |
|---|---|---|
| Structured logs (JSON in prod) | **PASS** | logger.ts; dev meta rendered |
| Request-id correlation (+ echo header) | **PASS** | `X-Request-ID` echoed + in logs |
| Access log: method/route/status/duration/ids | **PASS** | verified samples §3 |
| Status-based severity (info/warn/error) | **PASS** | 401/404→warn verified |
| Safe user/tenant context, no PII/secrets | **PASS** | only userId/tenantId; no body/header |
| Error logging with requestId + code | **PASS** | errorHandler |
| Auth/authz failure logging | **PASS** | audit + warn access logs |
| Liveness + readiness endpoints | **PASS** | `/health`, `/health/ready` live |
| Health checks (fe/api/db/backup) | **PASS** (documented + commands) | §5 |
| Failure runbook | **PASS** | §7 |
| Log shipping/alerting wired in prod | **NOT VERIFIED** | operator connects collector + alert rules (§6, §8) |

*Observability code (logging, correlation, readiness) is complete and verified; connecting a log collector and alert rules is an operator step on the production host. No regression (integrity 5/5, `tsc` clean). Phase 7 complete — awaiting approval before Phase 8 (Customer Tenant Onboarding).*
