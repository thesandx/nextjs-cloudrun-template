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
# It never waits for an index to build. Composite indexes and field
# exemptions are both sent with --async. On a NEW database those operations
# queue behind each other, and one synchronous call once held the deploy for
# 30 minutes until the job timed out. The builds finish in the
# background; gcp-bootstrap.sh starts them early so they are usually done
# before the first deploy. Check them with:
#
#   gcloud firestore operations list --project P --database D \
#     --format='table(name.basename(), metadata.@type.basename(), done)'
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
# The database has to exist first
#
# In the pipeline this script runs BEFORE the build, so a missing database
# fails the whole deploy — no image, no revision. Without this check that
# surfaces as a raw NOT_FOUND from the first `indexes composite create`, in a
# step nobody expects to be the one that provisions anything.
#
# Bootstrap creates the database. This script only ever publishes to it.
# ---------------------------------------------------------------------------
if ! gcloud firestore databases describe \
     --project="$PROJECT_ID" --database="$DATABASE_ID" >/dev/null 2>&1; then
  die "Firestore database '${DATABASE_ID}' does not exist in project ${PROJECT_ID}.

Indexes and rules cannot be published before the database exists, and this
step runs ahead of the build — so the deploy stops here.

Create it first, then deploy again:

  ./scripts/gcp-bootstrap.sh \\
    --project ${PROJECT_ID} \\
    --region <region> \\
    --repo <owner>/<repo> \\
    --service <app-slug>

Already have a database under another name? Set the FIRESTORE_DATABASE_ID
repository variable to match it. List them with:

  gcloud firestore databases list --project=${PROJECT_ID} --format='table(name,locationId,type)'"
fi

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
    # present — built or still building — comes back as ALREADY_EXISTS, which
    # is the idempotent path. --async: do not wait for the build.
    if output="$(gcloud firestore indexes composite create \
          --project="$PROJECT_ID" \
          --database="$DATABASE_ID" \
          --collection-group="$collection_group" \
          --query-scope="$query_scope" \
          "${field_args[@]}" \
          --async \
          --quiet 2>&1)"; then
      ok "Creating index on ${collection_group} (${#field_args[@]} fields; builds in the background)"
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
  # Operations still running on this database, read once. A second request for
  # a field that already has one in progress can be refused, so those fields
  # are skipped. If the list cannot be read, the update below still runs.
  local pending_fields
  pending_fields="$(gcloud firestore operations list \
      --project="$PROJECT_ID" --database="$DATABASE_ID" --format=json 2>/dev/null \
    | jq -r '.[] | select(.done != true) | .metadata.field // empty' 2>/dev/null || true)"

  local override collection_group field_path index_count field_name current
  while IFS= read -r override; do
    [[ -n "$override" ]] || continue

    collection_group="$(jq -r '.collectionGroup' <<<"$override")"
    field_path="$(jq -r '.fieldPath' <<<"$override")"
    index_count="$(jq '(.indexes // []) | length' <<<"$override")"

    if [[ "$index_count" -ne 0 ]]; then
      warn "Field override ${collection_group}.${field_path} declares ${index_count} index(es); this script only applies full exemptions (\"indexes\": []). Apply it by hand with: gcloud firestore indexes fields update"
      continue
    fi

    field_name="projects/${PROJECT_ID}/databases/${DATABASE_ID}/collectionGroups/${collection_group}/fields/${field_path}"
    if grep -qxF "$field_name" <<<"$pending_fields"; then
      skip "Exemption for ${collection_group}.${field_path} is already in progress"
      continue
    fi

    # An exempted field has its own, empty index config. A field that still
    # inherits the database default reports usesAncestorConfig: true.
    current="$(gcloud firestore indexes fields describe "$field_path" \
        --project="$PROJECT_ID" \
        --database="$DATABASE_ID" \
        --collection-group="$collection_group" \
        --format=json 2>/dev/null \
      | jq -r 'if (.indexConfig.usesAncestorConfig != true) and ((.indexConfig.indexes // []) | length == 0)
               then "exempt" else "indexed" end' 2>/dev/null || echo 'unknown')"
    if [[ "$current" == "exempt" ]]; then
      skip "${collection_group}.${field_path} is already exempt from single-field indexing"
      continue
    fi

    # --async: the request is accepted at once and Firestore applies it in the
    # background. Without it gcloud waits for the operation, which on a new
    # database can take longer than the deploy job is allowed to run.
    if output="$(gcloud firestore indexes fields update "$field_path" \
          --project="$PROJECT_ID" \
          --database="$DATABASE_ID" \
          --collection-group="$collection_group" \
          --disable-indexes \
          --async \
          --quiet 2>&1)"; then
      ok "Exempting ${collection_group}.${field_path} from single-field indexing (applies in the background)"
    elif grep -qi 'in progress' <<<"$output"; then
      skip "Exemption for ${collection_group}.${field_path} is already in progress"
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

  local token api ruleset_body ruleset_response ruleset_name release_name release_body
  local release_response http_code
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

  # Repoint the release at the new ruleset. The Rules API wants the release
  # WRAPPED: PATCH takes {"release": {...}}, and a bare release is a 400. PATCH
  # also never creates one, so a database's first deploy gets a 404 and falls
  # through to POST. This is what `firebase deploy` does.
  release_response="$(curl -sS -X PATCH "https://firebaserules.googleapis.com/v1/${release_name}" \
    -H "Authorization: Bearer ${token}" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --argjson release "$release_body" '{release: $release}')" \
    -w '\n%{http_code}')"
  http_code="$(tail -n1 <<<"$release_response")"

  if [[ "$http_code" == "404" ]]; then
    release_response="$(curl -sS -X POST "${api}/releases" \
      -H "Authorization: Bearer ${token}" \
      -H 'Content-Type: application/json' \
      -d "$release_body" \
      -w '\n%{http_code}')"
    http_code="$(tail -n1 <<<"$release_response")"
  fi

  if [[ "$http_code" == "200" ]]; then
    ok "Released to ${release_name}"
  else
    warn "Could not update the release (HTTP ${http_code}). The ruleset exists but is not live."
    warn "$(sed '$d' <<<"$release_response" | jq -r '.error.message // "no message"' 2>/dev/null || echo 'no message')"
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
