import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Speech } from './Speech';

describe('Speech', () => {
  it('renders the mascot line as text', () => {
    render(<Speech>momo joined. That makes five of you.</Speech>);
    expect(screen.getByText('momo joined. That makes five of you.')).toBeInTheDocument();
  });

  it('keeps the mascot face out of the accessibility tree', () => {
    const { container } = render(<Speech>Ready when you are.</Speech>);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('changes the face with the mood', () => {
    const { container: happy } = render(<Speech>Ready.</Speech>);
    const { container: sad } = render(<Speech mood="sad">Ready.</Speech>);
    expect(sad.innerHTML).not.toBe(happy.innerHTML);
  });
});
