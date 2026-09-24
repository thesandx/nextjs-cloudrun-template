import 'server-only';

import { z } from 'zod';

import { isTmpPath, parseObjectPath } from '@/lib/storage-paths';
import { ForbiddenError } from '@/services/auth.service';
import { createRepository, type StoredDocument } from '@/services/repository';
import {
  createSignedReadUrl,
  createSignedUploadUrl,
  deleteObject,
  finalizeUpload,
  type SignedUpload,
} from '@/services/storage.service';

/**
 * ============================================================================
 * EXAMPLE — delete this file when the real domain arrives.
 * ============================================================================
 *
 * The smallest complete demonstration of the data layer: a collection, a typed
 * repository, an image upload and a signed read. Copy the shape, not the
 * domain. Nothing else in the template imports it.
 *
 * To remove it, delete:
 *   services/example.service.ts
 *   app/api/example/                (three route handlers)
 *   app/example/                    (the page)
 *   components/example/             (the form)
 * and the `examples` entries in firestore.indexes.json.
 */

/** Collection path. One segment: a top-level collection. */
export const EXAMPLE_COLLECTION = 'examples';

/**
 * The payload schema. It declares the fields the app owns, and NOT `id`,
 * `createdAt`, `updatedAt` or `deletedAt` — the repository maintains those.
 *
 * Note what this schema is doing that a TypeScript interface cannot: it runs.
 * A document written by an older build, or edited in the console, is checked
 * against it on the way out of Firestore.
 */
export const exampleSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),

  /**
   * The Firebase uid of whoever created this, and the field every
   * authorisation check reads. Set from the session on the server — never
   * from the request body, which the caller controls.
   *
   * Indexed with `(ownerId, deletedAt, createdAt)` so "my examples" is one
   * bounded query rather than a scan and a filter.
   */
  ownerId: z.string().trim().min(1).max(128),

  /**
   * Denormalised on purpose. This is a NoSQL collection: the list view needs
   * an owner's display name, and joining to fetch it would cost one read per
   * row. Storing the name costs a fan-out update when it changes, which is
   * rarer than the read. See CLAUDE.md > Firestore data modeling.
   *
   * Copied from the user's profile at creation time, not typed by the caller:
   * a free-text "owner name" next to an authenticated session is an invitation
   * to impersonate somebody.
   */
  ownerName: z.string().trim().min(1).max(120),

  /**
   * Object path of the attached image, or null. The PATH is stored, never a
   * signed URL: a signed URL expires, and a stored one becomes a dead link the
   * moment it does.
   */
  imagePath: z.string().max(512).nullable(),
});

export type ExamplePayload = z.infer<typeof exampleSchema>;
export type ExampleDocument = StoredDocument<ExamplePayload>;

/**
 * The repository. Created at module scope, which opens nothing: the Firestore
 * client is resolved lazily on the first real operation.
 */
export const examples = createRepository({
  collection: EXAMPLE_COLLECTION,
  schema: exampleSchema,
});

/** Images only, and small. Widen per app, deliberately. */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** An example with a freshly signed URL for its image, ready to render. */
export interface ExampleView extends ExampleDocument {
  imageUrl: string | null;
}

/**
 * Lists a bounded page, newest first, and signs a read URL for each image.
 *
 * The signing loop is `Promise.all` over a page that can never exceed
 * `MAX_PAGE_SIZE`, so the fan-out is bounded by construction. That is the
 * pattern to copy: an N+1 over an unbounded list is how a page that is fast
 * with ten rows times out with ten thousand.
 */
export async function listExamples(options: {
  limit: number;
  cursor?: string | undefined;
  /** Restrict to one owner. Served by the `(ownerId, deletedAt, createdAt)` index. */
  ownerId?: string | undefined;
}): Promise<{ items: ExampleView[]; nextCursor: string | null }> {
  const page = await examples.list({
    limit: options.limit,
    cursor: options.cursor,
    ...(options.ownerId !== undefined && {
      where: [['ownerId', '==', options.ownerId] as const],
    }),
    orderBy: [{ field: 'createdAt', direction: 'desc' }],
  });

  const items = await Promise.all(
    page.items.map(async (item) => ({
      ...item,
      imageUrl: item.imagePath === null ? null : await createSignedReadUrl(item.imagePath),
    })),
  );

  return { items, nextCursor: page.nextCursor };
}

