'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';

import { cn } from '@/lib/utils';

import type { HeaderLink } from './Header';

export interface MobileMenuProps {
  links: readonly HeaderLink[];
  /** The `href` of the page being shown, so its link is marked current. */
  currentPath?: string;
  className?: string;
}

/**
 * The header's links on a phone: one "Menu" button that opens a panel below
 * the header. `Header` renders it under `sm` only; wider screens show the
 * links inline.
 *
 * It closes when the page changes, on Escape, and when a link is chosen, so
 * it never stays open over the next page — even when `Header` sits in a
 * layout that does not re-render on navigation.
 *
 * A client component for the open state only. The links are plain `Link`s.
 */
export function MobileMenu({ links, currentPath, className }: MobileMenuProps) {
  const pathname = usePathname();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // A new page arrived: close. Updating state during render is React's
  // pattern for resetting on a prop change.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="squish border-line bg-surface shadow-mochi-sm rounded-pill inline-flex min-h-11 items-center gap-2 border-2 px-4 font-medium"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-5 stroke-current"
          fill="none"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        Menu
      </button>
      <nav
        id={panelId}
        aria-label="Main"
        hidden={!open}
        className="bg-surface border-line shadow-mochi rounded-card animate-rise-in absolute inset-x-5 top-full z-30 border-2 p-2"
      >
        <ul className="flex flex-col">
          {links.map((link) => {
            const current = link.href === currentPath;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'rounded-input flex min-h-12 items-center px-3 font-medium underline-offset-4',
                    current
                      ? 'decoration-brand bg-brand-soft underline decoration-2'
                      : 'hover:bg-sunken',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
