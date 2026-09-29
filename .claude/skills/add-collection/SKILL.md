---
name: add-collection
description: Add a Firestore collection to this repo — a zod schema, a typed repository in services/, the composite indexes its queries need, field exemptions, and emulator tests. Use when asked to store a new kind of data, add a model/entity/table, or write a new Firestore query.
---

# Add a Firestore collection

The steps live in one place: [`docs/recipes.md` > Add a Firestore collection](../../../docs/recipes.md#add-a-firestore-collection).

## Read first — before you design anything

1. `docs/firestore-modeling.md` — all of it. Write the queries first, then the documents.
2. `docs/data-layer.md` — how the repository is used.
3. `services/example.service.ts` — the shape to copy.

## Rules that are easy to miss

- The schema never declares `id`, `createdAt`, `updatedAt` or `deletedAt`. The repository owns them.
- `create()` takes no id. Use `createWithId()` only for an id that is already random, such as a Firebase uid.
- Every `list()` has a `limit`. Paginate with the cursor.
- Every filter + order combination has a composite index in `firestore.indexes.json`, **in the same pull request**.
- Anything unbounded is a subcollection, not an array.
- Identity fields (`ownerId`, names) come from the session, never from a request body.

## Done when

- `pnpm validate` is green.
- `pnpm test:emulator` is green. It needs Java 21+; gcloud is optional. It is not inside `pnpm validate`, and CI runs it.
