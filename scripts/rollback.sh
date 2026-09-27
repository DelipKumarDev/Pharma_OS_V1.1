#!/usr/bin/env bash
# PharmaOS rollback — revert the running deployment to a previous release tag.
#
# Usage:  ./scripts/rollback.sh <git-tag>        e.g. ./scripts/rollback.sh v1.1.0
#
# App rollback is git-tag + rebuild. DATA rollback (if a migration must be undone)
# is a database RESTORE from backup — see BACKUP_AND_DISASTER_RECOVERY.md. Prisma
# migrations are forward-only; roll code back to a tag only if its migrations are a
# prefix of the current DB (backward-compatible), otherwise restore a backup first.
set -euo pipefail
TAG="${1:?usage: rollback.sh <git-tag>}"

echo "[rollback] target tag: $TAG"
git fetch --tags --quiet
git rev-parse "$TAG" >/dev/null 2>&1 || { echo "[rollback] unknown tag: $TAG"; exit 1; }

echo "[rollback] 1. Take a safety backup of the current database:"
echo "           DATABASE_URL=\$PROD_DB_URL bash apps/api/scripts/backup.sh"
read -r -p "[rollback] Backup taken? Continue checkout of $TAG? (yes) " ok
[ "$ok" = "yes" ] || { echo "aborted"; exit 1; }

git checkout "$TAG"
echo "[rollback] 2. Rebuild + restart the stack:"
echo "           docker compose build && docker compose up -d"
echo "[rollback] 3. Verify: curl -fsk https://<domain>/health/ready  (expect {ready, db:up})"
echo "[rollback] If the previous release predates a migration, RESTORE the matching backup"
echo "           (restore.sh) before starting the app — forward-only migrations are not auto-reverted."
echo "[rollback] done — now on $TAG"
