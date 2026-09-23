# Environment variables and secrets

The configuration model, end to end. The canonical list of variables is [`.env.example`](../.env.example); this document explains the _system_ around it.

---

## The mental model

```
                       BUILD TIME                          RUNTIME
                  (GitHub Actions, docker build)      (Cloud Run instance)
                            │                                 │
  NEXT_PUBLIC_* ────────────┤                                 │
  (docker build-arg)        │                                 │
                            ▼                                 │
                    inlined into the                          │
                    JavaScript bundle                         │
                    ★ public forever ★                        │
                                                              │
  Cloud Run env vars ─────────────────────────────────────────┤
  (--set-env-vars)                                            │
                                                              │
  Secret Manager ─────────────────────────────────────────────┤
  (--set-secrets)                                             │
                                                              │
  Platform (PORT, K_SERVICE, K_REVISION) ─────────────────────┤
                                                              ▼
                                                        process.env
                                                              │
                                                              ▼
                                                        lib/env.ts
                                                    (validate once, at
                                                     module load, then
                                                     export a typed object)
```

Two rules follow from this diagram, and almost every configuration bug is a violation of one of them:

1. **`NEXT_PUBLIC_*` is baked in at build time.** Changing it on the Cloud Run service does nothing — the value is already inside the JavaScript your users downloaded. You must rebuild.
2. **`NEXT_PUBLIC_*` is public.** It is in a file served to browsers. Never put a credential behind that prefix, no matter how convenient.

---

## `lib/env.ts` — the single entry point

Nothing else in the codebase reads `process.env`.

```ts
import { env } from '@/lib/env';

if (env.isProduction) {
  logger.info('Serving', { version: env.appVersion, region: env.gcpRegion });
}
```

**Why centralise:** `process.env.FOO` is `string | undefined` at every call site. A typo or an unset variable then becomes an `undefined` in business logic. Validation at module load instead makes the container refuse to start. Cloud Run reports this as a failed revision and rolls back, rather than serving broken responses for hours.

**Why it must throw, not warn:** a warning in a log nobody reads is not a control. A failed revision is.

---

## Adding a variable

All four steps, in the same PR. Skipping any one of them breaks somebody.

**1. Document it in `.env.example`**

```bash
# Purpose of the variable, one or two lines.
# Values: a | b | c
# Default: a
# Required in production: yes/no
MY_VARIABLE=a
```

**2. Declare and validate it in `lib/env.ts`**

```ts
export const env = {
  // ...
  myVariable: oneOf('MY_VARIABLE', process.env.MY_VARIABLE, ['a', 'b', 'c'], 'a'),
} as const;
```

**3. Wire it into delivery**, in `.github/workflows/deploy.yml`

Public (build-time):

```yaml
build-args: |
  NEXT_PUBLIC_MY_VARIABLE=${{ vars.MY_VARIABLE }}
```

...and add a matching `ARG`/`ENV` pair in the `builder` stage of the `Dockerfile`.

Server-side (runtime):

```yaml
env_vars: |-
  MY_VARIABLE=${{ vars.MY_VARIABLE }}
```

**4. Note it in this document's table below** if it needs operator context.

---

## Local development

```bash
cp .env.example .env.local
```

`.env.local` is gitignored and takes precedence over `.env`. Next.js loads it automatically — no `dotenv` dependency needed.

Load order, highest precedence first: `.env.local` → `.env.$NODE_ENV` → `.env`. Real shell environment variables override all of them.

To test against the production image locally:

```bash
docker compose up --build   # reads .env.local if present, via env_file
```

---

## Secrets

Never in `.env` (committed), never in a build arg (build args are visible in `docker history`), never in a Cloud Run env var literal (visible to anyone with `run.services.get`).

### Creating

```bash
gcloud services enable secretmanager.googleapis.com

gcloud secrets create DATABASE_URL --replication-policy=automatic

# Pipe the value — never pass it as an argument, where it lands in shell history
printf '%s' 'postgresql://user:pass@host:5432/db' \
  | gcloud secrets versions add DATABASE_URL --data-file=-
```

### Granting access

To the **runtime** service account (the identity the app runs as), not the deployer:

