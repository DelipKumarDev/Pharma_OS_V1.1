# PharmaOS — QA Phase 2: Master Test Scenario Catalog

**Document ID:** QA-SCEN-02
**Version under test:** V1.2.1
**Scope:** Scenario catalog only (test *conditions*, not step-level cases — those are produced per module in Phase 4).
**Convention:** `SC-<AREA>-<n>`. Each scenario notes type: **P** positive · **N** negative · **B** boundary · **BR** business rule · **SEC** security · **INT** integration · **PERF** performance · **UX** usability.

---

## Coverage map

| Area code | Module | Bible ref |
|-----------|--------|-----------|
| AUTH | Authentication & Authorization | §9 |
| DASH | Dashboard | §8 |
| USR | User Management | §7 |
| ROLE | Roles & Permissions | §7 |
| TEN | Tenant | §7 |
| MED | Medicine Master | §7 |
| INV | Inventory / Stock | §7 |
| PUR | Purchase Invoices / Vendor payments | §7 |
| BILL | Billing (POS) | §7,§10 |
| RX | Prescriptions | §7 |
| RET | Returns | §7 |
| CUST | Customers | §7 |
| VEN | Vendors | §7 |
| REORD | Reorder | §7 |
| EXP | Expiry Monitor | §7 |
| REP | Reports (Sales, GST/GSTR-1, Stock) | §7 |
| SCHED | Schedule H/H1/X Register | §7, compliance |
| NOTIF | Notifications | §7 |
| AUD | Audit Log | §7 |
| SET | Settings (profile/tax/billing/import/export/backup) | §7 |
| INTG | Cross-module integration | §10 |
| SECX | Security (system-wide) | §9 |
| PERFX | Performance | — |

---

## AUTH — Authentication & Authorization
| ID | Type | Scenario |
|----|------|----------|
| SC-AUTH-1 | P | Valid credentials return access+refresh tokens and user profile with roles/permissions |
| SC-AUTH-2 | N | Invalid password returns 401, no token |
| SC-AUTH-3 | N | Unknown email returns 401 (no user enumeration difference) |
| SC-AUTH-4 | N | Malformed email → 422 validation |
| SC-AUTH-5 | N | Empty password → 422 |
| SC-AUTH-6 | BR | 5 consecutive failures lock account 15 min (423) |
| SC-AUTH-7 | BR | Lock auto-expires after window; correct login then succeeds |
| SC-AUTH-8 | BR | `inactive`/`suspended` user blocked with 403 |
| SC-AUTH-9 | BR | `pending` user auto-activates on first successful login |
| SC-AUTH-10 | P | Refresh token rotation issues new pair, revokes old |
| SC-AUTH-11 | N | Reused (revoked) refresh token rejected 401 |
| SC-AUTH-12 | N | Expired refresh token rejected 401 |
| SC-AUTH-13 | SEC | Access to protected route without token → 401 |
| SC-AUTH-14 | SEC | Tampered/invalid JWT signature → 401 |
| SC-AUTH-15 | SEC | Expired access token → 401 |
| SC-AUTH-16 | P | `/auth/me` returns current profile |
| SC-AUTH-17 | P | Logout revokes refresh token + closes session |
| SC-AUTH-18 | BR | Forgot-password issues OTP (10-min expiry), old OTPs invalidated |
| SC-AUTH-19 | N | Reset with wrong/expired OTP → 400 |
| SC-AUTH-20 | BR | Password reset enforces complexity (upper/lower/digit/special/≥8) |
| SC-AUTH-21 | BR | Change password requires correct current password |
| SC-AUTH-22 | SEC | Permission-gated endpoint denies user lacking `module:action` (403) |
| SC-AUTH-23 | SEC | Role-gated endpoint denies wrong role |
| SC-AUTH-24 | SEC | Tenant A token cannot read Tenant B records |
| SC-AUTH-25 | B | Rate limiter: auth endpoint blocks after configured max |

## DASH — Dashboard
| ID | Type | Scenario |
|----|------|----------|
| SC-DASH-1 | P | KPIs return today revenue, bills, low-stock, expiring, medicines, customers |
| SC-DASH-2 | P | Revenue chart returns 30 contiguous days |
| SC-DASH-3 | P | Top medicines (≤5) ranked by revenue |
| SC-DASH-4 | P | Sales-by-category percentages sum sensibly (≤6 categories) |
| SC-DASH-5 | BR | Revenue % change vs yesterday; guards divide-by-zero |
| SC-DASH-6 | BR | Alerts appear only when low-stock/expiring counts > 0 |
| SC-DASH-7 | P | Cached response served within TTL; refreshes after 30s |
| SC-DASH-8 | SEC | Dashboard reflects only caller's tenant |
| SC-DASH-9 | UX | Skeleton loaders while fetching; no layout shift |
| SC-DASH-10 | N | Unauthenticated dashboard call → 401 |

