import Link from 'next/link';

import { ContactLink } from '@/components/ui/ContactLink';
import { copyrightLine, isExternalHref } from '@/lib/contact';
import { cn } from '@/lib/utils';

export interface FooterLink {
  /** An in-app path (`/privacy`), or a full URL, `mailto:` or `tel:` link. */
  href: string;
  label: string;
}

export interface FooterProps {
  /** One plain line: who runs this, or the build. No slogans. */
  children?: React.ReactNode;
  /** Only pages that exist. A footer link to a missing page is a broken link. */
  links?: readonly FooterLink[];
  /** Who holds the copyright. Renders `© <year> <owner>`, with the year from the clock. */
  owner?: string;
  /** The first year of the site. The line then shows a range up to this year. */
  since?: number;
  /** A phone number and an email address, rendered as links a phone can tap. */
  contact?: { phone?: string; email?: string };
  className?: string;
}

/**
 * The site footer: quiet, small text, a top outline. Nothing that competes with the page.
 *
 * The copyright year is never a literal in the source — see `copyrightLine`.
 */
export function Footer({ children, links = [], owner, since, contact, className }: FooterProps) {
  const hasContact = contact?.phone !== undefined || contact?.email !== undefined;
  return (
    <footer className={cn('border-line mt-auto border-t-2', className)}>
      <div className="text-small text-ink-soft mx-auto flex w-full max-w-5xl flex-col gap-3 px-5 py-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-8">
        {(children !== undefined || owner !== undefined) && (
          <div className="flex flex-col gap-1">
            {children !== undefined && <div>{children}</div>}
            {owner !== undefined && <p>{copyrightLine(owner, since)}</p>}
          </div>
        )}
        {hasContact && (
          <address className="flex flex-wrap gap-x-4 gap-y-1 not-italic">
            {contact?.phone !== undefined && <ContactLink kind="phone" value={contact.phone} />}
            {contact?.email !== undefined && <ContactLink kind="email" value={contact.email} />}
          </address>
        )}
        {links.length > 0 && (
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {links.map((link) => {
                const className =
                  'text-ink decoration-brand inline-flex min-h-11 items-center underline decoration-2 underline-offset-4';
                return (
                  <li key={link.href}>
                    {isExternalHref(link.href) ? (
                      <a href={link.href} className={className}>
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className={className}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </footer>
  );
}
