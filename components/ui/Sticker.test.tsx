import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sticker } from './Sticker';

describe('Sticker', () => {
  it('is always decoration — it never carries meaning', () => {
    const { container } = render(<Sticker kind="sparkle" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders at the requested size', () => {
    const { container } = render(<Sticker kind="star" size={36} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '36');
    expect(svg).toHaveAttribute('height', '36');
  });

  it('draws each kind differently and fills it from the palette', () => {
    const { container: sparkle } = render(<Sticker kind="sparkle" />);
    const { container: heart } = render(<Sticker kind="heart" />);
    expect(sparkle.querySelector('path')?.getAttribute('d')).not.toBe(
      heart.querySelector('path')?.getAttribute('d'),
    );
    expect(sparkle.querySelector('path')).toHaveClass('fill-butter');
    expect(heart.querySelector('path')).toHaveClass('fill-brand');
  });
});
