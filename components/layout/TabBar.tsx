'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { APP_TABS, isTabActive, type TabIcon, TABLESS_PATHS } from '@/lib/navigation';
import { cn } from '@/lib/utils';

const ICONS: Record<TabIcon, React.ReactNode> = {
  home: <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z" />,
  shapes: (
    <>
      <circle cx="7.5" cy="7.5" r="3.5" />
      <path d="M13 4h7v7h-7z" />
      <path d="M7.5 13l4 7h-8z" />
      <circle cx="16.5" cy="16.5" r="3.5" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" />
    </>
  ),
};

export interface TabBarProps {
  className?: string;
}

/**
 * The bottom tab bar: the app's top-level destinations, always one thumb away.
 * It floats above the page, as the nav bar does in a native app, and hides on
 * focused screens such as sign-in. Destinations live in `lib/navigation.ts`.
 *
 * A client component for one reason: it reads the current path to mark the
 * active tab. The active tab lifts onto a base and has `aria-current`, so the
 * state never rests on colour alone.
 */
export function TabBar({ className }: TabBarProps) {
  const pathname = usePathname();
  if (TABLESS_PATHS.includes(pathname)) return null;

  return (
    <nav
      aria-label="Main"
      className={cn(
        'fixed inset-x-3 bottom-3 z-30 mx-auto max-w-sm pb-[env(safe-area-inset-bottom)]',
        className,
      )}
    >
      <ul className="bg-surface border-line shadow-mochi rounded-pill flex gap-1 border-2 p-1.5">
        {APP_TABS.map((tab) => {
          const active = isTabActive(tab.href, pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-pill flex min-h-13 flex-col items-center justify-center gap-0.5 border-2 px-2',
                  'text-small ease-squish font-medium transition-[transform,box-shadow] duration-150',
                  active
                    ? 'bg-brand border-line shadow-mochi-sm text-ink -translate-y-px'
                    : 'text-ink-soft hover:text-ink border-transparent',
                )}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="stroke-current size-5"
                  fill="none"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {ICONS[tab.icon]}
                </svg>
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
