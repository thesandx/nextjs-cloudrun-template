#!/usr/bin/env bash
#
# Destroy one app's Google Cloud resources.
#
# The inverse of gcp-bootstrap.sh, scoped to a single app slug. It removes:
#   - the Cloud Run service
#   - the Firestore database and its backup schedules   ← ALL DATA
#   - the Cloud Storage bucket and every object in it   ← ALL FILES
#   - the dev bucket
#   - the runtime service account and its IAM bindings
#
# It deliberately does NOT remove anything shared between apps in the project:
# the Artifact Registry repository, the deployer service account, the Workload
# Identity Pool and provider, or any enabled API. Another app in this project is
# using them. Delete those by hand if this was the last app.
#
# ⚠ THIS DELETES DATA AND IT DOES NOT COME BACK.
#   Firestore soft-deletes a database for a grace period and Cloud Storage
#   soft-deletes objects for 7 days, but do not plan around either. Export
#   first if there is anything you want:
#
#     gcloud firestore export gs://SOME_OTHER_BUCKET/backup --database=DB_ID
#
# You must type the app slug to confirm. There is no --yes flag, on purpose:
# a teardown that can be run from a script is a teardown that will be, by
# accident, against the wrong project.
#
# Usage:
#   ./scripts/gcp-teardown.sh --project my-gcp-project --service my-app
#   ./scripts/gcp-teardown.sh --project my-gcp-project --service my-app --keep-database
#
set -euo pipefail

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
REGION="asia-south1"
SERVICE_NAME=""
DATABASE_ID=""
BUCKET_NAME=""
KEEP_DATABASE="false"
KEEP_BUCKET="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)        PROJECT_ID="${2:-}"; shift 2 ;;
    --region)         REGION="${2:-}"; shift 2 ;;
    --service)        SERVICE_NAME="${2:-}"; shift 2 ;;
    --database)       DATABASE_ID="${2:-}"; shift 2 ;;
    --bucket)         BUCKET_NAME="${2:-}"; shift 2 ;;
    --keep-database)  KEEP_DATABASE="true"; shift ;;
    --keep-bucket)    KEEP_BUCKET="true"; shift ;;
    -h|--help)        sed -n '3,33p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)                die "Unknown argument: $1 (try --help)" ;;
  esac
done

[[ -n "$PROJECT_ID"   ]] || die "--project is required"
[[ -n "$SERVICE_NAME" ]] || die "--service is required"

command -v gcloud >/dev/null 2>&1 || die "gcloud is not installed"

DATABASE_ID="${DATABASE_ID:-${SERVICE_NAME}-db}"
BUCKET_NAME="${BUCKET_NAME:-${PROJECT_ID}-${SERVICE_NAME}-media}"
DEV_BUCKET_NAME="${BUCKET_NAME}-dev"
RUNTIME_SA="${SERVICE_NAME}-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

# The deployer is one account per PROJECT, shared by every app in it — there is
# no app slug in the name. The runtime account above has one. That difference
# decides how their bindings come off; see "Deployer bindings for this app".
DEPLOYER_SA="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
DATABASE_RESOURCE="projects/${PROJECT_ID}/databases/${DATABASE_ID}"

# Must match the --condition that gcp-bootstrap.sh passes when it grants
# roles/datastore.indexAdmin, character for character. gcloud matches a binding
# by its whole condition, so a difference here removes nothing and says nothing.
# scripts/gcp-iam-conditions.test.ts fails if the two drift apart.
INDEX_ADMIN_CONDITION="title=only-${DATABASE_ID}-indexes,description=Index administration on ${DATABASE_ID},expression=resource.name.startsWith('${DATABASE_RESOURCE}')"

gcloud config set project "$PROJECT_ID" --quiet >/dev/null
gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1 \
  || die "Cannot read project ${PROJECT_ID}. Does it exist and do you have access?"

cat <<EOF

${RED}${BOLD}╔══════════════════════════════════════════════════════════════════╗
║  DESTRUCTIVE. This deletes data permanently.                     ║
╚══════════════════════════════════════════════════════════════════╝${RESET}

  Project             ${PROJECT_ID}
  App slug            ${SERVICE_NAME}

  Cloud Run service   ${SERVICE_NAME} (${REGION})
  Firestore database  $([[ "$KEEP_DATABASE" == "true" ]] && echo "${DATABASE_ID} — KEPT" || echo "${DATABASE_ID} — DELETED, with every document")
  Storage bucket      $([[ "$KEEP_BUCKET" == "true" ]] && echo "gs://${BUCKET_NAME} — KEPT" || echo "gs://${BUCKET_NAME} — DELETED, with every object")
  Dev bucket          $([[ "$KEEP_BUCKET" == "true" ]] && echo "gs://${DEV_BUCKET_NAME} — KEPT" || echo "gs://${DEV_BUCKET_NAME} — DELETED")
  Runtime SA          ${RUNTIME_SA} — DELETED

  ${BOLD}Left alone${RESET} (shared with other apps in this project):
    Artifact Registry, the deployer service account, the Workload Identity
    Pool and provider, and every enabled API.

EOF

printf 'Type the app slug %s%s%s to confirm: ' "${BOLD}" "${SERVICE_NAME}" "${RESET}"
read -r confirmation
[[ "$confirmation" == "$SERVICE_NAME" ]] || { echo "Aborted — input did not match."; exit 1; }

