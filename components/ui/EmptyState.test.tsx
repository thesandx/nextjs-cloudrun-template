import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('says what goes here and offers the action that fills it', () => {
    render(
      <EmptyState title="No rounds yet." action={<button type="button">Start round</button>} />,
    );
    expect(screen.getByText('No rounds yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start round' })).toBeInTheDocument();
  });

  it('shows a sleepy face as decoration', () => {
    const { container } = render(<EmptyState title="No rounds yet." />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
