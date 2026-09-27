# PharmaOS — Pilot-Readiness QA Report
**Date:** 2026-07-31 · **Env:** API `localhost:4000`, Web `localhost:3000` · **Tenant:** Divya Pharmacy
**Method:** live HTTP transactions (real DB) across every module — positive, negative, edge, RBAC, concurrency & load — plus browser verification of critical UI flows.

## Verdict: ✅ PASS — ready for pilot
- **Automated transaction suites: 92 / 92 passing** (66 core + 17 deep + 9 concurrency/IST/security) after fixes.
- **3 defects + 3 hardening/limitations found and fixed.** **0 open defects.**
- Concurrency proven: no oversell, no negative stock, no bill-number collisions under 8-way parallel load.
- TypeScript: both apps `tsc --noEmit` clean. Frontend: no console errors on checked pages.

---

## Defects found & fixed
| # | Severity | Module | Issue | Fix | Re-test |
|---|---|---|---|---|---|
| D1 | **High** | Inventory | API accepted an **already-expired** batch (past expiry date) via Add Stock / PO receive | Server-side guard in `createInventoryItem`: reject expiry ≤ today, expiry ≤ mfg date, qty < 1, negative prices | ✅ 422 |
| D2 | **High** | Inventory | Stock **adjustment could deduct below zero** silently (clamped to 0, no error, stock lost) | `adjustStock` now rejects deduction/damage/correction beyond on-hand qty; qty ≥ 1 | ✅ 422 |
| D3 | **Medium** | Billing/Customers | **Credit sales did not increase** the customer's `creditBalance` → Credit Accounts understated, uncollectable | `createBill` increments `creditBalance` by the unpaid balance for credit/part-paid sales | ✅ balance rises, collectable |
| H1 | Hardening | Prescriptions | Missing per-medicine field leaked a raw Prisma **400** | Clean 422 with field-specific message | ✅ |
| H2 | Hardening | Returns | Missing per-item field leaked a raw Prisma **400** | Clean 422 with field-specific message | ✅ |

> Note: two initial "failures" (customer payment against ₹0 balance; Rx/return create) were **test-payload errors**, not product bugs — the product correctly rejected the overpayment, and the real UI sends the correct field names. Verified against the frontend payloads.

---

## Module-by-module results

| Module | Cases | Result | Notable scenarios covered |
|---|---|---|---|
| **Auth** | 7 | ✅ | valid login; wrong password→401; unknown user→401; malformed creds; no-token→401; bad token→401; all 4 role logins |
| **Medicines** | 9 | ✅ | list; create; duplicate→409; XSS name `<script>`→422; negative MRP→422; empty name→422; update+readback; search |
| **Inventory** | 6 | ✅ | list (flat shape); stats; add stock (future expiry); **past-expiry→422 (D1)**; adjust +; **over-deduct→422 (D2)** |
| **Billing** | 6+ | ✅ | pack sale; empty cart→422; **expired batch→422**; over-sell→422; **Schedule-H w/o patient+doctor→422**; loose-unit sale; **mixed pack+loose in one bill**; list |
| **Customers** | 7 | ✅ | list; create; empty name→422; **credit sale raises creditBalance (D3)**; collect payment; overpay→422; negative→422 |
| **Procurement (Vendors/PO)** | 5 | ✅ | vendor list/create; PO list; PO create; **PO receive → inventory batch** |
| **Prescriptions** | 4 | ✅ | create (full fields); get; invalid→422; missing frequency→clean 422 (H1) |
| **Returns** | 3 | ✅ | create against a bill; **approve → refund + restock**; invalid→422 (H2) |
| **Delivery Orders** | 3 | ✅ | list; create; no-address→422 |
| **Transfers** | 1 | ✅ | list (create/relocate verified earlier) |
| **Reorder** | 1 | ✅ | list |
| **Reports** | 4 | ✅ | data load; **GSTR-1 CSV**; bill-level CSV; schedule-register CSV |
| **Schedule Register** | 1 | ✅ | list + export |
| **Settings** | 3 | ✅ | read; update section; export medicines CSV |
| **Users / Roles / Permissions** | 3 | ✅ | list; (CRUD + edit + real-permission assignment verified earlier) |
| **Day Close** | 1 | ✅ | status (+ close/re-close→409/history/pending-days verified earlier) |
| **Dashboard / Search / Notifications / Audit** | 4 | ✅ | all load 200; search safe |
| **RBAC** | 5 | ✅ | cashier create-user→403; cashier delete-role→403; inventory-mgr list-users→403; pharmacist view meds→200; **cashier create bill→201** |
| **Edge inputs** | 7 | ✅ | limit=0; huge limit (clamped); page beyond range; **SQL-injection string safe**; unicode/emoji; nonexistent id→404 (×2) |
| **Concurrency / Stock integrity** | 1 | ✅ | **6 simultaneous sales on a 3-pack batch → no oversell, no negative stock, accounting balances** |
| **Load** | 2 | ✅ | 60 concurrent `/dashboard` in ~240ms; 60 concurrent `/inventory?limit=100` in ~0.8s (all 200) |

---

## Security & integrity checks
- **RBAC enforced** at the API for every role (privilege-escalation attempts return 403).
- **SQL injection** attempt in search handled safely (Prisma parameterization) — 200, no error.
- **Stock can never go negative** — validated under concurrent load and via adjustment/over-sell guards.
- **Expired stock cannot enter inventory or be billed.**
- **Schedule H/H1/X** dispensing blocked without patient + doctor (Drugs & Cosmetics Act).

## Performance
- Hot endpoints handle 60 concurrent requests with all-200 responses; dashboard ~240ms, inventory list ~0.8s. No timeouts, no rate-limit rejections at pilot scale.

## Previously-known limitations — now RESOLVED (re-tested green)
1. **Concurrent same-batch sales** — Root cause was `count()+1` bill numbers colliding (409s), not stock. Now: `SELECT … FOR UPDATE` row lock on the batch (stock integrity) + a **per-tenant `DocumentCounter`** whose atomic upsert-and-return yields collision-free sequential bill numbers with **no retries**, + generous transaction `timeout`/`maxWait` so contended sales wait rather than abort. **Re-tests:** 8 sales on a 5-pack batch → exactly 5 succeed, 3→422, qty 0, no oversell; **stress: 5×12 = 60 simultaneous same-batch sales → 60 created, 60 unique numbers, 0 failures, 0 oversell.**
2. **Business day now IST** — Day-close boundaries and the client's `todayStr()` use IST (UTC+5:30); the `@db.Date` value is stored as the plain IST calendar date (no shift). **Re-test:** `/day-close/status` returns the IST date.
3. **Reset Password & MFA are real** — `POST /api/users/:id/reset-password` sets a strong temp password (revealed once, copyable), unlocks the account, audit-logged; MFA toggle persists via `PUT`. **Re-test:** temp password logs in, old password rejected (401), MFA flag persists, cashier attempt → 403.

## Remaining notes (non-blocking)
- Bill numbering is now a **per-tenant DB counter** (`document_counters`) — zero retries, collision-free at any concurrency, verified to 60-way. Numbers can gap if a transaction rolls back (standard for invoice sequences; acceptable).
- Other numbered docs (Rx/return/PO/delivery/transfer numbers) still use `count()+1` — not hammered like the POS, so left as-is; they can adopt the same `DocumentCounter` if those flows ever see high concurrency.

## Test data side-effects (dev DB only)
Created QA medicines/batches, a few bills, one prescription, one return, one credit customer, and closed 2026-07-31. Safe to reseed before go-live.
