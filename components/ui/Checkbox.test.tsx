import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('toggles when its label is pressed', () => {
    render(<Checkbox label="Allow late joiners" />);
    const box = screen.getByRole('checkbox', { name: 'Allow late joiners' });
    expect(box).not.toBeChecked();
    fireEvent.click(screen.getByText('Allow late joiners'));
    expect(box).toBeChecked();
  });

  it('describes itself with its hint', () => {
    render(<Checkbox label="Allow late joiners" hint="They start with zero points." />);
    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription(
      'They start with zero points.',
    );
  });

  it('draws a tick, so checked never rests on colour alone', () => {
    const { container } = render(<Checkbox label="Allow late joiners" defaultChecked />);
    expect(container.querySelector('svg')).toHaveClass('peer-checked:block');
  });

  it('can be disabled', () => {
    render(<Checkbox label="Allow late joiners" disabled />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
