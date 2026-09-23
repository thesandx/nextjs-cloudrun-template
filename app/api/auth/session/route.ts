import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from '@/lib/env';
import { mapHttpError } from '@/lib/http-errors';
import { logger } from '@/lib/logger';
import { clearedSessionCookie, daysToSeconds, sessionCookie } from '@/lib/session-cookie';
import { createSession, getCurrentUser, revokeSessions } from '@/services/auth.service';
import { ensureUserProfile } from '@/services/user.service';

/**
 * `POST /api/auth/session` — sign in. `DELETE` — sign out.
 *
 * The client signs in with Firebase, gets an ID token, and posts it here once.
 * This route verifies it and sets an httpOnly session cookie. The browser
 * sends that cookie on every later request, so Server Components know the user
 * on first render.
 *
 * The ID token is never stored anywhere. It is spent here and discarded.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A Firebase ID token is a JWT: three base64url segments separated by dots.
 * Checking the shape here means an obviously-wrong body is rejected before it
 * reaches Identity Platform, and keeps junk out of the verification path.
 */
const bodySchema = z.object({
  idToken: z
    .string()
    .min(1)
    .max(8192)
    .regex(/^[\w-]+\.[\w-]+\.[\w-]+$/, 'must be a JWT'),
});

/**
 * Cookies must be `Secure` everywhere except plain-HTTP localhost, where a
 * browser refuses to store a Secure cookie and sign-in would silently never
 * work. Derived from the configured app URL rather than from the request, so a
 * forged `X-Forwarded-Proto` cannot downgrade it.
 */
function isSecureContext(): boolean {
  return !env.appUrl.startsWith('http://localhost') && !env.appUrl.startsWith('http://127.0.0.1');
}

export async function POST(request: Request): Promise<NextResponse> {
  let parsed: z.infer<typeof bodySchema>;

  try {
    parsed = bodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_body',
        message: error instanceof z.ZodError ? z.prettifyError(error) : 'Body must be valid JSON',
      },
      { status: 400 },
    );
  }

  try {
    const { value, maxAgeSeconds } = await createSession(parsed.idToken);

    const store = await cookies();
    store.set(sessionCookie(value, maxAgeSeconds, isSecureContext()));

    // The profile is created here, not on first write, so a brand-new user has
    // a record from the moment they sign in. It reads its own cookie, so it
    // must run after the cookie is set.
    const user = await getCurrentUser();
    if (user !== null) await ensureUserProfile(user);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const mapped = mapHttpError(error);
    if (!mapped.exposeDetail) logger.error('Creating a session failed', error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function DELETE(): Promise<NextResponse> {
  // Read the user before clearing, so the revocation can name them.
  const user = await getCurrentUser();

  const store = await cookies();
  store.set(clearedSessionCookie(isSecureContext()));

  if (user !== null) {
    try {
      await revokeSessions(user.uid);
    } catch (error) {
      // The cookie is already cleared, so this browser IS signed out. Failing
      // the request now would tell the user sign-out did not work, which is
      // both wrong and alarming. Log it and move on.
      logger.error('Revoking refresh tokens failed', error, { uid: user.uid });
    }
  }

  return NextResponse.json({ ok: true });
}

/** Tells a client how long a session lasts, without exposing the cookie. */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();

  return NextResponse.json(
    {
      signedIn: user !== null,
      uid: user?.uid ?? null,
      maxAgeSeconds: daysToSeconds(env.authSessionMaxAgeDays),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
