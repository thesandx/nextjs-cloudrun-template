#!/usr/bin/env bash
#
# One-time Google Cloud setup for this template.
#
# Creates everything the deploy pipeline and the app need:
#   - required APIs
#   - an Artifact Registry repository
#   - a deployer service account (impersonated by GitHub Actions)
#   - a runtime service account (the identity the app runs as)
#   - a Workload Identity Pool + provider, shared by every repository you
#     bootstrap into this project, and pinned to your GitHub owner
#   - a Firestore database in NATIVE mode, named after the app
#   - point-in-time recovery and a daily backup schedule on that database
#   - a Cloud Storage bucket for uploads, in the same region
#   - the IAM bindings that tie them together, each scoped to ONE resource
#     and pinned to this repository
#
# Every step is idempotent: re-running after a partial failure is safe, and so
# is running it again for a second repository in the same project. The provider
# is shared, so the script refuses to overwrite a condition set by a different
# owner rather than silently breaking their deploys. Running it again with a
# different --service creates a second, separate database and bucket and
# touches neither of the first app's.
#
# There are NO service account keys anywhere in this script, by design.
# See cloud/github-actions.md for why.
#
# Usage:
#   ./scripts/gcp-bootstrap.sh \
#     --project my-gcp-project \
#     --region asia-south1 \
#     --repo owner/repository \
#     --service my-app
#
# Options:
#   --main-only               only refs/heads/main of this repository may deploy
#   --pool / --provider       use a non-default pool or provider id
#   --force-provider-update   overwrite a provider condition set by another
#                             owner (this revokes their deploys — read ADR-0003)
#   --cors-origin             allow browser uploads from an origin (repeatable)
#   --database / --bucket     override the derived names
#   --no-dev-bucket           skip the dev bucket
#   --skip-data               no Firestore, no Cloud Storage
#   --skip-auth               no Firebase Auth (sign-in stays disabled)
#
# --cors-origin is the origin your APP is served from — the address in the
# user's browser bar — not the bucket's. A signed upload is a cross-origin PUT
# from your site to storage.googleapis.com, and the bucket lists who may make it.
#
#   scheme + host (+ port). No path, no trailing slash:
#     ✓ https://app.example.com
#     ✗ https://app.example.com/          (trailing slash)
#     ✗ https://app.example.com/upload    (path)
#     ✗ app.example.com                   (no scheme)
#
#   Repeat the flag per origin. https://example.com and https://www.example.com
#   are DIFFERENT origins, and so is every subdomain:
#     --cors-origin https://example.com --cors-origin https://www.example.com
#
#   localhost is added to the dev bucket automatically. Do not know your domain
#   yet? Leave it out and re-run this script later — it is idempotent.
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
  BLUE=$'\033[34m'; RESET=$'\033[0m'
else
  BOLD=''; RED=''; GREEN=''; YELLOW=''; BLUE=''; RESET=''
fi

step()  { printf '\n%s==> %s%s\n' "${BLUE}${BOLD}" "$*" "${RESET}"; }
ok()    { printf '    %s✓%s %s\n' "${GREEN}" "${RESET}" "$*"; }
skip()  { printf '    %s·%s %s\n' "${YELLOW}" "${RESET}" "$*"; }
warn()  { printf '%s[warn]%s %s\n' "${YELLOW}" "${RESET}" "$*" >&2; }
die()   { printf '%s[error]%s %s\n' "${RED}" "${RESET}" "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Retry helper for Firestore's eventually-consistent control plane
#
# An update issued straight after `databases create` races the creation and
# comes back `ABORTED: There are concurrent database changes, please try
# again.` The database itself is fine — the write just arrived while Google was
# still finishing. Retrying with backoff is the documented remedy.
#
# Only ABORTED is retried. Any other failure returns immediately, with the
# real gcloud output, so a genuine error is never hidden behind five retries.
#
# FIRESTORE_RETRY_DELAY overrides the first delay, for tests.
# ---------------------------------------------------------------------------
retry_on_abort() {
  local description="$1"; shift
  local attempt output
  local delay="${FIRESTORE_RETRY_DELAY:-5}"

  for attempt in 1 2 3 4 5; do
    if output="$("$@" 2>&1)"; then
      return 0
    fi
    if ! grep -qiE 'ABORTED|concurrent database changes' <<<"$output"; then
      printf '%s\n' "$output" >&2
      return 1
    fi
    if [[ "$attempt" -lt 5 ]]; then
      skip "${description}: database still settling, retrying in ${delay}s (${attempt}/5)"
      sleep "$delay"
      delay=$(( delay * 2 ))
    fi
  done

  printf '%s\n' "$output" >&2
  warn "${description} still reports concurrent changes after 5 attempts."
  warn "The database exists and is usable. Re-run this script in a minute to finish."
  return 1
}

usage() {
  sed -n '3,61p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------
PROJECT_ID=""
REGION="asia-south1"
GITHUB_REPO=""
SERVICE_NAME=""
AR_REPOSITORY="containers"
POOL_ID="github"
PROVIDER_ID="github"
RESTRICT_TO_MAIN="false"
DATABASE_ID=""
BUCKET_NAME=""
CREATE_DEV_BUCKET="true"
BACKUP_RETENTION_DAYS="7"
SKIP_DATA="false"
SKIP_AUTH="false"
CORS_ORIGINS=()
FORCE_PROVIDER_UPDATE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)       PROJECT_ID="${2:-}"; shift 2 ;;
    --region)        REGION="${2:-}"; shift 2 ;;
    --repo)          GITHUB_REPO="${2:-}"; shift 2 ;;
    --service)       SERVICE_NAME="${2:-}"; shift 2 ;;
    --ar-repo)       AR_REPOSITORY="${2:-}"; shift 2 ;;
    --database)      DATABASE_ID="${2:-}"; shift 2 ;;
    --bucket)        BUCKET_NAME="${2:-}"; shift 2 ;;
    --cors-origin)   CORS_ORIGINS+=("${2:-}"); shift 2 ;;
    --no-dev-bucket) CREATE_DEV_BUCKET="false"; shift ;;
    --skip-data)     SKIP_DATA="true"; shift ;;
    --skip-auth)     SKIP_AUTH="true"; shift ;;
    --main-only)     RESTRICT_TO_MAIN="true"; shift ;;
    --pool)          POOL_ID="${2:-}"; shift 2 ;;
    --provider)      PROVIDER_ID="${2:-}"; shift 2 ;;
    --force-provider-update) FORCE_PROVIDER_UPDATE="true"; shift ;;
    -h|--help)       usage 0 ;;
    *)               die "Unknown argument: $1 (try --help)" ;;
  esac
