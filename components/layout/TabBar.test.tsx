import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TabBar } from './TabBar';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

describe('TabBar', () => {
  it('lists the top-level destinations', () => {
    pathname = '/';
    render(<TabBar />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/profile');
  });

  it('marks the current tab with aria-current', () => {
    pathname = '/profile';
    render(<TabBar />);
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('hides on the sign-in screen', () => {
    pathname = '/sign-in';
    render(<TabBar />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
