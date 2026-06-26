#!/bin/sh
set -e

# ── Persistent volume setup ──────────────────────────────────────────────────
# /data is mounted as a Fly.io persistent volume
# SQLite lives at /data/dev.db
# Uploaded files live at /data/uploads/

mkdir -p /data/uploads/documents
mkdir -p /data/uploads/receipts

# Symlink public/uploads → /data/uploads so Next.js static serving works
# and existing upload path code requires no changes
if [ ! -L /app/public/uploads ]; then
  rm -rf /app/public/uploads
  ln -sf /data/uploads /app/public/uploads
fi

# ── Database migrations ──────────────────────────────────────────────────────
echo "Running database migrations..."
npx prisma migrate deploy
echo "Migrations complete."

# ── Start Next.js ────────────────────────────────────────────────────────────
echo "Starting Next.js..."
exec npm start
