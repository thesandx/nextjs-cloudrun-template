import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Switch } from './Switch';

describe('Switch', () => {
  it('exposes the switch role with its label', () => {
    render(<Switch label="Sound effects" />);
    expect(screen.getByRole('switch', { name: 'Sound effects' })).not.toBeChecked();
  });

  it('turns on when pressed and reports the change', () => {
    const onChange = vi.fn();
    render(<Switch label="Sound effects" onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).toBeChecked();
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('describes itself with its hint', () => {
    render(<Switch label="Sound effects" hint="Plays when someone wins." />);
    expect(screen.getByRole('switch')).toHaveAccessibleDescription('Plays when someone wins.');
  });
});
