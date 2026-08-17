#!/bin/bash
# Restores the database from a backup created by backup-db.sh.
# This OVERWRITES the current database - it asks for confirmation first.
#
# Usage: ./scripts/restore-db.sh /var/backups/jaclyns-threading/backup_20260101_030000.sql.gz

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
CONTAINER_NAME="jaclyns-threading-db"

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <path-to-backup.sql.gz>" >&2
    echo "" >&2
    echo "Available backups:" >&2
    ls -lh "${BACKUP_DIR:-/var/backups/jaclyns-threading}"/backup_*.sql.gz 2>/dev/null || echo "  (none found)" >&2
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: $BACKUP_FILE not found" >&2
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found" >&2
    exit 1
fi

DB_NAME=$(grep -E '^DB_NAME=' "$ENV_FILE" | head -1 | cut -d= -f2-)
DB_USER=$(grep -E '^DB_USER=' "$ENV_FILE" | head -1 | cut -d= -f2-)
DB_NAME="${DB_NAME:-jaclyns_threading}"
DB_USER="${DB_USER:-postgres}"

echo "This will OVERWRITE the current '$DB_NAME' database with the contents of:"
echo "  $BACKUP_FILE"
echo ""
read -p "Type YES to continue: " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
    echo "Aborted."
    exit 1
fi

gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"

echo "Restore complete. Recreate the app container so it reconnects cleanly:"
echo "  docker compose up -d --force-recreate app"
