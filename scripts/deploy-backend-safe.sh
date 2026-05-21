#!/usr/bin/env bash
set -euo pipefail

# Safe backend deploy helper.
# Keeps server-only data/config in place: never sync local env files, SQLite
# databases, certificates, caches, or dependencies to production.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${REMOTE:-root@8.140.215.188}"
REMOTE_DIR="${REMOTE_DIR:-/opt/cyberzhang/backend}"
APP_NAME="${APP_NAME:-zhangshi-backend}"

cd "$ROOT_DIR/backend"
npm run build

rsync -az --delete \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'prisma/dev.db' \
  --exclude 'prisma/dev.db-*' \
  --exclude 'prisma/dev.db.*' \
  --exclude '*.db' \
  --exclude '*.db-*' \
  --exclude '*.db.*' \
  --exclude '*.sqlite' \
  --exclude '*.sqlite3' \
  --exclude 'node_modules' \
  --exclude '.cache' \
  --exclude 'certs' \
  --exclude '*.pem' \
  --exclude '*.key' \
  --exclude '*.p12' \
  "$ROOT_DIR/backend/" "$REMOTE:$REMOTE_DIR/"

ssh "$REMOTE" "cd '$REMOTE_DIR' && npm ci && npx prisma generate && npx prisma migrate deploy && pm2 restart '$APP_NAME' --update-env"
