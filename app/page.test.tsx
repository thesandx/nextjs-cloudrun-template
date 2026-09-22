import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '@/app/page';

/**
 * Smoke test for the template's home page.
 *
 * `HomePage` is a synchronous Server Component, so React Testing Library can
 * render it directly. Async Server Components cannot be rendered this way —
 * test their data helpers in `lib/` or `services/` instead. See docs/testing.md.
 */
describe('HomePage', () => {
  it('renders the heading', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hello World' })).toBeInTheDocument();
  });

  it('states where the application is running', () => {
    render(<HomePage />);
    expect(screen.getByText(/running successfully on Google Cloud Run/)).toBeInTheDocument();
  });

  it('sends a new contributor to the living design reference', () => {
    render(<HomePage />);
    expect(screen.getByRole('link', { name: 'See every component' })).toHaveAttribute(
      'href',
      '/design',
    );
  });

  it('links the health probe, which serves the runtime values this page cannot', () => {
    render(<HomePage />);
    expect(screen.getByRole('link', { name: 'Check the health probe' })).toHaveAttribute(
      'href',
      '/api/health',
    );
  });

  it('reports the build facts from lib/env, not hardcoded text', () => {
    render(<HomePage />);
    for (const label of ['Service', 'Commit', 'Mode']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // NODE_ENV is 'test' under Vitest, so a hardcoded 'production' would fail here.
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('shows the primitives with real content', () => {
    render(<HomePage />);
    expect(screen.getByText('captain_k')).toBeInTheDocument();
    expect(screen.getByLabelText('Room key')).toBeInTheDocument();
  });
});
