// @vitest-environment node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Guards the one IAM binding that two scripts must agree on.
 *
 * `roles/datastore.indexAdmin` is granted to the DEPLOYER service account,
 * which is one account per project — `github-deployer@…`, with no app slug in
 * it — and therefore shared by every app bootstrapped into that project. The
 * grant is made once per app, each binding conditioned on that app's own
 * database.
 *
 * So the removal in `gcp-teardown.sh` has to name a condition. `--all` would
 * ignore conditions and take every app's binding with it, and the damage is
 * silent: the other apps keep running until their next deploy fails at "Deploy
 * Firestore rules and indexes", on a role nobody edited.
 *
 * gcloud matches a binding by its whole condition, so the two strings must be
 * identical. A difference does not error — it matches nothing, removes nothing,
 * and reports nothing. These tests are the mechanical diff, because reading the
 * two strings side by side is exactly the check a human eye fails.
 *
 * Nothing here talks to Google Cloud. It reads the scripts as text. The Node
 * environment is required: under jsdom `import.meta.url` is not a file URL, so
 * resolving a path from it throws.
 */

const scriptsDirectory = fileURLToPath(new URL('.', import.meta.url));

function readScript(name: string): string {
  return readFileSync(`${scriptsDirectory}${name}`, 'utf8');
}

const bootstrap = readScript('gcp-bootstrap.sh');
const teardown = readScript('gcp-teardown.sh');

/** The `--condition=` value on the grant of `role`, unexpanded. */
function grantedCondition(script: string, role: string): string {
  const grant = new RegExp(
    `--role="${role.replace('.', '\\.')}"\\s*\\\\\\s*\\n\\s*--condition="([^"]*)"`,
  ).exec(script);
  expect(grant, `no conditioned grant of ${role} found`).not.toBeNull();
  return grant?.[1] ?? '';
}

/** The value of a top-level `NAME="…"` assignment, unexpanded. */
function assignment(script: string, name: string): string {
  const declared = new RegExp(`^${name}="([^"]*)"`, 'm').exec(script);
  expect(declared, `no assignment of ${name} found`).not.toBeNull();
  return declared?.[1] ?? '';
}

describe('datastore.indexAdmin on the shared deployer', () => {
  it('is removed by condition, never with --all', () => {
    // The regression this file exists for. Anchored to the deployer's member,
    // so it cannot be satisfied by the runtime account's removals — those use
    // --all correctly, because that account is per-app.
    const removal =
      /--member="serviceAccount:\$\{DEPLOYER_SA\}"\s*\\\s*\n\s*--role="roles\/datastore\.indexAdmin"\s*\\\s*\n\s*(--[a-z-]+)/.exec(
        teardown,
      );

    expect(removal, 'no indexAdmin removal found for the deployer').not.toBeNull();
    expect(removal?.[1]).toBe('--condition');
  });

  it('is removed with the exact condition it was granted with', () => {
    expect(assignment(teardown, 'INDEX_ADMIN_CONDITION')).toBe(
      grantedCondition(bootstrap, 'roles/datastore.indexAdmin'),
    );
  });

  it('expands that condition the same way in both scripts', () => {
    // The strings above match textually, which only means something if the
    // variables inside them hold the same values. Both read DATABASE_RESOURCE.
    expect(assignment(teardown, 'DATABASE_RESOURCE')).toBe(
      assignment(bootstrap, 'DATABASE_RESOURCE'),
    );
    expect(assignment(teardown, 'DATABASE_ID')).toBe(assignment(bootstrap, 'DATABASE_ID'));
  });
});
