import { describe, expect, it } from 'vitest';

import { cn, formatUtc, isError, safeAwait } from '@/lib/utils';

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values so conditionals stay inline', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('returns an empty string when nothing is truthy', () => {
    expect(cn(false, undefined)).toBe('');
  });
});

describe('formatUtc', () => {
  it('formats a Date in UTC', () => {
    expect(formatUtc(new Date('2026-07-21T09:30:00.000Z'))).toBe('2026-07-21 09:30:00 UTC');
  });

  it('accepts an ISO string', () => {
    expect(formatUtc('2026-01-01T00:00:00.000Z')).toBe('2026-01-01 00:00:00 UTC');
  });

  it('does not throw on garbage input', () => {
    expect(formatUtc('not-a-date')).toBe('invalid date');
  });
});

describe('isError', () => {
  it('narrows Error instances', () => {
    expect(isError(new TypeError('boom'))).toBe(true);
  });

  it('rejects error-shaped objects that are not Errors', () => {
    expect(isError({ message: 'boom' })).toBe(false);
  });
});

describe('safeAwait', () => {
  it('returns ok with the resolved value', async () => {
    await expect(safeAwait(Promise.resolve(42))).resolves.toEqual({ ok: true, data: 42 });
  });

  it('captures a rejection instead of throwing', async () => {
    const result = await safeAwait(Promise.reject(new Error('nope')));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('nope');
  });

  it('wraps non-Error rejections', async () => {
    const result = await safeAwait(Promise.reject('a string'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(Error);
  });
});
