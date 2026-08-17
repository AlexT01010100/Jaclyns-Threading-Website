#!/bin/bash
# Backs up the Postgres database to a timestamped, gzipped file and deletes
# backups older than RETENTION_DAYS. Meant to run daily via cron on the
# droplet (see scripts/README.md for the crontab entry).
#
# Usage: ./scripts/backup-db.sh
# Restore: see scripts/restore-db.sh

set -euo pipefail

# Resolve paths relative to this script, not the caller's cwd, so it works
# regardless of where cron invokes it from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/jaclyns-threading}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
CONTAINER_NAME="jaclyns-threading-db"

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found" >&2
    exit 1
fi

DB_NAME=$(grep -E '^DB_NAME=' "$ENV_FILE" | head -1 | cut -d= -f2-)
DB_USER=$(grep -E '^DB_USER=' "$ENV_FILE" | head -1 | cut -d= -f2-)
DB_NAME="${DB_NAME:-jaclyns_threading}"
DB_USER="${DB_USER:-postgres}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
    echo "ERROR: container $CONTAINER_NAME is not running" >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"

# --clean adds DROP statements before each CREATE so restoring onto a
# non-empty database works cleanly instead of erroring on existing objects.
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" --clean --if-exists "$DB_NAME" | gzip > "$OUTPUT_FILE"

if [ ! -s "$OUTPUT_FILE" ]; then
    echo "ERROR: backup file is empty - something went wrong" >&2
    rm -f "$OUTPUT_FILE"
    exit 1
fi

echo "Backup written: $OUTPUT_FILE ($(du -h "$OUTPUT_FILE" | cut -f1))"

# Rotate old backups
DELETED=$(find "$BACKUP_DIR" -name 'backup_*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "Removed $DELETED backup(s) older than $RETENTION_DAYS days"
fi
