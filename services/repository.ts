import 'server-only';

import {
  type CollectionReference,
  type DocumentData,
  type DocumentSnapshot,
  FieldValue,
  type Firestore,
  type FirestoreDataConverter,
  type Query,
  type QueryDocumentSnapshot,
  Timestamp,
  type Transaction,
  type WhereFilterOp,
  type WriteBatch,
} from '@google-cloud/firestore';
import type { z } from 'zod';

import { assertDistributedId, type SuppliedIdOptions } from '@/lib/document-ids';
import { logger } from '@/lib/logger';
import { getFirestore } from '@/services/firestore.client';

/**
 * A small, typed repository on top of Firestore.
 *
 * What it buys, and why each part is not optional:
 *
 *   - **zod on read and write.** Firestore is schemaless. A field written by
 *     last year's code, by a console edit, or by a half-finished migration is
 *     indistinguishable at the type level from one this build wrote. Parsing on
 *     read turns that into a loud, located failure instead of `undefined`
 *     propagating into a template.
 *   - **Auto-generated ids by default.** `create` takes no id. Sequential and
 *     timestamp-prefixed ids put every new write on the same key range, which
 *     is a hotspot Firestore cannot split. See CLAUDE.md > Firestore data
 *     modeling. `createWithId` is the narrow exception, for an id that is
 *     already random and already meaningful — a Firebase uid. It refuses the
 *     shapes that cause the hotspot; see `lib/document-ids.ts`.
 *   - **Bounded queries only.** `limit` is a required argument on `list`, and
 *     it is capped. Pagination is cursor-based; there is no offset, because
 *     Firestore bills and scans every skipped document.
 *   - **Server timestamps.** `createdAt` and `updatedAt` are set by Firestore,
 *     not by the instance handling the request. Cloud Run instances do not
 *     share a clock.
 *   - **Soft delete by default.** `softDelete` sets `deletedAt` and every read
 *     filters it out, so an accidental delete is recoverable. `hardDelete`
 *     exists for erasure requests and says so.
 *
 * Usage:
 *
 * ```ts
 * const schema = z.object({ title: z.string().min(1), ownerId: z.string() });
 * export const notes = createRepository({ collection: 'notes', schema });
 *
 * const id = await notes.create({ title: 'Hello', ownerId });
 * const page = await notes.list({ limit: 20, where: [['ownerId', '==', ownerId]] });
 * ```
 */

/** Fields the repository owns. A payload schema must not declare these. */
const RESERVED_FIELDS = ['id', 'createdAt', 'updatedAt', 'deletedAt'] as const;

/**
 * Hard ceiling on a single page. A caller asking for more is a bug, not a
 * preference: a Cloud Run request that materialises 10 000 documents will blow
 * the 512 MiB memory limit long before it finishes serialising them.
 */
export const MAX_PAGE_SIZE = 200;

/** Default page size when a caller has no particular opinion. */
export const DEFAULT_PAGE_SIZE = 25;

/** A Firestore `WriteBatch` commits at most 500 operations. */
const MAX_BATCH_OPERATIONS = 500;

/** Timestamps and identity the repository adds to every stored document. */
export interface DocumentMetadata {
  /** Auto-generated Firestore document id. */
  id: string;
  createdAt: Date;
  updatedAt: Date;
  /** Non-null once soft-deleted. Reads exclude these unless asked not to. */
  deletedAt: Date | null;
}

/** A validated payload plus the metadata the repository maintains. */
export type StoredDocument<TPayload> = TPayload & DocumentMetadata;

/** One `where` clause. Kept as a tuple so a filter list reads like the query. */
export type QueryFilter = readonly [field: string, op: WhereFilterOp, value: unknown];

/** One `orderBy` clause. */
export interface QueryOrder {
  field: string;
  direction?: 'asc' | 'desc';
}

