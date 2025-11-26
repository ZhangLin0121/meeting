#!/usr/bin/env bash
set -euo pipefail

# Root-level backend starter (local MongoDB only)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[start] Using local MongoDB on port 27017..."
if ! lsof -iTCP:27017 -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  echo "MongoDB is not listening on 27017. Please start your local MongoDB instance." >&2
  exit 1
fi

echo "[start] Installing backend deps if needed..."
(cd "$SCRIPT_DIR/backend" && npm install >/dev/null 2>&1 || npm install)

echo "[start] Starting backend with PM2..."
(cd "$SCRIPT_DIR/backend" && npm run pm2:start)

echo "[start] Backend started. Health: http://127.0.0.1:3000/api/health"