```bash
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:my-app-runtime@my-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Mounting into Cloud Run

Add to the `flags:` in `deploy.yml`:

```yaml
--set-secrets=DATABASE_URL=DATABASE_URL:latest
```

The secret arrives as an ordinary environment variable, so `lib/env.ts` reads it like any other value.

`:latest` resolves at instance start. A new secret version does not affect running instances. Deploy a new revision to use it. Pin to a specific version (`:3`) when you need change control.

### Rotating

```bash
printf '%s' "$NEW_VALUE" | gcloud secrets versions add DATABASE_URL --data-file=-
gcloud run services update my-app --region asia-south1  # new revision
gcloud secrets versions disable 1 --secret=DATABASE_URL     # after verifying
```

Disable before destroying — disabling is reversible, destroying is not.

---

## GitHub Actions configuration

| Kind         | Use for                            | Visible in logs | Set with               |
| ------------ | ---------------------------------- | --------------- | ---------------------- |
| **Secret**   | Values whose disclosure is harmful | Masked          | `gh secret set NAME`   |
| **Variable** | Non-sensitive configuration        | Plain text      | `gh variable set NAME` |

Current inventory:

| Name                         | Kind     | Required | Purpose                                                                        |
| ---------------------------- | -------- | -------- | ------------------------------------------------------------------------------ |
| `WIF_PROVIDER`               | secret   | yes      | Workload Identity provider resource name                                       |
| `WIF_SERVICE_ACCOUNT`        | secret   | yes      | Deployer service account email                                                 |
| `GCP_PROJECT_ID`             | variable | yes      | Target GCP project                                                             |
| `GCP_REGION`                 | variable | no       | Deployment region (default `asia-south1`)                                      |
| `ARTIFACT_REPOSITORY`        | variable | no       | Artifact Registry repository (default `containers`)                            |
| `CLOUD_RUN_SERVICE`          | variable | no       | Service name (defaults to the repository name)                                 |
| `APP_URL`                    | variable | no       | Public URL — **inlined at build time**                                         |
| `APP_NAME`                   | variable | no       | Display name                                                                   |
| `LOG_LEVEL`                  | variable | no       | Runtime verbosity (default `info`)                                             |
| `MIN_INSTANCES`              | variable | no       | `1` removes cold starts, at a cost                                             |
| `MAX_INSTANCES`              | variable | no       | Scaling and bill ceiling (default `10`)                                        |
| `APP_SLUG`                   | variable | no       | Names the database, bucket and runtime identity (defaults to the service name) |
| `RUNTIME_SERVICE_ACCOUNT`    | variable | no       | Identity the revision runs as (default `<slug>-runtime@<project>`)             |
| `FIRESTORE_DATABASE_ID`      | variable | no       | Override only for an existing database (default `<slug>-db`)                   |
| `GCS_BUCKET`                 | variable | no       | Override only for an existing bucket (default `<project>-<slug>-media`)        |
| `HEALTH_DEEP_CHECKS_ENABLED` | variable | no       | Enables `/api/health?deep=1` (default `false`)                                 |
| `DEPLOYED_AT`                | computed | no       | UTC deploy time the workflow injects; `/api/health` shows it in IST            |

> **`RUNTIME_SERVICE_ACCOUNT` matters more than it looks.** Without it Cloud Run runs the revision as the **default compute service account**, which is Editor on the whole project — the opposite of the least-privilege identity `gcp-bootstrap.sh` created. The workflow derives the right one from `APP_SLUG`, so set this only when the account has a non-default name.

`WIF_PROVIDER` and `WIF_SERVICE_ACCOUNT` are resource identifiers rather than credentials — useless without a valid OIDC token from this repository. They are stored as secrets to avoid publishing your project layout, not because a leak would grant access.

---

## Data layer configuration

Four variables, and only two of them usually need setting. The database id and bucket name derive from the slug and project, so a new app sets `APP_SLUG` and `GCP_PROJECT_ID` and gets the rest.

| Variable                | Default                             | Required in production |
| ----------------------- | ----------------------------------- | ---------------------- |
| `APP_SLUG`              | —                                   | **yes**                |
| `GCP_PROJECT_ID`        | —                                   | **yes**                |
| `FIRESTORE_DATABASE_ID` | `<APP_SLUG>-db`                     | **yes** (derived)      |
| `GCS_BUCKET`            | `<GCP_PROJECT_ID>-<APP_SLUG>-media` | **yes** (derived)      |

"Required in production" is literal: `lib/env.ts` throws at container start when `NODE_ENV=production` and any of them is missing, so Cloud Run rejects the revision and keeps serving the previous one. The error lists every missing variable at once.

Two carve-outs, both deliberate:

- **`next build` is exempt.** It runs with `NODE_ENV=production` and imports every route to collect metadata, so without the exemption the Docker builder stage would need production database configuration in order to compile. Only `NEXT_PUBLIC_*` matters at build time.
- **The browser is exempt.** Next.js replaces a non-`NEXT_PUBLIC_` read with `undefined` in the client bundle, so without the exemption a Client Component that ever imported `lib/env.ts` would throw on every page load while the server was perfectly healthy.

### Overriding the derived names

Only to adopt a resource that already exists under another name. Changing either variable does **not** rename anything — it points the app somewhere else, and an app pointed at a database that does not exist fails with `5 NOT_FOUND` on its first query.

### An app that needs no database

Pass `--skip-data` to `gcp-bootstrap.sh`, then delete the required block and the four fields from `lib/env.ts`. Say so in the pull request.

---

## Authentication configuration

Six variables. The four `NEXT_PUBLIC_FIREBASE_*` values come from the Firebase console; the two `AUTH_*` values have working defaults.

| Variable                           | Default                     | Required in production |
| ---------------------------------- | --------------------------- | ---------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`     | —                           | no — see below         |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `<project>.firebaseapp.com` | no (derived)           |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  | `GCP_PROJECT_ID`            | no (derived)           |
| `NEXT_PUBLIC_FIREBASE_APP_ID`      | —                           | no — see below         |
| `AUTH_SESSION_MAX_AGE_DAYS`        | `14`                        | no                     |
| `AUTH_CHECK_REVOKED`               | `false`                     | no                     |

