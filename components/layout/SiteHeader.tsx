'use client';

import { usePathname } from 'next/navigation';

import { activeTabHref, APP_TABS } from '@/lib/navigation';
import { cn } from '@/lib/utils';

import { Header } from './Header';

export interface SiteHeaderProps {
  /** The product name, beside the mascot logo. */
  appName: string;
  className?: string;
}

/**
 * The desktop posture's navigation: a sticky website header with the same
 * destinations the `TabBar` shows on a phone. It renders from `md` up only;
 * below that the `TabBar` takes over. Both read `APP_TABS`, so the two can
 * never list different places.
 *
 * A client component only to read the path, so the current link is marked.
 * See design-language.md > Responsive: an app on a phone, a website on a desktop.
 */
export function SiteHeader({ appName, className }: SiteHeaderProps) {
  const pathname = usePathname();
  const current = activeTabHref(pathname);

  return (
    <div
      className={cn('bg-paper border-line sticky top-0 z-30 hidden border-b-2 md:block', className)}
    >
      <Header
        appName={appName}
        links={APP_TABS}
        phoneMenu={false}
        {...(current !== undefined ? { currentPath: current } : {})}
      />
    </div>
  );
}