done

[[ -n "$PROJECT_ID"   ]] || die "--project is required"
[[ -n "$GITHUB_REPO"  ]] || die "--repo is required (format: owner/repository)"
[[ "$GITHUB_REPO" == */* ]] || die "--repo must be in owner/repository format"
[[ -n "$SERVICE_NAME" ]] || die "--service is required"

# The provider's attribute condition names the owner, not the repository.
GITHUB_OWNER="${GITHUB_REPO%%/*}"

# The app slug is the service name. One slug names the Cloud Run service, the
# runtime service account, the database and the bucket, so two apps in one
# project can never reach each other's data by accident.
DATABASE_ID="${DATABASE_ID:-${SERVICE_NAME}-db}"
BUCKET_NAME="${BUCKET_NAME:-${PROJECT_ID}-${SERVICE_NAME}-media}"
DEV_BUCKET_NAME="${BUCKET_NAME}-dev"

# Same shapes lib/env.ts validates at startup. Failing here is cheaper than
# creating a resource the application will then refuse to talk to.
[[ "$DATABASE_ID" =~ ^[a-z][a-z0-9-]{2,61}[a-z0-9]$ ]] \
  || die "Database id '${DATABASE_ID}' is invalid: 4-63 lowercase letters, digits and hyphens."
[[ "${#BUCKET_NAME}" -le 63 ]] \
  || die "Bucket name '${BUCKET_NAME}' is ${#BUCKET_NAME} characters; the limit is 63. Pass a shorter --bucket."
[[ "$BUCKET_NAME" =~ ^[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]$ ]] \
  || die "Bucket name '${BUCKET_NAME}' is invalid: lowercase letters, digits, hyphens and underscores only."

command -v gcloud >/dev/null 2>&1 || die "gcloud is not installed: https://cloud.google.com/sdk/docs/install"

if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q .; then
  die "No active gcloud account. Run: gcloud auth login"
fi

DEPLOYER_SA="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_SA="${SERVICE_NAME}-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

# ---------------------------------------------------------------------------
# Confirm
# ---------------------------------------------------------------------------
cat <<EOF

${BOLD}Google Cloud bootstrap${RESET}

  Project             ${PROJECT_ID}
  Region              ${REGION}
  GitHub repository   ${GITHUB_REPO}
  Cloud Run service   ${SERVICE_NAME}
  Artifact Registry   ${AR_REPOSITORY}
  Deployer SA         ${DEPLOYER_SA}
  Runtime SA          ${RUNTIME_SA}
  Restrict to main    ${RESTRICT_TO_MAIN}
  Pool / provider     ${POOL_ID} / ${PROVIDER_ID}  (shared by every repo of ${GITHUB_OWNER})

  Firestore database  ${DATABASE_ID} (NATIVE mode)
  Storage bucket      gs://${BUCKET_NAME}
  Dev bucket          $([[ "$CREATE_DEV_BUCKET" == "true" ]] && echo "gs://${DEV_BUCKET_NAME}" || echo "(skipped)")
  CORS origins        $([[ ${#CORS_ORIGINS[@]} -gt 0 ]] && printf '%s ' "${CORS_ORIGINS[@]}" || echo "(none — add with --cors-origin)")
  Data layer          $([[ "$SKIP_DATA" == "true" ]] && echo "SKIPPED (--skip-data)" || echo "enabled")

${YELLOW}${BOLD}A Firestore database's location is PERMANENT.${RESET}
${YELLOW}It cannot be changed, and it cannot be moved. Changing region later means
creating a second database and migrating every document into it. The same is
true of the bucket. Check '${REGION}' is the region you want before continuing.${RESET}

EOF

read -r -p "Proceed? [y/N] " reply
[[ "$reply" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

gcloud config set project "$PROJECT_ID" --quiet >/dev/null

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')" \
  || die "Cannot read project ${PROJECT_ID}. Does it exist and do you have access?"
ok "Project number: ${PROJECT_NUMBER}"

# ---------------------------------------------------------------------------
step "Enabling required APIs (this can take a couple of minutes)"
# ---------------------------------------------------------------------------
API_LIST=(
  run.googleapis.com
  artifactregistry.googleapis.com
  # iamcredentials is what signs V4 Cloud Storage URLs without a key file, and
  # what lets GitHub Actions impersonate the deployer. Both need it.
  iamcredentials.googleapis.com
  sts.googleapis.com
  cloudresourcemanager.googleapis.com
  secretmanager.googleapis.com
)

if [[ "$SKIP_DATA" != "true" ]]; then
  API_LIST+=(
    firestore.googleapis.com
    storage.googleapis.com
    # Deploys the security rules in firestore.rules. Optional: the deploy
    # degrades to a warning without it — see scripts/firestore-deploy.sh.
    firebaserules.googleapis.com
  )
fi

if [[ "$SKIP_AUTH" != "true" ]]; then
  API_LIST+=(
    # Identity Platform. Firebase Auth is a thin layer over this, and it is
    # what verifies ID tokens and mints session cookies.
    identitytoolkit.googleapis.com
    # Needed to register the project with Firebase and to create the web app
    # whose config the browser uses.
    firebase.googleapis.com
  )
fi

gcloud services enable "${API_LIST[@]}" --quiet
ok "APIs enabled"

# ---------------------------------------------------------------------------
step "Artifact Registry repository"
# ---------------------------------------------------------------------------
if gcloud artifacts repositories describe "$AR_REPOSITORY" --location="$REGION" >/dev/null 2>&1; then
  skip "Repository ${AR_REPOSITORY} already exists"
else
  gcloud artifacts repositories create "$AR_REPOSITORY" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Container images for ${SERVICE_NAME}" \
    --quiet
  ok "Created ${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPOSITORY}"
fi

# ---------------------------------------------------------------------------
step "Service accounts"
# ---------------------------------------------------------------------------
create_sa() {
  local account_id="$1" display_name="$2" email="$3"
  if gcloud iam service-accounts describe "$email" >/dev/null 2>&1; then
    skip "${email} already exists"
  else
    gcloud iam service-accounts create "$account_id" \
      --display-name="$display_name" --quiet
    ok "Created ${email}"
  fi
}

create_sa "github-deployer" "GitHub Actions deployer" "$DEPLOYER_SA"
create_sa "${SERVICE_NAME}-runtime" "Runtime identity for ${SERVICE_NAME}" "$RUNTIME_SA"

# Service account creation is eventually consistent; IAM bindings that
# reference a brand-new account can fail if issued immediately.
sleep 5

# ---------------------------------------------------------------------------
step "IAM roles for the deployer"
# ---------------------------------------------------------------------------

# Push images — scoped to the one repository, not the whole project.
gcloud artifacts repositories add-iam-policy-binding "$AR_REPOSITORY" \
  --location="$REGION" \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/artifactregistry.writer" \
  --quiet >/dev/null
ok "artifactregistry.writer on ${AR_REPOSITORY}"

# Manage Cloud Run services. Narrow this to run.developer or a custom role
# once the pipeline is proven — see cloud/github-actions.md.
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/run.admin" \
  --condition=None \
  --quiet >/dev/null
ok "run.admin on ${PROJECT_ID}"

# Assign the runtime identity to a revision. Without this, deploys fail with a
# confusing 'iam.serviceaccounts.actAs denied' naming an unexpected account.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --quiet >/dev/null
ok "iam.serviceAccountUser on ${RUNTIME_SA}"

# ---------------------------------------------------------------------------
# Data layer: Firestore + Cloud Storage
#
# Both are created in $REGION, the same region as the Cloud Run service. That
# is not a preference. A cross-region read adds tens of milliseconds to every
# query and bills egress on every byte, and neither resource can be moved
# afterwards.
# ---------------------------------------------------------------------------
if [[ "$SKIP_DATA" == "true" ]]; then
  step "Data layer"
  skip "Skipped (--skip-data)"
else

# ---------------------------------------------------------------------------
step "Firestore database (${DATABASE_ID})"
# ---------------------------------------------------------------------------

# A NAMED database, never (default). The runtime service account is granted
# access under an IAM condition pinned to this name, so a second app in the
# same project cannot read this one's data even with the same role.
if gcloud firestore databases describe --database="$DATABASE_ID" >/dev/null 2>&1; then
  EXISTING_LOCATION="$(gcloud firestore databases describe \
    --database="$DATABASE_ID" --format='value(locationId)')"
  EXISTING_TYPE="$(gcloud firestore databases describe \
    --database="$DATABASE_ID" --format='value(type)')"

  skip "Database ${DATABASE_ID} already exists in ${EXISTING_LOCATION} (${EXISTING_TYPE})"

  if [[ "$EXISTING_LOCATION" != "$REGION" ]]; then
    warn "Database ${DATABASE_ID} is in ${EXISTING_LOCATION}, not ${REGION}."
    warn "A database location CANNOT be changed. Either deploy Cloud Run to"
    warn "${EXISTING_LOCATION}, or create a new database and migrate the data."
  fi
  if [[ "$EXISTING_TYPE" != "FIRESTORE_NATIVE" ]]; then
    die "Database ${DATABASE_ID} is ${EXISTING_TYPE}, not FIRESTORE_NATIVE. The mode cannot be changed; use a different --database."
  fi
else
  gcloud firestore databases create \
    --database="$DATABASE_ID" \
    --location="$REGION" \
    --type=firestore-native \
    --quiet
  ok "Created ${DATABASE_ID} in ${REGION} — this location is now permanent"
  # The control plane needs a moment before it accepts an update to this
  # database. Without the pause the very next step usually loses the race and
  # comes back ABORTED. retry_on_abort recovers from that anyway; this just
  # means the common case does not have to.
  sleep "${FIRESTORE_SETTLE_DELAY:-10}"
fi

# ---------------------------------------------------------------------------
step "Firestore point-in-time recovery and backups"
# ---------------------------------------------------------------------------

# PITR keeps 7 days of versions, so a bad migration is recoverable to the
# minute before it ran. It is off by default and costs storage, not requests.
PITR_STATE="$(gcloud firestore databases describe --database="$DATABASE_ID" \
  --format='value(pointInTimeRecoveryEnablement)' 2>/dev/null || echo '')"

if [[ "$PITR_STATE" == "POINT_IN_TIME_RECOVERY_ENABLED" ]]; then
  skip "Point-in-time recovery already enabled"
else
  retry_on_abort "Point-in-time recovery" \
    gcloud firestore databases update \
    --database="$DATABASE_ID" \
    --enable-pitr \
    --quiet \
    || die "Could not enable point-in-time recovery. See the output above."
  ok "Point-in-time recovery enabled (7-day window)"
fi

# PITR protects against a mistake you notice quickly. A backup schedule
# protects against one you notice next week. They are not substitutes.
if gcloud firestore backups schedules list --database="$DATABASE_ID" \
     --format='value(name)' 2>/dev/null | grep -q .; then
  skip "A backup schedule already exists"
else
  retry_on_abort "Backup schedule" \
    gcloud firestore backups schedules create \
    --database="$DATABASE_ID" \
    --recurrence=daily \
    --retention="${BACKUP_RETENTION_DAYS}d" \
    --quiet \
    || die "Could not create the backup schedule. See the output above."
  ok "Daily backups, ${BACKUP_RETENTION_DAYS}-day retention"
fi

# ---------------------------------------------------------------------------
step "Cloud Storage bucket (gs://${BUCKET_NAME})"
# ---------------------------------------------------------------------------

create_bucket() {
  local name="$1" purpose="$2"

  if gcloud storage buckets describe "gs://${name}" >/dev/null 2>&1; then
    skip "gs://${name} already exists"
    return 0
  fi

  # --uniform-bucket-level-access: IAM is the only access control. Per-object
  #   ACLs are the classic way a "private" bucket turns out to be readable.
  # --public-access-prevention: refuses a public grant outright, even if
  #   somebody later tries to add allUsers.
  # --soft-delete-duration: a deleted object is recoverable for 7 days.
  gcloud storage buckets create "gs://${name}" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --uniform-bucket-level-access \
    --public-access-prevention \
    --soft-delete-duration=7d \
    --quiet
  ok "Created gs://${name} in ${REGION} (${purpose})"
}

create_bucket "$BUCKET_NAME" "production uploads"
if [[ "$CREATE_DEV_BUCKET" == "true" ]]; then
  create_bucket "$DEV_BUCKET_NAME" "local development"
fi

# ---------------------------------------------------------------------------
step "Bucket lifecycle rules"
# ---------------------------------------------------------------------------

# Two sweepers, both for objects nobody will ever ask for again:
#   - anything still under tmp/ after a day is an upload that was signed and
#     started but never finalized. See services/storage.service.ts.
#   - a multipart upload abandoned mid-flight leaves parts that are billed as
#     storage and are invisible in a normal listing.
LIFECYCLE_FILE="$(mktemp)"
trap 'rm -f "$LIFECYCLE_FILE"' EXIT

cat > "$LIFECYCLE_FILE" <<'LIFECYCLE'
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "Delete" },
        "condition": { "age": 1, "matchesPrefix": ["tmp/"] }
      },
      {
        "action": { "type": "AbortIncompleteMultipartUpload" },
        "condition": { "age": 1 }
      }
    ]
  }
}
LIFECYCLE

apply_lifecycle() {
  local name="$1"
  gcloud storage buckets update "gs://${name}" \
    --lifecycle-file="$LIFECYCLE_FILE" --quiet >/dev/null
  ok "Lifecycle applied to gs://${name} (tmp/ swept after 1 day)"
}

apply_lifecycle "$BUCKET_NAME"
if [[ "$CREATE_DEV_BUCKET" == "true" ]]; then
  apply_lifecycle "$DEV_BUCKET_NAME"
fi

# ---------------------------------------------------------------------------
step "Bucket CORS"
# ---------------------------------------------------------------------------

# A browser PUT to a signed URL is a cross-origin request to storage.googleapis.com,
# so the bucket must name the origins allowed to make it. No origins means no
# direct browser uploads — which is the safe default until you know your domain.
if [[ ${#CORS_ORIGINS[@]} -eq 0 ]]; then
  skip "No --cors-origin given; browser uploads are not enabled yet"
  warn "Server-side reads and writes work regardless. Only a direct browser"
  warn "upload needs this. Add your app's own origin once you know it:"
  warn "  ./scripts/gcp-bootstrap.sh ... --cors-origin https://app.example.com"
else
  CORS_FILE="$(mktemp)"
  # jq is not assumed here, so the JSON is assembled with printf. Origins are
  # emitted one per line and joined, so a comma in an origin cannot break it.
  {
    printf '[{"origin":['
    for i in "${!CORS_ORIGINS[@]}"; do
      [[ $i -gt 0 ]] && printf ','
      printf '"%s"' "${CORS_ORIGINS[$i]}"
    done
    # PUT for the upload, GET/HEAD so a signed read URL works from a canvas or
    # a fetch. responseHeader lets the browser read what it needs to retry.
    printf '],"method":["PUT","GET","HEAD"],'
    printf '"responseHeader":["Content-Type","x-goog-content-length-range","ETag"],'
    printf '"maxAgeSeconds":3600}]'
  } > "$CORS_FILE"

  gcloud storage buckets update "gs://${BUCKET_NAME}" --cors-file="$CORS_FILE" --quiet >/dev/null
  ok "CORS set on gs://${BUCKET_NAME} for ${#CORS_ORIGINS[@]} origin(s)"

  if [[ "$CREATE_DEV_BUCKET" == "true" ]]; then
    # The dev bucket additionally allows the local dev server.
    {
      printf '[{"origin":['
      for i in "${!CORS_ORIGINS[@]}"; do printf '"%s",' "${CORS_ORIGINS[$i]}"; done
      printf '"http://localhost:3000","http://localhost:8080"'
      printf '],"method":["PUT","GET","HEAD"],'
      printf '"responseHeader":["Content-Type","x-goog-content-length-range","ETag"],'
      printf '"maxAgeSeconds":3600}]'
    } > "$CORS_FILE"
    gcloud storage buckets update "gs://${DEV_BUCKET_NAME}" --cors-file="$CORS_FILE" --quiet >/dev/null
    ok "CORS set on gs://${DEV_BUCKET_NAME} (plus localhost)"
  fi
  rm -f "$CORS_FILE"
fi

# ---------------------------------------------------------------------------
step "IAM for the runtime service account"
# ---------------------------------------------------------------------------

# Everything below is scoped to ONE resource. The runtime identity of this app
# must not be able to read another app's database or bucket, even when they
# share a project — which they will, because that is how this template is used.

# Firestore has no per-database IAM resource, so the binding is project-level
# with a condition that pins it to this database's resource name. Without the
# condition, roles/datastore.user grants access to EVERY database in the
# project. The condition is the whole control.
DATABASE_RESOURCE="projects/${PROJECT_ID}/databases/${DATABASE_ID}"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/datastore.user" \
  --condition="title=only-${DATABASE_ID},description=Restricts access to the ${DATABASE_ID} database,expression=resource.name.startsWith('${DATABASE_RESOURCE}')" \
  --quiet >/dev/null
ok "datastore.user on ${DATABASE_ID} only (IAM condition)"

# objectUser = read, write and delete objects, but NOT administer the bucket.
# Bound on the bucket, so it grants nothing anywhere else in the project.
grant_bucket() {
  local name="$1"
  gcloud storage buckets add-iam-policy-binding "gs://${name}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/storage.objectUser" \
    --quiet >/dev/null
  ok "storage.objectUser on gs://${name} only"
}
grant_bucket "$BUCKET_NAME"
if [[ "$CREATE_DEV_BUCKET" == "true" ]]; then
  grant_bucket "$DEV_BUCKET_NAME"
fi

# Signing a V4 URL needs a private key. There is no key file, by design — so
# the library asks IAM to sign on the service account's behalf instead, which
# requires the account to be able to impersonate ITSELF. This one binding is
# what replaces a downloadable key, and it is why signed URLs work here with
# no credential on disk.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --quiet >/dev/null
ok "iam.serviceAccountTokenCreator on itself (signs URLs without a key)"

# Minting a session cookie calls the Identity Toolkit API, which needs a role
# on the project. VERIFYING a session needs nothing at all — it checks a
# signature against Google's public keys — so without this grant existing
# sessions keep working and only new sign-ins fail, with PERMISSION_DENIED
# from identitytoolkit.
#
# This is the broadest role the runtime identity holds, and it is deliberate
# rather than overlooked: roles/firebaseauth.admin can also create, disable
# and delete users. There is no narrower predefined role that can mint a
# session cookie. Narrow it with a custom role if your threat model needs it,
# and read docs/auth.md before you do — the app breaks in a way that looks
# like a client bug.
if [[ "$SKIP_AUTH" != "true" ]]; then
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/firebaseauth.admin" \
    --quiet >/dev/null
  ok "firebaseauth.admin (mints session cookies; see docs/auth.md)"
fi

# ---------------------------------------------------------------------------
step "IAM for the deployer (data layer)"
# ---------------------------------------------------------------------------

# The deployer publishes indexes and rules before the app deploy. It gets those
# two abilities and nothing more: it still cannot read a document.
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_SA}" \
  --role="roles/datastore.indexAdmin" \
  --condition="title=only-${DATABASE_ID}-indexes,description=Index administration on ${DATABASE_ID},expression=resource.name.startsWith('${DATABASE_RESOURCE}')" \
  --quiet >/dev/null
ok "datastore.indexAdmin on ${DATABASE_ID} only"

if gcloud projects add-iam-policy-binding "$PROJECT_ID" \
     --member="serviceAccount:${DEPLOYER_SA}" \
     --role="roles/firebaserules.admin" \
     --condition=None \
     --quiet >/dev/null 2>&1; then
  ok "firebaserules.admin (deploys firestore.rules)"
else
  warn "Could not grant roles/firebaserules.admin. Rules deployment will warn"
  warn "and continue — see scripts/firestore-deploy.sh."
fi

fi  # end SKIP_DATA

# ---------------------------------------------------------------------------
step "Workload Identity Pool"
# ---------------------------------------------------------------------------
if gcloud iam workload-identity-pools describe "$POOL_ID" --location=global >/dev/null 2>&1; then
  POOL_STATE="$(gcloud iam workload-identity-pools describe "$POOL_ID" \
    --location=global --format='value(state)')"
  if [[ "$POOL_STATE" == "DELETED" ]]; then
    warn "Pool ${POOL_ID} is soft-deleted; undeleting"
    gcloud iam workload-identity-pools undelete "$POOL_ID" --location=global --quiet
    ok "Undeleted ${POOL_ID}"
  else
    skip "Pool ${POOL_ID} already exists"
  fi
else
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --location=global \
    --display-name="GitHub Actions" \
    --description="Keyless authentication for GitHub Actions workflows" \
    --quiet
  ok "Created pool ${POOL_ID}"
fi

# ---------------------------------------------------------------------------
step "Workload Identity provider"
# ---------------------------------------------------------------------------

# THE FIRST SECURITY CONTROL. Without an attribute condition, any repository
# on GitHub could exchange a token for access to this project.
#
# The condition names the OWNER, not one repository. The pool and the provider
# are shared by every repository in this project, so a per-repository condition
# would be overwritten each time you bootstrap the next repository — silently
# breaking the deploy of the previous one. See ADR-0003.
#
# Scoping to the owner is safe because the condition is not what authorises a
# deploy. The `principalSet://` binding below is: it names this repository
# exactly, and it is additive. A repository can mint a token from this provider
# and still impersonate nothing.
ATTRIBUTE_CONDITION="assertion.repository_owner == '${GITHUB_OWNER}'"

ATTRIBUTE_MAPPING="google.subject=assertion.sub"
ATTRIBUTE_MAPPING+=",attribute.repository=assertion.repository"
ATTRIBUTE_MAPPING+=",attribute.repository_owner=assertion.repository_owner"
ATTRIBUTE_MAPPING+=",attribute.ref=assertion.ref"
# Repository and ref in one attribute, so `--main-only` can stay a per-repository
# binding instead of a provider-wide condition that every sibling repository
# would inherit.
ATTRIBUTE_MAPPING+=",attribute.repo_ref=assertion.repository + '@' + assertion.ref"

if gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
     --location=global --workload-identity-pool="$POOL_ID" >/dev/null 2>&1; then

  CURRENT_CONDITION="$(gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
    --location=global \
    --workload-identity-pool="$POOL_ID" \
    --format='value(attributeCondition)')"

  # Never overwrite a condition that belongs to a different owner. Doing so
  # revokes every repository already federated through this provider, and the
  # only symptom is 'The given credential is rejected by the attribute
  # condition' on their next deploy — hours later, in a repository nobody
  # touched. Re-running for a sibling repository of the same owner is a no-op.
  if [[ -n "$CURRENT_CONDITION" && "$CURRENT_CONDITION" != "$ATTRIBUTE_CONDITION" ]]; then

    # One difference is provably safe, and every project bootstrapped before
    # ADR-0003 hits it: an earlier version of THIS script pinned the provider
    # to one repository. Widening `repository == 'OWNER/repo'` to
    # `repository_owner == 'OWNER'` is a strict superset — every token the old
    # condition accepted, the new one accepts too. Nothing can stop deploying.
    #
    # The owner must match. `repository == 'someone-else/repo'` is a different
    # person's provider and widening it to YOUR owner revokes them, which is
    # exactly what the refusal below exists to prevent.
    REPO_PIN_RE="^assertion\.repository[[:space:]]*==[[:space:]]*'${GITHUB_OWNER}/[^']+'"
    if [[ "$CURRENT_CONDITION" =~ $REPO_PIN_RE ]]; then
      warn "Provider ${PROVIDER_ID} is pinned to one repository by an older bootstrap:"
      warn "  current: ${CURRENT_CONDITION}"
      warn "  new:     ${ATTRIBUTE_CONDITION}"
      warn "Same owner, and the new condition accepts everything the old one did,"
      warn "so no repository loses access. Widening it. See ADR-0003."

      # The old --main-only lived in the provider condition. The new one puts it
      # in the per-repository binding, so it has to be asked for again.
      if [[ "$CURRENT_CONDITION" == *"assertion.ref"* && "$RESTRICT_TO_MAIN" != "true" ]]; then
        warn ""
        warn "⚠ The old condition also restricted deploys to a branch. That"
        warn "  restriction is NOT carried over — it now lives in the binding."
        warn "  Re-run with --main-only to keep it."
      fi
    else
      warn "Provider ${PROVIDER_ID} already exists with a different condition:"
      warn "  current: ${CURRENT_CONDITION}"
      warn "  new:     ${ATTRIBUTE_CONDITION}"
      if [[ "$FORCE_PROVIDER_UPDATE" != "true" ]]; then
        die "Refusing to overwrite it. Every repository federated through this provider would stop deploying.
  Use a different --pool/--provider for this owner, or re-run with --force-provider-update if you are sure."
      fi
      warn "--force-provider-update given; overwriting"
    fi
  fi

  gcloud iam workload-identity-pools providers update-oidc "$PROVIDER_ID" \
    --location=global \
    --workload-identity-pool="$POOL_ID" \
    --attribute-mapping="$ATTRIBUTE_MAPPING" \
    --attribute-condition="$ATTRIBUTE_CONDITION" \
    --quiet
  ok "Updated provider ${PROVIDER_ID}"
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --location=global \
    --workload-identity-pool="$POOL_ID" \
    --display-name="GitHub OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="$ATTRIBUTE_MAPPING" \
    --attribute-condition="$ATTRIBUTE_CONDITION" \
    --quiet
  ok "Created provider ${PROVIDER_ID}"
fi
ok "Condition: ${ATTRIBUTE_CONDITION}"

# ---------------------------------------------------------------------------
step "Allowing the repository to impersonate the deployer"
# ---------------------------------------------------------------------------
# THE SECOND SECURITY CONTROL, and the one that actually authorises a deploy.
# The provider's condition only decides who may mint a token. This binding
# decides which service account that token can impersonate, and it names this
# repository exactly.
#
# It is additive, so bootstrapping a sibling repository adds its own binding and
# leaves this one alone. That is the whole reason the per-repository pin lives
# here and not in the provider condition. See ADR-0003.
POOL_PRINCIPAL="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}"

if [[ "$RESTRICT_TO_MAIN" == "true" ]]; then
  # repo_ref is repository and ref in one mapped attribute, so this stays a
  # per-repository restriction. A provider-wide 'assertion.ref' condition would
  # force every sibling repository onto main too.
  PRINCIPAL="${POOL_PRINCIPAL}/attribute.repo_ref/${GITHUB_REPO}@refs/heads/main"
  GRANTED_TO="${GITHUB_REPO} on refs/heads/main"
else
  PRINCIPAL="${POOL_PRINCIPAL}/attribute.repository/${GITHUB_REPO}"
  GRANTED_TO="${GITHUB_REPO} (any ref)"
fi

gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA" \
  --role="roles/iam.workloadIdentityUser" \
  --member="$PRINCIPAL" \
  --quiet >/dev/null
ok "workloadIdentityUser granted to ${GRANTED_TO}"

WIF_PROVIDER="$(gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  --format='value(name)')"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
cat <<EOF

${GREEN}${BOLD}Bootstrap complete.${RESET}

${BOLD}1. Set the GitHub secrets and variables${RESET}

   gh secret set WIF_PROVIDER        --body "${WIF_PROVIDER}"
   gh secret set WIF_SERVICE_ACCOUNT --body "${DEPLOYER_SA}"

   gh variable set GCP_PROJECT_ID      --body "${PROJECT_ID}"
   gh variable set GCP_REGION          --body "${REGION}"
   gh variable set ARTIFACT_REPOSITORY --body "${AR_REPOSITORY}"
   gh variable set CLOUD_RUN_SERVICE   --body "${SERVICE_NAME}"
   gh variable set APP_SLUG            --body "${SERVICE_NAME}"
   gh variable set RUNTIME_SERVICE_ACCOUNT --body "${RUNTIME_SA}"
   gh variable set FIRESTORE_DATABASE_ID   --body "${DATABASE_ID}"
   gh variable set GCS_BUCKET              --body "${BUCKET_NAME}"

   (Or paste them in Settings > Secrets and variables > Actions.)

${BOLD}1b. Finish Firebase Auth in the console${RESET}

   These four steps CANNOT be scripted. There is no gcloud surface for
   enabling a sign-in provider or registering a web app, so they are done
   once, by hand, in the Firebase console.

   a. Add Firebase to this project (free, and it stays the same GCP project):
        https://console.firebase.google.com/  ->  Add project  ->  ${PROJECT_ID}

   b. Register a WEB app, then copy its config values:
        Project settings > General > Your apps > Web
        You need: apiKey, authDomain, appId.

   c. Enable the two sign-in providers:
        Authentication > Sign-in method
          - Google  ->  Enable, set a support email
          - Phone   ->  Enable

   d. ${BOLD}Restrict SMS to the countries you serve.${RESET}
        Authentication > Settings > SMS region policy  ->  Allow only, e.g. IN

        Do not skip this. An open phone-auth endpoint is the target of SMS
        pumping fraud: an attacker sends codes to premium numbers they earn
        revenue from, and you are billed per message. The default allows
        every country on earth.

   Then set the web config as repository VARIABLES — they are public values,
   not secrets, and they are inlined into the browser bundle at build time:

     gh variable set FIREBASE_API_KEY     --body "AIza..."
     gh variable set FIREBASE_AUTH_DOMAIN --body "${PROJECT_ID}.firebaseapp.com"
     gh variable set FIREBASE_PROJECT_ID  --body "${PROJECT_ID}"
     gh variable set FIREBASE_APP_ID      --body "1:...:web:..."

   Also add the app's own origins to Authentication > Settings > Authorized
   domains, or Google sign-in is refused from them.

   Skip all of this and the app still deploys and still serves public reads.
   Sign-in is simply unavailable, and every write route answers 401.

${BOLD}2. Deploy${RESET}

   Merge to main, or:  gh workflow run deploy.yml

${BOLD}3. After the first deploy, pin the public URL${RESET}

   URL=\$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format='value(status.url)')
   gh variable set APP_URL --body "\$URL"
   gh workflow run deploy.yml   # rebuild so the URL is inlined into the bundle

${BOLD}Recommended: set a budget alert before you forget${RESET}

   gcloud billing budgets create \\
     --billing-account="\$(gcloud billing projects describe ${PROJECT_ID} --format='value(billingAccountName)' | cut -d/ -f2)" \\
     --display-name="${SERVICE_NAME} budget" \\
     --budget-amount=50 \\
     --threshold-rule=percent=0.5 \\
     --threshold-rule=percent=0.9 \\
     --filter-projects="projects/${PROJECT_ID}"

   (No currency suffix: the amount is in your billing account's own currency.
    A mismatched currency such as 50USD on a non-USD account is rejected.
    Adjust the number to taste; alerts fire at 50% and 90% of it.)

${BOLD}Local development${RESET}

   Add these to .env.local so the app finds its data:

     APP_SLUG=${SERVICE_NAME}
     GCP_PROJECT_ID=${PROJECT_ID}
     GCP_REGION=${REGION}
     FIRESTORE_DATABASE_ID=${DATABASE_ID}
     GCS_BUCKET=${DEV_BUCKET_NAME}

   Then authenticate once, so the SDKs find Application Default Credentials:

     gcloud auth application-default login

   Or skip the cloud entirely and run against the emulator:

     pnpm db:emulator     # in one terminal
     pnpm dev             # in another, with FIRESTORE_EMULATOR_HOST set

   See docs/local-development.md.

${BOLD}Notes${RESET}

  - No service account key was created. There is no key to leak or rotate.
  - ${RUNTIME_SA} also holds roles/firebaseauth.admin,
    which is what lets it mint session cookies. It is the broadest role the
    runtime identity has; docs/auth.md explains why and how to narrow it.
  - The runtime service account ${RUNTIME_SA}
    can use ${DATABASE_ID} and gs://${BUCKET_NAME}, and nothing else.
    Grant anything further one resource at a time.
  - ${BOLD}The Firestore location and the bucket location are permanent.${RESET}
  - Re-running this script is safe. Running it with a different --service in
    this project creates a separate database and bucket, and leaves this app's
    alone.
  - Tear it all down with: ./scripts/gcp-teardown.sh --project ${PROJECT_ID} --service ${SERVICE_NAME}

EOF
