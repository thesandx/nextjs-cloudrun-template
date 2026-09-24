import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SignInPanel } from '@/components/auth/SignInPanel';
import { Card } from '@/components/ui/Card';
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

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-2">
        <p className="text-small text-ink-soft">Account</p>
        <h1 className="text-hero">Sign in</h1>
        <p className="text-body text-ink-soft max-w-prose">
          Use your Google account, or a one-time code sent to your phone.
        </p>
      </header>

      <Card>
        <SignInPanel redirectTo={destination} />
      </Card>
    </main>
  );
}
