// Design-sync shim: outside Next.js there is no router, so `next/link`
// renders the plain anchor it would produce on the server.
import type { AnchorHTMLAttributes, ReactNode } from 'react';

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string | { pathname?: string };
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
  children?: ReactNode;
}

export default function Link({ href, prefetch: _p, replace: _r, scroll: _s, ...rest }: LinkProps) {
  const url = typeof href === 'string' ? href : (href.pathname ?? '/');
  return <a href={url} {...rest} />;
}
