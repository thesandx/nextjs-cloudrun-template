# Troubleshooting

Symptoms grouped by where they appear, with the cause and the fix.

---

## Local development

### `Cannot find module '@/lib/env'`

The `@/*` alias resolves from the repository root. `@/lib/env` means `./lib/env.ts`.

- Check the file exists at that exact path (case-sensitive on Linux, even when macOS is not).
- Restart the TypeScript server: VS Code → Command Palette → _TypeScript: Restart TS Server_.
- After changing `tsconfig.json` paths, restart the dev server too.

### `pnpm typecheck` fails on a fresh clone

```
error TS2307: Cannot find module 'next' or its corresponding type declarations.
```

`next build` (or `next dev`) generates `next-env.d.ts` and `.next/types/**`, both gitignored. Run `pnpm build` once. CI orders build before typecheck for exactly this reason.

### The editor shows errors that `pnpm typecheck` does not

Your editor is using a different TypeScript version. In VS Code: Command Palette → _TypeScript: Select TypeScript Version_ → **Use Workspace Version**.

### `ERR_PNPM_OUTDATED_LOCKFILE`

`package.json` and `pnpm-lock.yaml` disagree — usually a hand-edited dependency, or a merge that resolved one file but not the other.

```bash
pnpm install
git add pnpm-lock.yaml
```

### `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` / `Lockfile failed supply-chain policy check`

```
lightningcss@1.33.0 was published at ..., within the minimumReleaseAge cutoff
```

`minimumReleaseAge: 1440` in `pnpm-workspace.yaml` refuses packages published in the last 24 hours. This is a deliberate defence against compromised versions that maintainers remove within hours of publication.

The gate applies to **every entry in the lockfile**, including transitive dependencies you never chose. So it fires in three situations:

| Situation                                                                       | Fix                                                                                                                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A Dependabot PR proposes a brand-new release                                    | Should not happen — `cooldown` in `.github/dependabot.yml` is set above the pnpm window. If it does, the two configs have drifted apart; realign them. |
| You installed a fresh package locally                                           | pnpm adds it to `minimumReleaseAgeExclude` automatically. Commit that, and prune the entry once the version ages past the window.                      |
| Someone raised `minimumReleaseAge` above the age of the youngest lockfile entry | Lower it, or regenerate the lockfile — then verify the **Docker build**, not just a local install.                                                     |

Beware a false pass locally: pnpm caches the verification result for a while, so a local `pnpm install --frozen-lockfile` may print `verified Nm ago` without re-checking. `docker build --no-cache` is the honest test.

Never "fix" this by deleting `minimumReleaseAge`. It is a supply-chain control, and the failure is usually correct.

### `Ignored build scripts: <package>`

pnpm blocks lifecycle scripts from transitive dependencies as a supply-chain control. If the package really needs to build:

```yaml
# pnpm-workspace.yaml
allowBuilds:
  <package>: true
```

Say why in the PR. Do not disable the check globally.

### Hydration mismatch

```
Text content did not match. Server: "..." Client: "..."
```

Something rendered differently on the server and in the browser. The usual causes:

- `new Date()` or `Date.now()` rendered directly — use a fixed format and UTC (`formatUtc` in `lib/utils.ts`)
- `Math.random()` in render
- Reading `window` or `localStorage` during the first render — move it into `useEffect`, or use `useSyncExternalStore` with a server snapshot
- A browser extension injecting markup — check in an incognito window before debugging further

### Stale behaviour after a config change

```bash
rm -rf .next && pnpm dev
```

Changes to `next.config.ts`, `tsconfig.json` paths and Tailwind config are not always hot-reloaded.

---

## Docker

### Build fails: `frozen-lockfile` mismatch

The lockfile in the build context does not match `package.json`. Run `pnpm install` and commit the lockfile — the Docker build deliberately refuses to resolve different versions than CI tested.

### Build succeeds, container exits immediately

```bash
docker logs <container>
```

Almost always one of:

- `lib/env.ts` threw an `EnvValidationError` — a required variable is unset. The error message names it.
- A top-level `await` in a module failed.
- `server.js` is missing, because `output: 'standalone'` was removed from `next.config.ts`.

### `Error: Cannot find module '/app/server.js'`

`output: 'standalone'` is not enabled, so `.next/standalone` was never produced and the `COPY` copied nothing useful. Restore it in `next.config.ts`.

