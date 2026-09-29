---
name: add-env-var
description: Add or change an environment variable in this repo in all four required places — .env.example, lib/env.ts, the deploy workflow (and Dockerfile for NEXT_PUBLIC_*), and cloud/environment-variables.md. Use whenever new configuration, a secret, a feature flag or an API key is introduced.
---

# Add an environment variable

The steps live in one place: [`docs/recipes.md` > Add an environment variable](../../../docs/recipes.md#add-an-environment-variable--four-places-one-pr). Missing any of the four places breaks somebody.

## Decide first

- **Is it a secret?** Then it comes from Secret Manager at runtime. Never a build arg, never `NEXT_PUBLIC_*`, never the repository.
- **Is it `NEXT_PUBLIC_*`?** Then it is public and fixed at **build** time (trap 8 in `docs/traps.md`). It needs a Dockerfile `ARG`/`ENV` and a build arg in `deploy.yml`.

## Rules that are easy to miss

- Read `process.env` only in `lib/env.ts`. `pnpm lint` refuses it anywhere else.
- Validate it in `lib/env.ts`, and keep the `NEXT_PHASE` build guard intact (trap 12).
- Add a case to `lib/env.test.ts`.

## Done when

`pnpm validate` is green, and all four places changed in the same pull request.
