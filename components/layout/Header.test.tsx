import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Header } from './Header';

vi.mock('next/navigation', () => ({ usePathname: () => '/design' }));

const LINKS = [
  { href: '/games', label: 'Games' },
  { href: '/design', label: 'Design' },
];

describe('Header', () => {
  it('makes the logo a link home', () => {
    render(<Header appName="Playroom" />);
    expect(screen.getByRole('link', { name: 'Playroom' })).toHaveAttribute('href', '/');
  });

  it('marks the current page with aria-current, not colour alone', () => {
    render(<Header appName="Playroom" links={LINKS} currentPath="/design" />);
    const inline = screen.getAllByRole('navigation', { name: 'Main' })[0]!;
    expect(within(inline).getByRole('link', { name: 'Design' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(inline).getByRole('link', { name: 'Games' })).not.toHaveAttribute('aria-current');
  });

  it('folds the links into a menu that opens and closes on a phone', () => {
    render(<Header appName="Playroom" links={LINKS} currentPath="/design" />);
    const toggle = screen.getByRole('button', { name: 'Menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(panel).toBeVisible();
    expect(within(panel!).getByRole('link', { name: 'Games' })).toHaveAttribute('href', '/games');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the menu when a link is chosen', () => {
    render(<Header appName="Playroom" links={LINKS} />);
    const toggle = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(toggle);
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '')!;
    fireEvent.click(within(panel).getByRole('link', { name: 'Games' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders no navigation and no menu when there are no links', () => {
    render(<Header appName="Playroom" />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('renders the end slot', () => {
    render(<Header appName="Playroom" end={<span>Signed in</span>} />);
    expect(screen.getByText('Signed in')).toBeInTheDocument();
  });
});
