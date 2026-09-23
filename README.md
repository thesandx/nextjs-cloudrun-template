<div align="center">

# Next.js → Cloud Run Template

**A production-ready Next.js starter that deploys itself to Google Cloud Run.**

Multi-stage Docker build · Keyless CI/CD via Workload Identity Federation · Strict TypeScript · Documented for humans and AI assistants

[![PR Validation](https://github.com/thesandx/nextjs-cloudrun-template/actions/workflows/pr-validation.yml/badge.svg)](https://github.com/thesandx/nextjs-cloudrun-template/actions/workflows/pr-validation.yml)
[![Deploy](https://github.com/thesandx/nextjs-cloudrun-template/actions/workflows/deploy.yml/badge.svg)](https://github.com/thesandx/nextjs-cloudrun-template/actions/workflows/deploy.yml)
[![CodeQL](https://github.com/thesandx/nextjs-cloudrun-template/actions/workflows/codeql.yml/badge.svg)](https://github.com/thesandx/nextjs-cloudrun-template/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

</div>

---

## Overview

Most Next.js templates give you an application. This one also gives you **the path to production**. You get a container that runs on Cloud Run, a pipeline that deploys it without storing a single credential, and documentation that explains each decision.

The app itself is one page. That is the point — everything else is the reusable part.

**What you get**

|                              |                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| ⚡ **Next.js 16 + React 19** | App Router, Server Components by default, TypeScript in strict mode                 |
| 🐳 **Optimised container**   | Multi-stage build, ~65 MB, non-root user, health checks, correct signal handling    |
| 🔐 **Keyless deployment**    | Workload Identity Federation — no JSON service account keys, anywhere               |
| 🚀 **CI/CD that verifies**   | PR validation builds and smoke-tests the real container; deploys probe the live URL |
| ☁️ **Cloud Run native**      | Honours `$PORT`, binds `0.0.0.0`, autoscales, scales to zero                        |
| 🧭 **AI-assistant ready**    | `.github/instructions/` — rules that keep generated code consistent across projects |
| 🎨 **A design language**     | Mochi: tokens, seven primitives, a living reference at `/design`, enforced by lint  |
| 📐 **Enterprise structure**  | Clear layer boundaries, absolute imports, enforced import ordering                  |
| 📚 **Documented**            | Runbooks, ADRs, troubleshooting — not just a list of commands                       |

---

## Architecture

```
   Developer
       │ git push
       ▼
   ┌─────────────────────────────────────────────────────┐
   │                     GitHub                          │
   │  ┌───────────────┐         ┌─────────────────────┐  │
   │  │ PR Validation │         │       Deploy        │  │
   │  │ lint · build  │         │  build · push       │  │
   │  │ typecheck     │         │  deploy · verify    │  │
   │  │ test · docker │         │                     │  │
   │  │ (no cloud     │         │  OIDC token ────────┼──┼──┐
   │  │  access)      │         │  (no stored keys)   │  │  │
   │  └───────────────┘         └─────────────────────┘  │  │
   └─────────────────────────────────────────────────────┘  │
                                                            ▼
                                   ┌────────────────────────────────────┐
                                   │  Workload Identity Pool            │
                                   │  condition: repository == this one │
                                   └────────────────┬───────────────────┘
                                                    │ impersonate
                                                    ▼
                                   ┌────────────────────────────────────┐
                                   │  Deployer service account          │
                                   └───────┬────────────────┬───────────┘
                                           │ push           │ deploy
                                           ▼                ▼
                        ┌────────────────────────┐  ┌────────────────────────┐
                        │   Artifact Registry    │─▶│      Cloud Run         │
                        │  image:<commit-sha>    │  │  revision per commit   │
                        │  image:latest          │  │  min=0  max=10         │
                        └────────────────────────┘  │  autoscaling, TLS      │
                                                    └───────────┬────────────┘
                                                                │
                                          ┌─────────────────────┼─────────────────┐
                                          ▼                     ▼                 ▼
                                     End users          Cloud Logging      Secret Manager
                                    (HTTPS, managed    (structured JSON)   (when needed)
                                       certificate)
```

Deeper detail — request path, scaling behaviour, security boundaries, evolution path — in [`cloud/architecture.md`](./cloud/architecture.md).

---

## New app in 6 commands

From nothing to your own domain serving traffic.

```bash
# 1. Create the repository from this template
gh repo create my-app --template thesandx/nextjs-cloudrun-template --private --clone && cd my-app

# 2. Make it yours. Writes .env.local with the app slug and derived names.
./scripts/rename-project.sh my-app --owner my-github-org --project my-gcp-project

# 3. Provision Google Cloud. Idempotent, and no key is ever created.
#    APIs, Artifact Registry, Workload Identity Federation, two service
#    accounts, the Firestore database my-app-db, the bucket
#    my-gcp-project-my-app-media, a dev bucket, backups, least-privilege IAM.
./scripts/gcp-bootstrap.sh \
  --project my-gcp-project --region asia-south1 \
  --repo my-github-org/my-app --service my-app

# 4. Set what the script printed
gh secret   set WIF_PROVIDER            --body "projects/123456789/locations/global/workloadIdentityPools/github/providers/github"
gh secret   set WIF_SERVICE_ACCOUNT     --body "github-deployer@my-gcp-project.iam.gserviceaccount.com"
gh variable set GCP_PROJECT_ID          --body "my-gcp-project"
gh variable set GCP_REGION              --body "asia-south1"
gh variable set APP_SLUG                --body "my-app"
gh variable set CLOUD_RUN_SERVICE       --body "my-app"
gh variable set RUNTIME_SERVICE_ACCOUNT --body "my-app-runtime@my-gcp-project.iam.gserviceaccount.com"

# 5. Deploy, then read the URL Cloud Run generated
git push origin main
gcloud run services describe my-app --region asia-south1 --format='value(status.url)'

# 6. Put your own domain in front — free, and it brings a CDN
npx firebase-tools deploy --only hosting    # needs a firebase.json; see the walkthrough
gh variable set APP_URL --body "https://app.example.com"
gh workflow run deploy.yml                  # rebuild, so the real URL is inlined
```

Step 6 needs two manual pieces: **Firebase console → Hosting → Add custom domain**, then copy the DNS records it prints into your registrar. [`cloud/deployment.md` > First deploy, end to end](./cloud/deployment.md#first-deploy-end-to-end) walks all of it, with the checks to run between each step.

Then `pnpm install && pnpm dev`, and open <http://localhost:3000/example> — a working page showing the whole data layer: create a document, list a bounded page, upload an image, display it from a signed URL. Copy the pattern and delete it.

> **Run step 3 before step 5.** The pipeline publishes Firestore indexes _before_ it builds the image, so merging without a database fails the whole deploy — no image, no revision.

> **`--service` must be 22 characters or fewer.** The runtime service account id is `<service>-runtime`, and a Google service account id must be 6–30 characters.

> **A Firestore database's location is permanent,** and so is a bucket's. Neither can be moved. Pick the region before step 3.

> **`asia-south1` does not support Cloud Run domain mappings.** That is why step 6 uses Firebase Hosting — free, faster, and it works in every region this template targets. A Global External Application Load Balancer is the other option. See [`cloud/deployment.md`](./cloud/deployment.md#custom-domain).

The rest of this section explains each step.

---

## Quick start

### 1. Create your repository

Click **[Use this template](https://github.com/thesandx/nextjs-cloudrun-template/generate)** → _Create a new repository_.

Or with the CLI:

```bash
gh repo create my-app --template thesandx/nextjs-cloudrun-template --private --clone
cd my-app
```

> **Use the template button, not `git clone`.** Templates start with clean history and no upstream remote — you get your project, not a fork of this one.

### 2. Rename it

```bash
./scripts/rename-project.sh my-app --owner my-github-org --project my-gcp-project
```

Replaces the template name across `package.json`, Compose, docs and issue templates, and writes a `.env.local` holding the app slug and the names derived from it. Add `--reset-git` to start from a single fresh commit.

The new name is the **app slug**: one name for the Cloud Run service, the runtime service account, the Firestore database and the bucket. That is what keeps two apps in one GCP project from reaching each other's data.

### 3. Run it

```bash
corepack enable        # gets the right pnpm version from package.json
pnpm install
pnpm dev               # .env.local was written by step 2
```

<http://localhost:3000>, and <http://localhost:3000/example> for the data layer.

Want data without a Google Cloud account? Run the Firestore emulator:

```bash
gcloud components install cloud-firestore-emulator   # once, needs Java 21+
pnpm db:emulator                                     # terminal 1
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 pnpm dev      # terminal 2
```

### 4. Set up Google Cloud

One command, idempotent, no keys created:

```bash
./scripts/gcp-bootstrap.sh \
  --project my-gcp-project \
  --region asia-south1 \
  --repo my-github-org/my-app \
  --service my-app            # keep this to 22 characters or fewer — see the note below
```

> **Keep `--service` to 22 characters or fewer.** The script derives the runtime service account id as `<service>-runtime`, and a Google service account id must be 6–30 characters. A longer service name fails with `does not have a length between 6 and 30`.

It enables APIs, creates the Artifact Registry repository, sets up Workload Identity Federation, creates least-privilege service accounts, provisions the Firestore database and the Cloud Storage bucket, and prints the exact `gh secret` / `gh variable` commands to run.

Two of those variables are easy to miss and both matter:

- **`APP_SLUG`** — names the database, the bucket and the runtime identity. `FIRESTORE_DATABASE_ID` and `GCS_BUCKET` derive from it, so you rarely set those.
- **`RUNTIME_SERVICE_ACCOUNT`** — the identity the revision runs as. Leave it unset and Cloud Run falls back to the default compute account, which holds Editor on the whole project. That is the opposite of the least-privilege account this script just created.

What it creates for the data layer:

| Resource           | Name                                    | Notes                                                 |
| ------------------ | --------------------------------------- | ----------------------------------------------------- |
| Firestore database | `my-app-db`                             | Native mode, `$GCP_REGION`, **location is permanent** |
| Backups            | daily, 7-day retention                  | Plus point-in-time recovery                           |
| Storage bucket     | `my-gcp-project-my-app-media`           | Uniform access, public access prevention, soft delete |
| Dev bucket         | `...-media-dev`                         | So a laptop never writes to production storage        |
| Lifecycle rule     | delete `tmp/` after 1 day               | Sweeps uploads that were started but never finalized  |
| Runtime IAM        | `datastore.user` + `storage.objectUser` | Scoped to **this** database and **this** bucket only  |

Add `--cors-origin https://your-domain` for direct browser uploads, and `--skip-data` if an app genuinely needs no database.

**Tearing one down:**

```bash
./scripts/gcp-teardown.sh --project my-gcp-project --service my-app
```

It deletes the database, the buckets, the Cloud Run service and the runtime identity, and leaves everything shared with other apps alone. You must type the app slug to confirm — there is no `--yes` flag, on purpose.

### 5. Deploy

```bash
git push origin main
gh run watch
```

The pipeline publishes Firestore indexes and rules, builds the image, pushes it, deploys a revision tagged with the commit SHA, and probes the live health endpoint before reporting success.

> **Step 4 must come first.** Indexes publish _before_ the build, so a first deploy with no database fails the whole pipeline. The error names the fix.

Cloud Run generates the service URL, so it only exists after this first deploy:

```bash
URL=$(gcloud run services describe my-app --region asia-south1 --format='value(status.url)')
curl -s "$URL/api/health" | jq
```

Check `status` is `ok` and `version` matches the commit you pushed. Open `$URL/example` too — it exercises Firestore and Cloud Storage end to end.

**Nothing public has changed yet.** Your domain is untouched until the next step, so everything so far is reversible.

### 6. Put your domain in front

Cloud Run domain mapping works in only a few regions, and `asia-south1` is not one of them. Firebase Hosting is free, covers every region this template targets, and adds a CDN.

Create `firebase.json`:

```json
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "run": { "serviceId": "my-app", "region": "asia-south1" } }]
  }
}
```

```bash
npx firebase-tools login
npx firebase-tools use my-gcp-project
npx firebase-tools deploy --only hosting
```

Then **Firebase console → Hosting → Add custom domain**. It prints a `TXT` record to prove ownership and `A` records to point at Firebase. Add both wherever your DNS lives — Hostinger, Namecheap, Cloudflare. The domain registration stays where it is; you change records, not ownership.

```bash
dig +short app.example.com
curl -sI https://app.example.com
```

Finally, inline the real URL and rebuild:

```bash
gh variable set APP_URL --body "https://app.example.com"
gh workflow run deploy.yml -f reason="Inline the production URL"
```

> **The rebuild is not optional.** `NEXT_PUBLIC_APP_URL` is inlined at **build** time. Until you rebuild, canonical URLs, Open Graph tags and metadata still carry the old value. Changing a Cloud Run environment variable does nothing here.

Uploading files from the browser? Re-run bootstrap with your origin, now that you know it:

```bash
./scripts/gcp-bootstrap.sh ... --cors-origin https://app.example.com
```

Full walkthrough, with the other two domain options: [`cloud/deployment.md`](./cloud/deployment.md#first-deploy-end-to-end).

---

## Project structure

```
.
├── app/                    # Routes, layouts, route handlers (App Router)
│   ├── api/health/         #   Liveness probe for Docker + Cloud Run
│   ├── api/example/        #   EXAMPLE — data layer endpoints, delete these
│   ├── example/            #   EXAMPLE — the page that uses them
│   ├── layout.tsx          #   Root layout — a Server Component, keep it that way
│   ├── page.tsx            #   Template home page — proves the deploy, shows the primitives
│   ├── design/             #   Living reference for the design language
│   ├── error.tsx           #   Error boundary
│   └── not-found.tsx       #   404
│
├── components/             # Reusable components (ui/, layout/, <feature>/)
│   └── ui/                 #   Mochi primitives: Button, Card, Input, Face …
├── hooks/                  # Reusable React hooks
├── lib/                    # Pure utilities — no I/O
│   ├── env.ts              #   Validated env vars; the ONLY reader of process.env
│   ├── logger.ts           #   Structured logging for Cloud Logging
│   ├── storage-paths.ts    #   Object paths and upload rules — pure, so testable
│   ├── http-errors.ts      #   Typed errors to HTTP status codes
│   └── utils.ts
├── services/               # External I/O: APIs, databases, cloud SDKs
│   ├── firestore.client.ts #   Lazy Firestore singleton, named database
│   ├── storage.client.ts   #   Lazy Cloud Storage singleton and the bucket
│   ├── repository.ts       #   Typed, validated, cursor-paginated collections
│   ├── storage.service.ts  #   Signed URLs and upload verification
│   └── sharded-counter.ts  #   Counters above one write per second
├── types/                  # Shared TypeScript types
│
├── public/                 # Static assets
│   └── fonts/              #   Self-hosted Mochi typefaces, so builds work offline
├── styles/                 # globals.css and design tokens
├── tests/                  # Test setup
│
├── docs/                   # Guides, ADRs, troubleshooting
├── cloud/                  # Google Cloud documentation and runbooks
├── scripts/                # gcp-bootstrap, gcp-teardown, firestore-deploy, rename
│
├── firestore.rules         # Security rules — deny all client access
├── firestore.indexes.json  # Composite indexes and field exemptions, as code
│
├── .github/
│   ├── workflows/          #   pr-validation · deploy · codeql
│   ├── instructions/       #   Rules for AI coding assistants
│   └── ...
│
├── Dockerfile              # Multi-stage production build
├── docker-compose.yml      # Run the production image locally
└── CLAUDE.md               # Entry point for AI assistants
```

`components/`, `hooks/` and `services/` ship with a `README.md` describing the conventions for that folder. Read it before adding the first file.

Full rationale, including where each kind of file belongs: [`.github/instructions/project-structure.md`](./.github/instructions/project-structure.md).

---

## Local development

```bash
pnpm dev              # dev server, hot reload
pnpm validate         # everything CI runs: typecheck, lint, format, test
pnpm test:watch       # tests in watch mode
pnpm lint:fix         # fix lint + import order
```

> **On a fresh clone, run `pnpm build` before `pnpm typecheck`.** `next build` generates `next-env.d.ts` and `.next/types/**`, which `tsc` needs and which are gitignored. CI orders it the same way.

Full guide: [`docs/local-development.md`](./docs/local-development.md).

---

## Docker

The container is the deployment artefact. It is worth running locally before you trust it.

```bash
docker compose up --build          # build and run the production image
curl localhost:8080/api/health     # verify
docker compose ps                  # should report "healthy"
docker compose down
```

Or via the scripts:

```bash
pnpm docker:build
pnpm docker:run
```

**How the image stays small**

| Stage     | Role                                                                                |
| --------- | ----------------------------------------------------------------------------------- |
| `base`    | Pinned Node 22 + Alpine, corepack, `dumb-init`                                      |
| `deps`    | `pnpm install` from manifests only — caches independently of source                 |
| `builder` | `pnpm build`, producing `.next/standalone`                                          |
| `runner`  | Standalone output + static assets only. No source, no dev deps, no package manager. |

`output: 'standalone'` in `next.config.ts` traces the modules reachable at runtime. This takes the image from ~1.2 GB to ~65 MB.

> Sizes quoted here are what a registry stores and Cloud Run pulls (`docker save` / `docker image inspect`). Docker Desktop's containerd image store displays the _unpacked_ size instead — around 280 MB for the same image. Both numbers are correct. They measure different things.

**Cloud Run compliance, built in**

- Listens on `$PORT` — never a hardcoded port
- Binds `0.0.0.0` — the fix for the common _"container failed to start and listen on the port"_ error
- Runs as non-root (uid 1001)
- `dumb-init` as PID 1, so `SIGTERM` is honoured and in-flight requests drain
- `HEALTHCHECK` against `/api/health`
- Read-only root filesystem and `no-new-privileges` in Compose

---

## Cloud Run deployment

**Merging to `main` deploys.** No manual step.

```
merge  →  build  →  push to Artifact Registry  →  deploy revision  →  probe /api/health  →  ✅
```

The pipeline tags each image with the commit SHA and deploys it by that immutable tag — never `:latest`. So a rollback is a traffic shift, not a rebuild:

```bash
gcloud run revisions list --service my-app --region asia-south1
gcloud run services update-traffic my-app --region asia-south1 \
  --to-revisions my-app-<good-sha>=100
```

This takes seconds. Then you can fix forward without time pressure.

**Tunable via repository variables** — no workflow edits needed:

| Variable                     | Default                    |                                                        |
| ---------------------------- | -------------------------- | ------------------------------------------------------ |
| `GCP_REGION`                 | `asia-south1`              | Cloud Run, Artifact Registry, Firestore and the bucket |
| `CLOUD_RUN_SERVICE`          | repository name            | Service name                                           |
| `APP_SLUG`                   | service name               | Names the database, bucket and runtime identity        |
| `RUNTIME_SERVICE_ACCOUNT`    | `<slug>-runtime@<project>` | Identity the revision runs as — **set this**           |
| `APP_URL`                    | —                          | Public URL, inlined at build time                      |
| `MIN_INSTANCES`              | `0`                        | `1` removes cold starts (~$10–15/month)                |
| `MAX_INSTANCES`              | `10`                       | Bounds both a traffic spike and your bill              |
| `LOG_LEVEL`                  | `info`                     | Runtime log verbosity                                  |
| `FIRESTORE_DATABASE_ID`      | `<slug>-db`                | Override only for an existing database                 |
| `GCS_BUCKET`                 | `<project>-<slug>-media`   | Override only for an existing bucket                   |
| `HEALTH_DEEP_CHECKS_ENABLED` | `false`                    | Enables `/api/health?deep=1`. Dashboards only          |

Full runbook — first deploy, custom domains, gradual rollout, making the service private, cleanup: [`cloud/deployment.md`](./cloud/deployment.md).

---

## GitHub Actions

| Workflow                                                     | Runs on        | Does                                                                                                                                         |
| ------------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [`pr-validation.yml`](./.github/workflows/pr-validation.yml) | Every PR       | Format check, lint, build, typecheck, test — **plus** a Firestore emulator job, and a real Docker image booted to verify the health endpoint |
| [`deploy.yml`](./.github/workflows/deploy.yml)               | Push to `main` | Firestore indexes and rules → build → push → deploy → probe the live URL. Fails if the deployed revision does not actually serve.            |
| [`codeql.yml`](./.github/workflows/codeql.yml)               | PRs and weekly | Static security analysis into the Security tab                                                                                               |

PR validation deliberately needs **no cloud credentials**, so pull requests from forks work. The emulator job installs the gcloud SDK to get the local Firestore emulator, but never authenticates — the emulator is a Java process that does not talk to Google.

Indexes deploy **before** the application, on purpose: a revision that queries an index which does not exist yet fails at request time, while an index nothing queries yet costs nothing.

The container smoke test in PR validation is the step most templates omit. It catches the failures a build cannot: wrong port, wrong bind address, missing static assets, non-root permission errors.

---

## Secrets and configuration

### GitHub secrets

| Secret                | Value                                                                              |
| --------------------- | ---------------------------------------------------------------------------------- |
| `WIF_PROVIDER`        | `projects/<number>/locations/global/workloadIdentityPools/github/providers/github` |
| `WIF_SERVICE_ACCOUNT` | `github-deployer@<project>.iam.gserviceaccount.com`                                |

Neither is a credential — both are resource identifiers, useless without a valid OIDC token from this repository.

**There is no `GCP_SA_KEY`, and there must never be one.** A downloaded service account key never expires, works from anywhere, and nothing revokes it when someone leaves. See [ADR-0002](./docs/adr/0002-use-workload-identity-federation.md).

### GitHub variables

`GCP_PROJECT_ID` (required), plus `GCP_REGION`, `ARTIFACT_REPOSITORY`, `CLOUD_RUN_SERVICE`, `APP_URL`, `APP_NAME`, `LOG_LEVEL`, `MIN_INSTANCES`, `MAX_INSTANCES`.

### Application secrets

Secret Manager, mounted into Cloud Run as environment variables:

```bash
printf '%s' "$VALUE" | gcloud secrets versions add DATABASE_URL --data-file=-
```

Never in a build arg (visible in `docker history`), never in a `NEXT_PUBLIC_*` variable (shipped to every browser), never in the repository.

Full model: [`cloud/environment-variables.md`](./cloud/environment-variables.md).

---

## For AI coding assistants

[`.github/instructions/`](./.github/instructions/) is a rulebook written for Claude Code, Copilot, Cursor and anything else that writes code here — and it works just as well for new human contributors.

| Document                                                              | Covers                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------- |
| [`coding-rules.md`](./.github/instructions/coding-rules.md)           | The twelve non-negotiables. Start here.                     |
| [`project-structure.md`](./.github/instructions/project-structure.md) | Where every kind of file goes                               |
| [`coding-standards.md`](./.github/instructions/coding-standards.md)   | TypeScript, React and CSS conventions                       |
| [`design-language.md`](./.github/instructions/design-language.md)     | Mochi: tokens, primitives, patterns, words, anti-slop       |
| [`architecture.md`](./.github/instructions/architecture.md)           | Layers, data flow, decisions and their trade-offs           |
| [`deployment.md`](./.github/instructions/deployment.md)               | The Cloud Run contract; how to change the Dockerfile safely |
| [`github-workflows.md`](./.github/instructions/github-workflows.md)   | Workflow rules; OIDC; least-privilege permissions           |

The short version: _Server Components by default. No `any`. Never invent a new top-level folder. No unnecessary dependencies. Design mobile-first. Update the docs in the same PR._

Why this matters at template scale: when a dozen projects share one rulebook, generated code stays consistent instead of drifting apart.

---

## Documentation map

```
README.md                      you are here
├── docs/
│   ├── local-development.md    setup, scripts, editor, daily loop
│   ├── testing.md              Vitest, RTL, the Server Component constraint
│   ├── troubleshooting.md      symptoms → causes → fixes
│   └── adr/                    architecture decision records
├── cloud/
│   ├── README.md               services, APIs, cost model
│   ├── architecture.md         diagrams, scaling, security boundaries
│   ├── deployment.md           the operator runbook
│   ├── artifact-registry.md    tagging, retention, scanning
│   ├── github-actions.md       WIF in depth + auth troubleshooting
│   ├── environment-variables.md build-time vs runtime, Secret Manager
│   └── terraform.md            planned IaC layout
└── .github/instructions/       rules for AI assistants and contributors
```

---

## FAQ

<details>
<summary><b>Why Cloud Run instead of Vercel?</b></summary>

Vercel has better DX for Next.js. Cloud Run wins when the rest of your stack is already on Google Cloud: one IAM model, one billing account, one audit trail, one console during an incident. You also keep full control of the container and the pipeline — which matters most when something is broken.

Full reasoning and the rejected alternatives: [ADR-0001](./docs/adr/0001-use-cloud-run-for-hosting.md).

</details>

<details>
<summary><b>Why no service account key? Every tutorial uses one.</b></summary>

Because a downloaded key is a permanent bearer credential. It never expires. It works from anywhere on the internet. It ends up in more places than anyone tracks, and nothing revokes it when a person leaves the team. A leak is silent.

Workload Identity Federation replaces it with a token that lives for minutes and is cryptographically bound to this repository. The extra setup is about ten minutes, once, and `scripts/gcp-bootstrap.sh` does it for you.

[ADR-0002](./docs/adr/0002-use-workload-identity-federation.md).

</details>

<details>
<summary><b>My deploy failed with "Unable to acquire impersonated credentials".</b></summary>

The usual cause: the job is missing `permissions: id-token: write`. Without it, GitHub never mints an OIDC token, and the exchange has nothing to present.

The other causes are a wrong `WIF_PROVIDER` path, a mismatched attribute condition, or a missing `principalSet://` binding. [`cloud/github-actions.md`](./cloud/github-actions.md#troubleshooting) diagnoses each one step by step. It also shows how to dump the JWT claims GitHub sent.

</details>

<details>
<summary><b>"The user-provided container failed to start and listen on the port defined by the PORT environment variable"</b></summary>

Cloud Run's least helpful error message. Three causes, in order of likelihood:

1. Not binding `0.0.0.0` (localhost inside a container is unreachable from outside). The Dockerfile sets `ENV HOSTNAME=0.0.0.0` for this reason.
2. A hardcoded port instead of `process.env.PORT`.
3. Startup exceeded the deadline — usually env validation failing, or a hanging top-level `await`.

`docker compose up --build` reproduces all three locally.

</details>

<details>
<summary><b>I changed a NEXT_PUBLIC_ variable in Cloud Run and nothing happened.</b></summary>

`NEXT_PUBLIC_*` values are inlined into the JavaScript bundle at **build time**. The value is already inside the file users downloaded. Rebuild the image — updating the service does nothing.

This also means `NEXT_PUBLIC_*` is public. Never put a credential behind that prefix.

</details>

<details>
<summary><b>Why does CI build before it type-checks? That looks backwards.</b></summary>

`next build` generates `next-env.d.ts` and `.next/types/**`, which `tsc --noEmit` needs to resolve JSX and typed routes. Both are gitignored, so on a clean checkout they do not exist. Reverse the order and typecheck fails in CI with errors that reproduce nowhere locally.

</details>

<details>
<summary><b>Can I use npm or yarn instead of pnpm?</b></summary>

Yes, but you would change `package.json` scripts, the `deps` stage of the Dockerfile, `pnpm-workspace.yaml`, and both workflows. pnpm is here for two reasons: its content-addressed store (fast CI installs) and its strictness about phantom dependencies. A package you did not declare will not resolve. This catches a real class of bug at install time, not in production.

</details>

<details>
<summary><b>Where is the database / auth / state management?</b></summary>

Deliberately absent. Those choices are project-specific. A template that picks them for you is one you fight. The `services/` layer is where they go. [`.github/instructions/architecture.md`](./.github/instructions/architecture.md#what-is-not-here-and-when-to-add-it) lists what to add, when, and the recommended approach for each.

</details>

<details>
<summary><b>How much does this cost to run?</b></summary>

With `--min-instances=0`, an idle service costs nothing. Cloud Run's free tier covers 2M requests and 360k vCPU-seconds per month. That is more than most side projects and many internal tools ever use. Artifact Registry storage is cents per GB.

The one thing that costs real money is `--min-instances=1` (~$10–15/month) to eliminate cold starts. Set a budget alert either way — `scripts/gcp-bootstrap.sh` prints the command.

</details>

<details>
<summary><b>Is this actually production-ready, or is that just the README talking?</b></summary>

Concretely:

- The container runs non-root, with a read-only filesystem and correct signal handling.
- The pipeline stores no credentials.
- The pipeline verifies every deploy against the live health endpoint before it reports success.
- A rollback is a traffic shift.
- CodeQL and Dependabot run continuously.
- Environment configuration fails loudly at startup, not silently at runtime.

What it does not have — because these are project-specific — is a database, authentication, rate limiting, tracing, or end-to-end tests. Each is listed with a recommended approach in [`.github/instructions/architecture.md`](./.github/instructions/architecture.md#what-is-not-here-and-when-to-add-it).

</details>

---

## Roadmap

Ordered roughly by how often the need comes up.

- [ ] **Terraform modules** — Artifact Registry, Cloud Run, WIF, service accounts. Layout already planned in [`cloud/terraform.md`](./cloud/terraform.md); waiting on a project with more than one environment.
- [ ] **Playwright end-to-end tests**, running against `docker compose` so they exercise the production image.
- [ ] **Staging environment** — a second GCP project with GitHub Environments and required reviewers.
- [ ] **OpenTelemetry → Cloud Trace**, once there is more than one service to correlate.
- [ ] **Preview deployments per PR** — one Cloud Run revision per pull request, torn down on merge.
- [ ] **Cloud Load Balancer + Cloud CDN** recipe for global audiences.
- [ ] **Binary Authorization** — block unsigned or unscanned images from deploying.
- [ ] **Cloud Build alternative pipeline**, for teams that prefer to keep CI inside GCP.

Suggestions welcome — open an issue.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). In short: branch, make the change, `pnpm validate`, open a PR, and update the docs in the same PR if you changed how something works.

## Security

Found a vulnerability? See [SECURITY.md](./SECURITY.md). Please do not open a public issue.

## License

[MIT](./LICENSE) — use it, change it, ship it.

---

<div align="center">
<sub>Built for teams who want to spend their time on the product, not the pipeline.</sub>
</div>
