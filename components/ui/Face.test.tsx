import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Face } from './Face';

describe('Face', () => {
  it('is decoration by default, so screen readers skip it', () => {
    const { container } = render(<Face />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
  });

  it('becomes an image with a name when it carries meaning', () => {
    render(<Face label="The Mochi mascot" />);
    expect(screen.getByRole('img', { name: 'The Mochi mascot' })).toBeInTheDocument();
  });

  it('renders at the requested size', () => {
    const { container } = render(<Face size={64} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '64');
    expect(svg).toHaveAttribute('height', '64');
  });

  it('draws the blush by default and drops it on request', () => {
    const { container: withBlush } = render(<Face />);
    const { container: without } = render(<Face blush={false} />);
    expect(withBlush.querySelectorAll('.fill-blush')).toHaveLength(2);
    expect(without.querySelectorAll('.fill-blush')).toHaveLength(0);
  });

  it('blinks only when asked — ambient motion is the mascot only', () => {
    const { container: still } = render(<Face />);
    const { container: blinking } = render(<Face blink />);
    expect(still.querySelector('.animate-blink')).toBeNull();
    expect(blinking.querySelector('.animate-blink')).not.toBeNull();
  });

  it('changes the drawing with the mood', () => {
    const { container: happy } = render(<Face mood="happy" />);
    const { container: sad } = render(<Face mood="sad" />);
    expect(sad.innerHTML).not.toBe(happy.innerHTML);
  });
});
