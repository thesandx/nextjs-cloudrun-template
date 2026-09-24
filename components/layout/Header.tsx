import Link from 'next/link';

import { Face } from '@/components/ui/Face';
import { cn } from '@/lib/utils';

export interface HeaderLink {
  href: string;
  label: string;
}

export interface HeaderProps {
  /** The product name, beside the mascot. */
  appName: string;
  /** Top-level destinations. Keep it to three or fewer on a phone. */
  links?: readonly HeaderLink[];
  /** The `href` of the page being shown, so its link is marked current. */
  currentPath?: string;
  /** A slot on the right, such as the sign-in state. */
  end?: React.ReactNode;
  className?: string;
}

/**
 * The site header. The logo is the mascot face, never a letter in a circle —
 * see design-language.md > Recipes. The current page has an underline and
 * `aria-current`, not only a colour change.
 */
export function Header({ appName, links = [], currentPath, end, className }: HeaderProps) {
  return (
    <header
      className={cn(
        'mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 sm:px-8',
        className,
      )}
    >
      <Link href="/" className="flex min-h-11 items-center gap-2 font-display">
        <span className="bg-brand-soft border-line inline-grid size-10 shrink-0 place-items-center rounded-full border-2">
          <Face size={32} blush={false} />
        </span>
        <span>{appName}</span>
      </Link>
      {links.length > 0 && (
        <nav aria-label="Main" className="ml-auto shrink-0">
          <ul className="flex items-center gap-1 sm:gap-3">
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
      {end !== undefined && (
        <div className={cn('shrink-0', links.length === 0 && 'ml-auto')}>{end}</div>
      )}
    </header>
  );
}
