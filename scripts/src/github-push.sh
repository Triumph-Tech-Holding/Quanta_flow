#!/bin/bash
# Push current main branch to GitHub using QFLOW secret
if [ -z "$QFLOW" ]; then
  echo "[github-push] QFLOW secret not found — skipping"
  exit 0
fi

echo "[github-push] Pushing to GitHub..."
GIT_CONFIG_NOSYSTEM=1 HOME=/tmp git push \
  "https://$QFLOW@github.com/Triumph-Tech-Holding/Quanta_flow.git" main
echo "[github-push] Done."
