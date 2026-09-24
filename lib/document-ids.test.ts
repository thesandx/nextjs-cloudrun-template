import { describe, expect, it } from 'vitest';

import {
  assertDistributedId,
  InvalidDocumentIdError,
  MAX_DOCUMENT_ID_BYTES,
  MIN_SUPPLIED_ID_LENGTH,
} from '@/lib/document-ids';

/** A realistic Firebase uid: 28 characters of base62. */
const UID = 'k3Jd8sLpQr2WxYz7Ab1Cd4Ef6Gh9';

describe('assertDistributedId', () => {
  describe('accepts ids that spread across the key range', () => {
    it.each([
      ['a Firebase uid', UID],
      ['a ULID', '01JBQ7Z9KX4M6NP8RSTVWXYZAB'],
      ['a UUID v4', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'],
      ['a random id ending in digits', 'aZ9kQ2mX7vB4nL8pR3tW6yH1'],
      ['a random id starting with digits', '9kQ2mXaZ7vB4nL8pR3tW6yH1'],
    ])('%s', (_label, id) => {
      expect(() => assertDistributedId(id)).not.toThrow();
    });
  });

  describe('rejects Firestore-invalid ids', () => {
    it.each([
      ['empty', '', 'it is empty'],
      ['containing a slash', `users/${UID}`, 'cannot contain "/"'],
      ['a single dot', '.', 'cannot be "." or ".."'],
      ['a double dot', '..', 'cannot be "." or ".."'],
      ['reserved', '__name__', 'reserved by Firestore'],
    ])('%s', (_label, id, fragment) => {
      expect(() => assertDistributedId(id)).toThrow(InvalidDocumentIdError);
      expect(() => assertDistributedId(id)).toThrow(fragment);
    });

    it('over the byte limit', () => {
      const tooLong = 'a'.repeat(MAX_DOCUMENT_ID_BYTES + 1);
      expect(() => assertDistributedId(tooLong)).toThrow(`exceeds ${MAX_DOCUMENT_ID_BYTES} bytes`);
    });

    it('counts bytes, not characters, against the limit', () => {
      // Each emoji is 4 bytes, so this is under the character count and over
      // the byte count — the case a `.length` check would wave through.
      const emoji = '🙂'.repeat(MAX_DOCUMENT_ID_BYTES / 4 + 1);
      expect(emoji.length).toBeLessThan(MAX_DOCUMENT_ID_BYTES);
      expect(() => assertDistributedId(emoji)).toThrow(`exceeds ${MAX_DOCUMENT_ID_BYTES} bytes`);
    });
  });

  describe('rejects hotspot-prone shapes at any length', () => {
    it.each([
      ['date-prefixed', '2026-09-22-a-long-enough-suffix', 'starts with a date'],
      ['all digits', '1234567890123456789', 'it is a number'],
      ['word plus counter', 'user-1', 'sequential id'],
      ['word plus counter, underscored', 'order_000000000042', 'sequential id'],
      ['word plus counter, no separator', 'invoice00000000001', 'sequential id'],
    ])('%s', (_label, id, fragment) => {
      expect(() => assertDistributedId(id)).toThrow(fragment);
    });

    it('is not relaxed by a lower minLength', () => {
      expect(() => assertDistributedId('user-1', { minLength: 1 })).toThrow('sequential id');
    });
  });

  describe('length floor', () => {
    it(`rejects ids under ${MIN_SUPPLIED_ID_LENGTH} characters by default`, () => {
      expect(() => assertDistributedId('acme')).toThrow('shorter than 16 characters');
    });

    it('accepts a short id when the caller lowers the floor deliberately', () => {
      expect(() => assertDistributedId('acme', { minLength: 4 })).not.toThrow();
    });

    it('accepts an id exactly at the floor', () => {
      expect(() => assertDistributedId('aZ9kQ2mX7vB4nL8p')).not.toThrow();
    });
  });

  it('names the offending id in the message', () => {
    expect(() => assertDistributedId('user-1')).toThrow(/"user-1"/);
  });
});
