import Link from 'next/link';

import { Face } from '@/components/ui/Face';
import { cn } from '@/lib/utils';

import { MobileMenu } from './MobileMenu';

export interface HeaderLink {
  href: string;
  label: string;
}

export interface HeaderProps {
  /** The product name, beside the mascot. */
  appName: string;
  /** Top-level destinations. Only pages that exist — no link to a page you have not built. */
  links?: readonly HeaderLink[];
  /** The `href` of the page being shown, so its link is marked current. */
  currentPath?: string;
  /** A slot on the right, such as the sign-in state. */
  end?: React.ReactNode;
  className?: string;
}

/**
 * The site header. The logo is the mascot face, never a letter in a circle —
 * see design-language.md > Recipes — and it always links home. The current
 * page has an underline and `aria-current`, not only a colour change.
 *
 * On a phone the links fold into `MobileMenu`, so the header never wraps or
 * scrolls sideways. From `sm` up they sit inline.
 */
export function Header({ appName, links = [], currentPath, end, className }: HeaderProps) {
  return (
    <header
      className={cn(
        'relative mx-auto flex w-full max-w-5xl items-center gap-4 px-5 py-4 sm:px-8',
        className,
      )}
    >
      <Link href="/" className="font-display flex min-h-11 min-w-0 items-center gap-2">
        <span className="bg-brand-soft border-line inline-grid size-10 shrink-0 place-items-center rounded-full border-2">
          <Face size={32} blush={false} />
        </span>
        <span className="truncate">{appName}</span>
      </Link>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {links.length > 0 && (
          <nav aria-label="Main" className="hidden sm:block">
            <ul className="flex items-center gap-3">
              {links.map((link) => {
                const current = link.href === currentPath;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={current ? 'page' : undefined}
                      className={cn(
                        'inline-flex min-h-11 items-center px-2 font-medium underline-offset-4',
                        current
                          ? 'decoration-brand underline decoration-2'
                          : 'text-ink-soft hover:text-ink',
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        {end}
        {links.length > 0 && (
          <MobileMenu
            links={links}
            className="sm:hidden"
            {...(currentPath ? { currentPath } : {})}
          />
        )}
      </div>
    </header>
  );
}
