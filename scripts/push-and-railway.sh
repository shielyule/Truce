#!/usr/bin/env bash
# Run in your Mac Terminal from ~/Desktop/Qloo
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Ensure .env is not staged"
rm -rf .git 2>/dev/null || true
git init
git add -A
git status
if git diff --cached --name-only | grep -E '(^|/)\.env$' >/dev/null; then
  echo "ERROR: .env would be committed. Aborting."
  exit 1
fi

git commit -m "$(cat <<'EOF'
Ship Truce: Qloo bridge card for divided media diets.

Editable taste tables, Insights overlap, Venn, nostalgic prompts,
dinner games, optional Truce Deck, and hackathon feedback notes.
EOF
)"

git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/shielyule/Truce.git
git push -u origin main

echo ""
echo "==> GitHub push done."
echo ""
echo "Railway next:"
echo "  1) railway login   (or connect repo in dashboard)"
echo "  2) railway init / link this project"
echo "  3) railway variables set QLOO_API_KEY=... QLOO_BASE_URL=https://hackathon.api.qloo.com"
echo "  4) railway up   OR deploy from GitHub integration"
echo "  5) railway domain  → paste URL into Devpost"
