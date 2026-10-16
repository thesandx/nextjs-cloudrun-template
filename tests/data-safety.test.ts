// @vitest-environment node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

/**
 * Guards the controls that keep production data recoverable.
 *
 * Each one is a single line that an agent can delete while "tidying up", with
 * no other test turning red. These tests make that removal a failing build.
 * See docs/data-recovery.md.
 *
 * Nothing here talks to Google Cloud. The Node environment is required: under
 * jsdom `import.meta.url` is not a file URL.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const eslint = new ESLint({ cwd: root });

/** The data-safety findings for `code`, linted as if it lived at `filePath`. */
async function permanentDeletes(code: string, filePath: string): Promise<number[]> {
  const [result] = await eslint.lintText(code, { filePath: `${root}${filePath}` });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === 'data-safety/no-permanent-delete')
    .map((message) => message.line);
}

describe('the no-permanent-delete lint rule', () => {
  const code = [
    'export async function run(db: any, repo: any, batch: any, map: Map<string, number>) {',
    "  await repo.hardDelete('a');",
    "  await db.collection('x').doc('a').delete();",
    "  batch.delete(db.collection('x').doc('a'));",
    "  await db.recursiveDelete(db.collection('x'));",
    "  map.delete('a');",
    "  await repo.softDelete('a');",
    '}',
  ].join('\n');

  it('refuses every permanent Firestore delete in application code', async () => {
    expect(await permanentDeletes(code, 'app/api/probe/route.ts')).toEqual([2, 3, 4, 5]);
    expect(await permanentDeletes(code, 'services/probe.service.ts')).toEqual([2, 3, 4, 5]);
  }, 30_000);

  it('allows the repository, which defines the primitives, and tests', async () => {
    expect(await permanentDeletes(code, 'services/repository.ts')).toEqual([]);
    expect(await permanentDeletes(code, 'services/probe.test.ts')).toEqual([]);
  }, 30_000);
});

describe('gcp-bootstrap.sh', () => {
  const bootstrap = readFileSync(`${root}scripts/gcp-bootstrap.sh`, 'utf8');

  it('turns on delete protection for the database', () => {
    expect(bootstrap).toMatch(/databases update[^\n]*\\\n(\s+--[^\n]*\\\n)*\s+--delete-protection/);
  });

  it('turns on point-in-time recovery', () => {
    expect(bootstrap).toContain('--enable-pitr');
  });

  it('creates a daily backup schedule', () => {
    expect(bootstrap).toMatch(/backups schedules create[\s\S]*?--recurrence=daily/);
  });

  it('gives the bucket a soft-delete window', () => {
    expect(bootstrap).toMatch(/--soft-delete-duration=\d+d/);
  });
});