## USR — User Management
| ID | Type | Scenario |
|----|------|----------|
| SC-USR-1 | P | Create/invite user (status pending, temp password) |
| SC-USR-2 | N | Missing name → 422 |
| SC-USR-3 | N | Missing/invalid email → 422 |
| SC-USR-4 | BR | Duplicate email per tenant → 409 |
| SC-USR-5 | P | List users with roles |
| SC-USR-6 | P | Update user profile + replace roles |
| SC-USR-7 | BR | Status change limited to active/inactive/suspended/pending |
| SC-USR-8 | N | Invalid status value → 422 |
| SC-USR-9 | BR | Deactivated user cannot log in |
| SC-USR-10 | SEC | Non-admin lacks user:create/update |
| SC-USR-11 | B | Name/email at max length |
| SC-USR-12 | SEC | Cannot assign roles from another tenant |

## ROLE — Roles & Permissions
| ID | Type | Scenario |
|----|------|----------|
| SC-ROLE-1 | P | List roles with permission + user counts |
| SC-ROLE-2 | P | Create custom role with permission set |
| SC-ROLE-3 | N | Missing role name → 422 |
| SC-ROLE-4 | BR | Duplicate role name per tenant → 409 |
| SC-ROLE-5 | BR | System role cannot be edited/deleted → 400 |
| SC-ROLE-6 | P | Update role permissions reflected in new tokens |
| SC-ROLE-7 | P | GET /roles/:id and PUT /roles/:id work |
| SC-ROLE-8 | P | List all available permissions |
| SC-ROLE-9 | SEC | Permission change takes effect on next token issuance |

## TEN — Tenant
| ID | Type | Scenario |
|----|------|----------|
| SC-TEN-1 | P | Get tenant details/settings |
| SC-TEN-2 | P | Update tenant settings (profile fields) |
| SC-TEN-3 | SEC | Tenant listing restricted to authorized/super-admin |
| SC-TEN-4 | BR | Slug uniqueness enforced |
| SC-TEN-5 | SEC | Tenant cannot modify another tenant |
| SC-TEN-6 | B | Settings numeric bounds (thresholds, session timeout) |

## MED — Medicine Master
| ID | Type | Scenario |
|----|------|----------|
| SC-MED-1 | P | Create medicine with full attributes |
| SC-MED-2 | N | Empty name → 422 |
| SC-MED-3 | B | Name > 150 chars → rejected |
| SC-MED-4 | BR | Case-insensitive duplicate name per tenant → 409 |
| SC-MED-5 | N | Negative MRP/selling price → 422 |
| SC-MED-6 | B | GST rate outside 0–100 → 422 |
| SC-MED-7 | P | List with search (name/generic/manufacturer) |
| SC-MED-8 | P | Filter by category/form/schedule/status |
| SC-MED-9 | P | Update price/status; discontinue/ban |
| SC-MED-10 | P | Get by ID; get by barcode |
| SC-MED-11 | N | Get missing ID → 404 |
| SC-MED-12 | P | Soft-delete excludes from lists |
| SC-MED-13 | BR | Schedule field persists (H/H1/X/G/C/E) and drives Rx requirement |
| SC-MED-14 | SEC | Medicine scoped to tenant |
| SC-MED-15 | B | Pagination page/limit bounds |

## INV — Inventory / Stock
| ID | Type | Scenario |
|----|------|----------|
| SC-INV-1 | P | Add batch (batch no, expiry, prices, qty) |
| SC-INV-2 | N | Missing required batch fields → 422 |
| SC-INV-3 | BR | Expiry status computed vs tenant expiryAlertDays |
| SC-INV-4 | P | List filtered by status/expiryStatus/medicine |
| SC-INV-5 | P | Stats: counts by status + expiring_soon |
| SC-INV-6 | P | Adjust stock (addition/deduction/damage/correction) with reason |
| SC-INV-7 | BR | Adjustment writes StockMovement with prev/new qty |
| SC-INV-8 | BR | Status update accepts only valid InventoryStatus → else 422 |
| SC-INV-9 | B | Adjust to exactly 0 sets out_of_stock/exhausted |
| SC-INV-10 | N | Adjust below 0 prevented |
| SC-INV-11 | P | Batches + movements per medicine |
| SC-INV-12 | INT | Sale deducts correct batch; low_stock threshold flips status |
| SC-INV-13 | SEC | Inventory scoped to tenant |
| SC-INV-14 | P | AI insights endpoint returns structure |

