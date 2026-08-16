#!/usr/bin/env bash
# ============================================================================
# sync_to_pi.sh — Desktop projekt-এর hardware/ ফোল্ডার Pi-তে rsync করে
#
# Usage:
#   ./sync_to_pi.sh            # sync hardware/ ফোল্ডার
#   ./sync_to_pi.sh push       # hardware/ ফোল্ডার Pi-তে send
#   ./sync_to_pi.sh pull       # Pi থেকে laptop-এ আনো (backup)
#   ./sync_to_pi.sh watch      # প্রতি 3s-এ auto-sync (live save, Ctrl+C বন্ধ)
#
# Requires: rsync (laptop + Pi দুটোতেই), sshpass (লোকাল)। Pi credentials
# নিচের VARIABLES-এ set করো।
# ============================================================================

set -euo pipefail

PI_USER="alif"
PI_HOST="192.168.0.100"
PI_PASS="12345"
PI_DEST="~/railway/hardware"           # Pi-তে destination folder
LOCAL_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # hardware/ folder

RSYNC_OPTS=(-avz --exclude="__pycache__/" --exclude=".git/" --exclude="*.jpg")

ssh_rsync() {
  sshpass -p "$PI_PASS" rsync "${RSYNC_OPTS[@]}" "$@"
}

push() {
  echo ">>> Syncing $LOCAL_SRC -> $PI_USER@$PI_HOST:$PI_DEST"
  ssh_rsync -e "ssh -o StrictHostKeyChecking=no" \
    "$LOCAL_SRC/" "$PI_USER@$PI_HOST:$PI_DEST/"
  echo ">>> Sync complete."
}

pull() {
  echo ">>> Pulling $PI_USER@$PI_HOST:$PI_DEST -> $LOCAL_SRC"
  ssh_rsync -e "ssh -o StrictHostKeyChecking=no" \
    "$PI_USER@$PI_HOST:$PI_DEST/" "$LOCAL_SRC/"
  echo ">>> Pull complete."
}

watch() {
  echo ">>> Watching $LOCAL_SRC — auto-sync every 3s (Ctrl+C to stop)"
  while true; do
    push >/dev/null 2>&1 || true
    sleep 3
  done
}

case "${1:-push}" in
  push)   push ;;
  pull)   pull ;;
  watch)  watch ;;
  *)      echo "Usage: $0 {push|pull|watch}"; exit 1 ;;
esac