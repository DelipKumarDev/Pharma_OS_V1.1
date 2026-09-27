# PharmaOS — Backup & Disaster Recovery (Phase 6)

**Date:** 2026-09-26
**Objective:** An operational backup strategy — scheduled, retained, verifiable, restorable — and an **actually-performed** restore drill (not just producing files).
**Result:** ✅ Backup + restore scripts implemented and tested; a full **create→backup→destroy→restore→verify drill PASSED** on a throwaway database, with money values (Decimal) preserved exactly. Scheduling, retention, encryption, off-site, and failure handling are documented below.

---

## 1. Current backup surfaces (audit)

| Surface | Scope | Status |
|---|---|---|
| `POST /api/settings/backup` | **tenant-scoped JSON** snapshot (Phase 1 restricted it from a full-DB dump) | in-app convenience export; not the DR mechanism |
| `scripts/backup.sh` (new) | **full database** `pg_dump` + gzip + retention (+ optional GPG) | the operational DR backup |
| `scripts/restore.sh` (new) | full-database restore from a dump | the operational restore |

The tenant JSON export is a per-pharmacy convenience; **whole-database DR** is the platform/ops job below.

---

## 2. Backup script — `apps/api/scripts/backup.sh`

`pg_dump --no-owner --format=plain "$DATABASE_URL"` → `gzip -9` → `$BACKUP_DIR/pharmaos-<timestamp>.sql.gz`, then applies retention. Exits non-zero on failure (so a scheduler alerts).

| Env | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — (required) | connection URI (prisma `?schema=` is stripped automatically) |
| `BACKUP_DIR` | `backups` | output dir (the `/backups` named volume in Docker) |
| `BACKUP_RETENTION_DAYS` | `14` | delete local dumps older than this |
| `BACKUP_GPG_RECIPIENT` | — | if set, encrypt the dump (`.sql.gz.gpg`) — use for off-site copies |
| `BACKUP_S3_URI` | — | if set + `aws` CLI present, copy the dump off-site |

**Verified:** run against `pharmaos_dev` produced a **259 KB** gzip dump, `gzip -t` OK, 76 DDL/data statements, retention executed. Safety checks: aborts if `pg_dump` fails or the dump is suspiciously small (<1 KB).

---

## 3. Restore script — `apps/api/scripts/restore.sh <file>`

Decrypts (`.gpg`) / decompresses (`.gz`) and pipes into `psql -v ON_ERROR_STOP=1 "$DATABASE_URL"`. Interactive confirmation by default; `FORCE=1` for automated DR tests. **Overwrites the target DB** — always take a fresh backup first.

---

## 4. Restore drill — PERFORMED & PASSED (2026-09-26)

Executed against a **throwaway database** (`pharmaos_drtest`, never touching `pharmaos_dev`) with local PostgreSQL 18. Log: `Testing/Phase 2 Testing/dr-restore-drill.log`.

| Step | Result |
|---|---|
| 1. Create `pharmaos_drtest` | ok |
| 2. `prisma migrate deploy` + seed synthetic data | migrations applied; demo tenant/users/medicines/etc. seeded |
| 3. Baseline counts | tenants 1, users 4, roles 5, medicines 10, inventory_items 10, customers 4, vendors 3 |
| 3. Baseline **money** (Decimal) | `SUM(sellingPrice)/SUM(mrp) = 546.00 / 605.50` |
| 4. `pg_dump` | 110 KB, 3380 lines |
| 5. **DESTROY** (drop + recreate empty) | 0 tables in fresh DB |
| 6. Restore from dump | **exit 0, 0 errors** |
| 7. Counts after restore | **identical** to baseline |
| 7. Money after restore | **`546.00 / 605.50` — exact** (Decimal preserved) |
| 8. **VERIFY** | **PASS** — all table counts and money totals match |
| 9. Cleanup | drtest dropped |

Tables covered by the mechanism: tenant, users, roles, medicines, inventory, customers, vendors, and (structurally, via full-DB dump) bills, prescriptions, purchases, audit logs — a `pg_dump`/restore reproduces **every** table and row exactly, proven here for the populated set + schema.

---

## 5. Scheduling (choose one)

**A. Docker host cron (recommended for the compose stack)** — uses the `db` container's native `pg_dump`, needs nothing baked into images:
```cron
# /etc/cron.d/pharmaos-backup  — daily 02:15, keep 14 days
15 2 * * *  cd /opt/pharmaos && docker compose exec -T db \
  pg_dump --no-owner -U pharmaos pharmaos | gzip -9 \
  > backups/pharmaos-$(date +\%Y\%m\%d-\%H\%M\%S).sql.gz \
  && find backups -name 'pharmaos-*.sql.gz' -mtime +14 -delete
```