## PUR — Purchase Invoices & Vendor Payments
| ID | Type | Scenario |
|----|------|----------|
| SC-PUR-1 | P | Create purchase invoice with items |
| SC-PUR-2 | P | Update invoice status (draft→confirmed→completed) |
| SC-PUR-3 | P | List/get invoice with items |
| SC-PUR-4 | P | Record vendor payment (cash/cheque/neft/upi/rtgs) |
| SC-PUR-5 | BR | Payment reduces vendor outstanding |
| SC-PUR-6 | N | Payment exceeding invoice / invalid mode handled |
| SC-PUR-7 | INT | Confirmed purchase can feed inventory batches |
| SC-PUR-8 | SEC | Scoped to tenant |

## BILL — Billing (POS)
| ID | Type | Scenario |
|----|------|----------|
| SC-BILL-1 | P | Create bill (walk-in) with items, GST, totals |
| SC-BILL-2 | P | Create bill for linked customer |
| SC-BILL-3 | N | Empty items array → 422 |
| SC-BILL-4 | BR | Bill number auto-increments per tenant (INV000001…) |
| SC-BILL-5 | BR | Inventory decremented per item on sale |
| SC-BILL-6 | BR | StockMovement (SALE) recorded with prev/new qty |
| SC-BILL-7 | BR | Customer stats updated (purchases, spend, loyalty=floor(total/100), lastVisit) |
| SC-BILL-8 | BR | GST computed correctly per line + bill total |
| SC-BILL-9 | BR | Discount (percent & amount) applied correctly |
| SC-BILL-10 | B | Quantity boundary (1, max stock, > stock) |
| SC-BILL-11 | BR | **Schedule H/H1/X requires doctor + patient → else 422** |
| SC-BILL-12 | BR | **Schedule drug sale auto-creates register entry** |
| SC-BILL-13 | P | Multiple payment methods (cash/card/upi/credit) |
| SC-BILL-14 | P | Get bill with items; list with filters |
| SC-BILL-15 | BR | Balance = total − paid; partial payment status |
| SC-BILL-16 | B | Money rounding to 2 decimals; no float drift |
| SC-BILL-17 | SEC | Bills scoped to tenant |
| SC-BILL-18 | INT | Bill against expired batch flagged/blocked |
| SC-BILL-19 | N | Bill referencing missing medicine/inventory handled |
| SC-BILL-20 | UX | Thermal 80mm receipt renders with GST + Sch-H warning |

## RX — Prescriptions
| ID | Type | Scenario |
|----|------|----------|
| SC-RX-1 | P | Create prescription with medicines |
| SC-RX-2 | N | Missing customerName → 422 |
| SC-RX-3 | N | Empty medicines array → 422 |
| SC-RX-4 | BR | Empty customerId coerced to null (no crash) |
| SC-RX-5 | BR | Rx number format RX-YYYY-#### increments |
| SC-RX-6 | BR | validUntil defaults +30 days |
| SC-RX-7 | P | Approve (pending_review→approved) |
| SC-RX-8 | P | Dispense (approved→dispensed) |
| SC-RX-9 | P | Reject with reason |
| SC-RX-10 | N | Invalid state transition prevented |
| SC-RX-11 | P | Stats + list filters |
| SC-RX-12 | SEC | Scoped to tenant |

## RET — Returns
| ID | Type | Scenario |
|----|------|----------|
| SC-RET-1 | P | Customer return with items + refund method |
| SC-RET-2 | P | Vendor return |
| SC-RET-3 | N | Missing type → 422 |
| SC-RET-4 | N | Empty items → 422 |
| SC-RET-5 | BR | Return number RET-YYYY-#### increments |
| SC-RET-6 | P | Approve (pending→approved) |
| SC-RET-7 | BR | Re-approving approved → 400 |
| SC-RET-8 | P | Process (approved→processed) |
| SC-RET-9 | P | Reject (pending→rejected) |
| SC-RET-10 | BR | Item condition (resaleable/damaged/expired) + restock flag |
| SC-RET-11 | INT | Resaleable processed return restocks inventory |
| SC-RET-12 | BR | Refund amount correctness |
| SC-RET-13 | SEC | Scoped to tenant |

