# Firestore data modeling

Read this before you add a collection or write a query. The practical guide to the data layer is [`data-layer.md`](./data-layer.md). The reasoning is in [ADR-0004](./adr/0004-use-firestore-and-cloud-storage.md).

We chose a NoSQL database. A NoSQL database does not stop you designing a relational schema in it — it just performs badly and bills you for the privilege. These rules are the difference.

Most of them are enforced by `services/repository.ts`. The ones that are not are marked **judgement**, and they are the ones an assistant gets wrong.

---

## Model around access patterns, not entities

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

## Always use auto-generated document ids

`repository.create()` takes no id, on purpose.

Sequential ids (`user-1`, `user-2`) and timestamp-prefixed ids (`2026-09-22-abc`) both send every new write to the same end of the key range. Firestore splits a collection by key range to scale it; a monotonic key means every write lands in the same split, and that split cannot be divided. Throughput stops climbing and latency climbs instead.

Auto ids are random, so writes spread across the key space from the first document.

**Enforced:** `create` generates the id. There is no parameter to pass one.

---

## Every query is bounded

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

## One document takes about one write per second

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

## Do not index a monotonically increasing field you write often

An always-increasing indexed value (`createdAt`, `updatedAt`, a sequence number) writes to the same end of the index every time. Above roughly 500 writes/second to one collection, that index becomes the bottleneck.

The remedy is a single-field index exemption in `firestore.indexes.json`:

```json
{
  "fieldOverrides": [{ "collectionGroup": "examples", "fieldPath": "updatedAt", "indexes": [] }]
}
```

**Judgement, and a real trade-off.** An exempted field can no longer be filtered or ordered on by itself. The template exempts `updatedAt`, which nothing queries, and does **not** exempt `createdAt`, which every list orders by — that one is served by the composite index `(deletedAt, createdAt)` instead. Before exempting a field, check nothing queries it.

---

## Multi-tenancy: pick one shape and hold it

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

## Ramp up new high-traffic collections: 500 / 50 / 5

Firestore scales a collection by splitting its key range, and splitting takes time. Starting a brand-new collection at full traffic overruns it before it has split, and the writes fail.

Start at **500 operations/second**, then raise the ceiling by **50%** every **5 minutes**. That reaches 740/s after 5 minutes, 1 100/s after 10, and about 1 M/s in 90 minutes.

This matters for a bulk import, a backfill, or a migration — not for organic growth, which ramps itself.

---

## The checklist before you write a query

1. Is `limit` set, and is there a cursor? (The repository enforces this.)
2. Does a composite index exist for the filter + order combination? Add it to `firestore.indexes.json` **in the same pull request**.
3. Is this a count? Use `count()`, not a list.
4. Multi-tenant? Is the tenant in the path, or in the `where` clause?
5. Will this collection take more than 500 writes/second at launch? Ramp it.

---

---

## Add a field to an existing collection

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
