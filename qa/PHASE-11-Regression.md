# PharmaOS — QA Phase 11: Regression / Smoke / Sanity

**Document ID:** QA-REG-11
**Version under test:** V1.2.2 (+ malformed-JSON & single-flight fixes)
**Date:** 2026-07-15

---

## 1. Regression suite (full re-execution after all fixes)

After applying every fix from Phases 3–10 (RBAC guards, auth limiter, malformed-JSON handling, dashboard single-flight, seed role grants), the complete executed suite was re-run to confirm no regressions.

| Suite | Cases | Pass | Fail |
|-------|-------|------|------|
| Phase 3 — Auth & Authorization | 33 | 33 | 0 |
| Phase 4 — Module functional | 101 | 101 | 0 |
| Phases 5–8 — Integration/Workflow/API/Security | 39 | 39 | 0 |
| **Total regression** | **173** | **173** | **0** |

**Result: GREEN. Zero regressions.**

## 2. Smoke suite (critical-path, must-never-break)

| # | Smoke check | Result |
|---|-------------|--------|
| S1 | Admin login issues tokens | PASS |
| S2 | Dashboard loads (cached) | PASS |
| S3 | Create bill (walk-in) end-to-end with inventory deduction | PASS |
| S4 | Schedule-H bill blocked without doctor / allowed with doctor + register entry | PASS |
| S5 | GSTR-1 report generates (JSON + CSV) | PASS |
| S6 | RBAC: billing role denied admin actions | PASS |
| S7 | Tenant isolation: cross-tenant read → 404 | PASS |
| S8 | Backup produces real file | PASS |

## 3. Sanity checks (build & type integrity)

| Check | Result |
|-------|--------|
| API `tsc --noEmit` | ✅ clean |
| Web `next build` (29 routes) | ✅ pass (verified earlier this cycle) |
| Prisma migrate deploy on fresh DB | ✅ 32 tables (verified V1.2.1 audit) |

**Phase 11 status: COMPLETE.** Regression green (173/173), smoke green (8/8), sanity green.
