# PharmaOS — Production Deployment Runbook (Phase 5)

**Date:** 2026-09-26
**Objective:** A reproducible, hardened Docker deployment — non-root containers, health/readiness probes, persistent storage, isolated services, HTTPS via Nginx, only required ports exposed.
**Scope note:** A **live `docker compose up`** could not be run in this session — **no Docker daemon is available here** (Docker Desktop Linux engine not reachable). Everything that does not need the daemon **was verified** (compose parses, required-var guards, readiness endpoint, typecheck); the actual image build + container boot + end-to-end-through-nginx are marked **NOT VERIFIED** and must be run by the operator with the exact commands below.

---

## 1. Architecture

```
                 Internet
                    │  443 / 80
              ┌─────▼──────┐
              │   nginx    │  TLS termination, HTTP→HTTPS, security headers, gzip
              │ 1.27-alpine│  (only service with published ports)
              └──┬──────┬──┘
        /api/ →  │      │  → /  (everything else)
          ┌──────▼─┐  ┌─▼───────┐
          │  api   │  │  web    │   internal network only (no host ports)
          │ :4000  │  │ :3000   │
          └───┬────┘  └─────────┘
              │ postgresql
          ┌───▼────┐
          │  db    │  postgres:15-alpine  (internal only)
          └────────┘
Volumes: pgdata (DB), backups (SQL/JSON backups), uploads (user files)
```

- **Only Nginx publishes ports** (80/443). `api`, `web`, `db` are reachable only on the internal compose network → no direct external access.
- **Restart policy** `unless-stopped` on every service.
- **Persistence:** `pgdata` (database), `backups`, `uploads` are named volumes and survive `down`/`up` and image rebuilds.

---

## 2. What was hardened in Phase 5

| Area | Before | After | Verified |
|---|---|---|---|
| **API container user** | root | **non-root `node`** (uid 1000) + owned `logs`/`uploads`/`/backups` | config ✓ / runtime ⧗ |
| **Web container user** | root | **non-root `node`** + owned `.next` | config ✓ / runtime ⧗ |
| **Container HEALTHCHECK** | none | API `wget /health`, Web `wget /login` | config ✓ / runtime ⧗ |
| **Compose healthchecks** | db only | **db + api + web**, with `depends_on: condition: service_healthy` chaining (db→api→web→nginx) | `compose config` ✓ |
| **Readiness probe** | `/health` didn't check DB | new **`/health/ready`** runs `SELECT 1` → 200/503 | **live ✓** |
| **Build context hygiene** | no `.dockerignore` | root `.dockerignore` excludes `node_modules`, `.next`, **`.env*`**, `.git`, logs, tests | file ✓ |
| **CORS default** | `https://localhost` (unsafe) | **`APP_ORIGIN` required** (compose fails if unset) | `compose config` ✓ |
| **Nginx headers** | HSTS, X-Frame, nosniff | + **Referrer-Policy**, **Permissions-Policy**, CSP template, **gzip** | config ✓ |
| **Uploads persistence** | none | **`uploads` named volume** at `/app/apps/api/uploads` | `compose config` ✓ |

`⧗` = requires a Docker daemon to observe at runtime (see §6).

---

## 3. Prerequisites

