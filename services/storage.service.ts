import 'server-only';

import { logger } from '@/lib/logger';
import {
  assertAllowedContentType,
  assertWithinSizeLimit,
  buildObjectPath,
  buildTmpPath,
  isTmpPath,
  type ObjectPathParts,
  parseObjectPath,
  promoteTmpPath,
  sanitiseFilename,
  UploadRejectedError,
} from '@/lib/storage-paths';
import { getBucket } from '@/services/storage.client';

/**
 * File storage operations, built on direct browser uploads.
 *
 * The flow, and why it has three steps rather than one:
 *
 * ```
 *   1. POST /api/<thing>/upload   → server returns a signed PUT URL
 *   2. PUT <signed url>           → browser sends the bytes straight to GCS
 *   3. POST /api/<thing>/finalize → server verifies and promotes the object
 * ```
 *
 * Step 2 never touches Cloud Run. Proxying uploads through the app would mean
 * a 512 MiB instance buffering a file it has no use for, a request slot held
 * open for the length of a phone's upstream connection, and a hard ceiling at
 * Cloud Run's 32 MiB request limit. The signed URL moves that cost to Google.
 *
 * Step 3 exists because a signed URL constrains a well-behaved client, not a
 * hostile one. The URL commits to a content type and a size range, and GCS does
 * enforce both — but the object that results still needs checking before
 * anything links to it, so uploads land under `tmp/` and are promoted only
 * after the server has read the real object's metadata. Anything never promoted
 * is swept by the bucket's lifecycle rule after a day.
 *
 * Path construction and validation live in `@/lib/storage-paths` so they can be
 * tested without a bucket.
 */

/** Signed upload URLs are short-lived: long enough to upload, short enough to leak harmlessly. */
export const UPLOAD_URL_TTL_MS = 10 * 60 * 1000;

/** Default lifetime for a signed read URL. */
export const READ_URL_TTL_MS = 15 * 60 * 1000;

/**
 * Content types the template accepts by default.
 *
 * An allow-list, and a short one. `image/svg+xml` is absent on purpose: an SVG
 * is a script host, and serving one from a bucket users can write to is stored
 * XSS. Widen this per app, deliberately.
 */
export const DEFAULT_ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
] as const;

/** Default ceiling for a single upload. */
export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface SignedUploadRequest {
  /** Where the object will live once promoted. */
  path: ObjectPathParts;
  contentType: string;
  maxBytes?: number;
  allowedContentTypes?: readonly string[];
}

export interface SignedUpload {
  /** V4 signed PUT URL. Expires in 10 minutes. */
  url: string;
  /** Quarantined path the object lands on. Pass it back to `finalizeUpload`. */
  tmpPath: string;
  /**
   * Headers the client MUST send with the PUT, byte for byte. They are part of
   * the signature: GCS recomputes it from the request and rejects a mismatch
   * with 403. `x-goog-content-length-range` is what makes the size limit real
   * rather than advisory.
   */
  headers: Record<string, string>;
  expiresAt: string;
}

/**
 * Issues a V4 signed PUT URL for a direct browser upload.
 *
 * The returned object lands under `tmp/` and is not yet part of the app's data.
 * Call `finalizeUpload` once the client reports the PUT succeeded.
 *
 * @param request.path        `<collection>/<docId>/<filename>` parts.
 * @param request.contentType MIME type the client promises to send.
 * @param request.maxBytes    Hard size ceiling, signed into the URL.
 * @throws {UploadRejectedError}     if the content type is not allowed.
 * @throws {InvalidStoragePathError} if the path parts are unsafe.
 */
export async function createSignedUploadUrl(request: SignedUploadRequest): Promise<SignedUpload> {
  const allowed = request.allowedContentTypes ?? DEFAULT_ALLOWED_CONTENT_TYPES;
  const maxBytes = request.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES;

  assertAllowedContentType(request.contentType, allowed);

  const safeParts: ObjectPathParts = {
    collection: request.path.collection,
    docId: request.path.docId,
    filename: sanitiseFilename(request.path.filename),
  };
  const tmpPath = buildTmpPath(safeParts);

  // Signed into the URL, so a client cannot widen them by editing the request.
  const extensionHeaders = { 'x-goog-content-length-range': `1,${maxBytes}` };
  const expiresAt = Date.now() + UPLOAD_URL_TTL_MS;

  try {
    const [url] = await getBucket().file(tmpPath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresAt,
      contentType: request.contentType,
      extensionHeaders,
    });

    return {
      url,
      tmpPath,
      headers: { 'Content-Type': request.contentType, ...extensionHeaders },
      expiresAt: new Date(expiresAt).toISOString(),
    };
  } catch (error) {
    // Path only. Never the object's bytes, and never the signed URL itself —
    // the URL is a bearer credential for the length of its TTL.
    logger.error('Failed to sign upload URL', error, {
      path: tmpPath,
      contentType: request.contentType,
    });
    throw error;
  }
}