**B. `backup.sh` via cron / systemd timer** (host or a container with a pg client):
```cron
15 2 * * *  cd /opt/pharmaos/apps/api && DATABASE_URL="$PROD_DB_URL" BACKUP_DIR=/opt/pharmaos/backups \
  BACKUP_RETENTION_DAYS=14 BACKUP_GPG_RECIPIENT=ops@pharmacy.example.com bash scripts/backup.sh >> /var/log/pharmaos-backup.log 2>&1
```

**C. Compose sidecar** (optional): a small `postgres:15-alpine` service running the cron loop against the `db` service on the internal network.

Send cron/timer stderr to your alerting (email/Slack) so a **failed backup is noticed** (see §8).

---

## 6. Objectives, retention, off-site

| Parameter | Value (recommended pilot default) |
|---|---|
| **Backup frequency** | daily full dump (add hourly WAL archiving / PITR for tighter RPO — see below) |
| **RPO** (max data loss) | ≤ 24 h with daily dumps; ≤ 5 min if WAL archiving/PITR is enabled |
| **RTO** (time to restore) | minutes for a single-DB restore (drill restored a 10-table dataset in seconds); budget ~30–60 min end-to-end incl. verification on a real dataset |
| **Retention** | 14 daily local; promote weekly/monthly copies off-site (e.g. 8 weekly + 12 monthly) |
| **Encryption** | `BACKUP_GPG_RECIPIENT` for at-rest encryption of any copy leaving the host |
| **Off-site** | `BACKUP_S3_URI` (S3/compatible) or `rclone` to a second provider; never keep the only copy on the DB host |
| **Verification** | monthly restore drill into a scratch DB using `restore.sh` + row-count/money check (this document is the template) |

**Tighter RPO (optional, post-pilot):** enable PostgreSQL WAL archiving + base backups (`pg_basebackup`) for point-in-time recovery. Not required for a supervised pilot; daily dumps are the baseline.

---

## 7. Restore procedure (runbook)

```bash
# 1. Stop the app tier so nothing writes during restore (keep db up).
docker compose stop api web

# 2. Restore into a FRESH database (safest) or the existing one after a safety backup.
#    Example against the compose db:
gunzip -c backups/pharmaos-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U pharmaos -d pharmaos
#    …or with the script where a pg client + DATABASE_URL exist:
DATABASE_URL="$PROD_DB_URL" bash apps/api/scripts/restore.sh backups/pharmaos-YYYYMMDD-HHMMSS.sql.gz

# 3. Bring the app back and confirm readiness.
docker compose start api web
curl -sk https://<domain>/health/ready      # expect {"status":"ready","db":"up"}

# 4. Spot-check key data (tenant, users, a few bills, totals) before reopening.
```

---

## 8. Backup-failure handling

| Symptom | Action |
|---|---|
| Backup job exits non-zero | `backup.sh` returns non-zero on `pg_dump` failure or tiny dump; cron/timer stderr → alert; investigate DB reachability/disk |
| Disk full | retention prunes old dumps; if still full, off-site the latest + free space; alert on `df` |
| Dump too small / empty | script aborts and deletes the partial file (guard: <1 KB) — the previous good dump is retained |
| Off-site copy fails | dump is kept locally; alert; retry; do not delete local until off-site confirmed |
| Restore errors mid-way | `ON_ERROR_STOP=1` stops immediately; restore into a fresh DB, not over a half-restored one; escalate |

---

## 9. Status

| Item | Status | Evidence |
|---|---|---|
| Full-DB backup mechanism | **PASS** | `backup.sh` tested (259 KB dump, gzip OK) |
| Restore mechanism | **PASS** | `restore.sh` + drill exit 0 |
| **Actual restore drill (create→destroy→restore→verify)** | **PASS** | §4, drill log |
| Money (Decimal) survives restore | **PASS** | 546.00/605.50 exact |
| Retention policy | **PASS** | `backup.sh` prunes >N days (verified path) |
| Encryption option | **PASS** (code) | `BACKUP_GPG_RECIPIENT` |
| Off-site option | **PASS** (code) | `BACKUP_S3_URI` |
| Scheduling documented | **PASS** | §5 (cron/docker/sidecar) |
| RPO/RTO/frequency/retention | **PASS** | §6 |
| Failure handling | **PASS** | §8 |
| Automated scheduler running in prod | **NOT VERIFIED** | operator installs the cron/timer (§5) on the host |

*The backup/restore tooling and a genuine restore drill are complete and verified against a local PostgreSQL 18. Installing the scheduler + off-site target is an operator step on the production host. Phase 6 complete — awaiting approval before Phase 7 (Observability & Monitoring).*
