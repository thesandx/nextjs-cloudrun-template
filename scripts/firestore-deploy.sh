#!/usr/bin/env bash
#
# Deploy Firestore security rules and composite indexes from the repository.
#
# Indexes and rules are code. They live in `firestore.indexes.json` and
# `firestore.rules`, they are reviewed in the pull request that needs them, and
# they reach the database through this script — not through a console edit that
# nobody can trace six months later.
#
# Run BEFORE the application deploy. A revision that queries on an index that
# does not exist yet fails at request time with FAILED_PRECONDITION; an index
# nothing queries yet costs nothing.
#
# Idempotent. Re-running deploys the same rules (Firestore keeps versioned
# rulesets, so this is cheap) and skips indexes that already exist.
#
# Why gcloud and curl rather than firebase-tools:
#   - the indexes go through the Firestore Admin API, which gcloud speaks
#     natively, so there is no npm dependency and no `firebase.json`;
#   - the rules go through the Firebase Rules REST API, authenticated with the
#     same short-lived token as everything else in the pipeline.
#
# ⚠ Rules are DEFENCE IN DEPTH ONLY in this template. The application reaches
#   Firestore with admin credentials, which bypass rules entirely. Rules matter
#   the day a client SDK talks to the database directly. If the project is not
#   enrolled in Firebase, the rules step warns and continues rather than failing
#   your deploy — see cloud/environment-variables.md.
#
# Usage:
#   ./scripts/firestore-deploy.sh --project my-project --database my-app-db
#   ./scripts/firestore-deploy.sh --project my-project --database my-app-db --rules-only
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
  BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=''; RED=''; GREEN=''; YELLOW=''; BLUE=''; RESET=''
fi

step() { printf '\n%s==> %s%s\n' "${BLUE}${BOLD}" "$*" "${RESET}"; }
ok()   { printf '    %s✓%s %s\n' "${GREEN}" "${RESET}" "$*"; }
skip() { printf '    %s·%s %s\n' "${YELLOW}" "${RESET}" "$*"; }
warn() { printf '%s[warn]%s %s\n' "${YELLOW}" "${RESET}" "$*" >&2; }
die()  { printf '%s[error]%s %s\n' "${RED}" "${RESET}" "$*" >&2; exit 1; }

PROJECT_ID=""
DATABASE_ID=""
RULES_FILE="firestore.rules"
INDEXES_FILE="firestore.indexes.json"
RULES_ONLY="false"
INDEXES_ONLY="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)      PROJECT_ID="${2:-}"; shift 2 ;;
    --database)     DATABASE_ID="${2:-}"; shift 2 ;;
    --rules)        RULES_FILE="${2:-}"; shift 2 ;;
    --indexes)      INDEXES_FILE="${2:-}"; shift 2 ;;
    --rules-only)   RULES_ONLY="true"; shift ;;
    --indexes-only) INDEXES_ONLY="true"; shift ;;
    -h|--help)      sed -n '3,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)              die "Unknown argument: $1 (try --help)" ;;
  esac
done

[[ -n "$PROJECT_ID"  ]] || die "--project is required"
[[ -n "$DATABASE_ID" ]] || die "--database is required"

command -v gcloud >/dev/null 2>&1 || die "gcloud is not installed"
command -v jq     >/dev/null 2>&1 || die "jq is not installed"
command -v curl   >/dev/null 2>&1 || die "curl is not installed"

