import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card } from './Card';

describe('Card', () => {
  it('renders its children inside a section by default', () => {
    render(<Card>Round 3</Card>);
    const card = screen.getByText('Round 3');
    expect(card.tagName).toBe('SECTION');
  });

  it('renders as another element when asked', () => {
    render(
      <Card as="article" className="target">
        Bingo
      </Card>,
    );
    expect(screen.getByText('Bingo').tagName).toBe('ARTICLE');
  });

  it('applies the tone fill', () => {
    render(<Card tone="butter">Butter game</Card>);
    expect(screen.getByText('Butter game')).toHaveClass('bg-butter');
  });

  it('hides the peek from assistive technology — it is decoration', () => {
    render(<Card peek={<span>face</span>}>Join</Card>);
    const peek = screen.getByText('face').parentElement;
    expect(peek).toHaveAttribute('aria-hidden', 'true');
  });

  it('adds top room only when something peeks over the edge', () => {
    const { rerender } = render(<Card className="plain">Nothing peeks</Card>);
    expect(screen.getByText('Nothing peeks')).not.toHaveClass('pt-11');

    rerender(<Card peek={<span>face</span>}>Nothing peeks</Card>);
    expect(screen.getByText('Nothing peeks')).toHaveClass('pt-11');
  });
});
