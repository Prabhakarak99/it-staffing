#!/bin/sh
# Run inside the Fly app machine (fly ssh console -a gftvision -C "sh /app/scripts/fly-copy.sh"):
# copies the original database (DATABASE_URL secret, read only) into the multi-company database
# TENANT_DB_NAME on the same server. Passwords never leave Fly.
set -e
cd /app
[ -n "$TENANT_DB_NAME" ] || { echo "TENANT_DB_NAME is not set" >&2; exit 1; }
SRC="$DATABASE_URL"
DST=$(printf '%s' "$SRC" | sed -E "s#/[^/?]+(\?|$)#/${TENANT_DB_NAME}\1#")
[ "$SRC" != "$DST" ] || { echo "Target is the same database as the source" >&2; exit 1; }
SOURCE_DATABASE_URL="$SRC" TARGET_DATABASE_URL="$DST" PLATFORM_ADMIN_EMAIL="${PLATFORM_ADMIN_EMAIL:-}" \
  NODE_PATH=/app/node_modules npx tsx scripts/copy-to-multi-company.ts
