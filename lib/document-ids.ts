/**
 * Validation for caller-supplied Firestore document ids.
 *
 * Pure, so it is tested exhaustively without a database — the same reason
 * `lib/storage-paths.ts` lives here rather than in `services/`.
 *
 * ## Why this file exists
 *
 * `repository.create()` takes no id, and that is the rule: auto-generated ids
 * are random, so writes spread across the key range from the first document.
 * A monotonic id (`user-1`, `user-2`, or `2026-09-22-abc`) sends every new
 * write to the same end of that range. Firestore scales a collection by
 * SPLITTING its key range, and a range whose writes all land at one end cannot
 * usefully split. Throughput stops climbing and latency climbs instead.
 *
 * ## Why there is an exception
 *
 * Sometimes the id is the point. A user profile keyed by its Firebase uid can
 * be fetched with one key lookup, from any request that has a session, with no
 * query and no index. The alternative — an auto id plus a `uid` field and a
 * unique index — turns every profile read into a query, and lets a race create
 * two profiles for one person.
 *
 * A Firebase uid is 28 characters of random base62. It is not monotonic, so it
 * does not create the hotspot the rule exists to prevent. The rule's REASON
 * permits it; only its wording forbade it.
 *
 * So `repository.createWithId()` exists, and this guard is what keeps the
 * exception narrow: it rejects the id shapes that actually cause hotspots. It
 * is a check against the reflex mistake, not an unbypassable control — the
 * judgement calls in CLAUDE.md > Firestore data modeling still apply.
 */

/**
 * Minimum length for a caller-supplied id.
 *
 * Sixteen characters is below a Firebase uid (28), a ULID (26) and a UUID (36),
 * and above anything a human counts by hand. Lower it deliberately, per call,
 * for a collection whose ids are naturally short AND whose write rate is far
 * below one document per second — a tenant keyed by slug, for example.
 */
export const MIN_SUPPLIED_ID_LENGTH = 16;

/** Firestore's own hard limit on a document id. */
export const MAX_DOCUMENT_ID_BYTES = 1500;

/** A date-prefixed id: `2026-09-22-anything`. Sorts, and therefore hotspots. */
const DATE_PREFIXED = /^\d{4}-\d{2}-\d{2}/;

/**
 * A short word followed by a counter: `user-1`, `order_42`, `item9`.
 *
 * The alphabetic run is capped at 12 so this cannot swallow a random id that
 * happens to end in digits. A 28-character base62 uid effectively never has a
 * 12-or-fewer-letter prefix followed by nothing but digits.
 */
const WORD_THEN_COUNTER = /^[A-Za-z]{1,12}[-_]?\d+$/;

/** Firestore reserves ids of the form `__name__`. */
const RESERVED = /^__.*__$/;

/** Raised for an id that Firestore rejects, or that would create a hotspot. */
export class InvalidDocumentIdError extends Error {
  constructor(
    readonly docId: string,
    reason: string,
  ) {
    super(`"${docId}" is not usable as a document id: ${reason}`);
    this.name = 'InvalidDocumentIdError';
  }
}

export interface SuppliedIdOptions {
  /**
   * Override `MIN_SUPPLIED_ID_LENGTH`. The shape checks below are NOT relaxed
   * by this — a sequential id is refused at any length.
   */
  minLength?: number;
}

/**
 * Throws unless `docId` is safe to write as a document id.
 *
 * Two classes of check, and they fail for different reasons:
 *   - Firestore's own constraints. Breaking one is an error from the server.
 *   - Hotspot shapes. Breaking one works fine until it does not, at scale,
 *     which is exactly when it is hardest to change.
 */
export function assertDistributedId(docId: string, options?: SuppliedIdOptions): void {
  const minLength = options?.minLength ?? MIN_SUPPLIED_ID_LENGTH;

  if (docId === '') {
    throw new InvalidDocumentIdError(docId, 'it is empty');
  }
  if (Buffer.byteLength(docId, 'utf8') > MAX_DOCUMENT_ID_BYTES) {
    throw new InvalidDocumentIdError(docId, `it exceeds ${MAX_DOCUMENT_ID_BYTES} bytes`);
  }
  if (docId.includes('/')) {
    throw new InvalidDocumentIdError(docId, 'a document id cannot contain "/"');
  }
  if (docId === '.' || docId === '..') {
    throw new InvalidDocumentIdError(docId, 'a document id cannot be "." or ".."');
  }
  if (RESERVED.test(docId)) {
    throw new InvalidDocumentIdError(docId, 'ids matching __*__ are reserved by Firestore');
  }

  if (DATE_PREFIXED.test(docId)) {
    throw new InvalidDocumentIdError(
      docId,
      'it starts with a date, so every new write lands at the same end of the key range',
    );
  }
  if (/^\d+$/.test(docId)) {
    throw new InvalidDocumentIdError(
      docId,
      'it is a number, which is almost always a counter and therefore a write hotspot',
    );
  }
  if (WORD_THEN_COUNTER.test(docId)) {
    throw new InvalidDocumentIdError(
      docId,
      'it looks like a sequential id (a word plus a counter), which cannot be split across key ranges',
    );
  }
  if (docId.length < minLength) {
    throw new InvalidDocumentIdError(
      docId,
      `it is shorter than ${minLength} characters, so it is unlikely to be random. ` +
        'Pass { minLength } deliberately if this collection takes far fewer than one write per second',
    );
  }
}
