'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/Button';
import { Speech } from '@/components/ui/Speech';

/**
 * Route-segment error boundary.
 *
 * Must be a Client Component — React needs `componentDidCatch` semantics and an
 * interactive retry. This is one of the few legitimate `'use client'` files in
 * the template.
 *
 * Note: `error.message` is redacted to a generic string in production builds by
 * Next.js, and only `error.digest` is preserved. Search Cloud Logging for that
 * digest to find the real server-side stack trace.
 *
 * The layout follows the error-state recipe in design-language.md: the mascot
 * says what happened, the interface offers the fix.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side errors do not reach the server logger; forward them to an
    // error tracker here (Sentry, Cloud Error Reporting) in a real project.
    console.error('Unhandled application error', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-6 px-5 py-12 sm:px-8">
      <h1 className="text-title">Something went wrong</h1>
      <Speech mood="sad">This page did not load. Try it again.</Speech>
      {error.digest ? (
        <p className="text-small text-ink-soft">
          Give this reference to support: <span className="font-display">{error.digest}</span>
        </p>
      ) : null}
      <div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
