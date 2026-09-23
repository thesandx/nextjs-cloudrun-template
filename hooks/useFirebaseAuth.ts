'use client';

import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  type ConfirmationResult,
  getAuth,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { useCallback, useRef, useState } from 'react';

import { getFirebaseWebConfig } from '@/lib/firebase-config';

/**
 * Client-side sign-in: Google, and phone OTP.
 *
 * ## What this hook is responsible for
 *
 * Getting an ID token, and handing it to the server exactly once. Everything
 * after that is a cookie the browser sends on its own — this hook does not
 * hold the session, and no other component needs to know a user is signed in
 * from the client, because the server renders that.
 *
 * ## Why the SDK is initialised here and not in `lib/`
 *
 * `initializeApp` opens listeners and touches browser storage. That is a side
 * effect, and `lib/` is the layer that has none. The pure part — assembling
 * the config object — is in `lib/firebase-config.ts`; the effect lives on the
 * client-interaction layer, which is what `hooks/` is for.
 *
 * ## reCAPTCHA
 *
 * Phone sign-in REQUIRES a reCAPTCHA verifier. Firebase renders an invisible
 * one, and it solves itself for almost every real user. It exists because SMS
 * costs real money per message, and an unprotected send endpoint is an
 * invitation to SMS pumping fraud — see docs/auth.md. The verifier is created
 * once, on first use, and reused: constructing a second one for the same
 * container throws.
 */

export type AuthStep = 'idle' | 'working' | 'awaiting-code';

export interface UseFirebaseAuth {
  step: AuthStep;
  error: string | null;
  /** False when the deployment ships no Firebase config. */
  available: boolean;
  signInWithGoogle: () => Promise<boolean>;
  /** Sends an OTP. `phoneNumber` must be E.164, e.g. `+919876543210`. */
  sendVerificationCode: (phoneNumber: string, recaptchaContainerId: string) => Promise<boolean>;
  /** Confirms the OTP sent by `sendVerificationCode`. */
  confirmVerificationCode: (code: string) => Promise<boolean>;
  /** Clears the session cookie and the client's own auth state. */
  signOut: () => Promise<void>;
  reset: () => void;
}

/** Messages a user can act on. Firebase's own strings are for developers. */
const MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number': 'That phone number is not valid. Include the country code.',
  'auth/invalid-verification-code': 'That code is not right. Check it and try again.',
  'auth/code-expired': 'That code has expired. Ask for a new one.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/popup-closed-by-user': 'The sign-in window closed before finishing.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups and try again.',
  'auth/account-exists-with-different-credential':
    'You already have an account with that email. Sign in the way you did before.',
  'auth/network-request-failed': 'The network dropped. Check your connection and try again.',
  'auth/operation-not-allowed': 'That sign-in method is not enabled for this app.',
};

function toMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '';
  return (typeof code === 'string' ? MESSAGES[code] : undefined) ?? 'Sign-in failed. Try again.';
}

function getClientAuth(): Auth | null {
  const config = getFirebaseWebConfig();
  if (config === null) return null;

  // Next.js preserves module state across hot reloads, so re-initialising the
  // same app would throw. Reuse whatever is already there.
  const app: FirebaseApp = getApps()[0] ?? initializeApp(config);
  return getAuth(app);
}

export function useFirebaseAuth(): UseFirebaseAuth {
  const [step, setStep] = useState<AuthStep>('idle');
  const [error, setError] = useState<string | null>(null);

  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const available = getFirebaseWebConfig() !== null;

  /**
   * Exchanges the ID token for an httpOnly session cookie.
   *
   * The client is then done with the token. It is deliberately NOT kept in
   * `localStorage` or a readable cookie — a session that script can read is a
   * session an XSS can steal.
   */
  const establishSession = useCallback(async (user: User): Promise<boolean> => {
    const idToken = await user.getIdToken();

    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      setError('Signed in, but the session could not be saved. Try again.');
      return false;
    }
    return true;
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    const auth = getClientAuth();
    if (auth === null) {
      setError('Sign-in is not configured for this deployment.');
      return false;
    }

    setStep('working');
    setError(null);
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      return await establishSession(credential.user);
    } catch (caught) {
      setError(toMessage(caught));
      return false;
    } finally {
      setStep('idle');
    }
  }, [establishSession]);

  const sendVerificationCode = useCallback(
    async (phoneNumber: string, recaptchaContainerId: string): Promise<boolean> => {
      const auth = getClientAuth();
      if (auth === null) {
        setError('Sign-in is not configured for this deployment.');
        return false;
      }

      setStep('working');
      setError(null);
      try {
        verifierRef.current ??= new RecaptchaVerifier(auth, recaptchaContainerId, {
          size: 'invisible',
        });

        confirmationRef.current = await signInWithPhoneNumber(
          auth,
          phoneNumber,
          verifierRef.current,
        );
        setStep('awaiting-code');
        return true;
      } catch (caught) {
        // A failed send leaves the verifier in a state that cannot be reused,
        // and reusing it makes the next attempt fail for the wrong reason.
        verifierRef.current?.clear();
        verifierRef.current = null;
        setError(toMessage(caught));
        setStep('idle');
        return false;
      }
    },
    [],
  );

  const confirmVerificationCode = useCallback(
    async (code: string): Promise<boolean> => {
      const confirmation = confirmationRef.current;
      if (confirmation === null) {
        setError('Ask for a code first.');
        return false;
      }

      setStep('working');
      setError(null);
      try {
        const credential = await confirmation.confirm(code);
        return await establishSession(credential.user);
      } catch (caught) {
        setError(toMessage(caught));
        // Stay on the code step: a wrong digit should not mean re-sending an
        // SMS, which costs money and counts against the rate limit.
        setStep('awaiting-code');
        return false;
      }
    },
    [establishSession],
  );

  const signOut = useCallback(async (): Promise<void> => {
    // Clear the server session first. If the client cleared first and this
    // failed, the browser would look signed out while still holding a valid
    // cookie — the worst of both states.
    await fetch('/api/auth/session', {
      method: 'DELETE',
      signal: AbortSignal.timeout(10_000),
    });

    const auth = getClientAuth();
    if (auth !== null) await firebaseSignOut(auth);
  }, []);

  const reset = useCallback((): void => {
    verifierRef.current?.clear();
    verifierRef.current = null;
    confirmationRef.current = null;
    setStep('idle');
    setError(null);
  }, []);

  return {
    step,
    error,
    available,
    signInWithGoogle,
    sendVerificationCode,
    confirmVerificationCode,
    signOut,
    reset,
  };
}
