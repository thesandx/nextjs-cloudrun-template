# The data layer

How to read, write and store files. Read this before your first query.

The rules behind it are in [CLAUDE.md > Firestore data modeling](../CLAUDE.md#firestore-data-modeling). The reasoning is in [ADR-0004](./adr/0004-use-firestore-and-cloud-storage.md). This page is the practical guide.

---

## What you get

Every app from this template gets two resources, created by `scripts/gcp-bootstrap.sh`:

| Resource      | Name                            | Region                        |
| ------------- | ------------------------------- | ----------------------------- |
| Firestore     | `<app-slug>-db` (Native mode)   | Same as the Cloud Run service |
| Cloud Storage | `<project-id>-<app-slug>-media` | Same as the Cloud Run service |
| Dev bucket    | `...-media-dev`                 | Same                          |

Two collections ship with the template: `examples`, which you delete, and `users`, which holds a profile per signed-in person. See [auth.md](./auth.md).

Both are reached with the Cloud Run runtime service account through Application Default Credentials. There is no key file.

> **Both locations are permanent.** A Firestore database cannot be moved, and neither can a bucket. Choose the region before you run bootstrap.

---

## Defining a collection

One file per collection, in `services/`.

```ts
import 'server-only';

import { z } from 'zod';

import { createRepository } from '@/services/repository';

export const noteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  ownerId: z.string().min(1),
  // Denormalised: the list view needs it, and a join would cost a read per row.
  ownerName: z.string().min(1).max(120),
});

export const notes = createRepository({ collection: 'notes', schema: noteSchema });
```

The schema declares the fields **you** own. It must not declare `id`, `createdAt`, `updatedAt` or `deletedAt` — the repository maintains those, and `update` rejects a patch that touches them.

Anything a user owns carries an `ownerId`, written from the session and never from the request body. See [auth.md](./auth.md).

`createRepository` opens no connection. The Firestore client is built on the first real operation, which is what lets `next build` import every route on a runner with no credentials.

---

## Reading and writing

```ts
// Create. No id argument — auto ids only, so writes spread across the key space.
const id = await notes.create({ title: 'Hello', ownerId, ownerName });

// The one exception: an id that is already random AND already meaningful.
// `assertDistributedId` refuses sequential ids, date prefixes and bare numbers.
await users.createWithId(uid, profile);

// Read. `null` means absent; anything else throws.
const note = await notes.get(id);
const sure = await notes.getOrThrow(id); // throws DocumentNotFoundError

// Update. Partial, validated, and `updatedAt` moves on its own.
await notes.update(id, { title: 'Hello again' });

// Soft delete. Reads exclude it; `restore` brings it back.
await notes.softDelete(id);
await notes.restore(id);

// Hard delete. For erasure requests. Prefer softDelete.
await notes.hardDelete(id);
```

### Listing — always bounded, always a cursor

```ts
const page = await notes.list({
  limit: 25, // required, capped at 200
  cursor, // from the previous page
  where: [['ownerId', '==', ownerId]],
  orderBy: [{ field: 'createdAt', direction: 'desc' }],
});

page.items; // readonly StoredDocument<Note>[]
page.nextCursor; // string | null — null means this was the last page
```

`limit` is required and there is no offset. Firestore charges for every skipped document, so offset pagination gets more expensive the deeper you go. The cursor is opaque: treat it as a token, not as an id.

### Dates

Declare `z.date()` and pass a `Date`. The repository converts Firestore's
`Timestamp` back to a `Date` on read, throughout the payload — including inside
plain objects and arrays.

```ts
const eventSchema = z.object({
  name: z.string().min(1),
  occurredAt: z.date(),
});
```

Do not declare a `Timestamp` in a schema. The point of the conversion is that
the Firestore type never reaches your application code.

`createdAt`, `updatedAt` and `deletedAt` are not yours to declare — the
repository maintains them and always returns them as `Date`.

### Changing a schema on a live collection

The repository validates on **read**, so a schema is a contract with data that
already exists. Adding a **required** field breaks that contract: every
document written before it fails to parse, and `list` throws for the whole
page rather than skipping the row.

Go through optional first — add it optional, backfill, then tighten. The full
sequence, with the backfill loop, is in
[CLAUDE.md > Add a field to an existing collection](../CLAUDE.md#add-a-field-to-an-existing-collection).

Removing a field needs none of that. zod strips undeclared keys, so a read
still succeeds; the data simply stays in Firestore until something deletes it.

### Supplying your own id

`create` takes no id, and that is the rule: auto ids are random, so writes spread across the key range from the first document. A monotonic id (`user-1`, `2026-09-22-abc`) sends every write to one end of that range, and Firestore scales a collection by **splitting** that range. A range whose writes all land at one end cannot usefully split.

`createWithId` exists for the case where the id is the point — a profile keyed by its Firebase uid, fetched with one key lookup and no index. A uid is 28 characters of random base62, so it spreads exactly like an auto id; the rule's reason permits it.

`lib/document-ids.ts` keeps the exception narrow:

| Refused                      | Why                                            |
| ---------------------------- | ---------------------------------------------- |
| `user-1`, `order_42`         | A counter. Every write lands at the same place |
| `2026-09-22-abc`             | Date-prefixed, so it sorts and therefore pins  |
| `1234567890`                 | A bare number is almost always a counter       |
| Anything under 16 characters | Unlikely to be random                          |
| `a/b`, `.`, `..`, `__x__`    | Firestore rejects these outright               |

The length floor is the only one a caller may lower, with `{ minLength }`, and only for a collection far below one write per second — a tenant keyed by slug, say. The shape checks hold at any length.

`createWithId` throws `DocumentAlreadyExistsError` rather than overwriting, so a concurrent first write is a detectable race and never silent data loss.

### Counting

```ts
const total = await notes.count({ where: [['ownerId', '==', ownerId]] });
```

An aggregation query. It reads index entries, not documents, so counting a million rows costs about a thousand reads rather than a million.

Never count by listing.

### Transactions and batches

```ts
// All reads must precede all writes inside a Firestore transaction.
await notes.runTransaction(async (repo) => {
  const current = await repo.get(id);
  repo.update(id, { title: `${current?.title} (edited)` });
});

// Up to 500 operations, committed atomically.
await notes.batchWrite((repo) => {
  for (const row of rows) repo.create(row);
});
```

---

## Files

The upload is three steps, and each one exists for a reason:

```
1. POST /api/<thing>/upload   → server returns a signed PUT URL
2. PUT  <signed url>          → browser sends the bytes straight to Cloud Storage
3. POST /api/<thing>/finalize → server verifies the object and promotes it
```

**Step 2 never touches Cloud Run.** Proxying an upload would buffer the file in a 512 MiB instance, hold a request slot for the length of the user's connection, and cap out at Cloud Run's 32 MiB request limit.

**Step 3 is not optional.** A signed URL constrains a well-behaved client; the object exists the moment the PUT lands, whatever the client did. Uploads therefore land under `tmp/`, and `finalizeUpload` re-reads the real object's content type and size before moving it into place. A lifecycle rule deletes anything still under `tmp/` after a day.

```ts
// Step 1
const upload = await createSignedUploadUrl({
  path: { collection: 'notes', docId: noteId, filename: 'photo.jpg' },
  contentType: 'image/jpeg',
  maxBytes: 5 * 1024 * 1024,
  allowedContentTypes: ['image/jpeg', 'image/png'],
});

// Step 3
const finalized = await finalizeUpload(upload.tmpPath);
await notes.update(noteId, { imagePath: finalized.path });
```

The client must send `upload.headers` **byte for byte**. They are part of the signature — Cloud Storage recomputes it from the request and answers 403 on a mismatch. `x-goog-content-length-range` is what makes the size limit real rather than advisory.

### Reading a file back

```ts
const url = await createSignedReadUrl(note.imagePath); // 15 minutes by default
```

**Store the path, never the URL.** A signed URL expires; a stored one becomes a dead link the moment it does. Sign on render.

The bucket enforces public access prevention, so a signed URL is the only way a browser reads an object.

### Object paths

Always `<collection>/<docId>/<filename>`. Construction and validation live in `lib/storage-paths.ts`, which is pure and therefore tested exhaustively without a bucket. Pass any client-supplied filename through `sanitiseFilename` first; `buildObjectPath` rejects anything unsafe outright.

### Content types

An allow-list, never a deny-list. `image/svg+xml` is excluded by default on purpose: an SVG executes script when served inline, so a bucket users can write to becomes a stored-XSS host.

---

## Local development

Two options.

### Against the emulator — no cloud account needed

```bash
pnpm db:emulator                               # terminal 1
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 pnpm dev   # terminal 2
```

Or uncomment `FIRESTORE_EMULATOR_HOST` in `.env.local`. The SDK reads it itself and sends no credentials.

The emulator ships as a gcloud component, not an npm package:

```bash
gcloud components install cloud-firestore-emulator   # needs Java 21+
```

**Cloud Storage has no emulator here.** Use the dev bucket instead — see below.

### Against real cloud resources

```bash
gcloud auth application-default login
```

Point `GCS_BUCKET` at the **dev** bucket (`<bucket>-dev`), which `gcp-bootstrap.sh` creates alongside the production one. `scripts/rename-project.sh` writes that into `.env.local` for you. A laptop must never write into the production bucket.

---

## Testing

| Suite                       | Environment | Runs                                       |
| --------------------------- | ----------- | ------------------------------------------ |
| `lib/storage-paths.test.ts` | jsdom       | Always — the module is pure                |
| `lib/env.test.ts`           | node        | Always                                     |
| `*.emulator.test.ts`        | node        | Only when `FIRESTORE_EMULATOR_HOST` is set |

The emulator suites skip themselves when the variable is unset, so `pnpm validate` is green on a clean checkout with no gcloud. They are not optional: CI runs them in their own job, and you should run them before pushing a change to `services/repository.ts` or a schema.

```bash
pnpm test:emulator
```

That script starts the emulator, runs the suites, and stops it again — including on failure and on Ctrl-C.

---

## Indexes

Composite indexes live in `firestore.indexes.json` and are deployed by CI **before** the application, so a new revision never queries an index that does not exist yet.

Add one whenever a query combines a filter with an order on a different field:

```json
{
  "collectionGroup": "notes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "deletedAt", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

Leave `__name__` out. Firestore appends it automatically, matching the last field's direction.

Deploy by hand with:

```bash
pnpm db:deploy --project my-project --database my-app-db
```

Indexes build in the background. A large collection can take minutes, and queries fail with `FAILED_PRECONDITION` until the build finishes.

---

## Security rules

`firestore.rules` denies every direct client request, and nothing in this template is denied by it — all access is server-side, and admin credentials bypass rules entirely.

Rules are therefore **defence in depth**, not the control protecting today's data. That control is the IAM condition in `scripts/gcp-bootstrap.sh`, which pins `roles/datastore.user` to this one named database.

Opening rules up for a client SDK moves authorisation out of your route handlers and into that file, permanently. Write an ADR before doing it.

---

## What to do when something fails

| Symptom                                            | Cause                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `FAILED_PRECONDITION: The query requires an index` | Add it to `firestore.indexes.json` and deploy                                                |
| `Permission 'iam.serviceAccounts.signBlob' denied` | Missing `roles/iam.serviceAccountTokenCreator` on itself                                     |
| `5 NOT_FOUND` on the first query                   | `FIRESTORE_DATABASE_ID` names a database that does not exist                                 |
| `403` from a signed URL PUT                        | The client did not send the returned headers exactly                                         |
| `UnboundedQueryError`                              | A `limit` over 200, or a cursor that no longer resolves                                      |
| `InvalidDocumentIdError`                           | `createWithId` was given a hotspot-prone id                                                  |
| `DocumentAlreadyExistsError`                       | `createWithId` raced another write for the same id                                           |
| `DocumentValidationError` on read                  | Stored data no longer matches the schema — usually a required field added without a backfill |

The full table, with fixes, is in [troubleshooting.md](./troubleshooting.md).
