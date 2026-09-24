import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RadioGroup } from './RadioGroup';

const LENGTHS = [
  { value: 'short', label: 'Short', hint: 'About 5 minutes.' },
  { value: 'standard', label: 'Standard' },
  { value: 'marathon', label: 'Marathon', disabled: true },
] as const;

describe('RadioGroup', () => {
  it('groups the radios under the question', () => {
    render(<RadioGroup label="Round length" name="length" options={LENGTHS} />);
    expect(screen.getByRole('group', { name: 'Round length' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('starts on the default value', () => {
    render(
      <RadioGroup label="Round length" name="length" options={LENGTHS} defaultValue="standard" />,
    );
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked();
  });

  it('reports the chosen value', () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        label="Round length"
        name="length"
        options={LENGTHS}
        value="standard"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Short' }));
    expect(onChange).toHaveBeenCalledWith('short');
  });

  it('describes an option with its hint and disables on request', () => {
    render(<RadioGroup label="Round length" name="length" options={LENGTHS} />);
    expect(screen.getByRole('radio', { name: 'Short' })).toHaveAccessibleDescription(
      'About 5 minutes.',
    );
    expect(screen.getByRole('radio', { name: 'Marathon' })).toBeDisabled();
  });

  it('reports an error on the group', () => {
    render(
      <RadioGroup label="Round length" name="length" options={LENGTHS} error="Pick a length." />,
    );
    expect(screen.getByRole('group')).toHaveAccessibleDescription('Pick a length.');
  });
});
