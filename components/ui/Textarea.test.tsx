import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('is a labelled multi-line field', () => {
    render(<Textarea label="House rules" />);
    const field = screen.getByLabelText('House rules');
    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveAttribute('rows', '4');
  });

  it('reports an error in words', () => {
    render(<Textarea label="House rules" error="Keep it under 500 characters." />);
    expect(screen.getByLabelText('House rules')).toHaveAccessibleDescription(
      'Keep it under 500 characters.',
    );
  });
});
