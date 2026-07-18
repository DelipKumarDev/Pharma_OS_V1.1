# PharmaOS — QA Phase 1: Test Strategy & Planning

**Document ID:** QA-STRAT-01
**Product:** PharmaOS Pharmacy Management SaaS
**Version under test:** V1.2.1 (commit `04a517c`)
**QA organization:** Independent Enterprise QA
**Date:** 2026-07-15
**Prepared against:** PHARMAOS_BIBLE.md (Product Bible)

---

## 1. Purpose & Scope

### 1.1 Purpose
This document defines the QA strategy governing the certification of PharmaOS for production release to real pharmacy customers. It establishes scope, risk posture, test types, environments, data strategy, entry/exit criteria, and defect governance. No functionality is assumed to work; every business rule, validation, workflow, permission, API, UI element, integration, and security control is treated as unverified until evidenced.

### 1.2 In Scope
| Area | Coverage |
|------|----------|
| Web application (`apps/web`) | All 21 frontend modules/pages |
| REST API (`apps/api`) | All 19 route groups, ~120 endpoints |
| Database (PostgreSQL via Prisma) | 28 models, referential integrity, migrations |
| Authentication & Authorization | JWT, refresh rotation, lockout, RBAC (31 permissions, 5 roles) |
| Multi-tenancy | Tenant data isolation |
| Regulatory compliance | Schedule H/H1/X register, GSTR-1 |
| Integrations | Email (SMTP), SMS/WhatsApp, CSV import/export, backup, printing |
| Non-functional | Performance, reliability, security (OWASP), UI/UX, accessibility |

### 1.3 Out of Scope (this cycle)
| Area | Reason |
|------|--------|
| Offline-first sync (IndexedDB/ServiceWorker) | Not implemented — screen is a placeholder (Bible §15) |
| OCR invoice scanning | Field exists, no processing engine wired (Bible §15) |
| GSTR-3B, e-invoice IRN | Not implemented |
| Live third-party gateway delivery (real SMS/email send) | Requires paid provider accounts; tested via provider-stub + console fallback |
| Load beyond single-node (horizontal scaling, Redis cache) | Single-node deployment target for pilot |
| Native mobile apps | Product is responsive web only |

---

## 2. Quality Objectives & Acceptance Thresholds

| Objective | Metric | Target |
|-----------|--------|--------|
| Functional correctness | Test cases passed | ≥ 98% pass, 0 open Critical/High |
| Regulatory compliance | Schedule H + GSTR-1 test cases | 100% pass (zero tolerance) |
| Tenant isolation | Cross-tenant access attempts blocked | 100% |
| API contract | Endpoints returning correct status + envelope | 100% of tested endpoints |
| Security | OWASP Top-10 checks | 0 High/Critical unresolved |
| Performance | p95 latency on hot endpoints @ realistic peak | < 300 ms |
| Reliability | Sustained load error rate | < 0.5% |
| Availability of core flow | Login → bill → print happy path | Must never fail |

---

## 3. Test Levels & Types

| Level / Type | Phase | Technique | Evidence |
|--------------|-------|-----------|----------|
| Component/API | 7 | Black-box HTTP, contract testing | Request/response captures |
| Functional (per module) | 4 | Positive, negative, boundary, business-rule | Excel workbooks + live execution |
| Integration (cross-module) | 5 | Data-flow across modules | Traced scenarios |
| System / Workflow (E2E) | 6 | Real user journeys | Step logs + screenshots |
| Authentication/Authorization | 3 | Permission matrix, token lifecycle | Test cases + live probes |
| Security | 8 | OWASP Top-10, authz bypass, injection | Attack logs |
| UI/UX & Accessibility | 9 | Heuristic + WCAG 2.1 AA | Findings register |
| Performance & Reliability | 10 | Load, soak, spike (autocannon) | Latency reports |
| Regression / Smoke / Sanity | 11 | Suite re-execution | Suite results |
| Certification | 12 | Exit-criteria audit | Sign-off report |

---

## 4. Test Environment

| Component | Configuration |
|-----------|---------------|
| API | `apps/api` Express on `localhost:4000`, `tsx` runtime |
| Web | `apps/web` Next.js 15 on `localhost:3000/3001` |
| Database | PostgreSQL 15, DB `pharmaos_dev`, connection_limit=20 |
| Auth | JWT access 15m / refresh 7d rotated |
| Rate limits (dev) | 1000 req/min global, 5/15min auth |
| Seed data | Divya Pharmacy (`tnt_001`), 4 users, 5 roles, 31 permissions, 10 medicines + inventory |
| Test tooling | PowerShell/Node HTTP harness, autocannon (load), Preview browser (UI) |

### 4.1 Environment Risks
- Dev DB contains QA residue from prior cycles (QA-* customers/bills). Isolation tests must use freshly created, uniquely-named entities (timestamp suffixes).
- SMTP/SMS unconfigured in dev → delivery verified via console-fallback assertion, not real inbox.

---

## 5. Test Data Strategy

| Data class | Approach |
|------------|----------|
| Reference (medicines, tenants, roles) | Use seed; extend via API |
| Transactional (bills, prescriptions, returns) | Created fresh per run with unique suffixes to avoid 409 residue collisions |
| Boundary values | Explicit min/max/empty/oversized sets per field |
| Negative/malicious | Injection strings, oversized payloads, malformed JSON, wrong types |
| Scheduled-drug data | At least one Schedule H, H1, X medicine required for compliance tests |
| Multi-tenant | Second tenant provisioned to prove isolation |

---

## 6. Risk Assessment (Product Risk Register)

