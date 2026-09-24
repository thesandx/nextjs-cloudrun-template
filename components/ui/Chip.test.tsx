import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Chip } from './Chip';

describe('Chip', () => {
  it('renders its text', () => {
    render(<Chip>momo</Chip>);
    expect(screen.getByText('momo')).toBeInTheDocument();
  });

  it('renders the leading slot before the text', () => {
    render(<Chip leading={<span>face</span>}>momo</Chip>);
    const chip = screen.getByText('momo').parentElement;
    expect(chip?.firstElementChild).toHaveTextContent('face');
  });

  it('renders as a list item inside a list', () => {
    render(
      <ul>
        <Chip as="li">momo</Chip>
      </ul>,
    );
    expect(screen.getByRole('listitem')).toHaveTextContent('momo');
  });
});
