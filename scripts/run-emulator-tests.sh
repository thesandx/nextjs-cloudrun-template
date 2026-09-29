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
# Two launchers, one emulator. Neither adds a dependency to package.json:
#
#   1. gcloud, when it has the component. CI uses this path.
#        gcloud components install cloud-firestore-emulator
#   2. Otherwise firebase-tools, through `npx` at a pinned version (the same
#      version deploy.yml pins). It needs only Node and Java, so it works on a
#      laptop or in an agent sandbox with no Cloud SDK. The first run downloads
#      the emulator jar (~70 MB) into ~/.cache/firebase.
#
#   FIRESTORE_EMULATOR_LAUNCHER=gcloud|firebase forces one of them.
#
# Both need a Java 21+ JRE and no credentials at all — neither talks to Google.
# 21 is the emulator's own floor, not a guess: below it, `gcloud emulators
# firestore start` refuses outright. GitHub's ubuntu-latest ships an older
# default JDK, which is why the CI job installs one.
#
# Usage:
#   ./scripts/run-emulator-tests.sh                # all emulator suites
#   ./scripts/run-emulator-tests.sh services/repository.emulator.test.ts
#
# Environment:
#   FIRESTORE_EMULATOR_PORT      port to bind (default 8085)
#   FIRESTORE_EMULATOR_LAUNCHER  gcloud | firebase (default: gcloud if usable)
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PORT="${FIRESTORE_EMULATOR_PORT:-8085}"
HOST="127.0.0.1"
LOG_FILE="$(mktemp -t firestore-emulator.XXXXXX.log)"
EMULATOR_PID=""
FIREBASE_TOOLS_VERSION="15.31.0" # keep equal to the pin in deploy.yml
CONFIG_DIR=""

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
  [[ -n "$CONFIG_DIR" ]] && rm -rf "$CONFIG_DIR"
  exit $status
}
trap cleanup EXIT INT TERM

gcloud_usable() {
  command -v gcloud >/dev/null 2>&1 \
    && gcloud components list --only-local-state --format='value(id)' 2>/dev/null \
      | grep -q '^cloud-firestore-emulator$'
}

LAUNCHER="${FIRESTORE_EMULATOR_LAUNCHER:-}"
if [[ -z "$LAUNCHER" ]]; then
  if gcloud_usable; then LAUNCHER=gcloud; else LAUNCHER=firebase; fi
fi

case "$LAUNCHER" in
  gcloud)
    gcloud_usable || die "gcloud or its emulator component is missing. Install both:
    https://cloud.google.com/sdk/docs/install
    gcloud components install cloud-firestore-emulator
  Or run without gcloud: FIRESTORE_EMULATOR_LAUNCHER=firebase"
    ;;
  firebase)
    command -v npx >/dev/null 2>&1 || die "npx is not on PATH. Install Node 22+."
    ;;
  *)
    die "FIRESTORE_EMULATOR_LAUNCHER must be gcloud or firebase, not '${LAUNCHER}'."
    ;;
esac

command -v java >/dev/null 2>&1 \
  || die "The Firestore emulator needs a Java 21+ JRE, and java is not on PATH.

  macOS:  brew install --cask temurin
  Linux:  sudo apt-get install -y openjdk-21-jre-headless"

# The emulator refuses to start on anything below 21, and its own error arrives
# only after the process has been spawned and the script is already waiting on
# a port that will never open. Checking here turns that into one clear line.
#
# Two version shapes exist: 1.8.0_402 (8 and earlier) and 21.0.10 (9 onwards).
java_major() {
  local version
  version="$(java -version 2>&1 | awk -F'"' '/ version "/ {print $2; exit}')"
  if [[ "$version" == 1.* ]]; then
    cut -d. -f2 <<<"$version"
  else
    cut -d. -f1 <<<"$version"
  fi
}

JAVA_MAJOR="$(java_major)"
if [[ ! "$JAVA_MAJOR" =~ ^[0-9]+$ ]] || [[ "$JAVA_MAJOR" -lt 21 ]]; then
  die "The Firestore emulator needs a Java 21+ JRE. Found: $(java -version 2>&1 | head -1)

  macOS:  brew install --cask temurin
  Linux:  sudo apt-get install -y openjdk-21-jre-headless

Several JDKs installed? Point JAVA_HOME at the 21+ one and re-run."
fi

info "Starting the Firestore emulator on ${HOST}:${PORT} (via ${LAUNCHER})"
# setsid gives the emulator its own process group, so cleanup() can signal the
# whole tree rather than just the wrapper.
if [[ "$LAUNCHER" == gcloud ]]; then
  setsid gcloud emulators firestore start \
    --host-port="${HOST}:${PORT}" \
    --database-mode=firestore-native \
    >"$LOG_FILE" 2>&1 &
else
  # A throwaway config, so the repository's firebase.json (Hosting only) stays
  # untouched. No rules file: the suites use admin-style access, which the
  # emulator allows when no rules are loaded.
  CONFIG_DIR="$(mktemp -d -t firestore-emulator-config.XXXXXX)"
  cat >"${CONFIG_DIR}/firebase.json" <<JSON
{
  "firestore": {},
  "emulators": {
    "firestore": { "host": "${HOST}", "port": ${PORT} },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
JSON
  setsid npx --yes "firebase-tools@${FIREBASE_TOOLS_VERSION}" emulators:start \
    --only firestore \
    --project demo-template \
    --config "${CONFIG_DIR}/firebase.json" \
    >"$LOG_FILE" 2>&1 &
fi
EMULATOR_PID=$!

for attempt in $(seq 1 120); do
  if curl -fsS --max-time 2 "http://${HOST}:${PORT}/" >/dev/null 2>&1; then
    info "Emulator ready after ${attempt}s"
    break
  fi
  if ! kill -0 "$EMULATOR_PID" 2>/dev/null; then
    die "The emulator exited before it became ready."
  fi
  if [[ "$attempt" -eq 120 ]]; then
    die "The emulator did not become ready within 120s."
  fi
  sleep 1
done

# The Firestore SDK reads FIRESTORE_EMULATOR_HOST itself and sends no
# credentials when it is set. GOOGLE_CLOUD_PROJECT keeps the SDK from trying to
# discover a project id from a metadata server that is not there.
export FIRESTORE_EMULATOR_HOST="${HOST}:${PORT}"
export GOOGLE_CLOUD_PROJECT="demo-template"
# Nothing here runs on Google Cloud, so skip the metadata-server probe. Without
# this, the auth library spends seconds discovering that no metadata server
# exists, and the first test can hit its timeout on a slow or proxied network.
export METADATA_SERVER_DETECTION="none"

if [[ $# -gt 0 ]]; then
  TARGETS=("$@")
else
  TARGETS=("emulator.test.ts")
fi

info "Running emulator suites"
pnpm exec vitest run "${TARGETS[@]}"

printf '%s✓%s Emulator suites passed\n' "${GREEN}" "${RESET}"
