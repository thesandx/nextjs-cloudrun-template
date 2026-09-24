# CLAUDE.md

**Read this file completely before making any change.** It is the operating manual for AI coding assistants (Claude Code, Copilot, Cursor, ChatGPT) and new human contributors working in this repository.

It exists because several things here look wrong but are correct. Several obvious "improvements" break the build or the deploy. [Traps](#traps--things-that-look-wrong-and-are-not) and [Never do this](#never-do-this) record them. Both sections come from real failures, not speculation.

---

## Table of contents

1. [What this is](#what-this-is)
2. [Verified state](#verified-state)
3. [Documentation map](#documentation-map)
4. [Commands](#commands)
5. [The twelve rules](#the-twelve-rules)
6. [Which rules the tooling enforces](#which-rules-the-tooling-enforces)
7. [Where files go](#where-files-go)
8. [Architecture in brief](#architecture-in-brief)
9. [Firestore data modeling](#firestore-data-modeling)
10. [Authentication in brief](#authentication-in-brief)
11. [Traps — things that look wrong and are not](#traps--things-that-look-wrong-and-are-not)
12. [Never do this](#never-do-this)
13. [Task recipes](#task-recipes)
14. [Verification protocol](#verification-protocol)
15. [Dependency policy](#dependency-policy)
16. [Security invariants](#security-invariants)
17. [Decision log](#decision-log)

---

## What this is

A production Next.js application deployed to Google Cloud Run, generated from a template. If `app/page.tsx` still shows the template home page — the mascot, "Hello World" and the primitive examples — the app has not been customised yet.

The template's purpose is that **the path to production already works**: a container that runs on Cloud Run, a pipeline that deploys it without storing any credential, a design language every screen already follows, and documentation that explains each decision. The application is deliberately trivial — the home page proves the deploy works and shows the primitives, nothing more. Everything else is the reusable part — do not degrade it.

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

**Measured facts:**

- The production image is **~64 MB** as stored and transferred (`docker save`, `docker image inspect .Size`) — this is what a registry holds and Cloud Run pulls.
- The container boots and answers `/api/health` in ~2s.
- It responds to `SIGTERM` in ~1s.
- It runs as `uid=1001(nextjs)` on a read-only root filesystem.

> Docker Desktop may display **~278 MB** for the same image. It is not a different image — Desktop's containerd image store reports the _unpacked on-disk_ size, while `docker save` and registries measure the compressed content. Both numbers are real. They measure different things.

---

## Documentation map

This file is the index and the warnings. The detail lives in `.github/instructions/` — **read the relevant one before working in that area**, rather than reasoning from training defaults.

| Read this                                                                                  | Before                                                         |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| [`.github/instructions/coding-rules.md`](./.github/instructions/coding-rules.md)           | Writing anything. The non-negotiables in full.                 |
| [`.github/instructions/project-structure.md`](./.github/instructions/project-structure.md) | Creating any file — it decides where it goes.                  |
| [`.github/instructions/coding-standards.md`](./.github/instructions/coding-standards.md)   | Writing TypeScript, React or CSS.                              |
| [`.github/instructions/design-language.md`](./.github/instructions/design-language.md)     | Writing or changing **any UI**. Tokens, primitives, anti-slop. |
| [`.github/instructions/architecture.md`](./.github/instructions/architecture.md)           | Adding a layer, dependency, or changing data flow.             |
| [`.github/instructions/deployment.md`](./.github/instructions/deployment.md)               | Touching `Dockerfile`, env vars, or anything Cloud Run reads.  |
| [`.github/instructions/github-workflows.md`](./.github/instructions/github-workflows.md)   | Touching `.github/workflows/`.                                 |
| [`docs/local-development.md`](./docs/local-development.md)                                 | Setting up, or confused by tooling.                            |
| [`docs/testing.md`](./docs/testing.md)                                                     | Writing tests. Explains the Server Component limitation.       |
| [`docs/data-layer.md`](./docs/data-layer.md)                                               | Firestore or Cloud Storage. Read before writing a query.       |
| [`docs/auth.md`](./docs/auth.md)                                                           | Sign-in, sessions, profiles, or anything behind a login.       |
| [`docs/troubleshooting.md`](./docs/troubleshooting.md)                                     | **Anything failing.** Symptom → cause → fix. Check here first. |
| [`docs/adr/`](./docs/adr/)                                                                 | Asking "why is it done this way?"                              |
| [`cloud/deployment.md`](./cloud/deployment.md)                                             | Deploying, rolling back, or setting up GCP.                    |
| [`cloud/github-actions.md`](./cloud/github-actions.md)                                     | Debugging OIDC / Workload Identity Federation.                 |
| [`cloud/environment-variables.md`](./cloud/environment-variables.md)                       | Adding or changing configuration.                              |
| [`SECURITY.md`](./SECURITY.md)                                                             | The security model and the pre-production hardening checklist. |

**Precedence when guidance conflicts** (later wins): your training defaults → general Next.js/GCP docs → `.github/instructions/` → this file → an explicit instruction from the human you are working with.

---

## Commands

```bash
pnpm dev              # dev server, hot reload
pnpm build            # production build (also generates types tsc needs)
pnpm validate         # typecheck + lint + format:check + test  ← the gate
pnpm test:watch       # tests in watch mode
pnpm test:emulator    # start the Firestore emulator and run the suites that need it
pnpm db:emulator      # just the emulator, for `pnpm dev` against local data
pnpm db:deploy        # push firestore.rules and firestore.indexes.json
pnpm lint:fix         # fix lint violations and import order
pnpm format           # write Prettier formatting
docker compose up --build   # run the real production image locally
```

`pnpm validate` is the gate, and a green local run is a green CI `validate` job.

**One CI job is not inside it: the Firestore emulator suites.** `*.emulator.test.ts`
files skip themselves when `FIRESTORE_EMULATOR_HOST` is unset, so `pnpm validate`
stays green on a clean checkout with no gcloud installed. They are not optional —
CI runs them in their own job. **Run `pnpm test:emulator` before you push any
change to `services/repository.ts` or a collection schema.**

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
11. **Design mobile-first, in the design language.** Every UI is built from the Mochi tokens and the `components/ui/` primitives — never ad-hoc styles. Read [`design-language.md`](./.github/instructions/design-language.md) before you write any UI; the living reference renders at `/design`. Every UI works on a small screen first, then scales up. Unprefixed Tailwind utilities are the phone layout; add `sm:`/`md:`/`lg:` to enhance for wider screens — never the reverse. No fixed widths that overflow a phone, no horizontal scroll on the body, touch targets ≥44px. Responsiveness is a requirement, not a finishing touch.
12. **Write docs in Simplified Technical English (ASD-STE100).** Every Markdown document — this file, `.github/instructions/`, `docs/`, `cloud/`, ADRs, READMEs — follows the standard. Short sentences (≤20 words for an instruction, ≤25 for a description), one instruction per sentence, active voice, present tense, one topic per paragraph, and one approved term per concept. Write for a non-native reader; choose the plain word over the clever one. Bring a document into compliance when you touch it.

---

## Which rules the tooling enforces

Most rules above are checks, not reminders. `pnpm lint` fails on each one. Each message names the document that explains the reason.

| Rule                                                | Check                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| 1 — no new top-level folder                         | `no-restricted-imports` refuses `@/utils/*`, `@/helpers/*`, `@/src/*` |
| 2 — no `any`, no `@ts-ignore`                       | `@typescript-eslint/no-explicit-any`, `ban-ts-comment`                |
| 4 — no `'use client'` in `app/layout.tsx`           | `no-restricted-syntax`                                                |
| 5 — `components/ui/` does no fetching               | `no-restricted-imports` refuses `@/services/*` there                  |
| 6 — every outbound `fetch` has a timeout            | `no-restricted-syntax` in `services/` and `app/api/`                  |
| 6 — no `console.log`, no `debugger`, no empty catch | `no-console`, `no-debugger`, `no-empty`                               |
| 11 — no raw hex or arbitrary value in a `className` | `no-restricted-syntax` in `app/` and `components/`                    |
| 11 — no default Tailwind colour, size or radius     | `no-restricted-syntax`, one selector per design rule                  |
| 11 — outlines are 2px, shadows are hard             | `no-restricted-syntax` refuses `border`, `border-4`, `shadow-lg`      |
| Absolute imports only                               | `no-restricted-imports` refuses `../`                                 |
| `process.env` only in `lib/env.ts`                  | `no-restricted-properties`                                            |
| Layer boundaries                                    | `no-restricted-imports`, one block per folder                         |

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

We chose a NoSQL database. A NoSQL database does not stop you designing a relational schema in it — it just performs badly and bills you for the privilege. These rules are the difference.

Most of them are enforced by `services/repository.ts`. The ones that are not are marked **judgement**, and they are the ones an assistant gets wrong.

---

### Model around access patterns, not entities

Write the queries first, then design the documents that answer them in one read. There are no joins. A "clean" normalised model means N reads to render one screen, and N grows with your traffic.

**Denormalise anything the read path needs.** A list of posts that shows an author's name stores that name on each post. Yes, a rename then needs a fan-out update. A rename is rare; the list render is not.

```ts
// Good — one read renders the row.
const post = { title, body, authorId, authorName, authorAvatarPath };

// Bad — one read per row to resolve the author.
const post = { title, body, authorId };
```

**Keep documents well under 1 MiB.** That is a hard limit, and you pay the whole document's size on every read of it, even for one field.

**Use a subcollection for anything unbounded.** An array inside a document has no natural ceiling, and every append rewrites the entire document.

```ts
// Good — a subcollection, queried with its own bounded page.
posts/{postId}/comments/{commentId}

// Bad — the document grows without limit and every write rewrites all of it.
posts/{postId}  { comments: [...] }
```

**Judgement:** nothing in the tooling can tell an array that will hold three items from one that will hold thirty thousand. Ask what the maximum is. If the answer is "it depends", it is a subcollection.

---

### Always use auto-generated document ids

`repository.create()` takes no id, on purpose.

Sequential ids (`user-1`, `user-2`) and timestamp-prefixed ids (`2026-09-22-abc`) both send every new write to the same end of the key range. Firestore splits a collection by key range to scale it; a monotonic key means every write lands in the same split, and that split cannot be divided. Throughput stops climbing and latency climbs instead.

Auto ids are random, so writes spread across the key space from the first document.

**Enforced:** `create` generates the id. There is no parameter to pass one.

---

### Every query is bounded

`limit` is a **required** argument on `repository.list()`, capped at `MAX_PAGE_SIZE` (200). Pagination is cursor-based. There is no offset, and there is no "just fetch them all".

```ts
// Good
const page = await notes.list({ limit: 25, cursor });

// Rejected at runtime with UnboundedQueryError
const page = await notes.list({ limit: 5000 });
```

Offset pagination does not exist in this repository because Firestore charges for every skipped document. Page 500 of an offset query reads 500 pages' worth of documents to return one.

**Enforced:** `UnboundedQueryError` from `services/repository.ts`.

---

### One document takes about one write per second

That is a sustained rate, not a burst. A counter that many users increment at once — likes, views, a stock level — will exceed it, and the symptom is contention errors under exactly the load you wanted.

- **A total you can compute on demand** → an aggregation query. `repository.count()` uses `count()`, which reads index entries, not documents.
- **A total you must maintain** → `services/sharded-counter.ts`. N shards give N writes/second and cost N reads to total.
- **Below one write per second** → a plain field. Do not shard by reflex; a shard costs a read.

```ts
// Good — no documents read at all.
const total = await notes.count({ where: [['ownerId', '==', ownerId]] });

// Bad — reads every document to produce a number.
const all = await notes.list({ limit: 200 });
const total = all.items.length; // and it is wrong past 200
```

---

### Do not index a monotonically increasing field you write often

An always-increasing indexed value (`createdAt`, `updatedAt`, a sequence number) writes to the same end of the index every time. Above roughly 500 writes/second to one collection, that index becomes the bottleneck.

The remedy is a single-field index exemption in `firestore.indexes.json`:

```json
{
  "fieldOverrides": [{ "collectionGroup": "examples", "fieldPath": "updatedAt", "indexes": [] }]
}
```

**Judgement, and a real trade-off.** An exempted field can no longer be filtered or ordered on by itself. The template exempts `updatedAt`, which nothing queries, and does **not** exempt `createdAt`, which every list orders by — that one is served by the composite index `(deletedAt, createdAt)` instead. Before exempting a field, check nothing queries it.

---

### Multi-tenancy: pick one shape and hold it

Two options, both valid. Choose once, per application, and write it into an ADR.

**A. Subcollection per tenant** — `tenants/{tenantId}/orders/{orderId}`

- Isolation is structural. A query rooted at the wrong tenant returns nothing, because the path is wrong.
- A security rule or an IAM condition can match on the path.
- Cross-tenant reporting needs a collection-group query and its own index.

```ts
const orders = createRepository({ collection: `tenants/${tenantId}/orders`, schema });
```

**B. `tenantId` field on every document** — `orders/{orderId}` with `{ tenantId, ... }`

- One collection, so cross-tenant queries and indexes are straightforward.
- Isolation is a convention, and a convention is one forgotten `where` clause from a data leak. **Every query must carry the filter**, and a composite index must lead with `tenantId`.

```ts
const page = await orders.list({ limit: 25, where: [['tenantId', '==', tenantId], ...] });
```

**Prefer A** unless cross-tenant queries are a core feature. Structural isolation cannot be forgotten; a `where` clause can.

---

### Ramp up new high-traffic collections: 500 / 50 / 5

Firestore scales a collection by splitting its key range, and splitting takes time. Starting a brand-new collection at full traffic overruns it before it has split, and the writes fail.

Start at **500 operations/second**, then raise the ceiling by **50%** every **5 minutes**. That reaches 740/s after 5 minutes, 1 100/s after 10, and about 1 M/s in 90 minutes.

This matters for a bulk import, a backfill, or a migration — not for organic growth, which ramps itself.

---

### The checklist before you write a query

1. Is `limit` set, and is there a cursor? (The repository enforces this.)
2. Does a composite index exist for the filter + order combination? Add it to `firestore.indexes.json` **in the same pull request**.
3. Is this a count? Use `count()`, not a list.
4. Multi-tenant? Is the tenant in the path, or in the `where` clause?
5. Will this collection take more than 500 writes/second at launch? Ramp it.

---

## Authentication in brief

Full guide in [`docs/auth.md`](./docs/auth.md). The decision is [ADR-0005](./docs/adr/0005-use-firebase-auth-for-sign-in.md).

Firebase Auth, with Google and phone OTP. **Reads are public; writes need a session.**

```
Browser signs in with Firebase   → an ID token, valid one hour
POST /api/auth/session           → server verifies it, sets a session cookie
Every later request              → getCurrentUser() on the server
```

The ID token is spent once and discarded. The cookie is `httpOnly`, so page script cannot read the session — and neither can an XSS.

### Gating a write is one line

```ts
const user = await requireUser(); // throws → 401, via lib/http-errors.ts
```

Put it first in the handler. `getCurrentUser()` is the variant that returns `null` instead, for a page that adapts to who is asking.

**Hiding a form from a signed-out user is a courtesy, not a control.** The control is on the server.

### A session is not permission

`requireUser()` answers _who is asking_. It does not answer _may they touch this_. Those are separate checks, and only the first is automatic:

```ts
const document = await examples.getOrThrow(id);
if (document.ownerId !== user.uid) throw new ForbiddenError();
```

**Write `ownerId` from the session, never from the request body.** A body field named `ownerId` is a field the caller chooses. The same goes for a display name: copy it from the profile, or any caller can post under somebody else's name.

**Judgement:** whether a missing document should answer 404 or 403 depends on whether its existence is a secret. Rows that are publicly listed can answer 403 honestly. Rows that are not must answer 404 for both cases, or a stranger enumerates ids by watching which ones answer 403.

### Profiles live at `users/{uid}`

Keyed by the Firebase uid, so a profile is one key lookup from any authenticated request — no query, no index, no second read.

That needs a caller-supplied id, which [the rule against it](#firestore-data-modeling) otherwise forbids. The rule exists to stop **monotonic** ids, which pin every write to one end of a key range Firestore then cannot split. A uid is 28 characters of random base62 and spreads exactly like an auto id. `repository.createWithId()` takes the exception; `lib/document-ids.ts` keeps it narrow by rejecting sequential ids, date prefixes, bare numbers and anything too short to be random.

### It fails closed

`authEnabled` is **derived** from the Firebase web config being complete, not set by a flag. An app built without that config serves public reads and answers 401 to every write. A half-finished setup can never become an open endpoint.

Those values are `NEXT_PUBLIC_*`, so they are fixed at **build** time. Adding them to a running service enables nothing — see trap 8.

### PII

A `uid` is pseudonymous and safe to log. An email address and a phone number are not: Cloud Logging retains them and many people can read them. **Log the uid.**

---

## Traps — things that look wrong and are not

Every item here caused a real failure. Do not "fix" any of them without reading the reason.

### 1. CI runs `build` _before_ `typecheck`

Looks backwards. It is not. `next build` generates `next-env.d.ts` and `.next/types/**`, which `tsc --noEmit` needs to resolve JSX and typed routes. Both are gitignored, so on a clean checkout they do not exist. Reverse the order and typecheck fails in CI with errors that reproduce nowhere locally.

**Same reason:** on a fresh clone, `pnpm typecheck` fails until you have run `pnpm build` (or `pnpm dev`) once.

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

React Testing Library cannot render them. Test the `services/`/`lib/` helpers they call, and the presentational components they render. **Synchronous** Server Components (like `app/page.tsx`) render fine. See [`docs/testing.md`](./docs/testing.md).

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

So a missing grant produces a very specific symptom: **existing sessions keep working, and only new sign-ins fail**, with `PERMISSION_DENIED` from `identitytoolkit`. It looks like a client bug. It is not. See [`docs/auth.md`](./docs/auth.md).

### 22. The Firebase API key is public, and that is correct

It ships in every browser bundle, because the browser must send it to reach Identity Platform. It identifies the project; it authorises nothing on its own.

Putting it in a GitHub **secret** achieves nothing and makes debugging harder. It is a repository **variable**, passed as a Docker build arg. That does not weaken [the rule about secrets in build args](#never-do-this) — this simply is not a secret.

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

### 27. `dumb-init` is PID 1

Without it, Node ignores `SIGTERM`. Cloud Run waits 10s, then sends `SIGKILL`, and drops in-flight requests on every deploy. Verified: the container currently stops in ~1s.

---

## Never do this

Violations here are defects, not style disagreements.

| Never                                                                 | Why                                                                                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Push or commit directly to `main`                                     | Every change reaches `main` through a reviewed pull request. A push to `main` deploys to production — see [Architecture in brief](#architecture-in-brief).               |
| Commit a service account key, or write `credentials_json:`            | The pipeline is keyless by design. A key is a permanent bearer credential. See [ADR-0002](./docs/adr/0002-use-workload-identity-federation.md).                          |
| Interpolate `${{ secrets.* }}` into a `run:` block                    | It splices into shell source before execution. Pass via `env:` instead.                                                                                                  |
| Deploy the `:latest` tag                                              | A revision pinned to a moving tag cannot be traced to a commit, and rollback becomes a rebuild.                                                                          |
| Read `process.env` outside `lib/env.ts`                               | Untyped, unvalidated, and bypasses startup validation.                                                                                                                   |
| Use `console.log` for application logging                             | Use `@/lib/logger` — it emits the JSON shape Cloud Logging parses.                                                                                                       |
| Add `'use client'` to `app/layout.tsx`                                | Turns the entire application into a client bundle.                                                                                                                       |
| Create a new top-level folder                                         | Breaks cross-project consistency. Raise it instead.                                                                                                                      |
| Style a UI with ad-hoc values instead of the tokens and primitives    | The design language stops being a system the moment one screen leaves it. See [`design-language.md`](./.github/instructions/design-language.md).                         |
| Weaken `tsconfig.json` strictness                                     | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` are load-bearing.                                                                                     |
| Disable a CI check to make a PR green                                 | Fix the code, or change the check deliberately and say why.                                                                                                              |
| Put a secret in a Docker build arg                                    | Visible in `docker history`. Use Secret Manager at runtime.                                                                                                              |
| Push, claim work is done, or open a PR without `pnpm validate` green  | Run it locally first — `format:check` included. CI must never fail from your end. See [Verification protocol](#verification-protocol).                                   |
| Query Firestore without a `limit`                                     | An unbounded read grows with the collection until it times out or exhausts the instance's memory. See [Firestore data modeling](#firestore-data-modeling).               |
| Pass your own document id to `create`                                 | Sequential and timestamp-prefixed ids create a write hotspot Firestore cannot split.                                                                                     |
| Paginate with an offset                                               | Firestore bills every skipped document. Use the cursor.                                                                                                                  |
| Store a signed URL in a document                                      | It expires. Store the object path and sign on read.                                                                                                                      |
| Read an upload without `finalizeUpload`                               | The object exists the moment the PUT lands and nothing has checked it. See trap 14.                                                                                      |
| Import `services/` from a Client Component                            | It ships the SDK — and the intent to use credentials — to the browser. `import 'server-only'` makes it a build error; do not work around it.                             |
| Point a Cloud Run probe at `/api/health?deep=1`                       | Deep mode answers 503 when a dependency blips, so the platform would kill healthy containers and amplify the outage. Dashboards only.                                    |
| Set `FIRESTORE_EMULATOR_HOST` in a deployed environment               | Every read and write silently routes to a host that does not exist.                                                                                                      |
| Grant `roles/datastore.user` without an IAM condition                 | It grants access to every database in the project, including other apps'. See trap 13.                                                                                   |
| Write a route that changes data without `requireUser()`               | An ungated write is an open endpoint. Hiding the form in the UI stops nobody. See [Authentication in brief](#authentication-in-brief).                                   |
| Take `ownerId`, `ownerName` or any identity field from a request body | The caller chooses the body. Read identity from the session, always.                                                                                                     |
| Treat a session as permission                                         | A session says who is asking, not what they may touch. Check ownership separately.                                                                                       |
| Rename the `__session` cookie                                         | Firebase Hosting strips every other cookie, so auth breaks only behind a custom domain. See trap 20.                                                                     |
| Log an email address or a phone number                                | They identify a person, and Cloud Logging retains them. Log the `uid`.                                                                                                   |
| Ship the Firestore client SDK to the browser                          | It moves authorisation into `firestore.rules` permanently, and contradicts the server-only data layer. See [ADR-0005](./docs/adr/0005-use-firebase-auth-for-sign-in.md). |
| Enable phone auth without an SMS region policy                        | The default allows every country, and you pay per message. See trap 23.                                                                                                  |

---

## Task recipes

### Start a new app from this template — see the README

`README.md` > "New app in 5 commands" is the short path: rename, bootstrap, set the GitHub variables, push. This section covers changes to an existing app.

### Add an environment variable — four places, one PR

Missing any step breaks somebody:

1. `.env.example` — document purpose, valid values, default, whether required in production
2. `lib/env.ts` — declare and validate it
3. `.github/workflows/deploy.yml` — a build arg (+ `Dockerfile` `ARG`/`ENV`) if `NEXT_PUBLIC_*`, otherwise an `env_vars` entry
4. `cloud/environment-variables.md` — note it if operators need context

### Add a component

1. Decide the folder: `ui/` (generic) vs `layout/` vs `<feature>/`
2. Server Component unless it needs state/effects/handlers/browser APIs
3. Export the props interface; accept `className`
4. Semantic HTML, accessible name, keyboard reachable
5. Tailwind utilities using tokens from `styles/globals.css` — no raw hex. Reach for an existing primitive before you write a new one
6. Mobile-first: base styles target the phone; layer `sm:`/`md:`/`lg:` for wider screens. Fluid widths (`w-full`, `max-w-*`), no fixed pixel widths that overflow, touch targets ≥44px. Verify at 320px wide and up
7. Colocate `<Name>.test.tsx`
8. A new or changed `components/ui/` primitive also appears on `/design`, in the same PR

### Add a Firestore collection

Read [Firestore data modeling](#firestore-data-modeling) first. Then, in one pull request:

1. `services/<name>.service.ts` — a zod schema for the payload (never `id`, `createdAt`, `updatedAt` or `deletedAt`) and `createRepository({ collection, schema })`
2. Write the queries the app will actually run, and add a composite index to `firestore.indexes.json` for each filter + order combination
3. Add a field exemption for any monotonically increasing field nothing queries
4. `services/<name>.emulator.test.ts` if the collection has logic worth proving
5. `pnpm test:emulator` — the emulator suites do not run inside `pnpm validate`
6. The index reaches the database on the next deploy, before the app. Locally: `pnpm db:deploy --project <p> --database <db>`

### Protect a route

1. `const user = await requireUser();` as the first line of the handler's `try`
2. Check ownership separately — a session is not permission
3. Take every identity field from `user`, never from the body
4. Leave `GET` public unless the data itself is private
5. In the UI, render a sign-in prompt instead of the form — for honesty, not safety
6. Add the route to the table in [`docs/auth.md`](./docs/auth.md) if it behaves unusually

### Add a field to an existing collection

**A required field is a migration, not an edit.** The repository validates on
read, so the moment a schema requires a field, every document written before it
becomes unreadable — and `list` throws on the whole page, not just that row.
A page that rendered yesterday shows an error boundary today.

This shipped once: `ownerId` was added to `examples` as required, and the one
pre-existing row took the whole `/example` page down.

Three deploys, in this order:

1. **Add it optional.** `ownerId: z.string().min(1).optional()`. Reads keep
   working, and new writes carry the field.
2. **Backfill.** A script in `scripts/`, paging with a cursor. This step is
   only possible while the field is optional — a required field makes the very
   `list` the backfill depends on throw.
3. **Tighten.** Remove `.optional()`. The type is now honest, and every
   document satisfies it.

```ts
// Step 2. `includeDeleted` matters: a soft-deleted row still needs the field,
// or restoring it later throws.
let cursor: string | undefined;
do {
  const page = await examples.list({ limit: 200, cursor, includeDeleted: true });
  await examples.batchWrite((repo) => {
    for (const row of page.items) {
      if (row.ownerId === undefined) repo.update(row.id, { ownerId: LEGACY_OWNER });
    }
  });
  cursor = page.nextCursor ?? undefined;
} while (cursor !== undefined);
```

**Removing a field is not symmetrical, and needs none of this.** zod strips
keys the schema does not declare, so dropping one from the schema is safe on
read. The data stays in Firestore until something deletes it.

**Shortcut, and say so in the PR:** a collection with no data worth keeping —
a fresh `examples`, a dev database — can skip all three. Delete the documents
and ship the required field directly.

A field you cannot backfill stays `.optional()` permanently. That is not
untidiness; it is the schema telling the truth about the data.

### Add a file upload

1. Decide the allow-list of content types and the size ceiling. Never accept `image/svg+xml` — it executes script when served inline
2. Server: `createSignedUploadUrl({ path: { collection, docId, filename }, contentType, maxBytes })`
3. Client: `PUT` to the URL with the returned headers **byte for byte** — they are part of the signature
4. Server: `finalizeUpload(tmpPath)` — verifies the real object and promotes it out of `tmp/`
5. Store the returned **path** on the document, never the signed URL
6. Render with `createSignedReadUrl(path)`, freshly signed per request

`app/example/` does all six. Copy it, then delete it.

### Change the Dockerfile

1. Read [`.github/instructions/deployment.md`](./.github/instructions/deployment.md) first
2. Keep: `output: 'standalone'`, the separate `.next/static` copy, `USER nextjs`, `dumb-init`, `HOSTNAME=0.0.0.0`
3. **Verify**: `docker compose up --build`, then `curl localhost:8080/api/health`, then `docker compose ps` must say `healthy`

### Add a dependency

Read [rule 8](./.github/instructions/coding-rules.md#8-avoid-unnecessary-dependencies). If still justified: `pnpm add [-D] <pkg>`, commit `pnpm-lock.yaml`, and expect one of pnpm's two safety nets to stop you — see [Dependency policy](#dependency-policy).

### Triage a failing Dependabot PR

**Distinguish our bug from their incompatibility.** Both have happened here:

- `TS5101 baseUrl is deprecated` → **our** config was wrong; fixing it unblocked the upgrade
- `contextOrFilename.getFilename is not a function` → **upstream**; close the PR with the reason

Read the failing step before deciding. Close with a comment that explains _why_, so nobody reopens the question in three months.

---

## Verification protocol

**Never describe unverified work as working.** If a check fails, report the failure with its output.

**Run `pnpm validate` and get it green _before every push_ — never push work that will fail CI from your end.** It is exactly what CI runs, so a green local run is a green CI run. A push that turns CI red on something you could have run locally wastes a CI round and a review cycle.

Minimum, always — before you push:

```bash
pnpm validate     # typecheck + lint + format:check + test
```

- **`format:check` is part of `pnpm validate`, not optional.** The most common self-inflicted CI failure is a Prettier miss — for example, editing a Markdown table re-widens its columns. CI fails it exactly like a type error. Run `pnpm format` (which writes the fix), then re-run `pnpm validate` before you push.
- **If you cannot run `pnpm validate` locally** (dependencies not installed), run `pnpm install` and the gate. If you truly cannot, do not push silently — say so explicitly and treat the work as unverified.
- **After you push, watch the checks.** If CI still fails, fix it and push again; work is not done until CI is green.

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
