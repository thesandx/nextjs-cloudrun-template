import 'server-only';

import { z } from 'zod';

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
   * Denormalised on purpose. This is a NoSQL collection: the list view needs
   * an owner's display name, and joining to fetch it would cost one read per
   * row. Storing the name costs a fan-out update when it changes, which is
   * rarer than the read. See CLAUDE.md > Firestore data modeling.
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
}): Promise<{ items: ExampleView[]; nextCursor: string | null }> {
  const page = await examples.list({
    limit: options.limit,
    cursor: options.cursor,
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

/** Creates an example. Returns the auto-generated id. */
export async function createExample(input: { title: string; ownerName: string }): Promise<string> {
  return examples.create({
    title: input.title,
    ownerName: input.ownerName,
    imagePath: null,
  });
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
  filename: string;
  contentType: string;
}): Promise<SignedUpload> {
  await examples.getOrThrow(input.exampleId);

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
 */
export async function finalizeExampleImage(input: {
  exampleId: string;
  tmpPath: string;
}): Promise<ExampleDocument> {
  const existing = await examples.getOrThrow(input.exampleId);

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
