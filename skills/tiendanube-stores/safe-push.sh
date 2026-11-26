#!/usr/bin/env bash
# safe-push.sh — push a Tienda Nube theme via FTP without uploading .git,
# with a git restore point. Works for ANY theme dir.
#
#   ./safe-push.sh <theme-dir>
#
# Legacy FTP push OVERWRITES the live storefront (no preview). This script:
#   - refuses to run unless the theme dir is a git repo (your restore point)
#   - moves .git aside so the CLI doesn't upload it, restores it on exit
#   - runs the non-interactive push (-y)
# Restore the live theme later with:  git checkout <pristine-commit> . && ./safe-push.sh <dir>
set -euo pipefail

DIR="${1:?usage: ./safe-push.sh <theme-dir>}"
cd "$DIR"

if [ ! -d .git ]; then
  echo "❌ $DIR is not a git repo. Run 'git init && git add -A && git commit -m pristine' first (restore point)." >&2
  exit 1
fi

command -v tiendanube >/dev/null || { echo "❌ tiendanube CLI not installed (npm i -g @tiendanube/cli)" >&2; exit 1; }

TMP="../.$(basename "$DIR")_git_tmp_$$"
restore() { [ -d "$TMP" ] && mv "$TMP" .git; }
trap restore EXIT

mv .git "$TMP"
tiendanube theme ftp push -y
# trap restores .git
echo "✅ pushed (live) — .git restored"
