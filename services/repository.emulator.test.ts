// @vitest-environment node

import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  createRepository,
  DEFAULT_PAGE_SIZE,
  DocumentNotFoundError,
  DocumentValidationError,
  MAX_PAGE_SIZE,
  type Repository,
  UnboundedQueryError,
} from '@/services/repository';

/**
 * Repository tests against the real Firestore emulator.
 *
 * They SKIP when `FIRESTORE_EMULATOR_HOST` is unset, which keeps `pnpm test`
 * — and therefore `pnpm validate` — green on a clean checkout with nothing
 * installed but npm packages. Run them for real with:
 *
 *     pnpm test:emulator
 *
 * CI runs the same script in its own job. A skipped suite that nobody ever runs
 * is worse than no suite, so the job is not optional there.
 *
 * Why an emulator rather than mocks: the behaviour worth testing is Firestore's,
 * not ours. Whether `update` rejects a missing document, whether a cursor is
 * stable across a page boundary, whether `serverTimestamp` resolves before the
 * next read — a mock would answer those the way the author expected, which is
 * exactly the assumption that needs checking.
 */

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? '';
const describeEmulator = emulatorHost === '' ? describe.skip : describe;

const noteSchema = z.object({
  title: z.string().min(1).max(100),
  ownerId: z.string().min(1),
  priority: z.number().int().min(0).max(10),
});

type Note = z.infer<typeof noteSchema>;

