/**
 * Object-path construction and upload validation for Cloud Storage.
 *
 * Pure by design, and therefore in `lib/` rather than `services/`: there is no
 * network here, so the rules that decide where a byte lands and whether it is
 * allowed can be unit-tested exhaustively without an emulator, a bucket or a
 * credential. `services/storage.service.ts` calls into this and does the I/O.
 *
 * Every object in the bucket is namespaced `<collection>/<docId>/<filename>`.
 * That layout is not cosmetic:
 *   - it makes an object traceable back to the document that owns it, so
 *     deleting a document can delete its files without a separate index;
 *   - it keeps a prefix listing cheap and bounded;
 *   - it means a caller cannot write outside its own document by choosing a
 *     clever filename, because every segment is validated here.
 *
 * Browser uploads land under `tmp/` first and are promoted only after the
 * server has seen the real object's size and content type. A signed URL commits
 * to a content type and a size limit, but a client that ignores them still
 * produces an object — so the object is quarantined until it is checked. A
 * lifecycle rule on the bucket deletes anything left under `tmp/` after a day.
 */

/** Prefix for not-yet-verified uploads. Lifecycle-deleted after 1 day. */
export const TMP_PREFIX = 'tmp/';

/**
 * Cloud Storage allows object names up to 1024 bytes. Staying well under it
 * leaves room for the `tmp/` prefix and avoids surprising truncation.
 */
export const MAX_OBJECT_PATH_LENGTH = 512;

/** Longest filename accepted after sanitising. */
const MAX_FILENAME_LENGTH = 128;

/**
 * Safe segment: lowercase and uppercase letters, digits, hyphen, underscore.
 * Deliberately excludes `.` so no segment can ever be `.` or `..`, and excludes
 * `/` so a segment cannot introduce a path level of its own.
 */
const SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** Filename: a safe stem, then at most one extension. */
const FILENAME_PATTERN = /^[A-Za-z0-9_-]{1,120}(\.[A-Za-z0-9]{1,10})?$/;

/** Thrown for any input that would produce an unsafe or malformed object path. */
export class InvalidStoragePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStoragePathError';
  }
}

/** Thrown when an upload does not match what the signed URL promised. */
export class UploadRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadRejectedError';
  }
}

/** The three parts every object path is built from. */
export interface ObjectPathParts {
  /** Firestore collection that owns the file, e.g. `examples`. */
  collection: string;
  /** Id of the owning document. */
  docId: string;
  /** Leaf filename, already sanitised. */
  filename: string;
}

function assertSegment(label: string, value: string): void {
  if (!SEGMENT_PATTERN.test(value)) {
    throw new InvalidStoragePathError(
      `${label} must be 1-128 characters of letters, digits, hyphen or underscore`,
    );
  }
}

/**
 * Reduces an untrusted client-supplied filename to something safe to store.
 *
 * Keeps the extension, because content type alone does not tell a browser how
 * to name a download. Everything else collapses to `-`. Returns `file` when
 * nothing usable survives, so a caller never has to handle an empty string.
 *
 * @example sanitiseFilename('../../etc/passwd')  // 'etc-passwd'
 * @example sanitiseFilename('My Photo (1).JPEG') // 'My-Photo-1.jpeg'
 */
export function sanitiseFilename(filename: string): string {
  const withoutPath = filename.split(/[/\\]/).pop() ?? '';
  const lastDot = withoutPath.lastIndexOf('.');

  const rawStem = lastDot > 0 ? withoutPath.slice(0, lastDot) : withoutPath;
  const rawExtension = lastDot > 0 ? withoutPath.slice(lastDot + 1) : '';

  const stem = rawStem
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_FILENAME_LENGTH - 16);

  const extension = rawExtension
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);

  if (stem === '') return extension === '' ? 'file' : `file.${extension}`;
  return extension === '' ? stem : `${stem}.${extension}`;
}

/**
 * Builds the permanent object path for a file owned by a document.
 *
 * @throws {InvalidStoragePathError} if any part is unsafe or the result is too long.
 */
export function buildObjectPath(parts: ObjectPathParts): string {
  assertSegment('collection', parts.collection);
  assertSegment('docId', parts.docId);

  if (!FILENAME_PATTERN.test(parts.filename)) {
    throw new InvalidStoragePathError(
      `filename "${parts.filename}" is not safe to store; pass it through sanitiseFilename() first`,
    );
  }

  const path = `${parts.collection}/${parts.docId}/${parts.filename}`;
  if (path.length > MAX_OBJECT_PATH_LENGTH) {
    throw new InvalidStoragePathError(
      `object path is ${path.length} characters, which exceeds the ${MAX_OBJECT_PATH_LENGTH} character limit`,
    );
  }
  return path;
}

/** Builds the quarantined path a browser upload lands on first. */
export function buildTmpPath(parts: ObjectPathParts): string {
  return `${TMP_PREFIX}${buildObjectPath(parts)}`;
}

/** True when `path` is still in the quarantine area. */
export function isTmpPath(path: string): boolean {
  return path.startsWith(TMP_PREFIX);
}

/**
 * Maps a quarantined path to its permanent destination.
 *
 * Re-validates rather than trusting the string: the tmp path travels through
 * the client between the two calls, so by the time it comes back it is
 * untrusted input again.
 *
 * @throws {InvalidStoragePathError} if the path is not a well-formed tmp path.
 */
export function promoteTmpPath(tmpPath: string): string {
  if (!isTmpPath(tmpPath)) {
    throw new InvalidStoragePathError(`"${tmpPath}" is not a ${TMP_PREFIX} path`);
  }
  const parts = parseObjectPath(tmpPath.slice(TMP_PREFIX.length));
  if (parts === null) {
    throw new InvalidStoragePathError(`"${tmpPath}" is not a well-formed object path`);
  }
  return buildObjectPath(parts);
}

/**
 * Splits an object path back into its parts, or returns `null` when the path
 * does not match the layout this module produces.
 */
export function parseObjectPath(path: string): ObjectPathParts | null {
  const segments = path.split('/');
  if (segments.length !== 3) return null;

  const [collection, docId, filename] = segments;
  if (collection === undefined || docId === undefined || filename === undefined) return null;

  try {
    assertSegment('collection', collection);
    assertSegment('docId', docId);
  } catch {
    return null;
  }

  if (!FILENAME_PATTERN.test(filename)) return null;
  return { collection, docId, filename };
}

/**
 * Checks a content type against an allow-list.
 *
 * An allow-list, never a deny-list: `image/svg+xml` and `text/html` execute
 * script when served inline, so a bucket that accepts "anything that is not
 * obviously dangerous" is a stored-XSS host. Parameters such as
 * `; charset=utf-8` are stripped before comparison.
 *
 * @throws {UploadRejectedError} if the type is not allowed.
 */
export function assertAllowedContentType(
  contentType: string,
  allowed: readonly string[],
): asserts contentType is string {
  const normalised = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!allowed.includes(normalised)) {
    throw new UploadRejectedError(
      `content type "${normalised || contentType}" is not allowed; expected one of ${allowed.join(', ')}`,
    );
  }
}

/**
 * Checks a byte count against a limit.
 *
 * @throws {UploadRejectedError} if the size is missing, zero or over the limit.
 */
export function assertWithinSizeLimit(bytes: number, maxBytes: number): void {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new UploadRejectedError('upload has no measurable size');
  }
  if (bytes > maxBytes) {
    throw new UploadRejectedError(
      `upload is ${bytes} bytes, which exceeds the limit of ${maxBytes}`,
    );
  }
}
