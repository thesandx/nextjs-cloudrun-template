# Contributing

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

Full details in [`docs/local-development.md`](./docs/local-development.md).

## Workflow

```bash
git checkout -b feat/short-description
# make the change
pnpm validate      # exactly what CI runs
git commit
gh pr create
```

`pnpm validate` runs typecheck, lint, format check and tests. Running it locally means a green PR on the first push instead of the third.

## Conventions

The rules live in [`.github/instructions/`](./.github/instructions/) — the same rulebook AI assistants follow. Start with [`coding-rules.md`](./.github/instructions/coding-rules.md).

The ones people trip over most:

- **Server Components by default.** `'use client'` needs a reason, and belongs at the leaves.
- **No new top-level folders.** Nest inside the existing ones.
- **Absolute imports:** `@/lib/env`, never `../../../lib/env`.
- **New environment variable → four places, same PR:** `.env.example`, `lib/env.ts`, `deploy.yml`, `cloud/environment-variables.md`.
- **Architecture changed → docs updated in the same PR.**

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(checkout): add order summary panel
fix(health): return 503 when the dependency check fails
docs(cloud): explain the Artifact Registry retention policy
chore(deps): bump next to 16.2.11
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`.

The subject line says what changed. The body says **why** — that is the part git blame cannot reconstruct.

## Pull requests

The [PR template](./.github/pull_request_template.md) has the checklist. The parts reviewers actually care about:

- **Why**, not just what. Link the issue.
- **One logical change per PR.** A 40-file PR that renames things _and_ fixes a bug gets reviewed badly.
- **Explain the judgement calls** — a new dependency, a client boundary, a data-flow change.
- **Deployment notes** if anything must happen outside the PR: a new secret, an IAM grant, a variable.

## Dependencies

Read [rule 8](./.github/instructions/coding-rules.md#8-avoid-unnecessary-dependencies) before adding one. If it is still justified, say so in the PR: what it does, why the platform cannot, and what it costs the bundle.

Commit the updated `pnpm-lock.yaml` — CI installs with `--frozen-lockfile`.

## Documentation

Documentation changes ship with the code change, not after it. There is no separate docs backlog, on purpose: a docs backlog is where accuracy goes to die.

| Changed                      | Update                                                          |
| ---------------------------- | --------------------------------------------------------------- |
| Folder layout                | `.github/instructions/project-structure.md`, README             |
| Architecture or a dependency | `.github/instructions/architecture.md`, `cloud/architecture.md` |
| Dockerfile or runtime config | `.github/instructions/deployment.md`, `cloud/deployment.md`     |
| A workflow                   | `.github/instructions/github-workflows.md`, README              |
| An environment variable      | `.env.example`, `lib/env.ts`, `cloud/environment-variables.md`  |

For decisions that will outlive the PR, add an ADR — [`docs/adr/`](./docs/adr/).

## Reporting bugs

Use the [issue template](./.github/ISSUE_TEMPLATE/bug_report.yml). Include the `version` field from `/api/health` — it is the commit SHA actually serving traffic, and it settles "which build were you on?" immediately.

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](./SECURITY.md).
