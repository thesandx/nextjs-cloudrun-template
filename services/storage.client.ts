import 'server-only';

import { type Bucket, Storage } from '@google-cloud/storage';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { ConfigurationError } from '@/services/firestore.client';

/**
 * The one Cloud Storage client in the process.
 *
 * Same lazy-singleton reasoning as `firestore.client.ts`: constructing at
 * import time would make `next build` reach for credentials on a CI runner,
 * and a client per request would throw away the cached access token.
 *
 * Authentication is Application Default Credentials. On Cloud Run that is the
 * attached runtime service account, which holds `roles/storage.objectUser` on
 * this bucket alone — not project-wide. There is no key file.
 *
 * Signing V4 URLs without a key file is the reason the runtime service account
 * needs `roles/iam.serviceAccountTokenCreator` **on itself**: with no private
 * key to sign with locally, the library calls the IAM `signBlob` API and lets
 * Google sign on its behalf. Without that binding, signing fails with a
 * `Permission 'iam.serviceAccounts.signBlob' denied` that names the service
 * account rather than the missing role. See `scripts/gcp-bootstrap.sh`.
 */

let storage: Storage | undefined;
let bucket: Bucket | undefined;

/**
 * Returns the shared Storage client, constructing it on first use.
 *
 * @throws {ConfigurationError} when the project id is not configured.
 */
export function getStorage(): Storage {
  if (storage !== undefined) return storage;

  if (env.gcpProjectId === '') {
    throw new ConfigurationError(
      'GCP_PROJECT_ID is not set, so Cloud Storage cannot be reached. Set it in .env.local. ' +
        'See docs/local-development.md.',
    );
  }

  storage = new Storage({
    projectId: env.gcpProjectId,
    // Retry idempotent operations only. A retried upload of a non-idempotent
    // request could duplicate an object; the default policy already knows
    // which verbs are safe, and this makes the choice explicit.
    retryOptions: { autoRetry: true, maxRetries: 3 },
  });

  logger.info('Cloud Storage client created', { projectId: env.gcpProjectId });
  return storage;
}

/**
 * Returns the app's bucket.
 *
 * There is exactly one per app, named `<project-id>-<app-slug>-media` by
 * default. Point `GCS_BUCKET` at `<bucket>-dev` locally so a laptop never
 * writes into production storage — see docs/local-development.md.
 *
 * @throws {ConfigurationError} when the bucket name is not configured.
 */
export function getBucket(): Bucket {
  if (bucket !== undefined) return bucket;

  if (env.gcsBucket === '') {
    throw new ConfigurationError(
      'GCS_BUCKET is not set and APP_SLUG or GCP_PROJECT_ID is empty, so it cannot be derived. ' +
        'See docs/local-development.md.',
    );
  }

  bucket = getStorage().bucket(env.gcsBucket);
  return bucket;
}

/**
 * Drops the cached clients. Only for tests that change configuration between
 * cases — application code must never call this.
 */
export function resetStorageClientForTests(): void {
  storage = undefined;
  bucket = undefined;
}
