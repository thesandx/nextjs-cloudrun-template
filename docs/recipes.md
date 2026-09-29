# Task recipes

Step-by-step lists for the changes people make most often. Each one names every place a change must touch, so nothing is forgotten in the pull request.

Claude Code can run most of them as a skill: `/add-page`, `/add-component`, `/add-collection`, `/protect-route`, `/add-env-var`. Each skill points back to the recipe on this page, so the steps live in one place only.

---

## Start a new app from this template — see the README

`README.md` > "New app in 5 commands" is the short path: rename, bootstrap, set the GitHub variables, push. This section covers changes to an existing app.

## Add an environment variable — four places, one PR

Missing any step breaks somebody:

1. `.env.example` — document purpose, valid values, default, whether required in production
2. `lib/env.ts` — declare and validate it
3. `.github/workflows/deploy.yml` — a build arg (+ `Dockerfile` `ARG`/`ENV`) if `NEXT_PUBLIC_*`, otherwise an `env_vars` entry
4. `cloud/environment-variables.md` — note it if operators need context

## Add a component

1. Decide the folder: `ui/` (generic) vs `layout/` vs `<feature>/`
2. Server Component unless it needs state/effects/handlers/browser APIs
3. Export the props interface; accept `className`
4. Semantic HTML, accessible name, keyboard reachable
5. Tailwind utilities using tokens from `styles/globals.css` — no raw hex. Reach for an existing primitive before you write a new one
6. Mobile-first: base styles target the phone; layer `sm:`/`md:`/`lg:` for wider screens. Fluid widths (`w-full`, `max-w-*`), no fixed pixel widths that overflow, touch targets ≥44px. Verify at 320px, 768px and 1440px
7. Colocate `<Name>.test.tsx`
8. A new or changed `components/ui/` primitive also appears on `/design`, in the same PR

## Add a page

1. `app/<route>/page.tsx`, starting from `PageShell`, or from `AppBar` for a screen below a tab. Its `<main>` uses the `max-w-5xl` frame
2. Export `metadata` with a `title` and a one-sentence `description`
3. Link to it only once it exists. A link to a missing page fails `tests/site-checklist.test.ts`
4. Add it to `APP_TABS` or the `Header` links only if users go back to it often
5. Every action on it shows a success `Alert` and an error `Alert`
6. Design it twice: one column for the phone, then columns at `lg` for the desktop. Same markup, same order — only the grid changes
7. Check it at 320px, 768px and 1440px: no horizontal scroll, no clipped text, tap targets of 44px or more
8. Go through [the site checklist](../.github/instructions/design-language.md#the-site-checklist)

## Add a Firestore collection

Read [Firestore data modeling](./firestore-modeling.md) first. Then, in one pull request:

1. `services/<name>.service.ts` — a zod schema for the payload (never `id`, `createdAt`, `updatedAt` or `deletedAt`) and `createRepository({ collection, schema })`
2. Write the queries the app will actually run, and add a composite index to `firestore.indexes.json` for each filter + order combination
3. Add a field exemption for any monotonically increasing field nothing queries
4. `services/<name>.emulator.test.ts` if the collection has logic worth proving
5. `pnpm test:emulator` — the emulator suites do not run inside `pnpm validate`
6. The index reaches the database on the next deploy, before the app. Locally: `pnpm db:deploy --project <p> --database <db>`

## Protect a route

1. `const user = await requireUser();` as the first line of the handler's `try`
2. Check ownership separately — a session is not permission
3. Take every identity field from `user`, never from the body
4. Leave `GET` public unless the data itself is private
5. In the UI, render a sign-in prompt instead of the form — for honesty, not safety
6. Add the route to the table in [`docs/auth.md`](./auth.md) if it behaves unusually

## Add a file upload

1. Decide the allow-list of content types and the size ceiling. Never accept `image/svg+xml` — it executes script when served inline
2. Server: `createSignedUploadUrl({ path: { collection, docId, filename }, contentType, maxBytes })`
3. Client: `PUT` to the URL with the returned headers **byte for byte** — they are part of the signature
4. Server: `finalizeUpload(tmpPath)` — verifies the real object and promotes it out of `tmp/`
5. Store the returned **path** on the document, never the signed URL
6. Render with `createSignedReadUrl(path)`, freshly signed per request

`app/example/` does all six. Copy it, then delete it.

## Change the Dockerfile

1. Read [`.github/instructions/deployment.md`](../.github/instructions/deployment.md) first
2. Keep: `output: 'standalone'`, the separate `.next/static` copy, `USER nextjs`, `dumb-init`, `HOSTNAME=0.0.0.0`
3. **Verify**: `docker compose up --build`, then `curl localhost:8080/api/health`, then `docker compose ps` must say `healthy`

## Add a dependency

Read [rule 8](../.github/instructions/coding-rules.md#8-avoid-unnecessary-dependencies). If still justified: `pnpm add [-D] <pkg>`, commit `pnpm-lock.yaml`, and expect one of pnpm's two safety nets to stop you — see [Dependency policy](../CLAUDE.md#dependency-policy).

## Triage a failing Dependabot PR

**Distinguish our bug from their incompatibility.** Both have happened here:

- `TS5101 baseUrl is deprecated` → **our** config was wrong; fixing it unblocked the upgrade
- `contextOrFilename.getFilename is not a function` → **upstream**; close the PR with the reason

Read the failing step before deciding. Close with a comment that explains _why_, so nobody reopens the question in three months.

## Add a field to an existing collection

A required field is a migration, not an edit. See [Firestore data modeling > Add a field to an existing collection](./firestore-modeling.md#add-a-field-to-an-existing-collection).
