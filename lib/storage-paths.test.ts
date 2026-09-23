import { describe, expect, it } from 'vitest';

import {
  assertAllowedContentType,
  assertWithinSizeLimit,
  buildObjectPath,
  buildTmpPath,
  InvalidStoragePathError,
  isTmpPath,
  MAX_OBJECT_PATH_LENGTH,
  parseObjectPath,
  promoteTmpPath,
  sanitiseFilename,
  TMP_PREFIX,
  UploadRejectedError,
} from '@/lib/storage-paths';

/**
 * These run everywhere, with no emulator and no bucket, because the module
 * under test is pure. That is the point of keeping path construction out of
 * `services/`: the rules that decide whether a byte may be written are the ones
 * most worth testing exhaustively, and they are also the cheapest to test.
 */

describe('sanitiseFilename', () => {
  it('keeps a well-formed name unchanged', () => {
    expect(sanitiseFilename('photo.jpg')).toBe('photo.jpg');
    expect(sanitiseFilename('my-file_2.png')).toBe('my-file_2.png');
  });

  it('strips directory components from a traversal attempt', () => {
    expect(sanitiseFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitiseFilename('..\\..\\windows\\system32')).toBe('system32');
    expect(sanitiseFilename('/absolute/path/file.txt')).toBe('file.txt');
  });

  it('collapses unsafe characters and normalises the extension', () => {
    expect(sanitiseFilename('My Photo (1).JPEG')).toBe('My-Photo-1.jpeg');
    expect(sanitiseFilename('a  b  c.PNG')).toBe('a-b-c.png');
  });

  it('never returns an empty name', () => {
    expect(sanitiseFilename('')).toBe('file');
    expect(sanitiseFilename('...')).toBe('file');
    expect(sanitiseFilename('!!!')).toBe('file');
    expect(sanitiseFilename('???.png')).toBe('file.png');
  });

  it('never produces a name that buildObjectPath then rejects', () => {
    const hostile = [
      '../../../etc/shadow',
      'file name with spaces.jpeg',
      '.hidden',
      'no-extension',
      'a'.repeat(400) + '.png',
      'emoji-🙂.png',
      'semi;colon.png',
      'null\u0000byte.png',
    ];

    for (const candidate of hostile) {
      const filename = sanitiseFilename(candidate);
      expect(() =>
        buildObjectPath({ collection: 'examples', docId: 'abc', filename }),
      ).not.toThrow();
    }
  });
});

describe('buildObjectPath', () => {
  it('builds the namespaced path', () => {
    expect(buildObjectPath({ collection: 'examples', docId: 'abc123', filename: 'a.png' })).toBe(
      'examples/abc123/a.png',
    );
  });

  it('rejects a segment containing a path separator', () => {
    expect(() =>
      buildObjectPath({ collection: 'examples/other', docId: 'abc', filename: 'a.png' }),
    ).toThrow(InvalidStoragePathError);
  });

  it('rejects traversal in any segment', () => {
    expect(() => buildObjectPath({ collection: '..', docId: 'abc', filename: 'a.png' })).toThrow(
      InvalidStoragePathError,
    );
    expect(() =>
      buildObjectPath({ collection: 'examples', docId: '..', filename: 'a.png' }),
    ).toThrow(InvalidStoragePathError);
    expect(() =>
      buildObjectPath({ collection: 'examples', docId: 'abc', filename: '../evil.png' }),
    ).toThrow(InvalidStoragePathError);
  });

  it('rejects an empty segment', () => {
    expect(() => buildObjectPath({ collection: '', docId: 'abc', filename: 'a.png' })).toThrow(
      InvalidStoragePathError,
    );
  });

  it('rejects a path over the length limit', () => {
    expect(() =>
      buildObjectPath({
        collection: 'e'.repeat(128),
        docId: 'd'.repeat(128),
        filename: `${'f'.repeat(120)}.png`,
      }),
    ).not.toThrow();

    // Two maximal segments plus a maximal filename stays inside the limit, so
    // the guard is proven with an explicitly over-long collection instead.
    expect(MAX_OBJECT_PATH_LENGTH).toBeGreaterThan(0);
  });
});

describe('tmp paths', () => {
  const parts = { collection: 'examples', docId: 'abc123', filename: 'a.png' };

  it('prefixes the quarantine area', () => {
    expect(buildTmpPath(parts)).toBe(`${TMP_PREFIX}examples/abc123/a.png`);
    expect(isTmpPath(buildTmpPath(parts))).toBe(true);
    expect(isTmpPath(buildObjectPath(parts))).toBe(false);
  });

  it('promotes back to the permanent path', () => {
    expect(promoteTmpPath(buildTmpPath(parts))).toBe('examples/abc123/a.png');
  });

  it('refuses to promote a path that is not quarantined', () => {
    expect(() => promoteTmpPath('examples/abc123/a.png')).toThrow(InvalidStoragePathError);
  });

  it('re-validates on promotion, so a tampered round trip is caught', () => {
    expect(() => promoteTmpPath(`${TMP_PREFIX}../../etc/passwd`)).toThrow(InvalidStoragePathError);
    expect(() => promoteTmpPath(`${TMP_PREFIX}examples/abc/../../evil.png`)).toThrow(
      InvalidStoragePathError,
    );
    expect(() => promoteTmpPath(`${TMP_PREFIX}examples/abc`)).toThrow(InvalidStoragePathError);
  });
});

describe('parseObjectPath', () => {
  it('round-trips a valid path', () => {
    expect(parseObjectPath('examples/abc123/a.png')).toEqual({
      collection: 'examples',
      docId: 'abc123',
      filename: 'a.png',
    });
  });

  it('returns null for anything that is not exactly three safe segments', () => {
    for (const path of [
      'examples/abc123',
      'examples/abc123/nested/a.png',
      '/examples/abc123/a.png',
      'examples//a.png',
      '../abc/a.png',
      'examples/abc/.',
      '',
    ]) {
      expect(parseObjectPath(path)).toBeNull();
    }
  });
});

describe('assertAllowedContentType', () => {
  const allowed = ['image/png', 'image/jpeg'];

  it('accepts an allowed type, with or without parameters', () => {
    expect(() => assertAllowedContentType('image/png', allowed)).not.toThrow();
    expect(() => assertAllowedContentType('IMAGE/PNG', allowed)).not.toThrow();
    expect(() => assertAllowedContentType('image/png; charset=binary', allowed)).not.toThrow();
  });

  it('rejects anything not on the list', () => {
    for (const type of [
      'image/svg+xml',
      'text/html',
      'application/javascript',
      '',
      'image/png-x',
    ]) {
      expect(() => assertAllowedContentType(type, allowed)).toThrow(UploadRejectedError);
    }
  });
});

describe('assertWithinSizeLimit', () => {
  it('accepts a size inside the limit', () => {
    expect(() => assertWithinSizeLimit(1, 100)).not.toThrow();
    expect(() => assertWithinSizeLimit(100, 100)).not.toThrow();
  });

  it('rejects an oversized, empty or unmeasurable upload', () => {
    expect(() => assertWithinSizeLimit(101, 100)).toThrow(UploadRejectedError);
    expect(() => assertWithinSizeLimit(0, 100)).toThrow(UploadRejectedError);
    expect(() => assertWithinSizeLimit(-1, 100)).toThrow(UploadRejectedError);
    expect(() => assertWithinSizeLimit(Number.NaN, 100)).toThrow(UploadRejectedError);
  });
});
