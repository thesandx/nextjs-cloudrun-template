# Deployment runbook

The operator-facing guide: set up once, then deploy by merging to `main`.

---

## Prerequisites

- A Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated (`gcloud auth login`)
- `roles/owner` or equivalent on the project for the one-time setup
- Admin access to the GitHub repository (to set secrets and variables)

---

## One-time setup

### The fast path

```bash
./scripts/gcp-bootstrap.sh \
  --project my-gcp-project \
  --region asia-south1 \
  --repo thesandx/my-app \
  --service my-app \
  --cors-origin https://app.example.com
```

The script enables APIs, creates the Artifact Registry repository, sets up Workload Identity Federation, creates the deployer and runtime service accounts with least-privilege roles, provisions the Firestore database and the Cloud Storage buckets, and prints the exact GitHub secrets and variables to configure. Re-running it is safe — every step is idempotent.

`--cors-origin` is optional and can wait. It takes the origin your **app** is served from, which enables direct browser uploads. Run `./scripts/gcp-bootstrap.sh --help` for the format.

> **Run this before the first merge to `main`.** The deploy publishes Firestore indexes _before_ it builds the image, so a missing database fails the whole pipeline — no image, no revision.

Then set what it printed:

```bash
gh secret set WIF_PROVIDER        --body "projects/123456789/locations/global/workloadIdentityPools/github/providers/github"
gh secret set WIF_SERVICE_ACCOUNT --body "github-deployer@my-gcp-project.iam.gserviceaccount.com"

gh variable set GCP_PROJECT_ID          --body "my-gcp-project"
gh variable set GCP_REGION              --body "asia-south1"
gh variable set ARTIFACT_REPOSITORY     --body "containers"
gh variable set CLOUD_RUN_SERVICE       --body "my-app"
gh variable set APP_SLUG                --body "my-app"
gh variable set RUNTIME_SERVICE_ACCOUNT --body "my-app-runtime@my-gcp-project.iam.gserviceaccount.com"
```

`FIRESTORE_DATABASE_ID` and `GCS_BUCKET` need no entry. The workflow derives both from `APP_SLUG` and `GCP_PROJECT_ID`. Set them only to point at resources that already carry another name.

Skip to [First deploy, end to end](#first-deploy-end-to-end).

### The manual path

Useful when you need to understand or audit what the script does, or when org policy requires each step to be reviewed.

```bash
export PROJECT_ID="my-gcp-project"
export REGION="asia-south1"
export REPO="thesandx/my-app"          # GitHub owner/name
export SERVICE="my-app"
export AR_REPO="containers"

gcloud config set project "$PROJECT_ID"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
```

**1. Enable APIs**

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudresourcemanager.googleapis.com \
  secretmanager.googleapis.com
```

**2. Create the Artifact Registry repository**

```bash
gcloud artifacts repositories create "$AR_REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Container images for $SERVICE"
```

**3. Create the deployer service account** — the identity GitHub Actions impersonates.

```bash
gcloud iam service-accounts create github-deployer \
  --display-name="GitHub Actions deployer"

export DEPLOYER="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"

# Push images
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" \
  --location="$REGION" \
  --member="serviceAccount:${DEPLOYER}" \
  --role="roles/artifactregistry.writer"

# Manage Cloud Run services
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER}" \
  --role="roles/run.admin"
```

**4. Create the runtime service account** — the identity the _application_ runs as. Separate from the deployer on purpose: the pipeline should not inherit the app's data access, and the app should not be able to deploy itself.

```bash
gcloud iam service-accounts create "${SERVICE}-runtime" \
  --display-name="Runtime identity for $SERVICE"

export RUNTIME="${SERVICE}-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

# The deployer must be allowed to assign this identity to a revision.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME" \
  --member="serviceAccount:${DEPLOYER}" \
  --role="roles/iam.serviceAccountUser"
```

Grant the runtime account only what the application needs (Secret Manager accessor, Cloud SQL client, ...). It starts with nothing.

**5. Create the Workload Identity Pool and provider**

```bash
gcloud iam workload-identity-pools create github \
  --location=global \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github \
  --location=global \
  --workload-identity-pool=github \
  --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == '${REPO}'"