- Docker Engine + Compose v2 on the host.
- DNS A-record for your pharmacy domain → the host.
- TLS certificate & key at `./nginx/certs/fullchain.pem` and `./nginx/certs/privkey.pem` (e.g. Let's Encrypt: `certbot certonly --standalone -d pharmacy.example.com`).
- A `.env` file at the repo root (compose reads it) with **real** values:

```dotenv
# Required — compose refuses to start without these
DB_PASSWORD=<strong-random-db-password>          # not postgres/admin/root
JWT_SECRET=<openssl rand -base64 48>             # 32+ chars, unique
JWT_REFRESH_SECRET=<openssl rand -base64 48>     # DIFFERENT from JWT_SECRET
APP_ORIGIN=https://pharmacy.example.com          # your https domain, no localhost/wildcard
# Optional
SMTP_HOST=  SMTP_PORT=587  SMTP_USER=  SMTP_PASS=  EMAIL_FROM=PharmaOS <noreply@your-domain>
SMS_PROVIDER=  MSG91_AUTH_KEY=  MSG91_SENDER_ID=PHRMOS
```

The API **fails fast** (exit 1) if any secret/CORS/DB value is unsafe (Phase 4) — this is intended.

---

## 4. Deploy (clean environment) — exact commands

```bash
# 1. From the repo root, with .env and nginx/certs in place:
docker compose config          # sanity: prints the resolved config, errors on missing required vars

# 2. Build images (deterministic — frozen lockfile inside the images)
docker compose build --no-cache

# 3. Start the stack (detached). Order is enforced by healthchecks:
#    db → (healthy) → api (runs migrations, then serves) → (healthy) → web → nginx
docker compose up -d

# 4. Watch health until all are healthy
docker compose ps
docker compose logs -f api      # first boot runs `prisma migrate deploy`
```

> The API entrypoint runs `npx prisma migrate deploy` automatically on start, so a fresh database is migrated to the current schema (including the Decimal money migration) before the server listens.

**Optionally seed a demo tenant** (NOT for a real pharmacy — creates known credentials, and is blocked in production unless overridden):
```bash
# Only for a throwaway/demo box:
docker compose exec -e ALLOW_PROD_SEED=true api sh -c "npx tsx prisma/seed.ts"
```

---

## 5. Verification checklist (run on the host after `up`)

```bash
# Liveness / readiness (readiness fails 503 until the DB is reachable)
docker compose exec api wget -qO- http://localhost:4000/health
docker compose exec api wget -qO- http://localhost:4000/health/ready

# Through nginx over TLS (from the host)
curl -sk https://localhost/health
curl -sk https://localhost/api/... # protected routes require a Bearer token

# HTTP → HTTPS redirect
curl -sI http://localhost | grep -i location   # expect 301 → https://

# Login → get a token → hit protected APIs (billing / inventory / reports)
TOKEN=$(curl -sk https://localhost/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"<admin>","password":"<pw>"}' | jq -r .data.tokens.accessToken)
curl -sk https://localhost/api/inventory -H "Authorization: Bearer $TOKEN" | jq '.data.total'
curl -sk https://localhost/api/billing    -H "Authorization: Bearer $TOKEN" | jq '.data.total'
curl -sk https://localhost/api/reports?days=1 -H "Authorization: Bearer $TOKEN" | jq '.data.totalRevenue'
```

**Status of this checklist in this session:** the readiness/liveness endpoints were verified against the live dev server (`/health/ready` → `{status:ready, db:up}` HTTP 200). The full through-Nginx / login / billing / inventory / reports flow is the same code proven green in Phases 1–4 (32/32 cross-tenant, 14/14 auth, 5/5 integrity) but **has not been run inside the container stack here** (no daemon) — run the commands above to confirm on the target host.

---

## 6. Update & rollback

**Update to a new version:**
```bash
git pull                       # or check out the release tag
docker compose build
docker compose up -d           # recreates changed containers; volumes persist
docker compose logs -f api     # confirm migrate deploy + healthy
```

**Rollback (app):**
```bash
git checkout <previous-tag>
docker compose build && docker compose up -d
```
> **Database rollback is not automatic.** Prisma migrations are forward-only. Before a risky release, take a backup (Phase 6) and, if a migration must be undone, restore that backup. Rolling application code back to a version that predates a migration is only safe if that migration is backward-compatible (the Decimal migration is read-compatible with number-based code).

**Restart a single service:** `docker compose restart api`
**Stop everything (keep data):** `docker compose down` (volumes retained)
**⚠️ Destroy data:** `docker compose down -v` removes `pgdata`/`backups`/`uploads` — never in production.

---

## 7. Verified in this session (no daemon required)

| Check | Result |
|---|---|
| `docker compose config` parses & resolves | **PASS** (exit 0) |
| Required-var guard (`APP_ORIGIN` unset → refuse) | **PASS** (exit 1, helpful message) |
| Readiness `/health/ready` (DB up) | **PASS** (200 `{ready, db:up}`) |
| Liveness `/health` | **PASS** (200 `ok`) |
| Healthchecks + `depends_on` conditions present | **PASS** (resolved config) |
| `uploads`/`backups`/`pgdata` volumes declared | **PASS** |
| API/Web Dockerfiles: `USER node` + `HEALTHCHECK` | **PASS** (Dockerfile review) |
| `.dockerignore` excludes secrets/artifacts | **PASS** |
| Nginx: TLS, HTTP→HTTPS, HSTS, X-Frame, nosniff, Referrer-Policy, Permissions-Policy, gzip | **PASS** (config review) |
| `tsc --noEmit` | **PASS** (exit 0) |

## 8. NOT VERIFIED here (needs a Docker host)

| Item | Why | How to verify |
|---|---|---|
| `docker compose build` succeeds | no daemon | run §4 step 2 |
| Containers boot & become healthy | no daemon | `docker compose ps` |
| API runs as **non-root** at runtime | no daemon | `docker compose exec api id` → uid=1000(node) |
| End-to-end login/billing/inventory/reports through Nginx+TLS | no daemon | §5 commands |
| Container HEALTHCHECK transitions to healthy | no daemon | `docker inspect --format '{{.State.Health.Status}}'` |

---

*Config/Dockerfile/nginx hardening + the readiness endpoint are complete and verified where possible. The live containerized boot must be run on a Docker host using §4–§5. Phase 5 complete — awaiting approval before Phase 6 (Backup & Disaster Recovery), which pairs naturally with the update/rollback notes above.*
