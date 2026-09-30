#!/bin/sh
set -e

# The standalone output does not include the Prisma CLI, so the schema is
# pushed at build time and snapshotted into the image. On first boot (empty
# volume) we materialise that snapshot as the live SQLite database.
TEMPLATE="/app/prisma-template.db"
DB_PATH="${DATABASE_URL#file:}"

if [ -n "$DB_PATH" ] && [ ! -f "$DB_PATH" ] && [ -f "$TEMPLATE" ]; then
  echo "[entrypoint] initialising SQLite database at $DB_PATH"
  mkdir -p "$(dirname "$DB_PATH")"
  cp "$TEMPLATE" "$DB_PATH"
fi

mkdir -p /app/public/uploads/avatars 2>/dev/null || true

exec "$@"
