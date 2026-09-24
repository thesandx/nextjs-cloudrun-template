import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './Badge';

describe('Badge', () => {
  it('shows its words', () => {
    render(<Badge>Host</Badge>);
    expect(screen.getByText('Host')).toBeInTheDocument();
  });

  it('applies the tone fill', () => {
    render(<Badge tone="danger">Expired</Badge>);
    expect(screen.getByText('Expired')).toHaveClass('bg-danger');
  });

  it('has no shadow — it is not pressable', () => {
    render(<Badge>Live</Badge>);
    expect(screen.getByText('Live').className).not.toMatch(/shadow/);
  });
});