export interface ListOptions {
  /**
   * Maximum documents to return. Required — an unbounded query is the single
   * most common way to turn a working Firestore app into an outage.
   */
  limit: number;
  /** Opaque cursor from a previous page's `nextCursor`. */
  cursor?: string | undefined;
  where?: readonly QueryFilter[] | undefined;
  orderBy?: readonly QueryOrder[] | undefined;
  /** Include soft-deleted documents. Off by default. */
  includeDeleted?: boolean | undefined;
}

export interface Page<T> {
  items: readonly T[];
  /**
   * Cursor for the next page, or `null` at the end. Opaque by contract: it is
   * a document id today, and callers must not depend on that.
   */
  nextCursor: string | null;
}

/** Raised when an operation names a document that is not there. */
export class DocumentNotFoundError extends Error {
  constructor(
    readonly collection: string,
    readonly docId: string,
  ) {
    super(`Document ${collection}/${docId} does not exist`);
    this.name = 'DocumentNotFoundError';
  }
}

/** Raised when stored data does not match the collection's schema. */
export class DocumentValidationError extends Error {
  constructor(
    readonly collection: string,
    readonly docId: string,
    readonly issues: string,
  ) {
    super(`Document ${collection}/${docId} failed validation: ${issues}`);
    this.name = 'DocumentValidationError';
  }
}

/** Raised for a query the repository refuses to run. */
export class UnboundedQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnboundedQueryError';
  }
}

/** Raised when `createWithId` names a document that already exists. */
export class DocumentAlreadyExistsError extends Error {
  constructor(
    readonly collection: string,
    readonly docId: string,
  ) {
    super(`Document ${collection}/${docId} already exists`);
    this.name = 'DocumentAlreadyExistsError';
  }
}

/**
 * Recognises Firestore's ALREADY_EXISTS.
 *
 * gRPC status 6. Matched on the numeric `code` rather than the message, which
 * is not part of any contract and is localised in some client versions.
 */
const GRPC_ALREADY_EXISTS = 6;

function isAlreadyExists(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === GRPC_ALREADY_EXISTS
  );
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');
}

/**
 * Converts a stored value to a `Date`.
 *
 * `null` is a legitimate value for `deletedAt`. A `FieldValue` sentinel is not:
 * it appears only when a document is read back inside the same transaction that
 * wrote it, before the server has resolved it.
 */
function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

/**
 * Converts every Firestore `Timestamp` in a payload to a `Date`.
 *
 * Firestore returns a `Timestamp` for a date field, never a `Date`. A schema
 * declaring `z.date()` therefore failed on read with "expected date, received
 * object" — for data that had been written perfectly correctly. The document
 * was fine; only its type at the boundary was wrong.
 *
 * `createdAt`, `updatedAt` and `deletedAt` were always converted, because the
 * repository owns those three. Everything else was left raw, so the bug
 * appeared the first time a collection declared a date of its own.
 *
 * Recursion stops at plain objects and arrays deliberately. `GeoPoint`,
 * `DocumentReference` and `Buffer` are class instances that must survive
 * untouched, and rebuilding one from its entries would destroy it.
 */
export function timestampsToDates(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(timestampsToDates);

  if (
    typeof value === 'object' &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, timestampsToDates(nested)]),
    );
  }

  return value;
}

/**
 * Builds the `FirestoreDataConverter` for one collection.
 *
 * Exported so a caller that needs a raw `CollectionReference` (an aggregation
 * over an unusual shape, a one-off migration) can still get typed snapshots
 * rather than reaching for `DocumentData`.
 */
