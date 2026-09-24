// @vitest-environment node

import { GeoPoint, Timestamp } from '@google-cloud/firestore';
import { describe, expect, it } from 'vitest';

import { timestampsToDates } from '@/services/repository';

/**
 * Firestore returns a `Timestamp` for a date field, never a `Date`. Without
 * this conversion a schema declaring `z.date()` fails on read for data that
 * was written correctly — which is exactly what happened to `users`'
 * `lastSignInAt` the first time a collection declared a date of its own.
 */
describe('timestampsToDates', () => {
  const instant = new Date('2026-09-24T10:00:00.000Z');
  const stamp = Timestamp.fromDate(instant);

  it('converts a top-level Timestamp', () => {
    const result = timestampsToDates({ lastSignInAt: stamp }) as { lastSignInAt: unknown };
    expect(result.lastSignInAt).toBeInstanceOf(Date);
    expect(result.lastSignInAt).toEqual(instant);
  });

  it('converts a Timestamp nested in a plain object', () => {
    const result = timestampsToDates({ meta: { seenAt: stamp } }) as {
      meta: { seenAt: unknown };
    };
    expect(result.meta.seenAt).toEqual(instant);
  });

  it('converts Timestamps inside an array', () => {
    const result = timestampsToDates([stamp, stamp]) as unknown[];
    expect(result).toEqual([instant, instant]);
  });

  it('converts Timestamps inside objects inside arrays', () => {
    const result = timestampsToDates({ events: [{ at: stamp }] }) as {
      events: { at: unknown }[];
    };
    expect(result.events[0]?.at).toEqual(instant);
  });

  it('leaves every other scalar alone', () => {
    const payload = {
      title: 'Hello',
      count: 3,
      enabled: true,
      missing: null,
      absent: undefined,
    };
    expect(timestampsToDates(payload)).toEqual(payload);
  });

  it('leaves a Date alone', () => {
    // The write path passes real Dates through this shape in tests.
    expect(timestampsToDates(instant)).toBe(instant);
  });

  it('does NOT rebuild a class instance', () => {
    // The bug this guards against: rebuilding a GeoPoint from its entries
    // returns a plain object, and every later read of it breaks.
    const point = new GeoPoint(19.076, 72.8777);
    const result = timestampsToDates({ where: point }) as { where: unknown };

    expect(result.where).toBeInstanceOf(GeoPoint);
    expect(result.where).toBe(point);
  });

  it('does not mutate its input', () => {
    const payload = { lastSignInAt: stamp };
    timestampsToDates(payload);
    expect(payload.lastSignInAt).toBeInstanceOf(Timestamp);
  });
});
