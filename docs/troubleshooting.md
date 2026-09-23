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

The bucket does not allow your origin. A signed-URL PUT is a cross-origin request to `storage.googleapis.com`.

```bash
./scripts/gcp-bootstrap.sh ... --cors-origin https://your-domain
gcloud storage buckets describe gs://BUCKET --format='value(cors_config)'   # verify
```

### `UploadRejectedError: no object at tmp/...`

`finalizeUpload` ran but the object is not there. Either the PUT did not actually succeed — check its status, not just that it returned — or finalize already ran and moved it, or more than a day passed and the lifecycle rule swept it.

### `DocumentValidationError` when reading

Stored data no longer matches the collection's zod schema. This is a real bug surfacing, not noise: a field written by an older build, a console edit, or a half-finished migration.

The message names the document and the failing field. Decide deliberately: migrate the data, or widen the schema (a new field should usually be `.optional()` until every document has it).

### `UnboundedQueryError`

`limit` is missing, not a positive integer, over `MAX_PAGE_SIZE` (200), or a cursor no longer resolves to a document. Paginate with `nextCursor` rather than asking for a bigger page. A cursor pointing at a hard-deleted document is gone — restart from the first page.

### Contention errors on a hot document

`ABORTED` or `DEADLINE_EXCEEDED` on writes to one document means you are past Firestore's ~1 sustained write per second per document. Use `services/sharded-counter.ts`, or drop the maintained total and use `repository.count()`. See [CLAUDE.md > Firestore data modeling](../CLAUDE.md#firestore-data-modeling).

### The emulator will not start

```bash
gcloud components install cloud-firestore-emulator   # component missing
java -version                                        # needs 17+
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