### Container runs but pages have no styling

`.next/static` was not copied into the runtime stage. The standalone output does **not** include it — that is why the Dockerfile has a separate `COPY --from=builder /app/.next/static ./.next/static` line.

### `EACCES: permission denied`

The app is trying to write to its own filesystem while running as uid 1001 with a read-only root. It should not need to — Cloud Run instances are ephemeral. Write to `/tmp` (mounted as tmpfs) or, properly, to Cloud Storage.

### Image is enormous (1 GB+)

- `output: 'standalone'` missing
- The runtime stage is copying `node_modules` or source (check for a stray `COPY . .`)
- `.dockerignore` is not excluding `node_modules` and `.next`

Inspect layer by layer: `docker history <image>`.

---

## GitHub Actions

### `Unable to acquire impersonated credentials`

The OIDC exchange failed. In order of likelihood:

1. **`permissions: id-token: write` missing** from the job. This is the cause most of the time.
2. `WIF_PROVIDER` is wrong — it must be the full `projects/<NUMBER>/locations/global/workloadIdentityPools/.../providers/...` path, using the project **number**, not the id.
3. The provider's `attribute-condition` does not match your repository string.
4. The `principalSet://` binding is missing on the deployer service account.

Full diagnosis, including how to dump the JWT claims: [`cloud/github-actions.md`](../cloud/github-actions.md#troubleshooting).

### `The given credential is rejected by the attribute condition`

The full error, at the `google-github-actions/auth` step:

```
unauthorized_client: The given credential is rejected by the attribute condition.
```

Google received the OIDC token and refused it. The provider's condition evaluated to false. The secrets are fine — the earlier `Verify required configuration` step already proved they are set.

Read the live condition:

```bash
gcloud iam workload-identity-pools providers describe github \
  --location=global --workload-identity-pool=github \
  --project="$GCP_PROJECT_ID" --format='value(attributeCondition)'
```

Expect `assertion.repository_owner == '<your owner>'`.

**The usual cause: another repository overwrote it.** The pool and the provider are shared by every repository in the project. An older version of `gcp-bootstrap.sh` wrote `assertion.repository == '<one repo>'`, so bootstrapping a second repository revoked the first. The symptom appears on the next deploy of the repository nobody touched.

Fix it by re-running the bootstrap, which now writes an owner-scoped condition and refuses to overwrite another owner's:

```bash
./scripts/gcp-bootstrap.sh --project "$GCP_PROJECT_ID" \
  --repo owner/repository --service <service>
```

If the condition names a different owner, do not force it — that revokes their deploys. Use `--provider github-<repo>` for a separate provider instead. See [ADR-0003](./adr/0003-scope-workload-identity-to-the-github-owner.md).

### `Refusing to overwrite it` when the condition names YOUR repository

```
[warn]   current: assertion.repository == 'you/your-repo'
[warn]   new:     assertion.repository_owner == 'you'
```

A project bootstrapped before ADR-0003 has a provider pinned to one repository. Bootstrap now widens that automatically, without `--force-provider-update`: the new condition accepts every token the old one accepted, so no repository can lose access. Pull the latest script and re-run.

**Do not pass `--force-provider-update` to get past this.** That flag is for a condition naming a different owner, where overwriting really does revoke someone. If bootstrap still refuses, the owner in the current condition does not match the one you passed — read it again before forcing.

One thing the widening does not carry over: an old `--main-only` lived in the provider condition, and now lives in the per-repository binding. Bootstrap warns when it sees a branch clause it is dropping. Re-run with `--main-only` to keep the restriction.

Other causes, if the condition is correct:

- `--main-only` was used and the deploy ran from another branch.
- `WIF_PROVIDER` points at a provider in a different project.

---

### `Permission 'iam.serviceaccounts.actAs' denied`

The deployer cannot assign the runtime service account to the revision:

```bash
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$DEPLOYER_SA" \
  --role="roles/iam.serviceAccountUser"
```

### `denied: Permission "artifactregistry.repositories.uploadArtifacts" denied`

Either the deployer lacks `roles/artifactregistry.writer` on the repository, or `gcloud auth configure-docker <region>-docker.pkg.dev` did not run before the push.

### The workflow passes locally but fails in CI

- **Case sensitivity.** CI runs Linux; `Button.tsx` and `button.tsx` are different files there.
- **Missing lockfile changes.** CI uses `--frozen-lockfile`.
- **`.env.local` exists locally but not in CI.** Anything CI needs must come from a variable or secret.
- **Format check.** `pnpm format` locally; CI only verifies.

### A job hangs until it is killed

Something is waiting for input — an unattended `gcloud` command without `--quiet`, or an interactive prompt. Every job here has `timeout-minutes` so this fails in minutes rather than hours.

---

## Cloud Run

### `The user-provided container failed to start and listen on the port defined by the PORT environment variable`

The single most common Cloud Run failure. In order:

1. **Not binding `0.0.0.0`.** `ENV HOSTNAME=0.0.0.0` must be in the runtime stage. Binding localhost inside a container is unreachable from outside.
2. **Hardcoded port.** The server must read `process.env.PORT`.
3. **Startup exceeded the deadline.** Check the logs for a crash during boot — usually env validation or a hanging top-level `await`.

**Since the data layer landed, the most common cause is env validation.** Look for `EnvValidationError` in the logs. `APP_SLUG`, `GCP_PROJECT_ID`, `FIRESTORE_DATABASE_ID` and `GCS_BUCKET` are all required in production, and the container refuses to start without them — deliberately, so Cloud Run rejects the revision and keeps serving the previous one. The message lists every missing variable at once. The deploy workflow sets all four, so a missing one means a repository variable was cleared or the workflow was edited.

```bash
gcloud run services logs read SERVICE --region REGION --limit 100
```

### Revision deploys but returns 500

```bash
gcloud run services logs read SERVICE --region REGION --limit 100 \
  --format='value(textPayload)'
```

The application logs structured JSON, so filter in Cloud Logging:

```
resource.type="cloud_run_revision"
resource.labels.service_name="SERVICE"
severity>=ERROR
```

In production Next.js redacts error messages and keeps only `error.digest`. Search Cloud Logging for that digest to find the real stack trace.

### The deploy fails at the health probe, but the homepage works

Symptom: the deploy workflow fails at "Verify the deployment serves traffic" with `Deployed revision never became healthy`, and `/api/health` returns 500, yet the homepage loads and the revision shows `Ready: True`.

A `Ready` revision means the container booted. A 500 from `/api/health` alone means the route handler failed, not the container. The health route imports `@/lib/env`, and `lib/env.ts` throws at module load when a required variable is missing. The homepage is statically prerendered, so it never triggers the check; `/api/health` is `force-dynamic`, so it does.

Read the runtime logs to see which variable:

```bash
gcloud run services logs read SERVICE --region REGION --limit 50
# → EnvValidationError: <NAME> is required but was not set
```

Do not make a value that is only known after the first deploy — such as the Cloud Run URL — a startup requirement. `NEXT_PUBLIC_APP_URL` is a build-time-inlined value, so requiring it would fail the first deploy before the URL can exist. Keep such values optional with a safe fallback in `lib/env.ts`.

### `Image not found` / `Container image not found`

The image reference does not exist. Check the exact URI in the workflow log against:

```bash
gcloud artifacts docker images list <region>-docker.pkg.dev/<project>/<repo>
```

Usually a wrong region or a wrong repository name in the variables.

### Cold starts are slow

- Set `--min-instances=1` to keep one instance warm (costs ~$10–15/month).
- Confirm `--cpu-boost` is set — it is in the template's flags.
- Confirm the Artifact Registry region matches the Cloud Run region; a cross-region pull adds seconds.
- Check for expensive module-level work — it runs on every cold start.

### Requests time out at exactly 300 seconds

That is `--timeout`. Long-running work does not belong in a request; move it to Cloud Tasks or Pub/Sub with a worker service.

### Traffic is being throttled / 429s

Instance count is pinned at `--max-instances`. Raise it — but understand that the ceiling also bounds your bill, so raise it deliberately and set a budget alert.

### Environment variable change had no effect

If it starts with `NEXT_PUBLIC_`, it is **inlined at build time**. Updating the Cloud Run service does nothing; you must rebuild the image. See [`cloud/environment-variables.md`](../cloud/environment-variables.md).

### The site is broken and I need it working now

```bash
gcloud run revisions list --service SERVICE --region REGION --limit 10
gcloud run services update-traffic SERVICE --region REGION \
  --to-revisions SERVICE-<known-good-sha>=100
```

This takes seconds, with no rebuild. Then fix forward with a normal PR.

---

## Firestore and Cloud Storage

### `FAILED_PRECONDITION: The query requires an index`

The error message contains a console link that creates the index in one click. **Do not use it** — an index created by hand exists in one project and nowhere else, so the next environment fails the same way.

Add it to `firestore.indexes.json` instead:

```json
{
  "collectionGroup": "notes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "deletedAt", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

Then `pnpm db:deploy --project P --database D`, or merge to `main` — the deploy publishes indexes before the app for exactly this reason. Leave `__name__` out; Firestore appends it automatically, matching the last field's direction.

Indexes build in the background. A large collection takes minutes, and the query keeps failing until the build finishes.

### Firestore or Cloud Storage returns `PERMISSION_DENIED` on a green deploy

The deploy succeeded, `/api/health` is fine, and every data call fails. Two causes, in order of likelihood.

**1. The revision runs as the wrong identity.** Check which one:

```bash
gcloud run services describe SERVICE --region REGION \
  --format='value(spec.template.spec.serviceAccountName)'
```

An address ending `-compute@developer.gserviceaccount.com` is the **default compute service account**, not the one bootstrap created. Repoint the service:

```bash
gcloud run services update SERVICE --region REGION \
  --service-account=SERVICE-runtime@PROJECT.iam.gserviceaccount.com
```

That deploys a new revision. See trap 19 in CLAUDE.md for how a deploy can pick the wrong identity while staying green.

**2. Bootstrap did not finish.** It grants the runtime account `roles/datastore.user` and `roles/storage.objectUser` at steps 10 and 11 of 14, so a run that stopped earlier leaves the identity correct but powerless. Re-run it — it is idempotent.

```bash
gcloud projects get-iam-policy PROJECT --format=json \
  | jq '.bindings[] | select(.role=="roles/datastore.user")'
gcloud storage buckets get-iam-policy gs://BUCKET \
  --format=json | jq '.bindings[] | select(.role=="roles/storage.objectUser")'
```

> **A green deploy does not prove the data layer works.** The pipeline's success probe hits `/api/health`, which is deliberately dependency-free so a Firestore blip cannot kill healthy containers. The same property means it passes while every query fails. Verify data operations separately.

### `Permission 'iam.serviceAccounts.signBlob' denied`

Signing a V4 URL with no key file works by asking IAM to sign, which needs the runtime service account to be able to impersonate **itself**:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  my-app-runtime@my-project.iam.gserviceaccount.com \
  --member="serviceAccount:my-app-runtime@my-project.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

`gcp-bootstrap.sh` creates this binding. The error usually means the script was not re-run after the runtime account was recreated.

### `5 NOT_FOUND` on the first query

`FIRESTORE_DATABASE_ID` names a database that does not exist. Check which do:

```bash
gcloud firestore databases list --format='table(name,locationId,type)'
```

Common causes: the app is pointed at `(default)` when bootstrap created a named database; the slug changed without re-running bootstrap; the wrong project.

### `403` from the signed-URL PUT

The client did not send the headers exactly as returned. They are part of the signature, and Cloud Storage recomputes it from the request.

```ts
await fetch(upload.url, { method: 'PUT', headers: upload.headers, body: file });
```

Both matter: `Content-Type` must equal what was signed, and `x-goog-content-length-range` must be present and unmodified.

### The PUT fails with a CORS error in the browser

The bucket does not allow your origin. A signed-URL PUT is a cross-origin request to `storage.googleapis.com`, and the bucket lists who may make it. The browser console names the origin it refused:

> Access to fetch at `https://storage.googleapis.com/...` from origin
> `https://my-app-123.asia-south1.run.app` has been blocked by CORS policy

**List every origin the app is served from, and include the Cloud Run URL.** `https://<service>-<number>.<region>.run.app` is an origin like any other. It is the one people forget: the custom domain is added, the platform URL is not, so the live site uploads and a test on the `run.app` address fails.

```bash
./scripts/gcp-bootstrap.sh ... \
  --cors-origin https://your-domain \
  --cors-origin https://your-service-123.asia-south1.run.app
gcloud storage buckets describe gs://BUCKET --format='value(cors_config)'   # verify
```

The script is idempotent, so re-run it with the flags added. The signed URL in the error message is good news: the server made it, so the signing binding and the bucket name are correct. Only the browser's preflight was refused.

### `UploadRejectedError: no object at tmp/...`

`finalizeUpload` ran but the object is not there. Either the PUT did not actually succeed — check its status, not just that it returned — or finalize already ran and moved it, or more than a day passed and the lifecycle rule swept it.

### Sign-in reports an error, but refreshing shows the user signed in

The session cookie is set before the profile is created, so a failure in the
profile step used to fail the whole request — after the cookie had already
landed. The browser really was signed in; the response said otherwise.

Profile creation is now non-fatal at sign-in: it is logged, and
`requireUserProfile` creates the profile on demand at the first write.

On an older build, the message names the real cause. Read the server log for
`Creating a session failed`.

### Sign-in works, then the user is signed out on the next page

The session cookie is not named `__session`, and Firebase Hosting stripped it.

Hosting and the CDN in front of it drop every cookie except that one. The app therefore works perfectly on the direct `*.run.app` URL and fails behind a custom domain. The name is a constant in `lib/session-cookie.ts`; do not change it.

### `Adding a binding without specifying a condition to a policy containing conditions`

`gcp-bootstrap.sh` stopped on a `gcloud projects add-iam-policy-binding` call. The message ends with `Run the command again with --condition=None`.

The project's IAM policy already holds a conditional binding — this template always creates one, because `roles/datastore.user` is pinned to the named database. gcloud will not guess which binding you meant, so it refuses.

It appears only on a project bootstrapped before, which is why a first run looks fine.

Grant the one binding by hand, then re-run bootstrap to finish:

```bash
gcloud projects add-iam-policy-binding PROJECT \
  --member="serviceAccount:APP_SLUG-runtime@PROJECT.iam.gserviceaccount.com" \
  --role="roles/firebaseauth.admin" \
  --condition=None
```

Re-running bootstrap without updating the script hits the same error again: the check is on the policy, not on whether the binding already exists. Pull the fix first.

### New sign-ins fail, but existing sessions keep working

The runtime service account is missing `roles/firebaseauth.admin`.

Verifying a session checks a signature against Google's public keys and needs no IAM at all. Minting one calls the Identity Toolkit API and does. That asymmetry is why only new sign-ins break, and why it looks like a client bug.

```bash
gcloud projects add-iam-policy-binding PROJECT \
  --member="serviceAccount:APP_SLUG-runtime@PROJECT.iam.gserviceaccount.com" \
  --role="roles/firebaseauth.admin"
```

Or re-run `gcp-bootstrap.sh`, which is idempotent.

### The sign-in panel says sign-in is not configured

The Firebase web config was missing when the image was **built**.

`NEXT_PUBLIC_*` values are inlined into the bundle at build time, so setting them on the Cloud Run service changes nothing. Set the repository variables and rebuild:

```bash
gh variable set FIREBASE_API_KEY     --body "AIza..."
gh variable set FIREBASE_AUTH_DOMAIN --body "PROJECT.firebaseapp.com"
gh variable set FIREBASE_PROJECT_ID  --body "PROJECT"
gh variable set FIREBASE_APP_ID      --body "1:...:web:..."
gh workflow run deploy.yml
```

This is the intended fail-closed state, not a fault: the app serves public reads and answers 401 to every write.

### `auth/unauthorized-domain`

The origin is not listed under Authentication > Settings > Authorized domains.

Add every origin the app is served from, **including the `*.run.app` URL**. It is the one people forget, exactly as with bucket CORS.

### `auth/operation-not-allowed`

That sign-in provider is not enabled. Firebase console > Authentication > Sign-in method, then enable Google or Phone.

### `auth/invalid-app-credential` on phone sign-in

reCAPTCHA could not run. Either the domain is not authorised (above), or the verifier was reused after a failed attempt. `useFirebaseAuth` clears and recreates it on failure for that reason.

### An unexpected SMS bill

The SMS region policy is still the default, which allows every country on earth.

Restrict it now — Firebase console > Authentication > Settings > SMS region policy — to the countries you serve. SMS pumping fraud sends codes to premium-rate numbers the attacker earns revenue from, and it is automated. Set a budget alert too; it is how you find out in hours rather than at month end.

### A write returns 401 for a user who is clearly signed in

The cookie did not reach the server. Usually the `Secure` attribute against a plain-HTTP origin: a browser refuses to store a `Secure` cookie on `http://`, and refuses to send a non-`Secure` one that was set as `Secure`.

The carve-out is derived from `NEXT_PUBLIC_APP_URL`, so check that it matches the scheme actually in use.

### `InvalidDocumentIdError` from `createWithId`

The id would create a write hotspot, or Firestore would reject it outright. The message says which.

Sequential ids, date prefixes and bare numbers are refused at any length — they pin every write to one end of the key range. A short-but-random id is refused by the length floor only, and `{ minLength }` lowers that deliberately for a collection far below one write per second.

### `expected date, received object` on a field your code writes as a Date

Firestore returns a `Timestamp`, never a `Date`. `services/repository.ts`
converts the whole payload before validation, so `z.date()` works — if you are
on a build that carries `timestampsToDates`.

Seeing it anyway means an older image. The data is fine; redeploy.

The symptom is easy to misread, because it points at the read and not at the
write. Nothing wrote a bad value.

### `DocumentValidationError` when reading

Stored data no longer matches the collection's zod schema. This is a real bug surfacing, not noise: a field written by an older build, a console edit, or a half-finished migration.

The message names the document and the failing field. Decide deliberately: migrate the data, or widen the schema (a new field should usually be `.optional()` until every document has it).

**The common cause is a required field added to a collection that already had rows.** The symptom is a whole page failing rather than one row, because `list` parses every document in the page and throws on the first failure. A page that rendered yesterday shows an error boundary today, and nothing in the deploy looks wrong.

Fix it in one of two ways:

- **The data matters** — follow [CLAUDE.md > Add a field to an existing collection](../CLAUDE.md#add-a-field-to-an-existing-collection): optional, backfill, tighten. Note that the backfill is only possible while the field is optional, because a required field makes the `list` it depends on throw.
- **The data does not matter** — a demo row, a dev database — delete it and keep the required field:

```bash
gcloud firestore bulk-delete --collection-ids=COLLECTION \
  --database=DATABASE --project=PROJECT
```

### `UnboundedQueryError`

`limit` is missing, not a positive integer, over `MAX_PAGE_SIZE` (200), or a cursor no longer resolves to a document. Paginate with `nextCursor` rather than asking for a bigger page. A cursor pointing at a hard-deleted document is gone — restart from the first page.

### Contention errors on a hot document

`ABORTED` or `DEADLINE_EXCEEDED` on writes to one document means you are past Firestore's ~1 sustained write per second per document. Use `services/sharded-counter.ts`, or drop the maintained total and use `repository.count()`. See [CLAUDE.md > Firestore data modeling](../CLAUDE.md#firestore-data-modeling).

### The emulator will not start

```bash
gcloud components install cloud-firestore-emulator   # component missing
java -version                                        # needs 21+, not just any JDK
lsof -i :8085                                        # port already bound
FIRESTORE_EMULATOR_PORT=8086 pnpm test:emulator      # or use another port
```

A previous run that was killed rather than stopped can leave the Java process holding the port. `scripts/run-emulator-tests.sh` signals the whole process group to avoid this.

### Emulator tests are skipped rather than run

That is by design when `FIRESTORE_EMULATOR_HOST` is unset — it keeps `pnpm validate` green with no gcloud installed. Run them with `pnpm test:emulator`, which sets the variable for you.

### The app talks to the emulator in a deployed environment

`FIRESTORE_EMULATOR_HOST` is set in Cloud Run. Remove it:

```bash
gcloud run services update SERVICE --region REGION --remove-env-vars FIRESTORE_EMULATOR_HOST
```

### Rules did not deploy: `HTTP 403` from `firebaserules.googleapis.com`

The project is not enrolled in Firebase, or the API is not enabled. The deploy **continues** rather than failing, because rules are defence in depth here — the app uses admin credentials, which bypass them.

To fix it properly: enable `firebaserules.googleapis.com`, add the project to Firebase, and confirm the deployer holds `roles/firebaserules.admin`.

---

## Still stuck

1. What does `/api/health` say? The `version` field is the commit SHA serving traffic — confirm it is the code you expect. With `HEALTH_DEEP_CHECKS_ENABLED=true`, `/api/health?deep=1` also reports Firestore and bucket reachability with latencies.
2. What do the logs say? `gcloud run services logs read SERVICE --region REGION --limit 100`
3. Does it reproduce in the local container? `docker compose up --build` — if yes, it is not a Cloud Run problem.
4. Did it work before? `git log` the Dockerfile, the workflow and `next.config.ts`.
