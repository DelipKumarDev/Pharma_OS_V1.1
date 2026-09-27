# PharmaOS — Pharmacy Management SaaS

A multi-tenant pharmacy management platform: **Next.js 15** web app + **Express/Prisma/PostgreSQL** API, JWT auth with RBAC, deployed via **Docker + Nginx (HTTPS)**. Covers medicine master, inventory & batches, POS billing (GST), prescriptions, returns, vendors/purchases, customers & credit, reports, audit, and platform-operated tenant onboarding.

## Architecture

```
pharmaos/  (pnpm workspaces + TurboRepo)
├── apps/
│   ├── web/     # Next.js 15 App Router frontend (TS, Tailwind, shadcn/ui, TanStack Query)
│   └── api/     # Express + Prisma REST API (JWT, RBAC, multi-tenant)
├── packages/
│   ├── types/   # shared TypeScript types
│   └── utils/   # shared utilities (currency, date, …)
├── nginx/       # reverse proxy: TLS termination, HTTP→HTTPS, security headers
└── docker-compose.yml  # db (Postgres 15) + api + web + nginx
```

The API is the source of truth; the web app calls it via `NEXT_PUBLIC_USE_REAL_API=true`. (An MSW mock layer exists under `apps/web/src/mock` for isolated frontend development only; it is disabled in production builds.)

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, TailwindCSS, shadcn/ui, TanStack Query/Table, Zustand, React Hook Form + Zod |
| API | Express 4, Prisma ORM, Zod, JWT (access/refresh), bcrypt, helmet, express-rate-limit |
| Database | PostgreSQL 15 (money as `Decimal(12,2)`) |
| Infra | Docker (multi-stage, non-root), Nginx (TLS, HSTS), pnpm + TurboRepo |
| CI/CD | GitHub Actions (type-check, build, integration tests on Postgres) |

## Local development

```bash
pnpm install

# API (apps/api): create .env from apps/api/.env.example, then:
pnpm --filter @pharmaos/api exec prisma migrate deploy
pnpm --filter @pharmaos/api exec prisma generate
pnpm --filter @pharmaos/api run db:seed        # demo data (dev only; refused in production)

pnpm dev                                        # web :3000 + api :4000
pnpm type-check                                 # strict tsc (the quality gate)
```

Demo credentials (seeded, **development only**): `admin@divyapharmacy.com` / `Admin@123`.

## Production deployment

See **`PRODUCTION_DEPLOYMENT_RUNBOOK.md`**. In short: fill `.env` (strong secrets, `APP_ORIGIN`, TLS certs in `nginx/certs`), then `docker compose build && docker compose up -d`. The API fails fast on unsafe production config, runs migrations on start, and exposes `/health` (liveness) + `/health/ready` (DB readiness). Only Nginx (80/443) is exposed.

## Tenant onboarding

Pharmacies are provisioned by a **platform operator** (`scripts/create-platform-admin.ts`) via `POST /api/tenants` — creating the tenant, default roles, and an owner with a forced first-login password change. See **`CUSTOMER_ONBOARDING_RUNBOOK.md`**.

## Testing

Integration suites (run against a live API + Postgres) live in `apps/api/scripts/*.test.ts`:

```bash
pnpm --filter @pharmaos/api run test:security      # cross-tenant isolation / IDOR
pnpm --filter @pharmaos/api run test:auth          # auth lifecycle
pnpm --filter @pharmaos/api run test:integrity     # transactions / concurrency / money
pnpm --filter @pharmaos/api run test:onboarding    # tenant provisioning + lifecycle
pnpm --filter @pharmaos/api run test:pilot         # end-to-end pharmacy workflow
pnpm --filter @pharmaos/api run test:security-scan # SQLi / mass-assign / headers / CORS
pnpm --filter @pharmaos/api run test:config        # production config + seed guard
```

CI runs all of these on PRs (`.github/workflows/ci.yml`).

## Production hardening reports

Security, database, backup/DR, deployment, monitoring, onboarding, performance, CI/CD, and the go-live readiness review are documented in the `*_REPORT.md` / `*_RUNBOOK.md` files at the repo root (see `PHARMAOS_GO_LIVE_READINESS_REPORT.md`).
