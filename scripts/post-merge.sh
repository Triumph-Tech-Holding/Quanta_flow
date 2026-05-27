#!/bin/bash
set -e

echo "[post-merge] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[post-merge] Running database migrations..."
pnpm --filter @workspace/db run push-force

echo "[post-merge] Updating technical documentation..."
pnpm --filter @workspace/scripts run update-docs || echo "[post-merge] Doc update skipped (non-blocking)"

echo "[post-merge] Syncing to GitHub..."
if [ -n "$QFLOW" ]; then
  GIT_CONFIG_NOSYSTEM=1 HOME=/tmp git push \
    "https://$QFLOW@github.com/Triumph-Tech-Holding/Quanta_flow.git" main \
    || echo "[post-merge] GitHub push failed (non-blocking)"
else
  echo "[post-merge] QFLOW secret not found — skipping GitHub push"
fi

echo "[post-merge] Done."
