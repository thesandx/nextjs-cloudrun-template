# Local development

## Prerequisites

| Tool       | Version         | Notes                                                          |
| ---------- | --------------- | -------------------------------------------------------------- |
| Node.js    | 22 LTS or newer | Pinned in `.nvmrc`; `nvm use` picks it up                      |
| pnpm       | 10 or newer     | `corepack enable` installs the version in `package.json`       |
| Docker     | any recent      | Only needed for container work                                 |
| gcloud CLI | any recent      | Deployment work, and the Firestore emulator                    |
| Java       | **21 or newer** | Only for the Firestore emulator. It refuses to start below 21. |

```bash
# Node via nvm
nvm install && nvm use

# pnpm via corepack (ships with Node — do not npm install -g pnpm)
corepack enable
```

Corepack reads the `packageManager` field in `package.json`, so everyone gets the same pnpm version, with nothing extra to keep in sync.

## Getting started

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>, and <http://localhost:3000/example> for the data layer.

`scripts/rename-project.sh` writes `.env.local` when you generate a project from the template. Working on the template itself, or cloned instead of generated? `cp .env.example .env.local` and fill in `APP_SLUG`.

The app starts with no Google Cloud configuration at all. Those variables are required only in production — see [Working with data](#working-with-data).

## Scripts

| Command              | What it does                                                       |
| -------------------- | ------------------------------------------------------------------ |
| `pnpm dev`           | Dev server with hot reload                                         |
| `pnpm build`         | Production build                                                   |
| `pnpm start`         | Serve the production build (run `build` first)                     |
| `pnpm typecheck`     | `tsc --noEmit` — **run `build` at least once first**, see below    |
| `pnpm lint`          | ESLint                                                             |
| `pnpm lint:fix`      | ESLint with `--fix`, including import sorting                      |
| `pnpm format`        | Prettier, writing changes                                          |
| `pnpm format:check`  | Prettier, verifying only (what CI runs)                            |
| `pnpm test`          | Vitest, once                                                       |
| `pnpm test:watch`    | Vitest in watch mode                                               |
| `pnpm test:coverage` | Vitest with a coverage report                                      |
| `pnpm test:emulator` | Start the Firestore emulator, run the suites that need it, stop it |
| `pnpm validate`      | The gate: typecheck, lint, format check, test                      |
| `pnpm db:emulator`   | Just the Firestore emulator, for `pnpm dev` against local data     |
| `pnpm db:deploy`     | Publish `firestore.rules` and `firestore.indexes.json`             |
| `pnpm gcp:teardown`  | Destroy one app's cloud resources (types the slug to confirm)      |
| `pnpm docker:build`  | Build the production image locally                                 |
| `pnpm docker:run`    | Run it and wait for health                                         |
| `pnpm clean`         | Remove `.next`, `coverage`, `node_modules`                         |

> **`pnpm validate` does not include the emulator suites.** `*.emulator.test.ts` files skip themselves when `FIRESTORE_EMULATOR_HOST` is unset, so the gate stays green on a clean checkout with no gcloud installed. CI runs them in a separate, required job. Run `pnpm test:emulator` yourself before pushing a change to `services/repository.ts` or a collection schema.

> **`pnpm typecheck` on a fresh clone fails until you have built once.** `next build` generates `next-env.d.ts` and `.next/types/**`, which `tsc` needs to resolve JSX and typed routes. Both are gitignored. `pnpm dev` also generates them. CI runs `build` before `typecheck` for the same reason.

## Working with data

Two ways to develop against Firestore and Cloud Storage. The full guide is [`data-layer.md`](./data-layer.md); this is the setup.

### Option A — the Firestore emulator, no cloud account

```bash
gcloud components install cloud-firestore-emulator   # once
pnpm db:emulator                                     # terminal 1
```

Then uncomment this in `.env.local` and restart `pnpm dev`:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085
```

The SDK reads that variable itself and sends no credentials. Data lives in memory and disappears when the emulator stops.

> **Never set `FIRESTORE_EMULATOR_HOST` in a deployed environment.** Every read and write would silently route to a host that does not exist.

**Cloud Storage has no emulator here.** Use the dev bucket for file work, as below.

### Option B — real cloud resources

```bash
gcloud auth application-default login
```

That writes Application Default Credentials the SDKs find automatically. The same code path runs in production, where Cloud Run's metadata server supplies the runtime service account instead — there is no key file in either case.

Point `GCS_BUCKET` at the **dev** bucket, `<bucket>-dev`, which `gcp-bootstrap.sh` creates alongside the production one:

```bash
GCS_BUCKET=my-project-my-app-media-dev
```

**A laptop must never write into the production bucket.** `scripts/rename-project.sh` writes the dev name into `.env.local` for exactly this reason.

Browser uploads need the bucket to allow your origin:

```bash
./scripts/gcp-bootstrap.sh ... --cors-origin http://localhost:3000
```

The dev bucket gets `http://localhost:3000` and `http://localhost:8080` automatically.

## Editor setup

VS Code picks up the recommended extensions and settings from `.vscode/`. The two that matter:

- **ESLint** — inline lint errors, fix on save
- **Prettier** — format on save

For other editors: enable format-on-save with Prettier, and point your LSP at the workspace TypeScript version (`node_modules/typescript`), not a globally installed one. A version mismatch produces errors that nobody else sees.

## The development loop

```
edit → hot reload → pnpm validate → commit → PR
```

Run `pnpm validate` before pushing. It is exactly what CI runs, so a green local run means a green PR. It also catches the format-check failure that otherwise costs an extra push.

## Working with the container

The dev server is not what production runs. Before touching anything in `Dockerfile`, `next.config.ts`, or the environment model, verify against the real image:

```bash
docker compose up --build
curl localhost:8080/api/health
docker compose ps          # should say "healthy", not just "running"
docker compose down
```

Or without Compose:

```bash
pnpm docker:build
pnpm docker:run
```

Problems that appear only here: wrong `PORT` handling, binding to localhost, missing static assets, permission errors from the non-root user, and slow cold starts.

## Environment variables

> Nothing in the data layer needs configuring to run `pnpm dev`. `APP_SLUG`, `GCP_PROJECT_ID`, `FIRESTORE_DATABASE_ID` and `GCS_BUCKET` are required **only** in production, where the container refuses to start without them so a misconfigured revision fails fast.

```bash
cp .env.example .env.local   # gitignored
```

Next.js loads `.env.local` automatically. Precedence, highest first: shell environment → `.env.local` → `.env.$NODE_ENV` → `.env`.

Adding a variable? All four steps, same PR — see [`cloud/environment-variables.md`](../cloud/environment-variables.md#adding-a-variable).

## Adding a dependency

Read [rule 8](../.github/instructions/coding-rules.md#8-avoid-unnecessary-dependencies) first. If it is still justified:

```bash
pnpm add <package>              # runtime
pnpm add -D <package>           # build/test only
```

Two pnpm safety nets may stop you, and both are deliberate:

- **`Ignored build scripts`** — the package wants to run an install script. Add it to `allowBuilds` in `pnpm-workspace.yaml` and say why in the PR.
- **`minimumReleaseAge` violation** — the version is less than 24 hours old. pnpm adds an entry to `minimumReleaseAgeExclude` for you; commit it, and prune it once the version has aged past the window.

Neither is a nuisance to switch off — they are supply-chain controls. See [troubleshooting](./troubleshooting.md#err_pnpm_minimum_release_age_violation--lockfile-failed-supply-chain-policy-check).

Commit the updated `pnpm-lock.yaml`. CI installs with `--frozen-lockfile` and will fail without it.

## Troubleshooting

| Symptom                                                      | Fix                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `Cannot find module '@/...'`                                 | Restart the TS server; check the path matches a real file from the repository root              |
| Type errors that VS Code shows but `pnpm typecheck` does not | Editor is using a different TypeScript — select "Use Workspace Version"                         |
| `pnpm typecheck` fails on a fresh clone                      | Run `pnpm build` once (see the note above)                                                      |
| Port 3000 in use                                             | `PORT=3001 pnpm dev`                                                                            |
| Stale build after a config change                            | `rm -rf .next && pnpm dev`                                                                      |
| `ERR_PNPM_OUTDATED_LOCKFILE` in CI                           | `pnpm install` locally and commit the lockfile                                                  |
| Hydration mismatch warning                                   | Something renders differently on server and client — usually `Date`, `Math.random`, or `window` |

More in [troubleshooting.md](./troubleshooting.md).
