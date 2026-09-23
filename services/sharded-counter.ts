import 'server-only';

import { FieldValue } from '@google-cloud/firestore';

import { getFirestore } from '@/services/firestore.client';

/**
 * A counter that survives more than one write per second.
 *
 * The constraint this works around: Firestore guarantees roughly **one
 * sustained write per second to a single document**. A `likes` field on a post
 * is the textbook way to hit that ceiling — the feature works perfectly in
 * testing and starts returning contention errors the day the post is popular.
 *
 * The fix is to spread the writes. The counter becomes N documents; an
 * increment picks one at random; a read sums all N. Write throughput becomes
 * N writes/second, and a read costs N document reads instead of one.
 *
 * Pick N from the write rate you expect, not from the rate you have:
 *
 * | Peak writes/sec | Shards |
 * | --------------- | ------ |
 * | < 1             | none — use a plain field |
 * | ~10             | 10     |
 * | ~100            | 100    |
 *
 * Do not reach for this by default. A counter that is written once per user
 * action on a small collection is a plain field, and a plain field is one read
 * instead of N. Reach for it when a single document is the write target for
 * many users at once.
 *
 * For a total that may be computed on demand rather than maintained, prefer an
 * aggregation query — `repository.count()` — which reads no documents at all.
 *
 * Layout:
 *
 * ```
 *   <parentPath>/<counterId>/shards/0   { count: 41 }
 *   <parentPath>/<counterId>/shards/1   { count: 39 }
 *   ...
 * ```
 */

/** Sensible default for a counter under moderate contention. */
export const DEFAULT_SHARD_COUNT = 10;

const SHARDS_SUBCOLLECTION = 'shards';

export interface ShardedCounterOptions {
  /**
   * Document that owns the counter, e.g. `posts/abc123`. The shards live in a
   * subcollection beneath it, so they travel with the document and are deleted
   * with it.
   */
  documentPath: string;
  /** Name of the counter, e.g. `views`. One document may own several. */
  counterId: string;
  /** Number of shards. Must not change once writes have started — see `read`. */
  shards?: number;
}

function shardCollection(options: ShardedCounterOptions): FirebaseFirestore.CollectionReference {
  return getFirestore()
    .doc(options.documentPath)
    .collection(`${options.counterId}_${SHARDS_SUBCOLLECTION}`);
}

/**
 * Adds `by` to the counter.
 *
 * Uses `FieldValue.increment`, which is applied server-side: no read, no
 * transaction, and no lost update when two requests land in the same
 * millisecond. `set(..., { merge: true })` creates the shard on first use.
 */
export async function incrementCounter(options: ShardedCounterOptions, by = 1): Promise<void> {
  const shards = options.shards ?? DEFAULT_SHARD_COUNT;
  const shardId = String(Math.floor(Math.random() * shards));

  await shardCollection(options)
    .doc(shardId)
    .set({ count: FieldValue.increment(by) }, { merge: true });
}

/**
 * Returns the counter's total.
 *
 * Costs one read per shard that has been written at least once. Reducing the
 * shard count later does not lose data — the extra shards still exist and are
 * still summed here — but it does mean increments stop landing on them, so the
 * total goes stale rather than wrong. Increasing it is always safe.
 */
export async function readCounter(options: ShardedCounterOptions): Promise<number> {
  const snapshot = await shardCollection(options).get();

  return snapshot.docs.reduce((total, doc) => {
    const value = doc.data().count;
    return total + (typeof value === 'number' ? value : 0);
  }, 0);
}
