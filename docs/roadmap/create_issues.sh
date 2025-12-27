#!/usr/bin/env bash
set -euo pipefail

# Directory this script lives in
DIR="$(cd "$(dirname "$0")" && pwd)"

# Ensure gh exists
if ! command -v gh >/dev/null 2>&1; then
  echo "❌ GitHub CLI not found."
  echo "Install it from https://cli.github.com/"
  exit 1
fi

# Ensure authenticated
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ Not authenticated with GitHub."
  echo "Run: gh auth login"
  exit 1
fi

# Create label if missing
gh label create roadmap \
  --description "Roadmap / planning item" \
  --color "5319e7" \
  2>/dev/null || true

echo "📘 Creating issues from markdown files in: $DIR"
echo

for file in "$DIR"/*.md; do
  filename="$(basename "$file")"

  # Skip the script itself
  if [[ "$filename" == "create_issues.sh" ]]; then
    continue
  fi

  title="$(grep -m1 '^# ' "$file" | sed 's/^# //')"

  if [[ -z "$title" ]]; then
    echo "⚠️  Skipping $filename (no H1 title)"
    continue
  fi

  body="$(tail -n +2 "$file")"

  echo "➡️  Creating issue: $title"

  gh issue create \
    --title "$title" \
    --body "$body" \
    --label "roadmap"
done

echo
echo "✅ All roadmap issues created."
