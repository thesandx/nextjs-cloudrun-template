import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from './Avatar';

/** The avatar is decoration beside the player's name, so it exposes no text. */
function markup(name: string): string {
  return render(<Avatar name={name} />).container.innerHTML;
}

describe('Avatar', () => {
  it('is deterministic — the same name always draws the same face', () => {
    expect(markup('momo')).toBe(markup('momo'));
  });

  it('ignores case and surrounding space, so "Momo" and " momo " are one player', () => {
    expect(markup('  Momo ')).toBe(markup('momo'));
  });

  it('gives different names different faces', () => {
    expect(markup('captain_k')).not.toBe(markup('bubbles'));
  });

  it('always picks a real tone from the palette', () => {
    for (const name of ['momo', 'sandy', 'captain_k', 'bubbles', 'rajma chawal', '']) {
      const { container } = render(<Avatar name={name} />);
      expect(container.firstElementChild?.className).toMatch(
        /bg-(brand-soft|butter|soda|grape|peach)/,
      );
    }
  });

  it('lets a moment override the mood without changing the colour', () => {
    const { container } = render(<Avatar name="bubbles" mood="wow" />);
    const plain = render(<Avatar name="bubbles" />).container;
    expect(container.innerHTML).not.toBe(plain.innerHTML);
  });

  it('drops the blush at the smallest size, where it reads as noise', () => {
    const { container: small } = render(<Avatar name="momo" size="sm" />);
    const { container: large } = render(<Avatar name="momo" size="lg" />);
    expect(small.querySelectorAll('.fill-blush')).toHaveLength(0);
    expect(large.querySelectorAll('.fill-blush')).toHaveLength(2);
  });
});
