---
name: protect-route
description: Gate a route handler or server action behind a session in this repo, with requireUser(), a separate ownership check, and identity taken only from the session. Use when adding or changing any route that writes data, or when asked to add auth/permissions to an endpoint.
---

# Protect a route

The steps live in one place: [`docs/recipes.md` > Protect a route](../../../docs/recipes.md#protect-a-route).

## Read first

1. `CLAUDE.md` > Authentication in brief.
2. `docs/auth.md` if the route behaves unusually.
3. `app/api/example/route.ts` and `app/api/example/finalize/route.ts` — the pattern to copy.

## The checklist

- `const user = await requireUser();` is the first line inside the handler's `try`.
- Ownership is a separate check: `if (document.ownerId !== user.uid) throw new ForbiddenError();`.
- No identity field (`ownerId`, `ownerName`, `uid`) is read from the request body.
- Errors go through `mapHttpError`, and only the ones with `exposeDetail: false` are logged.
- If a row's existence is a secret, a stranger gets 404 for "missing" and "not yours" alike.
- Log the uid. Never an email address or a phone number.
- A test covers the 401 path.

## Done when

`pnpm validate` is green.
