#!/bin/sh
set -e

# ── Persistent volume setup (uploads only) ───────────────────────────────────
mkdir -p /data/uploads/documents
mkdir -p /data/uploads/receipts

if [ ! -L /app/public/uploads ]; then
  rm -rf /app/public/uploads
  ln -sf /data/uploads /app/public/uploads
fi

# ── Database migrations ──────────────────────────────────────────────────────
# Versioned migrations only (prisma/migrations): never `db push --accept-data-loss`, which can drop data
echo "Applying database migrations..."
npx prisma migrate deploy
echo "Migrations applied."

# ── Start Next.js ────────────────────────────────────────────────────────────
echo "Starting Next.js..."
exec npm start
