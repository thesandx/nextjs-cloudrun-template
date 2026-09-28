import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import DesignPage from '@/app/design/page';

vi.mock('next/navigation', () => ({ usePathname: () => '/design' }));

describe('DesignPage', () => {
  it('links every entry in the desktop section list to a section on the page', () => {
    const { container } = render(<DesignPage />);
    const list = screen.getByRole('navigation', { name: 'Sections' });
    const links = within(list).getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      expect(container.querySelector(`section#${id}`)).not.toBeNull();
    }
  });
});
