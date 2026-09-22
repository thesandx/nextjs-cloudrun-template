import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from './Input';

describe('Input', () => {
  it('ties the visible label to the field', () => {
    render(<Input label="Your nickname" />);
    expect(screen.getByLabelText('Your nickname')).toBeInTheDocument();
  });

  it('describes the field with its hint', () => {
    render(<Input label="Your nickname" hint="Friends see this on the board." />);
    expect(screen.getByLabelText('Your nickname')).toHaveAccessibleDescription(
      'Friends see this on the board.',
    );
  });

  it('marks the field invalid and describes the error', () => {
    render(<Input label="Room key" error="Keys are 6 letters or numbers." />);
    const field = screen.getByLabelText('Room key');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Keys are 6 letters or numbers.');
  });

  it('shows the error instead of the hint, so the fix is never buried', () => {
    render(<Input label="Room key" hint="Six characters." error="That key expired." />);
    expect(screen.queryByText('Six characters.')).not.toBeInTheDocument();
    expect(screen.getByText('That key expired.')).toBeInTheDocument();
  });

  it('is not marked invalid when there is no error', () => {
    render(<Input label="Room key" />);
    expect(screen.getByLabelText('Room key')).not.toHaveAttribute('aria-invalid');
  });

  it('gives each instance its own id', () => {
    render(
      <>
        <Input label="First" />
        <Input label="Second" />
      </>,
    );
    expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id);
  });

  it('switches to the code treatment for room keys', () => {
    render(<Input label="Room key" code />);
    expect(screen.getByLabelText('Room key')).toHaveClass('font-display', 'uppercase');
  });
});
