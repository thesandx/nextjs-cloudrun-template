import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SignInPanel } from '@/components/auth/SignInPanel';
import { getCurrentUser } from '@/services/auth.service';

/**
 * `GET /sign-in`.
 *
 * A Server Component that renders one Client Component. The signed-in check
 * happens on the server, so an already-signed-in visitor is redirected before
 * any sign-in UI reaches the browser.
 */

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

// Reads the session cookie, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/**
 * Only same-origin paths are accepted as a destination.
 *
 * `?next=https://evil.example` would otherwise turn this page into an open
 * redirect that borrows the app's domain for a phishing link. A path starting
 * with `//` is protocol-relative and goes off-site too, so it is refused.
 */
function safeRedirect(value: string | undefined): string {
  if (value === undefined || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}): Promise<React.JSX.Element> {
  const { next } = await searchParams;
  const destination = safeRedirect(next);

  const user = await getCurrentUser();
  if (user !== null) redirect(destination);

  // The panel renders the whole screen, AppBar included, because the back
  // arrow depends on which step the user is on.
  return <SignInPanel redirectTo={destination} />;
}