/**
 * Creates an example owned by the caller. Returns the auto-generated id.
 *
 * `ownerId` and `ownerName` come from the session and the profile, so neither
 * is anything the request body can influence.
 */
export async function createExample(input: {
  title: string;
  ownerId: string;
  ownerName: string;
}): Promise<string> {
  return examples.create({
    title: input.title,
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    imagePath: null,
  });
}

/**
 * Loads an example and checks the caller owns it.
 *
 * Deliberately throws `DocumentNotFoundError` — a 404 — when the document is
 * missing, and `ForbiddenError` — a 403 — only when it exists and belongs to
 * somebody else. Both are correct here: this is an app where rows are
 * publicly listed, so their existence is not a secret. In an app where it IS
 * a secret, return 404 for both, or a stranger can enumerate ids by watching
 * which ones answer 403.
 */
async function loadOwned(exampleId: string, ownerId: string): Promise<ExampleDocument> {
  const document = await examples.getOrThrow(exampleId);
  if (document.ownerId !== ownerId) {
    throw new ForbiddenError('That example belongs to someone else.');
  }
  return document;
}

/**
 * Issues a signed upload URL for an example's image.
 *
 * The document must exist first, because the object path is namespaced by the
 * document id. That ordering is deliberate: it means an orphaned upload is
 * always traceable to a document, and `tmp/` never accumulates files nobody
 * can attribute.
 */
export async function createExampleImageUpload(input: {
  exampleId: string;
  ownerId: string;
  filename: string;
  contentType: string;
}): Promise<SignedUpload> {
  await loadOwned(input.exampleId, input.ownerId);

  return createSignedUploadUrl({
    path: {
      collection: EXAMPLE_COLLECTION,
      docId: input.exampleId,
      filename: input.filename,
    },
    contentType: input.contentType,
    maxBytes: MAX_IMAGE_BYTES,
    allowedContentTypes: ALLOWED_IMAGE_TYPES,
  });
}

/**
 * Verifies the uploaded object, promotes it out of `tmp/`, and points the
 * document at it.
 *
 * Replacing an image deletes the old object afterwards, not before: if the
 * document update fails, the old object is still there and the record is still
 * valid. Deleting first would leave a document pointing at nothing.
 *
 * ## Why `tmpPath` is checked against `exampleId`
 *
 * Both arrive from the client, in the same request body. Without this check a
 * caller could finalize SOMEBODY ELSE'S pending upload and attach it to their
 * own document: pass their own `exampleId` and a `tmpPath` under another
 * document's prefix, and the object moves out of quarantine and binds to the
 * attacker's row. The owner check above does not catch it, because the
 * attacker really does own the document they named.
 *
 * The path already encodes the document it belongs to, so the check is one
 * comparison — but it has to actually happen.
 */
export async function finalizeExampleImage(input: {
  exampleId: string;
  ownerId: string;
  tmpPath: string;
}): Promise<ExampleDocument> {
  const existing = await loadOwned(input.exampleId, input.ownerId);

  if (!isTmpPath(input.tmpPath)) {
    throw new ForbiddenError('That is not a pending upload.');
  }
  const parts = parseObjectPath(input.tmpPath.slice('tmp/'.length));
  if (
    parts === null ||
    parts.collection !== EXAMPLE_COLLECTION ||
    parts.docId !== input.exampleId
  ) {
    throw new ForbiddenError('That upload does not belong to this example.');
  }

  const finalized = await finalizeUpload(input.tmpPath, undefined, {
    maxBytes: MAX_IMAGE_BYTES,
    allowedContentTypes: ALLOWED_IMAGE_TYPES,
  });

  await examples.update(input.exampleId, { imagePath: finalized.path });

  if (existing.imagePath !== null && existing.imagePath !== finalized.path) {
    await deleteObject(existing.imagePath);
  }

  return examples.getOrThrow(input.exampleId);
}