```

> **The `--attribute-condition` is the security control.** Without it, _any_ GitHub repository in the world can exchange a token for access to your project. It is not optional, and Google refuses to create the provider without one.

**6. Let the pool impersonate the deployer**

```bash
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/${REPO}"
```

**7. Collect the provider resource name**

```bash
gcloud iam workload-identity-pools providers describe github \
  --location=global \
  --workload-identity-pool=github \
  --format='value(name)'
```

Set that as the `WIF_PROVIDER` secret, and `$DEPLOYER` as `WIF_SERVICE_ACCOUNT`.

---

## GitHub configuration

**Secrets** — Settings → Secrets and variables → Actions → Secrets

| Secret                | Value                                                                              |
| --------------------- | ---------------------------------------------------------------------------------- |
| `WIF_PROVIDER`        | `projects/<number>/locations/global/workloadIdentityPools/github/providers/github` |
| `WIF_SERVICE_ACCOUNT` | `github-deployer@<project>.iam.gserviceaccount.com`                                |

Neither is a credential — both are resource identifiers, useless without a valid OIDC token from this repository. They are stored as secrets to avoid publishing your project structure, not because disclosure would be catastrophic.

**Variables** — same page, Variables tab

| Variable                     | Required | Default                    | Purpose                                         |
| ---------------------------- | -------- | -------------------------- | ----------------------------------------------- |
| `GCP_PROJECT_ID`             | **yes**  | —                          | Target project                                  |
| `GCP_REGION`                 | no       | `asia-south1`              | Cloud Run + Artifact Registry region            |
| `ARTIFACT_REPOSITORY`        | no       | `containers`               | Artifact Registry repository name               |
| `CLOUD_RUN_SERVICE`          | no       | repository name            | Cloud Run service name                          |
| `APP_SLUG`                   | no       | service name               | Names the database, bucket and runtime identity |
| `RUNTIME_SERVICE_ACCOUNT`    | no       | `<slug>-runtime@<project>` | Identity the revision runs as                   |
| `FIRESTORE_DATABASE_ID`      | no       | `<slug>-db`                | Override only for an existing database          |
| `GCS_BUCKET`                 | no       | `<project>-<slug>-media`   | Override only for an existing bucket            |
| `HEALTH_DEEP_CHECKS_ENABLED` | no       | `false`                    | Enables `/api/health?deep=1`. Dashboards only   |
| `APP_URL`                    | no       | —                          | Public URL, inlined at build time               |
| `APP_NAME`                   | no       | `Next.js on Cloud Run`     | Display name                                    |
| `LOG_LEVEL`                  | no       | `info`                     | Runtime log verbosity                           |
| `MIN_INSTANCES`              | no       | `0`                        | `1` removes cold starts, at a cost              |
| `MAX_INSTANCES`              | no       | `10`                       | Scaling and bill ceiling                        |

> **Set `RUNTIME_SERVICE_ACCOUNT`.** Without it Cloud Run runs the revision as the default compute service account, which holds Editor on the whole project — the opposite of the least-privilege identity bootstrap created.

**Environment** — Settings → Environments → New environment → `production`

Optional but recommended: add required reviewers so a deploy pauses for human approval, and restrict the environment to the `main` branch.

---

## Deploying

Merge to `main`. That is the whole procedure.

```
merge PR ──▶ deploy.yml ──▶ build ──▶ push ──▶ deploy ──▶ health check ──▶ ✅
```

Manual redeploy of current `main`:

```bash
gh workflow run deploy.yml -f reason="Redeploy after config change"
gh run watch
```

---

## First deploy, end to end

From an empty project to your own domain serving traffic. Eight steps.

The example below uses `my-gcp-project`, the app slug `my-app`, and the domain `app.example.com`. Substitute your own throughout.

### 1. Provision Google Cloud

```bash
./scripts/gcp-bootstrap.sh \
  --project my-gcp-project --region asia-south1 \
  --repo thesandx/my-app --service my-app
