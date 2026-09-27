#!/usr/bin/env bash
# PharmaOS database backup — pg_dump + gzip + retention (+ optional GPG encryption).
#
# Usage:   DATABASE_URL=... BACKUP_DIR=/backups ./backup.sh
# Env:
#   DATABASE_URL            (required) postgres connection URI (prisma ?schema= is stripped)
#   BACKUP_DIR              (default: backups)
#   BACKUP_RETENTION_DAYS   (default: 14)  delete dumps older than this
#   BACKUP_GPG_RECIPIENT    (optional) if set, encrypt the dump to this GPG recipient
#   PG_DUMP / GZIP          (optional) override binary paths
# Exit non-zero on failure so a cron/systemd timer can alert.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
PG_DUMP="${PG_DUMP:-pg_dump}"
GZIP="${GZIP:-gzip}"

mkdir -p "$BACKUP_DIR"
LIBPQ_URL="${DATABASE_URL%%\?*}"           # strip prisma-only ?schema=... (libpq rejects it)
TS="$(date +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/pharmaos-$TS.sql.gz"

echo "[backup] $(date -Is) dumping database → $FILE"
if ! "$PG_DUMP" --no-owner --format=plain "$LIBPQ_URL" | "$GZIP" -9 > "$FILE"; then
  echo "[backup] FAILED — pg_dump error" >&2
  rm -f "$FILE"
  exit 1
fi
SIZE="$(wc -c < "$FILE")"
if [ "$SIZE" -lt 1000 ]; then
  echo "[backup] FAILED — dump suspiciously small ($SIZE bytes)" >&2
  rm -f "$FILE"; exit 1
fi
echo "[backup] ok — $SIZE bytes"

# Optional at-rest encryption (recommended for off-site copies).
if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  gpg --yes --batch --encrypt --recipient "$BACKUP_GPG_RECIPIENT" "$FILE"
  rm -f "$FILE"
  FILE="$FILE.gpg"
  echo "[backup] encrypted → $FILE"
fi

# Retention — remove old local dumps.
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -name 'pharmaos-*.sql.gz*' -type f -mtime +"$RETENTION_DAYS" -print -delete | wc -l)"
echo "[backup] retention: removed $DELETED dump(s) older than ${RETENTION_DAYS}d"

# Off-site copy (optional): set BACKUP_S3_URI and have aws-cli or rclone available.
if [ -n "${BACKUP_S3_URI:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    aws s3 cp "$FILE" "$BACKUP_S3_URI/" && echo "[backup] off-site → $BACKUP_S3_URI/"
  else
    echo "[backup] WARN: BACKUP_S3_URI set but aws cli not found — skipped off-site copy" >&2
  fi
fi

echo "[backup] $(date -Is) complete"
