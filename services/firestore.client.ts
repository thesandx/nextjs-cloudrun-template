import 'server-only';

import { Firestore } from '@google-cloud/firestore';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * The one Firestore client in the process.
 *
 * Why a lazy singleton rather than a module-level `new Firestore()`:
 *   - the client opens a gRPC channel on construction. Doing that at import
 *     time makes `next build` (which imports every route to collect metadata)
 *     try to reach Google from a CI runner with no credentials;
 *   - Cloud Run keeps an instance warm between requests, so one client is
 *     reused across every request that instance serves. Constructing one per
 *     request would mean a new channel and a new token exchange each time.
 *
 * Authentication is Application Default Credentials, always:
 *   - on Cloud Run, the attached runtime service account via the metadata
 *     server;
 *   - locally, `gcloud auth application-default login`;
 *   - against the emulator, no credentials at all.
 *
 * There is no key file anywhere in this path, and there must never be one.
 */

/** Raised when the data layer is reached without the configuration it needs. */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Project id used against the emulator when `GCP_PROJECT_ID` is unset, which is
 * the normal case on a laptop and in CI. The emulator never validates it; it
 * only needs a stable string to key its in-memory data by.
 */
const EMULATOR_PROJECT_ID = 'demo-template';

let client: Firestore | undefined;

/** True when the process is pointed at a local Firestore emulator. */
export function isUsingEmulator(): boolean {
  return env.firestoreEmulatorHost !== '';
}

/**
 * Returns the shared Firestore client, constructing it on first use.
 *
 * @throws {ConfigurationError} when project id or database id is missing and no
 *   emulator is configured — with the variable name to set, rather than a
 *   `Could not load the default credentials` stack trace from deep in the SDK.
 */
export function getFirestore(): Firestore {
  if (client !== undefined) return client;

  const emulator = isUsingEmulator();
  const projectId = env.gcpProjectId || (emulator ? EMULATOR_PROJECT_ID : '');
  const databaseId = env.firestoreDatabaseId || (emulator ? '(default)' : '');

  if (projectId === '') {
    throw new ConfigurationError(
      'GCP_PROJECT_ID is not set, so Firestore cannot be reached. Set it in .env.local, ' +
        'or start the emulator with `pnpm db:emulator`. See docs/local-development.md.',
    );
  }
  if (databaseId === '') {
    throw new ConfigurationError(
      'FIRESTORE_DATABASE_ID is not set and APP_SLUG is empty, so it cannot be derived. ' +
        'Set APP_SLUG in .env.local. See docs/local-development.md.',
    );
  }

  client = new Firestore({
    projectId,
    databaseId,
    // Return plain numbers rather than BigInt for integer fields, so values
    // survive JSON.stringify in a route handler without a custom replacer.
    useBigInt64: false,
    // The SDK reads FIRESTORE_EMULATOR_HOST itself and drops credentials when
    // it is set; nothing extra is needed here.
    ignoreUndefinedProperties: false,
  });

  logger.info('Firestore client created', {
    projectId,
    databaseId,
    emulator,
  });

  return client;
}

/**
 * Drops the cached client. Only for tests that need a fresh client after
 * changing configuration — application code must never call this.
 */
export function resetFirestoreClientForTests(): void {
  client = undefined;
}
