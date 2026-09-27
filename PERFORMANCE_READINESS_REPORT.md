# PharmaOS — Performance & Concurrency Readiness (Phase 10)

**Date:** 2026-09-26
**Approach:** Evidence-first — measure realistic pharmacy workloads, then optimize **only** where data shows a problem.
**Result:** ✅ **No endpoint exceeds 800 ms p95** at realistic single-store scale; all concurrency runs completed with **0 errors**. No code change is warranted for a 1–2 store pilot. One scaling watch-point (reports) is documented with a concrete fix for higher volume.
**Reproduce:** `pnpm --filter @pharmaos/api test:perf` (seeds a throwaway tenant, self-cleaning) · **Log:** `Testing/Phase 2 Testing/perf-run.log`.

---

## 1. Test dataset (realistic single store)

1000 medicines · 1000 inventory batches · 500 customers · 800 bills (+ 800 bill items) spread across ~85 days. DB: PostgreSQL, `connection_limit=20`.

## 2. Endpoint latency (single request, ms)

| Endpoint | p50 | p95 | Notes |
|---|---|---|---|
| `POST /auth/login` | 122 | 130 | bcrypt-bound (expected; cost 12 in prod) |
| `GET /dashboard` | 7 | 252 | fast (p95 = first-call warmup) |
| `GET /medicines?limit=20` | 14 | 32 | paginated |
| `GET /medicines?search=…` | 15 | 16 | indexed list |
| `GET /search?q=…` | 22 | 44 | bounded (≤24) |
| `GET /inventory?limit=50` | 21 | 35 | paginated |
| `GET /inventory/stats` | 168 | 192 | per-medicine aggregation |
| `GET /customers?limit=50` | 14 | 21 | paginated |
| `GET /billing?limit=50` | 22 | 36 | paginated |
| `GET /reports?days=30` | 181 | 192 | heaviest read path |
| `GET /reports?days=90` | 366 | 460 | scales with period |

**All p95 < 500 ms** at this scale. No pathologically slow endpoint.

## 3. Concurrency

| Scenario | Wall | Throughput | OK |
|---|---|---|---|
| 30× `GET /medicines` | 267 ms | ~112 req/s | 30/30 |
| 30× `GET /inventory` | 398 ms | ~75 req/s | 30/30 |
| 20× `GET /reports?days=30` | 4380 ms | ~5 req/s | 20/20 |
| 10× `POST /auth/login` | 650 ms | ~15 req/s | 10/10 |

Read-heavy endpoints handle 30 concurrent requests comfortably. **Reports are the weakest under concurrency** (~5 req/s) — see §5. **No connection-pool exhaustion, no errors** anywhere.

## 4. Bottleneck analysis

- **N+1 queries:** none in the measured hot paths. List endpoints are single queries; reports do a handful of `findMany` + in-JS reduce (not per-row queries). Billing does one FEFO lookup **per cart line** — bounded by cart size, necessary for batch selection.
- **Missing indexes:** tenant tables are well-indexed (`@@index([tenantId])` + composites; verified Phase 3). The only candidate is a composite `(tenantId, medicineId, expiryDate)` on `inventory_items` for FEFO — **not applied**, because no measured query is slow enough to justify it (inventory/stats 168 ms, billing lookups fast). Recommended if inventory grows to tens of thousands of batches.
- **Unbounded queries:** the **reports** module fetches all bills + bill-items in the period without a `take` (bounded only by the date range). Fine at pilot volume (measured 800 bills → <500 ms); grows linearly with volume — see §5.
- **Large payloads:** list endpoints are paginated (≤50–100); search bounded (≤24). No oversized responses.
- **Memory / connection pool:** 20-connection pool absorbed 30 concurrent reads with 0 errors; reports-heavy concurrency queued but completed. No leak observed across ~200 timed requests.
- **Login:** ~120 ms, dominated by bcrypt (intentional cost). Not a concern at pharmacy login rates.

## 5. Scaling watch-point — reports (documented, not optimized)

At high volume (many months × hundreds of bills/day), `GET /reports?days=90` and concurrent report loads will grow because the module **loads all bills + items into memory** and aggregates in JS. **Not a pilot problem** (measured <500 ms at 800 bills), so per the "don't prematurely optimize" rule it is left as-is. When volume warrants:
- Replace the fetch-all-then-reduce with **SQL aggregation** (`groupBy` + `_sum` on `numeric` columns — now exact after the Decimal migration) for totals/by-day/by-payment.
- Add the `(tenantId, medicineId, expiryDate)` FEFO index and, if needed, a `(tenantId, createdAt)` index on `bills` for period scans.
- Consider a short cache / materialized daily rollup for dashboards.

## 6. Status

| Item | Status |
|---|---|
| Endpoint latency at realistic scale | **PASS** (all p95 < 500 ms) |
| Concurrent reads (30×) | **PASS** (0 errors) |
| Concurrent billing correctness | **PASS** (Phase 3: no oversell under load) |
| N+1 / unbounded / index review | **PASS** (only reports flagged for scale) |
| Connection pool under load | **PASS** (no exhaustion/errors) |
| Optimization needed for pilot | **None** (evidence-based) |
| Reports at high volume | **Watch-point** (fix documented, §5) |

*The system performs well within a controlled pilot's workload; no optimization is applied because measurements show no problem. The single scaling watch-point (reports aggregation) is documented with a concrete plan. Phase 10 complete.*
