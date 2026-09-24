import { env } from '@/lib/env';

/**
 * The Firebase web configuration, as the client SDK wants it.
 *
 * Pure: it assembles an object and performs no I/O, which is what keeps it in
 * `lib/`. The SDK is initialised in `hooks/useFirebaseAuth.ts`, because that
 * initialisation IS a side effect and belongs on the client-interaction layer.
 *
 * Safe to import from a Client Component. Every value is `NEXT_PUBLIC_`, so
 * every value is already in the browser bundle — this module adds no exposure.
 * It must never grow a field that is not.
 */

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

/**
 * Returns the config, or `null` when sign-in is not configured.
 *
 * `null` is a real state, not an error: a deployment without Firebase runs
 * read-only by design. Callers render a "sign-in unavailable" path rather than
 * crashing, and every write route answers 401 regardless — see `lib/env.ts`.
 */
export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  if (!env.authEnabled) return null;

  return {
    apiKey: env.firebase.apiKey,
    authDomain: env.firebase.authDomain,
    projectId: env.firebase.projectId,
    appId: env.firebase.appId,
  };
}

/** True when the browser can offer sign-in at all. */
export function isAuthConfigured(): boolean {
  return env.authEnabled;
}
