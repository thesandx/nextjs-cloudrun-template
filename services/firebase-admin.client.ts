import 'server-only';

import { type App, applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { type Auth, getAuth } from 'firebase-admin/auth';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { ConfigurationError } from '@/services/firestore.client';

/**
 * The one Firebase Admin app in the process, for authentication only.
 *
 * Deliberately NOT used for Firestore or Cloud Storage. Those keep their own
 * clients (`firestore.client.ts`, `storage.client.ts`) because the admin SDK's
 * wrappers hide the named-database and bucket configuration this template
 * depends on. The admin SDK here does exactly one job: verify and mint
 * sessions.
 *
 * Lazy for the same reason as the Firestore client: `next build` imports every
 * route to collect metadata, and a module-level `initializeApp()` would make
 * that reach for credentials on a CI runner that has none.
 *
 * ## Credentials
 *
 * `applicationDefault()`, always. On Cloud Run that is the attached runtime
 * service account, read from the metadata server. There is no key file, and
 * there must never be one — see ADR-0002.
 *
 * Two operations here need different things from that identity:
 *
 *   - `verifySessionCookie` needs NO IAM permission at all. It validates a
 *     signature against Google's published public keys, which it fetches over
 *     plain HTTPS and caches. This is why a misconfigured IAM policy still
 *     lets existing sessions work, and only NEW sign-ins fail.
 *   - `createSessionCookie` calls the Identity Toolkit API, and that DOES need
 *     permission on the Firebase project. `scripts/gcp-bootstrap.sh` grants
 *     `roles/firebaseauth.admin` to the runtime service account. Without it,
 *     sign-in fails with PERMISSION_DENIED from identitytoolkit.
 */

let app: App | undefined;

/**
 * Returns the shared Admin app, initialising it on first use.
 *
 * @throws {ConfigurationError} when the project id is unknown, naming the
 *   variable to set rather than failing later inside the SDK.
 */
export function getFirebaseAdminApp(): App {
  if (app !== undefined) return app;

  const projectId = env.firebase.projectId || env.gcpProjectId;
  if (projectId === '') {
    throw new ConfigurationError(
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID and GCP_PROJECT_ID are both unset, so Firebase Auth ' +
        'cannot be reached. Set one in .env.local. See docs/auth.md.',
    );
  }

  // Next.js keeps module state across hot reloads in development, so a second
  // initializeApp() with the same name would throw. Reuse whatever is there.
  const existing = getApps();
  app =
    existing[0] ??
    initializeApp({
      credential: applicationDefault(),
      projectId,
    });

  logger.info('Firebase Admin app created', { projectId });
  return app;
}

/** The Admin Auth instance. */
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

/**
 * Drops the cached app. Only for tests that need a fresh one after changing
 * configuration — application code must never call this.
 */
export function resetFirebaseAdminForTests(): void {
  app = undefined;
}
