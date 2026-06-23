#!/usr/bin/env sh
# DTCG validation pre-commit hook.
# Install: copy to .git/hooks/pre-commit and `chmod +x .git/hooks/pre-commit`.
# Or wire it through husky:  npx husky add .husky/pre-commit "sh templates/dtcg/pre-commit.sh"

set -e

TOKENS_FILE="${MINT_TOKENS_FILE:-mint-ds.tokens.json}"

if ! git diff --cached --name-only | grep -qE "(^|/)(.*\.)?tokens\.json$"; then
  exit 0
fi

if [ ! -f "$TOKENS_FILE" ]; then
  echo "✗ DTCG pre-commit: $TOKENS_FILE not found (set MINT_TOKENS_FILE to override)"
  exit 1
fi

echo "→ Validating $TOKENS_FILE against DTCG v1…"
npx mint-ds validate "$TOKENS_FILE" --spec dtcg
