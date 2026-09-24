import Link from 'next/link';

import { cn } from '@/lib/utils';

export interface FooterLink {
  href: string;
  label: string;
}

export interface FooterProps {
  /** One plain line: who runs this, or the build. No slogans. */
  children?: React.ReactNode;
  links?: readonly FooterLink[];
  className?: string;
}

/** The site footer: quiet, small text, a top outline. Nothing that competes with the page. */
export function Footer({ children, links = [], className }: FooterProps) {
  return (
    <footer className={cn('border-line mt-auto border-t-2', className)}>
      <div className="text-small text-ink-soft mx-auto flex w-full max-w-5xl flex-col gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        {children !== undefined && <div>{children}</div>}
        {links.length > 0 && (
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-ink decoration-brand inline-flex min-h-11 items-center underline decoration-2 underline-offset-4"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </footer>
  );
}
