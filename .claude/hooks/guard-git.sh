#!/usr/bin/env bash
#
# PreToolUse hook for Bash: enforces three rules from CLAUDE.md > Never do this.
#
#   1. Never push to `main`. A push to main deploys to production.
#   2. Never bypass the git hooks with --no-verify.
#   3. Never push without `pnpm validate` green.
#
# Exit 2 blocks the command and hands stderr to Claude as the reason.
#
# This is a guard rail, not a security control. Branch protection on GitHub
# is the control; this stops an honest mistake before it costs a CI round.
set -uo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${CLAUDE_PROJECT_DIR:-${HOOK_DIR}/../..}" || exit 0

COMMAND="$("${HOOK_DIR}/read-hook-input.sh" tool_input.command)"
[[ -n "$COMMAND" ]] || exit 0

block() {
  echo "Blocked by .claude/hooks/guard-git.sh: $*" >&2
  exit 2
}

# Match `git ... commit|push` where `git` starts a command: at the start, or
# after a newline, `;`, `&`, `|` or `(`. So `cd x && git push` and
# `git -C dir push` match, and `echo "git push"` or a heredoc mentioning it
# does not.
CMD_START=$'(^|[\n;&|(])[[:space:]]*'
GIT_OPTS='([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*'
GIT_PUSH_RE="${CMD_START}git${GIT_OPTS}[[:space:]]+push([[:space:]]|\$)"
GIT_WRITE_RE="${CMD_START}git${GIT_OPTS}[[:space:]]+(push|commit)([[:space:]]|\$)"

if [[ "$COMMAND" =~ $GIT_WRITE_RE ]] && [[ "$COMMAND" =~ (^|[[:space:]])--no-verify([[:space:]]|$) ]]; then
  block "--no-verify skips the checks that keep CI green. Fix the failure instead."
fi

[[ "$COMMAND" =~ $GIT_PUSH_RE ]] || exit 0

# Only the push's own arguments: `git push x && git checkout main` is fine.
PUSH_ARGS="${COMMAND#*"${BASH_REMATCH[0]}"}"
PUSH_ARGS="${PUSH_ARGS%%[;&|]*}"

# An explicit refspec naming main: `main`, `HEAD:main`, `+main`, `x:refs/heads/main`.
if [[ " $PUSH_ARGS " =~ [[:space:]:+](refs/heads/)?main[[:space:]] ]]; then
  block "never push to main — it deploys to production. Push a branch and open a pull request."
fi

# A bare `git push` from main pushes main.
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ "$BRANCH" == "main" ]]; then
  block "the current branch is main, and a push from it deploys to production. Create a branch first."
fi

# The gate. Same command CI runs, so a green run here is a green CI run.
if ! OUTPUT="$(pnpm validate 2>&1)"; then
  {
    echo "Blocked by .claude/hooks/guard-git.sh: \`pnpm validate\` failed. Fix it before you push."
    echo "Run \`pnpm format\` for a format:check failure, \`pnpm lint:fix\` for import order."
    echo "--- last lines of pnpm validate ---"
    echo "$OUTPUT" | tail -40
  } >&2
  exit 2
fi

exit 0
