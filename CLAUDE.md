# CLAUDE.md

Guidance for Claude Code and other AI assistants working in this repository.

## What this is

A production Next.js application deployed to Google Cloud Run. It started as a template — if it still contains only the Hello World page, it has not been customised yet.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · pnpm · Docker · Cloud Run · GitHub Actions with Workload Identity Federation.

## Read the rulebook first

The authoritative conventions live in [`.github/instructions/`](./.github/instructions/). Do not re-derive them from your training data — read them:

- **[coding-rules.md](./.github/instructions/coding-rules.md)** — the ten non-negotiables. Read this before writing anything.
- **[project-structure.md](./.github/instructions/project-structure.md)** — where every file goes.
- **[coding-standards.md](./.github/instructions/coding-standards.md)** — TypeScript, React, CSS.
- **[architecture.md](./.github/instructions/architecture.md)** — layers, data flow, trade-offs.
- **[deployment.md](./.github/instructions/deployment.md)** — Docker and the Cloud Run contract.
- **[github-workflows.md](./.github/instructions/github-workflows.md)** — CI/CD and OIDC.

## Commands

```bash
pnpm dev              # dev server
pnpm validate         # typecheck + lint + format:check + test  ← run before claiming done
pnpm test:watch       # tests in watch mode
pnpm lint:fix         # fix lint and import order
docker compose up --build   # run the production image locally
```

**`pnpm typecheck` needs `pnpm build` to have run at least once** on a fresh clone — `next build` generates `next-env.d.ts` and `.next/types/**`, both gitignored.

## The rules that matter most

1. **Server Components by default.** `'use client'` only for state, effects, event handlers or browser APIs — and push it to the leaves. Never in `app/layout.tsx`.
2. **No `any`.** Use `unknown` and narrow. Never weaken `tsconfig.json`.
3. **Never create a new top-level folder.** Nest inside the existing ones.
4. **Absolute imports only:** `@/lib/env`, never `../../../lib/env`.
5. **`process.env` is read in exactly one file:** `lib/env.ts`. Everything else imports `env` from there.
6. **Log through `@/lib/logger`**, not `console.log`.
7. **New env var → four places, same PR:** `.env.example`, `lib/env.ts`, `deploy.yml`, `cloud/environment-variables.md`.
8. **No new dependency** unless the platform genuinely cannot do it. Justify it in the PR.
9. **No service account keys, ever.** The pipeline uses OIDC. If you are writing `credentials_json:`, stop.
10. **Architecture changed → docs updated in the same PR.**

## Before you say it works

Run `pnpm validate`. If it fails, report the failure with its output rather than describing the intended behaviour.

Changed anything in `Dockerfile`, `next.config.ts`, or the environment model? `docker compose up --build` and `curl localhost:8080/api/health`. A build that succeeds is not a container that runs.

## Where things are

| Need                                   | Location                                                        |
| -------------------------------------- | --------------------------------------------------------------- |
| A page or route                        | `app/`                                                          |
| A component                            | `components/ui/`, `components/layout/`, `components/<feature>/` |
| A pure helper                          | `lib/`                                                          |
| Anything that calls an external system | `services/`                                                     |
| A shared type                          | `types/`                                                        |
| Deployment configuration               | `.github/workflows/deploy.yml`, `Dockerfile`                    |
| Cloud documentation                    | `cloud/`                                                        |
| A symptom you are debugging            | `docs/troubleshooting.md`                                       |

## Things that surprise people

- **`NEXT_PUBLIC_*` is inlined at build time** and is public. Changing it on Cloud Run does nothing, and it must never hold a secret.
- **CI builds before it type-checks**, deliberately. See the FAQ in the README.
- **Async Server Components cannot be unit-tested** with React Testing Library. Test their `services/` helpers instead — `docs/testing.md`.
- **The container must bind `0.0.0.0` and honour `$PORT`.** Both are set in the Dockerfile; removing either breaks every deploy.
- **pnpm blocks dependency install scripts.** Additions go in `pnpm-workspace.yaml` under `allowBuilds`, deliberately.