## CUST — Customers
| ID | Type | Scenario |
|----|------|----------|
| SC-CUST-1 | P | Create customer |
| SC-CUST-2 | N | Missing name → 422 |
| SC-CUST-3 | B | Phone < 10 digits → 422 |
| SC-CUST-4 | BR | Duplicate phone per tenant → 409 |
| SC-CUST-5 | P | Update profile |
| SC-CUST-6 | P | List with search/type/status filters |
| SC-CUST-7 | P | Purchase history endpoint |
| SC-CUST-8 | BR | Stats (total/active/VIP/credit/new-this-month) |
| SC-CUST-9 | BR | Loyalty points accrue from billing |
| SC-CUST-10 | SEC | Scoped to tenant |

## VEN — Vendors
| ID | Type | Scenario |
|----|------|----------|
| SC-VEN-1 | P | Create vendor (GST no, payment terms, credit limit) |
| SC-VEN-2 | P | Update; activate/deactivate |
| SC-VEN-3 | P | List + stats (pending payments) |
| SC-VEN-4 | P | Invoices + payments per vendor |
| SC-VEN-5 | N | Invalid GST format handled (if validated) |
| SC-VEN-6 | SEC | Scoped to tenant |

## REORD — Reorder
| ID | Type | Scenario |
|----|------|----------|
| SC-REORD-1 | P | List reorder items by priority |
| SC-REORD-2 | BR | Priority ordering (critical→low) then daysStockLeft |
| SC-REORD-3 | P | Update status pending→ordered→received |
| SC-REORD-4 | P | Alerts list + acknowledge |
| SC-REORD-5 | BR | Stats counts (pending/critical/out-of-stock) |
| SC-REORD-6 | INT | Item below reorder level surfaces here |

## EXP — Expiry Monitor
| ID | Type | Scenario |
|----|------|----------|
| SC-EXP-1 | P | Batches grouped by expiry urgency |
| SC-EXP-2 | BR | Critical (≤30d), warning (≤90d), good thresholds |
| SC-EXP-3 | P | Filter by expiry status |
| SC-EXP-4 | BR | Update clearly-expired batch to expired |
| SC-EXP-5 | INT | Expiring counts feed dashboard + notifications |

## REP — Reports
| ID | Type | Scenario |
|----|------|----------|
| SC-REP-1 | P | Sales analytics for N days (summary + daily + top meds + category) |
| SC-REP-2 | N | days ≤ 0 or non-numeric → 400 |
| SC-REP-3 | BR | Totals reconcile with bills (revenue, GST, count) |
| SC-REP-4 | P | Report CSV export downloads valid CSV |
| SC-REP-5 | P | **GSTR-1: B2CS + HSN summary + docs sections** |
| SC-REP-6 | BR | GSTR-1 CGST=SGST, taxable+tax reconcile |
| SC-REP-7 | P | GSTR-1 CSV portal-format download |
| SC-REP-8 | P | Stock intelligence: dead stock, margins |
| SC-REP-9 | UX | No duplicate React keys with same-named data |
| SC-REP-10 | SEC | Scoped to tenant |

## SCHED — Schedule H/H1/X Register (Compliance)
| ID | Type | Scenario |
|----|------|----------|
| SC-SCHED-1 | P | Register lists dispensed scheduled drugs |
| SC-SCHED-2 | BR | Entry auto-created on scheduled-drug bill |
| SC-SCHED-3 | BR | Captures patient, age, doctor, reg no, batch, qty, date |
| SC-SCHED-4 | P | Stats by schedule (H/H1/X counts, this month) |
| SC-SCHED-5 | P | CSV export with statutory columns |
| SC-SCHED-6 | SEC | Scoped to tenant |
| SC-SCHED-7 | BR | Non-scheduled drug does NOT create entry |

## NOTIF — Notifications
| ID | Type | Scenario |
|----|------|----------|
| SC-NOTIF-1 | P | List with category/priority/unread filters |
| SC-NOTIF-2 | N | Invalid category → 400 |
| SC-NOTIF-3 | P | Mark single read; mark all read |
| SC-NOTIF-4 | BR | Unread stats by priority |
| SC-NOTIF-5 | INT | Low-stock/expiry jobs create notifications |
| SC-NOTIF-6 | SEC | Scoped to tenant |

## AUD — Audit Log
| ID | Type | Scenario |
|----|------|----------|
| SC-AUD-1 | P | Paginated log with module/action/user/severity filters |
| SC-AUD-2 | BR | Login, bill, medicine, user, settings actions logged |
| SC-AUD-3 | BR | Failed login logged as critical/failed |
| SC-AUD-4 | P | Sessions + security events endpoints |
| SC-AUD-5 | P | Stats (today, critical, failed, active users) |
| SC-AUD-6 | SEC | Audit read gated + tenant-scoped |
| SC-AUD-7 | SEC | Audit entries immutable via API |

