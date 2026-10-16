// @vitest-environment node

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Runs `firestore-deploy.sh` against fake `gcloud` and `curl` commands.
 *
 * Both behaviours tested here only show on the FIRST deploy into a new
 * project, which no CI job runs, because PR validation has no cloud
 * credentials:
 *
 *   - Without `--async`, gcloud waits for each index operation. On a new
 *     database they queue, and one wait held a deploy for 30 minutes until
 *     the job timed out.
 *   - The Rules API takes a release wrapped as `{"release": {...}}`, and PATCH
 *     never creates one. A bare body is HTTP 400; a first deploy is HTTP 404.
 *
 * The fakes record every call to a log, and answer from environment
 * variables the test sets. Nothing here talks to Google Cloud. `jq` must be
 * installed, as it is on the CI runner.
 */

const scriptsDirectory = fileURLToPath(new URL('.', import.meta.url));
const script = join(scriptsDirectory, 'firestore-deploy.sh');

const FAKE_GCLOUD = `#!/usr/bin/env bash
printf 'gcloud %s\\n' "$*" >> "$CALL_LOG"
inherited='{"indexConfig":{"usesAncestorConfig":true}}'
case "$*" in
  *"operations list"*)        printf '%s' "\${FAKE_OPERATIONS:-[]}" ;;
  *"indexes fields describe"*) printf '%s' "\${FAKE_FIELD:-$inherited}" ;;
  *"auth print-access-token"*) echo token ;;
esac
exit 0
`;

/** Answers PATCH with FAKE_PATCH_STATUS and POST with 200. Logs the method and body. */
const FAKE_CURL = `#!/usr/bin/env bash
method=GET; body=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    -X) method="$2"; shift 2 ;;
    -d) body="$2"; shift 2 ;;
    *)  shift ;;
  esac
done
printf 'curl %s %s\\n' "$method" "$(jq -c . <<<"\${body:-null}")" >> "$CALL_LOG"
if [[ "$method" == POST && "$body" == *'"source"'* ]]; then
  printf '{"name":"projects/p/rulesets/r1"}\\n200'
elif [[ "$method" == PATCH ]]; then
  printf '{"error":{"message":"fake"}}\\n%s' "\${FAKE_PATCH_STATUS:-200}"
else
  printf '{}\\n200'
fi
`;

let directory: string;
let callLog: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'firestore-deploy-'));
  callLog = join(directory, 'calls.log');
  writeFileSync(callLog, '');
  for (const [name, body] of [
    ['gcloud', FAKE_GCLOUD],
    ['curl', FAKE_CURL],
  ] as const) {
    writeFileSync(join(directory, name), body);
    chmodSync(join(directory, name), 0o755);
  }
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

/** Runs the script with the fakes first on PATH. Returns the logged calls. */
function deploy(environment: Record<string, string> = {}, ...extra: string[]): string[] {
  execFileSync('bash', [script, '--project', 'p', '--database', 'd', ...extra], {
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH ?? ''}`,
      CALL_LOG: callLog,
      ...environment,
    },
    stdio: 'pipe',
  });
  return readFileSync(callLog, 'utf8').trim().split('\n');
}

const fieldUpdates = (calls: string[]): string[] =>
  calls.filter((call) => call.includes('indexes fields update'));

describe('firestore-deploy.sh never waits for an index build', () => {
  it('creates every composite index with --async', () => {
    const creates = deploy({}, '--indexes-only').filter((call) =>
      call.includes('indexes composite create'),
    );
    expect(creates.length).toBeGreaterThan(0);
    for (const call of creates) expect(call).toContain('--async');
  });

  it('sends every field exemption with --async', () => {
    const updates = fieldUpdates(deploy({}, '--indexes-only'));
    expect(updates.length).toBeGreaterThan(0);
    for (const call of updates) expect(call).toContain('--async');
  });

  it('skips a field that is already exempt', () => {
    const calls = deploy(
      { FAKE_FIELD: '{"indexConfig":{"usesAncestorConfig":false}}' },
      '--indexes-only',
    );
    expect(fieldUpdates(calls)).toEqual([]);
  });

  it('skips a field whose exemption is still in progress', () => {
    const pending = JSON.stringify([
      { metadata: { field: 'projects/p/databases/d/collectionGroups/users/fields/updatedAt' } },
      {
        done: true,
        metadata: { field: 'projects/p/databases/d/collectionGroups/examples/fields/updatedAt' },
      },
    ]);
    const updated = fieldUpdates(deploy({ FAKE_OPERATIONS: pending }, '--indexes-only')).map(
      (call) => `${/--collection-group=(\S+)/.exec(call)?.[1]}.${/update (\S+)/.exec(call)?.[1]}`,
    );
    // The finished operation does not block its field; the running one does.
    expect(updated).toContain('examples.updatedAt');
    expect(updated).not.toContain('users.updatedAt');
  });
});

describe('firestore-deploy.sh releases the rules', () => {
  const releaseCalls = (calls: string[]): string[] =>
    calls.filter((call) => call.startsWith('curl') && call.includes('rulesetName'));

  it('wraps the release for PATCH', () => {
    const [patch] = releaseCalls(deploy({}, '--rules-only'));
    expect(patch).toMatch(/^curl PATCH /);
    const body: unknown = JSON.parse(patch?.replace(/^curl PATCH /, '') ?? '');
    expect(body).toEqual({
      release: {
        name: 'projects/p/releases/cloud.firestore/d',
        rulesetName: 'projects/p/rulesets/r1',
      },
    });
  });

  it('creates the release with POST when PATCH finds none', () => {
    const calls = releaseCalls(deploy({ FAKE_PATCH_STATUS: '404' }, '--rules-only'));
    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatch(/^curl POST /);
    const body: unknown = JSON.parse(calls[1]?.replace(/^curl POST /, '') ?? '');
    expect(body).toEqual({
      name: 'projects/p/releases/cloud.firestore/d',
      rulesetName: 'projects/p/rulesets/r1',
    });
  });
});

describe('gcp-bootstrap.sh', () => {
  const bootstrap = readFileSync(join(scriptsDirectory, 'gcp-bootstrap.sh'), 'utf8');

  it('starts the index builds once the database exists', () => {
    const created = bootstrap.indexOf('gcloud firestore databases create');
    const started = bootstrap.search(/firestore-deploy\.sh"[^\n]*\\\n[^\n]*--indexes-only/);
    expect(created).toBeGreaterThan(-1);
    expect(started).toBeGreaterThan(created);
  });
});
