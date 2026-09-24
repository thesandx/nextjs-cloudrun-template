import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Header } from './Header';

const LINKS = [
  { href: '/games', label: 'Games' },
  { href: '/design', label: 'Design' },
];

describe('Header', () => {
  it('links the product name home', () => {
    render(<Header appName="Playroom" />);
    expect(screen.getByRole('link', { name: 'Playroom' })).toHaveAttribute('href', '/');
  });

  it('marks the current page with aria-current, not colour alone', () => {
    render(<Header appName="Playroom" links={LINKS} currentPath="/design" />);
    expect(screen.getByRole('link', { name: 'Design' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Games' })).not.toHaveAttribute('aria-current');
  });

  it('renders no navigation when there are no links', () => {
    render(<Header appName="Playroom" />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('renders the end slot', () => {
    render(<Header appName="Playroom" end={<span>Signed in</span>} />);
    expect(screen.getByText('Signed in')).toBeInTheDocument();
  });
});
