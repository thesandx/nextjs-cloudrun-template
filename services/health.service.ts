import 'server-only';

import { logger } from '@/lib/logger';
import { withTimeout } from '@/lib/utils';
import { getFirestore } from '@/services/firestore.client';
import { getBucket } from '@/services/storage.client';

/**
 * Dependency checks for `/api/health?deep=1`.
 *
 * Read the warning in `app/api/health/route.ts` before wiring anything to
 * this. The short version: these checks must never gate a Cloud Run startup or
 * liveness probe. A probe that fails when Firestore has a bad thirty seconds
 * makes the platform kill healthy containers, which turns a dependency blip
 * into an outage of your own making.
 *
 * Both checks are deliberately cheap and bounded:
 *   - Firestore: one key lookup for a document that does not need to exist.
 *     A `get` on a missing document is one billed read and touches no index.
 *   - Cloud Storage: one bucket metadata read. It proves the bucket exists and
 *     that the service account can see it, without listing a single object.
 *
 * Each has its own deadline, because the point of a health check is to answer
 * quickly even — especially — when the dependency is the thing that is slow.
 */

/** Per-check deadline. Short: a slow dependency is a failing dependency here. */
const CHECK_TIMEOUT_MS = 2_000;

/** Document probed in Firestore. It does not need to exist. */
const PROBE_PATH = '_health/probe';

export interface DependencyCheck {
  name: string;
  ok: boolean;
  latencyMs: number;
  /** Failure summary. Never includes credentials or stored data. */
  error?: string;
}

export interface DeepHealthResult {
  ok: boolean;
  checks: DependencyCheck[];
}

async function timed(name: string, run: () => Promise<unknown>): Promise<DependencyCheck> {
  const startedAt = Date.now();
  try {
    await withTimeout(run(), CHECK_TIMEOUT_MS, name);
    return { name, ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Health check failed', error, { check: name });
    return { name, ok: false, latencyMs: Date.now() - startedAt, error: message };
  }
}

/** Runs every dependency check in parallel and summarises the result. */
export async function checkDependencies(): Promise<DeepHealthResult> {
  const checks = await Promise.all([
    timed('firestore', () => getFirestore().doc(PROBE_PATH).get()),
    timed('storage', () => getBucket().getMetadata()),
  ]);

  return { ok: checks.every((check) => check.ok), checks };
}
