/**
 * The session cookie's name and attributes.
 *
 * Pure: it builds a cookie descriptor and decides nothing else. Kept out of
 * `services/` so it can be imported anywhere and tested without Firebase.
 */

/**
 * The cookie name is `__session`, and it is NOT arbitrary.
 *
 * Firebase Hosting and the Cloud CDN in front of it STRIP every cookie from a
 * request except one named exactly `__session`, so that a cached response is
 * never varied by a cookie the cache does not know about. Rename this and the
 * app works perfectly on the direct `*.run.app` URL, then signs every user out
 * the moment traffic is served through a custom domain fronted by Hosting.
 *
 * That failure looks like "auth randomly stops working in production" and is
 * miserable to diagnose, so the name is a constant rather than an environment
 * variable. There is no legitimate reason to change it.
 *
 * https://firebase.google.com/docs/hosting/manage-cache#using_cookies
 */
export const SESSION_COOKIE_NAME = '__session';

/**
 * The `__Host-` prefix is deliberately NOT used.
 *
 * It would be stronger — a browser refuses such a cookie unless it is Secure,
 * path `/` and has no Domain — but the name would then not be `__session`, and
 * Hosting would strip it. The attributes below give the same guarantees; the
 * prefix would only make the browser enforce them too.
 */

export interface SessionCookie {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
}

/**
 * The session cookie, ready to hand to `cookies().set()`.
 *
 * - `httpOnly`, so script cannot read the session even if a page is XSSed.
 * - `sameSite: 'lax'`, which blocks the cookie on cross-site POSTs (the CSRF
 *   case) while still sending it when a user follows a link back into the app.
 *   `strict` would break the redirect back from Google's sign-in page.
 * - `secure` everywhere except plain-HTTP localhost, where a browser would
 *   refuse to store it and local sign-in would silently never work.
 *
 * @param maxAgeSeconds 0 clears the cookie.
 * @param isSecureContext false only for local HTTP development.
 */
export function sessionCookie(
  value: string,
  maxAgeSeconds: number,
  isSecureContext: boolean,
): SessionCookie {
  return {
    name: SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: isSecureContext,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(0, Math.floor(maxAgeSeconds)),
  };
}

/**
 * The cookie that clears the session.
 *
 * An empty value with `maxAge: 0`. Setting a cookie is the only way to remove
 * one, and the name, path and attributes must match the original or the
 * browser keeps both.
 */
export function clearedSessionCookie(isSecureContext: boolean): SessionCookie {
  return sessionCookie('', 0, isSecureContext);
}

/** Days to seconds, for the `maxAge` above and Firebase's `expiresIn`. */
export function daysToSeconds(days: number): number {
  return days * 24 * 60 * 60;
}
