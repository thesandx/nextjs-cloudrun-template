---
name: verify
description: Run this repo's full verification protocol before a push or before claiming work is done — pnpm validate, plus the emulator suites, Docker checks or clean-install checks when the change touched those areas. Use before every push, PR, or "done" claim.
---

# Verify

The protocol is `CLAUDE.md` > Verification protocol. This skill runs it.

1. Always: `pnpm validate`. It includes the coverage floor: a threshold failure means new code needs tests, never a lower threshold. On a `format:check` failure, run `pnpm format` and re-run. On an import-order failure, run `pnpm lint:fix`.
2. Changed `services/repository.ts`, a `*.service.ts` schema, or `firestore.indexes.json`: `pnpm test:emulator`.
3. Changed a page, a layout, a route handler or `next.config.ts`: `pnpm build && pnpm test:e2e`.
4. Changed `Dockerfile`, `next.config.ts`, `package.json` or the env model: `docker compose up --build`, then `curl localhost:8080/api/health` returns 200, then `docker compose ps` says `healthy`.
5. Changed dependencies or `pnpm-workspace.yaml`: `rm -rf node_modules .next && pnpm install --frozen-lockfile`, then `docker build --no-cache -t verify .`.

Report each step as run and passed, run and failed (with the output), or not run and why. Never describe an unrun step as passing.
