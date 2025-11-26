#!/usr/bin/env bash
set -euo pipefail

# Root-level backend stopper
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[stop] Stopping backend with PM2..."
(
  cd "$SCRIPT_DIR/backend" && npm run pm2:stop && npm run pm2:delete
) || true

echo "[stop] Done. Local MongoDB left untouched."
