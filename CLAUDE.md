# CLAUDE.md

**Read this file before you make any change.** It is the operating manual for AI coding assistants (Claude Code, Copilot, Cursor, ChatGPT) and new human contributors working in this repository.

It is short on purpose: it loads into every agent session. It holds the rules, the prohibitions and an index. The detail lives in the documents it links to. **Open the linked document before you work in that area.**

Several things here look wrong but are correct. Several obvious "improvements" break the build or the deploy. [Traps](#traps) and [Never do this](#never-do-this) record them. Both come from real failures, not speculation.

---

## What this is

A production Next.js application deployed to Google Cloud Run, generated from a template. If `app/page.tsx` still shows the template home page — the mascot, "Hello World" and the primitive examples — the app has not been customised yet.

The template's purpose is that **the path to production already works**: a container that runs on Cloud Run, a pipeline that deploys it without storing any credential, a design language every screen already follows, and documentation that explains each decision. The application is deliberately trivial. Everything else is the reusable part — do not degrade it.

---

## Verified state

A clean install, a full build, a `--no-cache` Docker build and a running container confirmed the versions below work together. Do not assume a newer version works. See [Dependency policy](#dependency-policy).

|                           | Version    | Note                                     |
| ------------------------- | ---------- | ---------------------------------------- |
| Next.js                   | `16.2.10`  | App Router, Turbopack                    |
| React / React DOM         | `19.2.7`   |                                          |
| TypeScript                | `^6.0.3`   | Major bump; **do not add `baseUrl`**     |
| ESLint                    | `^9.39.5`  | **Pinned to 9 deliberately** — see traps |
| `eslint-config-next`      | `16.2.10`  | Must track the Next version              |
| Tailwind CSS              | `^4.3.3`   | v4, CSS-first config                     |
| Vitest                    | `^4.1.10`  | jsdom + React Testing Library            |
| Node                      | `>=22.0.0` | `.nvmrc` pins `22.20.0`                  |
| pnpm                      | `11.15.1`  | Via `packageManager` + corepack          |
| `@google-cloud/firestore` | `^9.2.0`   | Native mode, named database              |
| `@google-cloud/storage`   | `^8.2.0`   | V4 signed URLs, no key file              |
| zod                       | `^4.6.5`   | Runtime validation at every boundary     |
| `server-only`             | `^0.0.1`   | Makes a client import a build error      |
| `firebase`                | `^12.19.0` | Client SDK, **auth only** — never data   |
| `firebase-admin`          | `^14.4.0`  | Verifies and mints sessions. No key file |

The production image is ~64 MB compressed, boots in ~2s, stops on `SIGTERM` in ~1s, and runs as `uid=1001(nextjs)` on a read-only root filesystem.

---

## Documentation map

**Read the relevant document before you work in that area.** Do not reason from training defaults.

- [`docs/traps.md`](./docs/traps.md) — before "fixing" anything that looks wrong. Every trap is a real failure.
- [`docs/recipes.md`](./docs/recipes.md) — before adding a page, component, collection, route, env var, upload or dependency.
- [`.github/instructions/coding-rules.md`](./.github/instructions/coding-rules.md) — before writing anything. The non-negotiables in full.
- [`.github/instructions/project-structure.md`](./.github/instructions/project-structure.md) — before creating any file — it decides where it goes.
- [`.github/instructions/coding-standards.md`](./.github/instructions/coding-standards.md) — before writing TypeScript, React or CSS.
- [`.github/instructions/design-language.md`](./.github/instructions/design-language.md) — before writing or changing **any UI**. Tokens, primitives, anti-slop.
- [`.github/instructions/architecture.md`](./.github/instructions/architecture.md) — before adding a layer, dependency, or changing data flow.
- [`.github/instructions/deployment.md`](./.github/instructions/deployment.md) — before touching `Dockerfile`, env vars, or anything Cloud Run reads.
- [`.github/instructions/github-workflows.md`](./.github/instructions/github-workflows.md) — before touching `.github/workflows/`.
- [`docs/firestore-modeling.md`](./docs/firestore-modeling.md) — before designing a collection or writing a query.
- [`docs/data-layer.md`](./docs/data-layer.md) — before using the repository, Cloud Storage or the emulator.
- [`docs/auth.md`](./docs/auth.md) — before sign-in, sessions, profiles, or anything behind a login.
- [`docs/local-development.md`](./docs/local-development.md) — before setting up, or confused by tooling.
- [`docs/testing.md`](./docs/testing.md) — before writing tests. Explains the Server Component limitation.
- [`docs/troubleshooting.md`](./docs/troubleshooting.md) — before **Anything failing.** Symptom → cause → fix. Check here first.
- [`docs/adr/`](./docs/adr/) — before asking "why is it done this way?"
- [`cloud/deployment.md`](./cloud/deployment.md) — before deploying, rolling back, or setting up GCP.
- [`cloud/github-actions.md`](./cloud/github-actions.md) — before debugging OIDC / Workload Identity Federation.
- [`cloud/environment-variables.md`](./cloud/environment-variables.md) — before adding or changing configuration.
- [`SECURITY.md`](./SECURITY.md) — before the security model and the pre-production hardening checklist.

**Precedence when guidance conflicts** (later wins): your training defaults → general Next.js/GCP docs → `.github/instructions/` and `docs/` → this file → an explicit instruction from the human you are working with.

### Claude Code automation

[`.claude/`](./.claude/) is checked in. Its hooks run on every session:

- After each edit, the edited file is formatted with Prettier and fixed with ESLint. A lint error that `--fix` cannot repair is shown to you at once.
- A `git push` to `main` and a `--no-verify` commit or push are refused.
- Before a `git push`, `pnpm validate` runs. A red gate blocks the push.

The skills in [`.claude/skills/`](./.claude/skills/) run the recipes: `/add-page`, `/add-component`, `/add-collection`, `/protect-route`, `/add-env-var`, and `/verify` for the full protocol.

---

---

## Commands

```bash
pnpm dev              # dev server, hot reload
pnpm build            # production build (also generates types tsc needs)
pnpm validate         # typecheck + lint + format:check + test with coverage floor  ← the gate
pnpm test:watch       # tests in watch mode
pnpm test:emulator    # start the Firestore emulator and run the suites that need it (Java 21+)
pnpm test:e2e         # Playwright smoke tests against the built server (run pnpm build first)
pnpm db:emulator      # just the emulator, for `pnpm dev` against local data
pnpm db:deploy        # push firestore.rules and firestore.indexes.json
pnpm lint:fix         # fix lint violations and import order
pnpm format           # write Prettier formatting
docker compose up --build   # run the real production image locally
```

`pnpm validate` is the gate, and a green local run is a green CI `validate` job.

**One CI job is not inside it: the Firestore emulator suites.** `*.emulator.test.ts`
files skip themselves when `FIRESTORE_EMULATOR_HOST` is unset, so `pnpm validate`
stays green on a clean checkout. They are not optional — CI runs them in their own
job. **Run `pnpm test:emulator` before you push any change to
`services/repository.ts` or a collection schema.** It needs only Node and Java 21+:
without gcloud, it starts the emulator through a pinned `firebase-tools`.

---

## The twelve rules

Full reasoning in [`coding-rules.md`](./.github/instructions/coding-rules.md).

1. **Never break the folder structure.** The top-level folders are fixed. Do not invent `utils/`, `helpers/`, `src/`, or a root `api/`. Nest inside what exists.
2. **Always TypeScript.** No `.js`/`.jsx` source. No `any` — use `unknown` and narrow. No `@ts-ignore`; `@ts-expect-error` only with a comment saying what would remove it. Never weaken `tsconfig.json`.
3. **Prefer Server Components.** `'use client'` requires state, effects, event handlers, or browser APIs. Nothing else qualifies.
4. **Keep client components minimal.** Push `'use client'` to the leaves. Never in `app/layout.tsx` — that makes the whole app a client bundle.
5. **Keep components reusable.** One responsibility per file. `components/ui/` takes props and does no fetching. Export the props interface.
6. **Write production-quality code.** Handle the error path. Timeout every outbound call. No stubs, no commented-out code, no secrets.
7. **Explain architectural decisions.** In a comment when non-obvious, in the PR always, in `docs/adr/` when it will outlive the PR.
8. **Avoid unnecessary dependencies.** Check the platform first (`Intl`, `fetch`, `crypto`, `AbortSignal.timeout`, `structuredClone`). See [Dependency policy](#dependency-policy).
9. **Update docs when architecture or behaviour changes** — same PR, not later.
10. **Verify before claiming.** See [Verification protocol](#verification-protocol).
11. **Design mobile-first, in the design language.** Every UI is built from the Mochi tokens and the `components/ui/` primitives — never ad-hoc styles. Read [`design-language.md`](./.github/instructions/design-language.md) before you write any UI; the living reference renders at `/design`. Every UI works on a small screen first, then scales up. Unprefixed Tailwind utilities are the phone layout; add `sm:`/`md:`/`lg:` to enhance for wider screens — never the reverse. No fixed widths that overflow a phone, no horizontal scroll on the body, touch targets ≥44px. Responsiveness is a requirement, not a finishing touch. **On a phone the app behaves like an installed app** (a bottom `TabBar`, an `AppBar` with a back arrow); **from `md` (768px) up it behaves like a website** (a sticky `SiteHeader`, the `max-w-5xl` frame, columns at `lg`). A desktop page that is one narrow column is a defect — see [Responsive](./.github/instructions/design-language.md#responsive-an-app-on-a-phone-a-website-on-a-desktop). Every site also passes [the site checklist](./.github/instructions/design-language.md#the-site-checklist): no broken links, a mobile menu, a favicon, a title and description on every page, a 404 page, success and error messages, and tappable phone and email.
12. **Write docs in Simplified Technical English (ASD-STE100).** Every Markdown document — this file, `.github/instructions/`, `docs/`, `cloud/`, ADRs, READMEs — follows the standard. Short sentences (≤20 words for an instruction, ≤25 for a description), one instruction per sentence, active voice, present tense, one topic per paragraph, and one approved term per concept. Write for a non-native reader; choose the plain word over the clever one. Bring a document into compliance when you touch it.

---

## Which rules the tooling enforces

Most rules above are checks, not reminders. `pnpm lint` fails on each one. Each message names the document that explains the reason.

| Rule                                                | Check                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| 1 — no new top-level folder                         | `no-restricted-imports` refuses `@/utils/*`, `@/helpers/*`, `@/src/*`  |
| 2 — no `any`, no `@ts-ignore`                       | `@typescript-eslint/no-explicit-any`, `ban-ts-comment`                 |
| 4 — no `'use client'` in `app/layout.tsx`           | `no-restricted-syntax`                                                 |
| 5 — `components/ui/` does no fetching               | `no-restricted-imports` refuses `@/services/*` there                   |
| 6 — every outbound `fetch` has a timeout            | `no-restricted-syntax` in `services/` and `app/api/`                   |
| 6 — no `console.log`, no `debugger`, no empty catch | `no-console`, `no-debugger`, `no-empty`                                |
| 11 — no raw hex or arbitrary value in a `className` | `no-restricted-syntax` in `app/` and `components/`                     |
| 11 — no default Tailwind colour, size or radius     | `no-restricted-syntax`, one selector per design rule                   |
| 11 — outlines are 2px, shadows are hard             | `no-restricted-syntax` refuses `border`, `border-4`, `shadow-lg`       |
| Absolute imports only                               | `no-restricted-imports` refuses `../`                                  |
| `process.env` only in `lib/env.ts`                  | `no-restricted-properties`                                             |
| Layer boundaries                                    | `no-restricted-imports`, one block per folder                          |
| 11 — the site checklist                             | `tests/site-checklist.test.ts`: links, metadata, favicon, placeholders |
| 11 — both postures, the page frame, installable     | `tests/site-checklist.test.ts`: shell, `<main>` width, manifest        |

**`pnpm lint` runs with `--max-warnings 0`.** A warning fails CI exactly like an error. This makes the accessibility and performance rules of `eslint-config-next` blocking too.

**To disable a rule on a line, give a reason:** `// eslint-disable-next-line <rule> -- why`. A bare disable is a defect. See [`lib/logger.ts`](./lib/logger.ts) for the one in the template.

The lint cannot see everything. Pass the timeout at the `fetch` call site, or the check cannot confirm it. The design checks read `className` strings, so a class name assembled at runtime from a variable escapes them. These stay human judgement: mobile-first layout, one primary action per screen, the cute budget, the anti-slop list, Simplified Technical English, and whether a dependency earns its place.

---

## Where files go

| Writing                               | Goes in                      |
| ------------------------------------- | ---------------------------- |
| A page at a URL                       | `app/<route>/page.tsx`       |
| An HTTP endpoint                      | `app/api/<name>/route.ts`    |
| A generic button/card/input           | `components/ui/`             |
| Header, footer, page shell            | `components/layout/`         |
| A component for one feature           | `components/<feature>/`      |
| A `use...` hook                       | `hooks/use<Thing>.ts`        |
| A pure function, no I/O               | `lib/`                       |
| Anything calling an external system   | `services/`                  |
| A Firestore collection + its schema   | `services/<name>.service.ts` |
| Client-side SDK interaction           | `hooks/use<Thing>.ts`        |
| A composite index or field exemption  | `firestore.indexes.json`     |
| A Firebase Hosting rewrite or header  | `firebase.json`              |
| A Firestore security rule             | `firestore.rules`            |
| A type used in 2+ places              | `types/`                     |
| A type used once                      | Next to its consumer         |
| Images, fonts, `robots.txt`           | `public/`                    |
| A global style or design token        | `styles/globals.css`         |
| A script humans run                   | `scripts/`                   |
| An explanation of how something works | `docs/`                      |
| An explanation of the cloud setup     | `cloud/`                     |

**Naming:** components `PascalCase.tsx`; hooks `camelCase.ts`; utilities/services `kebab-case.ts`; tests `<subject>.test.ts(x)`; docs `kebab-case.md`.

**Imports are always absolute** via `@/*` — `@/lib/env`, never `../../../lib/env`. `eslint-plugin-simple-import-sort` enforces ordering. Run `pnpm lint:fix` rather than hand-sorting.

---

## Architecture in brief

Dependencies point **inward**. A layer may import from layers below it, never above.

```
app/          routes, layouts, route handlers      ← composition
components/   presentation
hooks/        client-side interaction
services/     external I/O (network, DB, cloud)    ← side effects
lib/          pure utilities, config, logging      ← no side effects
types/        shared contracts
```

**The data layer lives entirely in `services/`,** and every module there starts
with `import 'server-only';`. That import is not decoration: it makes a Client
Component importing the module a build error rather than a credential in a
browser bundle.

| Module                     | What it owns                                                                |
| -------------------------- | --------------------------------------------------------------------------- |
| `firestore.client.ts`      | The lazy Firestore singleton, pinned to the named database                  |
| `storage.client.ts`        | The lazy Storage singleton and the app's bucket                             |
| `repository.ts`            | Typed, zod-validated, cursor-paginated collections                          |
| `storage.service.ts`       | Signed upload/read URLs, upload verification                                |
| `sharded-counter.ts`       | Counters above one write per second                                         |
| `auth.service.ts`          | Session cookies: mint, verify, revoke. `requireUser()` gates a write        |
| `user.service.ts`          | `users/{uid}` profiles, keyed by the Firebase uid                           |
| `firebase-admin.client.ts` | The lazy Admin app. **Auth only** — never Firestore or Storage              |
| `lib/storage-paths.ts`     | Path construction and upload rules — pure, so it is tested without a bucket |
| `lib/document-ids.ts`      | Guards a caller-supplied document id against hotspot shapes — pure          |
| `lib/session-cookie.ts`    | The cookie's name and attributes — pure                                     |

Both clients are created **lazily**. A module that defines a repository opens no
connection at import time, which is what lets `next build` import every route on
a CI runner with no credentials.

**Allowed:** `app/` → `components/` → `lib/`; `app/` → `services/` → `lib/`
**Forbidden:** `lib/` → `services/`; `components/ui/` → `services/`; anything → `app/`

Deployment: `git push main` → GitHub Actions → OIDC → Artifact Registry → Cloud Run. The pipeline tags each image with the commit SHA and deploys it by that immutable tag, so a rollback is a traffic shift, not a rebuild.

---

## Firestore data modeling

Full rules and examples: [`docs/firestore-modeling.md`](./docs/firestore-modeling.md). **Read it before you design a collection or write a query.** The short form:

- **Model around access patterns, not entities.** There are no joins. Denormalise what the read path needs.
- **Use a subcollection for anything unbounded.** Never an array that grows without limit. If the maximum is "it depends", it is a subcollection.
- **Auto-generated ids only.** `repository.create()` takes no id. Sequential and date-prefixed ids make a hotspot.
- **Every query is bounded.** `limit` is required and capped at 200. Paginate with the cursor, never an offset.
- **About one write per second per document.** Use `count()` for a total you can compute, `services/sharded-counter.ts` for one you must maintain.
- **Exempt a monotonic field nothing queries** from indexing, in `firestore.indexes.json`.
- **Multi-tenancy:** prefer a subcollection per tenant. Choose once, and record it in an ADR.
- **A new required field is a migration:** optional → backfill → tighten. See [the recipe](./docs/firestore-modeling.md#add-a-field-to-an-existing-collection).
- **Add the composite index in the same pull request** as the query that needs it.

---

## Authentication in brief

Full guide: [`docs/auth.md`](./docs/auth.md). The decision: [ADR-0005](./docs/adr/0005-use-firebase-auth-for-sign-in.md).

Firebase Auth, with Google and phone OTP. **Reads are public; writes need a session.** The browser signs in, posts the ID token once to `POST /api/auth/session`, and gets an `httpOnly` `__session` cookie. The server reads it with `getCurrentUser()`.

```ts
const user = await requireUser(); // first line of every write handler; throws → 401
const document = await examples.getOrThrow(id);
if (document.ownerId !== user.uid) throw new ForbiddenError(); // a session is not permission
```

- **Write `ownerId` and every identity field from the session**, never from the request body. Copy a display name from the profile.
- **Hiding a form is a courtesy, not a control.** The control is on the server.
- **404 or 403?** If a row's existence is a secret, answer 404 for both cases, or a stranger enumerates ids.
- **Profiles live at `users/{uid}`.** `createWithId()` is the one exception to auto ids; `lib/document-ids.ts` keeps it narrow.
- **It fails closed.** `authEnabled` is derived from the `NEXT_PUBLIC_FIREBASE_*` config, which is fixed at build time (trap 8).
- **Log the uid.** Never an email address or a phone number.

---

## Traps

Things that look wrong and are not. **Read the full entry in [`docs/traps.md`](./docs/traps.md) before you change anything it names.** The numbers are stable; code and docs refer to "trap N".

1. [`pnpm typecheck` runs `next typegen` first](./docs/traps.md#1-pnpm-typecheck-runs-next-typegen-first)
2. [`tsconfig.json` has no `baseUrl`](./docs/traps.md#2-tsconfigjson-has-no-baseurl)
3. [ESLint is pinned to 9, not 10](./docs/traps.md#3-eslint-is-pinned-to-9-not-10)
4. [`next.config.ts` has no `eslint` key](./docs/traps.md#4-nextconfigts-has-no-eslint-key)
5. [pnpm `minimumReleaseAge` and Dependabot `cooldown` are coupled](./docs/traps.md#5-pnpm-minimumreleaseage-and-dependabot-cooldown-are-coupled)
6. [`output: 'standalone'` is load-bearing](./docs/traps.md#6-output-standalone-is-load-bearing)
7. [The container must bind `0.0.0.0` and honour `$PORT`](./docs/traps.md#7-the-container-must-bind-0000-and-honour-port)
8. [`NEXT_PUBLIC_*` is inlined at build time and is public](./docs/traps.md#8-next_public_-is-inlined-at-build-time-and-is-public)
9. [pnpm blocks dependency install scripts](./docs/traps.md#9-pnpm-blocks-dependency-install-scripts)
10. [Async Server Components cannot be unit-tested](./docs/traps.md#10-async-server-components-cannot-be-unit-tested)
11. [CodeQL needs code scanning enabled](./docs/traps.md#11-codeql-needs-code-scanning-enabled)
12. [`lib/env.ts` skips its production check during `next build`](./docs/traps.md#12-libenvts-skips-its-production-check-during-next-build)
13. [The Firestore database is NAMED, never `(default)`](./docs/traps.md#13-the-firestore-database-is-named-never-default)
14. [Uploads land in `tmp/` before they count](./docs/traps.md#14-uploads-land-in-tmp-before-they-count)
15. [Signed URLs work without a key file because the account signs for itself](./docs/traps.md#15-signed-urls-work-without-a-key-file-because-the-account-signs-for-itself)
16. [`server-only` has to be stubbed in Vitest](./docs/traps.md#16-server-only-has-to-be-stubbed-in-vitest)
17. [`protobufjs` is listed in `allowBuilds` as `false`](./docs/traps.md#17-protobufjs-is-listed-in-allowbuilds-as-false)
18. [Firestore's control plane is eventually consistent after `create`](./docs/traps.md#18-firestores-control-plane-is-eventually-consistent-after-create)
19. [The runtime service account goes in `flags`, not a `service_account` input](./docs/traps.md#19-the-runtime-service-account-goes-in-flags-not-a-service_account-input)
20. [The session cookie MUST be named `__session`](./docs/traps.md#20-the-session-cookie-must-be-named-__session)
21. [Verifying a session needs no IAM; minting one does](./docs/traps.md#21-verifying-a-session-needs-no-iam-minting-one-does)
22. [The Firebase API key is public, and that is correct](./docs/traps.md#22-the-firebase-api-key-is-public-and-that-is-correct)
23. [Phone OTP costs money, and an open endpoint invites fraud](./docs/traps.md#23-phone-otp-costs-money-and-an-open-endpoint-invites-fraud)
24. [One conditional IAM binding makes every later one need `--condition`](./docs/traps.md#24-one-conditional-iam-binding-makes-every-later-one-need---condition)
25. [Firestore returns a `Timestamp`, never a `Date`](./docs/traps.md#25-firestore-returns-a-timestamp-never-a-date)
26. [A Cloud Run deploy does not refresh Firebase Hosting](./docs/traps.md#26-a-cloud-run-deploy-does-not-refresh-firebase-hosting)
27. [A Cloud Run revision name must be unique, and fits in 63 characters](./docs/traps.md#27-a-cloud-run-revision-name-must-be-unique-and-fits-in-63-characters)
28. [`dumb-init` is PID 1](./docs/traps.md#28-dumb-init-is-pid-1)
29. [`remove-iam-policy-binding --all` ignores conditions, and the deployer is shared](./docs/traps.md#29-remove-iam-policy-binding---all-ignores-conditions-and-the-deployer-is-shared)

---

## Never do this

Violations here are defects, not style disagreements.

- **Never push or commit directly to `main`.** Every change reaches `main` through a reviewed pull request. A push to `main` deploys to production — see [Architecture in brief](#architecture-in-brief).
- **Never commit a service account key, or write `credentials_json:`.** The pipeline is keyless by design. A key is a permanent bearer credential. See [ADR-0002](./docs/adr/0002-use-workload-identity-federation.md).
- **Never interpolate `${{ secrets.* }}` into a `run:` block.** It splices into shell source before execution. Pass via `env:` instead.
- **Never deploy the `:latest` tag.** A revision pinned to a moving tag cannot be traced to a commit, and rollback becomes a rebuild.
- **Never read `process.env` outside `lib/env.ts`.** Untyped, unvalidated, and bypasses startup validation.
- **Never use `console.log` for application logging.** Use `@/lib/logger` — it emits the JSON shape Cloud Logging parses.
- **Never add `'use client'` to `app/layout.tsx`.** Turns the entire application into a client bundle.
- **Never create a new top-level folder.** Breaks cross-project consistency. Raise it instead.
- **Never style a UI with ad-hoc values instead of the tokens and primitives.** The design language stops being a system the moment one screen leaves it. See [`design-language.md`](./.github/instructions/design-language.md).
- **Never weaken `tsconfig.json` strictness.** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` are load-bearing.
- **Never disable a CI check to make a PR green.** Fix the code, or change the check deliberately and say why.
- **Never put a secret in a Docker build arg.** Visible in `docker history`. Use Secret Manager at runtime.
- **Never push, claim work is done, or open a PR without `pnpm validate` green.** Run it locally first — `format:check` included. CI must never fail from your end. See [Verification protocol](#verification-protocol).
- **Never query Firestore without a `limit`.** An unbounded read grows with the collection until it times out or exhausts the instance's memory. See [Firestore data modeling](./docs/firestore-modeling.md).
- **Never pass your own document id to `create`.** Sequential and timestamp-prefixed ids create a write hotspot Firestore cannot split.
- **Never paginate with an offset.** Firestore bills every skipped document. Use the cursor.
- **Never store a signed URL in a document.** It expires. Store the object path and sign on read.
- **Never read an upload without `finalizeUpload`.** The object exists the moment the PUT lands and nothing has checked it. See [trap 14](./docs/traps.md).
- **Never import `services/` from a Client Component.** It ships the SDK — and the intent to use credentials — to the browser. `import 'server-only'` makes it a build error; do not work around it.
- **Never point a Cloud Run probe at `/api/health?deep=1`.** Deep mode answers 503 when a dependency blips, so the platform would kill healthy containers and amplify the outage. Dashboards only.
- **Never set `FIRESTORE_EMULATOR_HOST` in a deployed environment.** Every read and write silently routes to a host that does not exist.
- **Never grant `roles/datastore.user` without an IAM condition.** It grants access to every database in the project, including other apps'. See [trap 13](./docs/traps.md).
- **Never write a route that changes data without `requireUser()`.** An ungated write is an open endpoint. Hiding the form in the UI stops nobody. See [Authentication in brief](#authentication-in-brief).
- **Never take `ownerId`, `ownerName` or any identity field from a request body.** The caller chooses the body. Read identity from the session, always.
- **Never treat a session as permission.** A session says who is asking, not what they may touch. Check ownership separately.
- **Never rename the `__session` cookie.** Firebase Hosting strips every other cookie, so auth breaks only behind a custom domain. See [trap 20](./docs/traps.md).
- **Never log an email address or a phone number.** They identify a person, and Cloud Logging retains them. Log the `uid`.
- **Never ship the Firestore client SDK to the browser.** It moves authorisation into `firestore.rules` permanently, and contradicts the server-only data layer. See [ADR-0005](./docs/adr/0005-use-firebase-auth-for-sign-in.md).
- **Never enable phone auth without an SMS region policy.** The default allows every country, and you pay per message. See [trap 23](./docs/traps.md).

---

## Task recipes

The steps live in [`docs/recipes.md`](./docs/recipes.md). **Follow the recipe; do not improvise the list.** Each one names every file the change must touch.

| Task                                      | Recipe                                                                       | Skill             |
| ----------------------------------------- | ---------------------------------------------------------------------------- | ----------------- |
| Start a new app                           | [README > New app in 5 commands](./README.md)                                | —                 |
| Add an environment variable (four places) | [recipe](./docs/recipes.md#add-an-environment-variable--four-places-one-pr)  | `/add-env-var`    |
| Add a component                           | [recipe](./docs/recipes.md#add-a-component)                                  | `/add-component`  |
| Add a page                                | [recipe](./docs/recipes.md#add-a-page)                                       | `/add-page`       |
| Add a Firestore collection                | [recipe](./docs/recipes.md#add-a-firestore-collection)                       | `/add-collection` |
| Protect a route                           | [recipe](./docs/recipes.md#protect-a-route)                                  | `/protect-route`  |
| Add a field to a collection               | [recipe](./docs/firestore-modeling.md#add-a-field-to-an-existing-collection) | —                 |
| Add a file upload                         | [recipe](./docs/recipes.md#add-a-file-upload)                                | —                 |
| Change the Dockerfile                     | [recipe](./docs/recipes.md#change-the-dockerfile)                            | —                 |
| Add a dependency                          | [recipe](./docs/recipes.md#add-a-dependency)                                 | —                 |
| Triage a failing Dependabot PR            | [recipe](./docs/recipes.md#triage-a-failing-dependabot-pr)                   | —                 |

---

## Verification protocol

**Never describe unverified work as working.** If a check fails, report the failure with its output.

**Run `pnpm validate` and get it green _before every push_ — never push work that will fail CI from your end.** It is exactly what CI runs, so a green local run is a green CI run. A push that turns CI red on something you could have run locally wastes a CI round and a review cycle.

Minimum, always — before you push:

```bash
pnpm validate     # typecheck + lint + format:check + test (with the coverage floor)
```

- **`format:check` is part of `pnpm validate`, not optional.** The most common self-inflicted CI failure is a Prettier miss — for example, editing a Markdown table re-widens its columns. CI fails it exactly like a type error. Run `pnpm format` (which writes the fix), then re-run `pnpm validate` before you push.
- **If you cannot run `pnpm validate` locally** (dependencies not installed), run `pnpm install` and the gate. If you truly cannot, do not push silently — say so explicitly and treat the work as unverified.
- **After you push, watch the checks.** If CI still fails, fix it and push again; work is not done until CI is green.

If you touched a page, a layout, a route handler or `next.config.ts`:

```bash
pnpm build && pnpm test:e2e   # smoke tests against the real server, phone and desktop
```

If you touched `Dockerfile`, `next.config.ts`, `package.json`, or the env model:

```bash
docker compose up --build
curl localhost:8080/api/health   # must return 200 with the expected version
docker compose ps                # must say "healthy", not just "running"
```

If you touched dependencies or `pnpm-workspace.yaml`:

```bash
rm -rf node_modules .next && pnpm install --frozen-lockfile
docker build --no-cache -t verify .    # the only honest supply-chain check
```

If you touched a workflow: YAML that parses is not a workflow that runs. `pr-validation.yml` validates itself on a PR; `deploy.yml` only runs on `main`.

Merging several dependency PRs? **Verify the merged tree**, not just each PR. CI tested each PR against a different baseline, and they have never run together until now.

---

## Dependency policy

Before adding anything, answer: can the platform do it? Can it be ~50 lines in `lib/`? Is it maintained? What does it cost the client bundle?

**Never add:** a date library where `Intl` suffices; `lodash` for one function; an HTTP wrapper around `fetch`; a state library before there is state.

Two pnpm safety nets will stop you, and both are deliberate:

- **`Ignored build scripts`** → the package wants a lifecycle script. Add to `allowBuilds` in `pnpm-workspace.yaml` and explain why.
- **`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`** → the version is under 24h old. pnpm adds an entry to `minimumReleaseAgeExclude`; commit it, then **prune it** once the version ages past the window. Empty is the healthy steady state.

**Upgrade philosophy:** `latest` on npm is not the same as _supported_. This repo tracks what `create-next-app` scaffolds, because that is what the framework tests. TypeScript 7 and ESLint 10 are both "latest" and both break the toolchain today.

---

## Security invariants

Full model in [`SECURITY.md`](./SECURITY.md).

- **No long-lived credentials exist.** CI authenticates via Workload Identity Federation with a short-lived OIDC token. The provider's attribute condition names your GitHub **owner**; the deployer's `principalSet://` binding names this **repository** and is what authorises a deploy. The provider is shared by every repository in the project — never pin it to one repository, or the next repository you bootstrap silently revokes this one. See [ADR-0003](./docs/adr/0003-scope-workload-identity-to-the-github-owner.md).
- **Two identities, deliberately separate.** The deployer service account can push images and deploy; it cannot read application data. The runtime service account can read its own secrets; it cannot deploy.
- **The container is hardened:** non-root uid 1001, no source/dev-deps/package manager in the final image, pinned base image, read-only root filesystem, `no-new-privileges`.
- **Workflows are least-privilege:** `contents: read` by default, `id-token: write` only where OIDC is needed, `persist-credentials: false` on checkout. PR validation needs **no** cloud credentials — keep it that way so fork PRs work.
- **Secrets** come from Secret Manager at runtime. Never a build arg, never `NEXT_PUBLIC_*`, never the repository.
- **The data layer is scoped to one app.** The runtime service account holds `roles/datastore.user` under an IAM condition naming this database, and `roles/storage.objectUser` on this bucket — not project-wide. A second app in the same project reaches neither.
- **Signed URLs need no key.** The runtime account holds `roles/iam.serviceAccountTokenCreator` on itself, so IAM signs on its behalf. That binding is what replaces a downloadable credential.
- **The bucket cannot be made public.** Uniform bucket-level access plus enforced public access prevention. Every read goes through a short-lived signed URL.
- **Writes require a session, and reads do not.** `requireUser()` is the gate. Identity always comes from the session, never from a request body. A session is authentication; ownership is authorisation, and it is a separate check.
- **The session cookie is `httpOnly`, `Secure` and `SameSite=Lax`,** named `__session` so Firebase Hosting does not strip it. Script cannot read it.
- **The runtime account holds `roles/firebaseauth.admin`,** the broadest privilege it has, because minting a session cookie needs it and no narrower predefined role exists. Verifying a session needs no IAM at all. See [ADR-0005](./docs/adr/0005-use-firebase-auth-for-sign-in.md).
- **Firestore rules deny all client access.** Defence in depth only: the app uses admin credentials, which bypass rules. The control that protects today's data is the IAM condition.

---

## Decision log

Recorded in [`docs/adr/`](./docs/adr/). Read before proposing a change to any of them.

| ADR                                                                    | Decision                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [0001](./docs/adr/0001-use-cloud-run-for-hosting.md)                   | Cloud Run for hosting — over Vercel, GKE, App Engine, a VM                           |
| [0002](./docs/adr/0002-use-workload-identity-federation.md)            | Workload Identity Federation — no service account keys, ever                         |
| [0003](./docs/adr/0003-scope-workload-identity-to-the-github-owner.md) | WIF provider scoped to the GitHub owner; the repository pin lives in the IAM binding |
| [0004](./docs/adr/0004-use-firestore-and-cloud-storage.md)             | Firestore + Cloud Storage — over Cloud SQL, over a per-app project                   |
| [0005](./docs/adr/0005-use-firebase-auth-for-sign-in.md)               | Firebase Auth with server-side session cookies — over Auth.js, over client-only auth |

Add an ADR when a decision is expensive to reverse, affects how everyone works, or rejects an obvious alternative. Never edit an accepted ADR to change its decision — write a new one that supersedes it, and link both ways.

---

## If a rule here blocks you

Say so explicitly and propose a change to the rule. Do not silently work around it, and do not disable a check to force a green result. If you change how something works, update the relevant document in the same change. A stale rulebook is worse than none: assistants follow it with confidence and produce confidently wrong code.
