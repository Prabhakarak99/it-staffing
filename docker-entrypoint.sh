#!/bin/sh
set -e

# ── Persistent volume setup (uploads only) ───────────────────────────────────
mkdir -p /data/uploads/documents
mkdir -p /data/uploads/receipts

if [ ! -L /app/public/uploads ]; then
  rm -rf /app/public/uploads
  ln -sf /data/uploads /app/public/uploads
fi

# ── Database: the multi-company database ─────────────────────────────────────
# TENANT_DB_NAME names the new multi-company database on the same server as DATABASE_URL. The app uses
# that database; the original one (the single-company data) is never migrated or written by this version.
if [ -z "$TENANT_DB_NAME" ]; then
  echo "TENANT_DB_NAME is not set: refusing to start, so the original database is never migrated." >&2
  exit 1
fi
export LEGACY_DATABASE_URL="$DATABASE_URL"
DATABASE_URL=$(printf '%s' "$DATABASE_URL" | sed -E "s#/[^/?]+(\?|$)#/${TENANT_DB_NAME}\1#")
export DATABASE_URL
case "$DATABASE_URL" in
  *"/${TENANT_DB_NAME}"*) ;;
  *) echo "Could not point DATABASE_URL at ${TENANT_DB_NAME}: refusing to start." >&2; exit 1 ;;
esac
if [ "$DATABASE_URL" = "$LEGACY_DATABASE_URL" ]; then
  echo "TENANT_DB_NAME is the original database: refusing to start." >&2
  exit 1
fi

# ── Database migrations ──────────────────────────────────────────────────────
# Versioned migrations only (prisma/migrations): never `db push --accept-data-loss`, which can drop data
echo "Applying database migrations..."
npx prisma migrate deploy
echo "Migrations applied."

# ── Start Next.js ────────────────────────────────────────────────────────────
echo "Starting Next.js..."
exec npm start
