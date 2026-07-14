# PharmaOS — Full Stack Setup Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20 LTS | https://nodejs.org |
| pnpm | 9+ | `npm install -g pnpm` |
| PostgreSQL | 15+ | https://www.postgresql.org/download/ |

---

## Step 1: Create the PostgreSQL database

```sql
-- Run in psql as superuser
CREATE DATABASE pharmaos_dev;
CREATE USER pharmaos WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE pharmaos_dev TO pharmaos;
```

Or use pgAdmin / DBeaver to create a database named `pharmaos_dev`.

---

## Step 2: Configure the backend environment

Open `apps/api/.env` and update the database connection string:

```env
DATABASE_URL="postgresql://pharmaos:password@localhost:5432/pharmaos_dev?schema=public"
```

Replace `pharmaos`, `password`, and `5432` with your actual PostgreSQL user, password, and port.

---

## Step 3: Install all dependencies

From the project root:

```bash
pnpm install
```

---

## Step 4: Generate Prisma client + run migrations

```bash
# From project root:
pnpm --filter @pharmaos/api prisma:generate
pnpm --filter @pharmaos/api prisma:migrate
```

When prompted for a migration name, type: `init`

This creates all 27 tables in your database.

---

## Step 5: Seed demo data

```bash
pnpm --filter @pharmaos/api db:seed
```

This inserts:
- 1 tenant (Divya Pharmacy)
- 4 users with roles
- 31 permissions across all modules
- 5 roles
- 10 medicines + inventory items
- Sample customers, vendors, notifications

---

## Step 6: Start the backend API

```bash
pnpm --filter @pharmaos/api dev
```

The API runs on **http://localhost:4000**

Health check: http://localhost:4000/health

---

## Step 7: Start the frontend

```bash
pnpm --filter web dev
```

The frontend runs on **http://localhost:3001** (or 3000 if available)

---

## Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@divyapharmacy.com | Admin@123 |
| Pharmacist | pharmacist@divyapharmacy.com | Admin@123 |
| Inventory Manager | inventory@divyapharmacy.com | Admin@123 |
| Billing Assistant | billing@divyapharmacy.com | Admin@123 |

---

## Run both together (TurboRepo)

```bash
# From project root — runs frontend + backend in parallel:
pnpm dev
```

---

## Troubleshooting

### "Cannot connect to database"
- Ensure PostgreSQL is running: `pg_isready`
- Check DATABASE_URL in `apps/api/.env`
- Verify port (default: 5432)

### "Prisma migration failed"
```bash
# Reset and re-run:
pnpm --filter @pharmaos/api db:reset
```

### "Port 4000 already in use"
Change `PORT=4001` in `apps/api/.env` and update `NEXT_PUBLIC_API_URL` in `apps/web/.env.local`.

### Frontend still using mock data
Ensure `apps/web/.env.local` contains:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_USE_REAL_API=true
```

---

## Project structure

```
PharmaOS/
├── apps/
│   ├── web/                   # Next.js 15 frontend (port 3001)
│   │   ├── src/
│   │   │   ├── app/           # App Router pages
│   │   │   ├── modules/       # Feature modules
│   │   │   ├── mock/          # MSW handlers (disabled when backend is live)
│   │   │   └── components/
│   │   └── .env.local         # Frontend env (NEXT_PUBLIC_API_URL)
│   └── api/                   # Express.js backend (port 4000)
│       ├── prisma/
│       │   ├── schema.prisma  # Database schema (27 models)
│       │   └── seed.ts        # Demo data seeder
│       ├── src/
│       │   ├── config/        # Env validation, DB client
│       │   ├── middleware/     # Auth, error handler, rate limiter
│       │   ├── modules/       # Feature modules (auth, billing, inventory…)
│       │   └── utils/         # Logger, JWT, password, response helpers
│       └── .env               # Backend env (DATABASE_URL, JWT secrets)
└── packages/
    └── types/                 # Shared TypeScript types
```

---

## API Reference

Base URL: `http://localhost:4000`

| Module | Endpoints |
|--------|-----------|
| Auth | POST /api/auth/login, /logout, /token/refresh, /auth/me |
| Medicines | GET/POST/PUT/DELETE /api/medicines |
| Inventory | GET/POST/PATCH /api/inventory, /stats, /ai-insights |
| Billing | GET/POST /api/billing |
| Customers | GET/POST/PATCH /api/customers, /stats |
| Vendors | GET/POST/PATCH /api/vendors, /api/purchase-invoices |
| Prescriptions | GET/POST/PATCH /api/prescriptions, /approve, /dispense, /reject |
| Returns | GET/POST/PATCH /api/returns, /approve, /process, /reject |
| Users | GET/POST/PUT /api/users, /api/roles |
| Reports | GET /api/reports |
| Dashboard | GET /api/dashboard |
| Settings | GET/PATCH /api/settings |
| Notifications | GET/PATCH /api/notifications |
| Reorder | GET/PATCH /api/reorder |
| Audit | GET /api/audit |
| Tenants | GET/POST/PATCH/DELETE /api/tenants |
