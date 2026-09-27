# PharmaOS — Database & Data Integrity Report (Phase 3)

**Date:** 2026-09-25
**Scope:** Prisma schema, migrations, and the money/stock transaction paths — inventory, purchase, billing, returns, payments, stock adjustment, expiry, customer/vendor balances, tax. Verify transaction boundaries; test duplicates, failures, rollback, and concurrent stock/billing; review indexes.
**Result:** Core money/stock transactions are **atomic and concurrency-safe** — proven by a live concurrency suite (**5/5 PASS**). One real defect fixed at root (**`adjustStock` non-atomic + lost-update race**). One **open P1** confirmed with evidence: **money stored as `Float`** — a safe migration plan is provided but **not executed** (gated change; see §5).

---

## 1. Transaction-boundary audit (per critical path)

| Path | Atomic? | Concurrency safety | Verdict |
|---|---|---|---|
| **Billing** (`billing.service.createBill`) | `prisma.$transaction` wraps bill + items + stock decrement + movements + customer update | `SELECT … FOR UPDATE` row-lock on each batch inside the txn (`billing.service.ts:173`); re-reads locked qty before validating | **PASS** |
| **Bill numbering** (`getNextBillNumber`) | atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING` on `document_counters` | Postgres-atomic increment; DB-level `@@unique([tenantId, billNumber])` as backstop | **PASS** |
| **Returns restock** (`returns.service`) | `prisma.$transaction`; stock via atomic `increment` | `increment` is `qty = qty + n` (no read-modify-write race) | **PASS** |
| **Stock adjustment** (`inventory.service.adjustStock`) | **was NOT transactional + read-modify-write** | **was a lost-update race** | **FIXED** (§2) |
| **Purchase receive** (`purchaseOrder.routes`) | tenant-scoped PO load; inventory created via `createInventoryItem` | serialized per-PO; adds stock (no oversell risk) | **PASS** |
| **Vendor payment** (`vendor.service.createVendorPayment`) | invoice/vendor balance updates | ownership-guarded (Phase 1); balance via read+update (low-contention, single-operator) | **PASS** (see §6 note) |
| **Customer balance** (billing/credit) | updated inside the bill `$transaction` via `increment`/`decrement` | atomic increments | **PASS** |

---

## 2. Defect fixed — `adjustStock` atomicity & race (root cause)

**Before:** `adjustStock` (`inventory.service.ts`) read `item.quantity`, computed `newQty` in JS, then issued **three separate auto-committed statements** (update quantity, create movement, audit) with **no transaction and no lock**. Two effects:
1. **Non-atomic** — if the movement insert failed after the quantity update, stock changed with no audit trail (partial write).
2. **Lost-update race** — concurrent adjustments (or an adjustment racing a sale) both read the same stale quantity; one overwrites the other, and the `quantity > item.quantity` guard used the **stale** read, so stock could be corrupted or driven negative.

**Fix:** wrapped the mutation in `prisma.$transaction` with a `SELECT … FOR UPDATE` lock on the batch row, re-validating against the **locked** quantity and writing the quantity + stock movement atomically (mirrors the billing pattern). Audit log stays outside the txn (side record).

**Proof:** `CONCURRENCY-adjust` test — 20 concurrent −10 adjustments on qty 100 → exactly 10 applied, final qty 0, 10 movements, never negative. (Pre-fix, this path had no serialization guarantee.)

---

## 3. Live concurrency / integrity tests

**Suite:** `apps/api/scripts/db-integrity.test.ts` · **Run:** `pnpm --filter @pharmaos/api test:integrity` · **Log:** `Testing/Phase 2 Testing/db-integrity-run.log`. Synthetic data; self-cleaning; drives the live API + PostgreSQL.

### Results — 2026-09-25 (5/5 PASS, exit 0)

| Test | Scenario | Result | Evidence |
|---|---|---|---|
| **CONCURRENCY-oversell** | 20 concurrent bills ×1 pack on a batch of **10** | **PASS** | sold=**10**, rejected=10 (422), final qty=**0**, never <0 |
| **CONCURRENCY-adjust** | 20 concurrent −10 adjustments on qty **100** | **PASS** | applied=**10**, final qty=**0**, movements=10, no lost update |
| **ROLLBACK-atomic** | 2-item bill, item 2 insufficient | **PASS** | 422; item 1 qty **unchanged (5)**; **0** bills created; **0** movements |
| **DUPLICATE-billnums** | 5 identical concurrent submits | **PASS** | 5 bills, **5 unique** bill numbers, stock consistent (qty 5) |
| **FLOAT-precision-risk** | DB double vs numeric + Float accumulation | **PASS (risk confirmed)** | `0.1+0.2`(double)=`0.30000000000000004`; creditBalance(10×0.1)=`0.9999999999999999` |

**What this proves:** no oversell or negative stock under contention; adjustments are race-safe; a failed multi-item bill leaves **zero** partial writes; concurrent bills never collide on a number.

---

## 4. Indexes & query performance

Indexing is **good**: every tenant-scoped table has `@@index([tenantId])` plus composite indexes for common filters (`(tenantId,status)`, `(tenantId,category)`, `(tenantId,module)`, `(tenantId,isRead)`, …). `Bill`, `Prescription`, `ReturnRequest` carry DB-level `@@unique` on their document numbers. Foreign keys are declared throughout.

- **Minor (P3):** the billing FEFO lookup filters `{tenantId, medicineId, batchStatus, expiryDate, quantity}` ordered by `expiryDate`; a composite `@@index([tenantId, medicineId, expiryDate])` on `inventory_items` would speed it at scale. Not needed at pilot volume. *(Deferred — not changing schema unnecessarily.)*

---

## 5. RESOLVED — money migrated `Float` → `Decimal(12,2)` (executed & tested)

**Update (2026-09-25):** the migration was executed and verified. Drift is gone: the `DECIMAL-no-drift` test now shows `creditBalance = 1` (drift `0`) after ten `0.1` increments, column type `numeric(_,2)`. See §5a. The original evidence of the risk is retained below.

**Confirmed risk (pre-migration).** All monetary columns (`totalAmount`, `subtotal`, `taxAmount`, `paidAmount`, `pendingAmount`, `balanceAmount`, `creditBalance`, `gstAmount`, `mrp`, prices, `refundAmount`, vendor balances, …) were `Float` (double precision). The test proved lossy accumulation (`0.9999999999999999` for a value that should be `1.00`).

**Concrete failure modes:**
- **Aggregation drift** — `SUM(totalAmount)`/GST totals over many bills can drift by paise in reports.
- **Equality bugs** — `pendingAmount === 0 ? 'completed'` (vendor invoice) and similar can fail to fire when float residue leaves `~1e-10`, leaving an invoice permanently "not completed".
- **Reconciliation** — customer credit / vendor balances can accumulate sub-paise error over time.

**Why not executed here:** this is a large, cross-cutting change (15+ columns across ~10 tables **and** the money arithmetic in billing/returns/reports/vendor/customer, **and** Prisma now returning `Decimal` objects that ripple to API responses and the frontend’s `number` types). The mandate says *do not change schema unnecessarily* and *every migration must be safe*; a change of this blast radius warrants its own reviewed step, not a bundled one. **Recommended as the immediate next gated task.**

**Safe, data-preserving migration (per column; run in a maintenance window):**
```sql
-- Postgres: converts in place, rounding to paise; no data loss for real currency values.
ALTER TABLE "bills"
  ALTER COLUMN "totalAmount"   TYPE numeric(12,2) USING "totalAmount"::numeric(12,2),
  ALTER COLUMN "subtotal"      TYPE numeric(12,2) USING "subtotal"::numeric(12,2),
  ALTER COLUMN "taxAmount"     TYPE numeric(12,2) USING "taxAmount"::numeric(12,2),
  ALTER COLUMN "paidAmount"    TYPE numeric(12,2) USING "paidAmount"::numeric(12,2),
  ALTER COLUMN "balanceAmount" TYPE numeric(12,2) USING "balanceAmount"::numeric(12,2);
