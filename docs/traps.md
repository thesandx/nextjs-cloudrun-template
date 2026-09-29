# Traps — things that look wrong and are not

Every item here caused a real failure. Do not "fix" any of them without reading the reason.

[`CLAUDE.md`](../CLAUDE.md#traps) holds a one-line index of this page. The numbers are stable: code comments and other documents refer to them as "trap N". Never renumber an item. Add a new trap at the end.

---

### 1. `pnpm typecheck` runs `next typegen` first

`tsc --noEmit` needs `next-env.d.ts` and `.next/types/**` to resolve JSX and typed routes. Both are gitignored, so on a clean checkout they do not exist. `next typegen` generates them in about a second, without a full build.

Do not replace the script with a bare `tsc --noEmit`. It then fails on a fresh clone with errors that reproduce nowhere else.

(Before this change, CI had to run `build` before `typecheck` for the same reason. The order no longer matters.)

### 2. `tsconfig.json` has no `baseUrl`

Deliberately removed. TypeScript 6 raises `TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0`. `paths` entries resolve relative to the `tsconfig.json` that declares them, so `baseUrl` was never needed. **Do not add it back**; it will break the build on the current TypeScript.

### 3. ESLint is pinned to 9, not 10

Not neglect. ESLint 10 fails with:

```
TypeError: Error while loading rule 'react/display-name':
contextOrFilename.getFilename is not a function
```

`eslint-plugin-react`, pulled in transitively by `eslint-config-next`, still uses the ESLint 9 rule-context API. Nothing in this repo can configure around it. Dependabot will keep proposing 10; it stays closed until `eslint-config-next` ships support.

### 4. `next.config.ts` has no `eslint` key

Next.js 16 removed it along with `next lint`. Adding `eslint: { ignoreDuringBuilds: false }` is a **build-breaking type error**. Linting is its own CI step (`pnpm lint`).

### 5. pnpm `minimumReleaseAge` and Dependabot `cooldown` are coupled

`pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` (24h) — a supply-chain control that refuses freshly published packages. `.github/dependabot.yml` sets `cooldown` to 5–14 days, deliberately **longer**, so bot PRs only propose versions that already clear the gate.

**Change one, change the other.** Otherwise every Dependabot PR fails `pnpm install --frozen-lockfile` through no fault of the change.

Two further hazards:

- The gate applies to **every lockfile entry, including transitive ones you never chose**. Raising `minimumReleaseAge` above the age of the youngest package in `pnpm-lock.yaml` breaks CI and the Docker build. (Setting it to 3 days did exactly this.)
- pnpm **caches** the verification verdict, so a local `pnpm install --frozen-lockfile` can print `verified Nm ago` and pass without re-checking. `docker build --no-cache` is the honest test.

### 6. `output: 'standalone'` is load-bearing

In `next.config.ts`. The Dockerfile's runtime stage copies `.next/standalone`. Remove the option and the image builds but the container dies with `Cannot find module '/app/server.js'`. It is also what keeps the image at ~64 MB instead of ~1.2 GB.

`.next/static` is **not** included in the standalone output — that is why the Dockerfile copies it separately. Delete that line and the site renders unstyled.

### 7. The container must bind `0.0.0.0` and honour `$PORT`

`ENV HOSTNAME=0.0.0.0` and `ENV PORT=8080` in the Dockerfile's runtime stage. A container that binds localhost is unreachable from outside. This produces Cloud Run's least helpful error:

> The user-provided container failed to start and listen on the port defined by the PORT environment variable.

`PORT` is a default, not a constant — Cloud Run overrides it. Never hardcode a port.

### 8. `NEXT_PUBLIC_*` is inlined at build time and is public

Changing it on the Cloud Run service does nothing; the value is already inside the JavaScript users downloaded. **Rebuild the image.** And never put a credential behind that prefix — it ships to every browser.

### 9. pnpm blocks dependency install scripts

By design. `allowBuilds` in `pnpm-workspace.yaml` lists the only packages permitted to run lifecycle scripts (`sharp`, `unrs-resolver`). Adding a package that needs one is a deliberate, explained decision — not a config annoyance to switch off.

### 10. Async Server Components cannot be unit-tested

React Testing Library cannot render them. Test the `services/`/`lib/` helpers they call, and the presentational components they render. **Synchronous** Server Components (like `app/page.tsx`) render fine. See [`docs/testing.md`](./testing.md).

### 11. CodeQL needs code scanning enabled

Free on **public** repositories only. On a private repo without GitHub Advanced Security the analysis runs, scans everything, then fails at upload with `Code scanning is not enabled for this repository`. If you generate a private project from this template: buy GHAS or delete `codeql.yml`. Do not leave a permanently red check — a check everyone ignores is worse than no check.

### 12. `lib/env.ts` skips its production check during `next build`

`next build` runs with `NODE_ENV=production` and imports every route to collect page metadata. Without the `NEXT_PHASE === 'phase-production-build'` guard, the Docker builder stage and CI would demand a production database id and bucket name **in order to compile** — and fail with `Failed to collect page data for /_not-found`.

Only `NEXT_PUBLIC_*` values matter at build time. Everything else is read at runtime. Removing the guard breaks the build; removing the `typeof window` guard next to it breaks every page in the browser, because Next.js replaces a non-`NEXT_PUBLIC_` read with `undefined` in the client bundle.

### 13. The Firestore database is NAMED, never `(default)`

`<app-slug>-db`. The runtime service account gets `roles/datastore.user` under an IAM condition pinned to that exact resource name.

This is what makes one GCP project safe for several apps. `roles/datastore.user` without a condition grants access to **every** database in the project — so an unconditioned binding silently gives this app's identity read and write access to every other app's data. The condition is the control, not the naming convention.

### 14. Uploads land in `tmp/` before they count

A signed URL commits to a content type and a size range, and Cloud Storage does enforce both. It still is not enough: the object exists the moment the PUT succeeds, and nothing has looked at it.

So `createSignedUploadUrl` writes under `tmp/`, and `finalizeUpload` re-reads the real object's metadata before moving it into place. A bucket lifecycle rule deletes anything still under `tmp/` after a day. Skipping the finalize step means user-controlled objects that nothing has validated.

### 15. Signed URLs work without a key file because the account signs for itself

Signing a V4 URL needs a private key. There is no key file in this template, by design — so the library asks the IAM `signBlob` API to sign instead, which requires the runtime service account to hold `roles/iam.serviceAccountTokenCreator` **on itself**.

It looks like a mistake in the bootstrap script. It is the binding that replaces a downloadable credential. Remove it and every signed URL fails with `Permission 'iam.serviceAccounts.signBlob' denied`, naming the account and not the missing role.

### 16. `server-only` has to be stubbed in Vitest

`import 'server-only'` resolves to a module that throws unless the bundler picked its `react-server` export. Next.js does; Vitest does not. So `vitest.config.ts` aliases it to `tests/server-only.stub.ts`.

The guard still does its job in `next build`, which is the build that ships. Delete the alias and every test touching `services/` fails with "This module cannot be imported from a Client Component module".

### 17. `protobufjs` is listed in `allowBuilds` as `false`

It is a transitive dependency of `@google-cloud/firestore` that wants a lifecycle script. That script compiles nothing — it reads the parent `package.json` and prints a warning about version ranges.

It is **listed** rather than omitted because `pnpm install --frozen-lockfile` exits 1 with `ERR_PNPM_IGNORED_BUILDS` for any unlisted package that wants a script, which would fail CI and the Docker build. Listing it as `false` records the decision and keeps the script blocked.

### 18. Firestore's control plane is eventually consistent after `create`

A `databases update` issued straight after `databases create` races the creation and fails:

```
ERROR: (gcloud.firestore.databases.update) ABORTED:
There are concurrent database changes, please try again.
```

The database is **fine** — it exists, in the right region, in the right mode. Only the follow-up write lost the race. `gcp-bootstrap.sh` pauses after creating the database and wraps the point-in-time-recovery and backup-schedule calls in `retry_on_abort`, which retries `ABORTED` with backoff and returns any other error immediately, unretried.

Hit it anyway? Re-run bootstrap. It is idempotent: it skips the database that already exists and finishes the steps that did not.

### 19. The runtime service account goes in `flags`, not a `service_account` input

`google-github-actions/deploy-cloudrun` has **no `service_account` input**. Pass one and the action does not fail — it prints

```
##[warning]Unexpected input(s) 'service_account', valid inputs are ['service', 'job', ...]
```

and deploys anyway. The run is green, the warning scrolls past, and the revision runs as the **default compute service account** — Editor on the whole project, the opposite of the least-privilege identity `gcp-bootstrap.sh` just created.

This shipped once and reached a live service. The identity now goes through `flags` as `--service-account=`, where gcloud reads it.

Check any service you are unsure about:

```bash
gcloud run services describe SERVICE --region REGION \
  --format='value(spec.template.spec.serviceAccountName)'
```

An address ending `-compute@developer.gserviceaccount.com` is the default one.

### 20. The session cookie MUST be named `__session`

Firebase Hosting and the Cloud CDN in front of it **strip every cookie except one named exactly `__session`**, so a cached response is never varied by a cookie the cache does not know about.

Rename it and the app works perfectly on the direct `*.run.app` URL, then signs every user out the moment traffic arrives through a custom domain fronted by Hosting. The symptom is "auth randomly stops working in production", and it is miserable to trace.

`lib/session-cookie.ts` holds the name as a constant rather than an environment variable, on purpose. There is no legitimate reason to change it.

### 21. Verifying a session needs no IAM; minting one does

`verifySessionCookie` checks a signature against Google's published public keys. It needs no permission at all.

`createSessionCookie` calls the Identity Toolkit API, and needs `roles/firebaseauth.admin` on the runtime service account.

So a missing grant produces a very specific symptom: **existing sessions keep working, and only new sign-ins fail**, with `PERMISSION_DENIED` from `identitytoolkit`. It looks like a client bug. It is not. See [`docs/auth.md`](./auth.md).

### 22. The Firebase API key is public, and that is correct

It ships in every browser bundle, because the browser must send it to reach Identity Platform. It identifies the project; it authorises nothing on its own.

Putting it in a GitHub **secret** achieves nothing and makes debugging harder. It is a repository **variable**, passed as a Docker build arg. That does not weaken [the rule about secrets in build args](../CLAUDE.md#never-do-this) — this simply is not a secret.

Restrict it by HTTP referrer in the console (APIs & Services > Credentials) rather than trying to hide it.

### 23. Phone OTP costs money, and an open endpoint invites fraud

Every SMS is billed to you. SMS pumping fraud is automated: an attacker sends codes to premium-rate numbers they collect revenue from, and finds new endpoints quickly.

The single most effective control is the **SMS region policy** — Authentication > Settings — which defaults to allowing every country on earth. Restrict it to the countries you serve. reCAPTCHA is already wired in `useFirebaseAuth`, and a budget alert is how you find out in hours instead of at month end.

`gcp-bootstrap.sh` prints all three. None of them is automatic.

### 24. One conditional IAM binding makes every later one need `--condition`

Once a project's IAM policy contains **any** conditional binding, gcloud
refuses an unconditioned `add-iam-policy-binding` in non-interactive mode:

```
ERROR: (gcloud.projects.add-iam-policy-binding) Adding a binding without
specifying a condition to a policy containing conditions is prohibited in
non-interactive mode. Run the command again with `--condition=None`
```

It is not asking for a condition. It is asking you to **say** there is none, so
it cannot guess wrong about which binding you meant.

This template guarantees the trigger: `roles/datastore.user` is bound with an
IAM condition naming the database (trap 13), so by the time bootstrap reaches
any later project-level grant, the policy already has conditions in it. The
failure appears only on a project that has been bootstrapped once — a fresh
project works, which is what makes it easy to ship.

**Every `gcloud projects add-iam-policy-binding` in `gcp-bootstrap.sh` passes
`--condition`,** either a real one or `--condition=None`. Adding one without it
is a defect. Bindings on a bucket, a repository or a service account have their
own policies and are unaffected today — but the same rule applies the moment
one of those gains a condition.

### 25. Firestore returns a `Timestamp`, never a `Date`

A `Date` written to Firestore reads back as a `Timestamp`. So a schema
declaring `z.date()` for its own field used to fail on read:

```
Document users/abc failed validation: lastSignInAt: Invalid input:
expected date, received object
```

The document is correct. Only its type at the boundary was wrong.

`createdAt`, `updatedAt` and `deletedAt` were always converted, because the
repository owns those three. Nothing else was — so the bug stayed invisible
until `users` declared `lastSignInAt`, the template's first payload date, and
sign-in broke in production.

`timestampsToDates` in `services/repository.ts` now converts the whole payload
before validation, including inside plain objects and arrays. **It deliberately
does not recurse into class instances:** `GeoPoint`, `DocumentReference` and
`Buffer` must survive untouched, and rebuilding one from its entries would
return a plain object that every later read then rejects.

### 26. A Cloud Run deploy does not refresh Firebase Hosting

Next.js marks a statically prerendered page `Cache-Control: s-maxage=31536000`
— one year to a **shared** cache. Firebase Hosting is a CDN, and it obeys that.

So after a Cloud Run deploy, the `run.app` URL is fresh and the custom domain
still serves the previous build. Nothing links the two systems: the deploy
changes the origin and purges nothing.

`firebase deploy --only hosting` is the purge. `deploy.yml` runs it after the
health probe — **after**, never before, because purging while the old revision
still answers simply re-caches the old page. It is opt-in behind
`FIREBASE_HOSTING_ENABLED`, since an app with no Hosting site would fail there.

Measure it rather than guess:

```bash
curl -sI https://your-domain/ | grep -i cache-control
```

**Do not "fix" this with a catch-all `Cache-Control` in `firebase.json`.** A
dynamic route renders per-user content and sends no `Cache-Control` at all,
which is exactly what keeps it out of the CDN. A blanket header would start
caching one user's signed-in page and serving it to the next visitor.

### 27. A Cloud Run revision name must be unique, and fits in 63 characters

The revision is named `<service>-<suffix>`. Two constraints, and a suffix of
the commit SHA alone breaks both.

**Unique.** Re-deploying the same commit collides:

```
ERROR: (gcloud.run.deploy) ALREADY_EXISTS: Revision named
'my-app-646c48b...' with different configuration already exists.
```

"Different configuration" is `DEPLOYED_AT`, which moves every run. So a
`workflow_dispatch` re-run could never succeed — and re-running a deploy to
pick up a changed repository variable is an ordinary thing to want.

**63 characters.** A 40-character SHA plus a hyphen leaves 22 for the service
name. `APP_SLUG` allows 49, so a longer name overflowed a limit nothing warned
about.

`deploy.yml` builds the suffix as `r<run-number>-<short-sha>`, truncated to
whatever the service name leaves. **The run number comes first on purpose:** it
is the uniquifier and must never be trimmed, so truncation eats the SHA, which
is decorative. Traceability does not depend on it — the image tag and the
`commit-sha` label both carry the full SHA.

### 28. `dumb-init` is PID 1

Without it, Node ignores `SIGTERM`. Cloud Run waits 10s, then sends `SIGKILL`, and drops in-flight requests on every deploy. Verified: the container currently stops in ~1s.

### 29. `remove-iam-policy-binding --all` ignores conditions, and the deployer is shared

`--all` removes **every** binding for a member and role, whatever its condition.

That is correct for the runtime service account, which is named per app
(`<slug>-runtime@`). Every binding it holds belongs to this app, so there is
nothing else to catch.

It is wrong for the deployer. `github-deployer@` has no app slug in it — one
account serves every app in the project — and `roles/datastore.indexAdmin` is
granted once per app, each binding conditioned on that app's own database. So
`--all` on the deployer tears down the neighbours' access too.

The damage is silent. Nothing fails at teardown. The other apps keep serving
traffic, and break at their **next deploy**, at "Deploy Firestore rules and
indexes", on a role nobody edited.

`gcp-teardown.sh` names the condition instead, and it must match the one
`gcp-bootstrap.sh` granted **character for character** — gcloud matches a
binding by its whole condition, including the description text. A condition that
does not match is worse than an error: it removes nothing, reports nothing, and
leaves a stale binding on a shared account forever.

`scripts/gcp-iam-conditions.test.ts` compares the two strings, because reading
them side by side is the check a human eye fails.

`roles/firebasehosting.admin` and `roles/firebaserules.admin` are granted to the
same shared account **unconditioned**, because neither is a per-app resource.
Teardown leaves both. There is no binding there that belongs to one app.

---
