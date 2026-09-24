import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { controlStyles, Field } from './Field';

describe('Field', () => {
  it('wires the label to the control it renders', () => {
    render(<Field label="Nickname">{(control) => <input {...control} />}</Field>);
    expect(screen.getByLabelText('Nickname')).toBeInTheDocument();
  });

  it('describes the control with the error, not the hint, when both are set', () => {
    render(
      <Field label="Room key" hint="Six characters." error="That key expired.">
        {(control) => <input {...control} />}
      </Field>,
    );
    const field = screen.getByLabelText('Room key');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('That key expired.');
    expect(screen.queryByText('Six characters.')).not.toBeInTheDocument();
  });

  it('leaves the control without a description when there is nothing to say', () => {
    render(<Field label="Nickname">{(control) => <input {...control} />}</Field>);
    expect(screen.getByLabelText('Nickname')).not.toHaveAttribute('aria-describedby');
  });
});

describe('controlStyles', () => {
  it('uses the danger outline only when invalid', () => {
    expect(controlStyles(true)).toContain('border-danger');
    expect(controlStyles(false)).toContain('border-line');
  });

  it('wobbles an invalid control once, so the eye finds it', () => {
    expect(controlStyles(true)).toContain('animate-wobble');
    expect(controlStyles(false)).not.toContain('animate-wobble');
  });
});