# ---------------------------------------------------------------------------
# Composite indexes
# ---------------------------------------------------------------------------
deploy_indexes() {
  step "Composite indexes (${INDEXES_FILE})"

  [[ -f "$INDEXES_FILE" ]] || { skip "No ${INDEXES_FILE}; nothing to do"; return 0; }
  jq empty "$INDEXES_FILE" 2>/dev/null || die "${INDEXES_FILE} is not valid JSON"

  local count
  count="$(jq '(.indexes // []) | length' "$INDEXES_FILE")"
  if [[ "$count" -eq 0 ]]; then
    skip "No composite indexes declared"
  fi

  local index_json collection_group query_scope field_args output
  while IFS= read -r index_json; do
    [[ -n "$index_json" ]] || continue

    collection_group="$(jq -r '.collectionGroup' <<<"$index_json")"
    query_scope="$(jq -r '.queryScope // "COLLECTION"' <<<"$index_json")"

    # One --field-config per field. `__name__` is left out on purpose:
    # Firestore appends it automatically, matching the last field's direction,
    # and passing it explicitly is rejected as a duplicate.
    field_args=()
    while IFS= read -r field; do
      local path order array_config
      path="$(jq -r '.fieldPath' <<<"$field")"
      [[ "$path" == "__name__" ]] && continue
      order="$(jq -r '.order // empty' <<<"$field")"
      array_config="$(jq -r '.arrayConfig // empty' <<<"$field")"

      if [[ -n "$array_config" ]]; then
        field_args+=(--field-config="field-path=${path},array-config=$(tr '[:upper:]' '[:lower:]' <<<"$array_config")")
      else
        field_args+=(--field-config="field-path=${path},order=$(tr '[:upper:]' '[:lower:]' <<<"${order:-ASCENDING}")")
      fi
    done < <(jq -c '.fields[]' <<<"$index_json")

    if [[ ${#field_args[@]} -lt 2 ]]; then
      warn "Skipping index on ${collection_group}: a composite index needs at least two fields"
      continue
    fi

    # `create` is the only verb the API offers; an identical index already
    # present comes back as ALREADY_EXISTS, which is the idempotent path.
    if output="$(gcloud firestore indexes composite create \
          --project="$PROJECT_ID" \
          --database="$DATABASE_ID" \
          --collection-group="$collection_group" \
          --query-scope="$query_scope" \
          "${field_args[@]}" \
          --quiet 2>&1)"; then
      ok "Creating index on ${collection_group} (${#field_args[@]} fields)"
    elif grep -qiE 'already exists|ALREADY_EXISTS' <<<"$output"; then
      skip "Index on ${collection_group} already exists"
    else
      printf '%s\n' "$output" >&2
      die "Failed to create the index on ${collection_group}"
    fi
  done < <(jq -c '(.indexes // [])[]' "$INDEXES_FILE")

  # -------------------------------------------------------------------------
  # Single-field index exemptions
  #
  # `"indexes": []` means "stop indexing this field at all". That is the
  # supported remedy for a monotonically increasing field under a high write
  # rate — an always-increasing indexed value sends every write to the same end
  # of the index, which is a hotspot Firestore cannot split.
  # -------------------------------------------------------------------------
  local override collection_group field_path index_count
  while IFS= read -r override; do
    [[ -n "$override" ]] || continue

    collection_group="$(jq -r '.collectionGroup' <<<"$override")"
    field_path="$(jq -r '.fieldPath' <<<"$override")"
    index_count="$(jq '(.indexes // []) | length' <<<"$override")"

    if [[ "$index_count" -ne 0 ]]; then
      warn "Field override ${collection_group}.${field_path} declares ${index_count} index(es); this script only applies full exemptions (\"indexes\": []). Apply it by hand with: gcloud firestore indexes fields update"
      continue
    fi

    if output="$(gcloud firestore indexes fields update "$field_path" \
          --project="$PROJECT_ID" \
          --database="$DATABASE_ID" \
          --collection-group="$collection_group" \
          --disable-indexes \
          --quiet 2>&1)"; then
      ok "Exempted ${collection_group}.${field_path} from single-field indexing"
    else
      printf '%s\n' "$output" >&2
      die "Failed to update the field exemption for ${collection_group}.${field_path}"
    fi
  done < <(jq -c '(.fieldOverrides // [])[]' "$INDEXES_FILE")
}

# ---------------------------------------------------------------------------
# Security rules
# ---------------------------------------------------------------------------
deploy_rules() {
  step "Security rules (${RULES_FILE})"

  [[ -f "$RULES_FILE" ]] || { skip "No ${RULES_FILE}; nothing to do"; return 0; }

  local token api ruleset_body ruleset_response ruleset_name release_name release_body http_code
  token="$(gcloud auth print-access-token 2>/dev/null)" \
    || die "Cannot mint an access token. Run 'gcloud auth login' or authenticate the workflow."

  api="https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}"

  # jq builds the JSON so the rules source is escaped correctly. Rules contain
  # quotes, braces and newlines; hand-built JSON breaks on the first one.
  ruleset_body="$(jq -n --rawfile source "$RULES_FILE" \
    '{source: {files: [{name: "firestore.rules", content: $source}]}}')"

  ruleset_response="$(curl -sS -X POST "${api}/rulesets" \
    -H "Authorization: Bearer ${token}" \
    -H 'Content-Type: application/json' \
    -d "$ruleset_body" \
    -w '\n%{http_code}')"

  http_code="$(tail -n1 <<<"$ruleset_response")"
  ruleset_response="$(sed '$d' <<<"$ruleset_response")"

  if [[ "$http_code" != "200" ]]; then
    warn "Could not create a ruleset (HTTP ${http_code}). Rules were NOT deployed."
    warn "$(jq -r '.error.message // "no message"' <<<"$ruleset_response" 2>/dev/null || echo "$ruleset_response")"
    warn "This is usually a project that is not enrolled in Firebase, or the"
    warn "firebaserules.googleapis.com API not being enabled. Rules are defence"
    warn "in depth here — the app uses admin credentials, which bypass them — so"
    warn "the deploy continues. See scripts/firestore-deploy.sh for the detail."
    return 0
  fi

  ruleset_name="$(jq -r '.name' <<<"$ruleset_response")"
  ok "Created ruleset ${ruleset_name}"

  # A named database releases at cloud.firestore/<database-id>; the default
  # database releases at cloud.firestore.
  if [[ "$DATABASE_ID" == "(default)" ]]; then
    release_name="projects/${PROJECT_ID}/releases/cloud.firestore"
  else
    release_name="projects/${PROJECT_ID}/releases/cloud.firestore/${DATABASE_ID}"
  fi

  release_body="$(jq -n --arg name "$release_name" --arg ruleset "$ruleset_name" \
    '{name: $name, rulesetName: $ruleset}')"

  # PATCH with updateMask creates the release if it is not there and repoints it
  # if it is, so this one call covers both the first deploy and every later one.
  http_code="$(curl -sS -X PATCH "https://firebaserules.googleapis.com/v1/${release_name}?updateMask=rulesetName" \
    -H "Authorization: Bearer ${token}" \
    -H 'Content-Type: application/json' \
    -d "$release_body" \
    -o /dev/null -w '%{http_code}')"

  if [[ "$http_code" == "200" ]]; then
    ok "Released to ${release_name}"
  else
    warn "Could not update the release (HTTP ${http_code}). The ruleset exists but is not live."
  fi
}

printf '\n%sFirestore deploy%s\n\n  Project   %s\n  Database  %s\n' \
  "$BOLD" "$RESET" "$PROJECT_ID" "$DATABASE_ID"

if [[ "$RULES_ONLY" != "true" ]]; then
  deploy_indexes
fi
if [[ "$INDEXES_ONLY" != "true" ]]; then
  deploy_rules
fi

printf '\n%s%sFirestore deploy complete.%s\n\n' "$GREEN" "$BOLD" "$RESET"
