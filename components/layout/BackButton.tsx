'use client';

import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';

export interface BackButtonProps {
  /**
   * Where to go when there is no in-app page to return to — the user opened
   * this screen from a link or a bookmark. Ignored when `onBack` is set.
   */
  fallbackHref?: string;
  /** Replaces navigation, for a step inside one screen: "back to the phone number". */
  onBack?: () => void;
  /** Says where back goes: "Back to home". Default: "Back". */
  label?: string;
  className?: string;
}

/**
 * The on-screen back arrow, so nobody depends on the browser's own button —
 * which an installed web app does not even show.
 *
 * `router.back()` only when the previous history entry is this app. Otherwise
 * back would leave the site, or do nothing on a freshly opened tab, so it goes
 * to `fallbackHref` instead.
 */
export function BackButton({
  fallbackHref = '/',
  onBack,
  label = 'Back',
  className,
}: BackButtonProps) {
  const router = useRouter();

  function goBack(): void {
    if (onBack) {
      onBack();
      return;
    }
    const cameFromThisApp =
      window.history.length > 1 &&
      document.referrer !== '' &&
      new URL(document.referrer).origin === window.location.origin;
    if (cameFromThisApp) router.back();
    else router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={label}
      className={cn(
        'squish border-line bg-surface inline-grid size-11 shrink-0 place-items-center rounded-full border-2',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="stroke-ink size-5"
        fill="none"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}
