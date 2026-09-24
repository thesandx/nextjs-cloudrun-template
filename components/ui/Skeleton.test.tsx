import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('is hidden from screen readers — it is only a shape', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('takes the shape of what is loading', () => {
    const { container } = render(<Skeleton shape="circle" className="size-16" />);
    expect(container.firstElementChild).toHaveClass('rounded-full', 'size-16', 'animate-breathe');
  });
});
