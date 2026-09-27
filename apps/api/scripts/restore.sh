#!/usr/bin/env bash
# PharmaOS database restore — restores a gzip (or gpg) dump into DATABASE_URL.
#
# Usage:   DATABASE_URL=... ./restore.sh <backup.sql.gz | backup.sql.gz.gpg>
# WARNING: this OVERWRITES the target database. Take a fresh backup first.
# Env:
#   DATABASE_URL   (required) target connection URI (prisma ?schema= is stripped)
#   PSQL / GUNZIP  (optional) override binary paths
#   FORCE=1        skip the interactive confirmation (for automated DR tests)
set -euo pipefail

FILE="${1:?usage: restore.sh <backup-file>}"
: "${DATABASE_URL:?DATABASE_URL is required}"
PSQL="${PSQL:-psql}"
GUNZIP="${GUNZIP:-gunzip}"
LIBPQ_URL="${DATABASE_URL%%\?*}"

[ -f "$FILE" ] || { echo "[restore] file not found: $FILE" >&2; exit 1; }

echo "[restore] target : $LIBPQ_URL"
echo "[restore] source : $FILE"
if [ "${FORCE:-0}" != "1" ]; then
  printf "This will OVERWRITE the target database. Type 'yes' to continue: "
  read -r ok
  [ "$ok" = "yes" ] || { echo "[restore] aborted"; exit 1; }
fi

decrypt() {
  case "$FILE" in
    *.gpg) gpg --quiet --decrypt "$FILE" | "$GUNZIP" -c ;;
    *.gz)  "$GUNZIP" -c "$FILE" ;;
    *)     cat "$FILE" ;;
  esac
}

echo "[restore] restoring…"
decrypt | "$PSQL" -v ON_ERROR_STOP=1 "$LIBPQ_URL" >/dev/null
echo "[restore] done — verify row counts and run the app against the restored DB"
