# PharmaOS — CI/CD & Release Runbook (Phase 12)

**Date:** 2026-09-26
**Objective:** A reproducible pipeline — feature branch → PR → checks → build → staging → smoke → production approval → deploy — with a protected `main`, a version/tag strategy, and a tested rollback.
**Result:** ✅ CI + Release workflows authored and validated; branch-protection + rollback scripts provided; version strategy defined. **Rollback of data is tested** (Phase 6 restore drill); pipeline *execution* on GitHub is **NOT VERIFIED here** (no runner in this environment) but every command it runs is proven locally.

---

## 1. Pipeline

**`.github/workflows/ci.yml`** — on every PR and push to `main`:

| Job | Steps | Gate |
|---|---|---|
| **quality** | install (frozen lockfile) → prisma generate → **type-check** → lint → **build** | type-check + build **blocking**; lint advisory (eslint not yet configured) |
| **test** | spin up **PostgreSQL 15** service → migrate + generate + seed + bootstrap platform admin → start API → run **7 integration suites** → `pnpm audit` | suites **blocking**; audit advisory |

Integration suites run against a real database: `cross-tenant-security` (32), `db-integrity` (5), `config-safety` (11), `onboarding` (11), `pilot-e2e` (20), `security-scan` (7), `auth-security` (14) — **100 assertions**, all green locally. CI sets `AUTH_RATE_LIMIT_MAX=100000` so the shared per-IP limiter doesn't interfere across suites, and `NODE_ENV=test` (weak CI secrets are fine; production config validation only runs in production).

**`.github/workflows/deploy.yml`** — on a `v*` tag (or manual dispatch):
`build` (docker compose build — reproducibility check + push to registry) → `staging` (deploy + smoke-test `/health` `/health/ready`) → `production` (**GitHub Environment with required reviewers = the manual approval gate**) → deploy + readiness verify.

**Reproducibility:** `pnpm install --frozen-lockfile` (locked deps), pinned base images (`postgres:15`, `node:20-alpine`, `nginx:1.27-alpine`), and `prisma migrate deploy` on API start (schema is deterministic from committed migrations). The same tag rebuilds the same images.

---

## 2. Branch protection (`scripts/setup-branch-protection.sh <owner/repo>`)

Run once by a repo admin (`gh` authenticated). It sets on `main`:
- Require a PR with **≥1 approving review**; dismiss stale reviews.
- Require the **`quality`** and **`test`** CI checks to pass (strict/up-to-date).
- **Enforce for admins**, linear history, **no force-push**, no branch deletion.

Result: nothing merges to `main` without a green pipeline and a review.

---

## 3. Version & tag strategy

- **Semantic versioning** `vMAJOR.MINOR.PATCH` (e.g. `v1.2.0`). MAJOR = breaking API/schema; MINOR = features; PATCH = fixes.
- Tag `main` after CI is green: `git tag -a v1.2.0 -m "…" && git push origin v1.2.0` → triggers the Release workflow.
- **Docker images** are tagged with the same version **and** the commit SHA (immutable) — deploy by version, trace by SHA.
- Each release records the migrations it introduced (Prisma migration folder names) so an operator knows whether a rollback needs a DB restore.

---

## 4. Rollback

**App rollback** — `scripts/rollback.sh <git-tag>`: fetches tags, prompts for a safety backup, checks out the tag, and prints the `docker compose build && up -d` + readiness steps. (Container rollback in practice = `docker compose pull` the previous image tag + `up -d`.)

**Data rollback** — Prisma migrations are **forward-only**; they are not auto-reverted. If a release's migration must be undone, **restore the matching database backup** (`apps/api/scripts/restore.sh`) taken before the release. Rolling code back to a tag that predates a migration is only safe when that migration is backward-compatible (e.g. the Decimal money migration is read-compatible with number-based code).

**Rollback testing (evidence):**
- **Data rollback is TESTED** — Phase 6 performed a full create → backup → **destroy** → restore → verify drill that **PASSED** with exact data + money reconciliation (`BACKUP_AND_DISASTER_RECOVERY.md` §4).
- **App rollback** mechanics (git tag checkout + rebuild) are standard git/Docker; the script is syntax-validated. Live container rollback requires a Docker host (see Phase 5) and is **NOT VERIFIED here**.

---

## 5. The release flow (end to end)

```
feature branch → open PR
     → CI: quality (type-check, build) + test (7 suites on Postgres) must pass
     → 1 review approval → merge to main (protected)
     → tag vX.Y.Z on main → Release workflow
     → build + push images (version + SHA)
     → deploy staging → smoke test /health /health/ready
     → PRODUCTION approval (GitHub Environment reviewer)
     → deploy production (migrate on start) → verify /health/ready
     → (if needed) rollback.sh <prev tag> + restore backup if a migration must be undone
```

---

## 6. Status

| Item | Status |
|---|---|
| CI workflow (quality + integration tests on Postgres) | **Authored + validated** (YAML + commands proven locally) |
| Release workflow (staging → approval → prod) | **Authored** (template with environment approval gate) |
| Branch protection | **Scripted** (`setup-branch-protection.sh`) |
| Version/tag strategy | **Defined** (§3) |
| Reproducible builds | **PASS** (frozen lockfile, pinned images, migrate-on-start) |
| Rollback — data | **Tested** (Phase 6 restore drill) |
| Rollback — app/container | **Scripted + documented**; live run NOT VERIFIED (needs Docker host) |
| CI *executed on GitHub* | **NOT VERIFIED** (no runner here; commands proven locally) |

*The pipeline, branch protection, versioning and rollback are defined, scripted and (where possible) tested. Executing the workflows requires pushing to GitHub with a configured runner + registry + environments — an operator step. Phase 12 complete — awaiting approval before Phase 13 (Final Production Readiness Review).*