| # | Risk | Likelihood | Impact | Exposure | Mitigation / Test focus |
|---|------|-----------|--------|----------|-------------------------|
| R1 | Schedule H/H1/X dispensed without register entry → **legal violation** | Med | Critical | **HIGH** | Phase 4 Billing + Phase 5 integration: enforce doctor+patient, verify auto register write |
| R2 | GST figures wrong → tax filing penalties | Med | Critical | **HIGH** | Phase 4 Reports/Billing: GST math, GSTR-1 aggregation |
| R3 | Cross-tenant data leakage | Low | Critical | **HIGH** | Phase 3 + Phase 8: every list/detail endpoint filtered by tenant |
| R4 | Inventory oversell / negative stock | Med | High | **HIGH** | Phase 4 Inventory/Billing: deduction, concurrency, floor at 0 |
| R5 | Auth bypass / privilege escalation | Low | Critical | **HIGH** | Phase 3 + Phase 8: RBAC on every mutating endpoint |
| R6 | Money math errors (discount, refund, loyalty) | Med | High | **HIGH** | Phase 4 Billing/Returns: rounding, precision |
| R7 | Loading failures under multi-terminal load (429s) | Was HIGH | High | **Mitigated V1.2.1** | Phase 10 re-verify: rate limit + dashboard cache |
| R8 | Data loss on backup/restore | Low | High | Med | Phase 4 Settings: backup integrity |
| R9 | Duplicate records (medicine, customer phone) | Med | Med | Med | Phase 4: uniqueness constraints |
| R10 | Expiry not flagged → expired sale | Low | High | Med | Phase 4 Expiry/Billing: expiry status computation |
| R11 | Import corrupts master data | Med | Med | Med | Phase 4 Settings: row validation, partial-failure handling |
| R12 | Session/token mishandling (no logout, stale token) | Low | Med | Med | Phase 3: token lifecycle |

---

## 7. Entry Criteria

QA execution of a phase begins only when:
1. Product Bible is current and readable (✅ present).
2. API and Web build successfully (`tsc --noEmit` clean, `next build` passes — ✅ verified V1.2.1).
3. Test environment is up (API health 200, DB connected).
4. Seed data loaded and demo credentials valid.
5. The prior phase's exit criteria are met and approved.

## 8. Exit Criteria (per phase and overall)

A phase is **complete** when:
1. All planned test cases for the phase are executed (no silent skips).
2. Every executed case has Actual Result + Status recorded.
3. All Critical and High defects are fixed and re-verified, or formally accepted with justification.
4. Deliverable artifact is produced and stored under `qa/`.

**Production certification (Phase 12)** requires:
- 0 open Critical, 0 open High defects.
- 100% pass on compliance (Schedule H, GSTR-1) and tenant-isolation suites.
- Regression suite green.
- Performance targets met.
- Documented residual risk accepted by product owner.

---

## 9. Defect Management

### 9.1 Severity
| Severity | Definition |
|----------|-----------|
| Critical | Data loss, legal/compliance breach, auth bypass, core flow down, money incorrect |
| High | Major function broken, no workaround, wrong business rule |
| Medium | Function broken with workaround, minor rule deviation |
| Low | Cosmetic, minor UX, non-blocking |

### 9.2 Priority
P1 (fix now / blocker) · P2 (fix this cycle) · P3 (schedule) · P4 (backlog).

### 9.3 Lifecycle
`New → Triaged → In Progress → Fixed → Re-test → Closed` (or `Rejected` / `Deferred` with reason). Every defect maps to a Test Case ID and a Requirement (Bible section).

### 9.4 Defect Log fields
ID, Title, Module, Test Case ID, Severity, Priority, Steps to Reproduce, Expected, Actual, Evidence, Status, Fix commit, Re-test result.

---

## 10. Traceability

Every test case carries a **Requirement Mapping** to a Product Bible section (e.g., `Bible §7 Billing`, `Bible §10 Business Logic`). Phase 12 audits coverage: each in-scope requirement must map to ≥1 executed test case.

---

## 11. Phase Plan & Deliverables

| Phase | Deliverable | File |
|-------|-------------|------|
| 1 | QA Strategy (this doc) | `qa/PHASE-01-QA-Strategy.md` |
| 2 | Master Scenario Catalog | `qa/PHASE-02-Scenario-Catalog.md` |
| 3 | Auth & Authz test cases + live results | `qa/PHASE-03-Auth-Authorization.md` |
| 4 | Per-module Excel workbooks (250–500+ cases each) | `qa/workbooks/*.xlsx` |
| 5 | Integration testing | `qa/PHASE-05-Integration.md` |
| 6 | Workflow (E2E) testing | `qa/PHASE-06-Workflows.md` |
| 7 | API testing + live results | `qa/PHASE-07-API-Testing.md` |
| 8 | Security (OWASP) | `qa/PHASE-08-Security.md` |
| 9 | UI/UX & Accessibility | `qa/PHASE-09-UIUX-Accessibility.md` |
| 10 | Performance & Reliability | `qa/PHASE-10-Performance.md` |
| 11 | Regression / Smoke / Sanity | `qa/PHASE-11-Regression.md` |
| 12 | Final QA Certification | `qa/PHASE-12-Certification.md` |

---

## 12. Approvals

| Role | Name | Decision | Date |
|------|------|----------|------|
| QA Lead | Independent QA | Strategy approved for execution | 2026-07-15 |
| Product Owner | (pending) | | |

**Phase 1 status: COMPLETE.** Proceeding to Phase 2 — Master Test Scenario Identification.