export interface FinalizedUpload {
  path: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Verifies a quarantined upload and moves it to its permanent path.
 *
 * Re-reads the object's real metadata from GCS rather than trusting what the
 * client says it uploaded, then moves it. A move within a bucket is a
 * server-side copy plus a delete — no bytes travel through Cloud Run.
 *
 * Idempotent in the way that matters: if the tmp object is already gone because
 * a retry promoted it, the caller gets a clear `UploadRejectedError` instead of
 * a half-finished state.
 *
 * @param tmpPath   The `tmpPath` from `createSignedUploadUrl`.
 * @param finalPath Destination. Defaults to the same path without `tmp/`.
 * @throws {UploadRejectedError} if the object is missing, oversized, or of a
 *   content type that is not allowed.
 */
export async function finalizeUpload(
  tmpPath: string,
  finalPath?: string,
  options?: { maxBytes?: number; allowedContentTypes?: readonly string[] },
): Promise<FinalizedUpload> {
  const allowed = options?.allowedContentTypes ?? DEFAULT_ALLOWED_CONTENT_TYPES;
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES;

  if (!isTmpPath(tmpPath)) {
    throw new UploadRejectedError(`"${tmpPath}" is not a quarantined upload path`);
  }

  // `promoteTmpPath` re-validates: the path made a round trip through the
  // client, so it is untrusted input again by the time it comes back.
  const destination = finalPath ?? promoteTmpPath(tmpPath);
  if (parseObjectPath(destination) === null) {
    throw new UploadRejectedError(`"${destination}" is not a well-formed object path`);
  }

  const bucket = getBucket();
  const source = bucket.file(tmpPath);

  const [exists] = await source.exists();
  if (!exists) {
    throw new UploadRejectedError(
      `no object at ${tmpPath}; the upload did not complete, or it was already finalized`,
    );
  }

  const [metadata] = await source.getMetadata();
  const contentType = metadata.contentType ?? '';
  const sizeBytes = Number(metadata.size ?? 0);

  try {
    assertAllowedContentType(contentType, allowed);
    assertWithinSizeLimit(sizeBytes, maxBytes);
  } catch (error) {
    // A rejected upload is deleted immediately rather than left for the
    // lifecycle rule: it is known-bad now, and the bucket is not a quarantine
    // to keep things in.
    await source.delete({ ignoreNotFound: true });
    logger.warn('Rejected upload deleted', {
      path: tmpPath,
      contentType,
      sizeBytes,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  await source.move(destination);
  logger.info('Upload finalized', { path: destination, contentType, sizeBytes });

  return { path: destination, contentType, sizeBytes };
}

/**
 * Issues a V4 signed GET URL for a private object.
 *
 * The bucket enforces public access prevention, so this is the only way a
 * browser reads an object. Keep the TTL short and generate a fresh URL per
 * render rather than storing one — a stored signed URL is a credential with a
 * deadline, and it will be shared.
 *
 * @param path   Object path, `<collection>/<docId>/<filename>`.
 * @param ttlMs  Lifetime in milliseconds. Defaults to 15 minutes.
 */
export async function createSignedReadUrl(path: string, ttlMs = READ_URL_TTL_MS): Promise<string> {
  if (parseObjectPath(path) === null) {
    throw new UploadRejectedError(`"${path}" is not a well-formed object path`);
  }

  try {
    const [url] = await getBucket()
      .file(path)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + ttlMs,
      });
    return url;
  } catch (error) {
    logger.error('Failed to sign read URL', error, { path });
    throw error;
  }
}

/**
 * Deletes an object. Succeeds when the object is already gone, so a retried
 * cleanup does not fail a request that has otherwise finished.
 */
export async function deleteObject(path: string): Promise<void> {
  if (parseObjectPath(path) === null && !isTmpPath(path)) {
    throw new UploadRejectedError(`"${path}" is not a well-formed object path`);
  }

  try {
    await getBucket().file(path).delete({ ignoreNotFound: true });
    logger.info('Object deleted', { path });
  } catch (error) {
    logger.error('Failed to delete object', error, { path });
    throw error;
  }
}

/**
 * Returns the permanent path an object will occupy. Exported so a caller can
 * store the path on a document before the upload is finalized.
 */
export function objectPathFor(parts: ObjectPathParts): string {
  return buildObjectPath({ ...parts, filename: sanitiseFilename(parts.filename) });
}
