import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageShell } from './PageShell';

describe('PageShell', () => {
  it('is the page main landmark', () => {
    render(<PageShell>Content</PageShell>);
    expect(screen.getByRole('main')).toHaveTextContent('Content');
  });

  it('uses the page frame by default and the reading width on request', () => {
    const { rerender } = render(<PageShell>Content</PageShell>);
    expect(screen.getByRole('main')).toHaveClass('max-w-5xl');
    rerender(<PageShell width="reading">Content</PageShell>);
    expect(screen.getByRole('main')).toHaveClass('max-w-3xl');
  });
});
