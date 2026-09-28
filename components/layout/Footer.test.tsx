import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Footer } from './Footer';

describe('Footer', () => {
  afterEach(() => vi.useRealTimers());

  it('is the contentinfo landmark with its line and links', () => {
    render(
      <Footer links={[{ href: '/api/health', label: 'Health' }]}>Built from a template.</Footer>,
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Built from a template.');
    expect(screen.getByRole('link', { name: 'Health' })).toHaveAttribute('href', '/api/health');
  });

  it('takes the copyright year from the clock', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-03-01T00:00:00Z'));
    render(<Footer owner="Playroom" since={2026} />);
    expect(screen.getByText('© 2026–2031 Playroom')).toBeInTheDocument();
  });

  it('makes the phone number and the email address tappable', () => {
    render(<Footer contact={{ phone: '+91 98765 43210', email: 'hello@example.com' }} />);
    expect(screen.getByRole('link', { name: '+91 98765 43210' })).toHaveAttribute(
      'href',
      'tel:+919876543210',
    );
    expect(screen.getByRole('link', { name: 'hello@example.com' })).toHaveAttribute(
      'href',
      'mailto:hello@example.com',
    );
  });

  it('renders an external link as a plain anchor', () => {
    render(<Footer links={[{ href: 'https://example.com/terms', label: 'Terms' }]} />);
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute(
      'href',
      'https://example.com/terms',
    );
  });
});
