'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';

/**
 * Signs the user out of this browser and revokes their other sessions.
 *
 * A Client Component for one reason: it has a click handler. It renders inside
 * Server Components that already know who the user is, so it takes no props
 * about them.
 */

export interface SignOutButtonProps {
  /**
   * Where to go once signed out. Omit to stay on the page, which then
   * re-renders signed out. Set it on a page that requires a session, such as
   * /profile, or the refresh would bounce the user to sign-in.
   */
  redirectTo?: string;
  variant?: 'secondary' | 'quiet';
  block?: boolean;
  className?: string;
}

export function SignOutButton({
  redirectTo,
  variant = 'quiet',
  block,
  className,
}: SignOutButtonProps): React.JSX.Element {
  const router = useRouter();
  const auth = useFirebaseAuth();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant={variant}
      disabled={busy}
      {...(block !== undefined && { block })}
      {...(className !== undefined && { className })}
      onClick={() => {
        setBusy(true);
        void auth
          .signOut()
          .then(() => {
            // The session cookie is gone, so every Server Component must be
            // re-rendered. Without the refresh the page keeps showing the
            // signed-in markup it was rendered with.
            if (redirectTo !== undefined) router.replace(redirectTo);
            router.refresh();
          })
          .finally(() => setBusy(false));
      }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
