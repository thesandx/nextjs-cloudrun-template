import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button, buttonStyles } from './Button';

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Create room</Button>);
    expect(screen.getByRole('button', { name: 'Create room' })).toHaveAttribute('type', 'button');
  });

  it('keeps an explicit type', () => {
    render(<Button type="submit">Join game</Button>);
    expect(screen.getByRole('button', { name: 'Join game' })).toHaveAttribute('type', 'submit');
  });

  it('calls onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Start round</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Start round' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Waiting for host
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Waiting for host' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('buttonStyles', () => {
  it('gives the primary variant the ink outline and the squish', () => {
    const classes = buttonStyles();
    expect(classes).toContain('squish');
    expect(classes).toContain('border-line');
    expect(classes).toContain('bg-brand');
  });

  it('drops the squish on the quiet variant — a text link has no base to sink onto', () => {
    expect(buttonStyles({ variant: 'quiet' })).not.toContain('squish');
  });

  it('meets the 44px touch target at every size', () => {
    // min-h-12 = 48px, min-h-14 = 56px. See design-language.md rule 12.
    expect(buttonStyles({ size: 'md' })).toContain('min-h-12');
    expect(buttonStyles({ size: 'lg' })).toContain('min-h-14');
  });

  it('appends a caller className so a Link can be styled as a button', () => {
    expect(buttonStyles({ className: 'mt-4' })).toContain('mt-4');
  });
});
