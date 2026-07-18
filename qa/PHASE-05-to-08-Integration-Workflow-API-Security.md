# PharmaOS — QA Phases 5–8: Integration · Workflow · API · Security

**Document ID:** QA-IWAS-05-08
**Version under test:** V1.2.2 (+ malformed-JSON & dashboard single-flight fixes)
**Execution:** Live HTTP, harness `phase5to8.js`, results `qa/phase5to8-results.csv`
**Date:** 2026-07-15

| Phase | Focus | Cases | Pass | Fail |
|-------|-------|-------|------|------|
| 5 | Cross-module integration | 10 | 10 | 0 |
| 6 | End-to-end workflows | 5 | 5 | 0 |
| 7 | API contract | 10 | 10 | 0 |
| 8 | Security (OWASP) | 14 | 14 | 0 |
| | **Total** | **39** | **39** | **0** |

---

## Phase 5 — Cross-Module Integration

Verifies data flows correctly *across* module boundaries (where bugs hide at the seams).

| ID | Integration chain verified | Result |
|----|----------------------------|--------|
| INT-001/002/003 | Add batch → sell against it → **inventory decremented by exact qty sold** | PASS |
| INT-004 | Sale writes a `StockMovement` of type SALE | PASS |
| INT-005 | Bill updates customer `totalSpend` | PASS |
| INT-006 | Loyalty points accrue = floor(spend/100) | PASS |
| INT-007 | **Scheduled-drug bill auto-creates a Schedule-H register entry** (count +1) | PASS |
| INT-008 | Today's bills reconcile into the sales report | PASS |
| INT-009 | Billing token carries only granted permissions (billing:create yes, users:create no) | PASS |
| INT-010 | Soft-deleted medicine excluded from listings | PASS |

## Phase 6 — End-to-End Workflows

Real user journeys through the actual API, start to finish.

| ID | Workflow | Steps | Result |
|----|----------|-------|--------|
| WF-001 | Retail sale: customer → add stock → bill → fetch receipt | 4/4 | PASS |
| WF-002 | Prescription: create → approve → dispense | 3/3 | PASS |
| WF-003 | Return: create → approve → process | 3/3 | PASS |
| WF-004 | Re-approving an approved return is rejected (400) | — | PASS |
| WF-005 | Procurement: vendor → purchase invoice → payment | 3/3 | PASS |

## Phase 7 — API Contract

| ID | Contract rule | Result |
|----|---------------|--------|
| API-001 | Success envelope has `success`+`data`+`timestamp` | PASS |
| API-002 | Paginated payload has `data`+`total`+`page`+`totalPages` | PASS |
| API-003 | 404 returns `success:false` | PASS |
| API-004 | Missing token → 401 | PASS |
| API-005 | Validation error → 422 | PASS |
| API-006 | Unknown route → 404 | PASS |
| API-007 | Unsupported method → 404/405 | PASS |
| API-008 | `/health` public 200 | PASS |
| API-009 | Pagination `limit` respected | PASS |
| API-010 | Responses are JSON | PASS |

## Phase 8 — Security (OWASP Top-10)

| ID | Check | OWASP | Result |
|----|-------|-------|--------|
| SEC-A01-1 | Billing role denied `user:create` | A01 | PASS |
| SEC-A01-2 | Tenant list self-scoped only | A01 | PASS |
| SEC-A01-3 | Cross-tenant read (IDOR) → 404 | A01 | PASS |
| SEC-A03-1 | SQL-injection string in search handled safely (parameterized via Prisma) | A03 | PASS |
| SEC-A03-2 | XSS payload stored as literal data, no server error | A03 | PASS |
| SEC-A02-1 | **No `passwordHash` leaked in login response** | A02 | PASS |
| SEC-A07-1 | Weak password rejected | A07 | PASS |
| SEC-JWT-1 | Tampered JWT rejected (401) | A02 | PASS |
| SEC-JWT-2 | `alg:none` forged token rejected (401) | A02 | PASS |
| SEC-A08-1 | Mass-assignment of `tenantId`/`id` ignored | A08 | PASS |
| SEC-A05-1 | Helmet `X-Content-Type-Options: nosniff` present | A05 | PASS |
| SEC-A04-1 | Auth rate limiting configured (per DEF-002) | A04 | PASS |
| SEC-INP-1 | Oversized payload rejected (4xx, not 500) | — | PASS |
| SEC-INP-2 | **Malformed JSON → 400** (was 500 — DEF-004, fixed) | — | PASS |

### DEF-004 — Malformed JSON body returned 500 (fixed)
| Field | Value |
|-------|-------|
| Severity | Low → Medium (robustness) |
| Found by | SEC-INP-2 |
| Status | **FIXED & RE-VERIFIED** |

A request body with invalid JSON hit Express's body-parser, which throws a `SyntaxError` tagged `type: 'entity.parse.failed'`; the error handler didn't recognize it and fell through to a generic 500. Fixed: the error handler now maps body-parser errors to their proper HTTP status (malformed JSON → 400, oversized → 413). Re-verified: malformed JSON now returns 400.

---

## Notes / observations

- **Item-level validation is inconsistent (Low).** `prescriptions`, `returns`, and `purchase-invoices` validate top-level fields (customerName, type, etc.) but pass line-items straight to Prisma, so a malformed item yields a generic `400 "Invalid data provided"` rather than a field-specific 422. Behaviour is safe (bad data rejected) but the message is less helpful. Recommended for a future hardening pass — not blocking.
- **Dashboard cache stampede (Low, mitigated).** A cold dashboard cache under concurrent load briefly ran the heavy query multiple times. Added single-flight dedup so concurrent misses share one computation. Post-fix (warm): dashboard p50 10ms, p99 33ms.

**Phases 5–8 status: COMPLETE.** All 39 executed cases pass; DEF-004 fixed and re-verified.