# ---------------------------------------------------------------------------
step "Cloud Run service"
# ---------------------------------------------------------------------------
if gcloud run services describe "$SERVICE_NAME" --region="$REGION" >/dev/null 2>&1; then
  gcloud run services delete "$SERVICE_NAME" --region="$REGION" --quiet
  ok "Deleted Cloud Run service ${SERVICE_NAME}"
else
  skip "No Cloud Run service ${SERVICE_NAME} in ${REGION}"
fi

# ---------------------------------------------------------------------------
step "Cloud Storage buckets"
# ---------------------------------------------------------------------------
delete_bucket() {
  local name="$1"
  if ! gcloud storage buckets describe "gs://${name}" >/dev/null 2>&1; then
    skip "No bucket gs://${name}"
    return 0
  fi
  # --recursive deletes the objects first; a non-empty bucket cannot be removed.
  gcloud storage rm --recursive "gs://${name}" --quiet
  ok "Deleted gs://${name} and its contents"
}

if [[ "$KEEP_BUCKET" == "true" ]]; then
  skip "Buckets kept (--keep-bucket)"
else
  delete_bucket "$BUCKET_NAME"
  delete_bucket "$DEV_BUCKET_NAME"
fi

# ---------------------------------------------------------------------------
step "Firestore database"
# ---------------------------------------------------------------------------
if [[ "$KEEP_DATABASE" == "true" ]]; then
  skip "Database kept (--keep-database)"
elif gcloud firestore databases describe --database="$DATABASE_ID" >/dev/null 2>&1; then
  # Schedules must go first; a database with one attached refuses to delete.
  while IFS= read -r schedule; do
    [[ -n "$schedule" ]] || continue
    gcloud firestore backups schedules delete "$schedule" \
      --database="$DATABASE_ID" --quiet >/dev/null 2>&1 \
      && ok "Deleted backup schedule" \
      || warn "Could not delete backup schedule ${schedule}"
  done < <(gcloud firestore backups schedules list --database="$DATABASE_ID" \
             --format='value(name)' 2>/dev/null || true)

  # Delete protection is off by default but may have been turned on by hand.
  gcloud firestore databases update --database="$DATABASE_ID" \
    --no-delete-protection --quiet >/dev/null 2>&1 || true

  gcloud firestore databases delete --database="$DATABASE_ID" --quiet
  ok "Deleted database ${DATABASE_ID}"
else
  skip "No database ${DATABASE_ID}"
fi

# ---------------------------------------------------------------------------
step "Runtime service account"
# ---------------------------------------------------------------------------
if gcloud iam service-accounts describe "$RUNTIME_SA" >/dev/null 2>&1; then
  # Project-level conditional bindings do not disappear with the account; they
  # linger as deleted-principal entries in the policy. Remove them by name
  # first, so the policy stays readable.
  #
  # --all is correct here and wrong for the deployer below. This account is
  # per-app (${SERVICE_NAME}-runtime@), so every binding it holds belongs to
  # this app and there is nothing else to catch. The deployer is shared.
  for role in roles/datastore.user roles/firebaseauth.admin; do
    gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
      --member="serviceAccount:${RUNTIME_SA}" \
      --role="$role" \
      --all \
      --quiet >/dev/null 2>&1 \
      && ok "Removed ${role}" \
      || skip "No ${role} binding to remove"
  done

  gcloud iam service-accounts delete "$RUNTIME_SA" --quiet
  ok "Deleted ${RUNTIME_SA}"
else
  skip "No service account ${RUNTIME_SA}"
fi

# ---------------------------------------------------------------------------
step "Deployer bindings for this app"
# ---------------------------------------------------------------------------
# --condition, NOT --all. The deployer is shared by every app in the project,
# and bootstrap grants this role once per app, each binding conditioned on that
# app's own database. --all ignores conditions and removes every one of them, so
# tearing down this app would revoke the OTHER apps' index permission too. Their
# next deploy then fails at "Deploy Firestore rules and indexes", on a role
# nobody edited, with nothing to connect it to this teardown.
gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/datastore.indexAdmin" \
  --condition="$INDEX_ADMIN_CONDITION" \
  --quiet >/dev/null 2>&1 \
  && ok "Removed datastore.indexAdmin for ${DATABASE_ID}" \
  || skip "No datastore.indexAdmin binding for ${DATABASE_ID} to remove"

# roles/firebasehosting.admin and roles/firebaserules.admin are deliberately NOT
# removed. Bootstrap grants both unconditioned, because neither Hosting nor a
# rules ruleset is a per-app resource — and the deployer is shared by every app
# in the project. There is no binding here that belongs to this app alone, so
# removing either would stop the other apps purging their CDN and deploying
# their rules. Delete the deployer account by hand if this was the last app.
skip "Left firebasehosting.admin on the deployer (shared, project-scoped)"
skip "Left firebaserules.admin on the deployer (shared, project-scoped)"

cat <<EOF

${GREEN}${BOLD}Teardown complete.${RESET}

${BOLD}Still present, on purpose${RESET}

  - Artifact Registry repository and its images
  - github-deployer service account
  - Workload Identity Pool and provider
  - every enabled API

  They are shared. If ${SERVICE_NAME} was the last app in this project, the
  cleanest next step is to delete the project itself:

    gcloud projects delete ${PROJECT_ID}

${BOLD}Also remove${RESET}

  - the repository variables and secrets for this app, in GitHub
  - any budget alert that named it

EOF