## SET — Settings
| ID | Type | Scenario |
|----|------|----------|
| SC-SET-1 | P | Get all sections (profile/system/tax/billing/notifications) |
| SC-SET-2 | P | PATCH each section persists (inline response, no auth-dropping redirect) |
| SC-SET-3 | BR | Numeric bounds (thresholds, timeout, GST) |
| SC-SET-4 | P | Backup produces real file + size + record count |
| SC-SET-5 | P | Export each type returns real CSV (BOM, escaped) |
| SC-SET-6 | P | Import valid rows inserted; counts returned |
| SC-SET-7 | N | Import invalid row reports row-level error, skips |
| SC-SET-8 | SEC | Import/export gated by permission + tenant |
| SC-SET-9 | SEC | CSV formula-injection neutralized on export |
| SC-SET-10 | P | Import template columns returned |

## INTG — Cross-Module Integration
| ID | Type | Scenario |
|----|------|----------|
| SC-INTG-1 | INT | Purchase → inventory batch → billing deduction → movement chain |
| SC-INTG-2 | INT | Billing → customer stats → loyalty → refill reminder |
| SC-INTG-3 | INT | Scheduled-drug bill → register + audit + inventory |
| SC-INTG-4 | INT | Bill → reports (sales + GSTR-1) reconciliation |
| SC-INTG-5 | INT | Return → inventory restock → movement |
| SC-INTG-6 | INT | Low stock → reorder queue → notification |
| SC-INTG-7 | INT | Expiry threshold → expiry monitor → dashboard alert → notification |
| SC-INTG-8 | INT | Role/permission change → token → endpoint access |
| SC-INTG-9 | INT | User deactivate → login blocked → audit event |
| SC-INTG-10 | INT | Medicine soft-delete → excluded from billing search |

## SECX — Security (system-wide, OWASP)
| ID | Type | Scenario |
|----|------|----------|
| SC-SECX-1 | SEC | A01 Broken access control — cross-tenant + privilege escalation |
| SC-SECX-2 | SEC | A03 Injection — SQL/NoSQL via search, filters, IDs |
| SC-SECX-3 | SEC | A03 XSS — stored/reflected in text fields |
| SC-SECX-4 | SEC | A02 Crypto — passwords bcrypt-hashed, tokens signed |
| SC-SECX-5 | SEC | A07 Auth failures — lockout, weak-password rejection |
| SC-SECX-6 | SEC | A05 Misconfig — Helmet headers, CORS allow-list |
| SC-SECX-7 | SEC | A04 Rate limiting on auth + API |
| SC-SECX-8 | SEC | A08 Mass assignment (extra fields ignored) |
| SC-SECX-9 | SEC | IDOR on record IDs across tenants |
| SC-SECX-10 | SEC | Sensitive data not leaked (password hash, tokens) in responses |
| SC-SECX-11 | SEC | JWT tamper/none-alg/expired rejected |
| SC-SECX-12 | SEC | Oversized payload / malformed JSON handled |

## PERFX — Performance & Reliability
| ID | Type | Scenario |
|----|------|----------|
| SC-PERFX-1 | PERF | Baseline latency per hot endpoint < target |
| SC-PERFX-2 | PERF | 10 conns @ realistic peak: p95 < 300ms, 0 errors |
| SC-PERFX-3 | PERF | Burst 150 rapid requests: no false 429 under normal use |
| SC-PERFX-4 | PERF | Dashboard cache reduces DB load under concurrency |
| SC-PERFX-5 | PERF | Sustained soak: no memory leak / degradation |
| SC-PERFX-6 | PERF | Spike then recovery: latency normalizes |
| SC-PERFX-7 | PERF | DB pool (20) not exhausted under concurrency |

---

## Scenario totals

| Area | Count | Area | Count |
|------|-------|------|-------|
| AUTH | 25 | RET | 13 |
| DASH | 10 | CUST | 10 |
| USR | 12 | VEN | 6 |
| ROLE | 9 | REORD | 6 |
| TEN | 6 | EXP | 5 |
| MED | 15 | REP | 10 |
| INV | 14 | SCHED | 7 |
| PUR | 8 | NOTIF | 6 |
| BILL | 20 | AUD | 7 |
| RX | 12 | SET | 10 |
| INTG | 10 | SECX | 12 |
| PERFX | 7 | | |
| **TOTAL** | **240 master scenarios** | | |

Each scenario expands into multiple step-level executable test cases in Phase 4 (per-module workbooks) targeting 250–500+ cases per major module.

**Phase 2 status: COMPLETE.** Proceeding to Phase 3 — Authentication & Authorization.
