#!/usr/bin/env bash
#
# Run the Firestore emulator suites against a real emulator.
#
# Starts the emulator, waits for it to answer, runs the `*.emulator.test.ts`
# files with FIRESTORE_EMULATOR_HOST set, and stops the emulator again — even
# when the tests fail, and even on Ctrl-C.
#
# Those suites skip themselves when FIRESTORE_EMULATOR_HOST is unset, which is
# what keeps `pnpm validate` green on a clean checkout with no gcloud installed.
# This script is how they actually run. CI runs it too, so they are never a
# suite that exists but never executes.
#
# The emulator ships as a gcloud component rather than an npm package, which is
# why there is no dependency here to install:
#
#   gcloud components install cloud-firestore-emulator
#
# It needs a Java runtime (17+) and no credentials at all — it never talks to
# Google.
#
# Usage:
#   ./scripts/run-emulator-tests.sh                # all emulator suites
#   ./scripts/run-emulator-tests.sh services/repository.emulator.test.ts
#
# Environment:
#   FIRESTORE_EMULATOR_PORT   port to bind (default 8085)
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PORT="${FIRESTORE_EMULATOR_PORT:-8085}"
HOST="127.0.0.1"
LOG_FILE="$(mktemp -t firestore-emulator.XXXXXX.log)"
EMULATOR_PID=""

if [[ -t 1 ]]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; RESET=''
fi

info() { printf '%s==>%s %s\n' "${YELLOW}" "${RESET}" "$*"; }
die()  { printf '%s[error]%s %s\n' "${RED}" "${RESET}" "$*" >&2; exit 1; }

cleanup() {
  local status=$?
  if [[ -n "$EMULATOR_PID" ]] && kill -0 "$EMULATOR_PID" 2>/dev/null; then
    info "Stopping the emulator"
    # The gcloud wrapper spawns the Java process in its own group; signalling
    # the group stops both. Without this the Java process outlives the script
    # and the port stays bound until the next run fails on it.
    kill -TERM -- "-${EMULATOR_PID}" 2>/dev/null || kill -TERM "$EMULATOR_PID" 2>/dev/null || true
    wait "$EMULATOR_PID" 2>/dev/null || true
  fi
  if [[ $status -ne 0 && -s "$LOG_FILE" ]]; then
    printf '\n%s--- emulator log ---%s\n' "${YELLOW}" "${RESET}" >&2
    tail -40 "$LOG_FILE" >&2
  fi
  rm -f "$LOG_FILE"
  exit $status
}
trap cleanup EXIT INT TERM

command -v gcloud >/dev/null 2>&1 \
  || die "gcloud is not installed: https://cloud.google.com/sdk/docs/install"

command -v java >/dev/null 2>&1 \
  || die "A Java runtime (17+) is required by the Firestore emulator."

if ! gcloud components list --only-local-state --format='value(id)' 2>/dev/null \
      | grep -q '^cloud-firestore-emulator$'; then
  die "The emulator component is missing. Install it with:
    gcloud components install cloud-firestore-emulator"
fi

info "Starting the Firestore emulator on ${HOST}:${PORT}"
# setsid gives the emulator its own process group, so cleanup() can signal the
# whole tree rather than just the gcloud wrapper.
setsid gcloud emulators firestore start \
  --host-port="${HOST}:${PORT}" \
  --database-mode=firestore-native \
  >"$LOG_FILE" 2>&1 &
EMULATOR_PID=$!

for attempt in $(seq 1 60); do
  if curl -fsS --max-time 2 "http://${HOST}:${PORT}/" >/dev/null 2>&1; then
    info "Emulator ready after ${attempt}s"
    break
  fi
  if ! kill -0 "$EMULATOR_PID" 2>/dev/null; then
    die "The emulator exited before it became ready."
  fi
  if [[ "$attempt" -eq 60 ]]; then
    die "The emulator did not become ready within 60s."
  fi
  sleep 1
done

# The Firestore SDK reads FIRESTORE_EMULATOR_HOST itself and sends no
# credentials when it is set. GOOGLE_CLOUD_PROJECT keeps the SDK from trying to
# discover a project id from a metadata server that is not there.
export FIRESTORE_EMULATOR_HOST="${HOST}:${PORT}"
export GOOGLE_CLOUD_PROJECT="demo-template"

if [[ $# -gt 0 ]]; then
  TARGETS=("$@")
else
  TARGETS=("emulator.test.ts")
fi

info "Running emulator suites"
pnpm exec vitest run "${TARGETS[@]}"

printf '%s✓%s Emulator suites passed\n' "${GREEN}" "${RESET}"
