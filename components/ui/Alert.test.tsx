import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert } from './Alert';

describe('Alert', () => {
  it('announces a danger alert at once', () => {
    render(<Alert tone="danger" title="That key expired." />);
    expect(screen.getByRole('alert')).toHaveTextContent('That key expired.');
  });

  it('announces the other tones politely', () => {
    render(<Alert tone="success" title="Room created." />);
    expect(screen.getByRole('status')).toHaveTextContent('Room created.');
  });

  it('renders the detail and the action', () => {
    render(
      <Alert title="That key expired." action={<button type="button">Ask for a new key</button>}>
        Keys last one hour.
      </Alert>,
    );
    expect(screen.getByText('Keys last one hour.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask for a new key' })).toBeInTheDocument();
  });

  it('draws a glyph, so the tone never rests on colour alone', () => {
    const { container } = render(<Alert tone="danger" title="Failed." />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