describeEmulator('createRepository (emulator)', () => {
  let firestore: Firestore;
  let notes: Repository<Note>;
  let collection: string;

  beforeAll(() => {
    firestore = new Firestore({ projectId: 'demo-template', databaseId: '(default)' });
    // A fresh collection per run, so a crashed earlier run cannot make this one
    // fail with data it did not write.
    collection = `notes_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    notes = createRepository({ collection, schema: noteSchema, firestore });
  });

  afterAll(async () => {
    const snapshot = await firestore.collection(collection).get();
    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
    await firestore.terminate();
  });

  async function seed(count: number, ownerId = 'owner-a'): Promise<string[]> {
    const ids: string[] = [];
    for (let index = 0; index < count; index += 1) {
      // Sequential rather than parallel so `createdAt` ordering is deterministic.
      ids.push(await notes.create({ title: `note ${index}`, ownerId, priority: index % 11 }));
    }
    return ids;
  }

  describe('create and get', () => {
    it('stores a document and reads it back with server timestamps', async () => {
      const id = await notes.create({ title: 'first', ownerId: 'owner-a', priority: 3 });
      const found = await notes.getOrThrow(id);

      expect(found.id).toBe(id);
      expect(found.title).toBe('first');
      expect(found.priority).toBe(3);
      expect(found.deletedAt).toBeNull();
      expect(found.createdAt).toBeInstanceOf(Date);
      expect(found.createdAt.getTime()).toBeGreaterThan(0);
      expect(found.updatedAt.getTime()).toBeGreaterThan(0);
    });

    it('generates ids that are not sequential or time-ordered', async () => {
      const ids = await seed(5, 'owner-hotspot');
      const sorted = [...ids].sort();
      // Auto ids are random, so insertion order and lexical order agreeing for
      // five documents would be a 1-in-120 coincidence — and a red flag that
      // someone swapped in timestamp-prefixed ids, which hotspot on write.
      expect(ids).not.toEqual(sorted);
    });

    it('rejects a payload that fails the schema', async () => {
      await expect(notes.create({ title: '', ownerId: 'owner-a', priority: 3 })).rejects.toThrow(
        DocumentValidationError,
      );
      await expect(notes.create({ title: 'ok', ownerId: 'owner-a', priority: 99 })).rejects.toThrow(
        DocumentValidationError,
      );
    });

    it('returns null for a missing document and throws from getOrThrow', async () => {
      expect(await notes.get('does-not-exist')).toBeNull();
      await expect(notes.getOrThrow('does-not-exist')).rejects.toThrow(DocumentNotFoundError);
    });
  });

  describe('update', () => {
    it('merges a partial patch and advances updatedAt', async () => {
      const id = await notes.create({ title: 'before', ownerId: 'owner-a', priority: 1 });
      const original = await notes.getOrThrow(id);

      await notes.update(id, { title: 'after' });
      const updated = await notes.getOrThrow(id);

      expect(updated.title).toBe('after');
      expect(updated.ownerId).toBe('owner-a');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(original.updatedAt.getTime());
      expect(updated.createdAt.getTime()).toBe(original.createdAt.getTime());
    });

    it('rejects a patch touching a repository-owned field', async () => {
      const id = await notes.create({ title: 'x', ownerId: 'owner-a', priority: 1 });
      const hostile = { createdAt: new Date(0) } as unknown as Partial<Note>;
      await expect(notes.update(id, hostile)).rejects.toThrow(DocumentValidationError);
    });

    it('rejects a patch containing a field the schema does not declare', async () => {
      // `create` is protected by zod stripping unknown keys. `update` cannot be,
      // because a partial patch has no parsed output — so the key is checked
      // against the schema's shape. Without it the field would be written and
      // then silently stripped on every read.
      const id = await notes.create({ title: 'x', ownerId: 'owner-a', priority: 1 });
      const hostile = { notAField: 'oops' } as unknown as Partial<Note>;
      await expect(notes.update(id, hostile)).rejects.toThrow(/notAField/);

      const stored = await notes.getOrThrow(id);
      expect(stored).not.toHaveProperty('notAField');
    });

    it('rejects an empty patch', async () => {
      const id = await notes.create({ title: 'x', ownerId: 'owner-a', priority: 1 });
      await expect(notes.update(id, {})).rejects.toThrow(DocumentValidationError);
    });

    it('rejects a patch that fails the schema', async () => {
      const id = await notes.create({ title: 'x', ownerId: 'owner-a', priority: 1 });
      await expect(notes.update(id, { priority: 50 })).rejects.toThrow(DocumentValidationError);
    });

    it('fails rather than resurrecting a document that is gone', async () => {
      await expect(notes.update('does-not-exist', { title: 'y' })).rejects.toThrow();
    });
  });

  describe('soft delete', () => {
    it('hides the document from reads but keeps it recoverable', async () => {
      const id = await notes.create({ title: 'doomed', ownerId: 'owner-soft', priority: 1 });

      await notes.softDelete(id);
      expect(await notes.get(id)).toBeNull();

      const withDeleted = await notes.get(id, { includeDeleted: true });
      expect(withDeleted?.deletedAt).toBeInstanceOf(Date);

      await notes.restore(id);
      const restored = await notes.getOrThrow(id);
      expect(restored.deletedAt).toBeNull();
      expect(restored.title).toBe('doomed');
    });

    it('excludes soft-deleted documents from list and count', async () => {
      const owner = `owner-${Math.random().toString(36).slice(2)}`;
      const ids = await seed(3, owner);
      await notes.softDelete(ids[0] as string);

      const page = await notes.list({ limit: 10, where: [['ownerId', '==', owner]] });
      expect(page.items).toHaveLength(2);

      expect(await notes.count({ where: [['ownerId', '==', owner]] })).toBe(2);
      expect(await notes.count({ where: [['ownerId', '==', owner]], includeDeleted: true })).toBe(
        3,
      );
    });
  });

  describe('list', () => {
    it('refuses an unbounded or oversized query', async () => {
      await expect(notes.list({ limit: 0 })).rejects.toThrow(UnboundedQueryError);
      await expect(notes.list({ limit: -1 })).rejects.toThrow(UnboundedQueryError);
      await expect(notes.list({ limit: 1.5 })).rejects.toThrow(UnboundedQueryError);
      await expect(notes.list({ limit: MAX_PAGE_SIZE + 1 })).rejects.toThrow(UnboundedQueryError);
    });

    it('walks every document exactly once across cursor pages', async () => {
      const owner = `owner-${Math.random().toString(36).slice(2)}`;
      const created = await seed(7, owner);

      const seen: string[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < 10; page += 1) {
        const result = await notes.list({
          limit: 3,
          cursor,
          where: [['ownerId', '==', owner]],
        });
        seen.push(...result.items.map((item) => item.id));
        if (result.nextCursor === null) break;
        cursor = result.nextCursor;
      }

      expect(seen).toHaveLength(created.length);
      expect(new Set(seen).size).toBe(created.length);
      expect([...seen].sort()).toEqual([...created].sort());
    });

    it('reports no next cursor on the final page', async () => {
      const owner = `owner-${Math.random().toString(36).slice(2)}`;
      await seed(2, owner);
      const page = await notes.list({ limit: 10, where: [['ownerId', '==', owner]] });
      expect(page.nextCursor).toBeNull();
    });

    it('rejects a cursor that does not resolve', async () => {
      await expect(notes.list({ limit: 5, cursor: 'nope' })).rejects.toThrow(UnboundedQueryError);
    });

    it('orders newest first by default', async () => {
      const owner = `owner-${Math.random().toString(36).slice(2)}`;
      await seed(3, owner);
      const page = await notes.list({ limit: 10, where: [['ownerId', '==', owner]] });
      const titles = page.items.map((item) => item.title);
      expect(titles).toEqual(['note 2', 'note 1', 'note 0']);
    });
  });

  describe('count', () => {
    it('aggregates without reading the documents', async () => {
      const owner = `owner-${Math.random().toString(36).slice(2)}`;
      await seed(4, owner);
      expect(await notes.count({ where: [['ownerId', '==', owner]] })).toBe(4);
    });
  });

  describe('runTransaction', () => {
    it('commits reads and writes atomically', async () => {
      const id = await notes.create({ title: 'tx', ownerId: 'owner-tx', priority: 1 });

      const result = await notes.runTransaction(async (repo) => {
        const current = await repo.get(id);
        repo.update(id, { priority: (current?.priority ?? 0) + 5 });
        return current?.title;
      });

      expect(result).toBe('tx');
      expect((await notes.getOrThrow(id)).priority).toBe(6);
    });

    it('rolls everything back when the callback throws', async () => {
      const id = await notes.create({ title: 'rollback', ownerId: 'owner-tx', priority: 1 });

      await expect(
        notes.runTransaction(async (repo) => {
          repo.update(id, { priority: 9 });
          await Promise.resolve();
          throw new Error('abort');
        }),
      ).rejects.toThrow('abort');

      expect((await notes.getOrThrow(id)).priority).toBe(1);
    });
  });

  describe('batchWrite', () => {
    it('commits several writes together', async () => {
      const owner = `owner-${Math.random().toString(36).slice(2)}`;
      const ids: string[] = [];

      await notes.batchWrite((repo) => {
        for (let index = 0; index < 3; index += 1) {
          ids.push(repo.create({ title: `batch ${index}`, ownerId: owner, priority: index }));
        }
      });

      expect(await notes.count({ where: [['ownerId', '==', owner]] })).toBe(3);
      for (const id of ids) {
        expect(await notes.get(id)).not.toBeNull();
      }
    });

    it('refuses more than the Firestore batch limit', async () => {
      await expect(
        notes.batchWrite((repo) => {
          for (let index = 0; index < 501; index += 1) {
            repo.create({ title: `over ${index}`, ownerId: 'owner-over', priority: 0 });
          }
        }),
      ).rejects.toThrow(UnboundedQueryError);
    });

    it('commits nothing when no operation is queued', async () => {
      await expect(notes.batchWrite(() => {})).resolves.toBeUndefined();
    });
  });

  describe('schema enforcement on read', () => {
    it('raises rather than returning a document written outside the schema', async () => {
      // Written with the raw client, as a console edit or an older build would.
      const ref = firestore.collection(collection).doc();
      await ref.set({
        title: 'legacy',
        ownerId: 'owner-legacy',
        priority: 'high',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      await expect(notes.get(ref.id)).rejects.toThrow(DocumentValidationError);
    });
  });

  it('exposes a sane default page size', () => {
    expect(DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(MAX_PAGE_SIZE);
  });
});