### Why these are not required in production

Requiring them would refuse to start, which turns a half-finished Firebase setup into an outage. Instead the app **fails closed**: `authEnabled` in `lib/env.ts` is derived from the web config being complete, and when it is not, the app serves public reads and answers 401 to every write.

Missing configuration can therefore never produce an open endpoint. It produces a read-only one.

### These are build-time values, and they are public

`NEXT_PUBLIC_*` is inlined into the JavaScript bundle when the image is built. Setting one on the Cloud Run service does nothing — the value is already inside the code users downloaded. **Rebuild.**

They are also public, which is correct. The Firebase API key identifies the project; it authorises nothing. The browser must send it to reach Identity Platform, so hiding it is not possible and not the control. Restrict it by HTTP referrer in the Google Cloud console under APIs & Services > Credentials.

They go in `build-args` in `deploy.yml`, sourced from repository **variables**. That does not contradict "never put a secret in a build arg" — these are not secrets.

### `AUTH_CHECK_REVOKED`

On, every authenticated request asks Identity Platform whether the underlying refresh token was revoked, so "sign out everywhere" takes effect immediately. That is one call to an external service in the hot path of every request. Off is right for most apps; on is right for money and health data.

---

## Platform-injected variables

Cloud Run sets these; do not define them yourself.

| Variable          | Value              | Note                               |
| ----------------- | ------------------ | ---------------------------------- |
| `PORT`            | `8080`             | **Must** be honoured by the server |
| `K_SERVICE`       | Service name       | Useful in logs                     |
| `K_REVISION`      | Revision name      | Identifies the exact deployment    |
| `K_CONFIGURATION` | Configuration name | Rarely needed                      |

---

## Anti-patterns

| Don't                                           | Why                                                                       | Do instead                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_API_SECRET`                        | Shipped to every browser                                                  | Server-side variable, read in `services/`      |
| `process.env.FOO` in a component                | Untyped, unvalidated, easy to typo                                        | `import { env } from '@/lib/env'`              |
| Committing `.env.local`                         | Secrets in git history, forever                                           | `.gitignore` already covers it                 |
| `--build-arg DATABASE_URL=...`                  | Visible in `docker history`                                               | Secret Manager at runtime                      |
| `gh secret set FIREBASE_API_KEY`                | It is not a secret, and a secret cannot be inlined at build time cleanly  | `gh variable set`, restricted by HTTP referrer |
| Setting `NEXT_PUBLIC_FIREBASE_*` on the service | Inlined at build time; changing it at runtime does nothing                | Set the variables, then rebuild the image      |
| Changing `NEXT_PUBLIC_*` on the service         | Silently has no effect                                                    | Rebuild the image                              |
| A secret with no owner or rotation plan         | Nobody dares to change it later                                           | Document owner and rotation in the PR          |
| `FIRESTORE_EMULATOR_HOST` on a deployed service | Every read and write routes to a host that does not exist                 | Set it only locally and in the emulator runner |
| Deploying without `RUNTIME_SERVICE_ACCOUNT`     | The revision runs as the default compute account, which is project Editor | Let the workflow derive it from `APP_SLUG`     |
| Pointing a Cloud Run probe at `?deep=1`         | A dependency blip kills healthy containers                                | Dashboards and uptime checks only              |
