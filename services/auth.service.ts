import 'server-only';

import { cookies } from 'next/headers';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { daysToSeconds, SESSION_COOKIE_NAME } from '@/lib/session-cookie';
import { getFirebaseAuth } from '@/services/firebase-admin.client';

/**
 * Sessions: minting, verifying and clearing them.
 *
 * ## The shape of the flow
 *
 * The browser signs in with the Firebase client SDK and receives an ID token.
 * That token is short-lived (one hour) and lives in JavaScript, so it is the
 * wrong thing to keep. The client posts it once to `POST /api/auth/session`,
 * which verifies it and exchanges it for a SESSION COOKIE: `httpOnly`, so
 * script cannot read it, and valid for up to fourteen days.
 *
 * Every later request carries that cookie, so a Server Component knows who is
 * asking on the FIRST render, with no client round trip and no flash of
 * signed-out UI.
 *
 * ## Why an ID token is not simply stored in the cookie
 *
 * It would work, and it would need no IAM permission at all. It would also
 * expire every hour, so any page loaded after that renders signed-out until
 * the client notices and posts a fresh token. A session cookie removes that
 * whole class of flicker. The cost is one IAM role — see
 * `firebase-admin.client.ts`.
 *
 * ## PII
 *
 * A `uid` is a pseudonymous identifier and is safe to log. An email address
 * and a phone number are not: they identify a person, and application logs go
 * to Cloud Logging where they are retained and widely readable. Nothing in
 * this file logs either. Keep it that way.
 */

/** Raised when a request carries no valid session. */
export class UnauthenticatedError extends Error {
  constructor(message = 'Sign in to continue.') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

/** Raised when a valid session is not permitted to touch the resource. */
export class ForbiddenError extends Error {
  constructor(message = 'You do not have access to this.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** The sign-in methods this template configures. */
export type AuthProvider = 'google.com' | 'phone';

/** The authenticated caller, as far as the server is concerned. */
export interface SessionUser {
  /** Firebase uid. Stable, pseudonymous, and the id of the profile document. */
  uid: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  displayName: string | null;
  photoUrl: string | null;
  /** The provider used for THIS session, when Firebase reports one. */
  signInProvider: AuthProvider | null;
}

function toProvider(value: unknown): AuthProvider | null {
  return value === 'google.com' || value === 'phone' ? value : null;
}

/**
 * Exchanges a freshly minted ID token for a session cookie.
 *
 * The ID token is verified first, with `checkRevoked`, before anything is
 * minted. Skipping that would let a caller hand over a token from a user whose
 * access was withdrawn seconds earlier and receive a fourteen-day session for
 * it.
 *
 * @returns the cookie value and its lifetime in seconds.
 * @throws {UnauthenticatedError} when the ID token is absent, expired,
 *   malformed, or issued for another project.
 */
export async function createSession(
  idToken: string,
): Promise<{ value: string; maxAgeSeconds: number }> {
  if (!env.authEnabled) {
    throw new UnauthenticatedError('Sign-in is not configured for this deployment.');
  }

  const auth = getFirebaseAuth();
  const expiresIn = daysToSeconds(env.authSessionMaxAgeDays) * 1000;

  let uid: string;
  try {
    const decoded = await auth.verifyIdToken(idToken, true);
    uid = decoded.uid;
  } catch (error) {
    // The detail says which check failed and is useful to an attacker probing
    // for valid tokens. Log it; tell the caller only that it was rejected.
    logger.warn('Rejected an ID token', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    throw new UnauthenticatedError('That sign-in could not be verified. Try again.');
  }

  const value = await auth.createSessionCookie(idToken, { expiresIn });
  logger.info('Session created', { uid });

  return { value, maxAgeSeconds: expiresIn / 1000 };
}

/**
 * Verifies a session cookie value.
 *
 * `env.authCheckRevoked` decides whether this also asks Identity Platform
 * whether the underlying refresh token was revoked. That is one network call
 * per request, so it is off by default — see `.env.example`.
 *
 * @returns the user, or `null` for any invalid, expired or absent cookie.
 *   Returning `null` rather than throwing is deliberate: a missing session is
 *   the normal state of a logged-out visitor, not an error.
 */
export async function verifySession(value: string | undefined): Promise<SessionUser | null> {
  if (!env.authEnabled || value === undefined || value === '') return null;

  try {
    const claims = await getFirebaseAuth().verifySessionCookie(value, env.authCheckRevoked);

    return {
      uid: claims.uid,
      email: typeof claims.email === 'string' ? claims.email : null,
      emailVerified: claims.email_verified === true,
      phoneNumber: typeof claims.phone_number === 'string' ? claims.phone_number : null,
      displayName: typeof claims.name === 'string' ? claims.name : null,
      photoUrl: typeof claims.picture === 'string' ? claims.picture : null,
      signInProvider: toProvider(claims.firebase.sign_in_provider),
    };
  } catch {
    // Expired and tampered cookies land here alike, and both mean the same
    // thing to the caller: there is no session. The empty block would trip
    // `no-empty`, so the return is explicit.
    return null;
  }
}

/**
 * The current user, read from the request's cookies.
 *
 * Safe to call from a Server Component, a route handler or a server action.
 * Returns `null` when signed out.
 *
 * Note that this reads `next/headers`, which makes any caller dynamic. That is
 * correct for a page whose content depends on who is asking — but it does mean
 * a page calling this is never statically rendered.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE_NAME)?.value);
}

/**
 * The current user, or a thrown `UnauthenticatedError`.
 *
 * This is the one line that gates a write. `lib/http-errors.ts` maps the error
 * to a 401, so a route handler needs no special case:
 *
 * @example
 * export async function POST(request: Request) {
 *   try {
 *     const user = await requireUser();
 *     ...
 *   } catch (error) {
 *     const mapped = mapHttpError(error);
 *     return NextResponse.json(mapped.body, { status: mapped.status });
 *   }
 * }
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user === null) throw new UnauthenticatedError();
  return user;
}

/**
 * Revokes every refresh token for a user.
 *
 * This is what makes "sign out everywhere" real, but it only takes effect on
 * requests that are actually checked: session cookies already issued stay
 * cryptographically valid until they expire unless `AUTH_CHECK_REVOKED` is on.
 * Clearing the cookie signs this browser out; this signs out the others.
 */
export async function revokeSessions(uid: string): Promise<void> {
  if (!env.authEnabled) return;
  await getFirebaseAuth().revokeRefreshTokens(uid);
  logger.info('Sessions revoked', { uid });
}
