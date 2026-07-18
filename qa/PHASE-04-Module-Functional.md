# PharmaOS — QA Phase 4: Module Functional Testing

**Document ID:** QA-FUNC-04
**Version under test:** V1.2.2
**Execution:** Live HTTP against `localhost:4000`, harness `phase4-run.js`
**Deliverables:** 13 Excel workbooks in `qa/workbooks/` + `qa/phase4-results.csv`
**Date:** 2026-07-15

---

## 1. Summary

| Metric | Value |
|--------|-------|
| Modules tested | 13 (of 14; Offline deferred — not implemented) |
| Test cases executed | 101 |
| Passed | 101 |
| Failed | 0 |
| Product defects found | 0 new (3 initial failures were test-data issues, corrected) |

Every case was **executed live** against the running API and its real Actual Result recorded — not authored on paper. Each module has its own Excel workbook (Test Cases + Summary + Defect Log sheets) matching the roadmap's required columns.

---

## 2. Per-Module Results

| # | Module | Cases | Pass | Fail | Workbook |
|---|--------|-------|------|------|----------|
| 1 | Dashboard | 7 | 7 | 0 | PharmaOS-Dashboard-TestCases.xlsx |
| 2 | User Management | 11 | 11 | 0 | PharmaOS-User-Management-TestCases.xlsx |
| 3 | Tenant | 6 | 6 | 0 | PharmaOS-Tenant-TestCases.xlsx |
| 4 | Medicine Master | 12 | 12 | 0 | PharmaOS-Medicine-Master-TestCases.xlsx |
| 5 | Inventory | 10 | 10 | 0 | PharmaOS-Inventory-TestCases.xlsx |
| 6 | Purchase | 6 | 6 | 0 | PharmaOS-Purchase-TestCases.xlsx |
| 7 | Billing | 9 | 9 | 0 | PharmaOS-Billing-TestCases.xlsx |
| 8 | Customer | 8 | 8 | 0 | PharmaOS-Customer-TestCases.xlsx |
| 9 | Vendor | 5 | 5 | 0 | PharmaOS-Vendor-TestCases.xlsx |
| 10 | Reports | 8 | 8 | 0 | PharmaOS-Reports-TestCases.xlsx |
| 11 | Notifications | 5 | 5 | 0 | PharmaOS-Notifications-TestCases.xlsx |
| 12 | Audit | 6 | 6 | 0 | PharmaOS-Audit-TestCases.xlsx |
| 13 | Settings | 8 | 8 | 0 | PharmaOS-Settings-TestCases.xlsx |
| 14 | Offline | — | — | — | **DEFERRED** — feature not implemented (Bible §15) |
| | **TOTAL** | **101** | **101** | **0** | |

---

## 3. Coverage per test type

Each module exercised a mix of: **Positive/Functional** (happy path), **Negative** (invalid input), **Boundary** (limits), **Business Rule** (numbering, duplicates, computed values), **Security** (RBAC denial + tenant isolation), and **Compliance** (Schedule H, GSTR-1). Highlights:

- **RBAC enforcement** re-verified in-context per module — the Billing Assistant is denied `user:create`, user list, `medicine:create`, `inventory:create`, audit read, `settings:view`, data export, and tenant delete (all 403), while allowed its own `billing:view`.
- **Tenant isolation** — tenant list returns only the caller's own org; reading/modifying another tenant id returns 404.
- **Compliance** — Schedule-H bill without a doctor rejected (422); with doctor accepted (201) and a register entry auto-created; GSTR-1 returns B2CS + HSN + docs with CGST=SGST.
- **Business rules** — bill numbers auto-increment (`INV…`), duplicate medicine name / customer phone / user email rejected (409), negative price and GST>100 rejected (422).

---

## 4. Initial failures (all resolved as test-data issues, no product defect)

| Case | Initial result | Root cause | Resolution |
|------|---------------|-----------|-----------|
| TC-BILL-002 Create walk-in bill | 422 (exp 201) | Harness used `medList[0]` = Amoxicillin (Schedule H); a walk-in bill without a doctor is **correctly** rejected by the compliance rule | Harness picks a non-scheduled medicine; product behaviour is correct |
| TC-BILL-003 Bill number | undefined | Cascade of the above (no bill created) | Resolved with TC-BILL-002 |
| TC-PUR-002 Create purchase invoice | 400 (exp 201) | Harness item omitted `expiryDate`/`batchNumber`; Prisma rejected the malformed item | Harness sends complete item. **Minor robustness note** logged below |

### Robustness note (Low severity, not blocking)
`POST /api/purchase-invoices` relies on Prisma to reject malformed line items (→ 400) rather than validating input up front and returning a clean 422 with a field message. Behaviour is safe (bad data is rejected) but the error is less friendly than the rest of the API. Recommended for a future hardening pass; captured as coverage in TC-PUR-004.

---

## 5. Exit Criteria

| Criterion | Status |
|-----------|--------|
| All planned module cases executed live | ✅ 101/101 |
| Actual results recorded per case | ✅ (workbooks + CSV) |
| 0 open Critical/High defects | ✅ none found |
| Per-module deliverable produced | ✅ 13 workbooks |

**Phase 4 status: COMPLETE.** Proceeding to Phase 5 — Cross-Module Integration.