export function createConverter<TPayload extends Record<string, unknown>>(
  collection: string,
  schema: z.ZodType<TPayload>,
): FirestoreDataConverter<StoredDocument<TPayload>, DocumentData> {
  return {
    /**
     * Validates the payload before it reaches the wire and strips the fields
     * Firestore derives. `id` is the document key, never a field inside the
     * document — storing it twice guarantees the two disagree eventually.
     *
     * Timestamp fields are passed through untouched because the caller supplies
     * `FieldValue.serverTimestamp()` sentinels, which only the server resolves.
     */
    toFirestore(model): DocumentData {
      const source = model as Record<string, unknown>;
      const payload: Record<string, unknown> = {};
      const metadata: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(source)) {
        if (key === 'id') continue;
        if (key === 'createdAt' || key === 'updatedAt' || key === 'deletedAt') {
          metadata[key] = value;
          continue;
        }
        payload[key] = value;
      }

      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        throw new DocumentValidationError(collection, '<new>', formatZodIssues(parsed.error));
      }

      return { ...parsed.data, ...metadata };
    },

    fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>): StoredDocument<TPayload> {
      const raw = snapshot.data();
      const { createdAt, updatedAt, deletedAt, ...payload } = raw;

      // Timestamps become Dates BEFORE validation, so a collection can declare
      // `z.date()` for its own fields and have it mean what it says.
      const parsed = schema.safeParse(timestampsToDates(payload));
      if (!parsed.success) {
        throw new DocumentValidationError(collection, snapshot.id, formatZodIssues(parsed.error));
      }

      return {
        ...parsed.data,
        id: snapshot.id,
        // A document written before this field existed reads as `null`. Falling
        // back to the epoch would silently sort it first; `null` would break
        // the type. The zero Date is explicit and sorts predictably.
        createdAt: toDate(createdAt) ?? new Date(0),
        updatedAt: toDate(updatedAt) ?? new Date(0),
        deletedAt: toDate(deletedAt),
      };
    },
  };
}

/** The repository surface bound to an open transaction. */
export interface TransactionalRepository<TPayload> {
  /** Reads must all happen before any write in a Firestore transaction. */
  get(docId: string): Promise<StoredDocument<TPayload> | null>;
  create(payload: TPayload): string;
  /** See `Repository.createWithId`. Throws on a hotspot-prone id. */
  createWithId(docId: string, payload: TPayload, options?: SuppliedIdOptions): void;
  update(docId: string, patch: Partial<TPayload>): void;
  softDelete(docId: string): void;
}

/** The repository surface bound to an open batch. */
export interface BatchedRepository<TPayload> {
  create(payload: TPayload): string;
  update(docId: string, patch: Partial<TPayload>): void;
  softDelete(docId: string): void;
  hardDelete(docId: string): void;
}

export interface Repository<TPayload> {
  /** Collection path, e.g. `examples`. */
  readonly collection: string;
  /** Typed collection reference, for a query this helper does not cover. */
  ref(): CollectionReference<StoredDocument<TPayload>, DocumentData>;
  /** Returns the document, or `null` when it does not exist. */
  get(
    docId: string,
    options?: { includeDeleted?: boolean },
  ): Promise<StoredDocument<TPayload> | null>;
  /** Like `get`, but throws `DocumentNotFoundError` instead of returning null. */
  getOrThrow(
    docId: string,
    options?: { includeDeleted?: boolean },
  ): Promise<StoredDocument<TPayload>>;
  /** Creates a document with an auto-generated id. Returns that id. */
  create(payload: TPayload): Promise<string>;
  /**
   * Creates a document under an id the caller supplies.
   *
   * **Prefer `create`.** This exists for the case where the id is the point —
   * a profile keyed by its Firebase uid, fetched with one key lookup and no
   * index — and it is not a general escape hatch. The id is checked by
   * `assertDistributedId`, which refuses the shapes that create a write
   * hotspot: sequential counters, timestamp prefixes, bare numbers, and
   * anything too short to be random.
   *
   * Throws `DocumentAlreadyExistsError` rather than overwriting, so a repeated
   * call is a detectable race and never silent data loss.
   */
  createWithId(docId: string, payload: TPayload, options?: SuppliedIdOptions): Promise<void>;
  /** Merges a partial payload into an existing document. */
  update(docId: string, patch: Partial<TPayload>): Promise<void>;
  /** Marks the document deleted. Recoverable with `restore`. */
  softDelete(docId: string): Promise<void>;
  /** Clears `deletedAt`. */
  restore(docId: string): Promise<void>;
  /**
   * Removes the document permanently. For erasure requests and test cleanup;
   * prefer `softDelete` everywhere else.
   */
  hardDelete(docId: string): Promise<void>;
  /** One bounded, cursor-paginated page. */
  list(options: ListOptions): Promise<Page<StoredDocument<TPayload>>>;
  /**
   * Counts matching documents with an aggregation query — one billed read per
   * 1 000 index entries, rather than one per document.
   */
  count(options?: { where?: readonly QueryFilter[]; includeDeleted?: boolean }): Promise<number>;
  /** Runs `fn` in a Firestore transaction. All reads must precede all writes. */
  runTransaction<T>(
    fn: (repo: TransactionalRepository<TPayload>, tx: Transaction) => Promise<T>,
  ): Promise<T>;
  /** Collects up to 500 writes and commits them atomically. */
  batchWrite(fn: (repo: BatchedRepository<TPayload>, batch: WriteBatch) => void): Promise<void>;
}

