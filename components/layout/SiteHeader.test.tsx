import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SiteHeader } from './SiteHeader';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

describe('SiteHeader', () => {
  it('lists the same destinations as the tab bar, with the logo linked home', () => {
    pathname = '/';
    render(<SiteHeader appName="Playroom" />);
    expect(screen.getByRole('link', { name: 'Playroom' })).toHaveAttribute('href', '/');
    for (const label of ['Home', 'Components', 'Profile']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('marks the destination of a page below it as current', () => {
    pathname = '/profile/photo';
    render(<SiteHeader appName="Playroom" />);
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('has no phone menu: the tab bar is the phone navigation', () => {
    render(<SiteHeader appName="Playroom" />);
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
  });
});
