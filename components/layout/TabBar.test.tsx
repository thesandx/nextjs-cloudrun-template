import { fireEvent, render, screen } from '@testing-library/react';
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

  it('slides the pill to a pressed tab at once, before the page arrives', () => {
    pathname = '/';
    const { container } = render(<TabBar />);
    const pill = container.querySelector('ul > span') as HTMLElement;
    expect(pill.style.transform).toBe('translateX(0%)');

    fireEvent.click(screen.getByRole('link', { name: 'Profile' }));
    expect(pill.style.transform).toBe('translateX(200%)');
    // aria-current still names the page actually shown.
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });

  it('leaves the pill alone on a click that opens a new browser tab', () => {
    pathname = '/';
    const { container } = render(<TabBar />);
    fireEvent.click(screen.getByRole('link', { name: 'Profile' }), { metaKey: true });
    const pill = container.querySelector('ul > span') as HTMLElement;
    expect(pill.style.transform).toBe('translateX(0%)');
  });
});
