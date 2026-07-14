# PharmaOS — Product Bible

> Complete technical and functional reference for the PharmaOS pharmacy management SaaS platform.
> Last updated: 2026-07-13

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Architecture](#4-architecture)
5. [Design System](#5-design-system)
6. [Database Schema](#6-database-schema)
7. [Backend API — All Modules](#7-backend-api--all-modules)
8. [Frontend Modules](#8-frontend-modules)
9. [Authentication & Security](#9-authentication--security)
10. [Business Logic](#10-business-logic)
11. [Error Handling](#11-error-handling)
12. [Setup & Deployment](#12-setup--deployment)
13. [Demo Data & Credentials](#13-demo-data--credentials)
14. [End-to-End Test Results](#14-end-to-end-test-results)
15. [Known Limitations & Roadmap](#15-known-limitations--roadmap)

---

## 1. Product Overview

**PharmaOS** is a multi-tenant, cloud-ready pharmacy management SaaS platform designed for Indian retail, wholesale, hospital, and chain pharmacies. It covers the complete operational lifecycle of a pharmacy — from medicine master and inventory management to billing, prescriptions, vendor procurement, returns, and analytics.

### Target Users

| Role | Responsibility |
|------|---------------|
| Pharma Admin | Full access — manage all modules, users, settings |
| Pharmacist | Billing, prescription fulfillment, stock queries |
| Inventory Manager | Stock intake, batch management, reorder |
| Billing Assistant | Sales billing only |

### Core Capabilities

- **Point-of-sale billing** with GST calculation, discount, multiple payment modes
- **Prescription management** — digitize, review, approve, dispense
- **Inventory tracking** — batch-wise with expiry alerts and stock movements
- **Vendor management** — purchase invoices, payment tracking, OCR support
- **Returns processing** — customer returns and vendor returns with refund workflow
- **Reorder intelligence** — low-stock alerts, suggested quantities, vendor suggestions
- **Expiry monitoring** — batch-level expiry tracking with early warning
- **Customer CRM** — profiles, purchase history, loyalty points, refill reminders
- **Reports & analytics** — revenue charts, top medicines, category breakdown
- **Full audit trail** — every action logged with before/after values
- **Multi-tenant isolation** — complete data separation per pharmacy
- **Role-based access control** — fine-grained permissions per module

---

## 2. Tech Stack

### Frontend (`apps/web`)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15 (App Router) | React framework, SSR, routing |
| TypeScript | 5+ | Type safety |
| TailwindCSS | 3+ | Utility-first styling |
| shadcn/ui | Latest | Radix UI component library |
| TanStack Query | v5 | Server state, caching, data fetching |
| TanStack Table | v8 | Sortable, filterable data tables |
| Recharts | Latest | Area charts, pie charts, bar charts |
| Zustand | Latest | Client-side state (auth, sidebar) |
| React Hook Form | Latest | Form state management |
| Zod | Latest | Frontend schema validation |
| MSW | v2 | Mock Service Worker (dev fallback) |
| Sonner | Latest | Toast notifications |
| Lucide React | Latest | Icon library |

### Backend (`apps/api`)

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20 LTS | JavaScript runtime |
| Express.js | 4+ | HTTP server framework |
| TypeScript | 5+ | Type safety |
| Prisma ORM | 5+ | Database client, migrations, schema |
| PostgreSQL | 15+ | Primary relational database |
| JSON Web Tokens | Latest | Access + refresh token auth |
| bcrypt | Latest | Password hashing |
| Helmet | Latest | HTTP security headers |
| CORS | Latest | Cross-origin resource sharing |
| compression | Latest | Gzip response compression |
| Winston | Latest | Structured logging |
| Zod | Latest | Request validation schemas |

### Build Tooling

| Tool | Purpose |
|------|---------|
| pnpm workspaces | Monorepo package management |
| TurboRepo | Parallel build orchestration |
| ts-node | TypeScript execution for API dev |
| ESLint + Prettier | Code quality |

---

## 3. Monorepo Structure

```
PharmaOS/
├── apps/
│   ├── web/                         # Next.js 15 frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/          # Login page (unauthenticated layout)
│   │   │   │   │   └── login/page.tsx
│   │   │   │   └── (dashboard)/     # All app pages (authenticated layout)
│   │   │   │       ├── layout.tsx   # Header + sidebar shell
│   │   │   │       ├── dashboard/page.tsx
│   │   │   │       ├── billing/page.tsx
│   │   │   │       ├── returns/page.tsx
│   │   │   │       ├── prescriptions/page.tsx
│   │   │   │       ├── stock/page.tsx
│   │   │   │       ├── medicines/page.tsx
│   │   │   │       ├── reorder/page.tsx
│   │   │   │       ├── expiry/page.tsx
│   │   │   │       ├── contacts/page.tsx
│   │   │   │       ├── customers/page.tsx
│   │   │   │       ├── vendors/page.tsx
│   │   │   │       ├── reports/page.tsx
│   │   │   │       ├── settings/page.tsx
│   │   │   │       ├── users/page.tsx
│   │   │   │       ├── roles/page.tsx
│   │   │   │       ├── audit/page.tsx
│   │   │   │       ├── notifications/page.tsx
│   │   │   │       └── help/page.tsx
│   │   │   ├── modules/             # Feature module views
│   │   │   │   ├── dashboard/views/dashboard-view.tsx
│   │   │   │   ├── billing/views/billing-view.tsx
│   │   │   │   ├── returns/views/returns-view.tsx
│   │   │   │   ├── prescriptions/views/prescriptions-view.tsx
│   │   │   │   ├── stock/views/stock-view.tsx
│   │   │   │   ├── medicines/views/medicines-view.tsx
│   │   │   │   ├── inventory/views/inventory-view.tsx
│   │   │   │   ├── reorder/views/reorder-view.tsx
│   │   │   │   ├── expiry/views/expiry-view.tsx
│   │   │   │   ├── contacts/views/contacts-view.tsx
│   │   │   │   ├── customers/views/customers-view.tsx
│   │   │   │   ├── vendors/views/vendors-view.tsx
│   │   │   │   ├── reports/views/reports-view.tsx
│   │   │   │   ├── settings/views/settings-view.tsx
│   │   │   │   ├── users/views/users-view.tsx
│   │   │   │   ├── roles/views/roles-view.tsx
│   │   │   │   ├── audit/views/audit-view.tsx
│   │   │   │   ├── notifications/views/notifications-view.tsx
│   │   │   │   └── help/views/help-view.tsx
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── header.tsx
│   │   │   │   │   └── sidebar.tsx
│   │   │   │   ├── billing/
│   │   │   │   │   └── new-bill-sheet.tsx
│   │   │   │   ├── inventory/
│   │   │   │   │   └── add-stock-sheet.tsx
│   │   │   │   └── users/
│   │   │   │       └── invite-user-dialog.tsx
│   │   │   ├── store/
│   │   │   │   ├── auth-store.ts    # Zustand: tokens, user profile
│   │   │   │   └── sidebar-store.ts # Zustand: collapsed state
│   │   │   ├── lib/
│   │   │   │   ├── api.ts           # apiFetch wrapper (injects auth token)
│   │   │   │   └── utils.ts         # cn(), getInitials()
│   │   │   ├── mock/handlers/       # MSW mock handlers (dev fallback)
│   │   │   └── providers.tsx        # TanStack Query + MSW setup
│   │   ├── .env.local               # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_USE_REAL_API
│   │   └── next.config.ts           # API proxy rewrites
│   │
│   └── api/                         # Express.js backend
│       ├── prisma/
│       │   ├── schema.prisma        # 27 Prisma models
│       │   ├── migrations/          # SQL migration history
│       │   └── seed.ts              # Demo data seeder
│       ├── src/
│       │   ├── app.ts               # Express app, middleware, route registration
│       │   ├── server.ts            # HTTP server bootstrap
│       │   ├── config/
│       │   │   ├── index.ts         # Env variable validation
│       │   │   └── database.ts      # Prisma client singleton
│       │   ├── middleware/
│       │   │   ├── authenticate.ts  # JWT verify, requirePermission, requireRoles
│       │   │   ├── errorHandler.ts  # AppError, Prisma, Zod error mapping
│       │   │   ├── rateLimiter.ts   # express-rate-limit (global + auth)
│       │   │   ├── requestLogger.ts # Winston request logging
│       │   │   └── validate.ts      # Zod schema validation middleware
│       │   ├── modules/             # Feature modules
│       │   │   ├── auth/
│       │   │   ├── billing/
│       │   │   ├── customer/
│       │   │   ├── dashboard/
│       │   │   ├── inventory/
│       │   │   ├── medicine/
│       │   │   ├── notification/
│       │   │   ├── prescription/
│       │   │   ├── reorder/
│       │   │   ├── reports/
│       │   │   ├── returns/
│       │   │   ├── settings/
│       │   │   ├── tenant/
│       │   │   ├── user/
│       │   │   ├── vendor/
│       │   │   └── audit/
│       │   └── utils/
│       │       ├── jwt.ts           # signAccessToken, signRefreshToken, verify*
│       │       ├── password.ts      # hashPassword, comparePassword, generateOtp
│       │       ├── response.ts      # sendSuccess, sendError, paginate
│       │       ├── audit.ts         # createAuditLog helper
│       │       └── logger.ts        # Winston logger instance
│       └── .env                     # DATABASE_URL, JWT_SECRET, rate limits
│
└── packages/
    ├── types/src/                   # Shared TypeScript interfaces
    └── utils/src/                   # formatCurrency, formatDate, daysUntilExpiry
```

---

## 4. Architecture

### Request Flow

```
Browser (Next.js)
    │
    ├── Static pages (App Router SSR/SSG)
    │
    └── API calls via apiFetch()
            │
            ├── In development (NEXT_PUBLIC_USE_REAL_API=false):
            │     MSW intercepts → returns mock data
            │
            └── In production (NEXT_PUBLIC_USE_REAL_API=true):
                  Next.js proxy (next.config.ts rewrites)
                      │
                      └── Express API (port 4000)
                              │
                              ├── Helmet (security headers)
                              ├── CORS (port 3000/3001 allowed)
                              ├── Rate limiter (global: 100 req/15min)
                              ├── Request logger
                              ├── JWT authenticate middleware
                              ├── Route handler
                              │       └── Prisma ORM
                              │               └── PostgreSQL
                              └── Error handler
```

### Multi-Tenancy

Every database record (except global permissions) includes `tenantId`. All queries in services filter by `tenantId` derived from the JWT `sub`/`tenantId` claim. Tenants are completely isolated — no cross-tenant data leakage is possible via the API layer.

### Token Strategy

- **Access token**: JWT, 15-minute expiry, contains `{ sub, tenantId, email, name, roles[], permissions[], sessionId }`
- **Refresh token**: JWT, 7-day expiry, stored in DB (`refresh_tokens` table) with rotation-on-use
- **OTP codes**: 6-digit numeric, 10-minute expiry, purpose-tagged (password_reset / mfa / email_verification)
- **Account lockout**: 5 failed attempts → 15-minute lock (tracked in `failedLoginAttempts`, `lockedUntil`)

### Rate Limiting

| Limiter | Window | Max Requests | Applied To |
|---------|--------|-------------|-----------|
| Global API | 15 min | 100 | All `/api/*` routes |
| Auth | 15 min | 5 | `/api/auth/login` only |

---

## 5. Design System

### Theme — "Ayush Modern"

The UI uses a custom theme inspired by Indian pharmacy aesthetics, combining deep emerald greens with saffron gold accents on a soft ivory background.

| Token | Value | Usage |
|-------|-------|-------|
| Primary (Deep Emerald) | `hsl(175 77% 26%)` = `#0F766E` | Buttons, links, active states |
| Secondary (Saffron Gold) | `hsl(32 95% 44%)` = `#D97706` | KPI accents, badges, warnings |
| Background (Soft Ivory) | `hsl(40 30% 98%)` = `#FBFAF8` | Page background |
| Sidebar Background | `hsl(174 68% 11%)` = `#092F2B` | Dark sidebar |
| Border Radius | `1rem` (16px) | Cards, inputs, dialogs |

### Typography

| Font | Variable | Use |
|------|----------|-----|
| Inter | (default) | Body text, labels |
| Plus Jakarta Sans | `--font-heading` | Headings, module titles |
| IBM Plex Mono | `--font-mono` | Data values, batch numbers, amounts |

### Custom Utility Classes

| Class | Purpose |
|-------|---------|
| `.rangoli-bg` | Decorative background with mandala motif |
| `.batch-badge` | Pill badge for batch numbers |
| `.expiry-critical` | Red highlight for critical expiry |
| `.expiry-warning` | Amber highlight for near-expiry |
| `.kpi-saffron` | Gold-tinted KPI card |
| `.kpi-indigo` | Indigo-tinted KPI card |
| `.font-data` | IBM Plex Mono for data display |

### Brand Identity

- **Logo**: Pharmacy cross + saffron gold leaf SVG (inline component in sidebar)
- **Sidebar ornament**: Animated saffron mandala SVG (decorative, 8-petal pattern)
- **Color palette**: Deep emerald dominates; saffron gold for urgency/accent; ivory for calm backgrounds

### Component Library

Built on shadcn/ui (Radix UI primitives):
- `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Switch`
- `Card`, `CardHeader`, `CardContent`, `CardDescription`
- `Dialog`, `Sheet` (slide-in panels), `AlertDialog`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Badge` — variants: `default`, `secondary`, `destructive`, `success`, `warning`, `muted`, `info` + `dot` prop
- `DataTable` with `SortableHeader` (TanStack Table v8)
- `Skeleton` (loading states)
- `Tooltip`, `TooltipProvider`
- `ScrollArea`
- `Sonner` toast (success/error/info notifications)

---

## 6. Database Schema

### Summary

| Category | Models | Count |
|----------|--------|-------|
| Tenant & Auth | Tenant, User, Role, Permission, RolePermission, UserRole, RefreshToken, OtpCode | 8 |
| Medicine & Inventory | Medicine, InventoryItem, StockMovement | 3 |
| Billing | Bill, BillItem | 2 |
| CRM | Customer, RefillReminder | 2 |
| Vendors | Vendor, PurchaseInvoice, PurchaseInvoiceItem, VendorPayment | 4 |
| Clinical | Prescription, PrescriptionMedicine | 2 |
| Returns | ReturnRequest, ReturnItem | 2 |
| Operations | Notification, ReorderItem, ReorderVendorSuggestion, ReorderAlert | 4 |
| Compliance | ScheduleDrugRegister | 1 |
| Security & Audit | AuditLog, UserSession, SecurityEvent | 3 |
| **Total** | | **28** |

---

### Enums Reference

#### Tenant Enums
- `TenantType`: `retail | wholesale | hospital | clinic | chain`
- `TenantStatus`: `active | suspended | pending_verification | trial | expired`
- `TenantPlan`: `starter | professional | enterprise`

#### User Enums
- `UserStatus`: `active | inactive | suspended | locked | pending`
- `Gender`: `male | female | other`

#### Medicine Enums
- `MedicineCategory`: `antibiotic | analgesic | antacid | antihistamine | antifungal | antiviral | cardiovascular | diabetes | dermatology | gastroenterology | gynecology | neurology | oncology | ophthalmology | orthopedic | pediatric | psychiatry | respiratory | urology | vitamins | surgical | other`
- `MedicineForm`: `tablet | capsule | syrup | injection | cream | ointment | drops | inhaler | powder | gel | patch | spray | lotion | suspension | suppository`
- `MedicineUnit`: `strip | bottle | vial | tube | sachet | box | piece`
- `DrugSchedule`: `H | H1 | X | G | C | E`
- `MedicineStatus`: `active | discontinued | banned`

#### Inventory Enums
- `InventoryStatus`: `available | low_stock | out_of_stock | expired | damaged`
- `ExpiryStatus`: `good | expiring_soon | expired`
- `BatchStatus`: `active | exhausted | expired | returned`
- `MovementType`: `PURCHASE | SALE | ADJUSTMENT | RETURN | TRANSFER | DISPOSAL`
- `AdjustmentType`: `addition | deduction | damage | return | correction`

#### Billing Enums
- `BillType`: `sale | return | credit_note`
- `BillStatus`: `draft | completed | partially_paid | cancelled | refunded`
- `PaymentMethod`: `cash | card | upi | netbanking | credit | insurance`

#### Customer / Vendor Enums
- `CustomerType`: `walk_in | regular | vip | credit`
- `CustomerStatus`: `active | inactive`
- `VendorStatus`: `active | inactive`
- `PurchaseStatus`: `draft | pending_review | confirmed | partial_received | completed | cancelled`
- `VendorPaymentMode`: `cash | cheque | neft | upi | rtgs`
- `OcrStatus`: `pending | processing | completed | failed`

#### Clinical Enums
- `PrescriptionStatus`: `pending_review | approved | dispensed | rejected | expired`
- `ReturnType`: `customer_return | vendor_return`
- `ReturnStatus`: `pending | approved | processed | rejected`
- `ReturnReason`: `wrong_medicine | damaged | expired | patient_condition_changed | excess_stock | near_expiry | other`
- `RefundMethod`: `cash | upi | credit_note | original_payment`
- `ItemCondition`: `resaleable | damaged | expired`

#### Notification Enums
- `NotificationType`: `expiry_alert | low_stock | out_of_stock | reorder_due | payment_due | sync_failure | backup_failure | login_alert | approval_required | customer_due | system`
- `NotificationCategory`: `inventory | billing | vendor | system | customer | security`
- `NotificationPriority`: `info | warning | critical`

#### Reorder Enums
- `ReorderStatus`: `pending | ordered | received | cancelled`
- `ReorderPriority`: `low | medium | high | critical`
- `ReorderAlertType`: `low_stock | critical_stock | out_of_stock | expiry_risk`

#### Audit Enums
- `AuditModule`: `billing | inventory | medicine | vendor | user | settings | auth | report | customer | reorder`
- `AuditAction`: `create | update | delete | view | export | login | logout | login_failed | approve | reject | cancel | adjust | payment | print`
- `AuditSeverity`: `info | warning | critical`
- `AuditStatus`: `success | failed`
- `RefillStatus`: `due_soon | due_today | overdue | completed`

---

### Key Model Definitions

#### Tenant
The root entity. Every other model references `tenantId`. Settings are denormalized directly on the tenant for fast reads (no separate settings table).

Key fields: `id` (string, not UUID — can be custom like `tnt_001`), `slug` (URL-safe unique), `plan` (billing plan), `gstEnabled`, `expiryAlertDays`, `lowStockThreshold`, `currency`, `timezone`, `acceptCash/UPI/Card/Credit`.

#### User
`tenantId + email` unique. Passwords hashed with bcrypt (12 rounds). Failed login tracking with 15-minute lockout. Soft delete via `deletedAt`.

Status flow: `pending → active` (on first login) | `active → inactive` (admin deactivation) | `active → locked` (too many failed attempts)

#### Medicine
Master catalog per tenant. Tracks: generic name, brand name, HSN code, barcode, drug schedule, GST rate, MRP, selling price, reorder level, storage instructions, side effects. Validated constraints:
- `name` required, max 150 chars, case-insensitive unique per tenant
- `mrp` ≥ 0, `sellingPrice` ≥ 0, `gstRate` 0–100

#### InventoryItem
Batch-level stock tracking. One medicine can have multiple batches. Each batch tracks: purchase price, MRP, selling price, quantity, reserved quantity, expiry date, rack location, batch status (active/exhausted/expired/returned). `expiryStatus` is computed from `expiryDate` vs `tenant.expiryAlertDays`.

#### StockMovement
Immutable audit trail of every quantity change. Links to `medicineId`, `inventoryItemId`, `referenceId` (bill ID, return ID, etc.), records `previousQty` and `newQty`.

#### Bill
Invoice record. `billNumber` auto-incremented per tenant (format: `INV000001`). Supports customer-linked or walk-in sales. Tracks subtotal, discount (amount + percent), tax, total, paid, balance. Payment method stored at bill level. Bill items cascade-delete on bill delete.

On bill create: inventory quantity is auto-decremented, stock movement is recorded, customer stats (totalPurchases, totalSpend, loyaltyPoints, lastVisitDate) are updated.

#### Prescription
`prescriptionNumber` auto-incremented per tenant (format: `RX-2026-0001`). Holds `validUntil` date (defaults to 30 days from creation). One prescription has many `PrescriptionMedicine` records with dosage, frequency, duration, quantity.

Status flow: `pending_review → approved → dispensed` or `pending_review → rejected`

#### ReturnRequest
`returnNumber` auto-incremented per tenant (format `RET-2026-0001`). Can be customer return (linked to bill) or vendor return (linked to purchase invoice). Each return has line items with condition (resaleable/damaged/expired) and restocked flag.

Status flow: `pending → approved → processed` or `pending → rejected`

#### ReorderItem
One record per medicine per tenant. Tracks: `currentStock`, `reorderLevel`, `suggestedQty`, `lastSaleQty30Days`, `daysStockLeft`, `priority` (critical/high/medium/low). Has vendor suggestions as a child array.

#### ScheduleDrugRegister
Statutory dispensing register (Drugs & Cosmetics Act, 1940). One row is auto-created per bill line item whose medicine has schedule H, H1 or X. Records: medicine, schedule, batch, quantity, patient name/age/address/phone, doctor name/registration number, dispensing user, timestamp, and the source bill/bill-item IDs. Immutable — created inside the billing transaction, never updated.

---

## 7. Backend API — All Modules

Base URL: `http://localhost:4000`

All routes under `/api/*` require `Authorization: Bearer <access_token>` except `/api/auth/login`, `/api/auth/token/refresh`, `/api/auth/password/*`, `/api/auth/otp/*`.

Response envelope format:
```json
{
  "success": true,
  "message": "Optional message",
  "data": { ... },
  "timestamp": "2026-07-13T07:25:37.000Z",
  "requestId": "uuid"
}
```

Paginated response format (inside `data`):
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5,
  "hasMore": true
}
```

---

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | No | Email + password login → access token + refresh token |
| POST | `/logout` | Yes | Revoke refresh token, close session |
| GET | `/me` | Yes | Get current user profile with roles & permissions |
| POST | `/token/refresh` | No | Rotate refresh token → new access token |
| POST | `/password/forgot` | No | Send OTP to email for password reset |
| POST | `/otp/send` | No | Send OTP for given purpose |
| POST | `/otp/verify` | No | Verify OTP code |
| POST | `/password/reset` | No | Reset password via OTP |
| POST | `/password/change` | Yes | Change password (requires current password) |

**Login request:**
```json
{
  "email": "admin@divyapharmacy.com",
  "password": "Admin@123",
  "tenantId": "demo"
}
```

**Login response:**
```json
{
  "tokens": { "accessToken": "...", "refreshToken": "..." },
  "user": {
    "id": "...",
    "email": "admin@divyapharmacy.com",
    "name": "Rahul Sharma",
    "tenantId": "tnt_001",
    "tenantName": "Divya Pharmacy",
    "roles": ["Pharma Admin"],
    "permissions": ["billing:create", "inventory:read", ...]
  }
}
```

**Security behaviors:**
- 5 failed logins → account locked 15 minutes (HTTP 423)
- `inactive` or `suspended` status → HTTP 403 (blocked from login)
- `locked` status → HTTP 423 with minutes remaining
- Refresh token rotation: old token revoked on each use
- OTP expires in 10 minutes; previous OTPs for same purpose are invalidated

---

### Dashboard — `/api/dashboard`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | KPIs, 30-day revenue chart, top medicines, sales by category, alerts |

**Response shape:**
```json
{
  "kpis": {
    "todayRevenue": 15420.50,
    "todayBills": 23,
    "lowStockItems": 4,
    "expiringItems": 7,
    "totalMedicines": 342,
    "activeCustomers": 1204,
    "todayRevenueChange": 12.5,
    "todayBillsChange": -3.1,
    "pendingPrescriptions": 3,
    "pendingReturns": 1
  },
  "revenueChart": [
    { "date": "2026-06-14", "revenue": 12000, "bills": 18 },
    ...
  ],
  "topMedicines": [
    { "name": "Paracetamol 650mg", "qty": 450, "revenue": 7200 },
    ...
  ],
  "salesByCategory": [
    { "category": "analgesic", "value": 32 },
    ...
  ],
  "alerts": [
    { "id": "expiry", "type": "expiry", "message": "7 batches expiring within 90 days", "severity": "warning" },
    { "id": "low_stock", "type": "stock", "message": "4 medicines below reorder level", "severity": "error" }
  ]
}
```

---

### Medicines — `/api/medicines`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List medicines (query: `search`, `category`, `form`, `status`, `page`, `limit`) |
| POST | `/` | Create medicine |
| GET | `/:id` | Get medicine by ID |
| PUT | `/:id` | Update medicine fields |
| DELETE | `/:id` | Soft-delete medicine |

**Validation on create:**
- `name` required, max 150 chars, case-insensitive unique per tenant → 409
- `mrp` ≥ 0, `sellingPrice` ≥ 0 (if provided) → 422
- `gstRate` must be 0–100 (if provided) → 422
- Empty name → 422

---

### Inventory — `/api/inventory`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Counts by status (available, low_stock, out_of_stock, expired, damaged), expiring_soon count |
| GET | `/ai-insights` | Smart insights: fastest moving, slow moving, expiring risk, reorder suggestions |
| GET | `/batches/:medicineId` | All inventory batches for a specific medicine |
| GET | `/movements/:medicineId` | Stock movement history for a medicine |
| GET | `/` | List inventory items (query: `status`, `expiryStatus`, `search`, `medicineId`) |
| POST | `/` | Add new batch to inventory |
| PATCH | `/:id/adjust` | Adjust stock quantity (with reason, type) |
| PATCH | `/:id/status` | Update batch status (`available | low_stock | out_of_stock | expired | damaged`) |
| DELETE | `/:id` | Remove inventory item (soft delete) |

**Create inventory item (required fields):**
```json
{
  "medicineId": "uuid",
  "batchNumber": "B-2026-001",
  "expiryDate": "2027-06-30",
  "purchasePrice": 12.50,
  "mrp": 18.50,
  "sellingPrice": 16.00,
  "quantity": 100
}
```

**Status update validation:** Accepts only valid `InventoryStatus` values; returns 422 for unknown values.

---

### Billing — `/api/billing`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List bills (query: `status`, `search`, `page`, `limit`) |
| POST | `/` | Create bill |
| GET | `/:id` | Get bill with line items |

**Create bill (required):** `items` array must have ≥ 1 item → 422 otherwise.

**Bill creation side effects:**
1. Inventory quantity decremented per item (if `inventoryItemId` provided)
2. `StockMovement` (type `SALE`) recorded per item
3. Batch `status` updated to `out_of_stock` or `low_stock` based on new qty
4. Customer stats updated (`totalPurchases++`, `totalSpend`, `loyaltyPoints`, `lastVisitDate`)
5. Audit log created

**Bill numbering:** `INV000001`, `INV000002`, ... (per tenant)

**Payment methods:** `cash | card | upi | netbanking | credit | insurance`

---

### Prescriptions — `/api/prescriptions`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Total, pending_review, approved, dispensedToday, rejected, expiringSoon counts |
| GET | `/` | List prescriptions (query: `status`, `search`) |
| POST | `/` | Create prescription |
| GET | `/:id` | Get prescription with medicines |
| PATCH | `/:id/approve` | Approve prescription (pending_review → approved) |
| PATCH | `/:id/dispense` | Dispense prescription (approved → dispensed) |
| PATCH | `/:id/reject` | Reject prescription with optional reason |

**Prescription numbering:** `RX-2026-0001`, `RX-2026-0002`, ...

**Validation on create:**
- `customerName` required → 422
- `medicines` array must have ≥ 1 item → 422
- `customerId` empty string coerced to `undefined` (avoids Prisma UUID error)

**Medicine fields per prescription item:** `medicineName` (required), `dosage`, `frequency`, `duration`, `genericName?`, `quantity?`, `instructions?`

---

### Returns — `/api/returns`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Total, pending, approved, processed, rejected counts + refund amounts |
| GET | `/` | List returns (query: `type`, `status`, `search`) |
| POST | `/` | Create return request |
| GET | `/:id` | Get return with items |
| PATCH | `/:id/approve` | Approve return (pending → approved). Re-approving approved → 400 |
| PATCH | `/:id/process` | Process return (approved → processed) |
| PATCH | `/:id/reject` | Reject return (pending → rejected) |

**Return numbering:** `RET-2026-0001`, ...

**Validation on create:**
- `type` required (`customer_return | vendor_return`) → 422
- `items` array must have ≥ 1 item → 422

**Valid return reasons:** `wrong_medicine | damaged | expired | patient_condition_changed | excess_stock | near_expiry | other`

**Valid refund methods:** `cash | upi | credit_note | original_payment`

---

### Customers — `/api/customers`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Total, active, VIP, credit customers + new this month |
| GET | `/` | List customers (query: `search`, `customerType`, `status`) |
| POST | `/` | Create customer |
| GET | `/:id` | Get customer by ID |
| PATCH | `/:id` | Update customer fields |
| GET | `/:id/purchases` | Get customer's bill history |

**Validation on create:**
- `name` required → 422
- `phone` must be ≥ 10 digits if provided → 422
- Duplicate `phone` per tenant → 409

**Customer stats tracked automatically:**
- `loyaltyPoints` = total spend ÷ 100 (rounded down)
- `totalPurchases` (count), `totalSpend` (amount), `lastVisitDate`, `totalVisits`

---

### Vendors — `/api/vendors`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Total, active, inactive vendors + total pending payments |
| GET | `/` | List vendors |
| POST | `/` | Create vendor |
| GET | `/:id` | Get vendor by ID |
| PATCH | `/:id` | Update vendor (incl. status: active/inactive) |
| DELETE | `/:id` | Deactivate vendor (soft delete) |
| GET | `/:id/invoices` | Vendor's purchase invoices |
| GET | `/:id/payments` | Vendor's payment history |

**Key field notes:**
- `gstNumber` (not `gstin`) — optional
- `paymentTerms` is `String?` (e.g., "30 days") — not an integer
- No `licenseNumber` field

**Vendor payment — `/api/vendor-payments` (flat route on app.ts):**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/vendor-payments` | Record a payment to a vendor |

Payment modes: `cash | cheque | neft | upi | rtgs`

---

### Purchase Invoices — `/api/purchase-invoices`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List purchase invoices |
| POST | `/` | Create purchase invoice |
| GET | `/:id` | Get invoice with line items |
| PATCH | `/:id` | Update invoice status |

OCR status tracking: `pending | processing | completed | failed`

---

### Reports — `/api/reports`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/?days=N` | Full analytics dataset for last N days |
| GET | `/gstr1?month=M&year=Y[&format=csv]` | GSTR-1 outward supplies — B2CS section, HSN summary, document series; CSV format ready for GST portal upload |
| GET | `/export?days=N` | Bill-level sales report as CSV download |

Query parameter: `days` (positive integer, required to be > 0 — returns 400 for ≤ 0 or non-numeric). GSTR-1 validates `month` 1–12 and `year` ≥ 2017 → 400 otherwise.

The main report payload includes: `summary` (revenue, bills, GST, gross profit/margin, best day, payment-method mix, new/returning customers, dead-stock value), `dailySales` (with cash/UPI/card/credit split), `topMedicines` (with margin % and Schedule H flag), `categories` (revenue/GST/margin/share), `gstSlabs` + `gstTotals` (rate-wise CGST/SGST), `scheduleHLog` (live register entries), `deadStock`, `topCustomers`, and `hourlyPattern` (8 AM–8 PM IST footfall).

**Response:**
```json
{
  "summary": {
    "totalRevenue": 458320.50,
    "totalBills": 612,
    "totalItems": 2847,
    "totalGST": 48230.00,
    "totalDiscount": 12500.00,
    "avgBillValue": 748
  },
  "dailySales": [
    { "date": "2026-06-14", "revenue": 15400, "bills": 23, "gst": 1620, "avgBillValue": 670 },
    ...
  ],
  "topMedicines": [
    { "name": "Paracetamol 650mg", "qtySold": 340, "revenue": 5440, "category": "analgesic" },
    ...
  ],
  "salesByCategory": [
    { "category": "analgesic", "revenue": 45000, "bills": 189 },
    ...
  ],
  "period": 30
}
```

---

### Settings — `/api/settings`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Get all settings sections (profile, system, tax, billing, notifications) |
| PATCH | `/:section` | Update a section (`profile | system | tax | billing | notifications`) |
| POST | `/backup` | Real backup — `pg_dump` SQL dump to `BACKUP_DIR` (JSON tenant snapshot fallback when pg_dump is unavailable); returns actual file name + size |
| GET | `/export/:type` | Real CSV download (`medicines | inventory | customers | vendors | bills`) or full JSON data dump (`backup`) — UTF-8 BOM for Excel, formula-injection safe |
| POST | `/import/:type` | Real import — body `{ rows: [...] }` (frontend parses the CSV); validates each row, skips duplicates, returns true `imported/skipped/errors` counts with per-row error details |
| GET | `/import/template/:type` | Get import template column definitions |

**Import validation per type:** medicines (name required ≤150 chars, case-insensitive dedupe, prices ≥ 0, GST 0–100, category/form/schedule enum mapping); customers (name required, phone ≥ 10 digits, dedupe by phone); vendors (name required, dedupe by name); inventory (medicine must exist in master, batch + qty + expiry required, MM/YYYY expiry accepted, stock status auto-derived). Max 5000 rows per request.

**Settings sections:**

`profile` → `pharmacyName, phone, email, address, city, state, pincode, licenseNumber, drugLicenseNumber, gstNumber`

`system` → `timezone, dateFormat, currency, lowStockThreshold, expiryAlertDays, autoBackup, sessionTimeout, language`

`tax` → `enableGST, gstRegistered, defaultGST`

`billing` → `printReceiptOnSale, showGSTOnReceipt, showGenericName, termsOnReceipt, thankYouMessage, acceptCash, acceptUPI, acceptCard, acceptCredit, upiId, creditLimit`

`notifications` → `lowStockAlert, expiryAlert, reorderAlert, dailyReport, weeklyReport, monthlyReport, emailAlerts, smsAlerts, whatsappAlerts, alertEmail, alertPhone`

---

### Users — `/api/users`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List users with roles |
| POST | `/` | Invite user (creates with status `pending`, password `Welcome@123`) |
| PUT | `/:id` | Update user profile + optionally replace roles |
| PATCH | `/:id/status` | Change user status (`active | inactive | suspended | pending`) |

**Validation on create:**
- `name` required → 422
- `email` required, valid format → 422
- Duplicate `email` per tenant → 409

**Status validation:** Only `active | inactive | suspended | pending` accepted → 422 for others

**First-login auto-activation:** When a `pending` user successfully logs in, status auto-changes to `active`.

---

### Roles — `/api/roles`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List roles with permissions and user count |
| POST | `/` | Create custom role |
| GET | `/:id` | Get role by ID |
| PUT | `/:id` | Update role name, description, permissions |
| DELETE | `/:id` | Delete custom role (system roles protected → 400) |
| GET | `/permissions` | List all available permissions |

**Role protection:**
- System roles (`isSystem = true`) cannot be modified or deleted → 400
- Duplicate role name per tenant → 409
- `name` required → 422

---

### Notifications — `/api/notifications`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Unread counts by priority + today's total |
| GET | `/` | List notifications (query: `category`, `unread=true`, `priority`) |
| PATCH | `/mark-all-read` | Mark all unread notifications as read |
| PATCH | `/:id/read` | Mark single notification as read |

**Valid categories:** `inventory | billing | vendor | system | customer | security`
Passing an invalid category (e.g., `stock`) returns HTTP 400.

---

### Reorder — `/api/reorder`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Pending, critical, high-priority, ordered-today, out-of-stock counts |
| GET | `/alerts` | Reorder alerts (query: `acknowledged=false`) |
| PATCH | `/alerts/:id/acknowledge` | Acknowledge a reorder alert |
| GET | `/` | List reorder items (query: `priority`, `status`) |
| PATCH | `/:id` | Update reorder item status or fields |

**Reorder item priorities:** `critical | high | medium | low` (ordered by priority then `daysStockLeft`)

---

### Audit — `/api/audit`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats` | Today's log count, critical actions, failed actions, active users, total sessions |
| GET | `/sessions` | User session history |
| GET | `/security-events` | Security event log |
| GET | `/` | Paginated audit log (query: `module`, `action`, `userId`, `severity`, `search`, `page`, `limit`) |

**Audit is written automatically** by services using `createAuditLog()` for: login/logout, bill creation, medicine changes, user invitations, role changes, settings updates, etc.

---

### Tenants — `/api/tenants`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List tenants (super-admin only) |
| POST | `/` | Create tenant |
| GET | `/:id` | Get tenant details |
| PATCH | `/:id` | Update tenant settings |
| DELETE | `/:id` | Soft-delete tenant |

---

### Refills — `/api/refills` (inline on app.ts)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/refills` | List refill reminders with summary (overdue, dueToday, dueSoon) |
| POST | `/api/refills/:id/remind` | Send real SMS refill reminder via configured provider (404 if reminder missing, 400 if customer has no phone; console fallback when no provider configured) |

---

### Schedule Drug Register — `/api/schedule-register`

Statutory compliance module (Drugs & Cosmetics Act, 1940).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Paginated register (query: `schedule`, `from`, `to`, `search`, `page`, `limit`) |
| GET | `/stats` | Total entries, this-month count, breakdown by schedule |
| GET | `/export` | Full register as CSV with serial numbers — print/submit for drug inspector audits |

Invalid `schedule` values → 400. Entries are created automatically by the billing service — there is no manual create/edit/delete endpoint by design (register integrity).

**Billing enforcement:** `POST /api/billing` rejects (422) any bill containing a Schedule H/H1/X medicine unless both `customer.name` and `doctor` are present. Optional fields `patientAge`, `patientAddress`, `doctorRegNumber` are recorded when supplied.

---

## 8. Frontend Modules

### Navigation Structure

**Main navigation (sidebar):**
| Label | Route | Icon |
|-------|-------|------|
| Dashboard | `/dashboard` | LayoutDashboard |
| Billing | `/billing` | Receipt |
| Returns | `/returns` | RotateCcw |
| Prescriptions | `/prescriptions` | FileText |
| Stock & Inventory | `/stock` | Package |
| Medicine Master | `/medicines` | Pill |
| Reorder Queue | `/reorder` | RefreshCw |
| Expiry Monitor | `/expiry` | CalendarX2 |
| Schedule Register | `/schedule-register` | ShieldAlert |
| Contacts | `/contacts` | Users |
| Reports | `/reports` | BarChart3 |
| Settings | `/settings` | Settings2 |

**Admin section (bottom of sidebar):**
| Label | Route | Icon |
|-------|-------|------|
| Users | `/users` | UserCog |
| Roles | `/roles` | Shield |
| Audit Log | `/audit` | ClipboardList |

**Sidebar extras:**
- Collapsible (icon-only mode)
- User profile card (initials avatar, name, role, pharmacy name)
- Saffron mandala ornament (decorative)
- "Quick Bill" tip
- Help & Shortcuts link
- Sign out button

---

### Module Details

#### Dashboard (`/dashboard`)
- Real-time KPI cards: Today's Revenue, Bills Count, Low Stock Items, Expiring Items, Total Medicines, Active Customers
- Revenue trend comparison (today vs yesterday, % change with arrow indicator)
- 30-day area chart (revenue + bills overlay)
- Sales by category pie chart (top 6 categories)
- Top 5 medicines by revenue (30-day window)
- Active alerts panel (expiry warnings, low stock)
- Quick action buttons: New Bill, Add Stock, View Prescriptions, View Returns
- Time-based greeting ("Good morning / afternoon / evening")
- Skeleton loading states for all data sections

#### Billing POS (`/billing`)
- Split-panel layout (medicine search left, bill preview right)
- Barcode/name search for medicines
- Batch selection with expiry date display
- Quantity input with stock validation
- GST auto-calculation per line item
- Discount (percent or amount) at bill level
- Multiple payment modes: Cash, UPI, Card, Credit
- Patient name + phone (walk-in or linked customer)
- Doctor name field
- Bill number auto-generated
- **80mm thermal receipt** — 72mm printable width, GST rate-wise breakup (CGST/SGST), batch + expiry per line, Schedule H statutory warning; compatible with Epson TM-series and other thermal printer drivers
- Dispensing label printing (72×40mm)
- Hold queue (multiple bills on hold simultaneously)
- **Barcode scanning** — USB keyboard-wedge scanners (F8) plus camera scanning (native BarcodeDetector API on Chrome/Edge; EAN-13/8, Code 128, UPC, QR)
- **Schedule H/H1/X guard** — cart badges (`Sch H1`), inline warning banner, and payment block until patient + doctor names are filled
- Keyboard shortcuts: `F1` (new bill), `F8` (scan), `F4` (hold/resume), `F9` (finalize)

#### Prescriptions (`/prescriptions`)
- Stats bar: Total, Pending Review, Approved, Dispensed Today
- Filter tabs: All, Pending, Approved, Dispensed, Rejected
- Prescription cards with patient name, doctor, date, status badge
- Approve / Reject / Dispense action buttons
- Add Prescription sheet (manual entry or image upload)
- Prescription detail view with medicines list and dosage

#### Returns (`/returns`)
- Two tabs: Customer Returns, Vendor Returns
- Stats: Total, Pending, Approved, Processed
- Return list with type, reason, amount, status
- Create return form with bill/invoice reference, items, refund method
- Approve → Process workflow
- Re-approving an already approved return → 400 (protected)

#### Stock & Inventory (`/stock`)
- Multi-tab view: Overview, Catalog, Stock Levels, Expiry, Reorder
- **Overview**: Summary cards (total SKUs, low stock, out of stock, expiring soon)
- **Catalog**: Medicine master list with search, category filter
- **Stock Levels**: Batch-level inventory with status filters
- **Expiry**: Batches grouped by expiry urgency
- **Reorder**: Items below reorder level with priority indicators
- Add Stock Sheet (slide-in panel): batch number, expiry, purchase price, qty, rack location
- Adjust Stock Dialog: quantity adjustment with reason and type

#### Medicine Master (`/medicines`)
- Full medicine catalog: name, generic name, manufacturer, form, strength, category, MRP, GST rate
- Search by name, generic name, manufacturer
- Filter by category, form, schedule, status
- Add medicine form with all fields
- Edit medicine (price updates, status changes)
- Discontinued / banned status management

#### Reorder Queue (`/reorder`)
- Items below reorder level sorted by criticality
- Priority badges: Critical (red), High (orange), Medium (yellow), Low (grey)
- Days stock left indicator
- Suggested order quantity
- Preferred vendor recommendation
- Status update: pending → ordered → received
- Alert acknowledgment

#### Schedule Register (`/schedule-register`)
- Statutory dispensing record for Schedule H, H1 & X drugs
- Stats: total entries, this month, H/H1 count, X count
- Filter tabs by schedule; search across patient, doctor, medicine, bill, batch
- Table: date, medicine + batch + qty, schedule badge, patient (name/age/phone), prescriber (name/reg no), bill number, dispensed by
- One-click CSV export of the full register for drug inspector audits

#### Expiry Monitor (`/expiry`)
- Inventory items grouped by expiry urgency:
  - **Critical**: Expires within 30 days
  - **Warning**: Expires within 90 days
  - **Good**: Safe stock
- Batch number, medicine name, expiry date, quantity per row
- Filter by expiry status
- Quick status update to `expired` for clearly expired batches

#### Contacts (`/contacts`)
- Two tabs: Customers, Vendors
- **Customers**: List with name, phone, total purchases, loyalty points, type badge
- **Vendors**: List with name, contact person, phone, GST number, pending payment
- Quick add modals for both
- Click-through to detail pages

#### Customers (`/customers`)
- Full customer list with search, type filter
- Customer detail: purchase history, loyalty points, medical conditions, allergies
- Profile update (address, doctor name, notes)
- Refill reminder status

#### Vendors (`/vendors`)
- Vendor list with status, pending payment, rating
- Vendor detail: invoices list, payment history
- Create vendor with GST number, payment terms, credit limit
- Payment recording (NEFT, UPI, cheque, cash, RTGS)
- Activate / deactivate vendor

#### Reports (`/reports`)
- Date range selector: 7 / 30 / 90 / 365 days
- Summary KPIs: Total Revenue, Total Bills, Total Items, Total GST, Avg Bill Value
- Daily revenue area chart
- Top 10 medicines table
- Category revenue breakdown

#### Settings (`/settings`)
- Split-panel: section list (left) + section form (right)
- **Profile**: Pharmacy name, logo, contact, address, license numbers, GST number
- **Tax**: GST enable/disable, registration status, default GST rate
- **Billing**: Receipt preferences, payment methods, UPI ID, credit limit
- **Import & Export**: Drag-drop file upload, Excel templates, backup
- **Notifications**: Alert thresholds (low stock days, expiry days), email/SMS/WhatsApp toggles
- **System**: Timezone, date format, currency, session timeout, language

#### Users (`/users`)
- User list with name, email, role badges, status
- Invite user (email + name → sets temporary password `Welcome@123`)
- Edit user (name, phone, roles)
- Activate / Deactivate / Suspend user
- Role assignment (multi-role support)

#### Roles (`/roles`)
- Role list with name, user count, permission count
- Create custom role
- Edit role permissions (granular module:action permission assignment)
- Cannot delete system roles (Admin, Pharmacist, etc.)
- View permissions matrix

#### Audit Log (`/audit`)
- Chronological activity log with filters: module, action, user, severity, search
- Session history (who logged in when, from where)
- Security events panel
- Stats: Today's actions, critical actions, failed actions, active users

#### Notifications (`/notifications`)
- Notification list with type icons and priority colors
- Filter: All, Unread, by category (inventory / billing / vendor / system / customer / security)
- Mark individual or all as read
- Priority levels: Critical (red bell), Warning (amber), Info (grey)

---

## 9. Authentication & Security

### JWT Payload Structure

```typescript
interface JwtPayload {
  sub: string;        // User ID
  tenantId: string;   // Tenant ID
  email: string;
  name: string;
  roles: string[];    // e.g., ["Pharma Admin"]
  permissions: string[]; // e.g., ["billing:create", "inventory:read"]
  sessionId: string;  // UUID for this session
  iat: number;
  exp: number;
}
```

### Permission System

Permissions follow `module:action` notation:

```
billing:create, billing:read, billing:update, billing:delete
inventory:create, inventory:read, inventory:update, inventory:delete
medicine:create, medicine:read, medicine:update, medicine:delete
prescription:create, prescription:read, prescription:approve, prescription:dispense
vendor:create, vendor:read, vendor:update, vendor:delete
customer:create, customer:read, customer:update, customer:delete
user:create, user:read, user:update, user:delete
report:read, report:export
settings:read, settings:update
audit:read
...
```

Wildcards: `module:*` or `*:*` grant all actions.

Middleware: `requirePermission('module', 'action')` and `requireRoles('Admin', 'Manager')` available for any route.

### Security Headers

Helmet applied:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`
- `X-XSS-Protection`
- Content Security Policy

### CORS

Allowed origins: `http://localhost:3000`, `http://localhost:3001` (configurable via `CORS_ORIGIN` env var)

---

## 10. Business Logic

### Inventory Deduction on Sale

When a bill is created with `inventoryItemId` on a line item:
1. Current batch quantity is read
2. New quantity = `max(0, current - sold)`
3. Status updated: `out_of_stock` if qty = 0, `low_stock` if qty ≤ medicine reorder level, else `available`
4. Batch `batchStatus` updated to `exhausted` if qty = 0
5. `StockMovement` created with type `SALE`, `previousQty`, `newQty`
6. All changes happen inside a Prisma transaction (atomic)

### Loyalty Points

Calculated at bill creation: `floor(totalAmount / 100)` points added to customer's `loyaltyPoints`.

### Prescription Number Format

`RX-{YEAR}-{SEQUENTIAL_4_DIGIT}` — e.g., `RX-2026-0001`. Count-based, not timestamp-based.

### Bill Number Format

`INV{SEQUENTIAL_6_DIGIT}` — e.g., `INV000001`. Count-based per tenant.

### Return Number Format

`RET-{YEAR}-{SEQUENTIAL_4_DIGIT}` — e.g., `RET-2026-0001`.

### Settings Denormalization

All pharmacy settings live on the `Tenant` model directly (no separate settings table) for read performance. The settings API reads/writes directly to `prisma.tenant.update()`.

### Audit Logging

`createAuditLog()` is called from service functions for:
- All user auth events (login, logout, failed login, password change)
- Bill creation
- Medicine create/update
- User invite, status change, role update
- Settings updates (in settings routes)
- Severity levels: `info` (default), `warning`, `critical` (auth, user status changes)

### First-Login Activation

When a user with `status: pending` successfully logs in, their status is automatically updated to `active`:
```ts
status: user.status === 'pending' ? 'active' : user.status
```

---

## 11. Error Handling

### HTTP Status Codes Used

| Status | Meaning | When |
|--------|---------|------|
| 200 | OK | Successful read/update |
| 201 | Created | Successful create |
| 400 | Bad Request | Custom validation, re-approve attempt, Prisma validation error |
| 401 | Unauthorized | Missing/invalid/expired JWT |
| 403 | Forbidden | Inactive/suspended account, insufficient permissions |
| 404 | Not Found | Record not found, route not found |
| 409 | Conflict | Duplicate record (Prisma P2002 or custom duplicate check) |
| 422 | Unprocessable Entity | Zod validation failure, custom input validation |
| 423 | Locked | Account locked due to failed login attempts |
| 500 | Internal Server Error | Unhandled exceptions |

### Error Response Format

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": ["Invalid email"],
    "name": ["Name is required"]
  },
  "timestamp": "2026-07-13T07:25:37.000Z",
  "requestId": "uuid"
}
```

### Error Handler Chain

1. `AppError` (custom) → uses `statusCode` + `message`
2. `ZodError` → maps field errors → 422
3. `PrismaClientKnownRequestError`
   - `P2002` (unique constraint) → 409
   - `P2025` (record not found) → 404
   - Other → 500
4. `PrismaClientValidationError` (unknown fields in create) → 400
5. Everything else → 500

---

## 12. Setup & Deployment

> **Production deployment** (Docker Compose with Postgres + Nginx TLS, bare-metal Windows/PM2, backup cron, thermal printer setup) is covered in [DEPLOYMENT.md](DEPLOYMENT.md). The section below is the local development setup.

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 LTS |
| pnpm | 9+ |
| PostgreSQL | 15+ |

### Environment Variables — Backend (`apps/api/.env`)

```env
# Server
NODE_ENV=development
PORT=4000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/pharmaos_dev?schema=public"

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Security
BCRYPT_ROUNDS=12
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Rate Limiting (production values)
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# File Uploads
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880          # 5 MB

# Logging
LOG_DIR=logs
LOG_LEVEL=info

# Email (optional — for OTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=PharmaOS <noreply@pharmaos.in>
```

### Environment Variables — Frontend (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_USE_REAL_API=true
```

### Installation Steps

```bash
# 1. Create PostgreSQL database
psql -c "CREATE DATABASE pharmaos_dev;"

# 2. Install dependencies
pnpm install

# 3. Generate Prisma client + run migrations
pnpm --filter @pharmaos/api prisma:generate
pnpm --filter @pharmaos/api prisma:migrate

# 4. Seed demo data
pnpm --filter @pharmaos/api db:seed

# 5. Start everything (TurboRepo parallel)
pnpm dev

# OR individually:
pnpm --filter @pharmaos/api dev    # API on :4000
pnpm --filter web dev              # Frontend on :3000/:3001
```

### API Routes Proxy (next.config.ts)

The Next.js frontend proxies all `/api/*` requests to the backend:
```ts
async rewrites() {
  return [{ source: '/api/:path*', destination: 'http://localhost:4000/api/:path*' }]
}
```

### Database Reset

```bash
pnpm --filter @pharmaos/api db:reset
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all apps in parallel (TurboRepo) |
| `pnpm build` | Build all apps |
| `pnpm --filter @pharmaos/api dev` | Start API only |
| `pnpm --filter web dev` | Start frontend only |
| `pnpm --filter @pharmaos/api prisma:generate` | Regenerate Prisma client |
| `pnpm --filter @pharmaos/api prisma:migrate` | Run migrations |
| `pnpm --filter @pharmaos/api db:seed` | Seed demo data |
| `pnpm --filter @pharmaos/api db:reset` | Reset + re-seed |

---

## 13. Demo Data & Credentials

### Seed Data Summary

| Entity | Count | Details |
|--------|-------|---------|
| Tenant | 1 | Divya Pharmacy (id: `tnt_001`, slug: `divya-pharmacy`) |
| Users | 4 | Admin, Pharmacist, Inventory Manager, Billing Assistant |
| Roles | 5 | Pharma Admin, Pharmacist, Inventory Manager, Billing Assistant, Viewer |
| Permissions | 31 | Across all modules |
| Medicines | 10+ | Common Indian pharmacy medicines |
| Inventory items | 10+ | Seeded with batch numbers and expiry dates |
| Customers | Sample | Mixed walk-in, regular, VIP |
| Vendors | Sample | Common pharma distributors |
| Notifications | Sample | Low stock, expiry alerts |

### Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Pharma Admin | `admin@divyapharmacy.com` | `Admin@123` |
| Pharmacist | `pharmacist@divyapharmacy.com` | `Admin@123` |
| Inventory Manager | `inventory@divyapharmacy.com` | `Admin@123` |
| Billing Assistant | `billing@divyapharmacy.com` | `Admin@123` |

New users invited via the app receive temporary password: `Welcome@123`

### Health Check

```
GET http://localhost:4000/health
→ { "status": "ok", "timestamp": "...", "version": "1.0.0" }
```

---

## 14. End-to-End Test Results

Comprehensive API tests were run across all 15 modules covering positive cases, negative/invalid input cases, and edge cases. Final result:

**124 / 124 PASS — 0 FAIL — 0 SKIP** (core module suite)
**42 / 42 PASS** (market-readiness suite: Schedule register + enforcement, GSTR-1, import/export/backup, reports dataset, refill SMS — run 2026-07-14)

### Test Coverage by Module

| Module | Tests | All Pass |
|--------|-------|----------|
| Auth | 8 | ✅ |
| Medicine | 14 | ✅ |
| Inventory | 10 | ✅ |
| Customer | 10 | ✅ |
| Vendor | 10 | ✅ |
| Billing | 7 | ✅ |
| Prescriptions | 9 | ✅ |
| Returns | 9 | ✅ |
| Reorder | 4 | ✅ |
| Expiry | 4 | ✅ |
| Reports | 6 | ✅ |
| Settings | 6 | ✅ |
| Users | 11 | ✅ |
| Roles | 9 | ✅ |
| Notifications | 7 | ✅ |
| **Total** | **124** | **✅ 100%** |

### Bugs Found and Fixed During Testing

| Module | Bug | Fix |
|--------|-----|-----|
| Medicine | No validation on create — duplicates, negative prices, GST > 100% allowed | Added: name required, name ≤ 150 chars, MRP/price ≥ 0, GST 0–100, case-insensitive duplicate check |
| Inventory | No `PATCH /:id/status` endpoint | Added route, controller handler, `updateInventoryStatus` service function |
| Billing | Empty `items` array accepted without error | Added guard: items.length === 0 → 422 |
| Prescription | Empty string `customerId` caused Prisma UUID crash → 500 | Sanitize: `""` → `undefined` before Prisma call |
| Prescription | No required-field validation | Added: `customerName` required, `medicines` array must have ≥ 1 item |
| Returns | Wrong TypeScript import type for `RefundMethod` | Fixed import; added `type` and `items` required validation |
| Reports | `days=0` silently treated as 30 | Added explicit positive-integer guard → 400 for ≤ 0 |
| Settings | `PATCH` did `res.redirect(303)` which dropped auth header → 401 | Replaced with inline `sendSuccess` response |
| Users | Missing email before Prisma query matched any user → incorrect 409 | Added email required check before DB call |
| Users | No status allow-list on `PATCH /:id/status` | Added allow-list check → 422 for invalid values |
| Users | `suspended` users could log in | Added suspended status check in auth service |
| Roles | No `GET /:id` or `PUT /:id` endpoints | Added routes + `getRoleById` + `updateRole` functions |
| Roles | No duplicate-name check on role create | Added findFirst check → 409 |
| Customer | No name/phone validation | Added: name required, phone ≥ 10 digits, duplicate phone → 409 |

---

## 15. Known Limitations & Roadmap

### Resolved in the market-readiness pass (July 2026)

| Area | Now |
|------|-----|
| Schedule H/H1/X compliance | ✅ Statutory dispensing register + billing enforcement + register UI + CSV export |
| GST filing | ✅ GSTR-1 generation (B2CS + HSN summary + doc series) with portal-ready CSV |
| Email | ✅ Nodemailer SMTP — OTP emails + low-stock/expiry alert emails (console fallback when unconfigured) |
| SMS/WhatsApp | ✅ Provider layer (MSG91 / Twilio via env config) — refill reminders + stock alerts |
| Import | ✅ Real CSV import with per-row validation, dedupe, error reporting (medicines/customers/vendors/inventory) |
| Export | ✅ Real CSV downloads (5 types) + full JSON data dump |
| Backup | ✅ pg_dump SQL backup with JSON fallback; cron recipe in DEPLOYMENT.md |
| Receipt printing | ✅ 80mm thermal format with GST breakup and Schedule H warning |
| Barcode scanning | ✅ Keyboard-wedge + camera (BarcodeDetector API) |
| Reports export | ✅ Server-generated bill-level CSV; reports API returns the complete analytics dataset |
| Daily alerts | ✅ Scheduled job (daily) creates in-app notifications + email/SMS per tenant preferences |
| Deployment | ✅ Dockerfiles, docker-compose (Postgres+API+Web+Nginx TLS), .env.example with secret-generation instructions, DEPLOYMENT.md |
| Type safety | ✅ Both apps compile clean (`tsc --noEmit`); production `next build` passes |

### Remaining Limitations

| Area | Limitation |
|------|-----------|
| Auth | `tenantId` in login body is optional and not validated against DB — acceptable single-tenant; must be enforced before onboarding tenant #2 on shared infra |
| Offline mode | UI screen exists (`/offline`) but offline-first sync (IndexedDB/ServiceWorker) is not implemented — needs stable internet or LAN deployment |
| OCR | `ocrStatus` field exists; invoice image-to-text not connected |
| Excel import | Import accepts CSV only — users must "Save As CSV" from Excel (real .xlsx parsing would need SheetJS) |
| Backup restore UI | SQL restore is CLI-based (`psql`); no in-app restore button |
| WhatsApp templates | Twilio WhatsApp works with sandbox/approved templates; MSG91 WhatsApp channel not wired (SMS only) |
| Loyalty redemption | Points accrue; redemption workflow not built |
| Multi-branch | Schema supports chains; branch-level routing not implemented |
| GSTR-3B | GSTR-1 done; GSTR-3B summary return not yet generated |

### Roadmap (Next Phases)

**Phase 4 — Intelligence & Compliance**
- GSTR-3B summary generation; e-invoice (IRN) for B2B wholesale
- OCR invoice scanning (Tesseract.js or Google Vision API)
- AI-driven reorder suggestions (90-day moving average)
- Drug interaction checker
- .xlsx import via SheetJS

**Phase 5 — Scale & Multi-Tenant SaaS**
- Tenant validation at login + subdomain routing (`pharmacy-name.pharmaos.in`)
- Subscription billing (Razorpay integration)
- Super-admin dashboard for tenant management
- Off-site backup to S3/Cloudflare R2; Redis caching for dashboard KPIs
- Offline-first POS (IndexedDB + background sync)

---

*End of PharmaOS Product Bible — v1.0 · 2026-07-13*