```

Read the confirmation screen before you accept it. **The Firestore location and the bucket location are permanent.** Neither can be moved later.

### 2. Set the secrets and variables

Copy the commands the script printed. See [GitHub configuration](#github-configuration) for what each one does.

```bash
gh variable list      # confirm they landed
```

### 3. Deploy

Merge to `main`, or trigger it by hand:

```bash
gh workflow run deploy.yml -f reason="First deploy"
gh run watch
```

The pipeline publishes Firestore indexes and rules, builds the image, deploys a revision, and probes `/api/health` before it reports success.

### 4. Read the generated URL

Cloud Run generates the URL, so it cannot exist before the first deploy.

```bash
URL=$(gcloud run services describe my-app --region asia-south1 --format='value(status.url)')
echo "$URL"
# https://my-app-abc123-el.a.run.app
```

### 5. Verify on that URL, before any DNS change

```bash
curl -s "$URL/api/health" | jq
```

Check `status` is `ok` and `version` matches the commit you merged. A mismatch means the deploy did not land.

Open `$URL/example` too. It creates a document, lists a page and uploads an image, so it exercises Firestore and Cloud Storage end to end. Delete that route once you trust the setup.

**Nothing public has changed yet.** Everything so far is reversible.

### 6. Put a domain in front

Pick one of the three options in [Custom domain](#custom-domain). For most projects that is Firebase Hosting: free, includes a CDN, and works in `asia-south1` where domain mapping does not.

### 7. Point DNS at it

Your registrar — Hostinger, Namecheap, Cloudflare, wherever the domain lives — keeps the records. The option you picked in step 6 prints exactly what to add.

Registration stays where it is. You change records, not ownership.

```bash
dig +short app.example.com          # confirm the records resolve
curl -sI https://app.example.com    # confirm the certificate is live
```

A managed certificate can take minutes or hours. The domain answers only once it is issued.

### 8. Inline the real URL, then redeploy

```bash
gh variable set APP_URL --body "https://app.example.com"
gh workflow run deploy.yml -f reason="Inline the production URL"
```

`NEXT_PUBLIC_APP_URL` is inlined at **build** time. Until you rebuild, canonical URLs, Open Graph tags and metadata still carry the old value. A Cloud Run environment variable change does nothing here.

### Afterwards

- Add `--cors-origin https://app.example.com` and re-run bootstrap, if the app uploads files from the browser.
- Delete the `/example` route and `services/example.service.ts`.
- Work through the [pre-production checklist](../SECURITY.md#hardening-checklist-for-a-real-deployment).

---

## Verifying a deploy

```bash
# What the pipeline already checked
curl -s https://<service-url>/api/health | jq

# Which revision is serving, and from which image
gcloud run services describe "$SERVICE" --region "$REGION" \
  --format='value(status.latestReadyRevisionName, spec.template.spec.containers[0].image)'

# Recent logs
gcloud run services logs read "$SERVICE" --region "$REGION" --limit 50
```

The `version` field in the health payload is the commit SHA. If it does not match what you merged, the deploy did not land.

---

## Rolling back

The previous revision still exists and the previous image is still in Artifact Registry, so rollback is a traffic shift — seconds, not a rebuild.

```bash
# 1. Find a known-good revision
gcloud run revisions list --service "$SERVICE" --region "$REGION" --limit 10

# 2. Send all traffic to it
gcloud run services update-traffic "$SERVICE" --region "$REGION" \
  --to-revisions "${SERVICE}-<good-sha>=100"

# 3. Confirm
curl -s https://<service-url>/api/health | jq .version
```

Then fix forward with a normal PR. You can also revert the commit and let CI redeploy, but that is slower while the site is broken.

### Gradual rollout

For a riskier change, split traffic instead of switching it:

```bash
gcloud run services update-traffic "$SERVICE" --region "$REGION" \
  --to-revisions "${SERVICE}-<new>=10,${SERVICE}-<old>=90"
```

Watch error rates in Cloud Monitoring, then move to 100%.

---

## Custom domain

**Check your region first.** Cloud Run domain mappings work in only a handful of regions, and `asia-south1` — this template's default — is **not** one of them. Google has said it has no plan to add it. Run this before you plan around it:

```bash
gcloud run domain-mappings list --region "$REGION"   # errors if unsupported
```

Three options, in the order most projects should consider them.

### 1. Firebase Hosting — free, and covers `asia-south1`

The cheapest path to a custom domain with a managed certificate, and it includes a CDN. Firebase Hosting rewrites to Cloud Run cover most regions, `asia-south1` and `asia-southeast1` among them — but the list is not every region, so check yours against [Serve dynamic content with Cloud Run](https://firebase.google.com/docs/hosting/cloud-run) before planning around it.

```json
{
  "hosting": {
    "public": "public",
    "rewrites": [{ "source": "**", "run": { "serviceId": "my-app", "region": "asia-south1" } }]
  }
}
```

`serviceId` is the Cloud Run service name. `region` must be the region it runs in — a rewrite to the wrong region returns 404, not an error you can read.

```bash
npx firebase-tools login
npx firebase-tools use my-gcp-project
npx firebase-tools deploy --only hosting
```

That publishes to `my-gcp-project.web.app`. Check it works there first:

```bash
curl -s https://my-gcp-project.web.app/api/health | jq
```

Then add your own domain: **Firebase console → Hosting → Add custom domain**. It verifies ownership, then prints the records to add at your registrar — a `TXT` record to prove ownership, then `A` records pointing at Firebase.

Add them wherever the domain's DNS lives (Hostinger, Namecheap, Cloudflare). Certificate issuance takes minutes to hours.

```bash
dig +short app.example.com
curl -sI https://app.example.com
```

Next.js sets `Cache-Control: public, max-age=31536000, immutable` on `/_next/static/**`, so those assets cache at the edge. Dynamic pages and route handlers return `no-store` and reach Cloud Run on every request — a CDN cannot change that, whichever one you use.

Good for a single service. It adds a hop, and it is another product to reason about.

### 2. Global External Application Load Balancer — the production answer

Works in every region, and it is what you would end up with anyway once you want Cloud CDN, Cloud Armor, a WAF, or several backends behind one domain. A serverless NEG points the load balancer at the Cloud Run service.

```bash
gcloud compute network-endpoint-groups create "$SERVICE-neg" \
  --region "$REGION" \
  --network-endpoint-type=serverless \
  --cloud-run-service="$SERVICE"
```

Then a backend service, a URL map, a managed certificate and a global forwarding rule. Full walkthrough: [Serverless network endpoint groups](https://cloud.google.com/load-balancing/docs/negs/serverless-neg-concepts).

It is not free. Budget roughly **US$18–25/month** for the forwarding rule before traffic — confirm against the [pricing calculator](https://cloud.google.com/products/calculator), because this is the one line item that turns a scale-to-zero service into a fixed monthly bill.

A load balancer also **improves** latency independently of your region: TLS terminates at the Google edge nearest the user, and the rest of the trip runs over Google's private backbone rather than the public internet.

### 3. Domain mapping — only where it is supported

```bash
gcloud beta run domain-mappings create \
  --service "$SERVICE" \
  --domain www.example.com \
  --region "$REGION"
```

Add the DNS records it prints. The managed certificate takes up to ~15 minutes to provision.

Simplest and free, but regionally limited, and it gives you no CDN, no WAF and no path-based routing.

---

Whichever you pick, afterwards update the `APP_URL` repository variable and redeploy, so canonical URLs and metadata use the real domain. `NEXT_PUBLIC_APP_URL` is inlined at build time — a Cloud Run env var change alone does nothing.

---

## Making the service private

Remove `--allow-unauthenticated` from the `flags:` in `.github/workflows/deploy.yml`, then grant invoker access explicitly:

```bash
gcloud run services remove-iam-policy-binding "$SERVICE" --region "$REGION" \
  --member="allUsers" --role="roles/run.invoker"

gcloud run services add-iam-policy-binding "$SERVICE" --region "$REGION" \
  --member="serviceAccount:caller@project.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

---

## Monitoring

```bash
# Uptime check against the health endpoint
gcloud monitoring uptime create "$SERVICE-health" \
  --resource-type=uptime-url \
  --resource-labels=host=<service-host>,project_id="$PROJECT_ID" \
  --path=/api/health \
  --period=5
```

Worth alerting on, in priority order: 5xx rate, p95 latency, instance count pinned at `--max-instances` (you are being throttled), and monthly spend against a budget.

---

## Cleanup

```bash
gcloud run services delete "$SERVICE" --region "$REGION"
gcloud artifacts repositories delete "$AR_REPO" --location "$REGION"
gcloud iam workload-identity-pools delete github --location=global
gcloud iam service-accounts delete "$DEPLOYER"
gcloud iam service-accounts delete "$RUNTIME"
```

Google soft-deletes Workload Identity Pools for 30 days, and the name stays reserved. If you recreate one with the same id before then, it fails — undelete it instead:

```bash
gcloud iam workload-identity-pools undelete github --location=global
```
