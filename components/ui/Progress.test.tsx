import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Progress } from './Progress';

describe('Progress', () => {
  it('is a labelled progressbar with its value', () => {
    render(<Progress label="Round" value={3} max={5} valueText="3 of 5" />);
    const bar = screen.getByRole('progressbar', { name: 'Round' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(bar).toHaveAttribute('aria-valuetext', '3 of 5');
    expect(screen.getByText('3 of 5')).toBeInTheDocument();
  });

  it('shows a percentage by default', () => {
    render(<Progress label="Upload" value={40} />);
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('clamps a value outside the range', () => {
    render(<Progress label="Upload" value={140} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('fills with a transform, not a width, so it animates without layout', () => {
    const { container } = render(<Progress label="Upload" value={25} />);
    const fill = container.querySelector('[role="progressbar"] > div') as HTMLElement;
    expect(fill.style.transform).toBe('scaleX(0.25)');
    expect(fill.style.width).toBe('');
  });
});