-- …repeat for bill_items, purchase_invoices, customers.creditBalance, vendors.pendingPayment,
--    inventory_items (mrp/prices), return_requests, day_close, etc.
```
Prisma side: `Float` → `Decimal @db.Decimal(12,2)`, `prisma generate`, and either return `.toNumber()` at the API boundary or add a Decimal→number serializer so existing frontend `number` types keep working. Then re-run **all three** suites (security, auth, integrity) as the regression gate.

### 5a. What was executed
- **Migration** `prisma/migrations/20260925000000_decimalize_money/migration.sql` — **52** money columns across 16 tables converted with `ALTER … SET DATA TYPE DECIMAL(12,2)` (Postgres implicit double→numeric cast, data-preserving, rounds to paise). Rates/percentages (`gstRate`, `defaultGST`, `discountPercent`) and `rating` deliberately kept `Float`. Applied via `prisma migrate deploy` (clean); `prisma generate` refreshed the client.
- **API contract preserved** — a central `Decimal → number` deep-serializer in `sendSuccess` (`utils/response.ts`) converts every Decimal in a response payload to a JS number, so the frontend still receives numbers. Verified live: `GET /api/medicines` returns `mrp: 50` with `typeof === "number"`.
- **Backend arithmetic fixed** — `tsc` surfaced every site where money read from the DB participated in `+`/`+=`/comparison (Prisma `Decimal` breaks `+` via string-y `valueOf`). All **64** sites across `customer`, `dashboard`, `day-close`, `inventory`, `reorder`, `reports`, `settings`, `vendor` were coerced with `Number(...)`. `tsc --noEmit` → **exit 0**.
- **Exactness where it matters** — atomic SQL `increment`/`decrement` and `_sum` aggregations now run on `numeric` columns (exact); JS intermediate math re-quantizes to 2dp on write.

### 5b. Regression gate (all green, 2026-09-25, clean server)
| Suite | Result |
|---|---|
| `test:integrity` (incl. **DECIMAL-no-drift**: creditBalance=1, drift=0, `numeric(2)`) | **5/5 PASS** |
| `test:security` (cross-tenant) | **32/32 PASS** |
| `test:auth` | **14/14 PASS** |
| Money JSON type (`GET /api/medicines`) | **number** ✓ |
| `tsc --noEmit` | **exit 0** |

---

## 6. Other findings (documented, low severity)

- **No idempotency key on bill creation (P2, business).** A double-submit creates two independent, correct bills (proven — stock stays consistent, numbers unique). It is not data corruption, but a fast double-click yields two invoices. Recommend an optional client-supplied idempotency key on `POST /api/billing`.
- **Bill-number gaps (P3, compliance nicety).** `getNextBillNumber` runs before the billing txn, so a rolled-back bill consumes a number → sequence gaps. Not corruption; strict no-gap numbering would require generating inside the txn (serializes on the counter). Acceptable for most GST filing; flag for the accountant.
- **`vendor.createVendorPayment` balance update** is read-then-update (not `FOR UPDATE`). Low contention (single back-office operator), ownership-guarded (Phase 1). If concurrent vendor payments become common, switch to atomic `increment`/`decrement`. *(Not changed — low risk.)*

---

## 7. Status

| Item | Status | Evidence |
|---|---|---|
| Billing atomic + no oversell under concurrency | **PASS** | CONCURRENCY-oversell |
| Stock adjustment atomic + race-safe | **PASS (fixed)** | §2, CONCURRENCY-adjust |
| Failed transaction rolls back fully | **PASS** | ROLLBACK-atomic |
| Concurrent bills get unique numbers | **PASS** | DUPLICATE-billnums |
| Returns restock atomic | **PASS** | code (atomic increment) |
| Indexes on hot paths | **PASS** | §4 |
| Foreign keys / unique constraints | **PASS** | schema |
| Money precision (Float→Decimal) | **RESOLVED (migrated + tested)** | §5, §5a, §5b (DECIMAL-no-drift PASS) |
| Bill idempotency | **OPEN P2** | §6 |
| API typecheck | **PASS** | `tsc --noEmit` exit 0 |
| No regression (security/auth) | **PASS** | 32/32 + 14/14 green post-migration |

**Verdict:** transaction boundaries and concurrency are **production-sound** (atomicity defect fixed & proven), and money is now stored as **`Decimal(12,2)`** with the drift eliminated and the number-based API/frontend contract preserved. The only remaining data-integrity item is the optional billing idempotency key (P2).

*Phase 3 complete, including the executed Decimal migration. `adjustStock` hardened (transaction + lock). All four suites green. Awaiting approval before Phase 4.*
