import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PhoneNumberInput } from './PhoneNumberInput';

describe('PhoneNumberInput', () => {
  it('names both parts for screen readers', () => {
    render(
      <PhoneNumberInput country="IN" onCountryChange={() => {}} value="" onChange={() => {}} />,
    );
    expect(screen.getByRole('combobox', { name: 'Country code' })).toHaveValue('IN');
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('type', 'tel');
  });

  it('reports a country change and typing', () => {
    const onCountryChange = vi.fn();
    const onChange = vi.fn();
    render(
      <PhoneNumberInput
        country="IN"
        onCountryChange={onCountryChange}
        value=""
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'US' } });
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '415' } });
    expect(onCountryChange).toHaveBeenCalledWith('US');
    expect(onChange).toHaveBeenCalledWith('415');
  });
});
