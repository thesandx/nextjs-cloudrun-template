// @vitest-environment node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * Guards cloud/storage-cors.json, the bucket CORS that lets a browser upload.
 *
 * Every browser upload is a PUT from the app's origin to a signed URL on
 * storage.googleapis.com. The bucket refuses that preflight unless it lists
 * the origin, and the upload then fails with no server log at all. The
 * bootstrap applies this file and the deploy checks the live bucket against
 * it. This test checks the file itself, and that both still read it.
 *
 * Nothing here talks to Google Cloud. The Node environment is required: under
 * jsdom `import.meta.url` is not a file URL.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string): string => readFileSync(`${root}${path}`, 'utf8');

const corsRule = z.object({
  origin: z.array(z.string()),
  method: z.array(z.string()).min(1),
  responseHeader: z.array(z.string()),
  maxAgeSeconds: z.number().int().positive(),
});

const rules = z
  .array(corsRule)
  .min(1)
  .parse(JSON.parse(read('cloud/storage-cors.json')));

describe('cloud/storage-cors.json', () => {
  const origins = rules.flatMap((rule) => rule.origin);

  it('lists exact https origins only: no wildcard, path, trailing slash or localhost', () => {
    // localhost belongs on the dev bucket, which the bootstrap adds by itself.
    for (const origin of origins) {
      expect(origin).toMatch(/^https:\/\/[a-z0-9.-]+(:\d+)?$/);
      expect(origin).not.toContain('localhost');
    }
  });

  it('allows the PUT and the headers the signed upload sends', () => {
    // The headers services/storage.service.ts signs into the upload URL. The
    // browser sends both, so the preflight asks for both.
    const service = read('services/storage.service.ts');
    expect(service).toContain("'x-goog-content-length-range'");
    expect(service).toContain("'Content-Type'");

    for (const rule of rules) {
      expect(rule.method).toContain('PUT');
      expect(rule.responseHeader).toEqual(
        expect.arrayContaining(['Content-Type', 'x-goog-content-length-range']),
      );
    }
  });
});

describe('the scripts that use it', () => {
  it('the bootstrap applies the origins in the file', () => {
    const bootstrap = read('scripts/gcp-bootstrap.sh');
    expect(bootstrap).toContain('cloud/storage-cors.json');
    expect(bootstrap).toMatch(/jq -r '\.\[\]\.origin\[\]' "\$CORS_CONFIG"/);
  });

  it('the deploy checks the live bucket against the file', () => {
    const deploy = read('.github/workflows/deploy.yml');
    expect(deploy).toContain("jq -r '.[].origin[]' cloud/storage-cors.json");
    expect(deploy).toContain("Access-Control-Request-Method: PUT'");
  });
});