export interface RepositoryOptions<TPayload extends Record<string, unknown>> {
  /** Collection path. A subcollection path such as `tenants/x/notes` works too. */
  collection: string;
  /** zod schema for the payload, excluding id and the timestamp fields. */
  schema: z.ZodType<TPayload>;
  /**
   * Supply a client explicitly. Only tests need this; application code lets the
   * repository resolve the shared singleton lazily, so importing a module that
   * defines a repository never opens a connection.
   */
  firestore?: Firestore;
}

/**
 * Creates a repository for one collection.
 *
 * Call this at module scope. Nothing here touches the network — the client is
 * resolved on the first actual operation.
 */
export function createRepository<TPayload extends Record<string, unknown>>(
  options: RepositoryOptions<TPayload>,
): Repository<TPayload> {
  const { collection, schema } = options;
  const converter = createConverter(collection, schema);

  /**
   * Field names the schema declares, when it is introspectable.
   *
   * `create` is safe without this: it writes `schema.parse()`'s output, and zod
   * strips keys the schema does not declare. `update` cannot do that — a partial
   * patch fails a whole-object parse on the missing required fields, so there is
   * no parsed output to write. Without this set, `update` would write an
   * undeclared key straight through, and every later read would silently strip
   * it again: a field that exists in Firestore and can never be read back.
   *
   * `null` for a schema with no `shape` (a union, a refinement, a custom type).
   * The key check is then skipped rather than guessed at, and TypeScript's
   * `Partial<TPayload>` remains the only guard — which is enough for a typed
   * call site, and is why this is defence in depth rather than the main control.
   */
  const declaredKeys: ReadonlySet<string> | null = (() => {
    const shape = (schema as unknown as { shape?: unknown }).shape;
    if (typeof shape !== 'object' || shape === null) return null;
    return new Set(Object.keys(shape));
  })();

  const db = (): Firestore => options.firestore ?? getFirestore();
  const ref = (): CollectionReference<StoredDocument<TPayload>, DocumentData> =>
    db().collection(collection).withConverter(converter);

  /**
   * Validates a partial patch and rejects any attempt to write a field the
   * repository owns. Without this, `update({ createdAt: new Date() })` type-errors
   * but `update(userSuppliedObject)` would not.
   */
  function validatePatch(patch: Partial<TPayload>): Record<string, unknown> {
    const entries = Object.entries(patch);
    for (const [key] of entries) {
      if ((RESERVED_FIELDS as readonly string[]).includes(key)) {
        throw new DocumentValidationError(
          collection,
          '<patch>',
          `"${key}" is maintained by the repository and cannot be set directly`,
        );
      }
      if (declaredKeys !== null && !declaredKeys.has(key)) {
        throw new DocumentValidationError(
          collection,
          '<patch>',
          `"${key}" is not declared in the schema for ${collection}`,
        );
      }
    }
    if (entries.length === 0) {
      throw new DocumentValidationError(collection, '<patch>', 'patch is empty');
    }

    // Validate the changed fields alone. A full-document parse would reject a
    // legitimate partial update for missing required fields.
    const partial = schema.safeParse({ ...Object.fromEntries(entries) });
    if (!partial.success) {
      // A partial patch legitimately fails a whole-object parse, so only
      // surface issues that point at a field the caller actually supplied.
      const supplied = new Set(entries.map(([key]) => key));
      const relevant = partial.error.issues.filter((issue) => supplied.has(String(issue.path[0])));
      if (relevant.length > 0) {
        throw new DocumentValidationError(
          collection,
          '<patch>',
          relevant.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        );
      }
    }

    return Object.fromEntries(entries);
  }

  function validatePayload(payload: TPayload): TPayload {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new DocumentValidationError(collection, '<new>', formatZodIssues(parsed.error));
    }
    return parsed.data;
  }

  function creationFields(payload: TPayload): DocumentData {
    return {
      ...validatePayload(payload),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      deletedAt: null,
    };
  }

  function buildQuery(options: ListOptions): Query<StoredDocument<TPayload>, DocumentData> {
    if (!Number.isInteger(options.limit) || options.limit < 1) {
      throw new UnboundedQueryError(`limit must be a positive integer, got ${options.limit}`);
    }
    if (options.limit > MAX_PAGE_SIZE) {
      throw new UnboundedQueryError(
        `limit ${options.limit} exceeds MAX_PAGE_SIZE (${MAX_PAGE_SIZE}). Paginate with the cursor instead.`,
      );
    }

    let query: Query<StoredDocument<TPayload>, DocumentData> = ref();

    for (const [field, op, value] of options.where ?? []) {
      query = query.where(field, op, value);
    }

    if (options.includeDeleted !== true) {
      query = query.where('deletedAt', '==', null);
    }

    const orders = options.orderBy ?? [{ field: 'createdAt', direction: 'desc' }];
    for (const order of orders) {
      query = query.orderBy(order.field, order.direction ?? 'asc');
    }

    // Firestore needs a total order for a cursor to be stable. Without a
    // tiebreaker, two documents sharing an `orderBy` value can be returned on
    // both pages, or on neither.
    query = query.orderBy('__name__', orders[0]?.direction ?? 'asc');

    return query;
  }

  return {
    collection,
    ref,

    async get(docId, listOptions): Promise<StoredDocument<TPayload> | null> {
      const snapshot = await ref().doc(docId).get();
      const data = snapshot.data();
      if (data === undefined) return null;
      if (listOptions?.includeDeleted !== true && data.deletedAt !== null) return null;
      return data;
    },

    async getOrThrow(docId, listOptions): Promise<StoredDocument<TPayload>> {
      const found = await this.get(docId, listOptions);
      if (found === null) throw new DocumentNotFoundError(collection, docId);
      return found;
    },

    async create(payload): Promise<string> {
      // `.doc()` with no argument generates a random id client-side, so the id
      // exists before the write completes and no two instances can collide.
      const docRef = db().collection(collection).doc();
      await docRef.set(creationFields(payload));
      return docRef.id;
    },

    async createWithId(docId, payload, idOptions): Promise<void> {
      assertDistributedId(docId, idOptions);
      try {
        // `.create()` (not `.set()`) fails when the document already exists,
        // which turns a concurrent first write into a detectable error rather
        // than one caller silently overwriting the other.
        await db().collection(collection).doc(docId).create(creationFields(payload));
      } catch (error) {
        if (isAlreadyExists(error)) throw new DocumentAlreadyExistsError(collection, docId);
        throw error;
      }
    },

    async update(docId, patch): Promise<void> {
      const fields = validatePatch(patch);
      // `update` (not `set`) fails when the document is gone, so a lost write
      // surfaces instead of silently resurrecting a deleted record.
      await db()
        .collection(collection)
        .doc(docId)
        .update({ ...fields, updatedAt: FieldValue.serverTimestamp() });
    },

    async softDelete(docId): Promise<void> {
      await db().collection(collection).doc(docId).update({
        deletedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    },

    async restore(docId): Promise<void> {
      await db().collection(collection).doc(docId).update({
        deletedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    },

    async hardDelete(docId): Promise<void> {
      logger.warn('Hard delete', { collection, docId });
      await db().collection(collection).doc(docId).delete();
    },

    async list(listOptions): Promise<Page<StoredDocument<TPayload>>> {
      let query = buildQuery(listOptions);

      if (listOptions.cursor !== undefined && listOptions.cursor !== '') {
        // Resolving the cursor to a snapshot costs one key lookup — not a scan
        // — and keeps the cursor opaque and independent of the orderBy fields.
        const cursorSnapshot: DocumentSnapshot<StoredDocument<TPayload>, DocumentData> = await ref()
          .doc(listOptions.cursor)
          .get();
        if (!cursorSnapshot.exists) {
          throw new UnboundedQueryError(
            `cursor "${listOptions.cursor}" does not resolve to a document in ${collection}`,
          );
        }
        query = query.startAfter(cursorSnapshot);
      }

      // Read one extra document to learn whether another page exists, without a
      // second query and without a count.
      const snapshot = await query.limit(listOptions.limit + 1).get();
      const hasMore = snapshot.docs.length > listOptions.limit;
      const docs = hasMore ? snapshot.docs.slice(0, listOptions.limit) : snapshot.docs;

      return {
        items: docs.map((doc) => doc.data()),
        nextCursor: hasMore ? (docs[docs.length - 1]?.id ?? null) : null,
      };
    },

    async count(countOptions): Promise<number> {
      let query: Query<StoredDocument<TPayload>, DocumentData> = ref();
      for (const [field, op, value] of countOptions?.where ?? []) {
        query = query.where(field, op, value);
      }
      if (countOptions?.includeDeleted !== true) {
        query = query.where('deletedAt', '==', null);
      }
      const result = await query.count().get();
      return result.data().count;
    },

    async runTransaction<T>(
      fn: (repo: TransactionalRepository<TPayload>, tx: Transaction) => Promise<T>,
    ): Promise<T> {
      return db().runTransaction(async (tx) => {
        const scoped: TransactionalRepository<TPayload> = {
          async get(docId) {
            const snapshot = await tx.get(ref().doc(docId));
            return snapshot.data() ?? null;
          },
          create(payload) {
            const docRef = db().collection(collection).doc();
            tx.set(docRef, creationFields(payload));
            return docRef.id;
          },
          createWithId(docId, payload, idOptions) {
            assertDistributedId(docId, idOptions);
            // `tx.create` fails the whole transaction when the document
            // exists, which is what makes a read-then-create sequence safe
            // against another instance doing the same thing concurrently.
            tx.create(db().collection(collection).doc(docId), creationFields(payload));
          },
          update(docId, patch) {
            tx.update(db().collection(collection).doc(docId), {
              ...validatePatch(patch),
              updatedAt: FieldValue.serverTimestamp(),
            });
          },
          softDelete(docId) {
            tx.update(db().collection(collection).doc(docId), {
              deletedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          },
        };
        return fn(scoped, tx);
      });
    },

    async batchWrite(fn): Promise<void> {
      const batch = db().batch();
      let operations = 0;

      const guard = (): void => {
        operations += 1;
        if (operations > MAX_BATCH_OPERATIONS) {
          throw new UnboundedQueryError(
            `a WriteBatch commits at most ${MAX_BATCH_OPERATIONS} operations; split the work into several batches`,
          );
        }
      };

      const scoped: BatchedRepository<TPayload> = {
        create(payload) {
          guard();
          const docRef = db().collection(collection).doc();
          batch.set(docRef, creationFields(payload));
          return docRef.id;
        },
        update(docId, patch) {
          guard();
          batch.update(db().collection(collection).doc(docId), {
            ...validatePatch(patch),
            updatedAt: FieldValue.serverTimestamp(),
          });
        },
        softDelete(docId) {
          guard();
          batch.update(db().collection(collection).doc(docId), {
            deletedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        },
        hardDelete(docId) {
          guard();
          batch.delete(db().collection(collection).doc(docId));
        },
      };

      fn(scoped, batch);
      if (operations === 0) return;
      await batch.commit();
    },
  };
}
