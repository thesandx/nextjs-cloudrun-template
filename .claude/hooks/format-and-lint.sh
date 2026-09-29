#!/usr/bin/env bash
#
# PostToolUse hook: formats and lints the file Claude just edited.
#
# The most common self-inflicted CI failure is a Prettier miss, and the second
# is an import-order or lint error. Both are cheap to fix at the moment of the
# edit and expensive to find after a push. This hook fixes what it can and
# reports what it cannot.
#
# Exit 2 hands stderr back to Claude, so an error --fix cannot repair is seen
# and fixed straight away. Any other failure (a missing binary, an ignored
# file) is not the edit's fault and exits 0.
set -uo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${CLAUDE_PROJECT_DIR:-${HOOK_DIR}/../..}" || exit 0

FILE="$("${HOOK_DIR}/read-hook-input.sh" tool_input.file_path)"
[[ -n "$FILE" && -f "$FILE" ]] || exit 0

# Only files inside this repository.
case "$FILE" in
  "$PWD"/*) FILE="${FILE#"$PWD"/}" ;;
  /*) exit 0 ;;
esac

[[ -x node_modules/.bin/prettier ]] || exit 0

case "$FILE" in
  *.ts | *.tsx | *.mjs | *.js | *.json | *.md | *.css | *.yml | *.yaml)
    node_modules/.bin/prettier --write --log-level warn --ignore-unknown "$FILE" >/dev/null 2>&1 || true
    ;;
  *) exit 0 ;;
esac

case "$FILE" in
  *.ts | *.tsx | *.mjs)
    if ! OUTPUT="$(node_modules/.bin/eslint --fix --max-warnings 0 --no-warn-ignored "$FILE" 2>&1)"; then
      {
        echo "ESLint still reports problems in ${FILE} after --fix. Fix them before you continue:"
        echo "$OUTPUT" | tail -40
      } >&2
      exit 2
    fi
    ;;
esac

exit 0
