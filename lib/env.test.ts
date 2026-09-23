// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Env } from '@/lib/env';

/**
 * Tests for the startup configuration contract.
 *
 * `lib/env.ts` validates once, at module load, and throws. That is the whole
 * design — a bad value must fail the Cloud Run revision rather than surface as
 * `undefined` inside a request handler three hours later. Testing it therefore
 * means re-importing the module with a different environment each time, which
 * is what `vi.resetModules()` plus a dynamic import buys.
 *
 * Two of these cases guard something a reader would not guess:
 *   - `next build` runs with NODE_ENV=production and imports every route, so
 *     the production requirement must not apply during the build phase;
 *   - the Docker smoke test in .github/workflows/pr-validation.yml boots the
 *     real image with placeholder values. If they stopped satisfying this
 *     contract, CI would fail on an unrelated pull request.
 *
 * The Node environment is required, not a preference. `lib/env.ts` skips the
 * production requirement when `window` is defined, because Next.js replaces a
 * non-`NEXT_PUBLIC_` read with `undefined` in the client bundle. jsdom defines
 * `window`, so under the default environment these tests would assert against
 * the browser path and pass while proving nothing about container startup.
 */

const ORIGINAL_ENV = { ...process.env };

/** Loads a fresh copy of lib/env.ts with exactly the environment given. */
async function loadEnv(overrides: Record<string, string | undefined>): Promise<Env> {
  vi.resetModules();

  for (const key of [
    'NODE_ENV',
    'NEXT_PHASE',
    'APP_SLUG',
    'GCP_PROJECT_ID',
    'GCP_REGION',
    'FIRESTORE_DATABASE_ID',
    'GCS_BUCKET',
    'FIRESTORE_EMULATOR_HOST',
    'HEALTH_DEEP_CHECKS_ENABLED',
    'LOG_LEVEL',
  ]) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) process.env[key] = value;
  }

  // Not named `module`: Next.js lint forbids assigning that identifier.
  const loaded = await import('@/lib/env');
  return loaded.env;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe('data layer configuration', () => {
  it('derives the database id and bucket name from the slug and project', async () => {
    const env = await loadEnv({
      NODE_ENV: 'production',
      APP_SLUG: 'my-app',
      GCP_PROJECT_ID: 'my-gcp-project',
    });

    expect(env.firestoreDatabaseId).toBe('my-app-db');
    expect(env.gcsBucket).toBe('my-gcp-project-my-app-media');
  });

  it('prefers an explicit override over the derived default', async () => {
    const env = await loadEnv({
      NODE_ENV: 'production',
      APP_SLUG: 'my-app',
      GCP_PROJECT_ID: 'my-gcp-project',
      FIRESTORE_DATABASE_ID: 'legacy-database',
      GCS_BUCKET: 'legacy-bucket',
    });

    expect(env.firestoreDatabaseId).toBe('legacy-database');
    expect(env.gcsBucket).toBe('legacy-bucket');
  });

  it('accepts the literal (default) database id', async () => {
    const env = await loadEnv({
      NODE_ENV: 'production',
      APP_SLUG: 'my-app',
      GCP_PROJECT_ID: 'my-gcp-project',
      FIRESTORE_DATABASE_ID: '(default)',
    });

    expect(env.firestoreDatabaseId).toBe('(default)');
  });
});

describe('production requirements', () => {
  it('refuses to start when the data layer is not configured', async () => {
    await expect(loadEnv({ NODE_ENV: 'production' })).rejects.toThrow(
      /APP_SLUG is required in production/,
    );
  });

  it('reports every missing variable at once, not one per restart', async () => {
    await expect(loadEnv({ NODE_ENV: 'production' })).rejects.toThrow(
      /GCP_PROJECT_ID[\s\S]*FIRESTORE_DATABASE_ID[\s\S]*GCS_BUCKET/,
    );
  });

  it('starts with the placeholder values the CI smoke test uses', async () => {
    // Mirrors the `docker run -e ...` block in pr-validation.yml. If this case
    // fails, that workflow's container will not boot.
    const env = await loadEnv({
      NODE_ENV: 'production',
      APP_SLUG: 'smoke-test',
      GCP_PROJECT_ID: 'smoke-test-project',
      FIRESTORE_DATABASE_ID: 'smoke-test-db',
      GCS_BUCKET: 'smoke-test-project-smoke-test-media',
    });

    expect(env.isProduction).toBe(true);
    expect(env.appSlug).toBe('smoke-test');
  });

  it('does not apply the requirement during next build', async () => {
    // `next build` runs with NODE_ENV=production and imports every route to
    // collect metadata. Without the phase check, the Docker builder stage would
    // demand production database configuration in order to compile.
    const env = await loadEnv({
      NODE_ENV: 'production',
      NEXT_PHASE: 'phase-production-build',
    });

    expect(env.appSlug).toBe('');
    expect(env.gcsBucket).toBe('');
  });

  it('does not apply the requirement in development or test', async () => {
    await expect(loadEnv({ NODE_ENV: 'development' })).resolves.toBeDefined();
    await expect(loadEnv({ NODE_ENV: 'test' })).resolves.toBeDefined();
  });
});

describe('value validation', () => {
  it('rejects a slug that is not a valid Cloud Run service name', async () => {
    await expect(loadEnv({ NODE_ENV: 'development', APP_SLUG: 'My App' })).rejects.toThrow(
      /APP_SLUG/,
    );
    await expect(loadEnv({ NODE_ENV: 'development', APP_SLUG: '1-leading-digit' })).rejects.toThrow(
      /APP_SLUG/,
    );
  });

  it('rejects a malformed project id', async () => {
    await expect(
      loadEnv({ NODE_ENV: 'development', GCP_PROJECT_ID: 'UPPER-CASE' }),
    ).rejects.toThrow(/GCP_PROJECT_ID/);
  });

  it('rejects a bucket name that could never exist', async () => {
    await expect(loadEnv({ NODE_ENV: 'development', GCS_BUCKET: 'Has.Capitals' })).rejects.toThrow(
      /GCS_BUCKET/,
    );
  });

  it('parses the deep-health flag in every spelling', async () => {
    for (const value of ['true', '1', 'yes', 'on']) {
      const env = await loadEnv({ NODE_ENV: 'development', HEALTH_DEEP_CHECKS_ENABLED: value });
      expect(env.healthDeepChecksEnabled).toBe(true);
    }
    for (const value of ['false', '0', 'no', 'off']) {
      const env = await loadEnv({ NODE_ENV: 'development', HEALTH_DEEP_CHECKS_ENABLED: value });
      expect(env.healthDeepChecksEnabled).toBe(false);
    }
  });

  it('defaults the deep-health flag to off', async () => {
    const env = await loadEnv({ NODE_ENV: 'development' });
    expect(env.healthDeepChecksEnabled).toBe(false);
  });

  it('rejects a flag value it cannot interpret', async () => {
    await expect(
      loadEnv({ NODE_ENV: 'development', HEALTH_DEEP_CHECKS_ENABLED: 'maybe' }),
    ).rejects.toThrow(/HEALTH_DEEP_CHECKS_ENABLED/);
  });
});
