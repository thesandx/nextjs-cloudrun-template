import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('announces what is loading', () => {
    render(<Spinner label="Loading rounds" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading rounds');
  });

  it('can keep the words for screen readers only', () => {
    render(<Spinner label="Saving" hideLabel />);
    expect(screen.getByText('Saving')).toHaveClass('sr-only');
  });
});
