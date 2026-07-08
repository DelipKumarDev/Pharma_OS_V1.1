# PharmaOS — Enterprise Pharmacy Management Platform

A production-grade, frontend-first pharmacy management SaaS built with Next.js 15, TurboRepo, and MSW.

## Architecture

```
pharmaos/
├── apps/
│   └── web/              # Next.js 15 App Router frontend
├── packages/
│   ├── types/            # Shared TypeScript type definitions
│   ├── utils/            # Shared utilities (currency, date, string)
│   ├── ui/               # Shared design system (TBD Phase 1 extension)
│   └── mock/             # MSW handlers (currently in apps/web)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5.7 (strict) |
| Styling | TailwindCSS 3 + CSS Variables |
| Components | shadcn/ui (Radix UI primitives) |
| Forms | React Hook Form + Zod |
| State | Zustand (client) |
| Server State | TanStack Query v5 |
| Tables | TanStack Table v8 |
| Charts | Recharts |
| Mock API | MSW v2 |
| Monorepo | TurboRepo + pnpm workspaces |
| Notifications | Sonner |
| Icons | Lucide React |

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Type check
pnpm type-check
```

## Development

```
URL: http://localhost:3000

Demo credentials:
Email: admin@divyapharmacy.com
Password: Admin@123
```

## Build Phases

| Phase | Status | Description |
|---|---|---|
| 1 — Repository + Design System | ✅ Complete | Monorepo, types, utils, shell, login, dashboard |
| 2 — Authentication + Shell | 🔜 Next | Full auth flows, MFA, forgot password |
| 3 — Medicine + Inventory | 🔜 | Medicine master CRUD, inventory management |
| 4 — Billing + Reports | 🔜 | POS billing, reports, exports |
| 5 — Offline + Polish | 🔜 | IndexedDB, PWA, sync queue |

## Design System

PharmaOS uses a teal-based design language:

- **Primary**: Teal (`#0d9488`) — pharmaceutical trust
- **Surface**: `#F8FAFC` — clean clinical white
- **Dark sidebar**: `hsl(222 47% 11%)` — professional contrast
- **Semantic**: Success green / Warning amber / Error red

All design tokens are CSS custom properties in `globals.css`.

## Mock API

All API calls are intercepted by MSW in development. Mock data lives in:

```
src/mock/
├── browser.ts          # MSW worker setup
└── handlers/
    ├── auth.ts
    ├── dashboard.ts
    ├── medicine.ts
    ├── inventory.ts
    ├── billing.ts
    └── user.ts
```

To replace mocks with a real backend: remove the MSW setup in `providers.tsx` and point `fetch` calls at your API URL.
