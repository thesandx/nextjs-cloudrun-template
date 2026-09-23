'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Face } from '@/components/ui/Face';
import { Input } from '@/components/ui/Input';
import { useFirebaseAuth } from '@/hooks/useFirebaseAuth';

/**
 * Sign in with Google, or with a one-time code sent by SMS.
 *
 * `'use client'` is justified: state, submit handlers, and the Firebase SDK,
 * which only runs in a browser. Everything around it stays a Server Component.
 *
 * The phone flow is two steps on one screen rather than two screens, because a
 * person waiting for an SMS should be able to see the number they typed and
 * correct it without losing the code field.
 */

/** Where Firebase mounts the invisible reCAPTCHA. Must exist before it runs. */
const RECAPTCHA_CONTAINER_ID = 'firebase-recaptcha';

export interface SignInPanelProps {
  /** Where to send the user after a successful sign-in. */
  redirectTo?: string;
  className?: string;
}

export function SignInPanel({ redirectTo = '/', className }: SignInPanelProps): React.JSX.Element {
  const router = useRouter();
  const auth = useFirebaseAuth();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');

  const busy = auth.step === 'working';

  function finish(succeeded: boolean): void {
    if (!succeeded) return;
    // `refresh` re-renders the Server Components with the new cookie in place,
    // so the destination knows the user on its first render.
    router.replace(redirectTo);
    router.refresh();
  }

  if (!auth.available) {
    return (
      <Card className={`flex flex-col items-center gap-3 text-center ${className ?? ''}`}>
        <Face mood="sleepy" size={56} label="Sign-in unavailable" />
        <p className="text-body text-ink-soft">
          Sign-in is not configured for this deployment. Set the Firebase values in
          <code> .env.example</code> and rebuild.
        </p>
      </Card>
    );
  }

  return (
    <div className={`flex w-full flex-col gap-6 ${className ?? ''}`}>
      <Button
        variant="secondary"
        block
        disabled={busy}
        onClick={() => {
          void auth.signInWithGoogle().then(finish);
        }}
      >
        Continue with Google
      </Button>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="bg-line h-0.5 flex-1" />
        <span className="text-small text-ink-soft">or</span>
        <span className="bg-line h-0.5 flex-1" />
      </div>

      {auth.step === 'awaiting-code' ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void auth.confirmVerificationCode(code).then(finish);
          }}
        >
          <Input
            label="Code"
            hint={`Sent to ${phoneNumber}. It expires in a few minutes.`}
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            code
          />

          <Button type="submit" variant="primary" block disabled={busy}>
            {busy ? 'Checking…' : 'Verify and continue'}
          </Button>

          <Button
            variant="quiet"
            block
            disabled={busy}
            onClick={() => {
              setCode('');
              auth.reset();
            }}
          >
            Use a different number
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void auth.sendVerificationCode(phoneNumber, RECAPTCHA_CONTAINER_ID);
          }}
        >
          <Input
            label="Phone number"
            hint="With the country code, for example +91 98765 43210."
            name="phone"
            type="tel"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            autoComplete="tel"
            placeholder="+91"
            required
          />

          <Button type="submit" variant="primary" block disabled={busy}>
            {busy ? 'Sending…' : 'Send code'}
          </Button>
        </form>
      )}

      {auth.error !== null ? (
        <p role="alert" className="text-small text-ink flex items-center gap-1.5 font-medium">
          <span aria-hidden="true" className="bg-danger inline-block size-2.5 rounded-full" />
          {auth.error}
        </p>
      ) : null}

      {/*
        Firebase mounts the invisible reCAPTCHA widget here. It must be in the
        DOM before `sendVerificationCode` runs, which is why it is rendered
        unconditionally rather than alongside the phone form.
      */}
      <div id={RECAPTCHA_CONTAINER_ID} />

      <p className="text-small text-ink-soft">
        Signing in creates an account if you do not have one.
      </p>
    </div>
  );
}
