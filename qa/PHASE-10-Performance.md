# PharmaOS — QA Phase 10: Performance & Reliability

**Document ID:** QA-PERF-10
**Version under test:** V1.2.2 (+ dashboard single-flight)
**Tooling:** Node HTTP timing harness + autocannon
**Environment:** Single-node dev (API `tsx` on :4000, PostgreSQL 15, pool=20), warmed before measurement
**Date:** 2026-07-15

---

## 1. Baseline latency (warm, single request, median of 5)

| Endpoint | Median | Notes |
|----------|--------|-------|
| Dashboard (cached) | 6–10 ms | 195 ms cold, then cached 30s |
| Medicines list | 16 ms | |
| Medicines search | 29 ms | |
| Inventory list | 11 ms | |
| Billing list | 15 ms | |
| Reports 30d | 22 ms | |
| Customers/Vendors/Notifications/Reorder | 5–14 ms | |

All comfortably under the 300 ms target.

## 2. Concurrent load (autocannon, 10 connections @ 12 req/s, warmed)

| Endpoint | p50 | p97.5 | p99 | Errors |
|----------|-----|-------|-----|--------|
| Dashboard (cached + single-flight) | 10 ms | ~30 ms | 33 ms | 0 |
| Medicines search | 18 ms | 88 ms | ~100 ms | 0 |
| Billing list | 15 ms | 52 ms | 57 ms | 0 |
| Reports 30d | 36 ms | 108 ms | 127 ms | 0 |

**Target (p95 < 300 ms at realistic peak): MET on all hot endpoints. Error rate 0%.**

## 3. Rate-limit regression (the original "loading failure" symptom)

| Test | Result |
|------|--------|
| Burst of 150 rapid authenticated requests | **150 × 200 OK, 0 × 429** |

Confirms the V1.2.1 rate-limit fix (per-minute DoS ceiling instead of 100/15min) holds — normal multi-page app usage no longer trips 429s. Auth limiter (V1.2.2) now counts only failed logins.

## 4. Reliability notes

- **Dashboard cache** (30 s TTL) + **single-flight** dedup: concurrent cold-cache requests share one computation (no stampede). Warm p99 33 ms.
- **DB connection pool** raised to 20 (`connection_limit`); not exhausted under the tested concurrency.
- **Cold start:** immediately after an API restart, the first ~10 s shows elevated latency (V8/tsx JIT + pool warmup). In production the process runs continuously, so this is a restart artifact, not a steady-state concern. Recommend a warmup ping in the container healthcheck.

## 5. Findings

No performance defects. One operational recommendation:
- **[Ops, Low]** Add a post-deploy warmup hit to `/api/dashboard` and `/health` so the first real user after a deploy doesn't absorb cold-start latency.

**Phase 10 status: COMPLETE.** Performance targets met; 0% error rate under load.
