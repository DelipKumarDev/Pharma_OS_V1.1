# PharmaOS — End-to-End Pharmacy Pilot Execution Report (Phase 9)

**Date:** 2026-09-26
**Pharmacy:** "Divya Care Pharmacy" (synthetic) · **Method:** live API driven through the full workflow with database verification of data, calculations, stock movement, financial totals and audit at each stage.
**Result:** ✅ **20/20 stages PASS**. No application defect found — the three issues hit during authoring were all test-harness payload/field mistakes (documented in §Defects), corrected, and re-run green.
**Reproduce:** `pnpm --filter @pharmaos/api test:pilot` (synthetic, self-cleaning) · **Log:** `Testing/Phase 2 Testing/pilot-e2e-run.log`.

---

## Scenario & numbers under test

Opening stock: Paracetamol 500 (PCM-B1) **100 packs** @ ₹10 sell / 12% GST. A credit sale of **10 packs** → subtotal **₹100** + GST **₹12** = **₹112 total**, paid **₹62** → balance **₹50** (to customer credit). Customer pays **₹50** → credit **₹0**. Return **2 packs** → restock **90→92**. Reports must show **revenue ₹112, GST ₹12**.

---

## Execution matrix

| Test ID | Scenario | Steps (API) | Expected | Actual | Status |
|---|---|---|---|---|---|
| P01 | Provision tenant + owner | `POST /api/tenants` (platform op) | 201 + temp password | 201, temp issued | **PASS** |
| P02 | Owner first login + forced change | login(temp) → `POST /auth/password/change` → re-login | change 200, must-change cleared | 200, mustChange=false | **PASS** |
| P03 | Configure pharmacy profile | `PATCH /api/tenants/:id` (self) | address persisted | addr="12 MG Road" | **PASS** |
| P04 | Default roles present | DB check | 5 roles incl. Pharma Admin | all 5 present | **PASS** |
| P05 | Create staff user | `POST /api/users` (Pharmacist) | 201 | 201 | **PASS** |
| P06 | Medicine master | `POST /api/medicines` ×2 | 2 created | m1=201, m2=201 | **PASS** |
| P07 | Vendor | `POST /api/vendors` | 201 | 201 | **PASS** |
| P08 | Opening stock | `POST /api/inventory` (100) | inventory qty=100 | qty=100 | **PASS** |
| P09 | Purchase (PO → receive) | `POST /purchase-orders` → `/:id/receive` | received; med2 qty=50 | recv=200, qty=50 | **PASS** |
| P10 | Inventory reflects both | `GET /api/inventory` `/stats` | 2 batches | total=2 | **PASS** |
| P11 | Customer | `POST /api/customers` | 201 | 201 | **PASS** |
| P12 | Prescription register+approve | `POST /prescriptions` → `/:id/approve` | created + approved | 201, approved | **PASS** |
| P13 | **Billing — totals/GST/stock** | `POST /api/billing` (10 packs, credit) | total 112, bal 50, stock 100→90, movement 10 | total=112, gst=12, bal=50, stock=90, move=10 | **PASS** |
| P14 | **Payment (credit)** | `POST /customers/:id/payments` (₹50) | creditBalance 50→0 | 50→0 | **PASS** |
| P15 | **Return + restock** | `POST /returns` → approve → process | stock 90→92 | stock=92 | **PASS** |
| P16 | **Reports reconcile** | `GET /api/reports?days=1` | revenue≥112, GST≥12 | revenue=112, GST=12 | **PASS** |
| P17 | Audit trail | `GET /api/audit` + DB count | entries > 0 | count=15 | **PASS** |
| P18 | Notifications | `GET /api/notifications` | 200 | 200 | **PASS** |
| P19 | Export bills (CSV) | `GET /api/settings/export/bills` | 200 | 200 (CSV) | **PASS** |
| P20 | Tenant backup | `POST /api/settings/backup` | 200 + records>0 | 200, records=9 | **PASS** |

---

## Verified invariants (the important part)

- **Financial math is exact (Decimal):** bill `subtotal 100 + GST 12 = total 112`; `balance = total − paid = 50`; customer credit incremented by exactly `50`, then paid down to exactly `0`. Reports independently reported `revenue 112 / GST 12`, reconciling to the single bill.
- **Stock moves correctly and atomically:** opening 100 → sale −10 → **90** (with a `SALE` stock movement of 10) → return +2 → **92**. Purchase receive created a new batch of **50** for the second medicine.
- **Workflow integrity:** provisioning created the owner + 5 roles; the owner was forced through a password change; prescription went pending→approved; the bill linked customer + prescription; the return required approve→process before restocking.
- **Audit trail:** 15 audit entries recorded across the flow (provisioning, billing, payment, return, etc.).
- **Permissions:** the whole pharmacy flow ran as the tenant owner (Pharma Admin); provisioning required the platform operator (Phase 8 gate).

---

## Defects

**None in the application.** Three issues were found *in the test script* during authoring and fixed:

| ID | Where | Cause | Resolution |
|---|---|---|---|
| H-1 | P09 receive | test sent `poItemId` from the create response (wrong shape) | fetch the PO item id from the DB (`poId`) |
| H-2 | P09 receive | test omitted `batchNumber`/`expiryDate` — the API **correctly** rejects (422) receives without them | added the required fields |
| H-3 | P16 reports | test read `data.totalRevenue`; the API nests totals under `data.summary` | corrected the field path |

These confirm the API's own validation (P09 receive requiring batch+expiry is correct behaviour) rather than app bugs.

---

## Notes / limitations

- **P19 export** returns `text/csv` (not JSON), so the harness verified HTTP 200 rather than parsing the body; the export endpoint is exercised and returns the CSV. (The CSV column alignment + content were verified separately in the Phase-2 remediation.)
- The pilot ran against the development database using a **throwaway tenant** (`divya-care-pilot`) and cleaned up after itself; no shared/demo data was affected.

---

## Status

| Item | Status |
|---|---|
| Full E2E workflow (provision → backup) | **PASS (20/20)** |
| Financial calculations (totals, GST, credit) | **PASS** (exact) |
| Stock movement (sale, purchase, return) | **PASS** |
| Audit trail | **PASS** |
| Reports reconciliation | **PASS** |
| Permissions / platform gate | **PASS** |
| Application defects found | **None** |

*The complete pharmacy workflow executes correctly end-to-end with exact financial and stock reconciliation. Phase 9 complete — awaiting approval before Phase 10 (Performance & Concurrency).*
